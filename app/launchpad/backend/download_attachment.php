<?php
require_once __DIR__ . '/cors_helpers.php';
launchpad_apply_cors_headers('GET, OPTIONS');
// Start output buffering to prevent any accidental output
ob_start();

// Load composer autoloader first (required for Google Drive client classes)
$autoload = __DIR__ . '/../vendor/autoload.php';
if (file_exists($autoload)) {
    require_once $autoload;
}

// Load config - we'll clear headers after
require_once __DIR__ . '/config.php';

// Load Google Drive helper if available
if (file_exists(__DIR__ . '/drive_helper.php')) {
    require_once __DIR__ . '/drive_helper.php';
}

// Clear output buffer and any headers set by config
ob_end_clean();
header_remove();

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit;
}

// Require authentication - allow token from query parameter for direct downloads
// This is needed because direct download links might not send Authorization headers or cookies
$authUser = null;

// Try to get user from headers/cookies first (normal auth)
$token = getBearerTokenFromRequest();
if (!$token) $token = getTokenFromCustomHeaders();
if ($token) {
    $authUser = getAuthenticatedUserFromToken($token);
    if ($authUser) {
        $authUser['id'] = (int)$authUser['id'];
        $authUser['via'] = 'token';
    }
}

// Fallback: try session-based auth
if (!$authUser && isAuthenticated()) {
    $authUser = [
        'id' => (int)$_SESSION['user_id'],
        'username' => $_SESSION['username'],
        'role' => isset($_SESSION['role']) ? $_SESSION['role'] : 'staff',
        'via' => 'session'
    ];
}

// Last resort: try token from query parameter (for direct download links)
if (!$authUser && isset($_GET['token']) && !empty($_GET['token'])) {
    $rawToken = trim($_GET['token']);
    if (strlen($rawToken) >= 32 && strlen($rawToken) <= 256) {
        $authUser = getAuthenticatedUserFromToken($rawToken);
        if ($authUser) {
            $authUser['id'] = (int)$authUser['id'];
            $authUser['via'] = 'token';
        }
    }
}

// If still no auth, reject
if (!$authUser) {
    header_remove();
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Authentication required'
    ]);
    exit;
}

$response = [
    'success' => false,
    'message' => 'An unexpected error occurred.',
];

$conn = getDBConnection();

try {
    if (!isset($_GET['attachment_id']) || empty($_GET['attachment_id'])) {
        throw new Exception("Attachment ID is required.");
    }

    $attachment_id = (int)$_GET['attachment_id'];
    if ($attachment_id <= 0) {
        throw new Exception("Invalid attachment ID.");
    }

    // Get attachment metadata (include staff info for reader role checks)
    $sql = "
        SELECT 
            a.attachment_id,
            a.staff_id,
            a.attachment_type,
            a.original_filename,
            a.stored_path,
            a.stored_filename,
            a.mime_type,
            a.size_bytes,
            s.created_by_user_id,
            s.first_name,
            s.middle_name,
            s.last_name,
            s.email
        FROM StaffAttachments a
        JOIN Staff s ON s.staff_id = a.staff_id
        WHERE a.attachment_id = ?
        LIMIT 1
    ";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("SQL prepare failed: " . $conn->error);
    }

    $stmt->bind_param("i", $attachment_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $attachment = $result->fetch_assoc();
    $stmt->close();

    if (!$attachment) {
        throw new Exception("Attachment not found.");
    }

    // Security: Authorization
    $currentUserId = isset($authUser['id']) ? (int)$authUser['id'] : 0;
    $role = isset($authUser['role']) ? strtolower((string)$authUser['role']) : 'staff';
    $isReader = ($role === 'reader' || $role === 'viewer');

    $isAdminLike = ($role === 'admin' || $role === 'hr');

    if ($isReader) {
        $attachmentType = strtoupper((string)($attachment['attachment_type'] ?? ''));
        if ($attachmentType === 'SIGNATURE') {
            throw new Exception("Access denied.");
        }
        $shareKey = isset($_GET['share_key']) ? trim((string)$_GET['share_key']) : '';
        if ($shareKey === '') {
            throw new Exception("Share key is required for reader access.");
        }

        $shareHash = hash('sha256', $shareKey);
        $shareStmt = $conn->prepare("
            SELECT staff_id, expires_at, revoked_at
            FROM StaffShareKeys
            WHERE token_hash = ?
            LIMIT 1
        ");
        if (!$shareStmt) {
            throw new Exception("Share key lookup failed.");
        }
        $shareStmt->bind_param("s", $shareHash);
        $shareStmt->execute();
        $shareResult = $shareStmt->get_result();
        $shareRow = $shareResult->fetch_assoc();
        $shareStmt->close();

        if (
            !$shareRow ||
            !empty($shareRow['revoked_at']) ||
            strtotime((string)$shareRow['expires_at']) <= time() ||
            (int)$shareRow['staff_id'] !== (int)$attachment['staff_id']
        ) {
            throw new Exception("Access denied.");
        }
    } elseif (!$isAdminLike && (int)$attachment['created_by_user_id'] !== $currentUserId) {
        // Employee/staff: only attachments for staff records they created
        throw new Exception("Access denied. You can only download attachments for staff you created.");
    }

    // Check if file is stored in Google Drive or local filesystem
    $isDriveFile = (strpos($attachment['stored_path'], 'drive://') === 0);
    $fileContent = null;
    $fileSize = (int)$attachment['size_bytes'];
    
    if ($isDriveFile) {
        // File is stored in Google Drive
        if (!isGoogleDriveEnabled() || !function_exists('downloadFileFromDrive')) {
            throw new Exception("Google Drive integration is not available.");
        }
        
        // stored_filename contains the Drive file ID
        $driveFileId = $attachment['stored_filename'];
        $useSharedDrive = isSharedDriveEnabled();
        
        $fileContent = downloadFileFromDrive($driveFileId, $useSharedDrive);
        if ($fileContent === null) {
            throw new Exception("Failed to download file from Google Drive.");
        }
        
        // Update file size from actual content if needed
        $fileSize = strlen($fileContent);
    } else {
        // File is stored locally
        $filePath = __DIR__ . DIRECTORY_SEPARATOR . $attachment['stored_path'] . DIRECTORY_SEPARATOR . $attachment['stored_filename'];

        if (!file_exists($filePath)) {
            throw new Exception("File not found on server.");
        }

        // Security: Prevent directory traversal
        $realPath = realpath($filePath);
        $basePath = realpath(__DIR__ . DIRECTORY_SEPARATOR . 'uploads');
        if (!$realPath || strpos($realPath, $basePath) !== 0) {
            throw new Exception("Invalid file path.");
        }
        
        // Read file content
        $fileContent = file_get_contents($filePath);
        if ($fileContent === false) {
            throw new Exception("Failed to read file from server.");
        }
    }

    // Clear all existing headers and output buffers
    header_remove();
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    // Set headers for file download
    header('Content-Type: ' . $attachment['mime_type'], true);
    header('Content-Disposition: attachment; filename="' . addslashes($attachment['original_filename']) . '"', true);
    header('Content-Length: ' . $fileSize, true);
    header('Cache-Control: private, max-age=3600', true);
    header('Pragma: private', true);
    header('Content-Transfer-Encoding: binary', true);

    // Disable compression for binary files
    if (function_exists('apache_setenv')) {
        @apache_setenv('no-gzip', 1);
    }
    @ini_set('zlib.output_compression', 'Off');

    // Output file content (from Drive or local filesystem)
    echo $fileContent;
    exit;

} catch (Exception $e) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

$conn->close();
?>


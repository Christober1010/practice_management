<?php
/**
 * Upload client documents to Google Drive (or local fallback).
 * Staff documents use upload-staff-document.php (same backend folder).
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

// Return a JSON payload even on fatal errors (helps debug shared-hosting 500s)
register_shutdown_function(function () {
    $err = error_get_last();
    if (!$err) return;
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR];
    if (!in_array($err['type'] ?? 0, $fatalTypes, true)) return;
    if (headers_sent()) return;
    http_response_code(500);
    header("Content-Type: application/json");
    echo json_encode([
        'success' => false,
        'message' => 'Fatal error',
        'error' => ($err['message'] ?? 'unknown'),
        'file' => ($err['file'] ?? null),
        'line' => ($err['line'] ?? null),
    ]);
});

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Load environment variables from .env file
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
}

// Include Google Drive helper
// First try local copy in backend folder, then try maha-launchpad folder
$possiblePaths = [
    __DIR__ . '/drive_helper.php',  // Local copy in backend folder
    __DIR__ . '/backend/drive_helper.php', // When this script is deployed at project root (prod layout)
    dirname(__DIR__) . '/backend/drive_helper.php', // When deployed from inside /backend
    __DIR__ . '/../maha-launchpad/backend/drive_helper.php',  // From maha-launchpad
    dirname(__DIR__) . '/maha-launchpad/backend/drive_helper.php',
];

$driveHelperPath = null;
foreach ($possiblePaths as $path) {
    if ($path && file_exists($path)) {
        $driveHelperPath = $path;
        break;
    }
}

if (!$driveHelperPath) {
    http_response_code(500);
    error_log("Drive helper not found. Tried paths: " . implode(', ', array_filter($possiblePaths)));
    echo json_encode([
        'success' => false, 
        'message' => 'Google Drive helper not found. Please ensure drive_helper.php exists.',
        'debug_info' => [
            'current_dir' => __DIR__,
            'script_filename' => $_SERVER['SCRIPT_FILENAME'] ?? 'N/A',
            'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'N/A'
        ]
    ]);
    exit();
}

// Load drive_helper.php first (before vendor autoloader)
require_once $driveHelperPath;

// Create backend/drive_helper.php wrapper for composer autoloader compatibility
// The wrapper prevents redeclaration by checking if functions already exist
$backendDir = __DIR__ . '/backend';
$backendHelperPath = $backendDir . '/drive_helper.php';
if (!file_exists($backendHelperPath) && file_exists($driveHelperPath)) {
    if (!is_dir($backendDir)) {
        @mkdir($backendDir, 0755, true);
    }
    if (is_dir($backendDir)) {
        // Create wrapper file that prevents redeclaration
        $wrapperContent = "<?php\n";
        $wrapperContent .= "// Wrapper to prevent redeclaration of drive_helper functions\n";
        $wrapperContent .= "if (!function_exists('getGoogleDriveClient')) {\n";
        $wrapperContent .= "    require_once __DIR__ . '/../drive_helper.php';\n";
        $wrapperContent .= "}\n";
        @file_put_contents($backendHelperPath, $wrapperContent);
    }
}

// Load Composer autoloader if available (required for Google Drive API)
// Try multiple paths to find vendor/autoload.php
$vendorPaths = [
    __DIR__ . '/vendor/autoload.php',  // Local vendor folder (e.g. mahaverse-backend-logics)
    __DIR__ . '/backend/vendor/autoload.php',
    dirname(__DIR__) . '/vendor/autoload.php',
    dirname(__DIR__) . '/backend/vendor/autoload.php',
    __DIR__ . '/../maha-launchpad/vendor/autoload.php',  // From maha-launchpad
    dirname($driveHelperPath) . '/../vendor/autoload.php',  // Relative to drive_helper location
    dirname(__DIR__) . '/maha-launchpad/vendor/autoload.php',
];

foreach ($vendorPaths as $vp) {
    if (file_exists($vp)) {
        require_once $vp;
        break;
    }
}

// Database configuration
$host = "db5018266079.hosting-data.io";
$dbname = "dbs14484433";
$user = "dbu3321929";
$pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Check if file was uploaded
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No file uploaded or upload error']);
        exit();
    }

    $file = $_FILES['file'];
    $docUuid = $_POST['doc_uuid'] ?? '';
    $clientId = trim((string)($_POST['client_id'] ?? ''));

    if ($clientId === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'client_id is required']);
        exit();
    }

    // Validate file
    $maxSize = 10 * 1024 * 1024; // 10MB
    if ($file['size'] > $maxSize) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'File size exceeds 10MB limit']);
        exit();
    }

    // Detect MIME type
    $mime = false;
    if (class_exists('finfo')) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
    } elseif (function_exists('mime_content_type')) {
        $mime = mime_content_type($file['tmp_name']);
    }

    $allowedMimes = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/png' => 'png',
    ];

    if (!$mime || !isset($allowedMimes[$mime])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid file type. Only PDF, JPG, and PNG are allowed']);
        exit();
    }

    $ext = $allowedMimes[$mime];
    $originalFilename = basename($file['name']);
    $storedFilename = bin2hex(random_bytes(16)) . '.' . $ext;

    // Calculate SHA256 hash
    $sha256 = hash_file('sha256', $file['tmp_name']);
    if ($sha256 === false) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to hash file']);
        exit();
    }

    // Check if Google Drive is enabled
    $driveEnabled = function_exists('isGoogleDriveEnabled') ? isGoogleDriveEnabled() : false;
    $savedToDrive = false;
    $documentPath = '';
    $documentFilename = '';
    $driveError = null;
    $driveDebug = [];

    // Debug: Check what's available
    $driveDebug['drive_enabled'] = $driveEnabled;
    $driveDebug['has_upload_function'] = function_exists('uploadFileContentToDrive');
    $driveDebug['has_folder_function'] = function_exists('getOrCreateDriveFolder');
    $driveDebug['has_root_folder_function'] = function_exists('getDriveRootFolderId');

    if ($driveEnabled && function_exists('uploadFileContentToDrive') && function_exists('getOrCreateDriveFolder')) {
        try {
            // Get or create client folder in Drive (same pattern as launchpad: staff_X directly under root)
            $clientFolderName = 'client_' . $clientId;
            $rootFolderId = function_exists('getDriveRootFolderId') ? getDriveRootFolderId() : null;
            $useSharedDrive = function_exists('isSharedDriveEnabled') ? isSharedDriveEnabled() : false;

            $driveDebug['root_folder_id'] = $rootFolderId;
            $driveDebug['use_shared_drive'] = $useSharedDrive;
            $driveDebug['client_folder_name'] = $clientFolderName;

            // Before attempting folder creation, verify we can access the configured root folder.
            // Common failure causes:
            // - Drive API disabled for the OAuth project
            // - root folder ID is wrong
            // - OAuth scope is drive.file (cannot access arbitrary existing folders unless created/opened by the app)
            // - root folder is on a Shared Drive without proper flags / permissions
            $driveDebug['root_folder_accessible'] = null;
            if (empty($rootFolderId)) {
                throw new Exception('GOOGLE_DRIVE_ROOT_FOLDER_ID is empty or not set.');
            }

            $probeClient = function_exists('getGoogleDriveClient') ? getGoogleDriveClient() : null;
            $driveDebug['google_client_available'] = $probeClient !== null;
            if (!$probeClient) {
                throw new Exception('Failed to create Google Drive client (check OAuth connection and token refresh).');
            }
            if (!class_exists('Google\\Service\\Drive')) {
                throw new Exception('Google\\Service\\Drive class not found (vendor/autoload.php not loaded correctly).');
            }

            try {
                $probeDrive = new Google\Service\Drive($probeClient);
                $getParams = ['fields' => 'id,name,driveId'];
                // supportsAllDrives is safe even for My Drive and helps if the folder lives in a Shared Drive.
                $getParams['supportsAllDrives'] = true;
                $rootMeta = $probeDrive->files->get($rootFolderId, $getParams);
                $driveDebug['root_folder_accessible'] = true;
                $driveDebug['root_folder_name'] = $rootMeta->getName();
                $driveDebug['root_folder_drive_id'] = $rootMeta->getDriveId();
            } catch (Exception $e) {
                $driveDebug['root_folder_accessible'] = false;
                $driveDebug['root_folder_error'] = $e->getMessage();
                // If root folder is not accessible, don't even try creating subfolders.
                throw new Exception('Root folder is not accessible. Fix GOOGLE_DRIVE_ROOT_FOLDER_ID permissions/scope. Error: ' . $e->getMessage());
            }

            // Create client folder directly under root (like launchpad does with staff_X)
            $clientFolderId = getOrCreateDriveFolder($clientFolderName, $rootFolderId, $useSharedDrive);
            $driveDebug['client_folder_id'] = $clientFolderId;
            
            if (!$clientFolderId) {
                // getOrCreateDriveFolder() logs details to PHP error_log; surface a helpful hint here too.
                $hint = 'Folder create returned null. This is usually permissions (Drive scope) or root folder access.';
                throw new Exception("Failed to create client folder: {$clientFolderName}. {$hint}");
            }
            
            // Use client folder directly for uploads (no nested documents folder)
            $documentsFolderId = $clientFolderId;

            // Read file content
            $fileContent = file_get_contents($file['tmp_name']);
            if ($fileContent === false) {
                throw new Exception("Failed to read file content");
            }

            $driveDebug['file_size'] = strlen($fileContent);
            $driveDebug['mime_type'] = $mime;

            // Upload to Drive
            $driveResult = uploadFileContentToDrive($fileContent, $storedFilename, $mime, $documentsFolderId, $useSharedDrive);
            $driveDebug['upload_result'] = $driveResult;
            
            if (!$driveResult || !isset($driveResult['fileId'])) {
                throw new Exception("Failed to upload to Drive. Result: " . json_encode($driveResult));
            }

            // Store Drive file reference consistently:
            // - document_path holds a drive://<fileId> URI
            // - document_filename holds the Drive fileId (for backwards compatibility)
            $documentPath = 'drive://' . $driveResult['fileId'];
            $documentFilename = $driveResult['fileId']; // Drive file ID
            $savedToDrive = true;

        } catch (Throwable $e) {
            $driveError = $e->getMessage();
            $driveDebug['error'] = $driveError;
            $driveDebug['error_trace'] = $e->getTraceAsString();
            error_log("Drive client document upload failed; falling back to local. client_id={$clientId} doc_uuid={$docUuid} err=" . $e->getMessage());
            $savedToDrive = false;
        }
    } else {
        $driveDebug['skip_reason'] = 'Drive not enabled or functions missing';
    }

    // Fallback to local storage if Drive is not enabled or upload failed
    if (!$savedToDrive) {
        $uploadBaseAbs = __DIR__ . '/uploads';
        $clientDirAbs = $uploadBaseAbs . '/client_' . $clientId;
        $documentsDirAbs = $clientDirAbs . '/documents';

        if (!is_dir($documentsDirAbs)) {
            if (!mkdir($documentsDirAbs, 0755, true)) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to create upload directory']);
                exit();
            }
        }

        $destAbs = rtrim($documentsDirAbs, '/\\') . DIRECTORY_SEPARATOR . $storedFilename;

        if (!move_uploaded_file($file['tmp_name'], $destAbs)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to save uploaded file']);
            exit();
        }

        // Store full relative file path so UI can preview/download directly or via proxy.
        $documentPath = 'uploads/client_' . $clientId . '/documents/' . $storedFilename;
        $documentFilename = $storedFilename;
    }

    // Return success response
    $response = [
        'success' => true,
        'message' => 'Document uploaded successfully',
        'filename' => $originalFilename,
        'document_path' => $documentPath,
        'document_filename' => $documentFilename,
        'saved_to_drive' => $savedToDrive,
    ];
    
    // Include debug info if Drive upload failed
    if (!$savedToDrive && !empty($driveDebug)) {
        $response['drive_debug'] = $driveDebug;
        if ($driveError) {
            $response['drive_error'] = $driveError;
        }
    }
    
    echo json_encode($response);

} catch (PDOException $e) {
    error_log("Database error in upload-client-document.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error occurred']);
} catch (Exception $e) {
    error_log("Error in upload-client-document.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()]);
}


<?php
require_once __DIR__ . '/config.php';

// Only allow POST
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Require authentication (session OR token)
$authUser = requireUser();
$role = isset($authUser['role']) ? $authUser['role'] : 'staff';
$isAdminLike = ($role === 'admin' || $role === 'hr');
if (!$isAdminLike) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied']);
    exit;
}

// Load composer autoloader first
$autoload = __DIR__ . '/../vendor/autoload.php';
if (!file_exists($autoload)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'vendor/autoload.php missing']);
    exit;
}
require_once $autoload;

// Load drive helper (encryption + DB helpers)
if (!file_exists(__DIR__ . '/drive_helper.php')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'drive_helper.php missing']);
    exit;
}
require_once __DIR__ . '/drive_helper.php';

header('Content-Type: application/json; charset=utf-8');

// Read input (JSON preferred, fallback to form field)
$raw = file_get_contents('php://input');
$body = json_decode($raw ?: '[]', true);
$refreshToken = '';
if (is_array($body) && !empty($body['refresh_token'])) {
    $refreshToken = trim((string)$body['refresh_token']);
} elseif (is_array($body) && !empty($body['refreshToken'])) {
    // allow camelCase
    $refreshToken = trim((string)$body['refreshToken']);
} elseif (isset($_POST['refresh_token'])) {
    $refreshToken = trim((string)$_POST['refresh_token']);
} elseif (isset($_POST['refreshToken'])) {
    $refreshToken = trim((string)$_POST['refreshToken']);
}

if ($refreshToken === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'refresh_token is required',
    ]);
    exit;
}

// Basic sanity checks (Google refresh tokens usually start with "1//")
$len = strlen($refreshToken);
$startsOk = (strpos($refreshToken, '1//') === 0);
if ($len < 20 || $len > 4096) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'refresh_token looks invalid (length)',
        'debug' => [
            'length' => $len,
            'starts_with_1_slash_slash' => $startsOk,
        ],
    ]);
    exit;
}

$encrypted = encryptDriveSecret($refreshToken);
if (!$encrypted) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to encrypt refresh token. Check GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY (base64 32 bytes) and openssl.',
    ]);
    exit;
}

try {
    $conn = getDBConnection();
    $stmt = $conn->prepare("
        INSERT INTO GoogleDriveOAuthTokens (id, refresh_token_encrypted, connected_by_user_id, connected_by_username)
        VALUES (1, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          refresh_token_encrypted = VALUES(refresh_token_encrypted),
          connected_by_user_id = VALUES(connected_by_user_id),
          connected_by_username = VALUES(connected_by_username),
          updated_at = NOW()
    ");
    if (!$stmt) {
        throw new Exception('DB prepare failed: ' . $conn->error);
    }

    $uid = isset($authUser['id']) ? (int)$authUser['id'] : null;
    $uname = isset($authUser['username']) ? (string)$authUser['username'] : null;
    $stmt->bind_param('sis', $encrypted, $uid, $uname);
    if (!$stmt->execute()) {
        throw new Exception('DB write failed: ' . $stmt->error);
    }
    $stmt->close();

    echo json_encode([
        'success' => true,
        'message' => 'Refresh token saved. Drive OAuth is now connected.',
        'recommended_env' => [
            // Helps avoid scope mismatch surprises
            'GOOGLE_DRIVE_AUTH_MODE' => 'oauth',
            'GOOGLE_DRIVE_SCOPES' => getenv('GOOGLE_DRIVE_SCOPES') ?: 'https://www.googleapis.com/auth/drive',
        ],
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}



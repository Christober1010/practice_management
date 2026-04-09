<?php
require_once __DIR__ . '/config.php';

// Only allow GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Authenticate (allow token query param)
$authUser = null;
$token = getBearerTokenFromRequest();
if (!$token) $token = getTokenFromCustomHeaders();
if ($token) $authUser = getAuthenticatedUserFromToken($token);
if (!$authUser && isAuthenticated()) {
    $authUser = [
        'id' => (int)$_SESSION['user_id'],
        'username' => $_SESSION['username'],
        'role' => isset($_SESSION['role']) ? $_SESSION['role'] : 'staff',
        'via' => 'session'
    ];
}
if (!$authUser && isset($_GET['token']) && $_GET['token'] !== '') {
    $authUser = getAuthenticatedUserFromToken(trim((string)$_GET['token']));
}
if (!$authUser) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authentication required']);
    exit;
}

$role = isset($authUser['role']) ? $authUser['role'] : 'staff';
$isAdminLike = ($role === 'admin' || $role === 'hr');
if (!$isAdminLike) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied']);
    exit;
}

$enabled = (getenv('GOOGLE_DRIVE_ENABLED') === 'true' || getenv('GOOGLE_DRIVE_ENABLED') === '1');
$authMode = getenv('GOOGLE_DRIVE_AUTH_MODE') ?: 'service_account';

$connected = false;
$connectedBy = null;
$updatedAt = null;

if ($authMode === 'oauth') {
    $conn = getDBConnection();
    $res = $conn->query("SELECT connected_by_username, updated_at, refresh_token_encrypted FROM GoogleDriveOAuthTokens WHERE id = 1 LIMIT 1");
    if ($res) {
        $row = $res->fetch_assoc();
        if ($row && !empty($row['refresh_token_encrypted'])) {
            $connected = true;
            $connectedBy = $row['connected_by_username'] ?? null;
            $updatedAt = $row['updated_at'] ?? null;
        }
    }
} else {
    // service_account: consider "connected" if JSON key is configured
    $saPath = getenv('GOOGLE_SERVICE_ACCOUNT_JSON');
    $saInline = getenv('GOOGLE_SERVICE_ACCOUNT_JSON_INLINE');
    $connected = (!empty($saInline) || (!empty($saPath) && file_exists($saPath)));
}

echo json_encode([
    'success' => true,
    'enabled' => $enabled,
    'auth_mode' => $authMode,
    'connected' => $connected,
    'connected_by' => $connectedBy,
    'updated_at' => $updatedAt,
]);



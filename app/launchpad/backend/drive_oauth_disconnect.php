<?php
require_once __DIR__ . '/config.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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

$conn = getDBConnection();
$stmt = $conn->prepare("UPDATE GoogleDriveOAuthTokens SET refresh_token_encrypted = '', connected_by_user_id = NULL, connected_by_username = NULL WHERE id = 1");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB prepare failed: ' . $conn->error]);
    exit;
}
if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB write failed: ' . $stmt->error]);
    exit;
}
$stmt->close();

echo json_encode(['success' => true, 'message' => 'Google Drive disconnected']);



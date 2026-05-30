<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$user = requireUser();

$token = getBearerTokenFromRequest();
if (!$token) {
    $token = getTokenFromCustomHeaders();
}
if (!$token) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No token to revoke']);
    exit;
}

try {
    $conn = getDBConnection();
    $tokenHash = hash('sha256', trim($token));
    $stmt = $conn->prepare('UPDATE AuthTokens SET revoked_at = NOW() WHERE token_hash = ? AND user_id = ? AND revoked_at IS NULL LIMIT 1');
    if ($stmt) {
        $uid = (int) $user['id'];
        $stmt->bind_param('si', $tokenHash, $uid);
        $stmt->execute();
        $stmt->close();
    }
    echo json_encode(['success' => true, 'message' => 'Logged out']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Logout failed']);
}

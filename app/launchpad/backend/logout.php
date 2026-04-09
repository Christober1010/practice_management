<?php
require_once 'config.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit;
}

// Destroy session
$_SESSION = array();

// Delete session cookie
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

session_destroy();

// Revoke bearer token if provided
try {
    $token = getBearerTokenFromRequest();
    if (!$token) {
        $token = getTokenFromCustomHeaders();
    }
    if ($token) {
        $tokenHash = hash('sha256', $token);
        $conn = getDBConnection();
        $stmt = $conn->prepare("UPDATE AuthTokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL");
        if ($stmt) {
            $stmt->bind_param("s", $tokenHash);
            $stmt->execute();
            $stmt->close();
        }
    }
} catch (Exception $e) {
    // ignore
}

echo json_encode([
    'success' => true,
    'message' => 'Logout successful'
]);
?>


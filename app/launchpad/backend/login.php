<?php
require_once 'config.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// Get database connection
$conn = getDBConnection();

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Support both email and username (for backward compatibility)
$identifier = isset($input['email']) ? trim($input['email']) : (isset($input['username']) ? trim($input['username']) : '');
$password = isset($input['password']) ? $input['password'] : '';

if (empty($identifier) || empty($password)) {
    http_response_code(400);
    echo json_encode(['error' => 'Email/username and password are required']);
    exit();
}

// Validate email format if email is provided
if (filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
    // It's an email, search by email
    $stmt = $conn->prepare("SELECT id, username, email, password_hash, role, is_active FROM Users WHERE email = ? AND is_active = 1 LIMIT 1");
} else {
    // It's a username, search by username
    $stmt = $conn->prepare("SELECT id, username, email, password_hash, role, is_active FROM Users WHERE username = ? AND is_active = 1 LIMIT 1");
}

if (!$stmt) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit();
}

$stmt->bind_param("s", $identifier);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    $stmt->close();
    http_response_code(401);
    echo json_encode(['error' => 'Invalid email/username or password']);
    exit();
}

$user = $result->fetch_assoc();
$stmt->close();

// Verify password
$passwordValid = password_verify($password, $user['password_hash']);

if (!$passwordValid) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid email/username or password']);
    exit();
}

// Establish authenticated session (server-side)
session_regenerate_id(true);
$_SESSION['user_id'] = (int)$user['id'];
$_SESSION['username'] = $user['username'];
$_SESSION['role'] = $user['role'];
$_SESSION['authenticated'] = true;

// Issue a token for token-based auth (needed when cookies can't be used cross-origin over HTTP)
$rawToken = bin2hex(random_bytes(32)); // 64 hex chars
$tokenHash = hash('sha256', $rawToken);

// Persist token -> user mapping
$insert = $conn->prepare("INSERT INTO AuthTokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))");
if ($insert) {
    $uid = (int)$user['id'];
    $insert->bind_param("is", $uid, $tokenHash);
    $insert->execute();
    $insert->close();
}

// Client-side expiry hint (session cookie lifetime is browser-session by default)
$expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

// Update last login timestamp
$updateStmt = $conn->prepare("UPDATE Users SET last_login = NOW() WHERE id = ?");
if ($updateStmt) {
    $updateStmt->bind_param("i", $user['id']);
    $updateStmt->execute();
    $updateStmt->close();
}

$permissions = [];
try {
    if (function_exists('rbac_get_effective_permissions')) {
        $permissions = rbac_get_effective_permissions($user['role'], 'launchpad');
    }
} catch (Throwable $e) {
    $permissions = [];
}

// Return success response
http_response_code(200);
echo json_encode([
    'success' => true,
    'user' => [
        'id' => $user['id'],
        'username' => $user['username'],
        'email' => $user['email'],
        'role' => $user['role'],
        'permissions' => $permissions,
    ],
    // Frontend stores this as "auth_token" and sends it back as csrf_token and/or Bearer token.
    'token' => $rawToken,
    'expires_at' => $expiresAt
]);

$conn->close();
?>

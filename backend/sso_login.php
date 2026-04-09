<?php
// Launchpad SSO login endpoint (TEST env copy)
// Expected request: POST JSON { "email": "user@domain.com" }
// Expected response: { success: true, token: "...", user: {...}, expires_at: "YYYY-mm-dd HH:ii:ss" }

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed_origins = array_filter([
    getenv('MAHAVERSE_ORIGIN') ?: null,
    'https://mahaverse-dev.mahabehavioralhealth.com',
    'https://mahaverse.mahabehavioralhealth.com',
]);

if ($origin && in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header("Vary: Origin");
    header("Access-Control-Allow-Credentials: true");
} else {
    header("Access-Control-Allow-Origin: *");
}

header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-SSO-Secret, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$expectedSecret = getenv('LAUNCHPAD_SSO_SECRET') ?: (getenv('SSO_SECRET') ?: '');
if ($expectedSecret !== '') {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $provided = $headers['X-SSO-Secret'] ?? $headers['x-sso-secret'] ?? '';
    if (!is_string($provided) || !hash_equals($expectedSecret, $provided)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit();
    }
}

// TEST DB config (use env if set)
$host = getenv('DB_HOST') ?: 'db5018266079.hosting-data.io';
$dbname = getenv('DB_NAME') ?: 'dbs14484433';
$username = getenv('DB_USER') ?: 'dbu3321929';
$password = getenv('DB_PASS') ?: 'M@h@B3h@v1or@lH3@lth4@ut1sm';

try {
    $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);
$emailRaw = is_array($input) ? ($input['email'] ?? '') : '';
$email = filter_var($emailRaw, FILTER_SANITIZE_EMAIL);

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Valid email is required']);
    exit();
}

try {
    $stmt = $pdo->prepare("SELECT id, email, role, first_name, last_name, is_active FROM users WHERE email = ? AND is_active = 1 LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'User not found or inactive']);
        exit();
    }

    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
        ],
        'token' => $token,
        'expires_at' => $expiresAt,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'SSO login failed']);
}



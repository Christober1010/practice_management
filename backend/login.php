<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$host = "db5018266079.hosting-data.io";
$dbname = "dbs14484433";
$dbUser = "dbu3321929";
$dbPass = "M@h@B3h@v1or@lH3@lth4@ut1sm";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $dbUser, $dbPass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit();
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['email']) || !isset($input['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Email and password are required']);
    exit();
}

$emailRaw = isset($input['email']) ? trim((string) $input['email']) : '';
$password = isset($input['password']) ? (string) $input['password'] : '';

// Validate email format (avoid FILTER_SANITIZE_EMAIL — it can alter valid addresses in PHP 8+)
if ($emailRaw === '' || !filter_var($emailRaw, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email format']);
    exit();
}

try {
    // Case-insensitive match; do not require is_active here so we can return a clear inactive message
    $stmt = $pdo->prepare("SELECT id, email, password, role, first_name, last_name, is_active FROM users WHERE LOWER(TRIM(email)) = LOWER(?)");
    $stmt->execute([$emailRaw]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid email or password']);
        exit();
    }

    if (empty($user['is_active']) || (int) $user['is_active'] !== 1) {
        http_response_code(403);
        echo json_encode(['error' => 'This account is inactive. Ask an administrator to activate it.']);
        exit();
    }

    // Verify password - check if it's hashed or plain text
    $passwordValid = false;
    
    // First try password_verify for hashed passwords
    if (password_verify($password, $user['password'])) {
        $passwordValid = true;
    } 
    // If that fails, check if it's a plain text password (temporary fallback)
    else if ($password === $user['password']) {
        $passwordValid = true;
        
        // Optional: Update to hashed password for security
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        $updateStmt = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
        $updateStmt->execute([$hashedPassword, $user['id']]);
    }
    
    if (!$passwordValid) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid email or password']);
        exit();
    }

    // Generate session token
    $sessionToken = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

    // Effective permissions (Mahaverse scope); legacy fallback if RBAC tables missing
    $permissions = [];
    try {
        require_once __DIR__ . '/config.php';
        if (function_exists('rbac_get_effective_permissions')) {
            $permissions = rbac_get_effective_permissions($user['role'], 'mahaverse');
        }
    } catch (Throwable $e) {
        $permissions = [];
    }

    // Persist Bearer token for API auth (me-permissions, RBAC admin, etc.)
    try {
        if (function_exists('getDBConnection')) {
            $conn = getDBConnection();
            $tc = $conn->query("SHOW TABLES LIKE 'AuthTokens'");
            if ($tc && $tc->num_rows > 0) {
                $tokenHash = hash('sha256', $sessionToken);
                $ins = $conn->prepare('INSERT INTO AuthTokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))');
                if ($ins) {
                    $uid = (int) $user['id'];
                    $ins->bind_param('is', $uid, $tokenHash);
                    $ins->execute();
                    $ins->close();
                }
            }
        }
    } catch (Throwable $e) {
        // optional: token persistence not available
    }

    // Return success response
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'permissions' => $permissions,
        ],
        'token' => $sessionToken,
        'expires_at' => $expiresAt
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Authentication failed']);
}
?>

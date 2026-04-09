<?php
// Database Configuration
define('DB_HOST', 'db5019142527.hosting-data.io');
define('DB_NAME', 'dbs15042247');
define('DB_USER', 'dbu2982354');
define('DB_PASS', 'M@h@B3h@v1or@lH3@lth4@ut1sm');

// Load environment variables from backend/.env (Google Drive config, etc.)
// - In production: prefer real environment variables (recommended).
// - For local/dev: copy `backend/env.example` -> `backend/.env` and fill real values.
if (file_exists(__DIR__ . '/.env')) {
    $envFile = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($envFile as $line) {
        $line = trim($line);
        // Skip empty lines and comments
        if (empty($line) || strpos($line, '#') === 0) continue;
        // Skip lines without =
        if (strpos($line, '=') === false) continue;
        
        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        
        // Skip if key is empty
        if (empty($key)) continue;
        
        // Remove quotes if present
        if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
            (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
            $value = substr($value, 1, -1);
        }
        
        // Always set from .env file (override existing env vars from .env)
        // This allows .env to take precedence over system environment variables
        putenv("$key=$value");
        $_ENV[$key] = $value;
    }
}

// Google Drive Configuration (set via environment variables)
// GOOGLE_DRIVE_ENABLED=true
// GOOGLE_DRIVE_ROOT_FOLDER_ID=your_folder_id
// GOOGLE_DRIVE_IMPERSONATE_USER=hr-automation@yourdomain.com
// GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/service-account.json
// GOOGLE_DRIVE_SHARED_DRIVE_ID=your_shared_drive_id (optional)

// CORS Configuration
// Configure allowed origins (comma-separated for multiple origins)
// For production, set this to your actual frontend domain(s)
$allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://localhost:3000',
    'https://localhost:3001',
    // Mahaverse (frontend) origins that call Launchpad backend cross-origin
    'https://mahaverse-dev.mahabehavioralhealth.com',
    'https://mahaverse.mahabehavioralhealth.com',
    'http://launchpad.dev.mahabehavioralhealth.com',
    'https://launchpad.dev.mahabehavioralhealth.com',
    'https://launchpad.mahabehavioralhealth.com',
    'https://maha-launchpad.mahabehavioralhealth.com',
];

// Get the origin from the request
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
$requestHost = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';

// Check if origin matches the request host (same domain)
$isSameDomain = !empty($origin) && parse_url($origin, PHP_URL_HOST) === $requestHost;

// Check if the origin is allowed (whitelist or same domain)
if (in_array($origin, $allowedOrigins) || $isSameDomain) {
    header("Access-Control-Allow-Origin: $origin");
} elseif (!empty($origin)) {
    // If origin is set but not in whitelist and not same domain, don't set CORS header
}

// CORS headers for credentials (needed for sessions/cookies)
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, Accept, Origin, Authorization, X-Auth-Token, X-CSRF-Token, X-SSO-Secret');
header('Access-Control-Max-Age: 86400'); // 24 hours

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Session Configuration
// Detect if we're using HTTPS
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') 
           || (!empty($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443)
           || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

// Check if request is from localhost (different ports)
$originHost = !empty($origin) ? parse_url($origin, PHP_URL_HOST) : '';
$isLocalhostRequest = strpos($requestHost, 'localhost') !== false || strpos($requestHost, '127.0.0.1') !== false;
$isLocalhostOrigin = !empty($originHost) && (strpos($originHost, 'localhost') !== false || strpos($originHost, '127.0.0.1') !== false);

// Determine if this is cross-origin (different domains)
// Note: localhost to remote server IS cross-origin
$isCrossOrigin = !empty($origin) && !$isSameDomain;

// Determine SameSite value
// Special handling for localhost -> remote server (development scenario)
// Some browsers allow SameSite=None with Secure=false for localhost
if ($isHttps && $isCrossOrigin) {
    // Cross-origin with HTTPS - use None with Secure
    $sameSite = 'None';
    $cookieSecure = 1;
} elseif ($isCrossOrigin && $isLocalhostOrigin) {
    // Cross-origin from localhost to remote server (development)
    // Try SameSite=None with Secure=false - some browsers allow this for localhost
    $sameSite = 'None';
    $cookieSecure = 0; // Allow insecure cookies for localhost development
} else {
    // Same-origin or localhost-to-localhost - use Lax
    $sameSite = 'Lax';
    $cookieSecure = $isHttps ? 1 : 0;
}

// Configure session settings (must be before session_start)
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_secure', $cookieSecure);
ini_set('session.cookie_samesite', $sameSite);

// Set cookie parameters explicitly (this must be done before session_start)
// For same-domain scenarios, empty domain allows cookies to work across subdirectories
session_set_cookie_params([
    'lifetime' => 0, // Session cookie (expires when browser closes)
    'path' => '/',
    'domain' => '', // Empty means current domain only - allows same-domain cookies to work
    'secure' => $cookieSecure,
    'httponly' => true,
    'samesite' => $sameSite
]);

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Helper function to get database connection
function getDBConnection() {
    static $conn = null;
    
    if ($conn === null) {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        
        if ($conn->connect_error) {
            error_log("Database connection failed: " . $conn->connect_error);
            http_response_code(500);
            die(json_encode([
                'success' => false,
                'message' => 'Database connection failed'
            ]));
        }
        
        $conn->set_charset("utf8mb4");
    }
    
    return $conn;
}

// Helper function to generate CSRF token
function generateCSRFToken() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

// Helper function to validate CSRF token
function validateCSRFToken($token) {
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

// Helper function to check if user is authenticated
function isAuthenticated() {
    return isset($_SESSION['user_id']) && isset($_SESSION['username']) && isset($_SESSION['authenticated']);
}

// Helper function to require authentication
function requireAuth() {
    if (!isAuthenticated()) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Authentication required'
        ]);
        exit;
    }
}

// -----------------------------
// Token-based auth (for cross-origin HTTP where cookies may not work)
// -----------------------------
function getAuthorizationHeader() {
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        return trim($_SERVER['HTTP_AUTHORIZATION']);
    }
    // Common on many PHP-FPM / CGI setups
    if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    }
    if (isset($_SERVER['AUTHORIZATION'])) {
        return trim($_SERVER['AUTHORIZATION']);
    }
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            return trim($headers['Authorization']);
        }
        if (isset($headers['authorization'])) {
            return trim($headers['authorization']);
        }
    }
    return '';
}

function getTokenFromCustomHeaders() {
    // Some servers strip Authorization, but keep X-* headers.
    if (isset($_SERVER['HTTP_X_AUTH_TOKEN']) && $_SERVER['HTTP_X_AUTH_TOKEN'] !== '') {
        return trim($_SERVER['HTTP_X_AUTH_TOKEN']);
    }
    if (isset($_SERVER['HTTP_X_CSRF_TOKEN']) && $_SERVER['HTTP_X_CSRF_TOKEN'] !== '') {
        return trim($_SERVER['HTTP_X_CSRF_TOKEN']);
    }
    return '';
}

function getBearerTokenFromRequest() {
    $authHeader = getAuthorizationHeader();
    if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        return trim($matches[1]);
    }
    return '';
}

function getRequestTokenFallback() {
    // For legacy clients: token sometimes comes in as csrf_token form field
    if (isset($_POST['csrf_token']) && $_POST['csrf_token'] !== '') {
        return $_POST['csrf_token'];
    }
    return '';
}

function getAuthenticatedUserFromToken($rawToken) {
    if (!$rawToken) return null;

    // basic sanity: expecting a hex token (bin2hex(32 bytes) => 64 chars)
    $rawToken = trim($rawToken);
    if (strlen($rawToken) < 32 || strlen($rawToken) > 256) return null;

    $tokenHash = hash('sha256', $rawToken);
    $conn = getDBConnection();

    $sql = "
        SELECT u.id, u.username, u.role
        FROM AuthTokens t
        JOIN Users u ON u.id = t.user_id
        WHERE t.token_hash = ?
          AND t.revoked_at IS NULL
          AND t.expires_at > NOW()
        LIMIT 1
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) return null;

    $stmt->bind_param("s", $tokenHash);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();

    if ($row) {
        // Update last_used_at (best-effort)
        $upd = $conn->prepare("UPDATE AuthTokens SET last_used_at = NOW() WHERE token_hash = ? LIMIT 1");
        if ($upd) {
            $upd->bind_param("s", $tokenHash);
            $upd->execute();
            $upd->close();
        }
        return $row;
    }
    return null;
}

function getAuthenticatedUser() {
    // Prefer session if available
    if (isAuthenticated()) {
        return [
            'id' => (int)$_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'role' => isset($_SESSION['role']) ? $_SESSION['role'] : 'staff',
            'via' => 'session'
        ];
    }

    // Fallback to bearer token or csrf_token form field
    $token = getBearerTokenFromRequest();
    if (!$token) $token = getTokenFromCustomHeaders();
    if (!$token) $token = getRequestTokenFallback();
    $user = getAuthenticatedUserFromToken($token);
    if ($user) {
        $user['id'] = (int)$user['id'];
        $user['via'] = 'token';
        return $user;
    }

    return null;
}

function requireUser() {
    $user = getAuthenticatedUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Authentication required'
        ]);
        exit;
    }
    return $user;
}

require_once __DIR__ . '/rbac_helpers.php';

// Helper function to sanitize input
function sanitizeInput($data) {
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    return $data;
}

// Set JSON header (skip for OAuth endpoints that need to redirect)
$scriptName = '';
if (isset($_SERVER['SCRIPT_NAME'])) {
    $scriptName = basename($_SERVER['SCRIPT_NAME']);
} elseif (isset($_SERVER['PHP_SELF'])) {
    $scriptName = basename($_SERVER['PHP_SELF']);
} elseif (isset($_SERVER['REQUEST_URI'])) {
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if ($path) {
        $scriptName = basename($path);
    }
}
$isOAuthEndpoint = in_array($scriptName, ['drive_oauth_start.php', 'drive_oauth_callback.php']);

if (!$isOAuthEndpoint && !headers_sent()) {
    header('Content-Type: application/json');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
}
?>


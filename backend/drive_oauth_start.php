<?php
// Enable error reporting for debugging (remove in production if needed)
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display, but log
ini_set('log_errors', 1);

// Start output buffering early to catch any unexpected output
ob_start();

// Set error handler to catch fatal errors
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== NULL && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        // Clear all output buffers
        while (ob_get_level() > 0) {
            @ob_end_clean();
        }
        
        // Try to remove headers (may fail if headers already sent)
        @header_remove();
        
        // Set response code and content type
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json', true);
            echo json_encode([
                'success' => false,
                'message' => 'Internal server error',
                'error' => $error['message'] . ' in ' . basename($error['file']) . ' on line ' . $error['line'],
                'type' => 'fatal_error'
            ]);
        } else {
            // Headers already sent - output as text
            echo "\n\n<!-- Fatal Error: " . htmlspecialchars($error['message'], ENT_QUOTES) . " in " . htmlspecialchars($error['file'], ENT_QUOTES) . " on line " . $error['line'] . " -->";
        }
    }
});

try {
    require_once __DIR__ . '/config.php';
} catch (Throwable $e) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header_remove();
    http_response_code(500);
    header('Content-Type: application/json');
    if (!headers_sent()) {
        echo json_encode([
            'success' => false,
            'message' => 'Configuration error: ' . $e->getMessage(),
            'error' => $e->getMessage()
        ]);
    }
    exit;
}

// Base64url helpers for OAuth state
function b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
function b64url_decode(string $data): string|false {
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/'), true);
}

function decode_drive_key_32(string $keyB64): string|false {
    $norm = strtr(trim($keyB64), '-_', '+/');
    $rem = strlen($norm) % 4;
    if ($rem) $norm .= str_repeat('=', 4 - $rem);
    $raw = base64_decode($norm, true);
    if ($raw === false) return false;
    return (strlen($raw) === 32) ? $raw : false;
}

// Only allow GET
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header_remove();
    http_response_code(405);
    header('Content-Type: application/json');
    if (!headers_sent()) {
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
    exit;
}

// Authenticate (allow token query param for cross-origin flows)
// For OAuth setup, allow access without authentication but prefer authenticated users
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

// If no authentication, use a system user for OAuth setup (TEST ENVIRONMENT ONLY)
if (!$authUser) {
    $authUser = [
        'id' => 0,
        'username' => 'system',
        'role' => 'admin',
        'via' => 'system_setup'
    ];
}

// Check role - require admin for authenticated users, but allow system setup
$role = isset($authUser['role']) ? $authUser['role'] : 'staff';
$isAdminLike = ($role === 'admin' || $role === 'hr' || $authUser['via'] === 'system_setup');
if (!$isAdminLike) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header_remove();
    http_response_code(403);
    header('Content-Type: application/json');
    if (!headers_sent()) {
        echo json_encode(['success' => false, 'message' => 'Access denied. Admin role required.']);
    }
    exit;
}

// Create backend/drive_helper.php wrapper for composer autoloader compatibility
// The wrapper prevents redeclaration by checking if functions already exist
$backendDir = __DIR__ . '/backend';
$backendHelperPath = $backendDir . '/drive_helper.php';
$localHelperPath = __DIR__ . '/drive_helper.php';
if (!file_exists($backendHelperPath) && file_exists($localHelperPath)) {
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

// Load composer autoloader first (required for Google API client)
// Try multiple paths to find vendor/autoload.php
$vendorPaths = [
    __DIR__ . '/vendor/autoload.php',  // Local vendor folder in mahaverse-backend
    __DIR__ . '/../maha-launchpad/vendor/autoload.php',
    __DIR__ . '/../vendor/autoload.php',
];
$autoload = null;
foreach ($vendorPaths as $vp) {
    if (file_exists($vp)) {
        $autoload = $vp;
        break;
    }
}

if (!$autoload) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header_remove();
    http_response_code(500);
    header('Content-Type: application/json');
    if (!headers_sent()) {
        echo json_encode([
            'success' => false,
            'message' => 'Composer autoloader not found. Run composer install.',
            'error' => 'vendor/autoload.php not found',
            'tried_paths' => $vendorPaths
        ]);
    }
    exit;
}

try {
    require_once $autoload;
} catch (Throwable $e) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header_remove();
    http_response_code(500);
    header('Content-Type: application/json');
    if (!headers_sent()) {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to load composer autoloader: ' . $e->getMessage(),
            'error' => $e->getMessage()
        ]);
    }
    exit;
}

if (!file_exists(__DIR__ . '/drive_helper.php')) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header_remove();
    http_response_code(500);
    header('Content-Type: application/json');
    if (!headers_sent()) {
        echo json_encode(['success' => false, 'message' => 'Drive helper not found']);
    }
    exit;
}

try {
    require_once __DIR__ . '/drive_helper.php';
} catch (Throwable $e) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header_remove();
    http_response_code(500);
    header('Content-Type: application/json');
    if (!headers_sent()) {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to load drive helper: ' . $e->getMessage(),
            'error' => $e->getMessage()
        ]);
    }
    exit;
}

// Verify Google Client class exists (after autoloader is loaded)
if (!class_exists('Google\\Client')) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header_remove();
    http_response_code(500);
    header('Content-Type: application/json');
    if (!headers_sent()) {
        echo json_encode([
            'success' => false,
            'message' => 'Google API client not installed. Run composer install.',
            'error' => 'Google\\Client class not found'
        ]);
    }
    exit;
}

// Note: We don't pre-check for Google\Auth\OAuth2 because it's an internal dependency
// that will be autoloaded when needed. If it's missing, the error will occur when
// we try to create the auth URL, and we'll catch it in the try-catch block below.

$clientId = getenv('GOOGLE_DRIVE_OAUTH_CLIENT_ID');
$clientSecret = getenv('GOOGLE_DRIVE_OAUTH_CLIENT_SECRET');
if (empty($clientId) || empty($clientSecret)) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header_remove();
    http_response_code(500);
    header('Content-Type: application/json');
    if (!headers_sent()) {
        echo json_encode(['success' => false, 'message' => 'OAuth client id/secret not configured']);
    }
    exit;
}

$redirectUri = getenv('GOOGLE_DRIVE_OAUTH_REDIRECT_URI');
if (empty($redirectUri)) {
    // Best-effort default based on current host/path
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $redirectUri = $scheme . '://' . $host . '/backend/drive_oauth_callback.php';
}

// Log redirect URI for debugging (verify it matches Google Console)
error_log("OAuth redirect URI: " . $redirectUri);

// Ensure session is started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$returnTo = isset($_GET['return_to']) ? trim((string)$_GET['return_to']) : '';
// Build a signed state payload so callback works even if PHP session/cookies are lost.
// We sign using the same 32-byte key used to encrypt the refresh token.
$keyB64 = getenv('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY') ?: '';
$keyRaw = $keyB64 ? decode_drive_key_32($keyB64) : false;
if ($keyRaw === false) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header_remove();
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY is invalid. It must be base64 of 32 bytes (AES-256).',
    ]);
    exit;
}

$payloadArr = [
    't' => time(),
    'rt' => $returnTo,
    'uid' => isset($authUser['id']) ? (int)$authUser['id'] : null,
    'un' => isset($authUser['username']) ? (string)$authUser['username'] : null,
];
$payloadJson = json_encode($payloadArr);
if ($payloadJson === false) {
    throw new Exception('Failed to encode OAuth state payload');
}
$sigRaw = hash_hmac('sha256', $payloadJson, $keyRaw, true);
$state = b64url_encode($payloadJson) . '.' . b64url_encode($sigRaw);

try {
    // Verify Google Client can be instantiated
    if (!class_exists('Google\Client')) {
        throw new Exception('Google\Client class not found. Make sure composer dependencies are installed.');
    }
    
    $client = new Google\Client();
    if (!$client) {
        throw new Exception('Failed to instantiate Google\Client');
    }
    
    $client->setClientId($clientId);
    $client->setClientSecret($clientSecret);
    $client->setRedirectUri($redirectUri);

    $scopesEnv = getenv('GOOGLE_DRIVE_SCOPES');
    $scopes = $scopesEnv ? array_values(array_filter(array_map('trim', explode(',', $scopesEnv)))) : [];
    if (empty($scopes)) $scopes = ['https://www.googleapis.com/auth/drive.file'];
    $client->setScopes($scopes);

    $client->setAccessType('offline');
    $client->setPrompt('consent'); // ensure refresh_token
    $client->setIncludeGrantedScopes(true);
    $client->setState($state);

    $authUrl = $client->createAuthUrl();
    if (empty($authUrl)) {
        throw new Exception('Failed to create OAuth authorization URL');
    }
    
    // Log auth URL for debugging
    error_log("OAuth auth URL created successfully");

    // Debug mode: return the auth URL instead of redirecting
    if (isset($_GET['debug']) && $_GET['debug'] === '1') {
        while (ob_get_level()) ob_end_clean();
        header_remove();
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'auth_url' => $authUrl]);
        exit;
    }

    // Clear any output buffers completely
    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    // Remove ALL headers set by config.php (it forces JSON + DENY framing)
    // This is critical - config.php sets Content-Type: application/json which breaks redirects
    header_remove();
    
    // Set proper headers for redirect
    header('Cache-Control: no-store, no-cache, must-revalidate, private', true);
    header('Pragma: no-cache', true);
    header('Expires: 0', true);
    header('Content-Type: text/html; charset=utf-8', true);

    // Check if headers were already sent (this would cause blank screen)
    if (headers_sent($file, $line)) {
        error_log("Headers already sent in $file at line $line");
        // Fallback: output HTML redirect
        echo '<!doctype html><html><head><meta charset="utf-8">';
        echo '<meta http-equiv="refresh" content="0;url=' . htmlspecialchars($authUrl, ENT_QUOTES, 'UTF-8') . '">';
        echo '<title>Redirecting…</title></head><body style="font-family:system-ui, -apple-system, Segoe UI, Roboto, sans-serif;">';
        echo '<p>Redirecting to Google…</p>';
        echo '<p>If you are not redirected automatically, <a href="' . htmlspecialchars($authUrl, ENT_QUOTES, 'UTF-8') . '">click here to continue</a>.</p>';
        echo '</body></html>';
        exit;
    }

    // Redirect to Google OAuth
    http_response_code(302);
    header('Location: ' . $authUrl, true, 302);
    
    // HTML fallback (if Location header is stripped or blocked, user can still click)
    echo '<!doctype html><html><head><meta charset="utf-8">';
    echo '<meta http-equiv="refresh" content="0;url=' . htmlspecialchars($authUrl, ENT_QUOTES, 'UTF-8') . '">';
    echo '<title>Redirecting…</title></head><body style="font-family:system-ui, -apple-system, Segoe UI, Roboto, sans-serif;">';
    echo '<p>Redirecting to Google…</p>';
    echo '<p>If you are not redirected automatically, <a href="' . htmlspecialchars($authUrl, ENT_QUOTES, 'UTF-8') . '">click here to continue</a>.</p>';
    echo '</body></html>';
    exit;

} catch (Throwable $e) {
    // Clear output buffers
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    // Log the error for debugging
    error_log("OAuth start error: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    // Remove headers set by config.php
    header_remove();
    
    http_response_code(500);
    header('Content-Type: application/json');
    
    // Check if this is a missing class error (dependency issue)
    $errorMessage = $e->getMessage();
    $isMissingClass = (
        strpos($errorMessage, 'not found') !== false ||
        strpos($errorMessage, 'Class ') !== false ||
        strpos($errorMessage, 'Google\\Auth\\OAuth2') !== false
    );
    
    if ($isMissingClass) {
        $errorMessage = 'Google API client dependencies are incomplete. Please run "composer install --no-dev" on your server to install all required dependencies. Error: ' . $e->getMessage();
    } else {
        $errorMessage = 'Failed to initiate OAuth flow: ' . $e->getMessage();
    }
    
    // Check if we can still send headers
    if (headers_sent()) {
        // Headers already sent - output error as HTML
        echo '<!doctype html><html><head><meta charset="utf-8"><title>Error</title></head><body>';
        echo '<h1>OAuth Error</h1>';
        echo '<p>' . htmlspecialchars($errorMessage, ENT_QUOTES, 'UTF-8') . '</p>';
        if ($isMissingClass) {
            echo '<h2>How to Fix:</h2>';
            echo '<ol>';
            echo '<li>SSH into your server</li>';
            echo '<li>Navigate to your project directory: <code>cd /path/to/maha-launchpad</code></li>';
            echo '<li>Run: <code>composer install --no-dev</code></li>';
            echo '<li>If composer is not installed, install it first (see <a href="https://getcomposer.org/download/">getcomposer.org</a>)</li>';
            echo '</ol>';
            echo '<p>Or check the diagnostic tool: <a href="check_google_deps.php">check_google_deps.php</a></p>';
        }
        echo '</body></html>';
    } else {
        echo json_encode([
            'success' => false,
            'message' => $errorMessage,
            'error' => $e->getMessage(),
            'fix_required' => $isMissingClass ? 'Run composer install --no-dev on your server' : null
        ]);
    }
    exit;
}



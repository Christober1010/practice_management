<?php
require_once __DIR__ . '/config.php';

// Base64url helpers for signed OAuth state
function b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
function b64url_decode(string $data): string|false {
    $remainder = strlen($data) % 4;
    if ($remainder) $data .= str_repeat('=', 4 - $remainder);
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

// Load composer autoloader first (required for Google API client)
$autoload = __DIR__ . '/../vendor/autoload.php';
if (file_exists($autoload)) {
    require_once $autoload;
}

if (!file_exists(__DIR__ . '/drive_helper.php')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Drive helper not found']);
    exit;
}
require_once __DIR__ . '/drive_helper.php';

if (!class_exists('Google\\Client')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Google API client not installed (vendor/ missing)']);
    exit;
}

$clientId = getenv('GOOGLE_DRIVE_OAUTH_CLIENT_ID');
$clientSecret = getenv('GOOGLE_DRIVE_OAUTH_CLIENT_SECRET');
if (empty($clientId) || empty($clientSecret)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'OAuth client id/secret not configured']);
    exit;
}

$redirectUri = getenv('GOOGLE_DRIVE_OAUTH_REDIRECT_URI');
if (empty($redirectUri)) {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $redirectUri = $scheme . '://' . $host . '/backend/drive_oauth_callback.php';
}

$returnTo = isset($_GET['return_to']) ? trim((string)$_GET['return_to']) : '';
// Signed state payload (does not rely on PHP sessions/cookies)
$keyB64 = getenv('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY') ?: '';
$keyRaw = $keyB64 ? decode_drive_key_32($keyB64) : false;
if ($keyRaw === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY is invalid. It must be base64 of 32 bytes (AES-256).']);
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
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to encode OAuth state payload']);
    exit;
}
$sigRaw = hash_hmac('sha256', $payloadJson, $keyRaw, true);
$state = b64url_encode($payloadJson) . '.' . b64url_encode($sigRaw);

try {
    $client = new Google\Client();
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

    while (ob_get_level()) ob_end_clean();
    header_remove();
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'auth_url' => $authUrl]);
    exit;
} catch (Exception $e) {
    while (ob_get_level()) ob_end_clean();
    http_response_code(500);
    header_remove();
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Failed to create OAuth link: ' . $e->getMessage()]);
    exit;
}



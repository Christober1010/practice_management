<?php
// Make this endpoint self-diagnosing (shared hosting often hides PHP fatals and leads to "blank page")
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ob_start();

register_shutdown_function(function () {
    $err = error_get_last();
    if (!$err) return;
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR];
    if (!in_array($err['type'], $fatalTypes, true)) return;

    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    @header_remove();
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html><head><meta charset="utf-8"><title>OAuth Error</title></head><body style="font-family:system-ui, sans-serif; padding:24px;">';
        echo '<h1>Google Drive Connect Failed</h1>';
        echo '<p><strong>Fatal error:</strong> ' . htmlspecialchars($err['message'], ENT_QUOTES, 'UTF-8') . '</p>';
        echo '<p><strong>File:</strong> ' . htmlspecialchars(basename($err['file']), ENT_QUOTES, 'UTF-8') . ' (line ' . (int)$err['line'] . ')</p>';
        echo '</body></html>';
    }
});

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
$autoloadLoaded = false;
foreach ($vendorPaths as $vp) {
    if (file_exists($vp)) {
        require_once $vp;
        $autoloadLoaded = true;
        break;
    }
}

require_once __DIR__ . '/config.php';

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
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

if (!file_exists(__DIR__ . '/drive_helper.php')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Drive helper not found']);
    exit;
}
require_once __DIR__ . '/drive_helper.php';

if (!class_exists('Google\\Client')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Google API client not installed. Run composer install.']);
    exit;
}

// Validate signed state (does not rely on PHP session cookies)
$state = isset($_GET['state']) ? (string)$_GET['state'] : '';
if ($state === '' || strpos($state, '.') === false) {
    http_response_code(400);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Google Drive Connect Failed</title></head>';
    echo '<body style="font-family:system-ui, sans-serif; padding:24px; max-width: 820px; margin: 0 auto;">';
    echo '<h1>Google Drive Connect Failed</h1>';
    echo '<p><strong>Error:</strong> Missing or invalid OAuth state.</p>';
    echo '<p>This usually means the callback URL was opened directly, or the Connect flow used an outdated link. Please go back to Launchpad and click <strong>Connect / Reconnect Drive</strong> again.</p>';
    echo '</body></html>';
    exit;
}

[$payloadB64, $sigB64] = explode('.', $state, 2);
$payloadJson = b64url_decode($payloadB64);
$sigRaw = b64url_decode($sigB64);
if ($payloadJson === false || $sigRaw === false) {
    http_response_code(400);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Google Drive Connect Failed</title></head>';
    echo '<body style="font-family:system-ui, sans-serif; padding:24px; max-width: 820px; margin: 0 auto;">';
    echo '<h1>Google Drive Connect Failed</h1>';
    echo '<p><strong>Error:</strong> Invalid OAuth state encoding.</p>';
    echo '<p>Please go back to Launchpad and click <strong>Connect / Reconnect Drive</strong> again.</p>';
    echo '</body></html>';
    exit;
}

$keyB64 = getenv('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY') ?: '';
$keyRaw = $keyB64 ? decode_drive_key_32($keyB64) : false;
if ($keyRaw === false) {
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Google Drive Connect Failed</title></head>';
    echo '<body style="font-family:system-ui, sans-serif; padding:24px; max-width: 820px; margin: 0 auto;">';
    echo '<h1>Google Drive Connect Failed</h1>';
    echo '<p><strong>Error:</strong> Invalid GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY (must be base64 32 bytes).</p>';
    echo '</body></html>';
    exit;
}

$expectedSig = hash_hmac('sha256', $payloadJson, $keyRaw, true);
if (!hash_equals($expectedSig, $sigRaw)) {
    http_response_code(400);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Google Drive Connect Failed</title></head>';
    echo '<body style="font-family:system-ui, sans-serif; padding:24px; max-width: 820px; margin: 0 auto;">';
    echo '<h1>Google Drive Connect Failed</h1>';
    echo '<p><strong>Error:</strong> Invalid OAuth state signature.</p>';
    echo '<p>Please go back to Launchpad and click <strong>Connect / Reconnect Drive</strong> again.</p>';
    echo '</body></html>';
    exit;
}

$payloadArr = json_decode($payloadJson, true);
if (!is_array($payloadArr)) {
    http_response_code(400);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Google Drive Connect Failed</title></head>';
    echo '<body style="font-family:system-ui, sans-serif; padding:24px; max-width: 820px; margin: 0 auto;">';
    echo '<h1>Google Drive Connect Failed</h1>';
    echo '<p><strong>Error:</strong> Invalid OAuth state payload.</p>';
    echo '</body></html>';
    exit;
}

// Optional: state expiry (15 min)
$issuedAt = isset($payloadArr['t']) ? (int)$payloadArr['t'] : 0;
if ($issuedAt <= 0 || (time() - $issuedAt) > (15 * 60)) {
    http_response_code(400);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Google Drive Connect Failed</title></head>';
    echo '<body style="font-family:system-ui, sans-serif; padding:24px; max-width: 820px; margin: 0 auto;">';
    echo '<h1>Google Drive Connect Failed</h1>';
    echo '<p><strong>Error:</strong> OAuth state expired. Please try connecting again.</p>';
    echo '</body></html>';
    exit;
}

$code = isset($_GET['code']) ? trim((string)$_GET['code']) : '';
if ($code === '') {
    $err = isset($_GET['error']) ? (string)$_GET['error'] : 'OAuth error';
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $err]);
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

try {
    $client = new Google\Client();
    $client->setClientId($clientId);
    $client->setClientSecret($clientSecret);
    $client->setRedirectUri($redirectUri);

    $token = $client->fetchAccessTokenWithAuthCode($code);
    if (isset($token['error'])) {
        $err = (string)($token['error'] ?? 'unknown_error');
        $desc = (string)($token['error_description'] ?? '');
        $msg = "OAuth token exchange failed: {$err}" . ($desc !== '' ? " — {$desc}" : "");
        throw new Exception($msg);
    }

    $refreshToken = isset($token['refresh_token']) ? (string)$token['refresh_token'] : '';
    if ($refreshToken === '') {
        throw new Exception('No refresh_token returned. Make sure prompt=consent and access_type=offline.');
    }

    $encrypted = encryptDriveSecret($refreshToken);
    if (!$encrypted) {
        throw new Exception('Failed to encrypt refresh token. Check GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY (base64 32 bytes) and openssl.');
    }

    // Store token (single row)
    $conn = getDBConnection();
    $stmt = $conn->prepare("
        INSERT INTO GoogleDriveOAuthTokens (id, refresh_token_encrypted, connected_by_user_id, connected_by_username)
        VALUES (1, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          refresh_token_encrypted = VALUES(refresh_token_encrypted),
          connected_by_user_id = VALUES(connected_by_user_id),
          connected_by_username = VALUES(connected_by_username),
          updated_at = NOW()
    ");
    if (!$stmt) {
        throw new Exception('DB prepare failed: ' . $conn->error);
    }

    // Prefer connected-by info from signed state payload (session may not exist)
    $uid = isset($payloadArr['uid']) ? (int)$payloadArr['uid'] : null;
    $uname = isset($payloadArr['un']) ? (string)$payloadArr['un'] : null;
    $stmt->bind_param("sis", $encrypted, $uid, $uname);
    if (!$stmt->execute()) {
        throw new Exception('DB write failed: ' . $stmt->error);
    }
    $stmt->close();
    
} catch (Throwable $e) {
    // Clear output buffers
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    header_remove();
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');

    error_log("OAuth callback error: " . $e->getMessage());

    // Show a human-readable page (this is a top-level browser redirect, not an API call)
    if (!headers_sent()) {
        $msg = $e->getMessage();
        $hint = '';
        $common = [];

        if (stripos($msg, 'No refresh_token returned') !== false) {
            $hint = 'Google did not return a refresh token. This usually happens if the account already granted access before. '
                  . 'Fix: go to https://myaccount.google.com/permissions, remove access for this app, then click Connect Drive again.';
        }

        // Help diagnose "Unauthorized"/invalid client issues
        if (stripos($msg, 'unauthorized') !== false || stripos($msg, 'invalid_client') !== false || stripos($msg, 'unauthorized_client') !== false) {
            $common[] = 'Verify GOOGLE_DRIVE_OAUTH_CLIENT_ID and GOOGLE_DRIVE_OAUTH_CLIENT_SECRET match the SAME OAuth Client in Google Cloud Console.';
            $common[] = 'Verify the OAuth Client type is **Web application** (not Desktop).';
            $common[] = 'Verify the **Authorized redirect URI** includes exactly this URL: ' . $redirectUri;
            $common[] = 'If your OAuth consent screen is in Testing, make sure your Google account is added as a Test User.';
        }

        echo '<!doctype html><html><head><meta charset="utf-8"><title>Google Drive Connect Failed</title></head>';
        echo '<body style="font-family:system-ui, sans-serif; padding:24px; max-width: 820px; margin: 0 auto;">';
        echo '<h1>Google Drive Connect Failed</h1>';
        echo '<p><strong>Error:</strong> ' . htmlspecialchars($msg, ENT_QUOTES, 'UTF-8') . '</p>';
        echo '<hr style="margin: 18px 0;">';
        echo '<h2 style="margin: 0 0 8px 0; font-size: 16px;">Debug info</h2>';
        echo '<ul style="margin-top: 0;">';
        echo '<li><strong>Redirect URI used:</strong> <code>' . htmlspecialchars($redirectUri, ENT_QUOTES, 'UTF-8') . '</code></li>';
        echo '<li><strong>Client ID set:</strong> <code>' . htmlspecialchars((string)$clientId, ENT_QUOTES, 'UTF-8') . '</code></li>';
        echo '</ul>';
        if ($hint) {
            echo '<p><strong>How to fix:</strong> ' . htmlspecialchars($hint, ENT_QUOTES, 'UTF-8') . '</p>';
        }
        if (!empty($common)) {
            echo '<h2 style="margin: 16px 0 8px 0; font-size: 16px;">Most common fixes for this error</h2><ul>';
            foreach ($common as $c) {
                echo '<li>' . htmlspecialchars($c, ENT_QUOTES, 'UTF-8') . '</li>';
            }
            echo '</ul>';
        }
        echo '<p>You can close this tab and return to Launchpad.</p>';
        echo '</body></html>';
    }
    exit;
}

$returnTo = isset($payloadArr['rt']) ? trim((string)$payloadArr['rt']) : '';

// Clear any output buffers
while (ob_get_level() > 0) {
    ob_end_clean();
}

// Remove JSON headers set by config.php
header_remove('Content-Type');
header_remove('X-Content-Type-Options');
header_remove('X-Frame-Options');
header_remove('X-XSS-Protection');

// Show a success page (with optional redirect) so the user never sees a "blank white screen"
header('Content-Type: text/html; charset=utf-8');
echo '<!doctype html><html><head><meta charset="utf-8">';
if ($returnTo !== '') {
    echo '<meta http-equiv="refresh" content="2;url=' . htmlspecialchars($returnTo, ENT_QUOTES, 'UTF-8') . '">';
}
echo '<title>Google Drive Connected</title></head><body style="font-family:system-ui, sans-serif; padding:24px; max-width: 820px; margin: 0 auto;">';
echo '<h1>✓ Google Drive Connected</h1>';
echo '<p>The connection was saved successfully. You can close this tab.</p>';
if ($returnTo !== '') {
    echo '<p>Redirecting you back in 2 seconds…</p>';
    echo '<p><a href="' . htmlspecialchars($returnTo, ENT_QUOTES, 'UTF-8') . '">Click here if you are not redirected</a></p>';
}
echo '</body></html>';
exit;



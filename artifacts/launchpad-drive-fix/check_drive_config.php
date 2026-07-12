<?php
/**
 * Check Google Drive OAuth Configuration
 * 
 * This script checks if all required environment variables are set correctly
 * for Google Drive OAuth integration.
 * 
 * Access: https://launchpad.mahabehavioralhealth.com/backend/check_drive_config.php
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

$checks = [
    'GOOGLE_DRIVE_ENABLED' => [
        'required' => true,
        'value' => getenv('GOOGLE_DRIVE_ENABLED'),
        'valid' => false,
        'message' => ''
    ],
    'GOOGLE_DRIVE_AUTH_MODE' => [
        'required' => true,
        'value' => getenv('GOOGLE_DRIVE_AUTH_MODE'),
        'valid' => false,
        'message' => ''
    ],
    'GOOGLE_DRIVE_OAUTH_CLIENT_ID' => [
        'required' => true,
        'value' => getenv('GOOGLE_DRIVE_OAUTH_CLIENT_ID'),
        'valid' => false,
        'message' => ''
    ],
    'GOOGLE_DRIVE_OAUTH_CLIENT_SECRET' => [
        'required' => true,
        'value' => getenv('GOOGLE_DRIVE_OAUTH_CLIENT_SECRET'),
        'valid' => false,
        'message' => ''
    ],
    'GOOGLE_DRIVE_OAUTH_REDIRECT_URI' => [
        'required' => true,
        'value' => getenv('GOOGLE_DRIVE_OAUTH_REDIRECT_URI'),
        'valid' => false,
        'message' => ''
    ],
    'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY' => [
        'required' => true,
        'value' => getenv('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY'),
        'valid' => false,
        'message' => ''
    ],
    'GOOGLE_DRIVE_SCOPES' => [
        'required' => false,
        'value' => getenv('GOOGLE_DRIVE_SCOPES'),
        'valid' => true,
        'message' => ''
    ],
    'GOOGLE_DRIVE_ROOT_FOLDER_ID' => [
        'required' => false,
        'value' => getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID'),
        'valid' => false,
        'message' => ''
    ],
];

// Validate each check
foreach ($checks as $key => &$check) {
    $value = $check['value'];
    
    if ($check['required'] && (empty($value) || $value === false)) {
        $check['valid'] = false;
        $check['message'] = 'Missing or empty';
    } else {
        switch ($key) {
            case 'GOOGLE_DRIVE_ENABLED':
                $check['valid'] = ($value === 'true' || $value === '1');
                $check['message'] = $check['valid'] ? 'Enabled ✓' : 'Should be "true" or "1"';
                break;
                
            case 'GOOGLE_DRIVE_AUTH_MODE':
                $check['valid'] = ($value === 'oauth' || $value === 'service_account');
                $check['message'] = $check['valid'] ? 'Valid mode ✓' : 'Should be "oauth" or "service_account"';
                break;
                
            case 'GOOGLE_DRIVE_OAUTH_CLIENT_ID':
                $check['valid'] = !empty($value) && strpos($value, '.apps.googleusercontent.com') !== false;
                $check['message'] = $check['valid'] ? 'Valid client ID ✓' : 'Should end with .apps.googleusercontent.com';
                break;
                
            case 'GOOGLE_DRIVE_OAUTH_CLIENT_SECRET':
                $check['valid'] = !empty($value) && strlen($value) > 10;
                $check['message'] = $check['valid'] ? 'Set ✓' : 'Should be a non-empty string';
                // Don't show the actual secret value
                if ($check['valid']) {
                    $check['value'] = substr($value, 0, 10) . '...' . ' (hidden)';
                }
                break;
                
            case 'GOOGLE_DRIVE_OAUTH_REDIRECT_URI':
                $check['valid'] = !empty($value) && 
                    filter_var($value, FILTER_VALIDATE_URL) !== false &&
                    strpos($value, 'https://') === 0;
                $check['message'] = $check['valid'] ? 'Valid HTTPS URL ✓' : 'Should be a valid HTTPS URL';
                // Check if it matches expected pattern
                if ($check['valid']) {
                    $expected = 'https://launchpad.mahabehavioralhealth.com/backend/drive_oauth_callback.php';
                    if ($value !== $expected) {
                        $check['message'] = 'Valid URL but should match: ' . $expected;
                    }
                }
                break;
                
            case 'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY':
                // Must be base64(32 random bytes) -> decodes to exactly 32 bytes (AES-256 key)
                $decoded = null;
                if (!empty($value)) {
                    $norm = strtr(trim((string)$value), '-_', '+/');
                    $rem = strlen($norm) % 4;
                    if ($rem) $norm .= str_repeat('=', 4 - $rem);
                    $decoded = base64_decode($norm, true);
                }
                $check['valid'] = (!empty($value) && $decoded !== false && is_string($decoded) && strlen($decoded) === 32);
                $check['message'] = $check['valid']
                    ? 'Valid (base64 32 bytes) ✓'
                    : 'Invalid. Must be base64-encoded 32 random bytes (AES-256 key).';
                // Don't show the actual key
                if (!empty($value)) {
                    $check['value'] = substr($value, 0, 10) . '...' . ' (hidden)';
                }
                break;

            case 'GOOGLE_DRIVE_SCOPES':
                // Optional scopes override (comma-separated)
                $rawScopes = trim((string)$value);
                if ($rawScopes === '') {
                    $check['valid'] = true;
                    $check['message'] = 'Not set (defaults: OAuth=drive.file, Service Account=drive)';
                } else {
                    $scopes = array_values(array_filter(array_map('trim', explode(',', $rawScopes))));
                    $check['valid'] = !empty($scopes);
                    $check['message'] = $check['valid'] ? ('Set ✓ (' . implode(', ', $scopes) . ')') : 'Invalid (must be comma-separated scopes)';
                }
                break;
                
            case 'GOOGLE_DRIVE_ROOT_FOLDER_ID':
                // Not secret; this is the Google Drive folder ID (often starts with "1", e.g. 1AbC...XyZ)
                // Extra guard: users sometimes accidentally paste a base64 encryption key here.
                $raw = trim((string)$value);
                if ($raw === '') {
                    $check['valid'] = false;
                    $check['message'] = 'Optional but recommended (Drive folder ID)';
                    break;
                }

                // Detect "looks like base64(32 bytes)" (very likely an encryption key, not a folder id).
                $norm = strtr($raw, '-_', '+/');
                $rem = strlen($norm) % 4;
                if ($rem) $norm .= str_repeat('=', 4 - $rem);
                $decoded = base64_decode($norm, true);
                $looksLikeKey = ($decoded !== false && is_string($decoded) && strlen($decoded) === 32);

                if ($looksLikeKey) {
                    $check['valid'] = false;
                    $check['message'] = 'Looks like a base64 encryption key (32 bytes), not a Drive folder ID. Set this to the folder id from the Drive URL (/folders/<ID>).';
                    break;
                }

                // Basic folder-id sanity: allow common Drive id charset
                $check['valid'] = (bool)preg_match('/^[A-Za-z0-9_-]{10,}$/', $raw);
                $check['message'] = $check['valid']
                    ? 'Set ✓'
                    : 'Set, but does not look like a Drive folder ID (expected something like 1AbC... from the Drive URL).';
                break;
        }
    }
}
unset($check);

// Check if vendor/autoload.php exists
$vendorAutoload = __DIR__ . '/../vendor/autoload.php';
$vendorExists = file_exists($vendorAutoload);

// Check if drive_helper.php exists
$driveHelper = __DIR__ . '/drive_helper.php';
$driveHelperExists = file_exists($driveHelper);

// Check if Google Client class can be loaded
$googleClientAvailable = false;
if ($vendorExists) {
    try {
        require_once $vendorAutoload;
        $googleClientAvailable = class_exists('Google\Client');
    } catch (Exception $e) {
        // Ignore
    }
}

// Check database table
$oauthTableExists = false;
try {
    $conn = getDBConnection();
    $result = $conn->query("SHOW TABLES LIKE 'GoogleDriveOAuthTokens'");
    $oauthTableExists = ($result && $result->num_rows > 0);
} catch (Exception $e) {
    // Ignore
}

// Summary
$allRequiredValid = true;
foreach ($checks as $key => $check) {
    if ($check['required'] && !$check['valid']) {
        $allRequiredValid = false;
        break;
    }
}

$response = [
    'success' => $allRequiredValid,
    'summary' => [
        'all_required_valid' => $allRequiredValid,
        'total_checks' => count($checks),
        'required_checks' => count(array_filter($checks, fn($c) => $c['required'])),
        'valid_required' => count(array_filter($checks, fn($c) => $c['required'] && $c['valid'])),
    ],
    'environment_checks' => $checks,
    'dependencies' => [
        'vendor_autoload_exists' => $vendorExists,
        'drive_helper_exists' => $driveHelperExists,
        'google_client_available' => $googleClientAvailable,
        'oauth_table_exists' => $oauthTableExists,
    ],
    'recommendations' => []
];

// Add recommendations
if (!$allRequiredValid) {
    $response['recommendations'][] = 'Fix all required environment variables in backend/.env';
}

// OAuth + drive.file scope warning (common cause of "folder not found" when targeting an existing folder ID)
try {
    $authMode = getenv('GOOGLE_DRIVE_AUTH_MODE');
    $scopesEnv = getenv('GOOGLE_DRIVE_SCOPES');
    $rootFolder = getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID');
    if ($authMode === 'oauth' && !empty($rootFolder)) {
        $scopes = $scopesEnv ? array_values(array_filter(array_map('trim', explode(',', (string)$scopesEnv)))) : [];
        $effectiveScopes = empty($scopes) ? ['https://www.googleapis.com/auth/drive.file'] : $scopes;
        $hasFullDrive = in_array('https://www.googleapis.com/auth/drive', $effectiveScopes, true);
        if (!$hasFullDrive) {
            $response['recommendations'][] =
                'OAuth mode default scope is drive.file which may not access an arbitrary root folder id. Consider setting GOOGLE_DRIVE_SCOPES=https://www.googleapis.com/auth/drive and re-linking Drive, or switch to service_account mode.';
        }
    }
} catch (Throwable $e) {
    // ignore
}

if (!$vendorExists) {
    $response['recommendations'][] = 'Upload vendor/ folder to server (same level as backend/)';
}

if (!$googleClientAvailable) {
    $response['recommendations'][] = 'Google API client not loaded - check vendor/ folder';
}

if (!$oauthTableExists) {
    $response['recommendations'][] = 'Create GoogleDriveOAuthTokens table (run create_google_drive_oauth_tokens_table.sql)';
}

$redirectUri = getenv('GOOGLE_DRIVE_OAUTH_REDIRECT_URI');
if (!empty($redirectUri)) {
    $response['google_cloud_console_action'] = [
        'message' => 'Update Google Cloud Console with this redirect URI:',
        'redirect_uri' => $redirectUri,
        'steps' => [
            '1. Go to https://console.cloud.google.com/',
            '2. Navigate to: APIs & Services → Credentials',
            '3. Click on your OAuth 2.0 Client ID',
            '4. Under "Authorized redirect URIs", add: ' . $redirectUri,
            '5. Save the changes'
        ]
    ];
}

echo json_encode($response, JSON_PRETTY_PRINT);


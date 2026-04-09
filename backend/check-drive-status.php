<?php
/**
 * Google Drive Integration Status Check for Mahaverse
 *
 * This endpoint provides comprehensive status of Google Drive integration
 *
 * Access URL (production):
 * - https://www.mahabehavioralhealth.com/mahaverse-backend-logics/check-drive-status.php
 */

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");

// Load environment variables
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
}

$status = [
    'success' => true,
    'timestamp' => date('Y-m-d H:i:s'),
    'environment' => 'test',
    'environment_vars' => [],
    'files' => [],
    'connection' => [],
    'recommendations' => []
];

// 1. Check environment variables
$envVars = [
    'GOOGLE_DRIVE_ENABLED' => getenv('GOOGLE_DRIVE_ENABLED'),
    'GOOGLE_DRIVE_AUTH_MODE' => getenv('GOOGLE_DRIVE_AUTH_MODE'),
    'GOOGLE_DRIVE_ROOT_FOLDER_ID' => getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID'),
    'GOOGLE_DRIVE_OAUTH_CLIENT_ID' => getenv('GOOGLE_DRIVE_OAUTH_CLIENT_ID'),
    'GOOGLE_DRIVE_OAUTH_CLIENT_SECRET' => getenv('GOOGLE_DRIVE_OAUTH_CLIENT_SECRET'),
    'GOOGLE_DRIVE_OAUTH_REDIRECT_URI' => getenv('GOOGLE_DRIVE_OAUTH_REDIRECT_URI'),
    'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY' => getenv('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY'),
    'GOOGLE_DRIVE_SCOPES' => getenv('GOOGLE_DRIVE_SCOPES'),
];

foreach ($envVars as $key => $value) {
    $status['environment_vars'][$key] = [
        'set' => !empty($value),
        'value' => in_array($key, ['GOOGLE_DRIVE_OAUTH_CLIENT_SECRET', 'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY']) 
            ? (empty($value) ? null : substr($value, 0, 10) . '... (hidden)')
            : $value
    ];
}

// 2. Check required files
$driveHelperPath = __DIR__ . '/drive_helper.php';
$vendorPath1 = __DIR__ . '/vendor/autoload.php';  // Local vendor folder
$vendorPath2 = __DIR__ . '/../maha-launchpad/vendor/autoload.php';
$vendorPath3 = dirname(__DIR__) . '/maha-launchpad/vendor/autoload.php';

$status['files'] = [
    'drive_helper_local' => [
        'path' => $driveHelperPath,
        'exists' => file_exists($driveHelperPath),
        'readable' => file_exists($driveHelperPath) ? is_readable($driveHelperPath) : false
    ],
    'drive_helper_launchpad' => [
        'path' => __DIR__ . '/../maha-launchpad/backend/drive_helper.php',
        'exists' => file_exists(__DIR__ . '/../maha-launchpad/backend/drive_helper.php'),
    ],
    'vendor_autoload_1' => [
        'path' => $vendorPath1,
        'exists' => file_exists($vendorPath1),
    ],
    'vendor_autoload_2' => [
        'path' => $vendorPath2,
        'exists' => file_exists($vendorPath2),
    ],
    'vendor_autoload_3' => [
        'path' => $vendorPath3,
        'exists' => file_exists($vendorPath3),
    ],
];

// 3. Try to load drive_helper.php
$driveHelperLoaded = false;
$googleClientAvailable = false;

if (file_exists($driveHelperPath)) {
    try {
        require_once $driveHelperPath;
        $driveHelperLoaded = true;
        
        // Check if Google Client can be loaded
        $vendorPaths = [$vendorPath1, $vendorPath2, $vendorPath3];
        foreach ($vendorPaths as $vp) {
            if (file_exists($vp)) {
                require_once $vp;
                if (class_exists('Google\Client')) {
                    $googleClientAvailable = true;
                    break;
                }
            }
        }
    } catch (Throwable $e) {
        $status['files']['drive_helper_error'] = $e->getMessage();
    }
} elseif (file_exists(__DIR__ . '/../maha-launchpad/backend/drive_helper.php')) {
    try {
        require_once __DIR__ . '/../maha-launchpad/backend/drive_helper.php';
        $driveHelperLoaded = true;
        
        $vendorPaths = [$vendorPath1, $vendorPath2, $vendorPath3];
        foreach ($vendorPaths as $vp) {
            if (file_exists($vp)) {
                require_once $vp;
                if (class_exists('Google\Client')) {
                    $googleClientAvailable = true;
                    break;
                }
            }
        }
    } catch (Throwable $e) {
        $status['files']['drive_helper_error'] = $e->getMessage();
    }
}

$status['files']['drive_helper_loaded'] = $driveHelperLoaded;
$status['files']['google_client_available'] = $googleClientAvailable;

// 4. Check connection status
$driveEnabled = $status['environment_vars']['GOOGLE_DRIVE_ENABLED']['set'] && 
               ($status['environment_vars']['GOOGLE_DRIVE_ENABLED']['value'] === 'true' || 
                $status['environment_vars']['GOOGLE_DRIVE_ENABLED']['value'] === '1');

$authMode = $status['environment_vars']['GOOGLE_DRIVE_AUTH_MODE']['value'] ?: 'service_account';

$status['connection'] = [
    'drive_enabled' => $driveEnabled,
    'auth_mode' => $authMode,
    'client_created' => false,
    'oauth_connected' => false,
    'can_access_drive' => false,
    'root_folder_accessible' => false,
];

if ($driveEnabled && $driveHelperLoaded && $googleClientAvailable) {
    try {
        if (function_exists('getGoogleDriveClient')) {
            $client = getGoogleDriveClient();
            $status['connection']['client_created'] = $client !== null;
            
            if ($client) {
                // Check OAuth connection status
                if ($authMode === 'oauth') {
                    if (function_exists('isDriveOAuthConnected')) {
                        $status['connection']['oauth_connected'] = isDriveOAuthConnected();
                    }
                    
                    // Check database for OAuth token (TEST DB)
                    try {
                        $host = "db5018266079.hosting-data.io";
                        $dbname = "dbs14484433";
                        $user = "dbu3321929";
                        $pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";
                        $conn = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
                        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                        
                        $stmt = $conn->query("SHOW TABLES LIKE 'GoogleDriveOAuthTokens'");
                        $tableExists = $stmt && $stmt->rowCount() > 0;
                        $status['connection']['oauth_table_exists'] = $tableExists;
                        
                        if ($tableExists) {
                            $tokenStmt = $conn->query("SELECT connected_by_username, updated_at FROM GoogleDriveOAuthTokens WHERE id = 1 LIMIT 1");
                            if ($tokenStmt) {
                                $tokenRow = $tokenStmt->fetch(PDO::FETCH_ASSOC);
                                $status['connection']['oauth_token_in_db'] = !empty($tokenRow);
                                $status['connection']['oauth_connected_by'] = $tokenRow['connected_by_username'] ?? null;
                                $status['connection']['oauth_updated_at'] = $tokenRow['updated_at'] ?? null;
                            }
                        }
                    } catch (PDOException $e) {
                        $status['connection']['db_error'] = $e->getMessage();
                    }
                }
                
                // Try to access Drive API
                if (class_exists('Google\Service\Drive')) {
                    try {
                        $drive = new Google\Service\Drive($client);
                        $result = $drive->files->listFiles([
                            'pageSize' => 1,
                            'fields' => 'files(id, name)'
                        ]);
                        $status['connection']['can_access_drive'] = true;
                        
                        // Check root folder if set
                        $rootFolderId = $status['environment_vars']['GOOGLE_DRIVE_ROOT_FOLDER_ID']['value'];
                        if (!empty($rootFolderId)) {
                            try {
                                $rootFile = $drive->files->get($rootFolderId, [
                                    'supportsAllDrives' => true,
                                    'fields' => 'id, name, mimeType'
                                ]);
                                $status['connection']['root_folder_accessible'] = true;
                                $status['connection']['root_folder_name'] = $rootFile->getName();
                            } catch (Throwable $e) {
                                $status['connection']['root_folder_error'] = $e->getMessage();
                            }
                        }
                    } catch (Throwable $e) {
                        $status['connection']['drive_api_error'] = $e->getMessage();
                    }
                }
            } else {
                $status['connection']['client_error'] = 'getGoogleDriveClient() returned null';
                if (function_exists('getDriveInitFailureReason')) {
                    $reason = getDriveInitFailureReason();
                    if ($reason) {
                        $status['connection']['init_failure_reason'] = $reason;
                    }
                }
            }
        }
    } catch (Throwable $e) {
        $status['connection']['error'] = $e->getMessage();
        $status['connection']['error_trace'] = $e->getTraceAsString();
    }
}

// 5. Generate recommendations
if (!$status['environment_vars']['GOOGLE_DRIVE_ENABLED']['set'] || !$driveEnabled) {
    $status['recommendations'][] = 'Set GOOGLE_DRIVE_ENABLED=true in backend/.env';
}

if (!$status['environment_vars']['GOOGLE_DRIVE_AUTH_MODE']['set']) {
    $status['recommendations'][] = 'Set GOOGLE_DRIVE_AUTH_MODE=oauth in backend/.env';
}

if ($authMode === 'oauth') {
    if (!$status['environment_vars']['GOOGLE_DRIVE_OAUTH_CLIENT_ID']['set']) {
        $status['recommendations'][] = 'Set GOOGLE_DRIVE_OAUTH_CLIENT_ID in backend/.env';
    }
    if (!$status['environment_vars']['GOOGLE_DRIVE_OAUTH_CLIENT_SECRET']['set']) {
        $status['recommendations'][] = 'Set GOOGLE_DRIVE_OAUTH_CLIENT_SECRET in backend/.env';
    }
    if (!$status['environment_vars']['GOOGLE_DRIVE_OAUTH_REDIRECT_URI']['set']) {
        $status['recommendations'][] = 'Set GOOGLE_DRIVE_OAUTH_REDIRECT_URI in backend/.env';
    }
    if (!$status['environment_vars']['GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY']['set']) {
        $status['recommendations'][] = 'Set GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY in backend/.env (generate with: python3 -c "import os, base64; print(base64.b64encode(os.urandom(32)).decode())")';
    }
    if (!$status['connection']['oauth_connected']) {
        $status['recommendations'][] = 'OAuth not connected. You need to complete the OAuth flow. Check if GoogleDriveOAuthTokens table exists and has a refresh token.';
    }
}

if (!$status['files']['drive_helper_local']['exists'] && !$status['files']['drive_helper_launchpad']['exists']) {
    $status['recommendations'][] = 'Copy drive_helper.php to backend/ folder or ensure maha-launchpad/backend/drive_helper.php exists';
}

if (!$status['files']['google_client_available']) {
    $status['recommendations'][] = 'Vendor folder not found. Upload maha-launchpad/vendor/ folder to server or install via composer';
}

if (!$status['environment_vars']['GOOGLE_DRIVE_ROOT_FOLDER_ID']['set']) {
    $status['recommendations'][] = 'Set GOOGLE_DRIVE_ROOT_FOLDER_ID in backend/.env (get from Google Drive folder URL)';
}

$redirectUri = $status['environment_vars']['GOOGLE_DRIVE_OAUTH_REDIRECT_URI']['value'];
if (!empty($redirectUri)) {
    $status['google_cloud_console'] = [
        'message' => 'Make sure this redirect URI is added to Google Cloud Console:',
        'redirect_uri' => $redirectUri,
        'steps' => [
            '1. Go to https://console.cloud.google.com/',
            '2. Navigate to: APIs & Services → Credentials',
            '3. Click on your OAuth 2.0 Client ID',
            '4. Under "Authorized redirect URIs", add: ' . $redirectUri,
            '5. Save the changes',
            '6. Wait a few minutes for changes to propagate'
        ]
    ];
}

// Overall status
$status['overall_status'] = 'not_configured';
if ($driveEnabled && $driveHelperLoaded && $googleClientAvailable) {
    if ($status['connection']['client_created'] && $status['connection']['can_access_drive']) {
        $status['overall_status'] = 'ready';
    } elseif ($status['connection']['client_created']) {
        $status['overall_status'] = 'configured_but_not_connected';
    } else {
        $status['overall_status'] = 'configured_but_client_failed';
    }
} elseif ($driveEnabled) {
    $status['overall_status'] = 'enabled_but_missing_files';
}

echo json_encode($status, JSON_PRETTY_PRINT);


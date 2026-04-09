<?php
/**
 * Simple Google Drive Status Check (No Dependencies)
 * This version works even if vendor folder is missing
 */

// Set error handling early
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start output buffering to catch any unexpected output
ob_start();

// Register shutdown function to catch fatal errors
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        while (ob_get_level() > 0) {
            @ob_end_clean();
        }
        @header_remove();
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'error' => 'Fatal error occurred',
                'message' => $error['message'],
                'file' => basename($error['file']),
                'line' => $error['line']
            ], JSON_PRETTY_PRINT);
        }
    }
});

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");

$status = [
    'success' => true,
    'timestamp' => date('Y-m-d H:i:s'),
    'environment' => 'test',
    'server_info' => [
        'php_version' => PHP_VERSION,
        'script_path' => __FILE__,
        'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'N/A',
        'script_filename' => $_SERVER['SCRIPT_FILENAME'] ?? 'N/A',
        'request_uri' => $_SERVER['REQUEST_URI'] ?? 'N/A',
    ],
    'environment_vars' => [],
    'files' => [],
    'recommendations' => []
];

// Load environment variables
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
    $status['config_loaded'] = true;
} else {
    $status['config_loaded'] = false;
    $status['recommendations'][] = 'config.php not found in ' . __DIR__;
}

// Check .env file
$envPath = __DIR__ . '/.env';
$status['files']['.env'] = [
    'path' => $envPath,
    'exists' => file_exists($envPath),
    'readable' => file_exists($envPath) ? is_readable($envPath) : false
];

// Check environment variables
$envVars = [
    'GOOGLE_DRIVE_ENABLED',
    'GOOGLE_DRIVE_AUTH_MODE',
    'GOOGLE_DRIVE_ROOT_FOLDER_ID',
    'GOOGLE_DRIVE_OAUTH_CLIENT_ID',
    'GOOGLE_DRIVE_OAUTH_CLIENT_SECRET',
    'GOOGLE_DRIVE_OAUTH_REDIRECT_URI',
    'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY',
];

foreach ($envVars as $key) {
    $value = getenv($key);
    $status['environment_vars'][$key] = [
        'set' => !empty($value),
        'value' => in_array($key, ['GOOGLE_DRIVE_OAUTH_CLIENT_SECRET', 'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY']) 
            ? (empty($value) ? null : substr($value, 0, 10) . '... (hidden)')
            : $value
    ];
}

// Check files
$filesToCheck = [
    'drive_helper.php' => __DIR__ . '/drive_helper.php',
    'drive_helper_launchpad' => __DIR__ . '/../maha-launchpad/backend/drive_helper.php',
        'vendor_autoload_local' => __DIR__ . '/vendor/autoload.php',  // Local vendor folder
        'vendor_autoload_1' => __DIR__ . '/../maha-launchpad/vendor/autoload.php',
        'vendor_autoload_2' => dirname(__DIR__) . '/maha-launchpad/vendor/autoload.php',
    'config.php' => __DIR__ . '/config.php',
    'upload-client-document.php' => __DIR__ . '/upload-client-document.php',
    'drive_oauth_callback.php' => __DIR__ . '/drive_oauth_callback.php',
];

foreach ($filesToCheck as $name => $path) {
    $status['files'][$name] = [
        'path' => $path,
        'exists' => file_exists($path),
        'readable' => file_exists($path) ? is_readable($path) : false,
        'size' => file_exists($path) ? filesize($path) : 0
    ];
}

// Check vendor/autoload.php first (but don't load it yet)
$vendorPaths = [
    __DIR__ . '/vendor/autoload.php',  // Local vendor folder (e.g. mahaverse-backend-logics)
    __DIR__ . '/../maha-launchpad/vendor/autoload.php',
    dirname(__DIR__) . '/maha-launchpad/vendor/autoload.php',
];

$vendorFound = false;
foreach ($vendorPaths as $vp) {
    if (file_exists($vp)) {
        $vendorFound = true;
        $status['vendor_path'] = $vp;
        break;
    }
}

if (!$vendorFound) {
    $status['recommendations'][] = 'vendor/autoload.php not found. Upload maha-launchpad/vendor/ folder to server or install via composer';
}

// Create backend/drive_helper.php wrapper FIRST (before loading anything)
// This prevents Composer autoloader from causing redeclaration errors
$backendDir = __DIR__ . '/backend';
$backendHelperPath = $backendDir . '/drive_helper.php';
$localHelperPath = __DIR__ . '/drive_helper.php';

// Remove existing symlink/copy if it exists (they cause redeclaration)
if (file_exists($backendHelperPath)) {
    try {
        if (is_link($backendHelperPath) || is_file($backendHelperPath)) {
            @unlink($backendHelperPath);
            $status['existing_file_removed'] = true;
        }
    } catch (Throwable $e) {
        $status['existing_file_remove_error'] = $e->getMessage();
    }
}

// Create wrapper file if it doesn't exist
if (!file_exists($backendHelperPath) && file_exists($localHelperPath)) {
    try {
        if (!is_dir($backendDir)) {
            @mkdir($backendDir, 0755, true);
        }
        if (is_dir($backendDir)) {
            // Create wrapper file that prevents redeclaration
            $wrapperContent = "<?php\n";
            $wrapperContent .= "// Wrapper to prevent redeclaration of drive_helper functions\n";
            $wrapperContent .= "// This file is created automatically for composer autoloader compatibility\n";
            $wrapperContent .= "// DO NOT EDIT THIS FILE MANUALLY\n";
            $wrapperContent .= "if (!function_exists('getGoogleDriveClient')) {\n";
            $wrapperContent .= "    require_once __DIR__ . '/../drive_helper.php';\n";
            $wrapperContent .= "}\n";
            
            if (@file_put_contents($backendHelperPath, $wrapperContent)) {
                $status['backend_wrapper_created'] = true;
                $status['backend_wrapper_path'] = $backendHelperPath;
            } else {
                $status['backend_wrapper_creation_failed'] = true;
            }
        }
    } catch (Throwable $e) {
        $status['backend_wrapper_error'] = $e->getMessage();
    }
} elseif (file_exists($backendHelperPath)) {
    // Check if it's a wrapper or symlink/copy
    $content = @file_get_contents($backendHelperPath);
    if ($content && strpos($content, 'function_exists') !== false) {
        $status['backend_wrapper_exists'] = true;
    } else {
        $status['backend_wrapper_is_symlink_or_copy'] = true;
        $status['warning'] = 'backend/drive_helper.php exists but is not a wrapper - may cause redeclaration';
    }
}

// Now load drive_helper.php manually (before vendor autoloader to avoid path conflicts)
// The vendor autoloader expects backend/drive_helper.php, but we have it at drive_helper.php
if (!function_exists('getGoogleDriveClient')) {
    if (file_exists(__DIR__ . '/drive_helper.php')) {
        try {
            require_once __DIR__ . '/drive_helper.php';
            $status['drive_helper_loaded'] = true;
            $status['drive_helper_source'] = 'local';
        } catch (Throwable $e) {
            $status['drive_helper_loaded'] = false;
            $status['drive_helper_error'] = $e->getMessage();
        }
    } elseif (file_exists(__DIR__ . '/../maha-launchpad/backend/drive_helper.php')) {
        try {
            require_once __DIR__ . '/../maha-launchpad/backend/drive_helper.php';
            $status['drive_helper_loaded'] = true;
            $status['drive_helper_source'] = 'maha-launchpad';
        } catch (Throwable $e) {
            $status['drive_helper_loaded'] = false;
            $status['drive_helper_error'] = $e->getMessage();
        }
    } else {
        $status['drive_helper_loaded'] = false;
        $status['recommendations'][] = 'drive_helper.php not found. Copy it from maha-launchpad/backend/';
    }
} else {
    // Functions already loaded (maybe by another script)
    $status['drive_helper_loaded'] = true;
    $status['drive_helper_source'] = 'already_loaded';
}

// Check if functions are available
if ($status['drive_helper_loaded']) {
    $status['functions_available'] = [
        'getGoogleDriveClient' => function_exists('getGoogleDriveClient'),
        'isGoogleDriveEnabled' => function_exists('isGoogleDriveEnabled'),
        'getDriveRootFolderId' => function_exists('getDriveRootFolderId'),
        'isSharedDriveEnabled' => function_exists('isSharedDriveEnabled'),
        'uploadFileContentToDrive' => function_exists('uploadFileContentToDrive'),
        'getOrCreateDriveFolder' => function_exists('getOrCreateDriveFolder'),
    ];
}

// Try to load Google Client if vendor exists
// The vendor autoloader will try to load backend/drive_helper.php (from composer.json),
// but we've already loaded drive_helper.php and created a wrapper to prevent redeclaration
if ($vendorFound && $status['drive_helper_loaded']) {
    try {
        // Verify wrapper exists
        if (!file_exists($backendHelperPath)) {
            $status['warning'] = 'Wrapper file not created - redeclaration may occur';
        }
        
        // Load vendor autoloader
        // The wrapper file should prevent redeclaration by checking if functions exist
        // Use @ to suppress any warnings
        @require_once $status['vendor_path'];
        $status['google_client_available'] = class_exists('Google\Client');
    } catch (Throwable $e) {
        // Check if it's a redeclaration error - if so, functions are already loaded, which is fine
        if (strpos($e->getMessage(), 'Cannot redeclare') !== false || 
            strpos($e->getMessage(), 'redeclare') !== false) {
            // Functions already loaded - check if Google Client is available anyway
            $status['google_client_available'] = class_exists('Google\Client');
            $status['redeclaration_handled'] = true;
            $status['warning'] = 'Redeclaration error caught but Google Client is available';
        } else {
            $status['google_client_available'] = false;
            $status['google_client_error'] = $e->getMessage();
            $status['google_client_error_file'] = basename($e->getFile());
            $status['google_client_error_line'] = $e->getLine();
        }
    }
} else {
    $status['google_client_available'] = false;
    if (!$vendorFound) {
        $status['google_client_error'] = 'Vendor autoloader not found';
    }
    if (!$status['drive_helper_loaded']) {
        $status['google_client_error'] = ($status['google_client_error'] ?? '') . '; Drive helper not loaded';
    }
}

// Check database connection
try {
    if (function_exists('getDBConnection')) {
        $conn = getDBConnection();
        $status['database']['connected'] = $conn !== null;
        
        // Check for OAuth tokens table
        if ($conn) {
            $result = $conn->query("SHOW TABLES LIKE 'GoogleDriveOAuthTokens'");
            $status['database']['oauth_table_exists'] = $result && $result->num_rows > 0;
            
            if ($status['database']['oauth_table_exists']) {
                $tokenResult = $conn->query("SELECT connected_by_username, updated_at FROM GoogleDriveOAuthTokens WHERE id = 1 LIMIT 1");
                if ($tokenResult) {
                    $tokenRow = $tokenResult->fetch_assoc();
                    $status['database']['oauth_token_exists'] = !empty($tokenRow);
                    $status['database']['oauth_connected_by'] = $tokenRow['connected_by_username'] ?? null;
                    $status['database']['oauth_updated_at'] = $tokenRow['updated_at'] ?? null;
                }
            }
        }
    } else {
        $status['database']['connected'] = false;
        $status['database']['error'] = 'getDBConnection() function not available';
    }
} catch (Throwable $e) {
    $status['database']['connected'] = false;
    $status['database']['error'] = $e->getMessage();
}

// Overall status
$driveEnabled = $status['environment_vars']['GOOGLE_DRIVE_ENABLED']['set'] && 
               ($status['environment_vars']['GOOGLE_DRIVE_ENABLED']['value'] === 'true' || 
                $status['environment_vars']['GOOGLE_DRIVE_ENABLED']['value'] === '1');

if ($driveEnabled && $status['drive_helper_loaded'] && $status['google_client_available']) {
    $status['overall_status'] = 'ready';
} elseif ($driveEnabled && $status['drive_helper_loaded']) {
    $status['overall_status'] = 'missing_vendor';
} elseif ($driveEnabled) {
    $status['overall_status'] = 'missing_drive_helper';
} else {
    $status['overall_status'] = 'not_enabled';
}

// Clean any unexpected output
@ob_end_clean();

// Output JSON
try {
    echo json_encode($status, JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to encode status',
        'message' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}


<?php
/**
 * Debug version of migration script - returns detailed error information
 */

error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display, but log
ini_set('log_errors', 1);

ob_start();

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/config.php';
    
    // Load composer autoloader (Drive client)
    $autoload = __DIR__ . '/../vendor/autoload.php';
    if (file_exists($autoload)) {
        require_once $autoload;
    }
    if (file_exists(__DIR__ . '/drive_helper.php')) {
        require_once __DIR__ . '/drive_helper.php';
    }
    
    $authUser = requireUser();
    $role = isset($authUser['role']) ? strtolower((string)$authUser['role']) : 'staff';
    $isAdminLike = ($role === 'admin' || $role === 'hr');
    
    if (!$isAdminLike) {
        ob_clean();
        echo json_encode(['success' => false, 'message' => 'Admin/HR access required']);
        exit;
    }
    
    $conn = getDBConnection();
    if (!$conn) {
        throw new Exception('Database connection failed');
    }
    
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) $payload = $_POST;
    
    $staffId = isset($payload['staff_id']) ? (int)$payload['staff_id'] : 0;
    $attachmentId = isset($payload['attachment_id']) ? (int)$payload['attachment_id'] : 0;
    
    if ($staffId <= 0 && $attachmentId <= 0) {
        throw new Exception('Either staff_id or attachment_id is required');
    }
    
    // Check if Drive is enabled
    $driveEnabled = function_exists('isGoogleDriveEnabled') ? isGoogleDriveEnabled() : false;
    
    ob_clean();
    
    echo json_encode([
        'success' => true,
        'debug' => [
            'drive_enabled' => $driveEnabled,
            'staff_id' => $staffId,
            'attachment_id' => $attachmentId,
            'has_conn' => $conn !== null,
            'functions_available' => [
                'getGoogleDriveClient' => function_exists('getGoogleDriveClient'),
                'getOrCreateDriveFolder' => function_exists('getOrCreateDriveFolder'),
                'uploadFileContentToDrive' => function_exists('uploadFileContentToDrive'),
                'isGoogleDriveEnabled' => function_exists('isGoogleDriveEnabled'),
                'getDriveRootFolderId' => function_exists('getDriveRootFolderId'),
                'isSharedDriveEnabled' => function_exists('isSharedDriveEnabled')
            ],
            'env_vars' => [
                'GOOGLE_DRIVE_ENABLED' => getenv('GOOGLE_DRIVE_ENABLED'),
                'GOOGLE_DRIVE_SIGNED_OFFERS_FOLDER_ID' => getenv('GOOGLE_DRIVE_SIGNED_OFFERS_FOLDER_ID') ?: 'not set',
                'GOOGLE_DRIVE_ROOT_FOLDER_ID' => getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID') ?: 'not set'
            ]
        ]
    ]);
    
} catch (Throwable $e) {
    ob_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => explode("\n", $e->getTraceAsString())
    ]);
}

if (ob_get_level() > 0) {
    ob_end_flush();
}


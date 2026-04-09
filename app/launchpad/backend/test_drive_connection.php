<?php
/**
 * Test script to diagnose Google Drive connection issues
 * This helps identify why folder creation might be failing
 */

require_once __DIR__ . '/config.php';

// Load composer autoloader (Drive client)
$autoload = __DIR__ . '/../vendor/autoload.php';
if (file_exists($autoload)) {
    require_once $autoload;
}
if (file_exists(__DIR__ . '/drive_helper.php')) {
    require_once __DIR__ . '/drive_helper.php';
}

header('Content-Type: application/json; charset=utf-8');

$authUser = requireUser();
$role = isset($authUser['role']) ? strtolower((string)$authUser['role']) : 'staff';
$isAdminLike = ($role === 'admin' || $role === 'hr');

if (!$isAdminLike) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Admin/HR access required']);
    exit;
}

$diagnostics = [];

try {
    // 1. Check if Drive is enabled
    $driveEnabled = function_exists('isGoogleDriveEnabled') ? isGoogleDriveEnabled() : false;
    $diagnostics['drive_enabled'] = $driveEnabled;
    $diagnostics['drive_enabled_env'] = getenv('GOOGLE_DRIVE_ENABLED');
    
    if (!$driveEnabled) {
        echo json_encode([
            'success' => false,
            'message' => 'Google Drive is not enabled',
            'diagnostics' => $diagnostics
        ], JSON_PRETTY_PRINT);
        exit;
    }
    
    // 2. Check auth mode
    $authMode = getenv('GOOGLE_DRIVE_AUTH_MODE') ?: 'service_account';
    $diagnostics['auth_mode'] = $authMode;
    
    // 3. Try to create Drive client
    if (!function_exists('getGoogleDriveClient')) {
        throw new Exception('getGoogleDriveClient function not available');
    }
    
    $client = getGoogleDriveClient();
    $diagnostics['client_created'] = $client !== null;
    
    if (!$client) {
        throw new Exception('Failed to create Google Drive client');
    }
    
    // 4. Check root folder configuration
    $rootFolderId = function_exists('getDriveRootFolderId') ? getDriveRootFolderId() : null;
    $diagnostics['root_folder_id'] = $rootFolderId;
    $diagnostics['root_folder_id_env'] = getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID');
    
    // 5. Check shared drive
    $useSharedDrive = function_exists('isSharedDriveEnabled') ? isSharedDriveEnabled() : false;
    $diagnostics['use_shared_drive'] = $useSharedDrive;
    $diagnostics['shared_drive_id'] = getenv('GOOGLE_DRIVE_SHARED_DRIVE_ID');
    
    // 6. Try to access Drive API
    if (class_exists('Google\Service\Drive')) {
        $drive = new Google\Service\Drive($client);
        
        // Try to list files (test API access)
        try {
            $result = $drive->files->listFiles([
                'pageSize' => 1,
                'fields' => 'files(id, name)',
                'q' => "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
            ]);
            $diagnostics['api_access'] = 'success';
            $diagnostics['can_list_files'] = true;
        } catch (Throwable $e) {
            $diagnostics['api_access'] = 'failed';
            $diagnostics['api_error'] = $e->getMessage();
            $diagnostics['can_list_files'] = false;
        }
        
        // If root folder is specified, try to access it
        if ($rootFolderId) {
            try {
                $rootFile = $drive->files->get($rootFolderId, [
                    'supportsAllDrives' => true,
                    'fields' => 'id, name, mimeType'
                ]);
                $diagnostics['root_folder_accessible'] = true;
                $diagnostics['root_folder_name'] = $rootFile->getName();
                $diagnostics['root_folder_mime'] = $rootFile->getMimeType();
            } catch (Throwable $e) {
                $diagnostics['root_folder_accessible'] = false;
                $diagnostics['root_folder_error'] = $e->getMessage();
            }
        }
        
        // 7. Try to create a test folder
        if (function_exists('getOrCreateDriveFolder')) {
            try {
                $testFolderName = 'test_folder_' . time();
                $testFolderId = getOrCreateDriveFolder($testFolderName, $rootFolderId, $useSharedDrive);
                $diagnostics['can_create_folder'] = $testFolderId !== null;
                $diagnostics['test_folder_id'] = $testFolderId;
                
                // Try to delete test folder if created
                if ($testFolderId) {
                    try {
                        $drive->files->delete($testFolderId, ['supportsAllDrives' => true]);
                        $diagnostics['test_folder_deleted'] = true;
                    } catch (Throwable $e) {
                        $diagnostics['test_folder_deleted'] = false;
                        $diagnostics['test_folder_delete_error'] = $e->getMessage();
                    }
                }
            } catch (Throwable $e) {
                $diagnostics['can_create_folder'] = false;
                $diagnostics['create_folder_error'] = $e->getMessage();
            }
        } else {
            $diagnostics['can_create_folder'] = false;
            $diagnostics['create_folder_error'] = 'getOrCreateDriveFolder function not available';
        }
    } else {
        $diagnostics['api_access'] = 'failed';
        $diagnostics['api_error'] = 'Google\Service\Drive class not available';
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Drive connection test completed',
        'diagnostics' => $diagnostics
    ], JSON_PRETTY_PRINT);
    
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'diagnostics' => $diagnostics,
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
}


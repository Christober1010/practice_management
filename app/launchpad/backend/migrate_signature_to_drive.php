<?php
/**
 * Migration script to move offer signatures from local storage to Google Drive
 * 
 * Usage: POST with attachment_id or staff_id
 * {
 *   "attachment_id": 57,  // specific signature to migrate
 *   // OR
 *   "staff_id": 78,        // migrate all signatures for a staff member
 *   "delete_local": false  // optional: delete local file after migration (default: false)
 * }
 */

// Suppress any output that might interfere with JSON response
ob_start();

require_once __DIR__ . '/config.php';

// Load composer autoloader (Drive client)
$autoload = __DIR__ . '/../vendor/autoload.php';
if (file_exists($autoload)) {
    require_once $autoload;
}
if (file_exists(__DIR__ . '/drive_helper.php')) {
    require_once __DIR__ . '/drive_helper.php';
}

// Clear any output buffer
ob_clean();

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$authUser = requireUser();
$role = isset($authUser['role']) ? strtolower((string)$authUser['role']) : 'staff';
$isAdminLike = ($role === 'admin' || $role === 'hr');

if (!$isAdminLike) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Admin/HR access required']);
    exit;
}

// Set error handler to catch fatal errors
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    ob_clean();
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'PHP Error: ' . $errstr,
        'file' => $errfile,
        'line' => $errline
    ]);
    exit;
}, E_ALL);

// Set exception handler
set_exception_handler(function($exception) {
    ob_clean();
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Uncaught Exception: ' . $exception->getMessage(),
        'file' => $exception->getFile(),
        'line' => $exception->getLine(),
        'trace' => $exception->getTraceAsString()
    ]);
    exit;
});

$conn = null;
try {
    $conn = getDBConnection();
    if (!$conn) {
        throw new Exception('Failed to get database connection');
    }
    $conn->begin_transaction();
} catch (Throwable $e) {
    ob_clean();
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

try {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) $payload = $_POST;
    
    $attachmentId = isset($payload['attachment_id']) ? (int)$payload['attachment_id'] : 0;
    $staffId = isset($payload['staff_id']) ? (int)$payload['staff_id'] : 0;
    $deleteLocal = isset($payload['delete_local']) ? (bool)$payload['delete_local'] : false;
    
    if ($attachmentId <= 0 && $staffId <= 0) {
        throw new Exception('Either attachment_id or staff_id is required');
    }
    
    // Check if Drive is enabled
    $driveEnabled = function_exists('isGoogleDriveEnabled') ? isGoogleDriveEnabled() : false;
    if (!$driveEnabled) {
        throw new Exception('Google Drive is not enabled. Enable it in your .env file first.');
    }
    
    // Build query to find attachments to migrate
    $where = '';
    $bindTypes = '';
    $bindValues = [];
    
    if ($attachmentId > 0) {
        $where = "sa.attachment_id = ? AND sa.attachment_type = 'OFFER_SIGNATURE'";
        $bindTypes = 'i';
        $bindValues[] = &$attachmentId;
    } else {
        $where = "sa.staff_id = ? AND sa.attachment_type = 'OFFER_SIGNATURE'";
        $bindTypes = 'i';
        $bindValues[] = &$staffId;
    }
    
    $query = "
        SELECT 
            sa.attachment_id,
            sa.staff_id,
            sa.uploaded_by_user_id,
            sa.original_filename,
            sa.stored_path,
            sa.stored_filename,
            sa.mime_type,
            sa.size_bytes,
            oa.offer_id,
            oa.employee_name
        FROM StaffAttachments sa
        LEFT JOIN StaffOfferAcceptances oa ON oa.signature_attachment_id = sa.attachment_id
        WHERE {$where}
        AND sa.stored_path NOT LIKE 'drive://%'
    ";
    
    $stmt = $conn->prepare($query);
    if (!$stmt) throw new Exception('Query preparation failed: ' . $conn->error);
    
    // Bind parameters
    array_unshift($bindValues, $bindTypes);
    call_user_func_array([$stmt, 'bind_param'], $bindValues);
    
    $stmt->execute();
    $res = $stmt->get_result();
    $attachments = [];
    while ($row = $res->fetch_assoc()) {
        $attachments[] = $row;
    }
    $stmt->close();
    
    if (empty($attachments)) {
        throw new Exception('No local signatures found to migrate' . ($attachmentId > 0 ? ' for attachment_id ' . $attachmentId : ($staffId > 0 ? ' for staff_id ' . $staffId : '')));
    }
    
    $migrated = [];
    $errors = [];
    
    foreach ($attachments as $att) {
        $attId = (int)$att['attachment_id'];
        $staffIdForMigration = (int)$att['staff_id'];
        $storedPath = (string)$att['stored_path'];
        $storedFilename = (string)$att['stored_filename'];
        $mimeType = (string)$att['mime_type'];
        $filePath = __DIR__ . DIRECTORY_SEPARATOR . $storedPath . DIRECTORY_SEPARATOR . $storedFilename;
        $realPath = realpath($filePath);
        $basePath = realpath(__DIR__ . DIRECTORY_SEPARATOR . 'uploads');
        
        if (!$realPath || !$basePath || strpos($realPath, $basePath) !== 0) {
            $errors[] = "Attachment #{$attId}: Invalid file path";
            continue;
        }
        
        if (!file_exists($realPath) || !is_readable($realPath)) {
            $errors[] = "Attachment #{$attId}: File not found or not readable";
            continue;
        }
        
        // Read file content
        $fileContent = file_get_contents($realPath);
        if ($fileContent === false) {
            $errors[] = "Attachment #{$attId}: Failed to read file";
            continue;
        }
        
        // Upload to Drive
        try {
            // Verify Drive client can be created
            if (!function_exists('getGoogleDriveClient')) {
                throw new Exception('getGoogleDriveClient function not available');
            }
            
            $client = getGoogleDriveClient();
            if (!$client) {
                throw new Exception('Failed to create Google Drive client. Check Drive configuration and authentication.');
            }
            
            $useSharedDrive = function_exists('isSharedDriveEnabled') ? isSharedDriveEnabled() : false;
            $rootFolderId = function_exists('getDriveRootFolderId') ? getDriveRootFolderId() : null;
            
            if (!function_exists('getOrCreateDriveFolder')) {
                throw new Exception('getOrCreateDriveFolder function not available');
            }
            
            // Use the same folder structure as signed offer letters for consistency
            // Parent folder for signed offers (prefer explicit folder id, otherwise create by name under root).
            $signedOffersFolderId = getenv('GOOGLE_DRIVE_SIGNED_OFFERS_FOLDER_ID');
            if (!$signedOffersFolderId) {
                $signedOffersFolderId = getOrCreateDriveFolder('signed_offer_letters', $rootFolderId, $useSharedDrive);
            }
            if (!$signedOffersFolderId) {
                throw new Exception('Signed offers folder not configured. Cannot migrate signature.');
            }
            
            // Staff subfolder under the signed offers folder (same structure as signed offer PDFs)
            $staffFolderName = 'staff_' . $staffIdForMigration;
            $folderId = getOrCreateDriveFolder($staffFolderName, $signedOffersFolderId, $useSharedDrive);
            if (!$folderId) {
                $errorDetails = [];
                $errorDetails[] = "Drive client created: " . ($client ? 'Yes' : 'No');
                $errorDetails[] = "Root folder ID: " . ($rootFolderId ?: 'Not set (will use Drive root)');
                $errorDetails[] = "Use shared drive: " . ($useSharedDrive ? 'Yes' : 'No');
                $errorDetails[] = "Folder name: {$staffFolderName}";
                
                // Check if root folder exists (if specified)
                if ($rootFolderId && class_exists('Google\Service\Drive')) {
                    try {
                        $drive = new Google\Service\Drive($client);
                        $rootFile = $drive->files->get($rootFolderId, ['supportsAllDrives' => true]);
                        $errorDetails[] = "Root folder exists: Yes (name: {$rootFile->getName()})";
                    } catch (Throwable $e) {
                        $errorDetails[] = "Root folder exists: No or inaccessible - " . $e->getMessage();
                    }
                } elseif ($rootFolderId) {
                    $errorDetails[] = "Root folder ID specified but Google Drive service class not available";
                }
                
                throw new Exception('Failed to get or create Drive folder. ' . implode('; ', $errorDetails));
            }
            
            if (!function_exists('uploadFileContentToDrive')) {
                throw new Exception('uploadFileContentToDrive function not available');
            }
            
            $driveResult = uploadFileContentToDrive($fileContent, $storedFilename, $mimeType, $folderId, $useSharedDrive);
            if (!$driveResult || !isset($driveResult['fileId'])) {
                throw new Exception('Failed to upload to Drive');
            }
            
            // Update database record
            $newStoredPath = 'drive://' . $folderId;
            $newStoredFilename = $driveResult['fileId'];
            
            $updateStmt = $conn->prepare("
                UPDATE StaffAttachments
                SET stored_path = ?, stored_filename = ?
                WHERE attachment_id = ?
            ");
            if (!$updateStmt) {
                throw new Exception('Update prepare failed: ' . $conn->error);
            }
            $updateStmt->bind_param("ssi", $newStoredPath, $newStoredFilename, $attId);
            if (!$updateStmt->execute()) {
                throw new Exception('Update failed: ' . $updateStmt->error);
            }
            $updateStmt->close();
            
            // Optionally delete local file
            if ($deleteLocal) {
                if (unlink($realPath)) {
                    $migrated[] = [
                        'attachment_id' => $attId,
                        'staff_id' => $staffIdForMigration,
                        'employee_name' => $att['employee_name'] ?? null,
                        'drive_folder_id' => $folderId,
                        'drive_file_id' => $newStoredFilename,
                        'local_file_deleted' => true
                    ];
                } else {
                    $migrated[] = [
                        'attachment_id' => $attId,
                        'staff_id' => $staffIdForMigration,
                        'employee_name' => $att['employee_name'] ?? null,
                        'drive_folder_id' => $folderId,
                        'drive_file_id' => $newStoredFilename,
                        'local_file_deleted' => false,
                        'warning' => 'File migrated to Drive but local file could not be deleted'
                    ];
                }
            } else {
                $migrated[] = [
                    'attachment_id' => $attId,
                    'staff_id' => $staffIdForMigration,
                    'employee_name' => $att['employee_name'] ?? null,
                    'drive_folder_id' => $folderId,
                    'drive_file_id' => $newStoredFilename,
                    'local_file_deleted' => false,
                    'local_file_preserved' => $realPath
                ];
            }
            
        } catch (Throwable $e) {
            $errors[] = "Attachment #{$attId}: " . $e->getMessage();
            error_log("Migration failed for attachment #{$attId}: " . $e->getMessage());
        }
    }
    
    if (!empty($errors) && empty($migrated)) {
        $conn->rollback();
        throw new Exception('All migrations failed: ' . implode('; ', $errors));
    }
    
    $conn->commit();
    
    // Ensure no output before JSON
    ob_clean();
    
    $response = [
        'success' => true,
        'migrated' => $migrated,
        'errors' => $errors,
        'summary' => [
            'total_processed' => count($attachments),
            'successful' => count($migrated),
            'failed' => count($errors)
        ],
        'message' => count($migrated) . ' signature(s) migrated to Drive successfully' . (count($errors) > 0 ? ', ' . count($errors) . ' error(s)' : '')
    ];
    
    $json = json_encode($response, JSON_PRETTY_PRINT);
    if ($json === false) {
        $json = json_encode([
            'success' => false,
            'message' => 'JSON encoding failed: ' . json_last_error_msg(),
            'error_code' => json_last_error()
        ]);
    }
    
    echo $json;
    
} catch (Throwable $e) {
    if ($conn) {
        try {
            $conn->rollback();
        } catch (Throwable $rollbackError) {
            error_log("Rollback failed: " . $rollbackError->getMessage());
        }
    }
    
    // Ensure no output before JSON
    ob_clean();
    
    http_response_code(500);
    $errorResponse = [
        'success' => false,
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ];
    $json = json_encode($errorResponse, JSON_PRETTY_PRINT);
    if ($json === false) {
        $json = json_encode([
            'success' => false,
            'message' => 'Error occurred but JSON encoding failed: ' . json_last_error_msg()
        ]);
    }
    echo $json;
    exit;
} finally {
    if ($conn) {
        try {
            $conn->close();
        } catch (Throwable $closeError) {
            // Ignore close errors
        }
    }
    // End output buffering
    if (ob_get_level() > 0) {
        ob_end_flush();
    }
}


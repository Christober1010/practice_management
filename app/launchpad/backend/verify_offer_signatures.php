<?php
/**
 * Comprehensive verification script for offer signatures
 * Checks:
 * 1. Database records exist
 * 2. Files exist on disk/Drive
 * 3. Files are readable
 * 4. File sizes match
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

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
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

$conn = getDBConnection();

try {
    // Get all offer acceptances with their signatures
    $query = "
        SELECT 
            oa.offer_id,
            oa.staff_id,
            oa.employee_name,
            oa.job_title,
            oa.pay_rate,
            oa.signature_attachment_id,
            oa.accepted_date,
            oa.accepted_at,
            sa.stored_path,
            sa.stored_filename,
            sa.mime_type,
            sa.size_bytes,
            sa.created_at as attachment_created_at,
            s.first_name,
            s.last_name,
            s.email
        FROM StaffOfferAcceptances oa
        INNER JOIN StaffAttachments sa ON sa.attachment_id = oa.signature_attachment_id
        INNER JOIN Staff s ON s.staff_id = oa.staff_id
        WHERE sa.attachment_type = 'OFFER_SIGNATURE'
        ORDER BY oa.accepted_at DESC
    ";
    
    $res = $conn->query($query);
    $signatures = [];
    $issues = [];
    
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $attId = (int)$row['signature_attachment_id'];
            $staffId = (int)$row['staff_id'];
            $storedPath = (string)$row['stored_path'];
            $storedFilename = (string)$row['stored_filename'];
            $expectedSize = (int)$row['size_bytes'];
            
            $verification = [
                'offer_id' => (int)$row['offer_id'],
                'staff_id' => $staffId,
                'employee_name' => $row['employee_name'],
                'email' => $row['email'],
                'signature_attachment_id' => $attId,
                'accepted_date' => $row['accepted_date'],
                'accepted_at' => $row['accepted_at'],
                'stored_path' => $storedPath,
                'stored_filename' => $storedFilename,
                'expected_size_bytes' => $expectedSize,
                'file_exists' => false,
                'file_readable' => false,
                'actual_size_bytes' => 0,
                'size_matches' => false,
                'is_drive_file' => false,
                'verification_status' => 'unknown'
            ];
            
            // Check if it's a Drive file
            $isDriveFile = (strpos($storedPath, 'drive://') === 0);
            $verification['is_drive_file'] = $isDriveFile;
            
            if ($isDriveFile) {
                // Verify Drive file
                $driveEnabled = function_exists('isGoogleDriveEnabled') ? isGoogleDriveEnabled() : false;
                if ($driveEnabled && function_exists('downloadFileFromDrive')) {
                    try {
                        $driveFileId = $storedFilename;
                        $useSharedDrive = function_exists('isSharedDriveEnabled') ? isSharedDriveEnabled() : false;
                        $content = downloadFileFromDrive($driveFileId, $useSharedDrive);
                        
                        if ($content !== null && is_string($content)) {
                            $verification['file_exists'] = true;
                            $verification['file_readable'] = true;
                            $verification['actual_size_bytes'] = strlen($content);
                            $verification['size_matches'] = (strlen($content) === $expectedSize);
                            $verification['verification_status'] = $verification['size_matches'] ? 'ok' : 'size_mismatch';
                        } else {
                            $verification['verification_status'] = 'drive_file_not_found';
                            $issues[] = "Offer #{$verification['offer_id']} (Staff #{$staffId}): Drive file not found";
                        }
                    } catch (Throwable $e) {
                        $verification['verification_status'] = 'drive_error';
                        $verification['error'] = $e->getMessage();
                        $issues[] = "Offer #{$verification['offer_id']} (Staff #{$staffId}): Drive error - " . $e->getMessage();
                    }
                } else {
                    $verification['verification_status'] = 'drive_not_enabled';
                    $issues[] = "Offer #{$verification['offer_id']} (Staff #{$staffId}): Drive not enabled but file marked as Drive file";
                }
            } else {
                // Verify local file
                $filePath = __DIR__ . DIRECTORY_SEPARATOR . $storedPath . DIRECTORY_SEPARATOR . $storedFilename;
                $realPath = realpath($filePath);
                $basePath = realpath(__DIR__ . DIRECTORY_SEPARATOR . 'uploads');
                
                if ($realPath && $basePath && strpos($realPath, $basePath) === 0) {
                    $verification['file_exists'] = file_exists($realPath);
                    $verification['file_path_checked'] = $realPath;
                    
                    if ($verification['file_exists']) {
                        $verification['file_readable'] = is_readable($realPath);
                        if ($verification['file_readable']) {
                            $actualSize = filesize($realPath);
                            $verification['actual_size_bytes'] = $actualSize;
                            $verification['size_matches'] = ($actualSize === $expectedSize);
                            $verification['verification_status'] = $verification['size_matches'] ? 'ok' : 'size_mismatch';
                            
                            if (!$verification['size_matches']) {
                                $issues[] = "Offer #{$verification['offer_id']} (Staff #{$staffId}): Size mismatch - expected {$expectedSize}, got {$actualSize}";
                            }
                        } else {
                            $verification['verification_status'] = 'file_not_readable';
                            $issues[] = "Offer #{$verification['offer_id']} (Staff #{$staffId}): File exists but not readable";
                        }
                    } else {
                        $verification['verification_status'] = 'file_not_found';
                        $verification['file_path_checked'] = $filePath;
                        $issues[] = "Offer #{$verification['offer_id']} (Staff #{$staffId}): File not found at {$filePath}";
                    }
                } else {
                    $verification['verification_status'] = 'invalid_path';
                    $verification['file_path_checked'] = $filePath;
                    $issues[] = "Offer #{$verification['offer_id']} (Staff #{$staffId}): Invalid file path";
                }
            }
            
            $signatures[] = $verification;
        }
    }
    
    $summary = [
        'total_signatures' => count($signatures),
        'verified_ok' => count(array_filter($signatures, fn($s) => $s['verification_status'] === 'ok')),
        'file_not_found' => count(array_filter($signatures, fn($s) => $s['verification_status'] === 'file_not_found')),
        'size_mismatch' => count(array_filter($signatures, fn($s) => $s['verification_status'] === 'size_mismatch')),
        'other_issues' => count(array_filter($signatures, fn($s) => !in_array($s['verification_status'], ['ok', 'file_not_found', 'size_mismatch']))),
        'total_issues' => count($issues)
    ];
    
    echo json_encode([
        'success' => true,
        'summary' => $summary,
        'signatures' => $signatures,
        'issues' => $issues,
        'message' => count($issues) > 0 
            ? 'Found ' . count($issues) . ' issue(s) with signature files'
            : 'All signature files verified successfully'
    ], JSON_PRETTY_PRINT);
    
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => $e->getMessage(), 
        'trace' => $e->getTraceAsString()
    ]);
}

$conn->close();


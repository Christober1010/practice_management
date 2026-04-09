<?php
/**
 * Diagnostic script to find orphaned offer signatures and recover missing offer acceptance records
 * 
 * Usage: Access via browser or CLI with admin credentials
 * This will show:
 * 1. All OFFER_SIGNATURE attachments
 * 2. Which ones have corresponding StaffOfferAcceptances records
 * 3. Which ones are orphaned (missing acceptance records)
 * 4. Option to recover orphaned signatures if offer initiation exists
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

// Only allow GET (for safety, you can change to POST for recovery actions)
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
    // Find all OFFER_SIGNATURE attachments
    $attachmentsQuery = "
        SELECT 
            sa.attachment_id,
            sa.staff_id,
            sa.uploaded_by_user_id,
            sa.original_filename,
            sa.stored_path,
            sa.stored_filename,
            sa.mime_type,
            sa.size_bytes,
            sa.created_at,
            s.first_name,
            s.last_name,
            s.email,
            u.username as uploaded_by_username
        FROM StaffAttachments sa
        LEFT JOIN Staff s ON s.staff_id = sa.staff_id
        LEFT JOIN Users u ON u.id = sa.uploaded_by_user_id
        WHERE sa.attachment_type = 'OFFER_SIGNATURE'
        ORDER BY sa.created_at DESC
    ";
    
    $attachmentsRes = $conn->query($attachmentsQuery);
    $allAttachments = [];
    if ($attachmentsRes) {
        while ($row = $attachmentsRes->fetch_assoc()) {
            $allAttachments[] = $row;
        }
    }
    
    // Check which ones have corresponding StaffOfferAcceptances records
    $orphaned = [];
    $linked = [];
    
    foreach ($allAttachments as $att) {
        $attId = (int)$att['attachment_id'];
        $staffId = (int)$att['staff_id'];
        
        // Check if there's a corresponding offer acceptance
        $checkStmt = $conn->prepare("
            SELECT offer_id, signature_attachment_id, accepted_date, accepted_at
            FROM StaffOfferAcceptances
            WHERE staff_id = ? AND signature_attachment_id = ?
            LIMIT 1
        ");
        if ($checkStmt) {
            $checkStmt->bind_param("ii", $staffId, $attId);
            $checkStmt->execute();
            $checkRes = $checkStmt->get_result();
            $acceptance = $checkRes ? $checkRes->fetch_assoc() : null;
            $checkStmt->close();
            
            if ($acceptance) {
                $linked[] = [
                    'attachment' => $att,
                    'acceptance' => $acceptance
                ];
            } else {
                // Check if there's an offer initiation for this staff
                $initStmt = $conn->prepare("
                    SELECT initiation_id, employee_name, job_title, pay_rate, initiated_at
                    FROM StaffOfferInitiations
                    WHERE staff_id = ?
                    LIMIT 1
                ");
                $initData = null;
                if ($initStmt) {
                    $initStmt->bind_param("i", $staffId);
                    $initStmt->execute();
                    $initRes = $initStmt->get_result();
                    $initData = $initRes ? $initRes->fetch_assoc() : null;
                    $initStmt->close();
                }
                
                $orphaned[] = [
                    'attachment' => $att,
                    'has_initiation' => $initData !== null,
                    'initiation' => $initData
                ];
            }
        }
    }
    
    // Summary
    $summary = [
        'total_signatures' => count($allAttachments),
        'linked_acceptances' => count($linked),
        'orphaned_signatures' => count($orphaned),
        'orphaned_with_initiation' => count(array_filter($orphaned, fn($o) => $o['has_initiation'])),
        'orphaned_without_initiation' => count(array_filter($orphaned, fn($o) => !$o['has_initiation']))
    ];
    
    echo json_encode([
        'success' => true,
        'summary' => $summary,
        'orphaned' => $orphaned,
        'linked' => array_slice($linked, 0, 10), // Show first 10 linked for reference
        'message' => count($orphaned) > 0 
            ? 'Found ' . count($orphaned) . ' orphaned signature(s). Use recover_offer_signature.php to recover them.'
            : 'All signatures are properly linked to offer acceptances.'
    ], JSON_PRETTY_PRINT);
    
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
}

$conn->close();


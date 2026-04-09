<?php
/**
 * Recovery script to recreate missing StaffOfferAcceptances records for orphaned signatures
 * 
 * Usage: POST with attachment_id to recover a specific orphaned signature
 * This will:
 * 1. Verify the attachment exists and is orphaned
 * 2. Check if offer initiation exists
 * 3. Create the missing StaffOfferAcceptances record
 */

require_once __DIR__ . '/config.php';

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

$conn = getDBConnection();
$conn->begin_transaction();

try {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) $payload = $_POST;
    
    $attachmentId = isset($payload['attachment_id']) ? (int)$payload['attachment_id'] : 0;
    if ($attachmentId <= 0) {
        throw new Exception('attachment_id is required');
    }
    
    // Get the attachment
    $attStmt = $conn->prepare("
        SELECT attachment_id, staff_id, uploaded_by_user_id, original_filename, created_at
        FROM StaffAttachments
        WHERE attachment_id = ? AND attachment_type = 'OFFER_SIGNATURE'
        LIMIT 1
    ");
    if (!$attStmt) throw new Exception('Attachment lookup failed');
    $attStmt->bind_param("i", $attachmentId);
    $attStmt->execute();
    $attRes = $attStmt->get_result();
    $attachment = $attRes ? $attRes->fetch_assoc() : null;
    $attStmt->close();
    
    if (!$attachment) {
        throw new Exception('OFFER_SIGNATURE attachment not found');
    }
    
    $staffId = (int)$attachment['staff_id'];
    $uploadedByUserId = (int)$attachment['uploaded_by_user_id'];
    
    // Check if acceptance already exists
    $existingStmt = $conn->prepare("
        SELECT offer_id FROM StaffOfferAcceptances
        WHERE staff_id = ? AND signature_attachment_id = ?
        LIMIT 1
    ");
    if (!$existingStmt) throw new Exception('Check failed');
    $existingStmt->bind_param("ii", $staffId, $attachmentId);
    $existingStmt->execute();
    $existingRes = $existingStmt->get_result();
    $existing = $existingRes ? $existingRes->fetch_assoc() : null;
    $existingStmt->close();
    
    if ($existing) {
        throw new Exception('Offer acceptance already exists for this signature');
    }
    
    // Check if there's an offer initiation
    $initStmt = $conn->prepare("
        SELECT initiation_id, employee_name, job_title, pay_rate, initiated_at
        FROM StaffOfferInitiations
        WHERE staff_id = ?
        LIMIT 1
    ");
    if (!$initStmt) throw new Exception('Offer initiation lookup failed');
    $initStmt->bind_param("i", $staffId);
    $initStmt->execute();
    $initRes = $initStmt->get_result();
    $initiation = $initRes ? $initRes->fetch_assoc() : null;
    $initStmt->close();
    
    if (!$initiation) {
        throw new Exception('No offer initiation found for this staff. Cannot recover without initiation data.');
    }
    
    $employeeName = trim((string)$initiation['employee_name']);
    $jobTitle = trim((string)$initiation['job_title']);
    $payRate = trim((string)$initiation['pay_rate']);
    
    if ($employeeName === '' || $jobTitle === '' || $payRate === '') {
        throw new Exception('Offer initiation is missing required fields');
    }
    
    // Use the attachment creation date as accepted_date, or today if that's in the future
    $attachmentCreatedAt = $attachment['created_at'];
    $acceptedDate = date('Y-m-d', strtotime($attachmentCreatedAt));
    $today = date('Y-m-d');
    if ($acceptedDate > $today) {
        $acceptedDate = $today;
    }
    
    // Insert the missing offer acceptance record
    $ins = $conn->prepare("
        INSERT INTO StaffOfferAcceptances
            (staff_id, created_by_user_id, employee_name, job_title, pay_rate, signature_attachment_id, accepted_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    if (!$ins) throw new Exception('Offer insert prepare failed');
    $ins->bind_param("iisssis", $staffId, $uploadedByUserId, $employeeName, $jobTitle, $payRate, $attachmentId, $acceptedDate);
    if (!$ins->execute()) throw new Exception('Offer insert failed: ' . $ins->error);
    $offerId = (int)$conn->insert_id;
    $ins->close();
    
    $conn->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Offer acceptance record recovered successfully',
        'offer_id' => $offerId,
        'staff_id' => $staffId,
        'signature_attachment_id' => $attachmentId,
        'accepted_date' => $acceptedDate,
        'employee_name' => $employeeName,
        'job_title' => $jobTitle,
        'pay_rate' => $payRate
    ]);
    
} catch (Throwable $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();


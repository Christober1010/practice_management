<?php
// Accept/signed offer letter submission
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mailer.php';

// Load composer autoloader (Drive client)
$autoload = __DIR__ . '/../vendor/autoload.php';
if (file_exists($autoload)) {
    require_once $autoload;
}
if (file_exists(__DIR__ . '/drive_helper.php')) {
    require_once __DIR__ . '/drive_helper.php';
}

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$authUser = requireUser();
$role = isset($authUser['role']) ? strtolower((string)$authUser['role']) : 'staff';
$isAdminLike = ($role === 'admin' || $role === 'hr');

$conn = getDBConnection();
$conn->begin_transaction();

function ensureOfferTable(mysqli $conn): void {
    $conn->query("
        CREATE TABLE IF NOT EXISTS StaffOfferAcceptances (
          offer_id INT AUTO_INCREMENT PRIMARY KEY,
          staff_id INT NOT NULL,
          created_by_user_id INT NOT NULL,
          employee_name VARCHAR(255) NOT NULL,
          job_title VARCHAR(255) NOT NULL,
          pay_rate VARCHAR(100) NOT NULL,
          signature_attachment_id INT NOT NULL,
          accepted_date DATE NOT NULL,
          jd_read_ack TINYINT(1) NOT NULL DEFAULT 0,
          hipaa_ack TINYINT(1) NOT NULL DEFAULT 0,
          abuse_ack TINYINT(1) NOT NULL DEFAULT 0,
          accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_staff_offer (staff_id),
          INDEX idx_offer_created_by_user_id (created_by_user_id)
        )
    ");

    // Add ack columns to existing tables that were created without them.
    $cols = [];
    $r = $conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'StaffOfferAcceptances'");
    if ($r) { while ($row = $r->fetch_assoc()) $cols[] = $row['COLUMN_NAME']; }
    if (!in_array('jd_read_ack', $cols))
        $conn->query("ALTER TABLE StaffOfferAcceptances ADD COLUMN jd_read_ack TINYINT(1) NOT NULL DEFAULT 0 AFTER accepted_date");
    if (!in_array('hipaa_ack', $cols))
        $conn->query("ALTER TABLE StaffOfferAcceptances ADD COLUMN hipaa_ack TINYINT(1) NOT NULL DEFAULT 0 AFTER jd_read_ack");
    if (!in_array('abuse_ack', $cols))
        $conn->query("ALTER TABLE StaffOfferAcceptances ADD COLUMN abuse_ack TINYINT(1) NOT NULL DEFAULT 0 AFTER hipaa_ack");
}

function sendOfferAcceptedEmail(mysqli $conn, array $offer): void {
    // Find admin/hr emails
    $emails = [];
    $res = $conn->query("SELECT email FROM Users WHERE is_active = 1 AND role IN ('admin','hr') AND email IS NOT NULL AND email <> ''");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $emails[] = trim((string)$row['email']);
        }
    }
    // Always include app service mailbox for offer acceptance notifications.
    $emails[] = 'appsvc@mahabehavioralhealth.com';
    $emails = array_values(array_unique(array_filter($emails, fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL))));
    if (empty($emails)) return; // nothing to do

    $to = implode(',', $emails);
    $staffId = (int)$offer['staff_id'];
    $employeeName = htmlspecialchars((string)$offer['employee_name'], ENT_QUOTES, 'UTF-8');
    $jobTitle = htmlspecialchars((string)$offer['job_title'], ENT_QUOTES, 'UTF-8');
    $payRate = htmlspecialchars((string)$offer['pay_rate'], ENT_QUOTES, 'UTF-8');
    $acceptedDate = htmlspecialchars((string)$offer['accepted_date'], ENT_QUOTES, 'UTF-8');

    $subject = "Offer Accepted - Staff #{$staffId}";
    // Follow the same email template used in create_user.php and offer_initiation_submit.php.
    // Avoid warning/danger symbols/emojis to reduce spam risk.
    $baseUrl = "https://mahaverse.mahabehavioralhealth.com";
    // Deep-link via login with redirect so that after authentication the user lands directly on the offer letter
    $offerUrl = $baseUrl . "/launchpad/login?redirect=" . urlencode("/launchpad/form/?view=offer-letter");
    $loginUrl = $baseUrl . "/launchpad/login";

    $message = "
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #0d9488; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                .logo { max-width: 80px; height: auto; margin-bottom: 15px; border-radius: 50%; background-color: white; padding: 4px; }
                .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
                .features { background-color: white; border-left: 4px solid #0d9488; padding: 16px; margin: 20px 0; }
                .features ul { margin: 0; padding-left: 20px; }
                .features li { margin: 8px 0; }
                .cta { display: inline-block; margin-top: 12px; padding: 10px 16px; background: #0d9488; color: white; text-decoration: none; border-radius: 6px; }
                .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <img src='https://www.mahabehavioralhealth.com/images/mahalogo_v1_small.jpg' alt='Maha Launchpad Logo' class='logo' />
                    <h1 style='margin: 0 0 10px 0;'>Maha Launchpad</h1>
                    <p style='margin: 0;'>Offer Accepted</p>
                </div>
                <div class='content'>
                    <p>A staff member accepted the offer letter in Maha Launchpad.</p>
                    <div class='features'>
                        <ul>
                            <li><strong>Staff ID:</strong> {$staffId}</li>
                            <li><strong>Name:</strong> {$employeeName}</li>
                            <li><strong>Job Title:</strong> {$jobTitle}</li>
                            <li><strong>Pay Rate:</strong> {$payRate}</li>
                            <li><strong>Accepted Date:</strong> {$acceptedDate}</li>
                        </ul>
                    </div>
                    <a class='cta' href='{$offerUrl}'>Open Launchpad</a>
                    <div style='margin-top: 14px;'>
                        <a class='cta' href='{$loginUrl}'>Login</a>
                    </div>
                </div>
                <div class='footer'>
                    <p>This is an automated message from Maha Launchpad.</p>
                    <p>Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
    ";

    // best-effort via centralized mail helper
    sendMail($to, $subject, $message);
}

function ensureOfferInitiationsTable(mysqli $conn): void {
    $conn->query("
        CREATE TABLE IF NOT EXISTS StaffOfferInitiations (
          initiation_id INT AUTO_INCREMENT PRIMARY KEY,
          staff_id INT NOT NULL,
          initiated_by_user_id INT NOT NULL,
          employee_name VARCHAR(255) NOT NULL,
          job_title VARCHAR(255) NOT NULL,
          pay_rate VARCHAR(100) NOT NULL,
          initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_staff_offer_initiation (staff_id),
          INDEX idx_offer_initiated_by_user_id (initiated_by_user_id)
        )
    ");
}

try {
    ensureOfferTable($conn);
    ensureOfferInitiationsTable($conn);

    $raw = file_get_contents('php://input');
    $payload = json_decode($raw ?: '', true);
    if (!is_array($payload)) $payload = [];

    $currentUserId = isset($authUser['id']) ? (int)$authUser['id'] : 0;
    if ($currentUserId <= 0) throw new Exception('Authentication required');

    // Determine staff_id
    $staffId = 0;
    if ($isAdminLike && isset($payload['staff_id'])) {
        $staffId = (int)$payload['staff_id'];
    }
    if ($staffId <= 0) {
        $stmt = $conn->prepare("SELECT staff_id FROM Staff WHERE created_by_user_id = ? ORDER BY staff_id DESC LIMIT 1");
        if (!$stmt) throw new Exception('Staff lookup failed');
        $stmt->bind_param("i", $currentUserId);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $stmt->close();
        $staffId = $row ? (int)$row['staff_id'] : 0;
    }
    if ($staffId <= 0) throw new Exception('No staff profile found for this account.');

    // If not admin-like, enforce ownership
    if (!$isAdminLike) {
        $own = $conn->prepare("SELECT created_by_user_id FROM Staff WHERE staff_id = ? LIMIT 1");
        if (!$own) throw new Exception('Authorization check failed');
        $own->bind_param("i", $staffId);
        $own->execute();
        $ownRes = $own->get_result();
        $ownRow = $ownRes ? $ownRes->fetch_assoc() : null;
        $own->close();
        $createdBy = $ownRow ? (int)$ownRow['created_by_user_id'] : 0;
        if ($createdBy <= 0 || $createdBy !== $currentUserId) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied']);
            exit;
        }
    }

    // Prevent duplicates
    $dup = $conn->prepare("SELECT offer_id FROM StaffOfferAcceptances WHERE staff_id = ? LIMIT 1");
    if (!$dup) throw new Exception('Offer check failed');
    $dup->bind_param("i", $staffId);
    $dup->execute();
    $dupRes = $dup->get_result();
    $dupRow = $dupRes ? $dupRes->fetch_assoc() : null;
    $dup->close();
    if ($dupRow) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Offer already accepted.']);
        exit;
    }

    $signatureDataUrl = trim((string)($payload['signature_data_url'] ?? ''));
    $acceptedDate = trim((string)($payload['accepted_date'] ?? ''));
    $jdReadAck = !empty($payload['jd_read_ack']) ? 1 : 0;
    $hipaaAck   = !empty($payload['hipaa_ack'])   ? 1 : 0;
    $abuseAck   = !empty($payload['abuse_ack'])   ? 1 : 0;

    // Offer details must come from Admin/HR initiation (staff cannot edit these fields).
    $initStmt = $conn->prepare("
        SELECT employee_name, job_title, pay_rate
        FROM StaffOfferInitiations
        WHERE staff_id = ?
        LIMIT 1
    ");
    if (!$initStmt) throw new Exception('Offer initiation lookup failed');
    $initStmt->bind_param("i", $staffId);
    $initStmt->execute();
    $initRes = $initStmt->get_result();
    $init = $initRes ? $initRes->fetch_assoc() : null;
    $initStmt->close();
    if (!$init) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Offer has not been initiated yet. Please contact Admin/HR.']);
        exit;
    }

    $employeeName = trim((string)($init['employee_name'] ?? ''));
    $jobTitle = trim((string)($init['job_title'] ?? ''));
    $payRate = trim((string)($init['pay_rate'] ?? ''));
    if ($employeeName === '' || $jobTitle === '' || $payRate === '') {
        throw new Exception('Offer is missing required details. Please contact Admin/HR.');
    }
    if ($acceptedDate === '') {
        $acceptedDate = date('Y-m-d');
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $acceptedDate)) {
        throw new Exception('Invalid accepted date.');
    }
    if (!preg_match('/^data:image\/(png|jpeg|jpg);base64,/', $signatureDataUrl)) {
        throw new Exception('Invalid signature format.');
    }

    if (!preg_match('/^data:image\/(png|jpeg|jpg);base64,(.+)$/', $signatureDataUrl, $m)) {
        throw new Exception('Invalid signature data.');
    }
    $imageData = base64_decode($m[2], true);
    if ($imageData === false) throw new Exception('Failed to decode signature.');
    if (strlen($imageData) > 2 * 1024 * 1024) throw new Exception('Signature image too large.');

    $sha256 = hash('sha256', $imageData);
    if (!$sha256) throw new Exception('Failed to hash signature.');
    $sizeBytes = strlen($imageData);

    // Store signature as StaffAttachments (Drive first, fallback local)
    $storedFilename = bin2hex(random_bytes(16)) . '.png';
    $originalFilename = 'offer_signature.png';
    $mimeType = 'image/png';
    $storedPath = '';
    $storedName = '';

    $driveEnabled = function_exists('isGoogleDriveEnabled') ? isGoogleDriveEnabled() : false;
    $savedToDrive = false;
    if (
        $driveEnabled &&
        function_exists('uploadFileContentToDrive') &&
        function_exists('getOrCreateDriveFolder')
    ) {
        try {
            $useSharedDrive = function_exists('isSharedDriveEnabled') ? isSharedDriveEnabled() : false;
            $rootFolderId = function_exists('getDriveRootFolderId') ? getDriveRootFolderId() : null;

            // Use the same folder structure as signed offer letters for consistency
            // Parent folder for signed offers (prefer explicit folder id, otherwise create by name under root).
            $signedOffersFolderId = getenv('GOOGLE_DRIVE_SIGNED_OFFERS_FOLDER_ID');
            if (!$signedOffersFolderId) {
                $signedOffersFolderId = getOrCreateDriveFolder('signed_offer_letters', $rootFolderId, $useSharedDrive);
            }
            if (!$signedOffersFolderId) throw new Exception('Signed offers folder not configured.');

            // Staff subfolder under the signed offers folder (same structure as signed offer PDFs)
            $staffFolderName = 'staff_' . $staffId;
            $folderId = getOrCreateDriveFolder($staffFolderName, $signedOffersFolderId, $useSharedDrive);
            if (!$folderId) throw new Exception('Failed to create staff folder for offer signature.');

            $driveResult = uploadFileContentToDrive($imageData, $storedFilename, $mimeType, $folderId, $useSharedDrive);
            if (!$driveResult || !isset($driveResult['fileId'])) throw new Exception('uploadFileContentToDrive failed');

            $storedPath = 'drive://' . $folderId;
            $storedName = $driveResult['fileId']; // store file id in stored_filename
            $savedToDrive = true;
        } catch (Throwable $e) {
            error_log("Drive offer signature upload failed; falling back to local. staff_id={$staffId} err=" . $e->getMessage());
            $savedToDrive = false;
        }
    }

    if (!$savedToDrive) {
        $uploadBaseAbs = __DIR__ . '/uploads';
        $staffDirAbs = $uploadBaseAbs . '/staff_' . $staffId;
        $staffDirRel = 'uploads/staff_' . $staffId;
        if (!is_dir($staffDirAbs)) {
            if (!mkdir($staffDirAbs, 0755, true)) {
                throw new Exception("Failed to create upload directory.");
            }
        }
        $destAbs = rtrim($staffDirAbs, '/\\') . DIRECTORY_SEPARATOR . $storedFilename;
        if (file_put_contents($destAbs, $imageData) === false) {
            throw new Exception("Failed to save signature image.");
        }
        $storedPath = $staffDirRel;
        $storedName = $storedFilename;
    }

    // Insert attachment row
    $att = $conn->prepare("
        INSERT INTO StaffAttachments
            (staff_id, uploaded_by_user_id, attachment_type,
             original_filename, stored_path, stored_filename,
             mime_type, size_bytes, sha256, created_at)
        VALUES (?, ?, 'OFFER_SIGNATURE', ?, ?, ?, ?, ?, ?, NOW())
    ");
    if (!$att) throw new Exception('Attachment insert prepare failed');
    $uploaderId = $currentUserId;
    $att->bind_param(
        "iissssis",
        $staffId,
        $uploaderId,
        $originalFilename,
        $storedPath,
        $storedName,
        $mimeType,
        $sizeBytes,
        $sha256
    );
    if (!$att->execute()) throw new Exception('Attachment insert failed: ' . $att->error);
    $signatureAttachmentId = (int)$conn->insert_id;
    $att->close();

    // Insert offer acceptance row
    $ins = $conn->prepare("
        INSERT INTO StaffOfferAcceptances
            (staff_id, created_by_user_id, employee_name, job_title, pay_rate, signature_attachment_id, accepted_date, jd_read_ack, hipaa_ack, abuse_ack)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    if (!$ins) throw new Exception('Offer insert prepare failed');
    $ins->bind_param("iisssisiii", $staffId, $currentUserId, $employeeName, $jobTitle, $payRate, $signatureAttachmentId, $acceptedDate, $jdReadAck, $hipaaAck, $abuseAck);
    if (!$ins->execute()) throw new Exception('Offer insert failed: ' . $ins->error);
    $ins->close();

    $conn->commit();

    // Email admin/hr (best-effort)
    sendOfferAcceptedEmail($conn, [
        'staff_id' => $staffId,
        'employee_name' => $employeeName,
        'job_title' => $jobTitle,
        'pay_rate' => $payRate,
        'accepted_date' => $acceptedDate,
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Offer accepted successfully.',
        'staff_id' => $staffId,
        'signature_attachment_id' => $signatureAttachmentId,
        'accepted_date' => $acceptedDate,
    ]);
} catch (Throwable $e) {
    if ($conn) {
        $conn->rollback();
    }
    // Enhanced error logging for debugging
    $errorDetails = [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ];
    error_log('Offer acceptance submission failed: ' . json_encode($errorDetails));
    
    // Log additional context if available
    if (isset($staffId) && $staffId > 0) {
        error_log("Failed offer acceptance for staff_id: {$staffId}");
    }
    if (isset($signatureAttachmentId) && $signatureAttachmentId > 0) {
        error_log("Signature attachment_id was created: {$signatureAttachmentId} but offer acceptance failed");
    }
    
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();



<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

// Only allow GET
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$authUser = requireUser();
$role = isset($authUser['role']) ? strtolower((string)$authUser['role']) : 'staff';
$isAdminLike = ($role === 'admin' || $role === 'hr');

$conn = getDBConnection();

// Ensure table exists (best-effort, avoids deploy-time SQL friction)
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
$_cols = [];
$_cr = $conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'StaffOfferAcceptances'");
if ($_cr) { while ($_row = $_cr->fetch_assoc()) $_cols[] = $_row['COLUMN_NAME']; }
if (!in_array('jd_read_ack', $_cols))
    $conn->query("ALTER TABLE StaffOfferAcceptances ADD COLUMN jd_read_ack TINYINT(1) NOT NULL DEFAULT 0 AFTER accepted_date");
if (!in_array('hipaa_ack', $_cols))
    $conn->query("ALTER TABLE StaffOfferAcceptances ADD COLUMN hipaa_ack TINYINT(1) NOT NULL DEFAULT 0 AFTER jd_read_ack");
if (!in_array('abuse_ack', $_cols))
    $conn->query("ALTER TABLE StaffOfferAcceptances ADD COLUMN abuse_ack TINYINT(1) NOT NULL DEFAULT 0 AFTER hipaa_ack");

try {
    $currentUserId = isset($authUser['id']) ? (int)$authUser['id'] : 0;
    if ($currentUserId <= 0) {
        throw new Exception('Authentication required');
    }

    // Determine staff_id
    $staffId = 0;
    if ($isAdminLike && isset($_GET['staff_id']) && $_GET['staff_id'] !== '') {
        $staffId = (int)$_GET['staff_id'];
    }
    if ($staffId <= 0) {
        // default: latest staff record for current user
        $stmt = $conn->prepare("SELECT staff_id FROM Staff WHERE created_by_user_id = ? ORDER BY staff_id DESC LIMIT 1");
        if (!$stmt) throw new Exception('Staff lookup failed');
        $stmt->bind_param("i", $currentUserId);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $stmt->close();
        $staffId = $row ? (int)$row['staff_id'] : 0;
    }

    if ($staffId <= 0) {
        echo json_encode(['success' => true, 'accepted' => false, 'offer' => null]);
        exit;
    }

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

    $stmt = $conn->prepare("
        SELECT offer_id, staff_id, created_by_user_id, employee_name, job_title, pay_rate,
               signature_attachment_id, accepted_date, jd_read_ack, hipaa_ack, abuse_ack, accepted_at
        FROM StaffOfferAcceptances
        WHERE staff_id = ?
        LIMIT 1
    ");
    if (!$stmt) throw new Exception('Offer lookup failed');
    $stmt->bind_param("i", $staffId);
    $stmt->execute();
    $res = $stmt->get_result();
    $offer = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$offer) {
        echo json_encode(['success' => true, 'accepted' => false, 'offer' => null, 'staff_id' => $staffId]);
        exit;
    }

    $offer['offer_id'] = (int)$offer['offer_id'];
    $offer['staff_id'] = (int)$offer['staff_id'];
    $offer['created_by_user_id'] = (int)$offer['created_by_user_id'];
    $offer['signature_attachment_id'] = (int)$offer['signature_attachment_id'];
    $offer['jd_read_ack'] = (bool)$offer['jd_read_ack'];
    $offer['hipaa_ack'] = (bool)$offer['hipaa_ack'];
    $offer['abuse_ack'] = (bool)$offer['abuse_ack'];

    // Include signature image as a data URL so the frontend can render/download it without cross-origin tainting.
    // This is limited to ~2MB in submit endpoint; keep a safety cap here too.
    $sigDataUrl = null;
    try {
        $attId = (int)$offer['signature_attachment_id'];
        if ($attId > 0) {
            $attStmt = $conn->prepare("
                SELECT staff_id, stored_path, stored_filename, mime_type, size_bytes
                FROM StaffAttachments
                WHERE attachment_id = ?
                LIMIT 1
            ");
            if ($attStmt) {
                $attStmt->bind_param("i", $attId);
                $attStmt->execute();
                $attRes = $attStmt->get_result();
                $att = $attRes ? $attRes->fetch_assoc() : null;
                $attStmt->close();

                if ($att && (int)$att['staff_id'] === (int)$offer['staff_id']) {
                    $mime = !empty($att['mime_type']) ? (string)$att['mime_type'] : 'image/png';
                    $size = isset($att['size_bytes']) ? (int)$att['size_bytes'] : 0;
                    if ($size > 0 && $size <= (2 * 1024 * 1024)) {
                        $content = null;
                        $isDriveFile = (strpos((string)$att['stored_path'], 'drive://') === 0);
                        if ($isDriveFile && function_exists('downloadFileFromDrive') && function_exists('isGoogleDriveEnabled') && isGoogleDriveEnabled()) {
                            $driveFileId = (string)$att['stored_filename'];
                            $useSharedDrive = function_exists('isSharedDriveEnabled') ? isSharedDriveEnabled() : false;
                            $content = downloadFileFromDrive($driveFileId, $useSharedDrive);
                        } else {
                            $filePath = __DIR__ . DIRECTORY_SEPARATOR . (string)$att['stored_path'] . DIRECTORY_SEPARATOR . (string)$att['stored_filename'];
                            $realPath = realpath($filePath);
                            $basePath = realpath(__DIR__ . DIRECTORY_SEPARATOR . 'uploads');
                            if ($realPath && $basePath && strpos($realPath, $basePath) === 0 && file_exists($realPath)) {
                                $content = file_get_contents($realPath);
                            }
                        }
                        if (is_string($content) && $content !== '') {
                            $sigDataUrl = 'data:' . $mime . ';base64,' . base64_encode($content);
                        }
                    }
                }
            }
        }
    } catch (Throwable $e) {
        $sigDataUrl = null;
    }
    if ($sigDataUrl) {
        $offer['signature_data_url'] = $sigDataUrl;
    }

    echo json_encode(['success' => true, 'accepted' => true, 'offer' => $offer]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();



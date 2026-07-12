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

// Ensure table exists (best-effort)
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
// Add new columns if missing – compatible with MySQL 5.7+ (no IF NOT EXISTS).
$existingCols = [];
$colRes = $conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'StaffOfferInitiations'");
if ($colRes) { while ($r = $colRes->fetch_row()) $existingCols[] = $r[0]; }
if (!in_array('position_code', $existingCols))    $conn->query("ALTER TABLE StaffOfferInitiations ADD COLUMN position_code VARCHAR(50) NULL AFTER pay_rate");
if (!in_array('offer_letter_body', $existingCols)) $conn->query("ALTER TABLE StaffOfferInitiations ADD COLUMN offer_letter_body TEXT NULL AFTER position_code");

try {
    $currentUserId = isset($authUser['id']) ? (int)$authUser['id'] : 0;
    if ($currentUserId <= 0) throw new Exception('Authentication required');

    // Determine staff_id
    $staffId = 0;
    if ($isAdminLike && isset($_GET['staff_id']) && $_GET['staff_id'] !== '') {
        $staffId = (int)$_GET['staff_id'];
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

    if ($staffId <= 0) {
        echo json_encode(['success' => true, 'initiated' => false, 'offer' => null]);
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
        SELECT initiation_id, staff_id, initiated_by_user_id, employee_name, job_title, pay_rate,
               position_code, offer_letter_body, initiated_at, updated_at
        FROM StaffOfferInitiations
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
        echo json_encode(['success' => true, 'initiated' => false, 'offer' => null, 'staff_id' => $staffId]);
        exit;
    }

    $offer['initiation_id'] = (int)$offer['initiation_id'];
    $offer['staff_id'] = (int)$offer['staff_id'];
    $offer['initiated_by_user_id'] = (int)$offer['initiated_by_user_id'];

    echo json_encode(['success' => true, 'initiated' => true, 'offer' => $offer]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();



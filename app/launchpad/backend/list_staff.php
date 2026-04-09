<?php
require_once 'config.php';

function getSsnEncryptionKey(): ?string {
    $keyB64 = getenv('SSN_ENCRYPTION_KEY') ?: getenv('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY');
    if (!$keyB64) return null;
    $raw = base64_decode($keyB64, true);
    if ($raw === false || strlen($raw) !== 32) return null;
    return $raw;
}

function decryptSensitiveValue(string $payloadB64): ?string {
    if (!function_exists('openssl_decrypt')) return null;
    $key = getSsnEncryptionKey();
    if (!$key) return null;
    $raw = base64_decode($payloadB64, true);
    if ($raw === false || strlen($raw) < 28) return null;
    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $ciphertext = substr($raw, 28);
    $plaintext = openssl_decrypt($ciphertext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    return $plaintext === false ? null : $plaintext;
}

function staffColumnExists(mysqli $conn, string $column): bool {
    $sql = "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Staff' AND COLUMN_NAME = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) return false;
    $stmt->bind_param("s", $column);
    $stmt->execute();
    $stmt->store_result();
    $exists = $stmt->num_rows > 0;
    $stmt->close();
    return $exists;
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit;
}

$authUser = requireUser();

$conn = getDBConnection();

try {
    $currentUserId = isset($authUser['id']) ? (int)$authUser['id'] : 0;
    $role = isset($authUser['role']) ? strtolower((string)$authUser['role']) : 'staff';
    $isReader = ($role === 'reader' || $role === 'viewer');

    if ($currentUserId <= 0) {
        throw new Exception('Authentication required');
    }

    // Treat hr as admin-equivalent for visibility (backwards compatible with existing roles)
    $isAdminLike = ($role === 'admin' || $role === 'hr');
    $includeSsnEncrypted = $isAdminLike && staffColumnExists($conn, 'ssn_encrypted');

    // Ensure offer tables exist (best-effort) so joins below won't fail in new deployments.
    // Keep definitions aligned with offer_initiation_submit.php and offer_acceptance_submit.php.
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
          accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_staff_offer (staff_id),
          INDEX idx_offer_created_by_user_id (created_by_user_id)
        )
    ");

    // Viewer/read-only flow: must supply a share key to view records.
    $nameQuery = isset($_GET['name']) ? trim((string)$_GET['name']) : '';
    $shareKey = isset($_GET['share_key']) ? trim((string)$_GET['share_key']) : '';
    $viewerFirst = '';
    $viewerMiddle = '';
    $viewerLast = '';
    $viewerEmail = '';

    if ($isReader) {
        if ($shareKey === '') {
            echo json_encode([
                'success' => true,
                'staff' => [],
                'message' => 'Provide a share key to search.'
            ]);
            exit;
        }
    }

    // Get all staff with related data
    $where = '';
    $bindTypes = '';
    $bindValues = [];

    if ($isReader) {
        $shareHash = hash('sha256', $shareKey);
        $shareStmt = $conn->prepare("
            SELECT staff_id, expires_at, revoked_at
            FROM StaffShareKeys
            WHERE token_hash = ?
            LIMIT 1
        ");
        if (!$shareStmt) {
            throw new Exception('Share key lookup failed: ' . $conn->error);
        }
        $shareStmt->bind_param("s", $shareHash);
        $shareStmt->execute();
        $shareResult = $shareStmt->get_result();
        $shareRow = $shareResult->fetch_assoc();
        $shareStmt->close();

        if (!$shareRow || !empty($shareRow['revoked_at']) || strtotime((string)$shareRow['expires_at']) <= time()) {
            echo json_encode([
                'success' => true,
                'staff' => [],
                'message' => 'Share key is invalid or expired.'
            ]);
            exit;
        }

        $where = "WHERE s.staff_id = ?";
        $bindTypes = "i";
        $bindValues[] = (int)$shareRow['staff_id'];
    } elseif ($isAdminLike) {
        // Admin/hr: show all by default; optional user_id filter
        if (isset($_GET['user_id']) && $_GET['user_id'] !== '') {
            $targetUserId = (int)$_GET['user_id'];
            if ($targetUserId > 0) {
                $where = "WHERE s.created_by_user_id = ?";
                $bindTypes = "i";
                $bindValues[] = $targetUserId;
            }
        }
    } else {
        // Employee/staff: only their own submissions
        $where = "WHERE s.created_by_user_id = ?";
        $bindTypes = "i";
        $bindValues[] = $currentUserId;
    }

    $sql = "
        SELECT
            s.staff_id,
            s.action_type,
            s.first_name,
            s.middle_name,
            s.last_name,
            s.job_title,
            s.employment_status,
            s.ssn_last_4_digits" . ($includeSsnEncrypted ? ", s.ssn_encrypted" : "") . ",
            s.date_of_birth,
            s.full_address,
            s.cell_phone,
            s.home_phone,
            s.work_phone,
            s.email,
            s.created_by_user_id,
            u.username AS created_by_username,
            u.role AS created_by_role,
            oi.initiated_at AS offer_initiated_at,
            oa.accepted_at AS offer_accepted_at,
            ec.contact_name as emergency_contact_name,
            ec.relationship as emergency_relationship,
            ec.primary_phone as emergency_primary_phone,
            ec.secondary_phone as emergency_secondary_phone,
            pd.highest_degree,
            pd.year_awarded,
            pd.major,
            pd.license_status,
            pd.license_exp_date,
            pd.npi_number,
            pd.languages,
            pd.specialty_areas,
            bi.bank_name,
            bi.account_name,
            bi.account_number_encrypted as account_number,
            bi.routing_number_encrypted as routing_number,
            bi.account_type,
            bi.authorization_agreed,
            ca.hipaa_acknowledged,
            ca.hipaa_acknowledged_at,
            ca.abuse_reporting_acknowledged,
            ca.abuse_reporting_acknowledged_at
        FROM Staff s
        LEFT JOIN Users u ON u.id = s.created_by_user_id
        LEFT JOIN StaffOfferInitiations oi ON oi.staff_id = s.staff_id
        LEFT JOIN StaffOfferAcceptances oa ON oa.staff_id = s.staff_id
        LEFT JOIN EmergencyContact ec ON s.staff_id = ec.staff_id
        LEFT JOIN ProfessionalData pd ON s.staff_id = pd.staff_id
        LEFT JOIN BankInfo bi ON s.staff_id = bi.staff_id
        LEFT JOIN ComplianceAgreement ca ON s.staff_id = ca.staff_id
        $where
        ORDER BY s.staff_id DESC
        LIMIT 200
    ";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('SQL prepare failed: ' . $conn->error);
    }

    if ($bindTypes !== '') {
        // bind_param requires references
        $refs = [];
        foreach ($bindValues as $k => $v) {
            $refs[$k] = &$bindValues[$k];
        }
        array_unshift($refs, $bindTypes);
        call_user_func_array([$stmt, 'bind_param'], $refs);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $staffMap = [];
    while ($row = $result->fetch_assoc()) {
        $staffId = $row['staff_id'];
        
        // Group by staff_id and collect certifications separately
        if (!isset($staffMap[$staffId])) {
            if ($includeSsnEncrypted && !empty($row['ssn_encrypted'])) {
                $row['ssn_full'] = decryptSensitiveValue((string)$row['ssn_encrypted']);
            }
            if (isset($row['ssn_encrypted'])) {
                unset($row['ssn_encrypted']);
            }
            $staffMap[$staffId] = $row;
            $staffMap[$staffId]['certifications'] = [];
        }
    }
    $stmt->close();

    // Get certifications and attachments for each staff member
    $rows = [];
    foreach ($staffMap as $staffId => $staff) {
        // Get certifications
        $certSql = "
            SELECT cert_type, cert_number, exp_date
            FROM StaffCertification
            WHERE staff_id = ?
        ";
        $certStmt = $conn->prepare($certSql);
        if ($certStmt) {
            $certStmt->bind_param("i", $staffId);
            $certStmt->execute();
            $certResult = $certStmt->get_result();
            $certifications = [];
            while ($cert = $certResult->fetch_assoc()) {
                $certifications[] = $cert;
            }
            $staff['certifications'] = $certifications;
            $certStmt->close();
        }

        // Get attachments
        $attSql = "
            SELECT 
                attachment_id,
                attachment_type,
                original_filename,
                mime_type,
                size_bytes,
                created_at
            FROM StaffAttachments
            WHERE staff_id = ?
            ORDER BY created_at DESC
        ";
        $attStmt = $conn->prepare($attSql);
        if ($attStmt) {
            $attStmt->bind_param("i", $staffId);
            $attStmt->execute();
            $attResult = $attStmt->get_result();
            $attachments = [];
            while ($att = $attResult->fetch_assoc()) {
                $attachments[] = $att;
            }
            if ($isReader) {
                $attachments = array_values(array_filter(
                    $attachments,
                    fn($att) => strtoupper((string)($att['attachment_type'] ?? '')) !== 'SIGNATURE'
                ));
            }
            $staff['attachments'] = $attachments;
            $attStmt->close();
        } else {
            $staff['attachments'] = [];
        }

        $rows[] = $staff;
    }

    echo json_encode([
        'success' => true,
        'staff' => $rows
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

$conn->close();
?>



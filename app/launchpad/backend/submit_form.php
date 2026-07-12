<?php
// Harden this endpoint so the frontend always gets JSON (even if PHP hits a fatal error)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ob_start();

require_once __DIR__ . '/cors_helpers.php';

// Helper function to set CORS headers (defined early so shutdown function can use it)
function setCorsHeadersForSubmit() {
    launchpad_apply_cors_headers('GET, POST, OPTIONS');
}

function getSsnEncryptionKey(): ?string {
    $keyB64 = getenv('SSN_ENCRYPTION_KEY') ?: getenv('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY');
    if (!$keyB64) return null;
    $raw = base64_decode($keyB64, true);
    if ($raw === false || strlen($raw) !== 32) return null;
    return $raw;
}

function encryptSensitiveValue(string $plaintext): ?string {
    if (!function_exists('openssl_encrypt')) return null;
    $key = getSsnEncryptionKey();
    if (!$key) return null;
    $iv = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    if ($ciphertext === false || $tag === '') return null;
    return base64_encode($iv . $tag . $ciphertext);
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

register_shutdown_function(function () {
    $err = error_get_last();
    if (!$err) return;

    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR];
    if (!in_array($err['type'], $fatalTypes, true)) return;

    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    
    // Re-apply CORS headers before sending error response
    setCorsHeadersForSubmit();
    
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8', true);
        echo json_encode([
            'success' => false,
            'title' => 'Submission Failed',
            'message' => 'Internal server error while submitting the form.',
            'error' => $err['message'] . ' in ' . basename($err['file']) . ' on line ' . $err['line'],
        ]);
    }
});

// Load composer autoloader first (Google Drive client + dependencies)
$autoload = __DIR__ . '/../vendor/autoload.php';
if (file_exists($autoload)) {
    require_once $autoload;
}

require_once 'config.php';

// Load Google Drive helper if available
if (file_exists(__DIR__ . '/drive_helper.php')) {
    require_once __DIR__ . '/drive_helper.php';
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    setCorsHeadersForSubmit();
    http_response_code(200);
    exit;
}

// Re-apply CORS headers after config.php (config.php may have set them, but we ensure they're here)
setCorsHeadersForSubmit();

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    setCorsHeadersForSubmit();
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8', true);
    echo json_encode([
        'success' => false,
        'title' => 'Submission Failed',
        'message' => 'Invalid request method.'
    ]);
    exit;
}

// Require authentication (session OR token)
$authUser = requireUser();
$role = isset($authUser['role']) ? strtolower((string)$authUser['role']) : 'staff';
$canSubmit = ($role === 'admin' || $role === 'hr' || $role === 'staff' || $role === 'employee');
if (!$canSubmit) {
    setCorsHeadersForSubmit();
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8', true);
    echo json_encode([
        'success' => false,
        'title' => 'Submission Failed',
        'message' => 'Only Admin, HR, and Staff can submit profiles.'
    ]);
    exit;
}

$response = [
    'success' => false,
    'title' => 'Submission Failed',
    'message' => 'An unexpected error occurred.',
];

$conn = getDBConnection();
$conn->begin_transaction();

try {
    $savedFiles = []; // best-effort cleanup on rollback (for local files only)
    $driveEnabled = isGoogleDriveEnabled();
    $driveFallbacks = []; // track which uploads fell back to local storage (Drive misconfig/perms/etc)

    $saveUploadedFile = function(array $file, string $targetDirAbs, string $targetName, int $staffId) use ($driveEnabled, &$driveFallbacks): array {
        if (!isset($file['error']) || is_array($file['error'])) {
            throw new Exception("Invalid upload payload.");
        }

        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new Exception("File upload failed (code {$file['error']}).");
        }

        $maxBytes = 10 * 1024 * 1024; // 10MB
        if (!isset($file['size']) || (int)$file['size'] <= 0) {
            throw new Exception("Uploaded file is empty.");
        }
        if ((int)$file['size'] > $maxBytes) {
            throw new Exception("Uploaded file is too large (max 10MB).");
        }

        // Detect MIME type
        // Note: Some shared hosts don't enable ext-fileinfo, so finfo() may not exist.
        $mime = false;
        if (class_exists('finfo')) {
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->file($file['tmp_name']);
        } elseif (function_exists('mime_content_type')) {
            $mime = mime_content_type($file['tmp_name']);
        }
        if ($mime === false || $mime === null || $mime === '') {
            throw new Exception("Could not determine uploaded file type.");
        }

        $allowedMimes = [
            'application/pdf' => 'pdf',
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
        ];
        if (!isset($allowedMimes[$mime])) {
            throw new Exception("Unsupported file type. Please upload PDF, JPG, or PNG.");
        }

        $ext = $allowedMimes[$mime];
        $originalFilename = isset($file['name']) ? basename($file['name']) : ($targetName . "." . $ext);
        $storedFilename = $targetName . "." . $ext;

        // Calculate SHA256 hash from temp file
        $sha256 = hash_file('sha256', $file['tmp_name']);
        if ($sha256 === false) {
            throw new Exception("Failed to hash uploaded file.");
        }

        // If Google Drive is enabled, try uploading to Drive (best-effort). If it fails, fall back to local.
        if ($driveEnabled && function_exists('uploadFileToDrive') && function_exists('getOrCreateDriveFolder')) {
            try {
                // Get or create staff folder in Drive
                $staffFolderName = 'staff_' . $staffId;
                $rootFolderId = getDriveRootFolderId();
                $useSharedDrive = isSharedDriveEnabled();
                
                $staffFolderId = getOrCreateDriveFolder($staffFolderName, $rootFolderId, $useSharedDrive);
                if (!$staffFolderId) {
                    throw new Exception("getOrCreateDriveFolder returned null");
                }

                // Upload to Drive
                $driveResult = uploadFileToDrive($file['tmp_name'], $storedFilename, $mime, $staffFolderId, $useSharedDrive);
                if (!$driveResult || !isset($driveResult['fileId'])) {
                    throw new Exception("uploadFileToDrive failed");
                }

                // Return Drive file ID and metadata
                return [
                    'stored_filename' => $driveResult['fileId'], // Store Drive file ID
                    'stored_path' => 'drive://' . $staffFolderId, // Store Drive folder reference
                    'mime_type' => $mime,
                    'size_bytes' => (int)$file['size'],
                    'sha256' => $sha256,
                    'original_filename' => $originalFilename,
                    'dest_abs' => null, // No local file
                    'drive_file_id' => $driveResult['fileId'],
                ];
            } catch (Throwable $e) {
                $driveFallbacks[] = 'UPLOAD';
                error_log("Drive upload failed; falling back to local. staff_id={$staffId} file={$storedFilename} err=" . $e->getMessage());
                // continue to local fallback below
            }

        }

        // Local filesystem storage fallback
        // Ensure directory exists
        if (!is_dir($targetDirAbs)) {
            if (!mkdir($targetDirAbs, 0755, true)) {
                throw new Exception("Failed to create upload directory.");
            }
        }

        $destAbs = rtrim($targetDirAbs, '/\\') . DIRECTORY_SEPARATOR . $storedFilename;

        if (!move_uploaded_file($file['tmp_name'], $destAbs)) {
            throw new Exception("Failed to save uploaded file.");
        }

        return [
            'stored_filename' => $storedFilename,
            'stored_path' => str_replace(__DIR__ . DIRECTORY_SEPARATOR, '', $targetDirAbs),
            'mime_type' => $mime,
            'size_bytes' => (int)$file['size'],
            'sha256' => $sha256,
            'original_filename' => $originalFilename,
            'dest_abs' => $destAbs,
        ];
    };

    // -----------------------
    // STAFF (CORE RECORD)
    // -----------------------
    $created_by_user_id = isset($authUser['id']) ? (int)$authUser['id'] : null;
    if (empty($created_by_user_id)) {
        throw new Exception("Authentication required. Please log in again.");
    }

    $action_type = isset($_POST['formType']) ? sanitizeInput($_POST['formType']) : '';
    $staff_id = isset($_POST['staffId']) ? (int)$_POST['staffId'] : 0;
    $first_name = isset($_POST['firstName']) ? sanitizeInput($_POST['firstName']) : '';
    $middle_name = isset($_POST['middleName']) ? sanitizeInput($_POST['middleName']) : '';
    $last_name = isset($_POST['lastName']) ? sanitizeInput($_POST['lastName']) : '';
    $job_title = isset($_POST['jobTitle']) ? sanitizeInput($_POST['jobTitle']) : '';
    $employment_status = isset($_POST['employmentStatus']) ? sanitizeInput($_POST['employmentStatus']) : '';
    $full_address = isset($_POST['fullAddress']) ? sanitizeInput($_POST['fullAddress']) : '';
    $cell_phone = isset($_POST['cellPhone']) ? sanitizeInput($_POST['cellPhone']) : '';
    $home_phone = isset($_POST['homeWorkPhone']) ? sanitizeInput($_POST['homeWorkPhone']) : '';
    $work_phone = isset($_POST['homeWorkPhone']) ? sanitizeInput($_POST['homeWorkPhone']) : '';
    $email = isset($_POST['email']) ? filter_var($_POST['email'], FILTER_SANITIZE_EMAIL) : '';
    $dob = isset($_POST['dob']) ? sanitizeInput($_POST['dob']) : '';
    
    // Normalize action_type - convert 'Profile' to 'New Hire' for backward compatibility
    // Database constraint only allows: 'New Hire', 'Update', or 'Termination'
    if ($action_type === '' || $action_type === 'Profile') {
        $action_type = 'New Hire';
    }
    
    // Validate action_type is one of the allowed values
    $allowed_action_types = ['New Hire', 'Update', 'Termination'];
    if (!in_array($action_type, $allowed_action_types, true)) {
        throw new Exception("Invalid action type: '{$action_type}'. Must be one of: " . implode(', ', $allowed_action_types));
    }
    $isUpdate = ($action_type === 'Update' && $staff_id > 0);

    // Staff can only update their own entries
    if ($isUpdate && ($role === 'staff' || $role === 'employee')) {
        $ownStmt = $conn->prepare("SELECT created_by_user_id FROM Staff WHERE staff_id = ? LIMIT 1");
        if (!$ownStmt) {
            throw new Exception("Authorization check failed.");
        }
        $ownStmt->bind_param("i", $staff_id);
        $ownStmt->execute();
        $ownRes = $ownStmt->get_result();
        $ownRow = $ownRes ? $ownRes->fetch_assoc() : null;
        $ownStmt->close();

        $createdBy = $ownRow ? (int)$ownRow['created_by_user_id'] : 0;
        if ($createdBy <= 0 || $createdBy !== (int)$created_by_user_id) {
            http_response_code(403);
            header('Content-Type: application/json; charset=utf-8', true);
            echo json_encode([
                'success' => false,
                'title' => 'Submission Failed',
                'message' => 'Access denied',
            ]);
            exit;
        }
    }

    // Prevent staff/employee from creating multiple Staff entries.
    // Rule: staff/employee can have only one Staff record; additional submissions must be "Update".
    if (!$isUpdate && ($role === 'staff' || $role === 'employee')) {
        $existsStmt = $conn->prepare("SELECT staff_id FROM Staff WHERE created_by_user_id = ? ORDER BY staff_id DESC LIMIT 1");
        if (!$existsStmt) {
            throw new Exception("Duplicate-check failed.");
        }
        $existsStmt->bind_param("i", $created_by_user_id);
        $existsStmt->execute();
        $existsRes = $existsStmt->get_result();
        $existsRow = $existsRes ? $existsRes->fetch_assoc() : null;
        $existsStmt->close();

        if ($existsRow && isset($existsRow['staff_id']) && (int)$existsRow['staff_id'] > 0) {
            setCorsHeadersForSubmit();
            http_response_code(409);
            header('Content-Type: application/json; charset=utf-8', true);
            echo json_encode([
                'success' => false,
                'title' => 'Profile Already Exists',
                'message' => 'You already have a profile on file. Please use My Profile to view/update your existing entry.',
                'existing_staff_id' => (int)$existsRow['staff_id'],
            ]);
            exit;
        }
    }

    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception("Invalid email format.");
    }

    $full_ssn = str_replace('-', '', isset($_POST['ssn']) ? sanitizeInput($_POST['ssn']) : '');
    $ssn_last_4 = substr($full_ssn, -4);

    // Validate required fields
    if (
        empty($first_name) ||
        empty($last_name) ||
        empty($email) ||
        empty($ssn_last_4) ||
        empty($dob) ||
        empty($cell_phone) ||
        empty($full_address)
    ) {
        throw new Exception("Mandatory personal fields (Name, Email, SSN, DOB, Cell Phone, Address) are missing. Please complete Step 1.");
    }

    // Validate SSN format (should be 9 digits)
    if (strlen($full_ssn) !== 9 || !ctype_digit($full_ssn)) {
        throw new Exception("Invalid SSN format.");
    }

    $hasSsnEncrypted = staffColumnExists($conn, 'ssn_encrypted');
    $ssn_encrypted = $hasSsnEncrypted ? encryptSensitiveValue($full_ssn) : null;

    if ($isUpdate) {
        $staffSql = "
            UPDATE Staff SET
                action_type = ?, first_name = ?, middle_name = ?, last_name = ?,
                job_title = ?, employment_status = ?, ssn_last_4_digits = ?" . ($hasSsnEncrypted ? ", ssn_encrypted = ?" : "") . ",
                date_of_birth = ?, full_address = ?, cell_phone = ?, home_phone = ?, work_phone = ?, email = ?
            WHERE staff_id = ?
        ";
    } else {
        $staffSql = "
            INSERT INTO Staff
                (created_by_user_id, action_type, first_name, middle_name, last_name,
                 job_title, employment_status, ssn_last_4_digits" . ($hasSsnEncrypted ? ", ssn_encrypted" : "") . ",
                 date_of_birth, full_address, cell_phone, home_phone, work_phone, email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?" . ($hasSsnEncrypted ? ", ?" : "") . ", ?, ?, ?, ?, ?, ?)
        ";
    }
    $stmt = $conn->prepare($staffSql);
    if (!$stmt) {
        throw new Exception("Staff SQL prepare failed: " . $conn->error);
    }

    if ($isUpdate) {
        if ($hasSsnEncrypted) {
            $paramTypes = str_repeat('s', 14) . 'i';
            $stmt->bind_param(
                $paramTypes,
                $action_type,
                $first_name,
                $middle_name,
                $last_name,
                $job_title,
                $employment_status,
                $ssn_last_4,
                $ssn_encrypted,
                $dob,
                $full_address,
                $cell_phone,
                $home_phone,
                $work_phone,
                $email,
                $staff_id
            );
        } else {
            $paramTypes = str_repeat('s', 13) . 'i';
            $stmt->bind_param(
                $paramTypes,
                $action_type,
                $first_name,
                $middle_name,
                $last_name,
                $job_title,
                $employment_status,
                $ssn_last_4,
                $dob,
                $full_address,
                $cell_phone,
                $home_phone,
                $work_phone,
                $email,
                $staff_id
            );
        }
    } else {
        if ($hasSsnEncrypted) {
            $paramTypes = 'i' . str_repeat('s', 14);
            $stmt->bind_param(
                $paramTypes,
                $created_by_user_id,
                $action_type,
                $first_name,
                $middle_name,
                $last_name,
                $job_title,
                $employment_status,
                $ssn_last_4,
                $ssn_encrypted,
                $dob,
                $full_address,
                $cell_phone,
                $home_phone,
                $work_phone,
                $email
            );
        } else {
            $paramTypes = 'i' . str_repeat('s', 13);
            $stmt->bind_param(
                $paramTypes,
                $created_by_user_id,
                $action_type,
                $first_name,
                $middle_name,
                $last_name,
                $job_title,
                $employment_status,
                $ssn_last_4,
                $dob,
                $full_address,
                $cell_phone,
                $home_phone,
                $work_phone,
                $email
            );
        }
    }

    if (!$stmt->execute()) {
        throw new Exception(($isUpdate ? "Staff update failed: " : "Staff insert failed: ") . $stmt->error);
    }
    if (!$isUpdate) {
        $staff_id = $conn->insert_id;
    }
    $stmt->close();

    if ($isUpdate) {
        $conn->query("DELETE FROM EmergencyContact WHERE staff_id = " . (int)$staff_id);
        $conn->query("DELETE FROM ProfessionalData WHERE staff_id = " . (int)$staff_id);
        $conn->query("DELETE FROM StaffCertification WHERE staff_id = " . (int)$staff_id);
        $conn->query("DELETE FROM BankInfo WHERE staff_id = " . (int)$staff_id);
        $conn->query("DELETE FROM ComplianceAgreement WHERE staff_id = " . (int)$staff_id);
    }

    // -----------------------
    // EMERGENCY CONTACT
    // -----------------------
    $contact_name = isset($_POST['emergencyName']) ? sanitizeInput($_POST['emergencyName']) : '';
    $relationship = isset($_POST['relationship']) ? sanitizeInput($_POST['relationship']) : '';
    $primary_phone = isset($_POST['primaryPhone']) ? sanitizeInput($_POST['primaryPhone']) : '';
    $secondary_phone = isset($_POST['secondaryPhone']) ? sanitizeInput($_POST['secondaryPhone']) : '';

    if (empty($contact_name) || empty($relationship) || empty($primary_phone)) {
        throw new Exception("Emergency Contact Name, Relationship, and Primary Phone are required.");
    }

    $emergencySql = "
        INSERT INTO EmergencyContact
            (staff_id, contact_name, relationship, primary_phone, secondary_phone)
        VALUES (?, ?, ?, ?, ?)
    ";
    $stmt = $conn->prepare($emergencySql);
    if (!$stmt) {
        throw new Exception("Emergency SQL prepare failed: " . $conn->error);
    }

    $stmt->bind_param(
        "issss",
        $staff_id,
        $contact_name,
        $relationship,
        $primary_phone,
        $secondary_phone
    );

    if (!$stmt->execute()) {
        throw new Exception("Emergency insert failed: " . $stmt->error);
    }
    $stmt->close();

    // -----------------------
    // PROFESSIONAL DATA
    // -----------------------
    $highest_degree = isset($_POST['highestDegree']) ? sanitizeInput($_POST['highestDegree']) : '';
    $year_awarded = isset($_POST['yearAwarded']) ? sanitizeInput($_POST['yearAwarded']) : null;
    $major = isset($_POST['major']) ? sanitizeInput($_POST['major']) : '';
    $license_status_raw = isset($_POST['licenseStatus']) ? sanitizeInput($_POST['licenseStatus']) : '';
    $license_status = null;
    $license_status_raw = trim((string)$license_status_raw);
    if ($license_status_raw !== '') {
        $ls = strtolower(trim($license_status_raw));
        if ($ls === 'not licensed' || $ls === 'not_licensed' || $ls === 'not-licensed') {
            $license_status = 'Not Licensed';
        } elseif ($ls === 'licensed') {
            $license_status = 'Licensed';
        } elseif ($ls === 'provisional') {
            $license_status = 'Provisional';
        } else {
            throw new Exception("Invalid License Status. Must be Not Licensed, Licensed, or Provisional.");
        }
    }
    $license_exp = isset($_POST['licenseExpDate']) ? sanitizeInput($_POST['licenseExpDate']) : null;
    $npi_number = isset($_POST['npiNumber']) ? sanitizeInput($_POST['npiNumber']) : '';
    $languages = isset($_POST['languages']) ? sanitizeInput($_POST['languages']) : '';
    $specialty_areas = isset($_POST['specialtyAreas']) ? sanitizeInput($_POST['specialtyAreas']) : '';

    if (empty($major)) {
        throw new Exception("Professional: Major is required.");
    }

    if ($year_awarded === '') {
        $year_awarded = null;
    }

    // If license status implies an exp date, require it
    if (($license_status === 'Licensed' || $license_status === 'Provisional') && empty($license_exp)) {
        throw new Exception("License expiration date is required when License Status is Licensed/Provisional.");
    }

    $profSql = "
        INSERT INTO ProfessionalData
            (staff_id, highest_degree, year_awarded, major,
             license_status, license_exp_date, npi_number,
             languages, specialty_areas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";
    $stmt = $conn->prepare($profSql);
    if (!$stmt) {
        throw new Exception("Professional SQL prepare failed: " . $conn->error);
    }

    $stmt->bind_param(
        "isissssss",
        $staff_id,
        $highest_degree,
        $year_awarded,
        $major,
        $license_status,
        $license_exp,
        $npi_number,
        $languages,
        $specialty_areas
    );

    if (!$stmt->execute()) {
        throw new Exception("Professional insert failed: " . $stmt->error);
    }
    $stmt->close();

    // -----------------------
    // STAFF CERTIFICATIONS
    // -----------------------
    $certTypesRaw = isset($_POST['certTypes']) ? sanitizeInput($_POST['certTypes']) : '';
    if (!empty($certTypesRaw)) {
        $certTypes = explode('|', $certTypesRaw);
        $cert_number = isset($_POST['certNumber']) ? sanitizeInput($_POST['certNumber']) : '';
        $cert_exp = isset($_POST['certExpDate']) ? sanitizeInput($_POST['certExpDate']) : null;

        // If any real certification is selected (not Not Certified), require details.
        $hasRealCert = false;
        $hasRbt = false;
        foreach ($certTypes as $ct0) {
            $ct0 = trim($ct0);
            if ($ct0 === '') continue;
            if (strcasecmp($ct0, 'Not Certified') === 0) continue;
            $hasRealCert = true;
            if (strcasecmp($ct0, 'RBT') === 0) $hasRbt = true;
        }

        if ($hasRealCert && (empty($cert_number) || empty($cert_exp))) {
            throw new Exception("Certification number and expiration date are required when certifications are selected.");
        }

        // If RBT is selected, require certificate upload.
        if ($hasRbt) {
            $hasExistingCert = !empty($_POST['hasExistingCertificate']) && $_POST['hasExistingCertificate'] === '1';
            if (!$hasExistingCert && (!isset($_FILES['certificateUpload']) || $_FILES['certificateUpload']['error'] === UPLOAD_ERR_NO_FILE)) {
                throw new Exception("Certificate upload is required when RBT is selected.");
            }
        }

        $certSql = "
            INSERT INTO StaffCertification
                (staff_id, cert_type, cert_number, exp_date)
            VALUES (?, ?, ?, ?)
        ";
        $stmt = $conn->prepare($certSql);
        if (!$stmt) {
            throw new Exception("Certification SQL prepare failed: " . $conn->error);
        }

        foreach ($certTypes as $ct) {
            $ct = trim($ct);
            if ($ct === '') {
                continue;
            }

            $stmt->bind_param(
                "isss",
                $staff_id,
                $ct,
                $cert_number,
                $cert_exp
            );

            if (!$stmt->execute()) {
                throw new Exception("Certification insert failed: " . $stmt->error);
            }
        }
        $stmt->close();
    }

    // -----------------------
    // BANK INFO (Encryption recommended for production)
    // -----------------------
    $bank_name = isset($_POST['bankName']) ? sanitizeInput($_POST['bankName']) : '';
    $account_name = isset($_POST['accountName']) ? sanitizeInput($_POST['accountName']) : '';
    $account_number = isset($_POST['accountNumber']) ? sanitizeInput($_POST['accountNumber']) : '';
    $routing_number = isset($_POST['routingNumber']) ? sanitizeInput($_POST['routingNumber']) : '';
    $account_type = isset($_POST['accountType']) ? sanitizeInput($_POST['accountType']) : '';
    $authorization = !empty($_POST['payrollAuth']) && $_POST['payrollAuth'] === '1' ? 1 : 0;

    if (empty($bank_name) || empty($account_name) || empty($account_number) || empty($routing_number) || empty($account_type) || !$authorization) {
        throw new Exception("Bank fields and the Authorization Agreement are required.");
    }

    // TODO: In production, encrypt account_number and routing_number before storing
    // For now, storing as-is (you should implement encryption)
    $bankSql = "
        INSERT INTO BankInfo
            (staff_id, bank_name, account_name,
             account_number_encrypted, routing_number_encrypted,
             account_type, authorization_agreed, authorization_timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    ";
    $stmt = $conn->prepare($bankSql);
    if (!$stmt) {
        throw new Exception("Bank SQL prepare failed: " . $conn->error);
    }

    $stmt->bind_param(
        "isssssi",
        $staff_id,
        $bank_name,
        $account_name,
        $account_number,
        $routing_number,
        $account_type,
        $authorization
    );

    if (!$stmt->execute()) {
        throw new Exception("Bank insert failed: " . $stmt->error);
    }
    $stmt->close();

    // -----------------------
    // ATTACHMENTS (optional, except RBT certificate)
    // -----------------------
    $hasAnyUpload =
        (isset($_FILES['cprUpload']) && $_FILES['cprUpload']['error'] !== UPLOAD_ERR_NO_FILE) ||
        (isset($_FILES['certificateUpload']) && $_FILES['certificateUpload']['error'] !== UPLOAD_ERR_NO_FILE);

    if ($hasAnyUpload) {
        $attachmentsSql = "
            INSERT INTO StaffAttachments
                (staff_id, uploaded_by_user_id, attachment_type,
                 original_filename, stored_path, stored_filename,
                 mime_type, size_bytes, sha256, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ";
        $attStmt = $conn->prepare($attachmentsSql);
        if (!$attStmt) {
            throw new Exception("Attachments SQL prepare failed: " . $conn->error);
        }

        $uploadBaseAbs = __DIR__ . '/uploads';
        $staffDirAbs = $uploadBaseAbs . '/staff_' . $staff_id;
        $staffDirRel = 'uploads/staff_' . $staff_id;

        // CPR upload (optional)
        if (isset($_FILES['cprUpload']) && $_FILES['cprUpload']['error'] !== UPLOAD_ERR_NO_FILE) {
            $targetName = bin2hex(random_bytes(16));
            $saved = $saveUploadedFile($_FILES['cprUpload'], $staffDirAbs, $targetName, $staff_id);
            if (isset($saved['dest_abs']) && $saved['dest_abs']) {
                $savedFiles[] = $saved['dest_abs'];
            }

            $attachment_type = 'CPR';
            $stored_path = $saved['stored_path'];
            $attStmt->bind_param(
                "iisssssis",
                $staff_id,
                $created_by_user_id,
                $attachment_type,
                $saved['original_filename'],
                $stored_path,
                $saved['stored_filename'],
                $saved['mime_type'],
                $saved['size_bytes'],
                $saved['sha256']
            );
            if (!$attStmt->execute()) {
                throw new Exception("CPR attachment insert failed: " . $attStmt->error);
            }
        }

        // Certificate upload (optional unless RBT selected)
        if (isset($_FILES['certificateUpload']) && $_FILES['certificateUpload']['error'] !== UPLOAD_ERR_NO_FILE) {
            $targetName = bin2hex(random_bytes(16));
            $saved = $saveUploadedFile($_FILES['certificateUpload'], $staffDirAbs, $targetName, $staff_id);
            if (isset($saved['dest_abs']) && $saved['dest_abs']) {
                $savedFiles[] = $saved['dest_abs'];
            }

            $attachment_type = 'CERTIFICATE';
            $stored_path = $saved['stored_path'];
            $attStmt->bind_param(
                "iisssssis",
                $staff_id,
                $created_by_user_id,
                $attachment_type,
                $saved['original_filename'],
                $stored_path,
                $saved['stored_filename'],
                $saved['mime_type'],
                $saved['size_bytes'],
                $saved['sha256']
            );
            if (!$attStmt->execute()) {
                throw new Exception("Certificate attachment insert failed: " . $attStmt->error);
            }
        }

        $attStmt->close();
    }

    // -----------------------
    // DIGITAL SIGNATURE (Save as attachment)
    // -----------------------
    $digital_signature = isset($_POST['digitalSignature']) ? trim($_POST['digitalSignature']) : '';
    $signature_date = isset($_POST['signatureDate']) ? sanitizeInput($_POST['signatureDate']) : '';

    if (empty($digital_signature) || empty($signature_date)) {
        throw new Exception("Digital signature and date are required.");
    }

    // Validate that signature is a base64 data URL
    if (!preg_match('/^data:image\/(png|jpeg|jpg);base64,/', $digital_signature)) {
        throw new Exception("Invalid signature format. Please draw your signature again.");
    }

    // Parse the data URL
    if (preg_match('/^data:image\/(png|jpeg|jpg);base64,(.+)$/', $digital_signature, $matches)) {
        $imageFormat = $matches[1] === 'jpg' ? 'jpeg' : $matches[1];
        $imageData = base64_decode($matches[2], true);
        
        if ($imageData === false) {
            throw new Exception("Failed to decode signature image.");
        }

        // Validate image size (max 2MB for signature)
        $maxBytes = 2 * 1024 * 1024;
        if (strlen($imageData) > $maxBytes) {
            throw new Exception("Signature image is too large (max 2MB).");
        }

        // Calculate file hash and size from image data
        $sha256 = hash('sha256', $imageData);
        if ($sha256 === false) {
            throw new Exception("Failed to hash signature image.");
        }
        $sizeBytes = strlen($imageData);

        $existingSignatureHash = null;
        if ($isUpdate) {
            $sigCheck = $conn->prepare("
                SELECT sha256
                FROM StaffAttachments
                WHERE staff_id = ? AND attachment_type = 'SIGNATURE'
                ORDER BY created_at DESC
                LIMIT 1
            ");
            if ($sigCheck) {
                $sigCheck->bind_param("i", $staff_id);
                $sigCheck->execute();
                $sigResult = $sigCheck->get_result();
                if ($sigRow = $sigResult->fetch_assoc()) {
                    $existingSignatureHash = $sigRow['sha256'] ?? null;
                }
                $sigCheck->close();
            }
        }
        $signatureUnchanged = $isUpdate && $existingSignatureHash && hash_equals($existingSignatureHash, $sha256);

        if (!$signatureUnchanged) {
        // Generate unique filename
        $targetName = bin2hex(random_bytes(16));
        $storedFilename = $targetName . '.png'; // Always save as PNG
        $original_filename = 'signature.png';
        $mime_type = 'image/png';

        // If Google Drive is enabled, try uploading to Drive. If Drive fails (perms/misconfig/transient),
        // fall back to local storage so staff submissions are not blocked.
        $savedToDrive = false;
        if (
            $driveEnabled &&
            function_exists('uploadFileContentToDrive') &&
            function_exists('getOrCreateDriveFolder')
        ) {
            try {
                // Get or create staff folder in Drive
                $staffFolderName = 'staff_' . $staff_id;
                $rootFolderId = getDriveRootFolderId();
                $useSharedDrive = isSharedDriveEnabled();
                
                $staffFolderId = getOrCreateDriveFolder($staffFolderName, $rootFolderId, $useSharedDrive);
                if (!$staffFolderId) {
                    throw new Exception("getOrCreateDriveFolder returned null");
                }

                // Upload to Drive
                $driveResult = uploadFileContentToDrive($imageData, $storedFilename, $mime_type, $staffFolderId, $useSharedDrive);
                if (!$driveResult || !isset($driveResult['fileId'])) {
                    throw new Exception("uploadFileContentToDrive failed");
                }

                $stored_path = 'drive://' . $staffFolderId;
                $stored_filename = $driveResult['fileId']; // Store Drive file ID
                $savedToDrive = true;
            } catch (Throwable $e) {
                $driveFallbacks[] = 'SIGNATURE';
                error_log("Drive signature upload failed; falling back to local. staff_id={$staff_id} err=" . $e->getMessage());
                $savedToDrive = false;
            }
        }

        if (!$savedToDrive) {
            // Fallback to local filesystem storage
            $uploadBaseAbs = __DIR__ . '/uploads';
            $staffDirAbs = $uploadBaseAbs . '/staff_' . $staff_id;
            $staffDirRel = 'uploads/staff_' . $staff_id;
            
            if (!is_dir($staffDirAbs)) {
                if (!mkdir($staffDirAbs, 0755, true)) {
                    throw new Exception("Failed to create upload directory for signature.");
                }
            }

            $destAbs = rtrim($staffDirAbs, '/\\') . DIRECTORY_SEPARATOR . $storedFilename;

            // Save the image file
            if (file_put_contents($destAbs, $imageData) === false) {
                throw new Exception("Failed to save signature image.");
            }
            $savedFiles[] = $destAbs;

            $stored_path = $staffDirRel;
            $stored_filename = $storedFilename;
        }

            if ($isUpdate) {
                $conn->query("DELETE FROM StaffAttachments WHERE staff_id = " . (int)$staff_id . " AND attachment_type = 'SIGNATURE'");
            }

        // Insert into StaffAttachments
        $signatureSql = "
            INSERT INTO StaffAttachments
                (staff_id, uploaded_by_user_id, attachment_type,
                 original_filename, stored_path, stored_filename,
                 mime_type, size_bytes, sha256, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ";
        $sigStmt = $conn->prepare($signatureSql);
        if (!$sigStmt) {
            throw new Exception("Signature attachment SQL prepare failed: " . $conn->error);
        }

        $attachment_type = 'SIGNATURE';
        
        $sigStmt->bind_param(
            "iisssssis",
            $staff_id,
            $created_by_user_id,
            $attachment_type,
            $original_filename,
            $stored_path,
            $stored_filename,
            $mime_type,
            $sizeBytes,
            $sha256
        );
        
        if (!$sigStmt->execute()) {
            throw new Exception("Signature attachment insert failed: " . $sigStmt->error);
        }
        $sigStmt->close();
        }
    } else {
        throw new Exception("Invalid signature data URL format.");
    }

    // -----------------------
    // COMPLIANCE AGREEMENT
    // -----------------------
    $hipaa = !empty($_POST['hipaaAck']) && $_POST['hipaaAck'] === '1' ? 1 : 0;
    $abuse = !empty($_POST['abuseAck']) && $_POST['abuseAck'] === '1' ? 1 : 0;

    // Validate that both compliance checkboxes are checked
    if (!$hipaa || !$abuse) {
        throw new Exception("All compliance agreements must be acknowledged.");
    }

    $compSql = "
        INSERT INTO ComplianceAgreement
            (staff_id, hipaa_acknowledged, hipaa_acknowledged_at,
             abuse_reporting_acknowledged, abuse_reporting_acknowledged_at)
        VALUES (
            ?, 
            ?, IF(? = 1, NOW(), NULL),
            ?, IF(? = 1, NOW(), NULL)
        )
    ";
    $stmt = $conn->prepare($compSql);
    if (!$stmt) {
        throw new Exception("Compliance SQL prepare failed: " . $conn->error);
    }

    $stmt->bind_param(
        "iiiii",
        $staff_id,
        $hipaa,
        $hipaa,
        $abuse,
        $abuse
    );

    if (!$stmt->execute()) {
        throw new Exception("Compliance insert failed: " . $stmt->error);
    }
    $stmt->close();

    // Signature date is already validated above, just ensure it's set
    if (empty($signature_date)) {
        throw new Exception("Signature date is required.");
    }

    // -----------------------
    // COMMIT & RESPONSE
    // -----------------------
    $conn->commit();

    $response['success'] = true;
    $response['title'] = 'Success!';
    $response['message'] = "Full HR packet for staff ID #{$staff_id} submitted successfully.";
    $response['drive'] = [
        'enabled' => (bool)$driveEnabled,
        'fallbacks' => array_values(array_unique($driveFallbacks)),
        'hint' => empty($driveFallbacks)
            ? null
            : 'Drive upload failed and files were saved locally. Check backend/check_drive_config.php and backend/drive_debug_folder.php for the root cause.',
    ];
    
} catch (Throwable $e) {
    $conn->rollback();
    $response['message'] = $e->getMessage();
    error_log("Form submission error: " . $e->getMessage());

    // best-effort cleanup for files written before a DB failure
    if (isset($savedFiles) && is_array($savedFiles)) {
        foreach ($savedFiles as $p) {
            if (is_string($p) && file_exists($p)) {
                @unlink($p);
            }
        }
    }
}

$conn->close();

while (ob_get_level() > 0) {
    @ob_end_clean();
}

// Ensure CORS headers are set before sending response
setCorsHeadersForSubmit();
header('Content-Type: application/json; charset=utf-8', true);
echo json_encode($response);
?>



<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mailer.php';

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
    echo json_encode(['success' => false, 'message' => 'Access denied']);
    exit;
}

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

function sendOfferInitiatedEmail(string $toEmail, array $offer): void {
    if (!filter_var($toEmail, FILTER_VALIDATE_EMAIL)) return;
    $employeeName = htmlspecialchars((string)$offer['employee_name'], ENT_QUOTES, 'UTF-8');
    $firstNameRaw = isset($offer['first_name']) ? trim((string)$offer['first_name']) : '';
    $firstName = $firstNameRaw !== '' ? htmlspecialchars($firstNameRaw, ENT_QUOTES, 'UTF-8') : htmlspecialchars(strtok((string)$offer['employee_name'], ' ') ?: 'there', ENT_QUOTES, 'UTF-8');
    $jobTitle = htmlspecialchars((string)($offer['job_title'] ?? ''), ENT_QUOTES, 'UTF-8');
    $payRate = htmlspecialchars((string)($offer['pay_rate'] ?? ''), ENT_QUOTES, 'UTF-8');
    $username = isset($offer['username']) ? htmlspecialchars((string)$offer['username'], ENT_QUOTES, 'UTF-8') : '';
    $tempPassword = isset($offer['temp_password']) ? htmlspecialchars((string)$offer['temp_password'], ENT_QUOTES, 'UTF-8') : '';
    $baseUrl = "https://mahaverse.mahabehavioralhealth.com";
    $loginUrl = $baseUrl . "/launchpad/login";
    // Deep-link via login with redirect so that after authentication the user lands directly on the offer letter
    $offerUrl = $baseUrl . "/launchpad/login?redirect=" . urlencode("/launchpad/form/?view=offer-letter");

    $subject = "Job offer for {$employeeName}-Maha Behavioral Health Services";
    $hasCreds = ($username !== '' && $tempPassword !== '');
    // Follow the same email template used in create_user.php (keep styling consistent).
    // IMPORTANT: avoid warning/danger symbols/emojis to reduce spam risk.
    $resetUrl = $loginUrl . "?view=forgotPassword";
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
                .credentials { background-color: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 16px 0; }
                .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
                .value { font-size: 16px; font-weight: bold; color: #111827; }
                .features { background-color: white; border-left: 4px solid #0d9488; padding: 16px; margin: 20px 0; }
                .features ul { margin: 0; padding-left: 20px; }
                .features li { margin: 8px 0; }
                .cta {
                    display: inline-block;
                    margin-top: 12px;
                    padding: 10px 16px;
                    background: #0d9488;
                    color: #ffffff !important;
                    text-decoration: none !important;
                    border-radius: 6px;
                    font-weight: 600;
                }
                .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
                .note { color: #374151; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <img src='https://www.mahabehavioralhealth.com/images/mahalogo_v1_small.jpg' alt='Maha Launchpad Logo' class='logo' />
                    <h1 style='margin: 0 0 10px 0;'>Maha Launchpad</h1>
                    <p style='margin: 0;'>Your Offer Letter</p>
                </div>
                <div class='content'>
                    <p>Dear {$firstName},</p>
                    <p>We are pleased to formally offer you the position of &quot;{$jobTitle}&quot; on a part-time basis at &quot;Maha Behavioral Health Services&quot;.</p>
                    <p>The starting compensation for this role is {$payRate}, with payments processed on a biweekly basis. Please note that this offer is contingent upon the successful completion of a background check.</p>
                    <p>We believe your skills and experience will be a valuable asset to our team, and we look forward to your contributions.</p>
                    <p>Should you have any questions or require further clarification, please contact me at <a href='mailto:info@mahabehavioralhealth.com'>info@mahabehavioralhealth.com</a>.</p>
                    " . ($hasCreds ? ("
                    <div class='credentials'>
                        <div class='label'>Username</div>
                        <div class='value'>{$username}</div>
                        <div class='label' style='margin-top: 12px;'>Temporary Password</div>
                        <div class='value'>{$tempPassword}</div>
                    </div>
                    <p class='note'>Please reset your password after your first login.</p>
                    ") : "") . "
                    <a class='cta' href='{$offerUrl}'>To View and Accept your Offer</a>
                    <div style='margin-top: 14px;'>
                        <a class='cta' href='{$resetUrl}'>Reset Password</a>
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

    // Use centralized mail helper (SMTP / DKIM etc.) best-effort
    sendMail($toEmail, $subject, $message);
}

function generateTempPassword(): string {
    // 14-16 chars, includes upper/lower/digit/symbol, user-friendly.
    return 'Temp@' . bin2hex(random_bytes(6));
}

function staffColumnMeta(mysqli $conn, string $column): ?array {
    $sql = "SELECT DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Staff' AND COLUMN_NAME = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) return null;
    $stmt->bind_param("s", $column);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row) return null;
    return [
        'data_type' => strtolower((string)($row['DATA_TYPE'] ?? '')),
        'is_nullable' => strtoupper((string)($row['IS_NULLABLE'] ?? '')) === 'YES',
    ];
}

function defaultForStaffColumn(?array $meta) {
    if (!$meta) return null;
    $type = $meta['data_type'] ?? '';
    $nullable = (bool)($meta['is_nullable'] ?? true);
    if ($nullable) return null;
    if (in_array($type, ['date'], true)) return '1970-01-01';
    if (in_array($type, ['datetime', 'timestamp'], true)) return '1970-01-01 00:00:00';
    if (in_array($type, ['int', 'bigint', 'smallint', 'mediumint', 'tinyint', 'decimal', 'float', 'double'], true)) return 0;
    return ''; // varchar/text fallback
}

function splitFullName(string $full): array {
    $full = trim(preg_replace('/\s+/', ' ', $full));
    if ($full === '') return ['', '', ''];
    $parts = explode(' ', $full);
    $first = $parts[0] ?? '';
    $last = count($parts) > 1 ? $parts[count($parts) - 1] : '';
    $middle = count($parts) > 2 ? implode(' ', array_slice($parts, 1, -1)) : '';
    return [$first, $middle, $last];
}

try {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) $payload = $_POST;

    $currentUserId = isset($authUser['id']) ? (int)$authUser['id'] : 0;
    if ($currentUserId <= 0) throw new Exception('Authentication required');

    $staffId = isset($payload['staff_id']) ? (int)$payload['staff_id'] : 0;
    $employeeName = trim((string)($payload['employee_name'] ?? ''));
    $firstNamePayload = trim((string)($payload['first_name'] ?? ''));
    $lastNamePayload = trim((string)($payload['last_name'] ?? ''));
    $jobTitle = trim((string)($payload['job_title'] ?? ''));
    $payRate = trim((string)($payload['pay_rate'] ?? ''));
    $positionCode = trim((string)($payload['position_code'] ?? ''));
    $offerLetterBody = trim((string)($payload['offer_letter_body'] ?? ''));
    $sendEmail = isset($payload['send_email']) ? (int)!!$payload['send_email'] : 1;
    $username = trim((string)($payload['username'] ?? ''));
    $email = trim((string)($payload['email'] ?? ''));

    if ($staffId <= 0) {
        // New staff creation path: require first/last (preferred), and derive employeeName.
        if ($firstNamePayload === '' || $lastNamePayload === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'First name and last name are required to create new staff.']);
            exit;
        }
        $employeeName = trim($firstNamePayload . ' ' . $lastNamePayload);
    }

    if ($employeeName === '' || $jobTitle === '' || $payRate === '') {
        throw new Exception('Employee name, job title, and pay rate are required.');
    }

    $conn->begin_transaction();
    $staffCreated = false;

    // If staff_id is missing, create a minimal Staff record (and link it to the new user).
    if ($staffId <= 0) {
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Valid email is required to create a new staff record.']);
            exit;
        }
        if ($username === '' || strlen($username) < 3 || strlen($username) > 50) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Username must be between 3 and 50 characters.']);
            exit;
        }

        // Prevent duplicate staff by email (best-effort, table doesn't enforce uniqueness).
        $dupStaff = $conn->prepare("SELECT staff_id FROM Staff WHERE email = ? ORDER BY staff_id DESC LIMIT 1");
        if ($dupStaff) {
            $dupStaff->bind_param("s", $email);
            $dupStaff->execute();
            $dupStaffRes = $dupStaff->get_result();
            $dupStaffRow = $dupStaffRes ? $dupStaffRes->fetch_assoc() : null;
            $dupStaff->close();
            if ($dupStaffRow && isset($dupStaffRow['staff_id'])) {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'A staff record with this email already exists. Please select the existing staff.', 'staff_id' => (int)$dupStaffRow['staff_id']]);
                exit;
            }
        }
    }

    // We'll create a user account only when needed:
    // - new staff creation (staff_id missing), OR
    // - existing staff with no created_by_user_id.
    // Validations: duplicates by email/username.
    $userCreated = false;
    $tempPassword = '';
    $newUserIdForStaff = 0;

    // Ensure staff exists (lookup or create).
    $staffRow = null;
    if ($staffId > 0) {
        $staffStmt = $conn->prepare("SELECT staff_id, email, created_by_user_id FROM Staff WHERE staff_id = ? LIMIT 1");
        if (!$staffStmt) throw new Exception('Staff lookup failed');
        $staffStmt->bind_param("i", $staffId);
        $staffStmt->execute();
        $staffRes = $staffStmt->get_result();
        $staffRow = $staffRes ? $staffRes->fetch_assoc() : null;
        $staffStmt->close();
        if (!$staffRow) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Staff record not found.']);
            exit;
        }
    } else {
        // Create minimal staff row linked to the newly created user.
        // Create user for the new staff (required).
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Valid email is required to create the account.']);
            exit;
        }
        if ($username === '' || strlen($username) < 3 || strlen($username) > 50) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Username must be between 3 and 50 characters.']);
            exit;
        }
        $dupU = $conn->prepare("SELECT id FROM Users WHERE username = ? OR email = ? LIMIT 1");
        if (!$dupU) throw new Exception('User duplicate check failed');
        $dupU->bind_param("ss", $username, $email);
        $dupU->execute();
        $dupURes = $dupU->get_result();
        $dupURow = $dupURes ? $dupURes->fetch_assoc() : null;
        $dupU->close();
        if ($dupURow) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Username or email already exists.']);
            exit;
        }

        $tempPassword = generateTempPassword();
        $passwordHash = password_hash($tempPassword, PASSWORD_DEFAULT);
        $insU = $conn->prepare("
            INSERT INTO Users (username, password_hash, email, role, is_active, created_by)
            VALUES (?, ?, ?, 'staff', 1, ?)
        ");
        if (!$insU) throw new Exception('User insert failed');
        $insU->bind_param("sssi", $username, $passwordHash, $email, $currentUserId);
        if (!$insU->execute()) throw new Exception('User insert failed: ' . $insU->error);
        $newUserIdForStaff = (int)$conn->insert_id;
        $insU->close();
        $userCreated = true;

        // Use first/last from payload if provided; otherwise fall back to splitting employeeName.
        if ($firstNamePayload !== '' || $lastNamePayload !== '') {
            $first = $firstNamePayload;
            $middle = '';
            $last = $lastNamePayload;
        } else {
            [$first, $middle, $last] = splitFullName($employeeName);
        }

        $cols = [];
        $placeholders = [];
        $types = '';
        $values = [];

        $set = function (string $col, $val, string $t) use (&$cols, &$placeholders, &$types, &$values) {
            $cols[] = $col;
            $placeholders[] = '?';
            $types .= $t;
            $values[] = $val;
        };

        $set('created_by_user_id', $newUserIdForStaff, 'i');
        // Staff table enforces allowed action_type values (see submit_form.php).
        $set('action_type', 'New Hire', 's');
        $set('first_name', $first, 's');
        $set('middle_name', $middle, 's');
        $set('last_name', $last, 's');
        $set('job_title', $jobTitle, 's');
        // Use NULLs for unknown values to satisfy DB CHECK constraints.
        $set('employment_status', null, 's');
        $set('ssn_last_4_digits', null, 's');

        // Optional/nullable columns - set safe defaults if they exist
        foreach (['date_of_birth', 'full_address', 'cell_phone', 'home_phone', 'work_phone'] as $c) {
            $meta = staffColumnMeta($conn, $c);
            if ($meta) {
                $set($c, defaultForStaffColumn($meta), 's');
            }
        }

        $set('email', $email, 's');

        $sql = "INSERT INTO Staff (" . implode(',', $cols) . ") VALUES (" . implode(',', $placeholders) . ")";
        $stmt = $conn->prepare($sql);
        if (!$stmt) throw new Exception('Staff insert failed: ' . $conn->error);

        // bind_param with references
        $refs = [];
        foreach ($values as $k => $v) $refs[$k] = &$values[$k];
        array_unshift($refs, $types);
        call_user_func_array([$stmt, 'bind_param'], $refs);
        if (!$stmt->execute()) throw new Exception('Staff insert failed: ' . $stmt->error);
        $staffId = (int)$conn->insert_id;
        $stmt->close();

        $staffCreated = true;
        $staffRow = ['staff_id' => $staffId, 'email' => $email, 'created_by_user_id' => $newUserIdForStaff];
    }

    // Prevent multiple initiations
    $dup = $conn->prepare("SELECT initiation_id FROM StaffOfferInitiations WHERE staff_id = ? LIMIT 1");
    if (!$dup) throw new Exception('Offer initiation check failed');
    $dup->bind_param("i", $staffId);
    $dup->execute();
    $dupRes = $dup->get_result();
    $dupRow = $dupRes ? $dupRes->fetch_assoc() : null;
    $dup->close();
    if ($dupRow) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Offer already initiated for this staff.', 'staff_id' => $staffId]);
        exit;
    }

    $createdByUserId = isset($staffRow['created_by_user_id']) ? (int)$staffRow['created_by_user_id'] : 0;
    $staffEmail = trim((string)($staffRow['email'] ?? ''));
    // userCreated/tempPassword may have been set above for new staff creation

    // If staff exists but has no linked user yet, create one (validations: duplicates by email/username).
    if ($createdByUserId <= 0 && !$userCreated) {
        if ($username === '' || strlen($username) < 3 || strlen($username) > 50) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Username must be between 3 and 50 characters.']);
            exit;
        }
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Valid email is required to create the account.']);
            exit;
        }

        $dupU = $conn->prepare("SELECT id FROM Users WHERE username = ? OR email = ? LIMIT 1");
        if (!$dupU) throw new Exception('User duplicate check failed');
        $dupU->bind_param("ss", $username, $email);
        $dupU->execute();
        $dupURes = $dupU->get_result();
        $dupURow = $dupURes ? $dupURes->fetch_assoc() : null;
        $dupU->close();
        if ($dupURow) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Username or email already exists.']);
            exit;
        }

        $tempPassword = generateTempPassword();
        $passwordHash = password_hash($tempPassword, PASSWORD_DEFAULT);

        $insU = $conn->prepare("
            INSERT INTO Users (username, password_hash, email, role, is_active, created_by)
            VALUES (?, ?, ?, 'staff', 1, ?)
        ");
        if (!$insU) throw new Exception('User insert failed');
        $insU->bind_param("sssi", $username, $passwordHash, $email, $currentUserId);
        if (!$insU->execute()) throw new Exception('User insert failed: ' . $insU->error);
        $newUserId = (int)$conn->insert_id;
        $insU->close();

        $updS = $conn->prepare("UPDATE Staff SET created_by_user_id = ?, email = ? WHERE staff_id = ? LIMIT 1");
        if ($updS) {
            $updS->bind_param("isi", $newUserId, $email, $staffId);
            $updS->execute();
            $updS->close();
        }

        $createdByUserId = $newUserId;
        $staffEmail = $email;
        $userCreated = true;
    } else {
        // If staff already has an account, prefer staff email; allow admin to provide/overwrite if missing.
        if ($staffEmail === '' && $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $updS = $conn->prepare("UPDATE Staff SET email = ? WHERE staff_id = ? LIMIT 1");
            if ($updS) {
                $updS->bind_param("si", $email, $staffId);
                $updS->execute();
                $updS->close();
            }
            $staffEmail = $email;
        }
    }

    // Insert initiation (no upsert; only once)
    $ins = $conn->prepare("
        INSERT INTO StaffOfferInitiations (staff_id, initiated_by_user_id, employee_name, job_title, pay_rate, position_code, offer_letter_body)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    if (!$ins) throw new Exception('Offer insert failed');
    $pcVal = $positionCode !== '' ? $positionCode : null;
    $bodyVal = $offerLetterBody !== '' ? $offerLetterBody : null;
    $ins->bind_param("iisssss", $staffId, $currentUserId, $employeeName, $jobTitle, $payRate, $pcVal, $bodyVal);
    if (!$ins->execute()) throw new Exception('Offer insert failed: ' . $ins->error);
    $ins->close();

    if ($sendEmail) {
        if ($staffEmail !== '') {
            sendOfferInitiatedEmail($staffEmail, [
                'employee_name' => $employeeName,
                'first_name' => $firstNamePayload,
                'job_title' => $jobTitle,
                'pay_rate' => $payRate,
                'username' => $userCreated ? $username : '',
                'temp_password' => $userCreated ? $tempPassword : '',
            ]);
        }
    }

    $conn->commit();
    echo json_encode(['success' => true, 'message' => 'Offer initiated.', 'staff_id' => $staffId, 'user_created' => $userCreated, 'staff_created' => $staffCreated]);
} catch (Throwable $e) {
    if ($conn) { @$conn->rollback(); }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();



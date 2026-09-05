<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mailer.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$authUser = requireUser();
$role = isset($authUser['role']) ? strtolower((string)$authUser['role']) : 'staff';
if ($role !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) $payload = $_POST;

$username = isset($payload['username']) ? trim((string)$payload['username']) : '';
$password = isset($payload['password']) ? (string)$payload['password'] : '';
$emailRaw = isset($payload['email']) ? trim((string)$payload['email']) : '';
$roleInput = isset($payload['role']) ? strtolower(trim((string)$payload['role'])) : 'staff';
$isActive = isset($payload['is_active']) ? (int)!!$payload['is_active'] : 1;

if ($username === '' || strlen($username) < 3 || strlen($username) > 50) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Username must be between 3 and 50 characters.']);
    exit;
}

if ($password === '' || strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters.']);
    exit;
}

$allowedRoles = ['admin', 'hr', 'staff', 'viewer'];
if (!in_array($roleInput, $allowedRoles, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid role specified.']);
    exit;
}

$email = $emailRaw !== '' ? $emailRaw : null;
if ($email !== null && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email address.']);
    exit;
}

$conn = getDBConnection();

try {
    if ($email !== null) {
        $dup = $conn->prepare("SELECT id FROM Users WHERE username = ? OR email = ? LIMIT 1");
        if (!$dup) throw new Exception("SQL prepare failed: " . $conn->error);
        $dup->bind_param("ss", $username, $email);
    } else {
        $dup = $conn->prepare("SELECT id FROM Users WHERE username = ? LIMIT 1");
        if (!$dup) throw new Exception("SQL prepare failed: " . $conn->error);
        $dup->bind_param("s", $username);
    }

    $dup->execute();
    $dupResult = $dup->get_result();
    if ($dupResult && $dupResult->fetch_assoc()) {
        $dup->close();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Username or email already exists.']);
        exit;
    }
    $dup->close();

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $createdById = isset($authUser['id']) ? (int)$authUser['id'] : null;

    $stmt = $conn->prepare("
        INSERT INTO Users (username, password_hash, email, role, is_active, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    if (!$stmt) throw new Exception("SQL prepare failed: " . $conn->error);

    $stmt->bind_param(
        "ssssii",
        $username,
        $passwordHash,
        $email,
        $roleInput,
        $isActive,
        $createdById
    );

    if (!$stmt->execute()) {
        throw new Exception("User insert failed: " . $stmt->error);
    }
    $newUserId = $stmt->insert_id;
    $stmt->close();

    echo json_encode([
        'success' => true,
        'message' => 'User created successfully.',
        'user' => [
            'id' => $newUserId,
            'username' => $username,
            'email' => $email,
            'role' => $roleInput,
            'is_active' => $isActive,
            'created_by' => $createdById
        ]
    ]);

    if (!empty($email)) {
        $subject = "Your account info to get set up in Maha Launchpad";
        $loginUrl = "https://mahaverse.mahabehavioralhealth.com/launchpad/login?view=forgotPassword";
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
                .cta { display: inline-block; margin-top: 12px; padding: 10px 16px; background: #0d9488; color: white; text-decoration: none; border-radius: 6px; }
                .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
                .warning { color: #dc2626; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <img src='https://www.mahabehavioralhealth.com/images/mahalogo_v1_small.jpg' alt='Maha Launchpad Logo' class='logo' />
                    <h1 style='margin: 0 0 10px 0;'>Maha Launchpad</h1>
                    <p style='margin: 0;'>Welcome to Maha Behavioral Health Services, LLC</p>
                </div>
                <div class='content'>
                    <p>Hello,</p>
                    <p>You're invited to use Maha Launchpad for Maha Behavioral Health Services, LLC.</p>
                    <p>Here you can:</p>
                    <div class='features'>
                        <ul>
                            <li>Manage your Personal information</li>
                            <li>Professional information and certificates related to your profession</li>
                            <li>Bank info</li>
                            <li>Maha Policies agreements for Confidentiality & HIPAA Agreement, Child Abuse & Neglect Reporting</li>
                        </ul>
                    </div>
                    <div class='credentials'>
                        <div class='label'>Email</div>
                        <div class='value'>" . htmlspecialchars($email, ENT_QUOTES, 'UTF-8') . "</div>
                        <div class='label' style='margin-top: 12px;'>Temporary Password</div>
                        <div class='value'>" . htmlspecialchars($password, ENT_QUOTES, 'UTF-8') . "</div>
                    </div>
                    <p class='warning'>Sign in with this email and temporary password. For security, please change your password after your first login.</p>
                    <a class='cta' href='" . $loginUrl . "'>Reset Password</a>
                </div>
                <div class='footer'>
                    <p>This is an automated message from Maha Launchpad Employee Onboarding Application.</p>
                    <p>Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        ";

        $mailSent = sendMail($email, $subject, $message);
        if (!$mailSent) {
            error_log("Failed to send new user email to: " . $email);
        }
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
} finally {
    $conn->close();
}
?>


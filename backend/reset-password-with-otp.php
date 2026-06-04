<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Accept');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$host   = 'db5018266079.hosting-data.io';
$user   = 'dbu3321929';
$pass   = 'M@h@B3h@v1or@lH3@lth4@ut1sm';
$dbname = 'dbs14484433';

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB connection failed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
    exit;
}

$email = isset($data['email']) ? trim((string) $data['email']) : '';
$new_password = $data['new_password'] ?? $data['newPassword'] ?? '';

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Valid email is required']);
    exit;
}

if ($new_password === '' || !is_string($new_password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email and new password required']);
    exit;
}

if (strlen($new_password) < 6) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters']);
    exit;
}

$checkOtp = $conn->prepare(
    'SELECT 1 FROM password_resets WHERE email = ? AND COALESCE(is_verified, 0) = 1 LIMIT 1'
);
if (!$checkOtp) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    exit;
}
$checkOtp->bind_param('s', $email);
$checkOtp->execute();
$otpOk = $checkOtp->get_result()->num_rows > 0;
$checkOtp->close();

if (!$otpOk) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'OTP not verified. Please verify your code before setting a new password.',
    ]);
    exit;
}

$new_hash = password_hash($new_password, PASSWORD_DEFAULT);

$upd = $conn->prepare('UPDATE users SET password = ? WHERE LOWER(TRIM(email)) = LOWER(?)');
if (!$upd) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Prepare failed: ' . $conn->error]);
    exit;
}

$upd->bind_param('ss', $new_hash, $email);
$upd->execute();

if ($upd->affected_rows > 0) {
    $del = $conn->prepare('DELETE FROM password_resets WHERE email = ?');
    if ($del) {
        $del->bind_param('s', $email);
        $del->execute();
        $del->close();
    }

    echo json_encode([
        'success' => true,
        'message' => 'Password updated successfully',
    ]);
} else {
    $check = $conn->prepare('SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(?) LIMIT 1');
    $check->bind_param('s', $email);
    $check->execute();
    $found = $check->get_result()->num_rows > 0;
    $check->close();

    http_response_code($found ? 400 : 404);
    echo json_encode([
        'success' => false,
        'message' => $found
            ? 'Password could not be updated (try a different password)'
            : 'No user found with this email',
    ]);
}

$upd->close();
$conn->close();

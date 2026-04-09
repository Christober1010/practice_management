<?php
// verify-otp.php
// Purpose: Verify an emailed OTP for a given email against a hashed OTP with expiry.
// Response: JSON { success: bool, message?: string, error?: string }

require_once 'config.php';

$conn = getDBConnection();

// Parse JSON
$raw = file_get_contents('php://input');
if ($raw === false) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Bad request body']);
    exit;
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

$email = isset($data['email']) ? trim($data['email']) : '';
$otp   = isset($data['otp']) ? trim($data['otp']) : '';

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Valid email is required']);
    exit;
}

if ($otp === '' || !preg_match('/^\d{4,8}$/', $otp)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid One-Time-Code format']);
    exit;
}

// Fetch OTP row
$sql = "SELECT otp_hash, expires_at, attempts, COALESCE(is_verified, 0) AS is_verified
        FROM password_resets
        WHERE email = ?
        LIMIT 1";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
    exit;
}

$stmt->bind_param("s", $email);
if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
    exit;
}

$result = $stmt->get_result();
if ($result->num_rows === 0) {
    $stmt->close();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid or expired One-Time-Code']);
    exit;
}

$row = $result->fetch_assoc();
$stmt->close();

$otp_hash   = $row['otp_hash'] ?? '';
$expires_at = $row['expires_at'] ?? null;
$attempts   = (int)($row['attempts'] ?? 0);
$is_verified = (int)($row['is_verified'] ?? 0);

if ($is_verified === 1) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'One-Time-Code already verified']);
    exit;
}

// Enforce expiry
$now = new DateTime('now');
try {
    $exp = new DateTime($expires_at);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid or expired One-Time-Code']);
    exit;
}

if ($now >= $exp) {
    // Delete expired record
    $del = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
    if ($del) {
        $del->bind_param("s", $email);
        $del->execute();
        $del->close();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid or expired One-Time-Code']);
    exit;
}

// Cap attempts (e.g., 5)
$max_attempts = 5;
if ($attempts >= $max_attempts) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Too many attempts. Please request a new One-Time-Code.']);
    exit;
}

// Verify OTP against hash
$ok = password_verify($otp, $otp_hash);
if (!$ok) {
    // Increment attempts on failure
    $upd = $conn->prepare("UPDATE password_resets SET attempts = attempts + 1 WHERE email = ?");
    if ($upd) {
        $upd->bind_param("s", $email);
        $upd->execute();
        $upd->close();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid One-Time-Code']);
    exit;
}

// Success: mark as verified and reset attempts
$upd2 = $conn->prepare("UPDATE password_resets SET is_verified = 1, attempts = 0 WHERE email = ?");
if (!$upd2) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
    exit;
}

$upd2->bind_param("s", $email);
if (!$upd2->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
    exit;
}

$upd2->close();
$conn->close();

echo json_encode([
    'success' => true,
    'message' => 'One-Time-Code verified. You can now reset your password.'
]);
?>


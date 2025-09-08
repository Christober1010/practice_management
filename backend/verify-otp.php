<?php
// verify-otp.php
// Purpose: Verify an emailed OTP for a given email against a hashed OTP with expiry.
// Response: JSON { success: bool, message?: string, error?: string }

// ---- CORS (adjust allowed origins) ----
$allowed_origins = [
    'http://localhost:3000',
    'http://mahaverse.dev.mahabehavioralhealth.com/', // change to your real domain
    'http://mahaverse.mahabehavioralhealth.com/', // TODO: replace with your Next.js domain
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Vary: Origin");
    // If using cookies or Authorization headers with credentials:
    // header("Access-Control-Allow-Credentials: true");
} else {
    header("Vary: Origin");
}

header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Max-Age: 86400");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header("Content-Type: application/json");

// ---- TEMP DEBUG (remove in production) ----
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);

// ---- DB connection (mysqli) ----
$host = "db5018266079.hosting-data.io";
$dbname = "dbs14484433";
$user = "dbu3321929";
$pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";                    // TODO: use your DB name

$conn = @new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB connect failed']);
    exit;
}

// ---- Helpers ----
function json_fail(int $code, string $msg)
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

// ---- Parse JSON ----
$raw = file_get_contents('php://input');
if ($raw === false) {
    json_fail(400, 'Bad request body');
}
$data = json_decode($raw, true);
if (!is_array($data)) {
    json_fail(400, 'Invalid JSON');
}

$email = isset($data['email']) ? trim($data['email']) : '';
$otp   = isset($data['otp']) ? trim($data['otp']) : '';

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_fail(400, 'Valid email is required');
}
if ($otp === '' || !preg_match('/^\d{4,8}$/', $otp)) {
    // Accept 6-digit default; adjust pattern if you send a different length
    json_fail(400, 'Invalid OTP format');
}

// ---- Fetch OTP row (must not be expired; not yet verified; limit attempts) ----
$sql = "SELECT otp_hash, expires_at, attempts, COALESCE(is_verified, 0) AS is_verified
        FROM password_resets
        WHERE email = ?
        LIMIT 1";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    json_fail(500, 'Prepare failed: ' . $conn->error);
}
$stmt->bind_param("s", $email);
if (!$stmt->execute()) {
    json_fail(500, 'Execute failed: ' . $stmt->error);
}
$result = $stmt->get_result();
if ($result->num_rows === 0) {
    json_fail(400, 'Invalid or expired OTP');
}
$row = $result->fetch_assoc();
$stmt->close();

$otp_hash   = $row['otp_hash'] ?? '';
$expires_at = $row['expires_at'] ?? null;
$attempts   = (int)($row['attempts'] ?? 0);
$is_verified = (int)($row['is_verified'] ?? 0);

if ($is_verified === 1) {
    json_fail(400, 'OTP already verified');
}

// Enforce expiry
$now = new DateTimeImmutable('now');
try {
    $exp = new DateTimeImmutable($expires_at);
} catch (Throwable $t) {
    json_fail(400, 'Invalid or expired OTP');
}
if ($now >= $exp) {
    // Optionally delete expired record
    $del = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
    if ($del) {
        $del->bind_param("s", $email);
        $del->execute();
        $del->close();
    }
    json_fail(400, 'Invalid or expired OTP');
}

// Optional: cap attempts (e.g., 5)
$max_attempts = 5;
if ($attempts >= $max_attempts) {
    json_fail(400, 'Too many attempts. Please request a new OTP.');
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
    json_fail(400, 'Invalid OTP');
}

// Success: mark as verified and reset attempts
$upd2 = $conn->prepare("UPDATE password_resets SET is_verified = 1, attempts = 0 WHERE email = ?");
if (!$upd2) {
    json_fail(500, 'Update failed: ' . $conn->error);
}
$upd2->bind_param("s", $email);
if (!$upd2->execute()) {
    json_fail(500, 'Update execute failed: ' . $upd2->error);
}
$upd2->close();

// Optionally, issue a short-lived continuation token instead of relying on is_verified.
// For simplicity, we rely on is_verified here and require it in reset-password.php.

echo json_encode([
    'success' => true,
    'message' => 'OTP verified. You can now reset your password.'
]);
$conn->close();

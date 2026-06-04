<?php
// send-otp.php (safe version with fallbacks)
// Generates a 6-digit OTP, stores hashed copy, emails OTP, always returns JSON.

// ---- DEBUG (remove in prod) ----
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// ---- CORS (public endpoint) ----
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Accept');
header('Access-Control-Max-Age: 86400');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

header("Content-Type: application/json");

// ---- DB CONFIG ----
$host = "db5018419668.hosting-data.io";
$user = "dbu1183438";
$pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$dbname = "dbs14649042";

// ---- Connect ----
$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => "DB connection failed"]);
  exit;
}

// ---- Parse input ----
$body = json_decode(file_get_contents("php://input"), true);
$email = isset($body['email']) ? trim($body['email']) : '';
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(["success" => false, "error" => "Valid email is required"]);
  $conn->close();
  exit;
}

// ---- Check if user exists (neutral reply if not) ----
$exists = false;
if ($stmt = $conn->prepare("SELECT 1 FROM users WHERE email = ? LIMIT 1")) {
  $stmt->bind_param("s", $email);
  $stmt->execute();
  $stmt->store_result();
  $exists = $stmt->num_rows > 0;
  $stmt->close();
}

if ($exists) {
  // --- Generate OTP safely ---
  if (function_exists('random_int')) {
    $otp = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
  } else {
    $otp = str_pad((string)mt_rand(0, 999999), 6, '0', STR_PAD_LEFT);
  }

  // --- Hash OTP ---
  if (defined('PASSWORD_BCRYPT')) {
    $otp_hash = password_hash($otp, PASSWORD_BCRYPT);
  } else {
    $otp_hash = md5($otp); // fallback only if bcrypt missing
  }

  // --- Expiry time ---
  $expires_at = date("Y-m-d H:i:s", time() + 600); // 10 min from now

  // --- Insert / update DB ---
  if ($stmt = $conn->prepare("
    INSERT INTO password_resets (email, otp_hash, expires_at)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE otp_hash = VALUES(otp_hash), expires_at = VALUES(expires_at)
  ")) {
    $stmt->bind_param("sss", $email, $otp_hash, $expires_at);
    $stmt->execute();
    $stmt->close();
  } else {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "DB insert failed"]);
    $conn->close();
    exit;
  }

  // --- Send email (safe) ---
  $subject = "Your Mahaverse password reset OTP";
  $from = "no-reply@mahabehavioralhealth.com";
  $headers  = "MIME-Version: 1.0\r\n";
  $headers .= "Content-type: text/html; charset=UTF-8\r\n";
  $headers .= "From: {$from}\r\n";

  $year = date("Y");
  $html = "
    <div style='font-family: sans-serif; background-color: #f9fafb; padding: 30px;'>
      <div style='max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; padding: 20px; box-shadow: 0 0 15px rgba(0,0,0,0.05);'>
        <h2 style='color: #3b82f6; margin: 0 0 10px;'>Password Reset OTP</h2>
        <p>Your one-time password (OTP) is:</p>
        <p style='font-size:22px;font-weight:700;letter-spacing:2px;margin:12px 0'>{$otp}</p>
        <p>This code is valid for 10 minutes; do not share it with anyone.</p>
        <p style='font-size:12px;color:#6b7280;margin-top:24px;'>© {$year} Maha Behavioral Health. All rights reserved.</p>
      </div>
    </div>
  ";

  // Suppress mail errors but log if possible
  $sent = @mail($email, $subject, $html, $headers);
  if (!$sent) {
    // not fatal, just warn
    error_log("send-otp.php: mail() failed for $email");
  }
}

// ---- Always return neutral response ----
echo json_encode(["success" => true, "message" => "If the email exists, an OTP has been sent."]);
$conn->close();

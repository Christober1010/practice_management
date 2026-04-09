<?php
require_once 'config.php';

// Get JSON payload
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['email']) || !isset($data['new_password'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Email and new password required"]);
    exit;
}

$email        = trim($data['email']); 
$new_password = $data['new_password'];

// Validate email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid email format"]);
    exit;
}

// Validate password strength
if (strlen($new_password) < 6) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Password must be at least 6 characters"]);
    exit;
}

$conn = getDBConnection();

// Check if OTP is verified
$checkOtp = $conn->prepare("SELECT is_verified FROM password_resets WHERE email = ? AND is_verified = 1 LIMIT 1");
if (!$checkOtp) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Database error"]);
    exit;
}

$checkOtp->bind_param("s", $email);
$checkOtp->execute();
$otpResult = $checkOtp->get_result();

if ($otpResult->num_rows === 0) {
    $checkOtp->close();
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "One-Time-Code not verified. Please verify One-Time-Code first."]);
    exit;
}

$checkOtp->close();

// Hash password
$new_hash = password_hash($new_password, PASSWORD_DEFAULT);

// Update users table
$upd = $conn->prepare("UPDATE Users SET password_hash = ? WHERE email = ?");
if (!$upd) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Database error: " . $conn->error]);
    exit;
}

$upd->bind_param("ss", $new_hash, $email);
$upd->execute();

if ($upd->affected_rows > 0) {
    // Delete OTP record once password is updated
    $del = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
    if ($del) {
        $del->bind_param("s", $email);
        $del->execute();
        $del->close();
    }

    echo json_encode([
        "success" => true,
        "message" => "Password updated successfully"
    ]);
} else {
    // Check if user exists
    $check = $conn->prepare("SELECT email FROM Users WHERE email = ?");
    $check->bind_param("s", $email);
    $check->execute();
    $res = $check->get_result();

    if ($res->num_rows === 0) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "error" => "No user found with this email"
        ]);
    } else {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error" => "Password update failed"
        ]);
    }
    $check->close();
}

$upd->close();
$conn->close();
?>


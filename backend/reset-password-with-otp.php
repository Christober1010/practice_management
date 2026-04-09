<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST");
header("Content-Type: application/json");

// ====== DB CONFIG (replace with your actual credentials) ======
$host   = "db5018266079.hosting-data.io"; 
$user   = "dbu3321929";
$pass   = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$dbname = "dbs14484433";

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    die(json_encode([
        "success" => false,
        "message" => "DB connection failed: " . $conn->connect_error
    ]));
}
// ===============================================================

// Get JSON payload
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['email']) || !isset($data['new_password'])) {
    echo json_encode(["success" => false, "message" => "Email and new password required"]);
    exit;
}

$email        = trim($data['email']); 
$new_password = $data['new_password'];

// Hash password
$new_hash = password_hash($new_password, PASSWORD_DEFAULT);

// Update users table
$upd = $conn->prepare("UPDATE users SET PASSWORD = ? WHERE email = ?");
if (!$upd) {
    echo json_encode(["success" => false, "message" => "Prepare failed: " . $conn->error]);
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
        "message" => "Password updated successfully and OTP cleared"
    ]);
} else {
    // Debugging info
    $check = $conn->prepare("SELECT email FROM users WHERE email = ?");
    $check->bind_param("s", $email);
    $check->execute();
    $res = $check->get_result();

    if ($res->num_rows === 0) {
        echo json_encode([
            "success" => false,
            "message" => "No user found with this email",
            "debug_email" => $email
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "User found but password not updated (maybe same hash as before)"
        ]);
    }
    $check->close();
}

$upd->close();
$conn->close();
?>

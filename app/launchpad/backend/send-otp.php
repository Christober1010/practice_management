<?php
require_once 'config.php';
require_once __DIR__ . '/mailer.php';

// Get JSON payload
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['email']) || empty(trim($data['email']))) {
    echo json_encode(["success" => false, "error" => "Email is required"]);
    exit;
}

$email = trim($data['email']);

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["success" => false, "error" => "Invalid email format"]);
    exit;
}

$conn = getDBConnection();

// Check if user exists
$stmt = $conn->prepare("SELECT id, email FROM Users WHERE email = ? AND is_active = 1 LIMIT 1");
if (!$stmt) {
    echo json_encode(["success" => false, "error" => "Database error: " . $conn->error]);
    exit;
}

$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    $stmt->close();
    // Don't reveal if email exists for security
    echo json_encode([
        "success" => true,
        "message" => "If the email exists, a One-Time-Code has been sent."
    ]);
    exit;
}

$stmt->close();

// Generate 6-digit OTP
$otp = str_pad((string)rand(100000, 999999), 6, '0', STR_PAD_LEFT);
$otp_hash = password_hash($otp, PASSWORD_DEFAULT);
$expires_at = date('Y-m-d H:i:s', strtotime('+10 minutes'));

// Delete any existing OTPs for this email
$del = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
if ($del) {
    $del->bind_param("s", $email);
    $del->execute();
    $del->close();
}

// Insert new OTP
$ins = $conn->prepare("INSERT INTO password_resets (email, otp_hash, expires_at, attempts, is_verified) VALUES (?, ?, ?, 0, 0)");
if (!$ins) {
    echo json_encode(["success" => false, "error" => "Database error: " . $conn->error]);
    exit;
}

$ins->bind_param("sss", $email, $otp_hash, $expires_at);
if ($ins->execute()) {
    // Send email with OTP
    $subject = "Password Reset One-Time-Code - Maha Launchpad";
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
            .otp-box { background-color: white; border: 2px solid #0d9488; border-radius: 5px; padding: 20px; text-align: center; margin: 20px 0; }
            .otp-code { font-size: 32px; font-weight: bold; color: #0d9488; letter-spacing: 5px; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            .warning { color: #dc2626; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <img src='https://www.mahabehavioralhealth.com/images/mahalogo_v1_small.jpg' alt='Maha Launchpad Logo' class='logo' />
                <h1 style='margin: 0 0 10px 0;'>Maha Launchpad</h1>
                <p style='margin: 0;'>Password Reset Request</p>                                                      
            </div>
            <div class='content'>
                <p>Hello,</p>
                <p>You have requested to reset your password. Use the following One-Time-Code to complete the reset process:</p>
                <div class='otp-box'>
                    <p style='margin: 0 0 10px 0; color: #6b7280;'>Your One-Time-Code:</p>
                    <div class='One-Time-Code'>" . $otp . "</div>
                </div>
                <p class='warning'>This One-Time-Code will expire in 10 minutes.</p>
                <p>If you did not request this password reset, please ignore this email or contact support if you have concerns.</p>
                <p>For security reasons, do not share this One-Time-Code with anyone.</p>
            </div>
            <div class='footer'>
                <p>This is an automated message from Maha Launchpad Employee Onboarding Application.</p>
                <p>Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    ";
    
    // Send email (centralized helper handles SMTP / headers)
    $mailSent = sendMail($email, $subject, $message);
    
    if ($mailSent) {
        echo json_encode([
            "success" => true,
            "message" => "One-Time-Code sent to your email. It will expire in 10 minutes."
        ]);
    } else {
        // Email sending failed, but OTP is saved in database
        // You might want to log this error
        error_log("Failed to send One-Time-Code email to: " . $email);
        
        // For development/testing, you might want to return the OTP
        // Remove this in production!
        echo json_encode([
            "success" => true,
            "message" => "One-Time-Code generated. Check your email (if email sending is configured).",
            "debug_otp" => $otp // Remove this line in production
        ]);
    }
} else {
    echo json_encode(["success" => false, "error" => "Failed to generate One-Time-Code"]);
}

$ins->close();
$conn->close();
?>


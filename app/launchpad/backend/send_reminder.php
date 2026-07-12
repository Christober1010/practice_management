<?php
require_once 'config.php';
require_once __DIR__ . '/mailer.php';

// Get JSON payload
$data = json_decode(file_get_contents("php://input"), true);

// Require authentication
$currentUser = requireUser();

// Check if user is admin
$role = strtolower(trim($currentUser['role'] ?? ''));
if ($role !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Only administrators can send reminder emails']);
    exit;
}

// Check if staff_id is provided
if (!isset($data['staff_id']) || empty($data['staff_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Staff ID is required']);
    exit;
}

$staffId = (int)$data['staff_id'];

// Get database connection
$conn = getDBConnection();

// Fetch staff information
$stmt = $conn->prepare("
    SELECT 
        s.staff_id,
        s.first_name,
        s.middle_name,
        s.last_name,
        s.email,
        s.job_title,
        oi.initiated_at AS offer_initiated_at,
        oa.accepted_at AS offer_accepted_at
    FROM Staff s
    LEFT JOIN StaffOfferInitiations oi ON oi.staff_id = s.staff_id
    LEFT JOIN StaffOfferAcceptances oa ON oa.staff_id = s.staff_id
    WHERE s.staff_id = ?
    LIMIT 1
");

if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $conn->error]);
    exit;
}

$stmt->bind_param("i", $staffId);
$stmt->execute();
$result = $stmt->get_result();
$staff = $result->fetch_assoc();
$stmt->close();

if (!$staff) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Staff member not found']);
    exit;
}

// Check if staff has an email
if (empty($staff['email']) || !filter_var($staff['email'], FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Staff member does not have a valid email address']);
    exit;
}

// Prepare staff information for email
$fullName = trim(($staff['first_name'] ?? '') . ' ' . ($staff['middle_name'] ?? '') . ' ' . ($staff['last_name'] ?? ''));
$firstName = $staff['first_name'] ?? 'there';
$email = trim($staff['email']);
$jobTitle = htmlspecialchars($staff['job_title'] ?? 'your position', ENT_QUOTES, 'UTF-8');
$baseUrl = "https://mahaverse.mahabehavioralhealth.com";
$loginUrl = $baseUrl . "/launchpad/login";
$offerUrl = $baseUrl . "/launchpad/login?redirect=" . urlencode("/launchpad/form/?view=offer-letter");
$dashboardUrl = $baseUrl . "/launchpad/login?redirect=" . urlencode("/launchpad/form/?view=dashboard");

// Determine reminder message based on offer status
$offerInitiated = !empty($staff['offer_initiated_at']);
$offerAccepted = !empty($staff['offer_accepted_at']);

if ($offerAccepted) {
    $subject = "Reminder: Complete Your Onboarding - Maha Behavioral Health Services";
    $reminderMessage = "
        <p>This is a friendly reminder to complete any remaining onboarding tasks in your Maha Launchpad account.</p>
        <p>Your offer has been accepted. Please ensure all required forms and documents are submitted.</p>
        <a class='cta' href='{$dashboardUrl}'>Access Your Dashboard</a>
    ";
} elseif ($offerInitiated) {
    $subject = "Reminder: Accept Your Offer - Maha Behavioral Health Services";
    $reminderMessage = "
        <p>This is a friendly reminder that you have a pending job offer from Maha Behavioral Health Services.</p>
        <p>We are pleased to formally offer you the position of &quot;{$jobTitle}&quot; on a part-time basis.</p>
        <p>Please review and accept your offer letter at your earliest convenience.</p>
        <a class='cta' href='{$offerUrl}'>View and Accept Your Offer</a>
    ";
} else {
    $subject = "Reminder: Complete Your Onboarding - Maha Behavioral Health Services";
    $reminderMessage = "
        <p>This is a friendly reminder to complete your onboarding process with Maha Behavioral Health Services.</p>
        <p>Please log in to your Maha Launchpad account to complete any pending tasks.</p>
        <a class='cta' href='{$dashboardUrl}'>Access Your Dashboard</a>
    ";
}

// Build email HTML
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
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <img src='https://www.mahabehavioralhealth.com/images/mahalogo_v1_small.jpg' alt='Maha Launchpad Logo' class='logo' />
                <h1 style='margin: 0 0 10px 0;'>Maha Launchpad</h1>
                <p style='margin: 0;'>Reminder</p>
            </div>
            <div class='content'>
                <p>Dear {$firstName},</p>
                {$reminderMessage}
                <p>Should you have any questions or require further clarification, please contact us at <a href='mailto:info@mahabehavioralhealth.com'>info@mahabehavioralhealth.com</a>.</p>
            </div>
            <div class='footer'>
                <p>This is an automated message from Maha Launchpad.</p>
                <p>Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
";

// Send email
$mailSent = sendMail($email, $subject, $message);

if ($mailSent) {
    echo json_encode([
        'success' => true,
        'message' => 'Reminder email sent successfully'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to send reminder email'
    ]);
}

$conn->close();
?>


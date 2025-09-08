<?php
// =======
// SESSION MANAGEMENT API - CRUD + Email Notifications
// =======

// CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400"); // Cache preflight response for 24 hours
header("Content-Type: application/json; charset=UTF-8");

// Enable error reporting
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Log request headers for debugging
$headers = getallheaders();
file_put_contents('debug.log', "Request Method: {$_SERVER['REQUEST_METHOD']}\nRequest Headers: " . print_r($headers, true) . "\n", FILE_APPEND);

// Handle OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    file_put_contents('debug.log', "OPTIONS request handled\n", FILE_APPEND);
    exit();
}

// DB Connection
$host = "db5018419668.hosting-data.io";
$username = "dbu1183438";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14649042";

$conn = new mysqli($host, $username, $password, $database);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit();
}

// Convert datetime-local to MySQL datetime
function convertToMySQLDateTime($datetime) {
    if (empty($datetime)) return null;
    if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $datetime)) $datetime .= ':00';
    return str_replace('T', ' ', $datetime);
}

// Generate ICS file content
function generateICS($clientName, $providerName, $startMySQL, $endMySQL, $locationAddress, $quickNote, $startTz) {
    $dtstart = date('Ymd\THis', strtotime($startMySQL));
    $dtend = date('Ymd\THis', strtotime($endMySQL));
    $uid = uniqid() . '@mahabehavioralhealth.com';
    $summary = "Session with $providerName";
    $description = "Session Details\\nClient: $clientName\\nProvider: $providerName\\nNotes: $quickNote";
    $location = $locationAddress ?? 'Maha Behavioral Health Clinic';

    $ics = "BEGIN:VCALENDAR\r\n";
    $ics .= "VERSION:2.0\r\n";
    $ics .= "PRODID:-//Maha Behavioral Health//Session Calendar//EN\r\n";
    $ics .= "BEGIN:VEVENT\r\n";
    $ics .= "UID:$uid\r\n";
    $ics .= "DTSTART:$dtstart\r\n";
    $ics .= "DTEND:$dtend\r\n";
    $ics .= "SUMMARY:$summary\r\n";
    $ics .= "DESCRIPTION:$description\r\n";
    $ics .= "LOCATION:$location\r\n";
    $ics .= "END:VEVENT\r\n";
    $ics .= "END:VCALENDAR\r\n";

    return $ics;
}

// Send email helper with styled HTML and ICS attachment
function sendEmail($toEmail, $toName, $subject, $body, $icsContent = null) {
    $boundary = uniqid('boundary_');
    
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "From: Maha Behavioral Health <admin@mahabehavioralhealth.com>\r\n";
    $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";

    // Styled HTML email body
    $styledBody = '
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Maha Behavioral Health</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <!-- Header -->
            <div style="background-color: #4a90e2; padding: 20px; text-align: center;">
                <img src="https://www.mahabehavioralhealth.com/images/mahalogo_v1_small.jpg" alt="Mahaverse Logo" style="max-width: 150px; height: auto;">
                <h1 style="color: #ffffff; margin: 10px 0 5px; font-size: 24px;">Mahaverse</h1>
                <p style="color: #ffffff; margin: 0; font-size: 16px;">Shining in Every Shade of the Spectrum</p>
            </div>
            <!-- Content -->
            <div style="padding: 20px; background-color: #f9f9f9;">
                <h2 style="color: #4a90e2; font-size: 20px; margin-top: 0;">New Session Scheduled</h2>
                ' . $body . '
                <p style="margin-top: 20px; font-size: 14px;">Please find the calendar invite attached to add this session to your calendar.</p>
                <p style="font-size: 14px; color: #666;">Thank you for choosing Maha Behavioral Health.</p>
            </div>
            <!-- Footer -->
            <div style="background-color: #4a90e2; padding: 10px; text-align: center; font-size: 12px; color: #ffffff;">
                <p style="margin: 0;">&copy; ' . date('Y') . ' Mahaverse. All rights reserved.</p>
                <p style="margin: 5px 0 0;"><a href="https://www.mahabehavioralhealth.com" style="color: #ffffff; text-decoration: none;">Visit our website</a></p>
            </div>
        </div>
    </body>
    </html>';

    $message = "--$boundary\r\n";
    $message .= "Content-Type: text/html; charset=UTF-8\r\n";
    $message .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
    $message .= $styledBody . "\r\n";

    if ($icsContent) {
        $message .= "--$boundary\r\n";
        $message .= "Content-Type: text/calendar; charset=UTF-8; method=REQUEST\r\n";
        $message .= "Content-Disposition: attachment; filename=\"session.ics\"\r\n";
        $message .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
        $message .= $icsContent . "\r\n";
    }

    $message .= "--$boundary--\r\n";

    $emailSent = mail($toEmail, $subject, $message, $headers);
    file_put_contents('debug.log', "Email to $toEmail: " . ($emailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
    return $emailSent;
}

// Get method and input
$method = $_SERVER['REQUEST_METHOD'];
$rawInput = file_get_contents("php://input");
$input = json_decode($rawInput, true);

// Log raw input and parsed input for debugging
file_put_contents('debug.log', "Raw Input: $rawInput\nParsed Input: " . print_r($input, true) . "\n", FILE_APPEND);

try {
    switch ($method) {

        // CREATE session
        case "POST":
            // Log the input fields check
            file_put_contents('debug.log', "Checking fields: clientId=" . ($input['clientId'] ?? 'missing') . ", provider=" . ($input['provider'] ?? 'missing') . ", providerName=" . ($input['providerName'] ?? 'missing') . ", startDateTime=" . ($input['startDateTime'] ?? 'missing') . ", endDateTime=" . ($input['endDateTime'] ?? 'missing') . "\n", FILE_APPEND);

            if (!isset($input['clientId'], $input['provider'], $input['providerName'], $input['startDateTime'], $input['endDateTime'])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing required fields", "input" => $input]);
                exit();
            }

            $clientId = $input['clientId'];
            $provider = $input['provider'];
            $providerName = $input['providerName'];
            $supervisingProvider = $input['supervisingProvider'] ?? null;
            $supervisingProviderName = $input['supervisingProviderName'] ?? null;
            $recurring = $input['recurring'] ?? 'No';
            $placeOfService = $input['placeOfService'] ?? 'Clinic';
            $status = $input['status'] ?? 'upcoming';
            $startMySQL = convertToMySQLDateTime($input['startDateTime']);
            $endMySQL = convertToMySQLDateTime($input['endDateTime']);
            $startTz = $input['startTZ'] ?? null;
            $endTz = $input['endTZ'] ?? null;
            $authCode = $input['authCode'] ?? null;
            $locationAddress = $input['locationAddress'] ?? null;
            $quickNote = $input['quickNote'] ?? null;

            // Insert session
            $stmt = $conn->prepare("INSERT INTO sessions (
                client_id, provider_id, provider_name, supervising_provider_id, supervising_provider_name, 
                start_utc, end_utc, start_tz, end_tz, auth_code, recurring, place_of_service, location_address, quick_note, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param(
                "sssssssssssssss",
                $clientId, $provider, $providerName, $supervisingProvider, $supervisingProviderName,
                $startMySQL, $endMySQL, $startTz, $endTz, $authCode, $recurring, $placeOfService, $locationAddress, $quickNote, $status
            );

            if ($stmt->execute()) {
                $sessionId = $stmt->insert_id;

                // --- EMAIL SECTION ---
                $adminEmail = "christoberedward@gmail.com";
                $adminName = "Admin";

                $clientStmt = $conn->prepare("SELECT email, first_name, last_name FROM clients WHERE client_id = ?");
                $clientStmt->bind_param("s", $clientId);
                $clientStmt->execute();
                $result = $clientStmt->get_result();
                $client = $result->fetch_assoc();
                $clientEmail = $client['email'];
                $clientName = $client['first_name'] . ' ' . $client['last_name'];

                $subject = "New Session Scheduled - Mahaverse";
                $body = '
                <div style="background-color: #ffffff; padding: 15px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <p style="margin: 10px 0;"><strong>Client:</strong> ' . htmlspecialchars($clientName) . '</p>
                    <p style="margin: 10px 0;"><strong>Provider:</strong> ' . htmlspecialchars($providerName) . '</p>
                    <p style="margin: 10px 0;"><strong>Start:</strong> ' . htmlspecialchars($startMySQL) . ' (' . htmlspecialchars($startTz) . ')</p>
                    <p style="margin: 10px 0;"><strong>End:</strong> ' . htmlspecialchars($endMySQL) . ' (' . htmlspecialchars($endTz) . ')</p>
                    <p style="margin: 10px 0;"><strong>Location:</strong> ' . htmlspecialchars($locationAddress ?? 'Not specified') . '</p>
                    <p style="margin: 10px 0;"><strong>Notes:</strong> ' . htmlspecialchars($quickNote ?? 'None') . '</p>
                </div>';

                $icsContent = generateICS($clientName, $providerName, $startMySQL, $endMySQL, $locationAddress, $quickNote, $startTz);

                if ($clientEmail) {
                    $clientEmailSent = sendEmail($clientEmail, $clientName, $subject, $body, $icsContent);
                    file_put_contents('debug.log', "Client Email Sent: " . ($clientEmailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                }
                $adminEmailSent = sendEmail($adminEmail, $adminName, $subject, $body, $icsContent);
                file_put_contents('debug.log', "Admin Email Sent: " . ($adminEmailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);

                echo json_encode(["success" => true, "session_id" => $sessionId]);
            } else {
                http_response_code(500);
                echo json_encode(["error" => "Failed to create session", "details" => $stmt->error]);
            }
            $stmt->close();
            break;

        // READ sessions
        case "GET":
            if (isset($_GET['id'])) {
                $stmt = $conn->prepare("SELECT * FROM sessions WHERE session_id = ?");
                $stmt->bind_param("i", $_GET['id']);
                $stmt->execute();
                $result = $stmt->get_result();
                echo json_encode($result->fetch_assoc());
                $stmt->close();
            } else {
                $result = $conn->query("SELECT * FROM sessions ORDER BY start_utc DESC");
                $rows = [];
                while ($row = $result->fetch_assoc()) $rows[] = $row;
                echo json_encode($rows);
            }
            break;

        // UPDATE session
        case "PUT":
            if (!isset($input['session_id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing session ID"]);
                exit();
            }

            $fields = [];
            $params = [];
            $types = "";

            $map = [
                "clientId" => ["client_id", "s"], "provider" => ["provider_id", "s"], "providerName" => ["provider_name", "s"],
                "supervisingProvider" => ["supervising_provider_id", "s"], "supervisingProviderName" => ["supervising_provider_name", "s"],
                "startTZ" => ["start_tz", "s"], "endTZ" => ["end_tz", "s"], "authCode" => ["auth_code", "s"],
                "recurring" => ["recurring", "s"], "placeOfService" => ["place_of_service", "s"],
                "locationAddress" => ["location_address", "s"], "quickNote" => ["quick_note", "s"], "status" => ["status", "s"]
            ];

            foreach ($map as $key => [$col, $t]) {
                if (array_key_exists($key, $input)) {
                    $fields[] = "$col=?";
                    $types .= $t;
                    $params[] = $input[$key] == "" ? null : $input[$key];
                }
            }

            if (isset($input['startDateTime'])) {
                $fields[] = "start_utc=?";
                $types .= "s";
                $params[] = convertToMySQLDateTime($input['startDateTime']);
            }
            if (isset($input['endDateTime'])) {
                $fields[] = "end_utc=?";
                $types .= "s";
                $params[] = convertToMySQLDateTime($input['endDateTime']);
            }

            if (empty($fields)) {
                http_response_code(400);
                echo json_encode(["error" => "No fields to update"]);
                exit();
            }

            $fieldsSql = implode(", ", $fields);
            $sql = "UPDATE sessions SET $fieldsSql WHERE session_id=?";
            $stmt = $conn->prepare($sql);
            $types .= "i";
            $params[] = $input['session_id'];
            $stmt->bind_param($types, ...$params);

            if ($stmt->execute()) {
                echo $stmt->affected_rows > 0
                    ? json_encode(["success" => true, "message" => "Session updated successfully"])
                    : json_encode(["error" => "Session not found or no changes made"]);
            } else {
                http_response_code(500);
                echo json_encode(["error" => "Failed to update session", "details" => $stmt->error]);
            }
            $stmt->close();
            break;

        // DELETE session
        case "DELETE":
            if (!isset($_GET['id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing session ID"]);
                exit();
            }
            $stmt = $conn->prepare("UPDATE sessions SET status='cancelled' WHERE session_id=?");
            $stmt->bind_param("i", $_GET['id']);
            $stmt->execute();
            echo $stmt->affected_rows > 0
                ? json_encode(["success" => true, "message" => "Session cancelled successfully"])
                : json_encode(["error" => "Session not found"]);
            $stmt->close();
            break;

        default:
            http_response_code(405);
            echo json_encode(["error" => "Method not allowed"]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Internal server error", "details" => $e->getMessage()]);
}

$conn->close();
?>
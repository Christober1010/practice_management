<?php
// =======
// SESSION MANAGEMENT API - CRUD + Email Notifications
// =======

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Cache-Control");
header("Access-Control-Max-Age: 86400");
header("Content-Type: application/json; charset=UTF-8");

// Enable error reporting
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Log request headers for debugging
$headers = getallheaders();
file_put_contents('debug.log', "Request Method: {$_SERVER['REQUEST_METHOD']}\nRequest Headers: " . print_r($headers, true) . "\n", FILE_APPEND);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    file_put_contents('debug.log', "OPTIONS request handled\n", FILE_APPEND);
    exit();
}

// DB Connection
$host = "db5018266079.hosting-data.io";
$database = "dbs14484433";
$username = "dbu3321929";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";


$conn = new mysqli($host, $username, $password, $database);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit();
}

// Convert datetime-local to MySQL datetime (keeps the raw value; treat as UTC when stored)
function convertToMySQLDateTime($datetime)
{
    if (empty($datetime)) return null;
    if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $datetime)) $datetime .= ':00';
    return str_replace('T', ' ', $datetime);
}

// Convert a UTC datetime string to a DateTime object in target timezone.
// $utcDateTimeStr is expected to be a string in "YYYY-MM-DD HH:MM:SS" format in UTC.
function convertUtcToTz($utcDateTimeStr, $targetTz)
{
    if (empty($utcDateTimeStr)) return null;
    try {
        $dt = new DateTime($utcDateTimeStr, new DateTimeZone('UTC'));
        if ($targetTz) {
            // Validate timezone; DateTimeZone throws on invalid zone
            $dt->setTimezone(new DateTimeZone($targetTz));
        }
        return $dt;
    } catch (Exception $e) {
        // fallback to UTC DateTime if timezone invalid
        try {
            return new DateTime($utcDateTimeStr, new DateTimeZone('UTC'));
        } catch (Exception $e2) {
            return null;
        }
    }
}

// Escape text for ICS (basic)
function icsEscape($text)
{
    if ($text === null) return '';
    $text = str_replace("\\", "\\\\", $text);
    $text = str_replace("\n", "\\n", $text);
    $text = str_replace(",", "\\,", $text);
    $text = str_replace(";", "\\;", $text);
    return $text;
}

// Generate ICS file content (DTSTART/DTEND set with TZID)
function generateICS($clientName, $providerName, $startUtc, $endUtc, $locationAddress, $quickNote, $startTz)
{
    // Use UTC -> target tz conversion for generating local DTSTART/DTEND
    $tz = $startTz ?: 'UTC';
    $dtStart = convertUtcToTz($startUtc, $tz);
    $dtEnd   = convertUtcToTz($endUtc, $tz);

    if (!$dtStart || !$dtEnd) {
        // fallback to raw UTC formatting if conversion failed
        $dtstart_val = gmdate('Ymd\THis', strtotime($startUtc));
        $dtend_val = gmdate('Ymd\THis', strtotime($endUtc));
        $tz = 'UTC';
    } else {
        $dtstart_val = $dtStart->format('Ymd\THis');
        $dtend_val = $dtEnd->format('Ymd\THis');
    }

    $uid = uniqid() . '@mahabehavioralhealth.com';
    $summary = "Session with " . ($providerName ?: 'Provider');
    $description = "Session Details\nClient: " . ($clientName ?: '') . "\nProvider: " . ($providerName ?: '') . "\nNotes: " . ($quickNote ?: '');
    $location = $locationAddress ?: 'Maha Behavioral Health Clinic';

    // DTSTAMP in UTC
    $dtstamp = gmdate('Ymd\THis\Z');

    // Build ICS text
    $ics  = "BEGIN:VCALENDAR\r\n";
    $ics .= "VERSION:2.0\r\n";
    $ics .= "PRODID:-//Maha Behavioral Health//Session Calendar//EN\r\n";
    $ics .= "METHOD:REQUEST\r\n";
    $ics .= "BEGIN:VEVENT\r\n";
    $ics .= "UID:$uid\r\n";
    $ics .= "DTSTAMP:$dtstamp\r\n";
    $ics .= "DTSTART;TZID={$tz}:{$dtstart_val}\r\n";
    $ics .= "DTEND;TZID={$tz}:{$dtend_val}\r\n";
    $ics .= "SUMMARY:" . icsEscape($summary) . "\r\n";
    $ics .= "DESCRIPTION:" . icsEscape($description) . "\r\n";
    $ics .= "LOCATION:" . icsEscape($location) . "\r\n";
    $ics .= "END:VEVENT\r\n";
    $ics .= "END:VCALENDAR\r\n";

    return $ics;
}

// Send email helper with styled HTML and ICS attachment
function sendEmail($toEmail, $toName, $subject, $body, $icsContent = null)
{
    $boundary = uniqid('boundary_');

    // Build headers
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "From: Maha Behavioral Health <admin@mahabehavioralhealth.com>\r\n";
    $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";

    // Styled HTML email body (no change)
    $styledBody = '
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width-device-width, initial-scale=1.0">
        <title>Maha Behavioral Health</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <!-- Header -->
            <div style="background-color: #4a90e2; padding: 20px; text-align: center;">
                <img src="https://www.mahabehavioralhealth.com/images/mahalogo_v1_small.jpg" alt="Mahaverse Logo" style="max-width: 150px; height: auto;">
                <h1 style="color: #ffffff; margin: 10px 0 5px; font-size: 24px;">' . htmlspecialchars($toName) . '</h1>
                <p style="color: #ffffff; margin: 0; font-size: 16px;">Shining in Every Shade of the Spectrum</p>
            </div>
            <!-- Content -->
            <div style="padding: 20px; background-color: #f9f9f9;">
                <h2 style="color: #4a90e2; font-size: 20px; margin-top: 0;">Session Update</h2>
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

    // Build multipart message
    $message = "--$boundary\r\n";
    $message .= "Content-Type: text/html; charset=UTF-8\r\n";
    $message .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
    $message .= $styledBody . "\r\n";

    if ($icsContent) {
        // Attach ICS
        $message .= "--$boundary\r\n";
        // Use text/calendar with method=REQUEST to allow calendar clients to accept it as an invite
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

// Get email recipients based on provider type and client preferences
function getEmailRecipients($conn, $clientId, $providerId = null, $supervisingProviderId = null)
{
    file_put_contents('debug.log', "getEmailRecipients called with clientId: $clientId, providerId: $providerId, supervisingProviderId: $supervisingProviderId\n", FILE_APPEND);

    $recipients = [];

    // Get client info including appointment_reminder preference
    $clientStmt = $conn->prepare("SELECT email, first_name, last_name, appointment_reminder FROM clients WHERE client_id = ?");
    $clientStmt->bind_param("s", $clientId);
    $clientStmt->execute();
    $result = $clientStmt->get_result();
    $client = $result->fetch_assoc();
    $clientStmt->close();

    if (!$client) {
        file_put_contents('debug.log', "Client not found for ID: $clientId\n", FILE_APPEND);
        return null;
    }

    $clientName = trim(($client['first_name'] ?? '') . ' ' . ($client['last_name'] ?? ''));
    file_put_contents('debug.log', "Client found: $clientName, appointment_reminder: " . ($client['appointment_reminder'] ?? 'null') . "\n", FILE_APPEND);

    // Add client email if appointment_reminder is not 'none'
    if (strtolower($client['appointment_reminder'] ?? '') !== 'none' && $client['email']) {
        $recipients[] = [
            'email' => $client['email'],
            'name' => $clientName,
            'type' => 'client'
        ];
        file_put_contents('debug.log', "Added client email: {$client['email']}\n", FILE_APPEND);
    } else {
        file_put_contents('debug.log', "Client email skipped - either appointment_reminder is 'none' or no email address\n", FILE_APPEND);
    }

    // Get provider email based on staffType
    if ($providerId) {
        file_put_contents('debug.log', "Looking up provider staffType for ID: $providerId\n", FILE_APPEND);

        // Check staff table for provider info
        $staffStmt = $conn->prepare("SELECT email, staffType, firstName, lastName FROM staff WHERE id = ?");
        $staffStmt->bind_param("s", $providerId);
        $staffStmt->execute();
        $staffResult = $staffStmt->get_result();
        $staffData = $staffResult->fetch_assoc();
        $staffStmt->close();

        if ($staffData) {
            $providerName = trim(($staffData['firstName'] ?? '') . ' ' . ($staffData['lastName'] ?? ''));
            file_put_contents('debug.log', "Staff found: $providerName with staffType: " . ($staffData['staffType'] ?? 'null') . "\n", FILE_APPEND);

            // Check if provider is RBT and we have a supervising provider
            if (strtoupper($staffData['staffType'] ?? '') === 'RBT' && $supervisingProviderId) {
                file_put_contents('debug.log', "RBT detected, looking up supervisor: $supervisingProviderId\n", FILE_APPEND);

                // Get supervisor's email from staff table
                $supervisorStmt = $conn->prepare("SELECT email, firstName, lastName FROM staff WHERE id = ?");
                $supervisorStmt->bind_param("s", $supervisingProviderId);
                $supervisorStmt->execute();
                $supervisorResult = $supervisorStmt->get_result();
                $supervisorData = $supervisorResult->fetch_assoc();
                $supervisorStmt->close();

                if ($supervisorData && $supervisorData['email']) {
                    $supervisorName = trim(($supervisorData['firstName'] ?? '') . ' ' . ($supervisorData['lastName'] ?? ''));
                    $recipients[] = [
                        'email' => $supervisorData['email'],
                        'name' => $supervisorName,
                        'type' => 'supervisor'
                    ];
                    file_put_contents('debug.log', "RBT session detected (Provider: $providerId) - sending email to supervisor: {$supervisorData['email']}\n", FILE_APPEND);
                } else {
                    file_put_contents('debug.log', "RBT session detected but supervisor email not found for supervisor ID: $supervisingProviderId\n", FILE_APPEND);
                }
            } else {
                // Send to provider directly (BCBA, BCaBA, etc.)
                if ($staffData['email']) {
                    $recipients[] = [
                        'email' => $staffData['email'],
                        'name' => $providerName,
                        'type' => 'provider'
                    ];
                    file_put_contents('debug.log', "Provider staffType: " . ($staffData['staffType'] ?? 'unknown') . " - sending to provider email: {$staffData['email']}\n", FILE_APPEND);
                }
            }
        } else {
            file_put_contents('debug.log', "Provider not found in staff table\n", FILE_APPEND);
        }
    }

    return [
        'clientName' => $clientName,
        'recipients' => $recipients
    ];
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
            $recurringData = $input['recurring'] ?? ['frequency' => 'No'];
            $recurringFrequency = $recurringData['frequency'] ?? 'No';
            $recurringDays = null;

            // Store days as comma-separated string for weekly recurring
            if ($recurringFrequency === 'Weekly' && !empty($recurringData['days'])) {
                $recurringDays = implode(',', $recurringData['days']);
            }

            $placeOfService = $input['placeOfService'] ?? 'Clinic';
            $status = $input['status'] ?? 'upcoming';

            // You said your stored values are UTC — keep that behavior.
            $startMySQL = convertToMySQLDateTime($input['startDateTime']); // stored as UTC string
            $endMySQL = convertToMySQLDateTime($input['endDateTime']);     // stored as UTC string

            $startTz = $input['startTZ'] ?? null; // e.g. "America/Chicago"
            $endTz = $input['endTZ'] ?? null;
            $authCode = $input['authCode'] ?? null;
            $locationAddress = $input['locationAddress'] ?? null;
            $quickNote = $input['quickNote'] ?? null;

            $sessionIds = [];
            $sessionsToCreate = [];

            if ($recurringFrequency !== 'No' && $recurringFrequency !== 'Never') {
                // Generate recurring session dates
                $startDate = new DateTime($startMySQL, new DateTimeZone('UTC'));
                $endDate = new DateTime($endMySQL, new DateTimeZone('UTC'));
                $sessionDuration = $endDate->getTimestamp() - $startDate->getTimestamp();

                $currentDate = clone $startDate;
                $endLimit = null;
                $occurrenceCount = 0;
                $maxOccurrences = 100; // Safety limit

                // Determine end condition
                if ($recurringData['ends']['type'] === 'On' && !empty($recurringData['ends']['date'])) {
                    $endLimit = new DateTime($recurringData['ends']['date'] . ' 23:59:59', new DateTimeZone('UTC'));
                } elseif ($recurringData['ends']['type'] === 'After' && !empty($recurringData['ends']['occurrences'])) {
                    $maxOccurrences = intval($recurringData['ends']['occurrences']);
                }

                while ($occurrenceCount < $maxOccurrences) {
                    // Check if we've reached the end date limit
                    if ($endLimit && $currentDate > $endLimit) {
                        break;
                    }

                    $shouldInclude = false;

                    // Check if current date matches the recurring pattern
                    switch ($recurringFrequency) {
                        case 'Daily':
                            $shouldInclude = true;
                            break;

                        case 'Weekly':
                            if (!empty($recurringData['days'])) {
                                $dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                $currentDayName = $dayNames[$currentDate->format('w')];
                                $shouldInclude = in_array($currentDayName, $recurringData['days']);
                            }
                            break;

                        case 'Biweekly':
                            $weeksDiff = floor($currentDate->diff($startDate)->days / 7);
                            $shouldInclude = ($weeksDiff % 2 === 0);
                            break;

                        case 'Monthly':
                            $shouldInclude = ($currentDate->format('j') === $startDate->format('j'));
                            break;
                    }

                    if ($shouldInclude) {
                        $sessionStart = $currentDate->format('Y-m-d H:i:s');
                        $sessionEndTime = clone $currentDate;
                        $sessionEndTime->add(new DateInterval('PT' . $sessionDuration . 'S'));
                        $sessionEnd = $sessionEndTime->format('Y-m-d H:i:s');

                        $sessionsToCreate[] = [
                            'start' => $sessionStart,
                            'end' => $sessionEnd
                        ];

                        $occurrenceCount++;
                    }

                    // Move to next potential date
                    switch ($recurringFrequency) {
                        case 'Daily':
                            $currentDate->add(new DateInterval('P1D'));
                            break;
                        case 'Weekly':
                            $currentDate->add(new DateInterval('P1D'));
                            break;
                        case 'Biweekly':
                            $currentDate->add(new DateInterval('P1D'));
                            break;
                        case 'Monthly':
                            $currentDate->add(new DateInterval('P1M'));
                            break;
                    }
                }
            } else {
                // Single session
                $sessionsToCreate[] = [
                    'start' => $startMySQL,
                    'end' => $endMySQL
                ];
            }

            // Insert all sessions
            $stmt = $conn->prepare("INSERT INTO sessions (
                client_id, provider_id, provider_name, supervising_provider_id, supervising_provider_name, 
                start_utc, end_utc, start_tz, end_tz, auth_code, recurring, recurring_days, place_of_service, location_address, quick_note, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            foreach ($sessionsToCreate as $session) {
                $stmt->bind_param(
                    "ssssssssssssssss",
                    $clientId,
                    $provider,
                    $providerName,
                    $supervisingProvider,
                    $supervisingProviderName,
                    $session['start'],
                    $session['end'],
                    $startTz,
                    $endTz,
                    $authCode,
                    $recurringFrequency,
                    $recurringDays,
                    $placeOfService,
                    $locationAddress,
                    $quickNote,
                    $status
                );

                if ($stmt->execute()) {
                    $sessionIds[] = $stmt->insert_id;
                } else {
                    file_put_contents('debug.log', "Failed to create session: " . $stmt->error . "\n", FILE_APPEND);
                }
            }

            if (!empty($sessionIds)) {
                // --- EMAIL SECTION ---
                $adminEmail = "christoberedward@gmail.com";
                $adminName = "Admin";

                $emailData = getEmailRecipients($conn, $clientId, $provider, $supervisingProvider);

                if (!$emailData) {
                    file_put_contents('debug.log', "Client not found for email notification\n", FILE_APPEND);
                } else {
                    $clientName = $emailData['clientName'];
                    $recipients = $emailData['recipients'];

                    // Convert UTC stored times to client's timezone for display
                    $clientTz = $startTz ?: 'UTC';

                    $localStartDt = convertUtcToTz($startMySQL, $clientTz);
                    $localEndDt   = convertUtcToTz($endMySQL, $clientTz);

                    // Format for email display (human friendly). Fallbacks to raw if conversion failed.
                    if ($localStartDt) {
                        $displayStart = $localStartDt->format('Y-m-d g:i A');
                    } else {
                        $displayStart = $startMySQL;
                    }
                    if ($localEndDt) {
                        $displayEnd = $localEndDt->format('Y-m-d g:i A');
                    } else {
                        $displayEnd = $endMySQL;
                    }

                    if ($recurringFrequency !== 'No' && $recurringFrequency !== 'Never') {
                        $subject = "Recurring Sessions Scheduled - Mahaverse";

                        // Build recurring details
                        $recurringDetails = '<div style="background-color: #e8f4fd; padding: 15px; border-left: 4px solid #4a90e2; margin: 15px 0;">';
                        $recurringDetails .= '<h3 style="color: #4a90e2; margin-top: 0;">Recurring Schedule Details</h3>';
                        $recurringDetails .= '<p><strong>Frequency:</strong> ' . htmlspecialchars($recurringFrequency) . '</p>';

                        if ($recurringFrequency === 'Weekly' && !empty($recurringDays)) {
                            $recurringDetails .= '<p><strong>Days:</strong> ' . htmlspecialchars($recurringDays) . '</p>';
                        }

                        if (isset($recurringData['ends']['type']) && $recurringData['ends']['type'] === 'On' && !empty($recurringData['ends']['date'])) {
                            $recurringDetails .= '<p><strong>Ends:</strong> ' . htmlspecialchars($recurringData['ends']['date']) . '</p>';
                        } elseif (isset($recurringData['ends']['type']) && $recurringData['ends']['type'] === 'After' && !empty($recurringData['ends']['occurrences'])) {
                            $recurringDetails .= '<p><strong>Total Sessions:</strong> ' . htmlspecialchars($recurringData['ends']['occurrences']) . '</p>';
                        }

                        $recurringDetails .= '<p><strong>Sessions Created:</strong> ' . count($sessionIds) . '</p>';
                        $recurringDetails .= '</div>';

                        $body = '
                        <div style="background-color: #ffffff; padding: 15px; border: 1px solid #e0e0e0; border-radius: 5px;">
                            <p style="margin: 10px 0;"><strong>Client:</strong> ' . htmlspecialchars($clientName) . '</p>
                            <p style="margin: 10px 0;"><strong>Provider:</strong> ' . htmlspecialchars($providerName) . '</p>
                            <p style="margin: 10px 0;"><strong>First Session Start:</strong> ' . htmlspecialchars($displayStart) . ' (' . htmlspecialchars($clientTz) . ')</p>
                            <p style="margin: 10px 0;"><strong>Session Duration:</strong> ' . htmlspecialchars($displayEnd) . ' (' . htmlspecialchars($endTz ?: $clientTz) . '</p>
                            <p style="margin: 10px 0;"><strong>Location:</strong> ' . htmlspecialchars($locationAddress ?? 'Not specified') . '</p>
                            <p style="margin: 10px 0;"><strong>Notes:</strong> ' . htmlspecialchars($quickNote ?? 'None') . '</p>
                        </div>' . $recurringDetails;
                    } else {
                        $subject = "ABA Therapy Session Scheduled - Mahaverse";
                        $body = '
                        <div style="background-color: #ffffff; padding: 15px; border: 1px solid #e0e0e0; border-radius: 5px;">
                            <p style="margin: 10px 0;"><strong>Client:</strong> ' . htmlspecialchars($clientName) . '</p>
                            <p style="margin: 10px 0;"><strong>Provider:</strong> ' . htmlspecialchars($providerName) . '</p>
                            <p style="margin: 10px 0;"><strong>Start:</strong> ' . htmlspecialchars($displayStart) . ' (' . htmlspecialchars($clientTz) . ')</p>
                            <p style="margin: 10px 0;"><strong>End:</strong> ' . htmlspecialchars($displayEnd) . ' (' . htmlspecialchars($endTz ?: $clientTz) . ')</p>
                            <p style="margin: 10px 0;"><strong>Location:</strong> ' . htmlspecialchars($locationAddress ?? 'Not specified') . '</p>
                            <p style="margin: 10px 0;"><strong>Notes:</strong> ' . htmlspecialchars($quickNote ?? 'None') . '</p>
                        </div>';
                    }

                    $icsContent = generateICS($clientName, $providerName, $startMySQL, $endMySQL, $locationAddress, $quickNote, $clientTz);

                    // Send emails to all recipients (client, provider/supervisor)
                    foreach ($recipients as $recipient) {
                        $emailSent = sendEmail($recipient['email'], $recipient['name'], $subject, $body, $icsContent);
                        file_put_contents('debug.log', ucfirst($recipient['type']) . " Email Sent to: {$recipient['email']} ({$recipient['name']}) - " . ($emailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                    }

                    // Always send to admin
                    $adminEmailSent = sendEmail($adminEmail, $adminName, $subject, $body, $icsContent);
                    file_put_contents('debug.log', "Admin Email Sent: " . ($adminEmailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                }

                echo json_encode(["success" => true, "session_id" => $sessionIds[0], "sessions_created" => count($sessionIds)]);
            } else {
                http_response_code(500);
                echo json_encode(["error" => "Failed to create sessions"]);
            }
            $stmt->close();
            break;

        // READ sessions
        case "GET":
            if (isset($_GET['id'])) {
                // Get single session by ID
                $stmt = $conn->prepare("
                    SELECT s.*, CONCAT(c.first_name, ' ', c.last_name) AS clientName
                    FROM sessions s
                    LEFT JOIN clients c ON s.client_id = c.client_id
                    WHERE s.session_id = ?
                ");
                $stmt->bind_param("i", $_GET['id']);
                $stmt->execute();
                $result = $stmt->get_result();
                $session = $result->fetch_assoc();
                $stmt->close();

                if ($session) {
                    echo json_encode($session);
                } else {
                    http_response_code(404);
                    echo json_encode(["error" => "Session not found"]);
                }
            } else {
                // Get all sessions with optional filters
                $whereConditions = [];
                $params = [];
                $types = "";

                // Build dynamic WHERE clause based on query parameters
                if (isset($_GET['client_id'])) {
                    $whereConditions[] = "s.client_id = ?";
                    $params[] = $_GET['client_id'];
                    $types .= "s";
                }

                if (isset($_GET['provider_id'])) {
                    $whereConditions[] = "s.provider_id = ?";
                    $params[] = $_GET['provider_id'];
                    $types .= "s";
                }

                if (isset($_GET['status'])) {
                    $whereConditions[] = "s.status = ?";
                    $params[] = $_GET['status'];
                    $types .= "s";
                }

                if (isset($_GET['date'])) {
                    $whereConditions[] = "DATE(s.start_utc) = ?";
                    $params[] = $_GET['date'];
                    $types .= "s";
                }

                if (isset($_GET['start_date']) && isset($_GET['end_date'])) {
                    $whereConditions[] = "DATE(s.start_utc) BETWEEN ? AND ?";
                    $params[] = $_GET['start_date'];
                    $params[] = $_GET['end_date'];
                    $types .= "ss";
                }

                $sql = "
                    SELECT s.*, CONCAT(c.first_name, ' ', c.last_name) AS clientName
                    FROM sessions s
                    LEFT JOIN clients c ON s.client_id = c.client_id
                ";

                if (!empty($whereConditions)) {
                    $sql .= " WHERE " . implode(" AND ", $whereConditions);
                }

                $sql .= " ORDER BY s.start_utc ASC";

                if (!empty($params)) {
                    $stmt = $conn->prepare($sql);
                    $stmt->bind_param($types, ...$params);
                } else {
                    $stmt = $conn->prepare($sql);
                }

                $stmt->execute();
                $result = $stmt->get_result();
                $sessions = $result->fetch_all(MYSQLI_ASSOC);
                $stmt->close();

                echo json_encode($sessions);
            }
            break;

        // UPDATE session
        case "PUT":
            if (!isset($input['session_id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Session ID required in payload"]);
                exit();
            }

            $sessionId = (int)$input['session_id'];

            // Get current session data for comparison
            $stmt = $conn->prepare("SELECT * FROM sessions WHERE session_id = ?");
            $stmt->bind_param("i", $sessionId);
            $stmt->execute();
            $result = $stmt->get_result();
            $currentSession = $result->fetch_assoc();
            $stmt->close();

            if (!$currentSession) {
                http_response_code(404);
                echo json_encode(["error" => "Session not found"]);
                exit();
            }

            // Build dynamic UPDATE query based on provided fields
            $updateFields = [];
            $params = [];
            $types = "";

            $fieldMapping = [
                'clientId' => 'client_id',
                'provider' => 'provider_id',
                'providerName' => 'provider_name',
                'supervisingProvider' => 'supervising_provider_id',
                'supervisingProviderName' => 'supervising_provider_name',
                'startDateTime' => 'start_utc',
                'endDateTime' => 'end_utc',
                'startTZ' => 'start_tz',
                'endTZ' => 'end_tz',
                'authCode' => 'auth_code',
                'placeOfService' => 'place_of_service',
                'locationAddress' => 'location_address',
                'quickNote' => 'quick_note',
                'status' => 'status'
            ];

            foreach ($fieldMapping as $inputField => $dbField) {
                if (array_key_exists($inputField, $input)) {
                    $value = $input[$inputField];

                    // Convert datetime fields
                    if ($inputField === 'startDateTime' || $inputField === 'endDateTime') {
                        $value = convertToMySQLDateTime($value);
                    }

                    $updateFields[] = "$dbField = ?";
                    $params[] = $value;
                    $types .= "s";
                }
            }

            if (empty($updateFields)) {
                http_response_code(400);
                echo json_encode(["error" => "No fields to update"]);
                exit();
            }

            // Add session ID for WHERE clause
            $params[] = $sessionId;
            $types .= "i";

            $sql = "UPDATE sessions SET " . implode(", ", $updateFields) . " WHERE session_id = ?";

            $stmt = $conn->prepare($sql);
            $stmt->bind_param($types, ...$params);

            if ($stmt->execute()) {
                file_put_contents('debug.log', "Session $sessionId updated successfully\n", FILE_APPEND);

                // Check if significant changes happened
                $significantChanges = ['startDateTime', 'endDateTime', 'provider', 'locationAddress', 'status'];
                $hasSignificantChange = false;

                foreach ($significantChanges as $field) {
                    if (array_key_exists($field, $input)) {
                        $hasSignificantChange = true;
                        break;
                    }
                }

                if ($hasSignificantChange) {
                    $adminEmail = "christoberedward@gmail.com";
                    $adminName = "Admin";

                    $emailData = getEmailRecipients(
                        $conn,
                        $input['clientId'] ?? $currentSession['client_id'],
                        $input['provider'] ?? $currentSession['provider_id'],
                        $input['supervisingProvider'] ?? $currentSession['supervising_provider_id']
                    );

                    if ($emailData) {
                        $clientName = $emailData['clientName'];
                        $recipients = $emailData['recipients'];

                        $startUtc = $input['startDateTime'] ? convertToMySQLDateTime($input['startDateTime']) : $currentSession['start_utc'];
                        $endUtc = $input['endDateTime'] ? convertToMySQLDateTime($input['endDateTime']) : $currentSession['end_utc'];
                        $clientTz = $input['startTZ'] ?? $currentSession['start_tz'] ?? 'UTC';

                        $localStartDt = convertUtcToTz($startUtc, $clientTz);
                        $localEndDt = convertUtcToTz($endUtc, $clientTz);

                        $displayStart = $localStartDt ? $localStartDt->format('Y-m-d g:i A') : $startUtc;
                        $displayEnd = $localEndDt ? $localEndDt->format('Y-m-d g:i A') : $endUtc;

                        $subject = "Session Updated - Mahaverse";
                        $body = '
                <div style="background-color: #ffffff; padding: 15px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <p style="margin: 10px 0;"><strong>Client:</strong> ' . htmlspecialchars($clientName) . '</p>
                    <p style="margin: 10px 0;"><strong>Provider:</strong> ' . htmlspecialchars($input['providerName'] ?? $currentSession['provider_name']) . '</p>
                    <p style="margin: 10px 0;"><strong>Start:</strong> ' . htmlspecialchars($displayStart) . ' (' . htmlspecialchars($clientTz) . ')</p>
                    <p style="margin: 10px 0;"><strong>End:</strong> ' . htmlspecialchars($displayEnd) . ' (' . htmlspecialchars($clientTz) . ')</p>
                    <p style="margin: 10px 0;"><strong>Location:</strong> ' . htmlspecialchars($input['locationAddress'] ?? $currentSession['location_address'] ?? 'Not specified') . '</p>
                    <p style="margin: 10px 0;"><strong>Notes:</strong> ' . htmlspecialchars($input['quickNote'] ?? $currentSession['quick_note'] ?? 'None') . '</p>
                    <p style="margin: 10px 0;"><strong>Status:</strong> ' . htmlspecialchars($input['status'] ?? $currentSession['status']) . '</p>
                </div>';

                        $icsContent = generateICS(
                            $clientName,
                            $input['providerName'] ?? $currentSession['provider_name'],
                            $startUtc,
                            $endUtc,
                            $input['locationAddress'] ?? $currentSession['location_address'],
                            $input['quickNote'] ?? $currentSession['quick_note'],
                            $clientTz
                        );

                        // Send to recipients
                        foreach ($recipients as $recipient) {
                            $emailSent = sendEmail($recipient['email'], $recipient['name'], $subject, $body, $icsContent);
                            file_put_contents('debug.log', "Update notification sent to: {$recipient['email']} - " . ($emailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                        }

                        // Send to admin
                        $adminEmailSent = sendEmail($adminEmail, $adminName, $subject, $body, $icsContent);
                        file_put_contents('debug.log', "Update notification sent to admin: " . ($adminEmailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                    }
                }

                echo json_encode(["success" => true, "message" => "Session updated successfully"]);
            } else {
                http_response_code(500);
                echo json_encode(["error" => "Failed to update session: " . $stmt->error]);
            }
            $stmt->close();
            break;

        // DELETE session
        case "DELETE":
            if (!isset($_GET['id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Session ID required"]);
                exit();
            }

            $sessionId = $_GET['id'];

            // Get session details before deletion for email notification
            $stmt = $conn->prepare("
                SELECT s.*, CONCAT(c.first_name, ' ', c.last_name) AS clientName
                FROM sessions s
                LEFT JOIN clients c ON s.client_id = c.client_id
                WHERE s.session_id = ?
            ");
            $stmt->bind_param("i", $sessionId);
            $stmt->execute();
            $result = $stmt->get_result();
            $sessionToDelete = $result->fetch_assoc();
            $stmt->close();

            if (!$sessionToDelete) {
                http_response_code(404);
                echo json_encode(["error" => "Session not found"]);
                exit();
            }

            // Delete the session
            $stmt = $conn->prepare("DELETE FROM sessions WHERE session_id = ?");
            $stmt->bind_param("i", $sessionId);

            if ($stmt->execute()) {
                file_put_contents('debug.log', "Session $sessionId deleted successfully\n", FILE_APPEND);

                // Send cancellation email notification
                $adminEmail = "christoberedward@gmail.com";
                $adminName = "Admin";

                $emailData = getEmailRecipients(
                    $conn,
                    $sessionToDelete['client_id'],
                    $sessionToDelete['provider_id'],
                    $sessionToDelete['supervising_provider_id']
                );

                if ($emailData) {
                    $clientName = $emailData['clientName'];
                    $recipients = $emailData['recipients'];

                    $clientTz = $sessionToDelete['start_tz'] ?? 'UTC';
                    $localStartDt = convertUtcToTz($sessionToDelete['start_utc'], $clientTz);
                    $localEndDt = convertUtcToTz($sessionToDelete['end_utc'], $clientTz);

                    $displayStart = $localStartDt ? $localStartDt->format('Y-m-d g:i A') : $sessionToDelete['start_utc'];
                    $displayEnd = $localEndDt ? $localEndDt->format('Y-m-d g:i A') : $sessionToDelete['end_utc'];

                    $subject = "Session Cancelled - Mahaverse";
                    $body = '
                    <div style="background-color: #fff3cd; padding: 15px; border: 1px solid #ffeaa7; border-radius: 5px; border-left: 4px solid #f39c12;">
                        <h3 style="color: #856404; margin-top: 0;">Session Cancellation Notice</h3>
                        <p style="margin: 10px 0;"><strong>Client:</strong> ' . htmlspecialchars($clientName) . '</p>
                        <p style="margin: 10px 0;"><strong>Provider:</strong> ' . htmlspecialchars($sessionToDelete['provider_name']) . '</p>
                        <p style="margin: 10px 0;"><strong>Scheduled Start:</strong> ' . htmlspecialchars($displayStart) . ' (' . htmlspecialchars($clientTz) . ')</p>
                        <p style="margin: 10px 0;"><strong>Scheduled End:</strong> ' . htmlspecialchars($displayEnd) . ' (' . htmlspecialchars($clientTz) . ')</p>
                        <p style="margin: 10px 0;"><strong>Location:</strong> ' . htmlspecialchars($sessionToDelete['location_address'] ?? 'Not specified') . '</p>
                        <p style="margin: 15px 0; padding: 10px; background-color: #f8f9fa; border-radius: 3px; font-style: italic;">
                            This session has been cancelled. Please contact us if you have any questions or need to reschedule.
                        </p>
                    </div>';

                    // Send to recipients
                    foreach ($recipients as $recipient) {
                        $emailSent = sendEmail($recipient['email'], $recipient['name'], $subject, $body);
                        file_put_contents('debug.log', "Cancellation notification sent to: {$recipient['email']} - " . ($emailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                    }

                    // Send to admin
                    $adminEmailSent = sendEmail($adminEmail, $adminName, $subject, $body);
                    file_put_contents('debug.log', "Cancellation notification sent to admin: " . ($adminEmailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                }

                echo json_encode(["success" => true, "message" => "Session deleted successfully"]);
            } else {
                http_response_code(500);
                echo json_encode(["error" => "Failed to delete session: " . $stmt->error]);
            }
            $stmt->close();
            break;

        default:
            http_response_code(405);
            echo json_encode(["error" => "Method not allowed"]);
            break;
    }
} catch (Exception $e) {
    file_put_contents('debug.log', "Exception: " . $e->getMessage() . "\n", FILE_APPEND);
    http_response_code(500);
    echo json_encode(["error" => "Internal server error: " . $e->getMessage()]);
}

$conn->close();

<?php
// =======
// SESSION MANAGEMENT API - CRUD + Email Notifications + Recurring Sessions
// Updated with recurring_id, auth_id, cancelled_by, cancelled_reason
// =======

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Cache-Control, Accept");
header("Access-Control-Max-Age: 86400");
header("Content-Type: application/json; charset=UTF-8");

ini_set('display_errors', 1);
error_reporting(E_ALL);

$headers = getallheaders();
file_put_contents('debug.log', "Request Method: {$_SERVER['REQUEST_METHOD']}\nRequest Headers: " . print_r($headers, true) . "\n", FILE_APPEND);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    file_put_contents('debug.log', "OPTIONS request handled\n", FILE_APPEND);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = requireAuthReadWrite('scheduling.read', 'scheduling.write', 'mahaverse');

// DB Connection
$host = "db5018266079.hosting-data.io";
$username = "dbu3321929";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14484433";

$conn = new mysqli($host, $username, $password, $database);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit();
}

// Utility Functions
function convertToMySQLDateTime($datetime)
{
    if (empty($datetime)) return null;
    if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $datetime)) $datetime .= ':00';
    return str_replace('T', ' ', $datetime);
}

function convertUtcToTz($utcDateTimeStr, $targetTz)
{
    if (empty($utcDateTimeStr)) return null;
    try {
        $dt = new DateTime($utcDateTimeStr, new DateTimeZone('UTC'));
        if ($targetTz) {
            $dt->setTimezone(new DateTimeZone($targetTz));
        }
        return $dt;
    } catch (Exception $e) {
        try {
            return new DateTime($utcDateTimeStr, new DateTimeZone('UTC'));
        } catch (Exception $e2) {
            return null;
        }
    }
}

function icsEscape($text)
{
    if ($text === null) return '';
    $text = str_replace("\\", "\\\\", $text);
    $text = str_replace("\n", "\\n", $text);
    $text = str_replace(",", "\\,", $text);
    $text = str_replace(";", "\\;", $text);
    return $text;
}

function generateICS($clientName, $providerName, $startUtc, $endUtc, $locationAddress, $quickNote, $startTz)
{
    $tz = $startTz ?: 'UTC';
    $dtStart = convertUtcToTz($startUtc, $tz);
    $dtEnd = convertUtcToTz($endUtc, $tz);

    if (!$dtStart || !$dtEnd) {
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
    $dtstamp = gmdate('Ymd\THis\Z');

    $ics = "BEGIN:VCALENDAR\r\n";
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

function sendEmail($toEmail, $toName, $subject, $body, $icsContent = null)
{
    $boundary = uniqid('boundary_');

    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "From: Maha Behavioral Health <admin@mahabehavioralhealth.com>\r\n";
    $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";

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
            <div style="background-color: #4a90e2; padding: 20px; text-align: center;">
                <img src="https://www.mahabehavioralhealth.com/images/mahalogo_v1_small.jpg" alt="Mahaverse Logo" style="max-width: 150px; height: auto;">
                <h1 style="color: #ffffff; margin: 10px 0 5px; font-size: 24px;">Mahaverse</h1>
                <p style="color: #ffffff; margin: 0; font-size: 16px;">Shining in Every Shade of the Spectrum</p>
            </div>
            <div style="padding: 20px; background-color: #f9f9f9;">
                <h2 style="color: #4a90e2; font-size: 20px; margin-top: 0;">Session Update</h2>
                ' . $body . '
                <p style="margin-top: 20px; font-size: 14px;">Please find the calendar invite attached to add this session to your calendar.</p>
                <p style="font-size: 14px; color: #666;">Thank you for choosing Maha Behavioral Health.</p>
            </div>
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


function getEmailRecipients($conn, $clientId, $providerId = null, $supervisingProviderId = null)
{
    file_put_contents('debug.log', "getEmailRecipients called with clientId: $clientId, providerId: $providerId, supervisingProviderId: $supervisingProviderId\n", FILE_APPEND);

    $recipients = [];

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
    $appointmentReminder = strtolower(trim($client['appointment_reminder'] ?? ''));

    file_put_contents('debug.log', "Client found: $clientName, appointment_reminder: '{$appointmentReminder}'\n", FILE_APPEND);

    // Only send email if appointment_reminder is explicitly set to 'email'
    if ($appointmentReminder === 'email' && $client['email']) {
        $recipients[] = [
            'email' => $client['email'],
            'name' => $clientName,
            'type' => 'client'
        ];
        file_put_contents('debug.log', "Added client email: {$client['email']}\n", FILE_APPEND);
    } else {
        file_put_contents('debug.log', "Client email skipped - appointment_reminder is not set to 'email' (current value: '$appointmentReminder')\n", FILE_APPEND);
    }

    if ($providerId) {
        file_put_contents(
            'debug.log',
            "Provider/supervisor email notifications are disabled for scheduling.\n",
            FILE_APPEND
        );
    }

    return [
        'clientName' => $clientName,
        'recipients' => $recipients
    ];
}

function computeScheduledHours($startUtc, $endUtc)
{
    if (!$startUtc || !$endUtc) return null;
    $startTs = strtotime($startUtc);
    $endTs = strtotime($endUtc);
    if ($startTs === false || $endTs === false || $endTs <= $startTs) return 0;
    $hours = ($endTs - $startTs) / 3600;
    return round($hours, 2);
}

function updateClientAuthUnitsScheduled($conn, $clientId, $authId, $hoursToAdd)
{
    if (!$authId) {
        throw new Exception("auth_id is required");
    }

    // Step 1: Verify auth_id exists
    $checkStmt = $conn->prepare("SELECT insurance_id, balance_units FROM client_auth WHERE auth_id = ?");
    $checkStmt->bind_param("i", $authId);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    $authData = $result->fetch_assoc();
    $checkStmt->close();

    if (!$authData || !$authData['insurance_id']) {
        throw new Exception("Authorization not found or missing insurance_id: auth_id=$authId");
    }

    $insuranceId = $authData['insurance_id'];
    $currentBalance = (float)($authData['balance_units'] ?? '0.00'); // Cast VARCHAR to float

    // Step 2: Verify insurance belongs to client
    $verifyStmt = $conn->prepare("SELECT insurance_id FROM client_insurance WHERE insurance_id = ? AND client_id = ?");
    $verifyStmt->bind_param("is", $insuranceId, $clientId);
    $verifyStmt->execute();
    $verifyResult = $verifyStmt->get_result();
    $verifyData = $verifyResult->fetch_assoc();
    $verifyStmt->close();

    if (!$verifyData) {
        throw new Exception("Authorization does not belong to this client: auth_id=$authId, client_id=$clientId");
    }

    // Step 3: Check active authorization
    $stmt = $conn->prepare("SELECT balance_units, status FROM client_auth WHERE auth_id = ? AND UPPER(status) = 'ACTIVE'");
    $stmt->bind_param("i", $authId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();

    if (!$row) {
        throw new Exception("No active authorization found for auth_id=$authId");
    }

    $newBalance = $currentBalance + $hoursToAdd;

    if ($newBalance < 0) {
        throw new Exception("Insufficient balance: current=$currentBalance, requested=$hoursToAdd");
    }

    // Step 4: Update balance_units
    $stmt = $conn->prepare("UPDATE client_auth SET balance_units = ? WHERE auth_id = ?");
    $newBalanceStr = number_format($newBalance, 2, '.', ''); // Format as string for VARCHAR
    $stmt->bind_param("si", $newBalanceStr, $authId);
    $success = $stmt->execute();
    if (!$success) {
        $error = $stmt->error;
        $stmt->close();
        throw new Exception("SQL Error updating balance_units for auth_id=$authId: $error");
    }
    $stmt->close();

    file_put_contents('debug.log', "updateClientAuthUnitsScheduled: auth_id=$authId, client_id=$clientId, hoursChange=$hoursToAdd, currentBalance=$currentBalance, newBalance=$newBalance, Success=true\n", FILE_APPEND);
    return true;
}

// Main Logic
$method = $_SERVER['REQUEST_METHOD'];
$rawInput = file_get_contents("php://input");
$input = json_decode($rawInput, true);

file_put_contents('debug.log', "Raw Input: $rawInput\nParsed Input: " . print_r($input, true) . "\n", FILE_APPEND);

try {
    switch ($method) {
        // POST Case: Create single or recurring sessions
        case "POST":
            file_put_contents('debug.log', "Checking fields: clientId=" . ($input['clientId'] ?? 'missing') . ", provider=" . ($input['provider'] ?? 'missing') . ", providerName=" . ($input['providerName'] ?? 'missing') . ", startDateTime=" . ($input['startDateTime'] ?? 'missing') . ", endDateTime=" . ($input['endDateTime'] ?? 'missing') . ", authId=" . ($input['authId'] ?? 'missing') . "\n", FILE_APPEND);

            if (!isset($input['clientId'], $input['provider'], $input['providerName'], $input['startDateTime'], $input['endDateTime'], $input['authId'])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing required fields", "input" => $input]);
                exit();
            }

            $clientId = (string)$input['clientId'];
            $provider = (string)$input['provider'];
            $providerName = (string)$input['providerName'];
            $supervisingProvider = isset($input['supervisingProvider']) ? (string)$input['supervisingProvider'] : null;
            $supervisingProviderName = isset($input['supervisingProviderName']) ? (string)$input['supervisingProviderName'] : null;
            $authId = (int)$input['authId'];
            $recurringData = $input['recurring'] ?? ['frequency' => 'No'];
            $recurringFrequency = $recurringData['frequency'] ?? 'No';
            $recurringDays = null;
            if ($recurringFrequency === 'Weekly' && !empty($recurringData['days'])) {
                $recurringDays = implode(',', $recurringData['days']);
            }

            if (!in_array($recurringFrequency, ['No', 'Daily', 'Weekly', 'Biweekly', 'Monthly'])) {
                http_response_code(400);
                echo json_encode(["error" => "Invalid recurring frequency"]);
                exit();
            }

            $placeOfService = isset($input['placeOfService']) ? (string)$input['placeOfService'] : 'Clinic';
            if (!in_array($placeOfService, ['Home', 'Clinic', 'School', 'Virtual', 'Other'])) {
                http_response_code(400);
                echo json_encode(["error" => "Invalid place_of_service"]);
                exit();
            }



            $startMySQL = convertToMySQLDateTime($input['startDateTime']);
            $endMySQL = convertToMySQLDateTime($input['endDateTime']);
            $startTz = isset($input['startTZ']) ? (string)$input['startTZ'] : null;
            $endTz = isset($input['endTZ']) ? (string)$input['endTZ'] : null;
            $authCode = isset($input['authCode']) ? (string)$input['authCode'] : null;
            $locationAddress = isset($input['locationAddress']) ? (string)$input['locationAddress'] : null;

            $quickNote = isset($input['quickNote']) ? (string)$input['quickNote'] : null;
            $quickNoteContent = trim(string: $quickNote ?? '');
            $submittedStatus = $input['STATUS'] ?? $input['status'] ?? null;

            // 1. Default to 'Scheduled' or respect the submitted status.
            $status = !empty($submittedStatus) ? $submittedStatus : 'Scheduled';

            // 2. Upgrade to 'Rendered' if notes are present.
            if (!empty($quickNoteContent)) {
                $status = 'Rendered';
            }

            // 3. Ensure 'Cancelled' status is preserved.
            if (strtoupper($submittedStatus) === 'CANCELLED') {
                $status = $submittedStatus;
            }

            // 4. Finalize $quickNote value for SQL bind
            $quickNote = $quickNoteContent ?: null;
            // --- END: STATUS DETERMINATION ---

            if (!in_array($status, ['Scheduled', 'Rendered', 'Cancelled'])) {
                http_response_code(400);
                echo json_encode(["error" => "Invalid status. Must be 'Scheduled', 'Rendered', or 'Cancelled'"]);
                exit();
            }
            $authorizedHours = isset($input['authorizedHours']) ? (string)floatval($input['authorizedHours']) : null;
            $scheduledHours = isset($input['scheduledHours']) ? (string)floatval($input['scheduledHours']) : null;
            $renderedHours = isset($input['renderedHours']) ? (string)floatval($input['renderedHours']) : '0.00';

            // Validate auth_id and balance before transaction
            $stmt = $conn->prepare("
        SELECT ca.insurance_id, ca.status, ca.balance_units, ci.client_id 
        FROM client_auth ca 
        LEFT JOIN client_insurance ci ON ca.insurance_id = ci.insurance_id 
        WHERE ca.auth_id = ? AND UPPER(ca.status) = 'ACTIVE' AND ci.client_id = ?
    ");
            $stmt->bind_param("is", $authId, $clientId);
            $stmt->execute();
            $result = $stmt->get_result();
            $authData = $result->fetch_assoc();
            $stmt->close();

            if (!$authData) {
                // Debug: Check why auth_id is invalid
                $debugStmt = $conn->prepare("SELECT auth_id, insurance_id, status FROM client_auth WHERE auth_id = ?");
                $debugStmt->bind_param("i", $authId);
                $debugStmt->execute();
                $debugResult = $debugStmt->get_result();
                $debugAuth = $debugResult->fetch_assoc();
                $debugStmt->close();

                $debugMsg = "POST Validation failed: auth_id=$authId, client_id=$clientId. ";
                if (!$debugAuth) {
                    $debugMsg .= "auth_id not found in client_auth.";
                } else {
                    $debugMsg .= "auth_id found, status={$debugAuth['status']}, insurance_id={$debugAuth['insurance_id']}. ";
                    $checkInsuranceStmt = $conn->prepare("SELECT insurance_id FROM client_insurance WHERE insurance_id = ? AND client_id = ?");
                    $checkInsuranceStmt->bind_param("is", $debugAuth['insurance_id'], $clientId);
                    $checkInsuranceStmt->execute();
                    $insuranceResult = $checkInsuranceStmt->get_result();
                    $insuranceData = $insuranceResult->fetch_assoc();
                    $checkInsuranceStmt->close();
                    $debugMsg .= $insuranceData ? "Insurance linked." : "Insurance not linked to client.";
                }
                file_put_contents('debug.log', $debugMsg . "\n", FILE_APPEND);

                http_response_code(400);
                echo json_encode(["error" => "Invalid or inactive auth_id, or auth_id does not belong to client", "auth_id" => $authId, "client_id" => $clientId]);
                exit();
            }

            $currentBalance = (float)($authData['balance_units'] ?? '0.00'); // Cast VARCHAR to float
            $totalScheduledHours = floatval($scheduledHours); // For single session
            if ($currentBalance < $totalScheduledHours) {
                http_response_code(400);
                echo json_encode(["error" => "Insufficient balance_units: available=$currentBalance, required=$totalScheduledHours"]);
                file_put_contents('debug.log', "POST Validation failed: Insufficient balance_units, available=$currentBalance, required=$totalScheduledHours\n", FILE_APPEND);
                exit();
            }

            $conn->begin_transaction();
            try {
                $sessionIds = [];
                $sessionsToCreate = [];
                $recurringId = null;

                if ($recurringFrequency !== 'No' && $recurringFrequency !== 'Never') {
                    $recurringId = (int)(microtime(true) * 10000) . rand(1000, 9999);

                    $startDate = new DateTime($startMySQL, new DateTimeZone('UTC'));
                    $endDate = new DateTime($endMySQL, new DateTimeZone('UTC'));
                    $sessionDuration = $endDate->getTimestamp() - $startDate->getTimestamp();

                    $currentDate = clone $startDate;
                    $endLimit = null;
                    $occurrenceCount = 0;
                    $maxOccurrences = 100;

                    if (!empty($recurringData['ends']['type']) && $recurringData['ends']['type'] === 'On' && !empty($recurringData['ends']['date'])) {
                        $endLimit = new DateTime($recurringData['ends']['date'] . ' 23:59:59', new DateTimeZone('UTC'));
                    } elseif (!empty($recurringData['ends']['type']) && $recurringData['ends']['type'] === 'After' && !empty($recurringData['ends']['occurrences'])) {
                        $maxOccurrences = intval($recurringData['ends']['occurrences']);
                    }

                    while ($occurrenceCount < $maxOccurrences) {
                        if ($endLimit && $currentDate > $endLimit) break;

                        $shouldInclude = false;
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

                        switch ($recurringFrequency) {
                            case 'Daily':
                            case 'Weekly':
                            case 'Biweekly':
                                $currentDate->add(new DateInterval('P1D'));
                                break;
                            case 'Monthly':
                                $currentDate->add(new DateInterval('P1M'));
                                break;
                        }
                    }
                } else {
                    $sessionsToCreate[] = [
                        'start' => $startMySQL,
                        'end' => $endMySQL
                    ];
                }

                $stmt = $conn->prepare("
            INSERT INTO sessions (
                client_id, provider_id, provider_name, supervising_provider_id, supervising_provider_name,
                start_utc, end_utc, start_tz, end_tz, auth_code, recurring, recurring_days, place_of_service,
                location_address, quick_note, status, authorized_hours, scheduled_hours, rendered_hours,
                recurring_id, auth_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

                $totalScheduledHours = 0;
                foreach ($sessionsToCreate as $session) {
                    $sessionScheduledHours = $scheduledHours !== null
                        ? (string)floatval($scheduledHours)
                        : (string)computeScheduledHours($session['start'], $session['end']);

                    $recurring_id = $recurringFrequency !== 'No' ? $recurringId : null;

                    $stmt->bind_param(
                        "ssssssssssssssssdddii",
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
                        $status,
                        $authorizedHours,
                        $sessionScheduledHours,
                        $renderedHours,
                        $recurring_id,
                        $authId
                    );


                    if ($stmt->execute()) {
                        $sessionIds[] = $stmt->insert_id;
                        $totalScheduledHours += floatval($sessionScheduledHours);
                        file_put_contents('debug.log', "Inserted session_id: {$stmt->insert_id}, start_utc: {$session['start']}, scheduled_hours: $sessionScheduledHours\n", FILE_APPEND);
                    } else {
                        throw new Exception("Failed to create session: " . $stmt->error);
                    }
                }
                $stmt->close();

                // Update client_auth balance_units
                file_put_contents('debug.log', "Updating client_auth for auth_id: $authId, client_id: $clientId, totalScheduledHours: $totalScheduledHours\n", FILE_APPEND);
                if (!updateClientAuthUnitsScheduled($conn, $clientId, $authId, -$totalScheduledHours)) {
                    throw new Exception("Failed to update client_auth balance_units");
                }

                $adminEmail = "christoberedward@gmail.com";
                $adminName = "Admin";
                $emailData = getEmailRecipients($conn, $clientId, $provider, $supervisingProvider);

                if (!$emailData) {
                    file_put_contents('debug.log', "Client not found for email notification\n", FILE_APPEND);
                } else {
                    $clientName = $emailData['clientName'];
                    $recipients = $emailData['recipients'];

                    $clientTz = $startTz ?: 'UTC';
                    $localStartDt = convertUtcToTz($startMySQL, $clientTz);
                    $localEndDt = convertUtcToTz($endMySQL, $clientTz);

                    $displayStart = $localStartDt ? $localStartDt->format('Y-m-d g:i A') : $startMySQL;
                    $displayEnd = $localEndDt ? $localEndDt->format('Y-m-d g:i A') : $endMySQL;

                    if ($recurringFrequency !== 'No' && $recurringFrequency !== 'Never') {
                        $subject = "Recurring Sessions Scheduled - Mahaverse";
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
                    <p style="margin: 10px 0;"><strong>First Session End:</strong> ' . htmlspecialchars($displayEnd) . ' (' . htmlspecialchars($endTz ?: $clientTz) . ')</p>
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

                    foreach ($recipients as $recipient) {
                        $emailSent = sendEmail($recipient['email'], $recipient['name'], $subject, $body, $icsContent);
                        file_put_contents('debug.log', ucfirst($recipient['type']) . " Email Sent to: {$recipient['email']} ({$recipient['name']}) - " . ($emailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                    }

                    $adminEmailSent = sendEmail($adminEmail, $adminName, $subject, $body, $icsContent);
                    file_put_contents('debug.log', "Admin Email Sent: " . ($adminEmailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                }

                $conn->commit();
                echo json_encode([
                    "success" => true,
                    "session_id" => $sessionIds[0],
                    "sessions_created" => count($sessionIds),
                    "recurring_id" => $recurringId,
                    "total_scheduled_hours" => $totalScheduledHours
                ]);
            } catch (Exception $e) {
                $conn->rollback();
                http_response_code(500);
                echo json_encode([
                    "error" => "Failed to create sessions: " . $e->getMessage(),
                    "payload" => $input,
                    "auth_id" => $authId,
                    "client_id" => $clientId
                ]);
                file_put_contents('debug.log', "POST Transaction failed: " . $e->getMessage() . "\nPayload: " . json_encode($input) . "\n", FILE_APPEND);
                exit();
            }
            break;

        // GET Case: Retrieve sessions
        case "GET":
            if (isset($_GET['id'])) {
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
                $whereConditions = [];
                $params = [];
                $types = "";

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
                    $whereConditions[] = "s.STATUS = ?";
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

        // PUT Case: Update single or recurring sessions
        case "PUT":
            if (!isset($input['session_id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Session ID required in payload"]);
                exit();
            }

            $sessionId = (int)$input['session_id'];
            $editMode = isset($input['editMode']) ? (string)$input['editMode'] : 'single';

            // Get the current session
            $stmt = $conn->prepare("
        SELECT client_id, auth_id, provider_id, provider_name, supervising_provider_id, supervising_provider_name,
               start_utc, end_utc, start_tz, end_tz, auth_code, place_of_service, location_address,
               quick_note, status, authorized_hours, scheduled_hours, rendered_hours, recurring_id
        FROM sessions WHERE session_id = ?
    ");
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

            $conn->begin_transaction();
            try {
                $sessionsToUpdate = [];
                if ($editMode === 'recurring' && !empty($currentSession['recurring_id'])) {
                    $stmt = $conn->prepare("SELECT session_id, start_utc, end_utc, scheduled_hours FROM sessions WHERE recurring_id = ?");
                    $stmt->bind_param("i", $currentSession['recurring_id']);
                    $stmt->execute();
                    $result = $stmt->get_result();
                    while ($row = $result->fetch_assoc()) {
                        $sessionsToUpdate[] = [
                            'session_id' => $row['session_id'],
                            'start_utc' => $row['start_utc'],
                            'end_utc' => $row['end_utc'],
                            'scheduled_hours' => $row['scheduled_hours']
                        ];
                    }
                    $stmt->close();
                    file_put_contents('debug.log', "Edit Mode: RECURRING - Found " . count($sessionsToUpdate) . " sessions to update with recurring_id: {$currentSession['recurring_id']}\n", FILE_APPEND);
                } else {
                    $sessionsToUpdate[] = [
                        'session_id' => $sessionId,
                        'start_utc' => $currentSession['start_utc'],
                        'end_utc' => $currentSession['end_utc'],
                        'scheduled_hours' => $currentSession['scheduled_hours']
                    ];
                    file_put_contents('debug.log', "Edit Mode: SINGLE - Updating session_id: $sessionId\n", FILE_APPEND);
                }

                $rowsAffected = 0;
                $totalHoursChange = 0;

                foreach ($sessionsToUpdate as $session) {
                    $sessionId = (int)$session['session_id'];
                    $originalScheduledHours = (float)$session['scheduled_hours'];

                    // Get values from input or use current session values as fallback
                    $clientId = isset($input['clientId']) ? (string)$input['clientId'] : $currentSession['client_id'];
                    $provider = isset($input['provider']) ? (string)$input['provider'] : $currentSession['provider_id'];
                    $providerName = isset($input['providerName']) ? (string)$input['providerName'] : $currentSession['provider_name'];
                    $supervisingProvider = isset($input['supervisingProvider']) ? (string)$input['supervisingProvider'] : $currentSession['supervising_provider_id'];
                    $supervisingProviderName = isset($input['supervisingProviderName']) ? (string)$input['supervisingProviderName'] : $currentSession['supervising_provider_name'];
                    $startTz = isset($input['startTZ']) ? (string)$input['startTZ'] : $currentSession['start_tz'];
                    $endTz = isset($input['endTZ']) ? (string)$input['endTZ'] : $currentSession['end_tz'];
                    $authCode = isset($input['authCode']) ? (string)$input['authCode'] : $currentSession['auth_code'];
                    $placeOfService = isset($input['placeOfService']) ? (string)$input['placeOfService'] : $currentSession['place_of_service'];
                    $locationAddress = isset($input['locationAddress']) ? (string)$input['locationAddress'] : $currentSession['location_address'];
                    $quickNote = isset($input['quickNote']) ? (string)$input['quickNote'] : $currentSession['quick_note'];
                    if (isset($input['quickNote']) && !empty(trim($input['quickNote']))) {
                        $status = 'Rendered';
                    } else {
                        // Keep current status if quickNote is not being updated
                        $status = isset($input['status']) ? (string)$input['status'] : $currentSession['status'];
                    }
                    $authorizedHours = isset($input['authorizedHours']) ? floatval($input['authorizedHours']) : floatval($currentSession['authorized_hours'] ?? '0.00');
                    $scheduledHours = isset($input['scheduledHours']) ? floatval($input['scheduledHours']) : floatval($currentSession['scheduled_hours']);
                    $renderedHours = isset($input['renderedHours']) ? floatval($input['renderedHours']) : floatval($currentSession['rendered_hours'] ?? '0.00');

                    // Validate parameters
                    if ($scheduledHours === null) {
                        throw new Exception("scheduled_hours is null for session_id: $sessionId");
                    }
                    if ($renderedHours === null) {
                        throw new Exception("rendered_hours is null for session_id: $sessionId");
                    }

                    if (!in_array($placeOfService, ['Home', 'Clinic', 'School', 'Virtual', 'Other'])) {
                        throw new Exception("Invalid place_of_service: $placeOfService");
                    }
                    if (!in_array($status, ['Scheduled', 'Rendered', 'Cancelled'])) {
                        throw new Exception("Invalid status: $status. Must be 'Scheduled', 'Rendered', or 'Cancelled'");
                    }

                    $startUtc = $session['start_utc'];
                    $endUtc = $session['end_utc'];

                    // Handle datetime updates for recurring sessions
                    if ($editMode === 'recurring' && (isset($input['startDateTime']) || isset($input['endDateTime']))) {
                        $inputStartDateTime = isset($input['startDateTime']) ? convertToMySQLDateTime($input['startDateTime']) : $currentSession['start_utc'];
                        $inputEndDateTime = isset($input['endDateTime']) ? convertToMySQLDateTime($input['endDateTime']) : $currentSession['end_utc'];

                        try {
                            $inputStartDt = new DateTime($inputStartDateTime, new DateTimeZone('UTC'));
                            $inputEndDt = new DateTime($inputEndDateTime, new DateTimeZone('UTC'));
                            $originalStartDt = new DateTime($session['start_utc'], new DateTimeZone('UTC'));

                            $newStartDt = new DateTime(
                                $originalStartDt->format('Y-m-d') . ' ' . $inputStartDt->format('H:i:s'),
                                new DateTimeZone('UTC')
                            );

                            $duration = $inputEndDt->getTimestamp() - $inputStartDt->getTimestamp();
                            $newEndDt = clone $newStartDt;
                            $newEndDt->modify("+$duration seconds");

                            $startUtc = $newStartDt->format('Y-m-d H:i:s');
                            $endUtc = $newEndDt->format('Y-m-d H:i:s');

                            if (!isset($input['scheduledHours'])) {
                                $scheduledHours = floatval(computeScheduledHours($startUtc, $endUtc));
                            }
                        } catch (Exception $e) {
                            throw new Exception("DateTime error: " . $e->getMessage());
                        }
                    } elseif (isset($input['startDateTime']) || isset($input['endDateTime'])) {
                        // For single sessions, update datetime directly
                        $startUtc = isset($input['startDateTime']) ? convertToMySQLDateTime($input['startDateTime']) : $session['start_utc'];
                        $endUtc = isset($input['endDateTime']) ? convertToMySQLDateTime($input['endDateTime']) : $session['end_utc'];

                        if (!isset($input['scheduledHours'])) {
                            $scheduledHours = floatval(computeScheduledHours($startUtc, $endUtc));
                        }
                    }

                    $hoursChange = $scheduledHours - $originalScheduledHours;
                    $totalHoursChange += $hoursChange;

                    file_put_contents('debug.log', "Updating session_id: $sessionId with hours change: $hoursChange\n", FILE_APPEND);

                    $updateSql = "
                UPDATE sessions SET
                    client_id = ?,
                    provider_id = ?,
                    provider_name = ?,
                    supervising_provider_id = ?,
                    supervising_provider_name = ?,
                    start_utc = ?,
                    end_utc = ?,
                    start_tz = ?,
                    end_tz = ?,
                    auth_code = ?,
                    place_of_service = ?,
                    location_address = ?,
                    quick_note = ?,
                    STATUS = ?,
                    authorized_hours = ?,
                    scheduled_hours = ?,
                    rendered_hours = ?
                WHERE session_id = ?
            ";

                    $updateStmt = $conn->prepare($updateSql);
                    if (!$updateStmt) {
                        throw new Exception("Prepare failed: " . $conn->error);
                    }

                    $updateStmt->bind_param(
                        "ssssssssssssssdddi",
                        $clientId,
                        $provider,
                        $providerName,
                        $supervisingProvider,
                        $supervisingProviderName,
                        $startUtc,
                        $endUtc,
                        $startTz,
                        $endTz,
                        $authCode,
                        $placeOfService,
                        $locationAddress,
                        $quickNote,
                        $status,
                        $authorizedHours,
                        $scheduledHours,
                        $renderedHours,
                        $sessionId
                    );

                    if (!$updateStmt->execute()) {
                        throw new Exception("Failed to update session_id: $sessionId - " . $updateStmt->error);
                    }

                    $rowsAffected += $updateStmt->affected_rows;
                    $updateStmt->close();
                    file_put_contents('debug.log', "Successfully updated session_id: $sessionId\n", FILE_APPEND);
                }

                // Update auth balance if hours changed
                $authId = isset($input['authId']) && $input['authId'] !== null ? (int)$input['authId'] : $currentSession['auth_id'];
                if ($totalHoursChange != 0 && !empty($authId)) {
                    if (!updateClientAuthUnitsScheduled($conn, $currentSession['client_id'], $authId, -$totalHoursChange)) {
                        throw new Exception("Failed to update client_auth balance_units");
                    }
                } else {
                    file_put_contents('debug.log', "Skipped updateClientAuthUnitsScheduled: auth_id=$authId or no hours change ($totalHoursChange)\n", FILE_APPEND);
                }

                // Send notification emails
                $adminEmail = "christoberedward@gmail.com";
                $adminName = "Admin";
                $emailData = getEmailRecipients($conn, $currentSession['client_id'], $currentSession['provider_id'], $currentSession['supervising_provider_id']);

                if ($emailData) {
                    $clientName = $emailData['clientName'];
                    $recipients = $emailData['recipients'];

                    foreach ($sessionsToUpdate as $session) {
                        $sessionId = $session['session_id'];
                        $localStartDt = convertUtcToTz($session['start_utc'], $startTz ?: 'UTC');
                        $localEndDt = convertUtcToTz($session['end_utc'], $endTz ?: 'UTC');
                        $displayStart = $localStartDt ? $localStartDt->format('Y-m-d g:i A') : $session['start_utc'];
                        $displayEnd = $localEndDt ? $localEndDt->format('Y-m-d g:i A') : $session['end_utc'];

                        $subject = "Session Updated - Mahaverse";
                        $body = '
                <div style="background-color: #ffffff; padding: 15px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <p style="margin: 10px 0;"><strong>Client:</strong> ' . htmlspecialchars($clientName) . '</p>
                    <p style="margin: 10px 0;"><strong>Provider:</strong> ' . htmlspecialchars($providerName) . '</p>
                    <p style="margin: 10px 0;"><strong>Start:</strong> ' . htmlspecialchars($displayStart) . ' (' . htmlspecialchars($startTz ?: 'UTC') . ')</p>
                    <p style="margin: 10px 0;"><strong>End:</strong> ' . htmlspecialchars($displayEnd) . ' (' . htmlspecialchars($endTz ?: 'UTC') . ')</p>
                    <p style="margin: 10px 0;"><strong>Location:</strong> ' . htmlspecialchars($locationAddress ?? 'Not specified') . '</p>
                    <p style="margin: 10px 0;"><strong>Notes:</strong> ' . htmlspecialchars($quickNote ?? 'None') . '</p>
                    <p style="margin: 10px 0;"><strong>Status:</strong> ' . htmlspecialchars($status) . '</p>
                </div>';

                        $icsContent = generateICS($clientName, $providerName, $session['start_utc'], $session['end_utc'], $locationAddress, $quickNote, $startTz);

                        foreach ($recipients as $recipient) {
                            $emailSent = sendEmail($recipient['email'], $recipient['name'], $subject, $body, $icsContent);
                            file_put_contents('debug.log', ucfirst($recipient['type']) . " Email Sent to: {$recipient['email']} ({$recipient['name']}) - " . ($emailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                        }

                        $adminEmailSent = sendEmail($adminEmail, $adminName, $subject, $body, $icsContent);
                        file_put_contents('debug.log', "Admin Email Sent: " . ($adminEmailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                    }
                }

                $conn->commit();
                echo json_encode([
                    "success" => true,
                    "rows_affected" => $rowsAffected,
                    "edit_mode" => $editMode,
                    "sessions_updated" => array_column($sessionsToUpdate, 'session_id'),
                    "total_hours_change" => $totalHoursChange
                ]);
            } catch (Exception $e) {
                $conn->rollback();
                http_response_code(500);
                echo json_encode(["error" => "Failed to update sessions: " . $e->getMessage()]);
                file_put_contents('debug.log', "PUT Transaction failed: " . $e->getMessage() . "\n", FILE_APPEND);
                exit();
            }
            break;

        // DELETE Case: Cancel single or recurring sessions
        case "DELETE":
            if (!isset($input['session_id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Session ID required in payload"]);
                exit();
            }

            $sessionId = (int)$input['session_id'];
            $cancelledBy = isset($input['cancelledBy']) ? (string)$input['cancelledBy'] : 'Staff';
            $cancelledReason = isset($input['cancelledReason']) ? (string)$input['cancelledReason'] : '';
            $editMode = isset($input['editMode']) ? (string)$input['editMode'] : 'single';

            if (!in_array($cancelledBy, ['Client', 'Staff'])) {
                http_response_code(400);
                echo json_encode(["error" => "Invalid cancelledBy value. Must be 'Client' or 'Staff'"]);
                exit();
            }

            if (empty($cancelledReason)) {
                http_response_code(400);
                echo json_encode(["error" => "Cancellation reason is required"]);
                exit();
            }

            $conn->begin_transaction();
            try {
                $stmt = $conn->prepare("SELECT client_id, auth_id, recurring_id, start_utc, end_utc, provider_id, provider_name, location_address, quick_note, start_tz, scheduled_hours, rendered_hours FROM sessions WHERE session_id = ?");
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

                $sessionsToUpdate = [];
                if ($editMode === 'recurring' && !empty($currentSession['recurring_id'])) {
                    $stmt = $conn->prepare("SELECT session_id, scheduled_hours, rendered_hours FROM sessions WHERE recurring_id = ? AND status != 'cancelled'");
                    $stmt->bind_param("i", $currentSession['recurring_id']);
                    $stmt->execute();
                    $result = $stmt->get_result();
                    while ($row = $result->fetch_assoc()) {
                        $sessionsToUpdate[] = [
                            'session_id' => $row['session_id'],
                            'scheduled_hours' => $row['scheduled_hours'],
                            'rendered_hours' => $row['rendered_hours']
                        ];
                    }
                    $stmt->close();
                    file_put_contents('debug.log', "DELETE Mode: RECURRING - Found " . count($sessionsToUpdate) . " sessions to cancel with recurring_id: {$currentSession['recurring_id']}\n", FILE_APPEND);
                } else {
                    $sessionsToUpdate[] = [
                        'session_id' => $sessionId,
                        'scheduled_hours' => $currentSession['scheduled_hours'],
                        'rendered_hours' => $currentSession['rendered_hours']
                    ];
                    file_put_contents('debug.log', "DELETE Mode: SINGLE - Cancelling session_id: $sessionId\n", FILE_APPEND);
                }

                $stmt = $conn->prepare("UPDATE sessions SET status = ?, cancelled_by = ?, cancelled_reason = ?, updated_at = NOW() WHERE session_id = ?");
                $status = 'Cancelled';
                $rowsAffected = 0;
                $totalHoursChange = 0;

                foreach ($sessionsToUpdate as $session) {
                    $stmt->bind_param("sssi", $status, $cancelledBy, $cancelledReason, $session['session_id']);
                    if ($stmt->execute()) {
                        $rowsAffected += $stmt->affected_rows;
                        $totalHoursChange += (float)$session['scheduled_hours'];
                        file_put_contents('debug.log', "Cancelled session_id: {$session['session_id']}\n", FILE_APPEND);
                    } else {
                        throw new Exception("Failed to cancel session_id: {$session['session_id']} - " . $stmt->error);
                    }
                }
                $stmt->close();

                if ($totalHoursChange != 0 && !updateClientAuthUnitsScheduled($conn, $currentSession['client_id'], $currentSession['auth_id'], $totalHoursChange)) {
                    throw new Exception("Failed to update client_auth balance_units");
                }

                $adminEmail = "christoberedward@gmail.com";
                $adminName = "Admin";
                $emailData = getEmailRecipients($conn, $currentSession['client_id'], $currentSession['provider_id']);

                if ($emailData) {
                    $clientName = $emailData['clientName'];
                    $recipients = $emailData['recipients'];

                    foreach ($sessionsToUpdate as $session) {
                        $localStartDt = convertUtcToTz($currentSession['start_utc'], $currentSession['start_tz'] ?: 'UTC');
                        $localEndDt = convertUtcToTz($currentSession['end_utc'], $currentSession['start_tz'] ?: 'UTC');
                        $displayStart = $localStartDt ? $localStartDt->format('Y-m-d g:i A') : $currentSession['start_utc'];
                        $displayEnd = $localEndDt ? $localEndDt->format('Y-m-d g:i A') : $currentSession['end_utc'];

                        $subject = "Session Cancelled - Mahaverse";
                        $body = '
                        <div style="background-color: #ffffff; padding: 15px; border: 1px solid #e0e0e0; border-radius: 5px;">
                            <p style="margin: 10px 0;"><strong>Client:</strong> ' . htmlspecialchars($clientName) . '</p>
                            <p style="margin: 10px 0;"><strong>Provider:</strong> ' . htmlspecialchars($currentSession['provider_name']) . '</p>
                            <p style="margin: 10px 0;"><strong>Start:</strong> ' . htmlspecialchars($displayStart) . ' (' . htmlspecialchars($currentSession['start_tz'] ?: 'UTC') . ')</p>
                            <p style="margin: 10px 0;"><strong>End:</strong> ' . htmlspecialchars($displayEnd) . ' (' . htmlspecialchars($currentSession['start_tz'] ?: 'UTC') . ')</p>
                            <p style="margin: 10px 0;"><strong>Location:</strong> ' . htmlspecialchars($currentSession['location_address'] ?? 'Not specified') . '</p>
                            <p style="margin: 10px 0;"><strong>Notes:</strong> ' . htmlspecialchars($currentSession['quick_note'] ?? 'None') . '</p>
                            <p style="margin: 10px 0;"><strong>Cancelled By:</strong> ' . htmlspecialchars($cancelledBy) . '</p>
                            <p style="margin: 10px 0;"><strong>Cancellation Reason:</strong> ' . htmlspecialchars($cancelledReason) . '</p>
                        </div>';

                        $icsContent = generateICS($clientName, $currentSession['provider_name'], $currentSession['start_utc'], $currentSession['end_utc'], $currentSession['location_address'], $currentSession['quick_note'], $currentSession['start_tz']);

                        foreach ($recipients as $recipient) {
                            $emailSent = sendEmail($recipient['email'], $recipient['name'], $subject, $body, $icsContent);
                            file_put_contents('debug.log', ucfirst($recipient['type']) . " Email Sent to: {$recipient['email']} ({$recipient['name']}) - " . ($emailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                        }

                        $adminEmailSent = sendEmail($adminEmail, $adminName, $subject, $body, $icsContent);
                        file_put_contents('debug.log', "Admin Email Sent: " . ($adminEmailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                    }
                }

                $conn->commit();
                echo json_encode([
                    "success" => true,
                    "message" => "Session(s) cancelled successfully",
                    "rows_affected" => $rowsAffected,
                    "edit_mode" => $editMode,
                    "sessions_cancelled" => array_column($sessionsToUpdate, 'session_id')
                ]);
            } catch (Exception $e) {
                $conn->rollback();
                http_response_code(500);
                echo json_encode(["error" => "Failed to cancel session(s): " . $e->getMessage()]);
                file_put_contents('debug.log', "DELETE Transaction failed: " . $e->getMessage() . "\n", FILE_APPEND);
                exit();

            }
            break;

        default:
            http_response_code(405);
            echo json_encode(["error" => "Method not allowed"]);
            break;
    }
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => "Internal server error", "message" => $e->getMessage()]);
    file_put_contents('debug.log', "Exception: " . $e->getMessage() . "\n", FILE_APPEND);
}

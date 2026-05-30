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

/**
 * Some deployments migrated sessions.authorized_hours; others did not.
 * When missing, omit the column from INSERT/UPDATE so session create still works.
 */
function sessions_has_authorized_hours_column(mysqli $conn): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $r = @$conn->query("SHOW COLUMNS FROM `sessions` LIKE 'authorized_hours'");
    $cached = ($r && $r->num_rows > 0);
    if ($r) {
        $r->free();
    }
    return $cached;
}

function sessions_has_claim_columns(mysqli $conn): array
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = ['claim_id' => false, 'claim_status' => false];
    $r = @$conn->query("SHOW COLUMNS FROM `sessions`");
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $f = $row['Field'] ?? '';
            if ($f === 'claim_id') {
                $cached['claim_id'] = true;
            }
            if ($f === 'claim_status') {
                $cached['claim_status'] = true;
            }
        }
        $r->free();
    }
    return $cached;
}

function session_is_completed_status($status): bool
{
    $v = strtolower(trim((string)$status));
    return $v === 'rendered' || $v === 'completed';
}

/** Completed / billed session — only time and location may change on update. */
function session_row_is_completed(array $row): bool
{
    if (session_is_completed_status($row['status'] ?? $row['STATUS'] ?? '')) {
        return true;
    }
    if (floatval($row['rendered_hours'] ?? 0) > 0) {
        return true;
    }
    $cs = strtolower(trim((string)($row['claim_status'] ?? '')));
    if ($cs !== '' && str_contains($cs, 'ready to bill')) {
        return true;
    }
    if (trim((string)($row['claim_id'] ?? '')) !== '') {
        return true;
    }
    return false;
}

function session_status_is_cancelled($status): bool
{
    return strtolower(trim((string)$status)) === 'cancelled';
}

class ProviderScheduleConflictException extends Exception
{
    private array $payload;

    public function __construct(array $conflict, string $providerName = '')
    {
        $this->payload = provider_double_booked_response($conflict, $providerName);
        parent::__construct((string)($this->payload['error'] ?? 'Provider is double-booked'));
    }

    public function getPayload(): array
    {
        return array_merge($this->payload, ['success' => false]);
    }
}

/** Resolved sessions.status / STATUS column name for SQL fragments. */
function sessions_status_column(mysqli $conn): string
{
    static $col = null;
    if ($col !== null) {
        return $col;
    }
    $col = 'status';
    $r = @$conn->query('SHOW COLUMNS FROM `sessions`');
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $field = (string)($row['Field'] ?? '');
            if (strcasecmp($field, 'STATUS') === 0) {
                $col = $field;
                break;
            }
            if (strcasecmp($field, 'status') === 0) {
                $col = $field;
            }
        }
        $r->free();
    }
    return $col;
}

function sessions_status_sql_expr(mysqli $conn, string $alias = 's'): string
{
    $col = sessions_status_column($conn);
    return "LOWER(TRIM(IFNULL({$alias}.`{$col}`, '')))";
}

function schedule_windows_overlap(string $startUtc, string $endUtc, string $otherStart, string $otherEnd): bool
{
    $s = strtotime($startUtc);
    $e = strtotime($endUtc);
    $os = strtotime($otherStart);
    $oe = strtotime($otherEnd);
    if ($s === false || $e === false || $os === false || $oe === false) {
        return false;
    }
    return $s < $oe && $os < $e;
}

/**
 * Find an active session overlapping the provider's time window.
 *
 * @param int[] $excludeSessionIds
 * @return array<string,mixed>|null
 */
function find_provider_schedule_conflict(
    mysqli $conn,
    string $providerId,
    string $startUtc,
    string $endUtc,
    array $excludeSessionIds = []
): ?array {
    if (trim($providerId) === '' || trim($startUtc) === '' || trim($endUtc) === '') {
        return null;
    }
    if (strtotime($endUtc) <= strtotime($startUtc)) {
        return null;
    }

    $excludeSessionIds = array_values(array_unique(array_filter(array_map('intval', $excludeSessionIds))));
    $excludeSql = '';
    if (!empty($excludeSessionIds)) {
        $excludeSql = ' AND s.session_id NOT IN (' . implode(',', $excludeSessionIds) . ')';
    }

    $statusExpr = sessions_status_sql_expr($conn, 's');
    $sql = "
        SELECT s.session_id, s.client_id, s.start_utc, s.end_utc, s.provider_name,
               TRIM(CONCAT(IFNULL(c.first_name, ''), ' ', IFNULL(c.last_name, ''))) AS client_name
        FROM sessions s
        LEFT JOIN clients c ON s.client_id = c.client_id
        WHERE s.provider_id = ?
          AND {$statusExpr} <> 'cancelled'
          AND s.start_utc < ?
          AND s.end_utc > ?
          {$excludeSql}
        ORDER BY s.start_utc ASC
        LIMIT 1
    ";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        file_put_contents(
            'debug.log',
            'find_provider_schedule_conflict prepare failed: ' . $conn->error . "\n",
            FILE_APPEND
        );
        throw new Exception('Unable to validate provider schedule (database error).');
    }
    $stmt->bind_param('sss', $providerId, $endUtc, $startUtc);
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        throw new Exception('Unable to validate provider schedule: ' . $err);
    }
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) {
        return null;
    }

    $clientName = trim((string)($row['client_name'] ?? ''));
    if ($clientName === '') {
        $clientName = 'another client';
    }
    $row['client_name'] = $clientName;

    return $row;
}

function provider_double_booked_response(array $conflict, string $providerName = ''): array
{
    $client = trim((string)($conflict['client_name'] ?? 'another client'));
    $providerLabel = trim($providerName) !== ''
        ? $providerName
        : trim((string)($conflict['provider_name'] ?? 'This provider'));
    $start = (string)($conflict['start_utc'] ?? '');
    $end = (string)($conflict['end_utc'] ?? '');

    return [
        'error' => sprintf(
            '%s is already booked with %s from %s to %s. Choose a different time or provider.',
            $providerLabel,
            $client,
            $start,
            $end
        ),
        'code' => 'provider_double_booked',
        'success' => false,
        'conflict' => [
            'session_id' => (int)($conflict['session_id'] ?? 0),
            'client_name' => $client,
            'provider_name' => $providerLabel,
            'start_utc' => $start,
            'end_utc' => $end,
        ],
    ];
}

/**
 * Block save when provider overlaps DB sessions or pending windows in this request.
 *
 * @param array<int, array{start:string,end:string}> $pendingWindows
 */
function ensure_provider_schedule_clear(
    mysqli $conn,
    string $providerId,
    string $startUtc,
    string $endUtc,
    array $excludeSessionIds,
    array $pendingWindows,
    string $providerName
): void {
    $conflict = find_provider_schedule_conflict($conn, $providerId, $startUtc, $endUtc, $excludeSessionIds);
    if ($conflict) {
        throw new ProviderScheduleConflictException($conflict, $providerName);
    }

    foreach ($pendingWindows as $pending) {
        $pStart = (string)($pending['start'] ?? '');
        $pEnd = (string)($pending['end'] ?? '');
        if ($pStart === '' || $pEnd === '') {
            continue;
        }
        if (schedule_windows_overlap($startUtc, $endUtc, $pStart, $pEnd)) {
            throw new ProviderScheduleConflictException([
                'session_id' => 0,
                'client_name' => 'another session in this save',
                'provider_name' => $providerName,
                'start_utc' => $pStart,
                'end_utc' => $pEnd,
            ], $providerName);
        }
    }
}

function lock_provider_sessions_for_update(mysqli $conn, string $providerId): void
{
    if (trim($providerId) === '') {
        return;
    }
    $stmt = $conn->prepare('SELECT session_id FROM sessions WHERE provider_id = ? FOR UPDATE');
    if (!$stmt) {
        throw new Exception('Unable to lock provider schedule: ' . $conn->error);
    }
    $stmt->bind_param('s', $providerId);
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        throw new Exception('Unable to lock provider schedule: ' . $err);
    }
    $stmt->get_result();
    $stmt->close();
}

function build_claim_id($sessionId, $startUtc = null): string
{
    $datePart = date('Ymd');
    if (!empty($startUtc)) {
        $ts = strtotime((string)$startUtc);
        if ($ts !== false) {
            $datePart = gmdate('Ymd', $ts);
        }
    }
    return "CLM-{$datePart}-{$sessionId}";
}

function ensure_session_claim_ready(mysqli $conn, int $sessionId, $startUtc = null): void
{
    $cols = sessions_has_claim_columns($conn);
    if (!$cols['claim_id'] || !$cols['claim_status']) {
        return;
    }

    $stmt = $conn->prepare("SELECT claim_id, claim_status FROM sessions WHERE session_id = ? LIMIT 1");
    if (!$stmt) {
        return;
    }
    $stmt->bind_param("i", $sessionId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) {
        return;
    }

    $nextClaimId = trim((string)($row['claim_id'] ?? ''));
    $nextClaimStatus = trim((string)($row['claim_status'] ?? ''));
    if ($nextClaimId === '' && $cols['claim_id']) {
        $nextClaimId = build_claim_id($sessionId, $startUtc);
    }
    if ($nextClaimStatus === '' && $cols['claim_status']) {
        $nextClaimStatus = 'Ready to Bill';
    }

    if (($row['claim_id'] ?? '') === $nextClaimId && ($row['claim_status'] ?? '') === $nextClaimStatus) {
        return;
    }

    $upd = $conn->prepare("UPDATE sessions SET claim_id = ?, claim_status = ? WHERE session_id = ?");
    if (!$upd) {
        return;
    }
    $upd->bind_param("ssi", $nextClaimId, $nextClaimStatus, $sessionId);
    $upd->execute();
    $upd->close();
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

function buildRecurringOccurrenceStarts(DateTime $baseStart, string $frequency, array $days, string $endsType, ?string $endsDate, int $occurrences): array
{
    $results = [];
    $guard = 0;
    $maxGuard = 1500;
    $dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    $normalizedDays = array_values(array_intersect($days, $dayNames));
    $targetAdditional = max(0, $occurrences - 1);

    if ($frequency === 'Weekly' && count($normalizedDays) > 0) {
        $wanted = array_flip($normalizedDays);
        $scan = clone $baseStart;
        $scan->modify('+1 day');
        while ($guard < $maxGuard) {
            $guard++;
            if ($endsType === 'After' && count($results) >= $targetAdditional) break;
            if ($endsType === 'On' && $endsDate && $scan->format('Y-m-d') > $endsDate) break;
            $dn = $dayNames[(int)$scan->format('w')];
            if (isset($wanted[$dn])) {
                $results[] = clone $scan;
            }
            $scan->modify('+1 day');
        }
        return $results;
    }

    $step = '+1 day';
    if ($frequency === 'Weekly') $step = '+7 days';
    if ($frequency === 'Biweekly') $step = '+14 days';
    if ($frequency === 'Monthly') $step = '+1 month';

    $scan = clone $baseStart;
    while ($guard < $maxGuard) {
        $guard++;
        $scan->modify($step);
        if ($endsType === 'After') {
            if (count($results) >= $targetAdditional) break;
            $results[] = clone $scan;
            if (count($results) >= $targetAdditional) break;
        } else { // On
            if ($endsDate && $scan->format('Y-m-d') > $endsDate) break;
            $results[] = clone $scan;
        }
    }
    return $results;
}

/**
 * Some DBs use client_auth.auth_id as PK; others use client_auth.id with auth_id nullable.
 * Scheduling sends the numeric PK from the API (may be id). Build WHERE that matches either column when both exist.
 *
 * @return array{clause: string, dual: bool}
 */
function client_auth_identifier_where(mysqli $conn, string $tableAlias = ''): array
{
    static $cache = [];
    $key = $tableAlias;
    if (isset($cache[$key])) {
        return $cache[$key];
    }
    $hasAuthId = false;
    $hasId = false;
    $r = @$conn->query("SHOW COLUMNS FROM `client_auth`");
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $f = $row['Field'] ?? '';
            if ($f === 'auth_id') {
                $hasAuthId = true;
            }
            if ($f === 'id') {
                $hasId = true;
            }
        }
        $r->free();
    }
    $p = $tableAlias;
    if ($hasAuthId && $hasId) {
        $cache[$key] = ['clause' => "({$p}auth_id = ? OR {$p}id = ?)", 'dual' => true];
    } elseif ($hasId && !$hasAuthId) {
        $cache[$key] = ['clause' => "{$p}id = ?", 'dual' => false];
    } else {
        $cache[$key] = ['clause' => "{$p}auth_id = ?", 'dual' => false];
    }
    return $cache[$key];
}

function updateClientAuthUnitsScheduled($conn, $clientId, $authId, $hoursToAdd)
{
    if (!$authId) {
        throw new Exception("auth_id is required");
    }

    $match = client_auth_identifier_where($conn, '');

    // Step 1: Verify authorization row exists
    $checkStmt = $conn->prepare("SELECT insurance_id, balance_units FROM client_auth WHERE {$match['clause']}");
    if ($match['dual']) {
        $checkStmt->bind_param("ii", $authId, $authId);
    } else {
        $checkStmt->bind_param("i", $authId);
    }
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
    $stmt = $conn->prepare(
        "SELECT balance_units, status FROM client_auth WHERE {$match['clause']} AND UPPER(TRIM(IFNULL(status,''))) = 'ACTIVE'"
    );
    if ($match['dual']) {
        $stmt->bind_param("ii", $authId, $authId);
    } else {
        $stmt->bind_param("i", $authId);
    }
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
    $stmt = $conn->prepare("UPDATE client_auth SET balance_units = ? WHERE {$match['clause']}");
    $newBalanceStr = number_format($newBalance, 2, '.', ''); // Format as string for VARCHAR
    if ($match['dual']) {
        $stmt->bind_param("sii", $newBalanceStr, $authId, $authId);
    } else {
        $stmt->bind_param("si", $newBalanceStr, $authId);
    }
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

require_once __DIR__ . '/config.php';

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

            $authUser = getAuthenticatedUser();
            if ($authUser) {
                rbac_enforce_session_action($authUser, $conn, 'create', $provider);
            }
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
            // Accept camelCase or snake_case from API / scheduling-view payload
            $authorizedHoursRaw = $input['authorizedHours'] ?? $input['authorized_hours'] ?? null;
            $scheduledHoursRaw = $input['scheduledHours'] ?? $input['scheduled_hours'] ?? null;
            $renderedHoursRaw = $input['renderedHours'] ?? $input['rendered_hours'] ?? null;

            $authorizedHours = $authorizedHoursRaw !== null && $authorizedHoursRaw !== ''
                ? (string) floatval($authorizedHoursRaw)
                : '0.00';
            $scheduledHours = $scheduledHoursRaw !== null && $scheduledHoursRaw !== ''
                ? (string) floatval($scheduledHoursRaw)
                : null;
            $renderedHours = $renderedHoursRaw !== null && $renderedHoursRaw !== ''
                ? (string) floatval($renderedHoursRaw)
                : '0.00';

            // Validate auth / balance (match active auth + client's insurance). Identifier may be auth_id OR id column.
            $caMatch = client_auth_identifier_where($conn, 'ca.');
            $sqlAuthValidate = "
        SELECT ca.insurance_id, ca.status, ca.balance_units, ci.client_id
        FROM client_auth ca
        INNER JOIN client_insurance ci ON ca.insurance_id = ci.insurance_id AND ci.client_id = ?
        WHERE {$caMatch['clause']} AND UPPER(TRIM(IFNULL(ca.status,''))) = 'ACTIVE'
    ";
            $stmt = $conn->prepare($sqlAuthValidate);
            if ($caMatch['dual']) {
                $stmt->bind_param("sii", $clientId, $authId, $authId);
            } else {
                $stmt->bind_param("si", $clientId, $authId);
            }
            $stmt->execute();
            $result = $stmt->get_result();
            $authData = $result->fetch_assoc();
            $stmt->close();

            if (!$authData) {
                // Diagnose so UI / admins get a precise reason (not only debug.log)
                $why = ['auth_id' => $authId, 'client_id' => $clientId];
                $diagMatch = client_auth_identifier_where($conn, '');
                $chk = $conn->prepare(
                    "SELECT * FROM client_auth WHERE {$diagMatch['clause']} LIMIT 1"
                );
                if ($diagMatch['dual']) {
                    $chk->bind_param("ii", $authId, $authId);
                } else {
                    $chk->bind_param("i", $authId);
                }
                $chk->execute();
                $rowAuth = $chk->get_result()->fetch_assoc();
                $chk->close();

                if (!$rowAuth) {
                    $why['reason'] = 'authorization_row_not_found';
                    $why['hint'] =
                        'No client_auth row matches this id on the API database. '
                        . 'If scheduling shows an auth from another environment, fix NEXT_PUBLIC_BASE_URL / DB parity. '
                        . 'Otherwise re-save the client\'s authorizations.';
                } else {
                    $why['auth_status_db'] = $rowAuth['status'];
                    $why['insurance_id'] = $rowAuth['insurance_id'];
                    $activeOk = preg_match('/^active$/i', trim((string) ($rowAuth['status'] ?? ''))) === 1;
                    if (!$activeOk) {
                        $why['reason'] = 'authorization_not_active';
                        $why['hint'] = 'Open the client profile and set this authorization status to Active in client_auth.';
                    } else {
                        $lnk = $conn->prepare(
                            "SELECT insurance_id FROM client_insurance WHERE insurance_id = ? AND client_id = ? LIMIT 1"
                        );
                        $lnk->bind_param("is", $rowAuth['insurance_id'], $clientId);
                        $lnk->execute();
                        $hasLink = $lnk->get_result()->fetch_assoc();
                        $lnk->close();
                        if (!$hasLink) {
                            $why['reason'] = 'insurance_not_linked_to_client';
                            $why['hint'] =
                                'This authorization\'s insurance_id is not attached to this client_id in client_insurance. '
                                . 'Fix client insurances so the authorization\'s insurance belongs to this client.';
                        } else {
                            $why['reason'] = 'authorization_validation_failed';
                            $why['hint'] = 'Unexpected validation failure — check DB consistency.';
                        }
                    }
                }

                file_put_contents(
                    'debug.log',
                    "POST auth validation failed: " . json_encode($why, JSON_UNESCAPED_UNICODE) . "\n",
                    FILE_APPEND
                );

                http_response_code(400);
                echo json_encode(array_merge([
                    'error' => 'Invalid or inactive auth_id, or auth_id does not belong to client',
                ], $why));
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

            $sessionsHasAuthorizedHours = sessions_has_authorized_hours_column($conn);

            // Build occurrence list before transaction (also used for double-book check).
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

            $conn->begin_transaction();
            try {
                $sessionIds = [];
                lock_provider_sessions_for_update($conn, $provider);
                $pendingScheduleWindows = [];

                if ($sessionsHasAuthorizedHours) {
                    $stmt = $conn->prepare("
            INSERT INTO sessions (
                client_id, provider_id, provider_name, supervising_provider_id, supervising_provider_name,
                start_utc, end_utc, start_tz, end_tz, auth_code, recurring, recurring_days, place_of_service,
                location_address, quick_note, status, authorized_hours, scheduled_hours, rendered_hours,
                recurring_id, auth_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
                } else {
                    $stmt = $conn->prepare("
            INSERT INTO sessions (
                client_id, provider_id, provider_name, supervising_provider_id, supervising_provider_name,
                start_utc, end_utc, start_tz, end_tz, auth_code, recurring, recurring_days, place_of_service,
                location_address, quick_note, status, scheduled_hours, rendered_hours,
                recurring_id, auth_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
                }

                $totalScheduledHours = 0;
                foreach ($sessionsToCreate as $session) {
                    ensure_provider_schedule_clear(
                        $conn,
                        $provider,
                        $session['start'],
                        $session['end'],
                        [],
                        $pendingScheduleWindows,
                        $providerName
                    );

                    $sessionScheduledHours = $scheduledHours !== null
                        ? (string)floatval($scheduledHours)
                        : (string)computeScheduledHours($session['start'], $session['end']);

                    $recurring_id = $recurringFrequency !== 'No' ? $recurringId : null;

                    if ($sessionsHasAuthorizedHours) {
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
                    } else {
                        $stmt->bind_param(
                            "ssssssssssssssssddii",
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
                            $sessionScheduledHours,
                            $renderedHours,
                            $recurring_id,
                            $authId
                        );
                    }

                    if ($stmt->execute()) {
                        $sessionIds[] = $stmt->insert_id;
                        $totalScheduledHours += floatval($sessionScheduledHours);
                        $pendingScheduleWindows[] = [
                            'start' => $session['start'],
                            'end' => $session['end'],
                        ];
                        file_put_contents('debug.log', "Inserted session_id: {$stmt->insert_id}, start_utc: {$session['start']}, scheduled_hours: $sessionScheduledHours\n", FILE_APPEND);
                        if (session_is_completed_status($status)) {
                            ensure_session_claim_ready($conn, (int)$stmt->insert_id, $session['start']);
                        }
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
            } catch (ProviderScheduleConflictException $e) {
                $conn->rollback();
                http_response_code(409);
                echo json_encode($e->getPayload());
                file_put_contents('debug.log', "POST provider conflict: " . $e->getMessage() . "\n", FILE_APPEND);
                exit();
            } catch (Exception $e) {
                $conn->rollback();
                http_response_code(500);
                echo json_encode([
                    "error" => "Failed to create sessions: " . $e->getMessage(),
                    "payload" => $input,
                    "auth_id" => $authId,
                    "client_id" => $clientId,
                    "success" => false,
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

            $sessionsHasAuthorizedHours = sessions_has_authorized_hours_column($conn);
            $authHoursSelect = $sessionsHasAuthorizedHours ? ', authorized_hours' : '';

            // Get the current session
            $stmt = $conn->prepare("
        SELECT client_id, auth_id, provider_id, provider_name, supervising_provider_id, supervising_provider_name,
               start_utc, end_utc, start_tz, end_tz, auth_code, place_of_service, location_address,
               quick_note, recurring, recurring_days, status{$authHoursSelect}, scheduled_hours, rendered_hours, recurring_id
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

            $incomingRecurring = is_array($input['recurring'] ?? null) ? $input['recurring'] : null;
            $hasRecurringPayload = is_array($incomingRecurring);
            $targetRecurringFrequency = $hasRecurringPayload
                ? (string)($incomingRecurring['frequency'] ?? 'No')
                : (string)($currentSession['recurring'] ?? 'No');
            if ($targetRecurringFrequency === '' || $targetRecurringFrequency === 'Never') {
                $targetRecurringFrequency = 'No';
            }
            if (!in_array($targetRecurringFrequency, ['No', 'Daily', 'Weekly', 'Biweekly', 'Monthly'], true)) {
                http_response_code(400);
                echo json_encode(["error" => "Invalid recurring frequency in update"]);
                exit();
            }

            $targetRecurringDays = null;
            if ($targetRecurringFrequency === 'Weekly') {
                if ($hasRecurringPayload && !empty($incomingRecurring['days']) && is_array($incomingRecurring['days'])) {
                    $targetRecurringDays = implode(',', $incomingRecurring['days']);
                } else {
                    $targetRecurringDays = $currentSession['recurring_days'] ?? null;
                }
            }

            $targetRecurringId = $currentSession['recurring_id'] ?? null;
            if ($targetRecurringFrequency === 'No') {
                $targetRecurringId = null;
            } elseif (empty($targetRecurringId)) {
                $targetRecurringId = (int)(microtime(true) * 10000) . rand(1000, 9999);
            }

            $authUserPut = getAuthenticatedUser();
            if ($authUserPut) {
                $noteAction = 'update';
                if (
                    isset($input['quickNote']) &&
                    trim((string) $input['quickNote']) !== '' &&
                    empty($input['startDateTime']) &&
                    empty($input['endDateTime'])
                ) {
                    $noteAction = 'notes';
                }
                rbac_enforce_session_action($authUserPut, $conn, $noteAction, $currentSession['provider_id'] ?? null);
            }

            $conn->begin_transaction();
            try {
                $sessionsToUpdate = [];
                if ($editMode === 'recurring' && !empty($currentSession['recurring_id'])) {
                    $stmt = $conn->prepare("SELECT session_id, client_id, auth_id, start_utc, end_utc, scheduled_hours, status FROM sessions WHERE recurring_id = ?");
                    $stmt->bind_param("i", $currentSession['recurring_id']);
                    $stmt->execute();
                    $result = $stmt->get_result();
                    while ($row = $result->fetch_assoc()) {
                        $sessionsToUpdate[] = [
                            'session_id' => $row['session_id'],
                            'client_id' => $row['client_id'],
                            'auth_id' => $row['auth_id'],
                            'start_utc' => $row['start_utc'],
                            'end_utc' => $row['end_utc'],
                            'scheduled_hours' => $row['scheduled_hours'],
                            'status' => $row['status']
                        ];
                    }
                    $stmt->close();
                    file_put_contents('debug.log', "Edit Mode: RECURRING - Found " . count($sessionsToUpdate) . " sessions to update with recurring_id: {$currentSession['recurring_id']}\n", FILE_APPEND);
                } else {
                    $sessionsToUpdate[] = [
                        'session_id' => $sessionId,
                        'client_id' => $currentSession['client_id'],
                        'auth_id' => $currentSession['auth_id'],
                        'start_utc' => $currentSession['start_utc'],
                        'end_utc' => $currentSession['end_utc'],
                        'scheduled_hours' => $currentSession['scheduled_hours'],
                        'status' => $currentSession['status']
                    ];
                    file_put_contents('debug.log', "Edit Mode: SINGLE - Updating session_id: $sessionId\n", FILE_APPEND);
                }

                $allExcludeSessionIds = array_values(array_unique(array_map(
                    static fn($s) => (int)$s['session_id'],
                    $sessionsToUpdate
                )));
                $providerForLock = isset($input['provider'])
                    ? (string)$input['provider']
                    : (string)($currentSession['provider_id'] ?? '');
                lock_provider_sessions_for_update($conn, $providerForLock);
                $pendingPutWindows = [];

                $rowsAffected = 0;
                $totalHoursChange = 0;
                $totalAuthDelta = 0;
                $includeCancelFields =
                    array_key_exists('cancelledBy', $input) ||
                    array_key_exists('cancelledReason', $input) ||
                    (isset($input['status']) && strcasecmp((string)$input['status'], 'Cancelled') === 0);

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
                        if (isset($input['status'])) {
                            $status = ucfirst(strtolower((string)$input['status']));
                        } else {
                            $status = $currentSession['status'];
                        }
                    }
                    $authorizedHours = isset($input['authorizedHours'])
                        ? floatval($input['authorizedHours'])
                        : (isset($input['authorized_hours']) ? floatval($input['authorized_hours']) : floatval($currentSession['authorized_hours'] ?? '0.00'));
                    $scheduledHours = isset($input['scheduledHours'])
                        ? floatval($input['scheduledHours'])
                        : (isset($input['scheduled_hours']) ? floatval($input['scheduled_hours']) : floatval($currentSession['scheduled_hours']));
                    $renderedHours = isset($input['renderedHours'])
                        ? floatval($input['renderedHours'])
                        : (isset($input['rendered_hours']) ? floatval($input['rendered_hours']) : floatval($currentSession['rendered_hours'] ?? '0.00'));

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

                    $lockRow = array_merge($currentSession, $session);
                    if (session_row_is_completed($lockRow)) {
                        $clientId = (string)$currentSession['client_id'];
                        $provider = (string)$currentSession['provider_id'];
                        $providerName = (string)$currentSession['provider_name'];
                        $supervisingProvider = (string)($currentSession['supervising_provider_id'] ?? '');
                        $supervisingProviderName = (string)($currentSession['supervising_provider_name'] ?? '');
                        $authCode = (string)$currentSession['auth_code'];
                        $quickNote = (string)($currentSession['quick_note'] ?? '');
                        $status = ucfirst(strtolower((string)($currentSession['status'] ?? 'Rendered')));
                        $renderedHours = floatval($currentSession['rendered_hours'] ?? 0);
                        $authorizedHours = floatval($currentSession['authorized_hours'] ?? 0);
                        $targetRecurringFrequency = (string)($currentSession['recurring'] ?? 'No');
                        $targetRecurringDays = $currentSession['recurring_days'] ?? null;
                        $targetRecurringId = $currentSession['recurring_id'] ?? null;
                    }

                    if (!session_status_is_cancelled($status)) {
                        ensure_provider_schedule_clear(
                            $conn,
                            $provider,
                            $startUtc,
                            $endUtc,
                            $allExcludeSessionIds,
                            $pendingPutWindows,
                            $providerName
                        );
                    }

                    $hoursChange = $scheduledHours - $originalScheduledHours;
                    $totalHoursChange += $hoursChange;

                    file_put_contents('debug.log', "Updating session_id: $sessionId with hours change: $hoursChange\n", FILE_APPEND);

                    // Auth balance delta must reflect both hours changes and cancellation/uncancellation.
                    $originalStatus = ucfirst(strtolower((string)($session['status'] ?? $currentSession['status'] ?? 'Scheduled')));
                    $newStatus = ucfirst(strtolower((string)($status ?? 'Scheduled')));
                    $oldActive = strtolower($originalStatus) !== 'cancelled';
                    $newActive = strtolower($newStatus) !== 'cancelled';

                    if ($oldActive && $newActive) {
                        // still active: only adjust by the scheduled hours difference
                        $totalAuthDelta += -($scheduledHours - $originalScheduledHours);
                    } elseif ($oldActive && !$newActive) {
                        // cancelling: return the previously scheduled hours
                        $totalAuthDelta += $originalScheduledHours;
                    } elseif (!$oldActive && $newActive) {
                        // un-cancelling: reserve hours again
                        $totalAuthDelta += -$scheduledHours;
                    }

                    $authHoursSet = $sessionsHasAuthorizedHours ? "authorized_hours = ?,\n                    " : "";

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
                    recurring = ?,
                    recurring_days = ?,
                    recurring_id = ?,
                    STATUS = ?,
                    " . ($includeCancelFields ? "cancelled_by = ?, cancelled_reason = ?," : "") . "
                    {$authHoursSet}scheduled_hours = ?,
                    rendered_hours = ?
                WHERE session_id = ?
            ";

                    $updateStmt = $conn->prepare($updateSql);
                    if (!$updateStmt) {
                        throw new Exception("Prepare failed: " . $conn->error);
                    }

                    if ($includeCancelFields) {
                        $cancelledBy = isset($input['cancelledBy']) ? (string)$input['cancelledBy'] : null;
                        $cancelledReason = isset($input['cancelledReason']) ? (string)$input['cancelledReason'] : null;
                        if (strtolower($newStatus) === 'cancelled') {
                            if (empty(trim((string)$cancelledReason))) {
                                throw new Exception("Cancellation reason is required when setting status to Cancelled");
                            }
                            if (!in_array($cancelledBy, ['Client', 'Staff'], true)) {
                                throw new Exception("Invalid cancelledBy value. Must be 'Client' or 'Staff'");
                            }
                        } else {
                            // For non-cancelled updates, don't change these fields unless explicitly cancelling.
                            $cancelledBy = null;
                            $cancelledReason = null;
                        }

                        if ($sessionsHasAuthorizedHours) {
                            $updateStmt->bind_param(
                                "ssssssssssssssssssidddi",
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
                                $targetRecurringFrequency,
                                $targetRecurringDays,
                                $targetRecurringId,
                                $status,
                                $cancelledBy,
                                $cancelledReason,
                                $authorizedHours,
                                $scheduledHours,
                                $renderedHours,
                                $sessionId
                            );
                        } else {
                            $updateStmt->bind_param(
                                "ssssssssssssssssssiddi",
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
                                $targetRecurringFrequency,
                                $targetRecurringDays,
                                $targetRecurringId,
                                $status,
                                $cancelledBy,
                                $cancelledReason,
                                $scheduledHours,
                                $renderedHours,
                                $sessionId
                            );
                        }
                    } else {
                        if ($sessionsHasAuthorizedHours) {
                            $updateStmt->bind_param(
                                "ssssssssssssssssidddi",
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
                                $targetRecurringFrequency,
                                $targetRecurringDays,
                                $targetRecurringId,
                                $status,
                                $authorizedHours,
                                $scheduledHours,
                                $renderedHours,
                                $sessionId
                            );
                        } else {
                            $updateStmt->bind_param(
                                "ssssssssssssssssiddi",
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
                                $targetRecurringFrequency,
                                $targetRecurringDays,
                                $targetRecurringId,
                                $status,
                                $scheduledHours,
                                $renderedHours,
                                $sessionId
                            );
                        }
                    }

                    if (!$updateStmt->execute()) {
                        throw new Exception("Failed to update session_id: $sessionId - " . $updateStmt->error);
                    }

                    $rowsAffected += $updateStmt->affected_rows;
                    $updateStmt->close();
                    if (!session_status_is_cancelled($status)) {
                        $pendingPutWindows[] = [
                            'start' => $startUtc,
                            'end' => $endUtc,
                        ];
                    }
                    if (session_is_completed_status($status)) {
                        ensure_session_claim_ready($conn, $sessionId, $startUtc);
                    }
                    file_put_contents('debug.log', "Successfully updated session_id: $sessionId\n", FILE_APPEND);
                }

                // If recurring payload is present, ensure requested occurrences exist.
                $createdSessionIds = [];
                if ($hasRecurringPayload && $targetRecurringFrequency !== 'No') {
                    $baseStartUtc = isset($input['startDateTime']) ? convertToMySQLDateTime($input['startDateTime']) : $currentSession['start_utc'];
                    $baseEndUtc = isset($input['endDateTime']) ? convertToMySQLDateTime($input['endDateTime']) : $currentSession['end_utc'];
                    $baseStartDt = new DateTime($baseStartUtc, new DateTimeZone('UTC'));
                    $baseEndDt = new DateTime($baseEndUtc, new DateTimeZone('UTC'));
                    $durationSec = max(0, $baseEndDt->getTimestamp() - $baseStartDt->getTimestamp());

                    $ends = is_array($incomingRecurring['ends'] ?? null) ? $incomingRecurring['ends'] : [];
                    $endsType = (string)($ends['type'] ?? 'After');
                    if ($endsType !== 'On' && $endsType !== 'After') {
                        $endsType = 'After';
                    }
                    $endsDate = !empty($ends['date']) ? (string)$ends['date'] : null;
                    $occurrences = (int)($ends['occurrences'] ?? 1);
                    $weeklyDays = is_array($incomingRecurring['days'] ?? null) ? $incomingRecurring['days'] : [];

                    $desiredAdditionalStarts = buildRecurringOccurrenceStarts(
                        $baseStartDt,
                        $targetRecurringFrequency,
                        $weeklyDays,
                        $endsType,
                        $endsDate,
                        $occurrences
                    );
                    $desiredStartMap = [];
                    $desiredStartMap[$baseStartDt->format('Y-m-d H:i:s')] = true;
                    foreach ($desiredAdditionalStarts as $d) {
                        $desiredStartMap[$d->format('Y-m-d H:i:s')] = true;
                    }

                    $existingStartMap = [];
                    if (!empty($targetRecurringId)) {
                        $existStmt = $conn->prepare("SELECT start_utc FROM sessions WHERE recurring_id = ?");
                        if ($existStmt) {
                            $existStmt->bind_param("i", $targetRecurringId);
                            $existStmt->execute();
                            $existRes = $existStmt->get_result();
                            while ($er = $existRes->fetch_assoc()) {
                                $existingStartMap[(string)$er['start_utc']] = true;
                            }
                            $existStmt->close();
                        }
                    }

                    if ($sessionsHasAuthorizedHours) {
                        $insertStmt = $conn->prepare("
                            INSERT INTO sessions (
                                client_id, provider_id, provider_name, supervising_provider_id, supervising_provider_name,
                                start_utc, end_utc, start_tz, end_tz, auth_code, recurring, recurring_days, place_of_service,
                                location_address, quick_note, status, authorized_hours, scheduled_hours, rendered_hours,
                                recurring_id, auth_id
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ");
                    } else {
                        $insertStmt = $conn->prepare("
                            INSERT INTO sessions (
                                client_id, provider_id, provider_name, supervising_provider_id, supervising_provider_name,
                                start_utc, end_utc, start_tz, end_tz, auth_code, recurring, recurring_days, place_of_service,
                                location_address, quick_note, status, scheduled_hours, rendered_hours,
                                recurring_id, auth_id
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ");
                    }
                    if (!$insertStmt) {
                        throw new Exception("Failed to prepare recurring insert statement");
                    }

                    foreach (array_keys($desiredStartMap) as $occStartUtc) {
                        if (isset($existingStartMap[$occStartUtc])) {
                            continue;
                        }
                        $occStart = new DateTime($occStartUtc, new DateTimeZone('UTC'));
                        $occEnd = clone $occStart;
                        $occEnd->modify("+{$durationSec} seconds");
                        $occEndUtc = $occEnd->format('Y-m-d H:i:s');

                        if (!session_status_is_cancelled($status)) {
                            ensure_provider_schedule_clear(
                                $conn,
                                $provider,
                                $occStartUtc,
                                $occEndUtc,
                                $allExcludeSessionIds,
                                $pendingPutWindows,
                                $providerName
                            );
                        }

                        if ($sessionsHasAuthorizedHours) {
                            $insertStmt->bind_param(
                                "ssssssssssssssssdddii",
                                $clientId,
                                $provider,
                                $providerName,
                                $supervisingProvider,
                                $supervisingProviderName,
                                $occStartUtc,
                                $occEndUtc,
                                $startTz,
                                $endTz,
                                $authCode,
                                $targetRecurringFrequency,
                                $targetRecurringDays,
                                $placeOfService,
                                $locationAddress,
                                $quickNote,
                                $status,
                                $authorizedHours,
                                $scheduledHours,
                                $renderedHours,
                                $targetRecurringId,
                                $authId
                            );
                        } else {
                            $insertStmt->bind_param(
                                "ssssssssssssssssddii",
                                $clientId,
                                $provider,
                                $providerName,
                                $supervisingProvider,
                                $supervisingProviderName,
                                $occStartUtc,
                                $occEndUtc,
                                $startTz,
                                $endTz,
                                $authCode,
                                $targetRecurringFrequency,
                                $targetRecurringDays,
                                $placeOfService,
                                $locationAddress,
                                $quickNote,
                                $status,
                                $scheduledHours,
                                $renderedHours,
                                $targetRecurringId,
                                $authId
                            );
                        }

                        if (!$insertStmt->execute()) {
                            throw new Exception("Failed creating recurring occurrence: " . $insertStmt->error);
                        }
                        $newSessionId = (int)$insertStmt->insert_id;
                        $createdSessionIds[] = $newSessionId;
                        $allExcludeSessionIds[] = $newSessionId;
                        if (!session_status_is_cancelled($status)) {
                            $pendingPutWindows[] = [
                                'start' => $occStartUtc,
                                'end' => $occEndUtc,
                            ];
                        }
                        if (session_is_completed_status($status)) {
                            ensure_session_claim_ready($conn, $newSessionId, $occStartUtc);
                        }
                    }
                    $insertStmt->close();

                    if (strtolower((string)$status) !== 'cancelled') {
                        $totalAuthDelta += -(count($createdSessionIds) * (float)$scheduledHours);
                    }
                    file_put_contents('debug.log', "Recurring ensure created " . count($createdSessionIds) . " additional sessions.\n", FILE_APPEND);
                }

                // Update auth balance based on active-session delta (covers cancel/uncancel, hour changes, and new recurring occurrences)
                $authId = isset($input['authId']) && $input['authId'] !== null ? (int)$input['authId'] : $currentSession['auth_id'];
                if ($totalAuthDelta != 0 && !empty($authId)) {
                    if (!updateClientAuthUnitsScheduled($conn, $currentSession['client_id'], $authId, $totalAuthDelta)) {
                        throw new Exception("Failed to update client_auth balance_units");
                    }
                } else {
                    file_put_contents('debug.log', "Skipped updateClientAuthUnitsScheduled: auth_id=$authId or no auth delta ($totalAuthDelta)\n", FILE_APPEND);
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
                    "sessions_created" => $createdSessionIds,
                    "recurring_id" => $targetRecurringId,
                    "total_hours_change" => $totalHoursChange
                ]);
            } catch (ProviderScheduleConflictException $e) {
                $conn->rollback();
                http_response_code(409);
                echo json_encode($e->getPayload());
                file_put_contents('debug.log', "PUT provider conflict: " . $e->getMessage() . "\n", FILE_APPEND);
                exit();
            } catch (Exception $e) {
                $conn->rollback();
                http_response_code(500);
                echo json_encode([
                    "error" => "Failed to update sessions: " . $e->getMessage(),
                    "success" => false,
                ]);
                file_put_contents('debug.log', "PUT Transaction failed: " . $e->getMessage() . "\n", FILE_APPEND);
                exit();
            }
            break;

        // DELETE Case: Hard delete single or recurring sessions
        case "DELETE":
            if (!isset($input['session_id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Session ID required in payload"]);
                exit();
            }

            $sessionId = (int)$input['session_id'];
            $editMode = isset($input['editMode']) ? (string)$input['editMode'] : 'single';

            $conn->begin_transaction();
            try {
                $stmt = $conn->prepare("SELECT session_id, client_id, auth_id, recurring_id, scheduled_hours, status, provider_id FROM sessions WHERE session_id = ?");
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

                $authUserDel = getAuthenticatedUser();
                if ($authUserDel) {
                    rbac_enforce_session_action($authUserDel, $conn, 'delete', $currentSession['provider_id'] ?? null);
                }

                $sessionsToDelete = [];
                if ($editMode === 'recurring' && !empty($currentSession['recurring_id'])) {
                    $stmt = $conn->prepare("SELECT session_id, client_id, auth_id, scheduled_hours, status FROM sessions WHERE recurring_id = ?");
                    $stmt->bind_param("i", $currentSession['recurring_id']);
                    $stmt->execute();
                    $result = $stmt->get_result();
                    while ($row = $result->fetch_assoc()) {
                        $sessionsToDelete[] = $row;
                    }
                    $stmt->close();
                    file_put_contents('debug.log', "DELETE Mode: RECURRING - Found " . count($sessionsToDelete) . " sessions to delete with recurring_id: {$currentSession['recurring_id']}\n", FILE_APPEND);
                } else {
                    $sessionsToDelete[] = $currentSession;
                    file_put_contents('debug.log', "DELETE Mode: SINGLE - Deleting session_id: $sessionId\n", FILE_APPEND);
                }

                // Return scheduled hours to authorization balance for sessions that are not already cancelled
                $hoursReturnByAuth = []; // key: client_id|auth_id => float hours
                foreach ($sessionsToDelete as $s) {
                    $clientId = (string)($s['client_id'] ?? '');
                    $authId = isset($s['auth_id']) ? (int)$s['auth_id'] : 0;
                    if (!$clientId || !$authId) continue;

                    $status = strtolower(trim((string)($s['status'] ?? '')));
                    if ($status === 'cancelled') {
                        continue; // avoid double returning hours
                    }

                    $hrs = (float)($s['scheduled_hours'] ?? 0);
                    if ($hrs == 0) continue;
                    $key = $clientId . '|' . $authId;
                    $hoursReturnByAuth[$key] = ($hoursReturnByAuth[$key] ?? 0) + $hrs;
                }

                // Delete sessions
                $rowsAffected = 0;
                $deletedIds = array_map(function ($s) {
                    return (int)$s['session_id'];
                }, $sessionsToDelete);

                if ($editMode === 'recurring' && !empty($currentSession['recurring_id'])) {
                    $stmt = $conn->prepare("DELETE FROM sessions WHERE recurring_id = ?");
                    $stmt->bind_param("i", $currentSession['recurring_id']);
                    if (!$stmt->execute()) {
                        throw new Exception("Failed to delete recurring sessions: " . $stmt->error);
                    }
                    $rowsAffected = $stmt->affected_rows;
                    $stmt->close();
                } else {
                    $stmt = $conn->prepare("DELETE FROM sessions WHERE session_id = ?");
                    $stmt->bind_param("i", $sessionId);
                    if (!$stmt->execute()) {
                        throw new Exception("Failed to delete session: " . $stmt->error);
                    }
                    $rowsAffected = $stmt->affected_rows;
                    $stmt->close();
                }

                // Update auth balances
                $totalHoursReturned = 0;
                foreach ($hoursReturnByAuth as $key => $hrs) {
                    [$clientId, $authIdStr] = explode('|', $key);
                    $authId = (int)$authIdStr;
                    if ($hrs != 0) {
                        $totalHoursReturned += (float)$hrs;
                        if (!updateClientAuthUnitsScheduled($conn, $clientId, $authId, (float)$hrs)) {
                            throw new Exception("Failed to update client_auth balance_units for auth_id=$authId");
                        }
                    }
                }

                $conn->commit();
                echo json_encode([
                    "success" => true,
                    "message" => "Session(s) deleted successfully",
                    "rows_affected" => $rowsAffected,
                    "edit_mode" => $editMode,
                    "sessions_deleted" => $deletedIds,
                    "total_hours_returned" => $totalHoursReturned
                ]);
            } catch (Exception $e) {
                $conn->rollback();
                http_response_code(500);
                echo json_encode(["error" => "Failed to delete session(s): " . $e->getMessage()]);
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

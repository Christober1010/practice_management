<?php
/** Shared scheduling session helpers + create (used by add-session.php and import-sessions.php). */

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

/** True when sessions.exclude_session (Yes/No) exists. */
function sessions_has_exclude_session_column(mysqli $conn): bool
{
    static $cachedTrue = false;
    // Only cache positive results — a prior "missing" check must not stick after ALTER.
    if ($cachedTrue) {
        return true;
    }
    $r = @$conn->query("SHOW COLUMNS FROM `sessions` LIKE 'exclude_session'");
    $ok = ($r && $r->num_rows > 0);
    if ($r) {
        $r->free();
    }
    if ($ok) {
        $cachedTrue = true;
    }
    return $ok;
}

/** Normalize Exclude session to Yes|No (default No). */
function normalize_session_exclude_session($value): string
{
    if ($value === null || $value === '') {
        return 'No';
    }
    if (is_bool($value)) {
        return $value ? 'Yes' : 'No';
    }
    $normalized = strtolower(trim((string) $value));
    if (in_array($normalized, ['yes', 'y', '1', 'true'], true)) {
        return 'Yes';
    }
    return 'No';
}

/** True when sessions.service_type (Direct/Indirect) exists. */
function sessions_has_service_type_column(mysqli $conn): bool
{
    static $cachedTrue = false;
    if ($cachedTrue) {
        return true;
    }
    $r = @$conn->query("SHOW COLUMNS FROM `sessions` LIKE 'service_type'");
    $ok = ($r && $r->num_rows > 0);
    if ($r) {
        $r->free();
    }
    if ($ok) {
        $cachedTrue = true;
    }
    return $ok;
}

/** Normalize service type to Direct|Indirect (default Indirect). */
function normalize_session_service_type($value): string
{
    if ($value === null || $value === '') {
        return 'Indirect';
    }
    $normalized = strtolower(trim((string) $value));
    if (in_array($normalized, ['direct', 'd'], true)) {
        return 'Direct';
    }
    return 'Indirect';
}

/**
 * Persist service_type. Throws on prepare/execute failure when the column exists.
 * Throws if a non-default value is requested but the DB column is missing.
 */
function sessions_set_service_type(mysqli $conn, int $sessionId, string $serviceType, bool $requireColumn = false): void
{
    $value = normalize_session_service_type($serviceType);
    if (!sessions_has_service_type_column($conn)) {
        if ($requireColumn || $value === 'Direct') {
            throw new Exception(
                'service_type column is missing on sessions. Run migration/shared/sessions_add_service_type.sql'
            );
        }
        return;
    }
    $stmt = $conn->prepare("UPDATE sessions SET service_type = ? WHERE session_id = ?");
    if (!$stmt) {
        throw new Exception('Failed to prepare service_type update: ' . $conn->error);
    }
    $stmt->bind_param('si', $value, $sessionId);
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        throw new Exception('Failed to update service_type: ' . $err);
    }
    $stmt->close();
}

/**
 * Persist exclude_session. Throws on prepare/execute failure when the column exists.
 * Throws if an admin requests Yes/No but the DB column has not been migrated yet.
 */
function sessions_set_exclude_session(mysqli $conn, int $sessionId, string $excludeSession, bool $requireColumn = false): void
{
    if ($sessionId < 1) {
        return;
    }
    if (!sessions_has_exclude_session_column($conn)) {
        if ($requireColumn) {
            throw new Exception(
                'exclude_session column is missing on sessions. Run migration/shared/sessions_add_exclude_session.sql'
            );
        }
        return;
    }
    $value = normalize_session_exclude_session($excludeSession);
    $stmt = $conn->prepare("UPDATE sessions SET exclude_session = ? WHERE session_id = ?");
    if (!$stmt) {
        throw new Exception('Failed to prepare exclude_session update: ' . $conn->error);
    }
    $stmt->bind_param("si", $value, $sessionId);
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        throw new Exception('Failed to update exclude_session: ' . $err);
    }
    $stmt->close();
}

/**
 * Only admins may set Exclude session. Non-admins always keep $existingValue
 * (defaults to No on create).
 *
 * @param array|null $authUser
 * @param mixed $requestedValue from payload (null = not provided)
 * @param mixed $existingValue current DB value or 'No' for create
 */
function sessions_resolve_exclude_session_for_write($authUser, $requestedValue, $existingValue = 'No'): string
{
    $role = strtolower(trim((string) (($authUser['role'] ?? '') ?: '')));
    if ($role !== 'admin') {
        return normalize_session_exclude_session($existingValue);
    }
    if ($requestedValue === null || $requestedValue === '') {
        return normalize_session_exclude_session($existingValue);
    }
    return normalize_session_exclude_session($requestedValue);
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
    return 'CLM' . (int)$sessionId;
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

/**
 * Create scheduling session(s) — same logic as add-session.php POST.
 *
 * @param array{authUser?:array,dryRun?:bool,sendEmail?:bool,enforceRbac?:bool} $options
 * @return array{success:bool,_httpCode?:int,...}
 */
function mahaverse_create_scheduling_session(mysqli $conn, array $input, array $options = []): array
{
    $dryRun = !empty($options['dryRun']);
    $sendEmail = array_key_exists('sendEmail', $options) ? (bool)$options['sendEmail'] : true;
    $enforceRbac = array_key_exists('enforceRbac', $options) ? (bool)$options['enforceRbac'] : true;
    $authUserOpt = $options['authUser'] ?? null;

    $fail = static function (int $code, array $payload): array {
        return array_merge(['success' => false, '_httpCode' => $code], $payload);
    };

file_put_contents('debug.log', "Checking fields: clientId=" . ($input['clientId'] ?? 'missing') . ", provider=" . ($input['provider'] ?? 'missing') . ", providerName=" . ($input['providerName'] ?? 'missing') . ", startDateTime=" . ($input['startDateTime'] ?? 'missing') . ", endDateTime=" . ($input['endDateTime'] ?? 'missing') . ", authId=" . ($input['authId'] ?? 'missing') . "\n", FILE_APPEND);

    if (!isset($input['clientId'], $input['provider'], $input['providerName'], $input['startDateTime'], $input['endDateTime'], $input['authId'])) {
        return $fail(400, ['error' => 'Missing required fields', 'input' => $input]);
    }

$clientId = (string)$input['clientId'];
$provider = (string)$input['provider'];
$providerName = (string)$input['providerName'];

if ($enforceRbac && $authUserOpt !== null) {
    rbac_enforce_session_action($authUserOpt, $conn, 'create', $provider);
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
        return $fail(400, ['error' => 'Invalid recurring frequency']);
    }

$placeOfService = isset($input['placeOfService']) ? (string)$input['placeOfService'] : 'Clinic';
    if (!in_array($placeOfService, ['Home', 'Clinic', 'School', 'Virtual', 'Other'])) {
        return $fail(400, ['error' => 'Invalid place_of_service']);
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

$excludeSessionRaw = array_key_exists('excludeSession', $input) || array_key_exists('exclude_session', $input)
    ? ($input['excludeSession'] ?? $input['exclude_session'])
    : null;
$excludeSession = sessions_resolve_exclude_session_for_write(
    is_array($authUserOpt) ? $authUserOpt : null,
    $excludeSessionRaw,
    'No'
);

$serviceTypeRaw = $input['serviceType']
    ?? $input['service_type']
    ?? $input['direct_or_indirect_service']
    ?? $input['directOrIndirectService']
    ?? null;
$serviceType = normalize_session_service_type($serviceTypeRaw);

if (!in_array($status, ['Scheduled', 'Rendered', 'Cancelled'])) {
    return $fail(400, ['error' => "Invalid status. Must be 'Scheduled', 'Rendered', or 'Cancelled'"]);
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

    return $fail(400, array_merge(['error' => 'Invalid or inactive auth_id, or auth_id does not belong to client'], $why));
}

$currentBalance = (float)($authData['balance_units'] ?? '0.00'); // Cast VARCHAR to float
$totalScheduledHours = floatval($scheduledHours); // For single session
if ($currentBalance < $totalScheduledHours) {
    return $fail(400, ['error' => "Insufficient balance_units: available=$currentBalance, required=$totalScheduledHours"]);
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

// Dry-run: validate provider schedule conflicts without inserting (import validate).
if ($dryRun) {
    foreach ($sessionsToCreate as $session) {
        ensure_provider_schedule_clear(
            $conn,
            $provider,
            $session['start'],
            $session['end'],
            [],
            [],
            $providerName
        );
    }
    return [
        'success' => true,
        'ready' => true,
        'sessions_to_create' => count($sessionsToCreate),
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
            sessions_set_exclude_session(
                $conn,
                (int) $stmt->insert_id,
                $excludeSession,
                $excludeSession === 'Yes'
            );
            sessions_set_service_type(
                $conn,
                (int) $stmt->insert_id,
                $serviceType,
                $serviceType === 'Direct'
            );
            $totalScheduledHours += floatval($sessionScheduledHours);
            $pendingScheduleWindows[] = [
                'start' => $session['start'],
                'end' => $session['end'],
            ];
            file_put_contents('debug.log', "Inserted session_id: {$stmt->insert_id}, start_utc: {$session['start']}, scheduled_hours: $sessionScheduledHours\n", FILE_APPEND);
            session_persist_billing_rates(
                $conn,
                (int)$stmt->insert_id,
                $authId,
                $clientId,
                $authCode,
                $sessionScheduledHours,
                $renderedHours
            );
            session_persist_auth_service_fields($conn, (int)$stmt->insert_id, $authId);
            session_persist_taxonomy_code($conn, (int)$stmt->insert_id, $provider);
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
    $emailData = $sendEmail ? getEmailRecipients($conn, $clientId, $provider, $supervisingProvider) : null;

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
        return [
            'success' => true,
            'session_id' => $sessionIds[0],
            'session_ids' => $sessionIds,
            'sessions_created' => count($sessionIds),
            'recurring_id' => $recurringId,
            'total_scheduled_hours' => $totalScheduledHours,
        ];
    } catch (ProviderScheduleConflictException $e) {
        @$conn->rollback();
        file_put_contents('debug.log', 'POST provider conflict: ' . $e->getMessage() . "\n", FILE_APPEND);
        return $fail(409, $e->getPayload());
    } catch (Exception $e) {
        @$conn->rollback();
        file_put_contents('debug.log', 'POST Transaction failed: ' . $e->getMessage() . "\nPayload: " . json_encode($input) . "\n", FILE_APPEND);
        return $fail(500, [
            'error' => 'Failed to create sessions: ' . $e->getMessage(),
            'payload' => $input,
            'auth_id' => $authId ?? null,
            'client_id' => $clientId ?? null,
        ]);
    }
}

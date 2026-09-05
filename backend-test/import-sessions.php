<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Accept');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
require_once __DIR__ . '/scheduling_session_lib.php';
require_once __DIR__ . '/session_rate_lib.php';

$authUser = requireAuthAny(['scheduling.session.create', 'scheduling.write'], 'mahaverse');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$rows = isset($input['rows']) && is_array($input['rows']) ? $input['rows'] : [];
$validateOnly = !empty($input['validateOnly']);

if (!$rows) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No rows provided']);
    exit;
}

$conn = getDBConnection();
if (!$conn || $conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}
$conn->set_charset('utf8mb4');

/** Excel epoch offset (1900 date system) → Unix seconds for whole-day serials. */
function import_excel_day_serial_to_ymd($serial): ?string
{
    if ($serial === '' || $serial === null || !is_numeric($serial)) {
        return null;
    }
    $days = (int)floor((float)$serial);
    $seconds = ($days - 25569) * 86400;
    return gmdate('Y-m-d', $seconds);
}

/** Parse DOS cell → Y-m-d (Excel serial, ISO string, or datetime). */
function import_parse_excel_dos($value): ?string
{
    if ($value === '' || $value === null) {
        return null;
    }
    if (is_numeric($value)) {
        return import_excel_day_serial_to_ymd($value);
    }
    $s = trim((string)$value);
    if (preg_match('/^(\d{4}-\d{2}-\d{2})/', $s, $m)) {
        return $m[1];
    }
    $ts = strtotime($s);
    return $ts !== false ? gmdate('Y-m-d', $ts) : null;
}

/** Normalize H:i or H:i:s → H:i:s. */
function import_normalize_hms(string $time): string
{
    $time = trim($time);
    if (preg_match('/^\d{1,2}:\d{2}$/', $time)) {
        return $time . ':00';
    }
    return $time;
}

/**
 * Excel Apt times are clinic-local wall clocks (America/Chicago), not UTC.
 * Convert "Y-m-d H:i:s" local → true UTC for sessions.start_utc.
 */
function import_local_wall_to_utc(?string $localYmdHis, string $tz = 'America/Chicago'): ?string
{
    if ($localYmdHis === null || $localYmdHis === '') {
        return null;
    }
    try {
        $dt = new DateTime($localYmdHis, new DateTimeZone($tz));
        $dt->setTimezone(new DateTimeZone('UTC'));
        return $dt->format('Y-m-d H:i:s');
    } catch (Exception $e) {
        return null;
    }
}

/** Parse Apt Start/End → H:i:s (Excel time serial or time string). */
function import_parse_excel_time($value): ?string
{
    if ($value === '' || $value === null) {
        return null;
    }
    if (is_numeric($value)) {
        $serial = (float)$value;
        $fraction = $serial >= 1 ? ($serial - floor($serial)) : $serial;
        if ($fraction < 0) {
            $fraction = 0;
        }
        // Round to nearest minute to avoid SheetJS/Excel float → 07:59:59 artifacts.
        $seconds = (int)round($fraction * 86400 / 60) * 60;
        if ($seconds >= 86400) {
            $seconds = 86340;
        }
        return gmdate('H:i:s', $seconds);
    }
    $s = trim((string)$value);
    if (preg_match('/^(\d{4}-\d{2}-\d{2})[\sT]+(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)?$/i', $s, $m)) {
        $time = import_normalize_hms($m[2]);
        if (!empty($m[3])) {
            $time = import_apply_ampm($time, $m[3]);
        }
        return $time;
    }
    if (preg_match('/^(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)$/i', $s, $m)) {
        return import_apply_ampm(import_normalize_hms($m[1]), $m[2]);
    }
    if (preg_match('/^(\d{1,2}:\d{2}(?::\d{2})?)$/', $s, $m)) {
        return import_normalize_hms($m[1]);
    }
    return null;
}

/** Apply AM/PM to a 12-hour H:i:s clock → 24-hour H:i:s. */
function import_apply_ampm(string $hms, string $ampm): string
{
    $parts = array_map('intval', explode(':', import_normalize_hms($hms)));
    $h = $parts[0] ?? 0;
    $m = $parts[1] ?? 0;
    $s = $parts[2] ?? 0;
    $isPm = strtoupper($ampm) === 'PM';
    if ($isPm && $h < 12) {
        $h += 12;
    }
    if (!$isPm && $h === 12) {
        $h = 0;
    }
    return sprintf('%02d:%02d:%02d', $h, $m, $s);
}

/** Combine DOS date + apt time; fall back to full datetime strings when already merged. */
function import_combine_dos_and_time($dosValue, $timeValue): ?string
{
    $dosDate = import_parse_excel_dos($dosValue);
    $timeHms = import_parse_excel_time($timeValue);

    if ($dosDate && $timeHms) {
        return $dosDate . ' ' . $timeHms;
    }

    if (!is_numeric($timeValue)) {
        $s = trim((string)$timeValue);
        if (preg_match('/^(\d{4}-\d{2}-\d{2})[\sT]+(\d{1,2}:\d{2}(?::\d{2})?)/', $s, $m)) {
            $time = strlen($m[2]) === 5 ? $m[2] . ':00' : $m[2];
            if ($dosDate) {
                return $dosDate . ' ' . $time;
            }
            return $m[1] . ' ' . $time;
        }
    }

    if ($dosDate && is_numeric($timeValue)) {
        $legacy = import_excel_serial_to_datetime($timeValue, false);
        if ($legacy && preg_match('/(\d{1,2}:\d{2}(?::\d{2})?)$/', (string)$legacy, $m)) {
            $time = strlen($m[1]) === 5 ? $m[1] . ':00' : $m[1];
            return $dosDate . ' ' . $time;
        }
    }

    return $timeHms && $dosDate ? $dosDate . ' ' . $timeHms : null;
}

function import_excel_serial_to_datetime($serial, $dateOnly = false)
{
    if ($serial === '' || $serial === null) {
        return null;
    }
    if (!is_numeric($serial)) {
        return $serial;
    }
    if (!$dateOnly) {
        $combined = import_combine_dos_and_time('25569', $serial);
        if ($combined) {
            return $combined;
        }
    }
    $base = 25569;
    $seconds = ((float)$serial - $base) * 86400;
    $format = $dateOnly ? 'Y-m-d' : 'Y-m-d H:i:s';
    return gmdate($format, (int)$seconds);
}

function import_merge_dos_into_apt($dos, $apt)
{
    if ($dos === null || $dos === '' || $apt === null || $apt === '') {
        return $apt;
    }
    $combined = import_combine_dos_and_time($dos, $apt);
    if ($combined) {
        return $combined;
    }
    $dosTs = strtotime((string)$dos);
    if ($dosTs === false) {
        return $apt;
    }
    $dosDate = date('Y-m-d', $dosTs);
    $s = trim((string)$apt);
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})[\sT]+(\d{1,2}:\d{2}(?::\d{2})?)/', $s, $m)) {
        return $apt;
    }
    $yy = (int)$m[1];
    $mm = (int)$m[2];
    $dd = (int)$m[3];
    $timePart = $m[4];
    if (strlen($timePart) === 5) {
        $timePart .= ':00';
    }
    $isExcelTimeOnly =
        ($yy === 1899 && $mm === 12 && $dd === 30) ||
        ($yy === 1900 && $mm === 1 && ($dd === 0 || $dd === 1)) ||
        ($yy === 1970 && $mm === 1 && $dd === 1);
    if ($isExcelTimeOnly) {
        return $dosDate . ' ' . $timePart;
    }
    return $apt;
}

function import_normalize_token($s)
{
    return strtolower(trim(preg_replace('/\s+/', ' ', (string)$s)));
}

/**
 * Duplicate key for Theralytics scheduling import:
 * Client Full Name + DOS + Time of Service (Apt Start) + Service Code.
 * Returns null when any part is missing (skip check).
 */
function import_schedule_dup_fingerprint(
    $clientFirst,
    $clientLast,
    ?string $dosYmd,
    ?string $aptStartHms,
    $serviceCode
): ?string {
    $fullName = import_normalize_token(trim((string)$clientFirst . ' ' . (string)$clientLast));
    $svc = import_normalize_token($serviceCode);
    $dos = $dosYmd !== null ? trim($dosYmd) : '';
    $time = $aptStartHms !== null ? trim($aptStartHms) : '';
    if ($fullName === '' || $dos === '' || $time === '' || $svc === '') {
        return null;
    }
    if (preg_match('/^\d{1,2}:\d{2}$/', $time)) {
        $time .= ':00';
    }
    return $fullName . '|' . $dos . '|' . $time . '|' . $svc;
}

/**
 * Find an existing non-cancelled session with the same client, start (minute), and service code.
 * Service code is matched via sessions.service_code when present, else client_auth.billing_codes / auth_code.
 *
 * @return array{session_id:int,status:string,provider_id?:string,start_utc?:string,end_utc?:string}|null
 */
function import_find_matching_session(
    mysqli $conn,
    string $clientId,
    string $startUtc,
    string $serviceCode
): ?array {
    $clientId = trim($clientId);
    $startUtc = trim($startUtc);
    $serviceCode = trim($serviceCode);
    if ($clientId === '' || $startUtc === '' || $serviceCode === '') {
        return null;
    }

    $startMinute = substr($startUtc, 0, 16);
    if (strlen($startMinute) < 16) {
        return null;
    }

    $statusCol = sessions_status_column($conn);
    $statusExpr = sessions_status_sql_expr($conn, 's');
    $svcCols = session_auth_service_columns_exist($conn);
    $svcSelect = !empty($svcCols['service_code']) ? 's.service_code' : 'NULL AS service_code';
    $excludeSelect = sessions_has_exclude_session_column($conn)
        ? 's.exclude_session'
        : "'No' AS exclude_session";

    $sql = "
        SELECT s.session_id, s.auth_id, s.auth_code, s.provider_id, s.start_utc, s.end_utc,
               s.`{$statusCol}` AS status, {$svcSelect}, {$excludeSelect}
        FROM sessions s
        WHERE s.client_id = ?
          AND LEFT(s.start_utc, 16) = ?
          AND {$statusExpr} <> 'cancelled'
        ORDER BY s.session_id ASC
        LIMIT 25
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('ss', $clientId, $startMinute);
    if (!$stmt->execute()) {
        $stmt->close();
        return null;
    }
    $res = $stmt->get_result();
    $candidates = [];
    while ($row = $res->fetch_assoc()) {
        $candidates[] = $row;
    }
    $stmt->close();

    foreach ($candidates as $row) {
        $matched = false;
        $storedCode = trim((string)($row['service_code'] ?? ''));
        if (
            $storedCode !== ''
            && (
                import_billing_codes_match($storedCode, $serviceCode)
                || import_billing_codes_match($serviceCode, $storedCode)
            )
        ) {
            $matched = true;
        }

        if (!$matched) {
            $authCode = trim((string)($row['auth_code'] ?? ''));
            if ($authCode !== '') {
                $billingPart = trim(explode(' - ', $authCode, 2)[0]);
                if (
                    $billingPart !== ''
                    && (
                        import_billing_codes_match($billingPart, $serviceCode)
                        || import_billing_codes_match($serviceCode, $billingPart)
                    )
                ) {
                    $matched = true;
                }
            }
        }

        if (!$matched) {
            $authId = isset($row['auth_id']) ? (int)$row['auth_id'] : 0;
            if ($authId > 0) {
                $match = session_rate_client_auth_where($conn, '');
                $authSql = "SELECT billing_codes FROM client_auth WHERE {$match['clause']} LIMIT 1";
                $authStmt = $conn->prepare($authSql);
                if ($authStmt) {
                    if ($match['dual']) {
                        $authStmt->bind_param('ii', $authId, $authId);
                    } else {
                        $authStmt->bind_param('i', $authId);
                    }
                    $authStmt->execute();
                    $authRow = $authStmt->get_result()->fetch_assoc();
                    $authStmt->close();
                    $billing = trim((string)($authRow['billing_codes'] ?? ''));
                    if (
                        $billing !== ''
                        && (
                            import_billing_codes_match($billing, $serviceCode)
                            || import_billing_codes_match($serviceCode, $billing)
                        )
                    ) {
                        $matched = true;
                    }
                }
            }
        }

        if ($matched) {
            return [
                'session_id' => (int)$row['session_id'],
                'status' => (string)($row['status'] ?? ''),
                'provider_id' => isset($row['provider_id']) ? (string)$row['provider_id'] : '',
                'start_utc' => (string)($row['start_utc'] ?? ''),
                'end_utc' => (string)($row['end_utc'] ?? ''),
            ];
        }
    }

    return null;
}

/** True when an existing Scheduled session may be upgraded by a Rendered import row. */
function import_is_scheduled_to_rendered_upgrade(?array $existing, string $incomingStatus): bool
{
    if ($existing === null) {
        return false;
    }
    $existingStatus = strtolower(trim((string)($existing['status'] ?? '')));
    $incoming = strtolower(trim($incomingStatus));
    return $existingStatus === 'scheduled' && $incoming === 'rendered';
}

/**
 * Upgrade an existing Scheduled session to Rendered from a Theralytics re-import.
 *
 * @return array{success:bool,session_id?:int,action?:string,error?:string}
 */
function import_upgrade_scheduled_to_rendered(
    mysqli $conn,
    array $existing,
    array $parsed,
    array $authUser,
    bool $dryRun
): array {
    $sessionId = (int)($existing['session_id'] ?? 0);
    if ($sessionId <= 0) {
        return ['success' => false, 'error' => 'Invalid session id for Scheduled → Rendered upgrade'];
    }

    if ($dryRun) {
        return [
            'success' => true,
            'session_id' => $sessionId,
            'action' => 'update',
        ];
    }

    $endUtc = $parsed['endUtc'] ?? null;
    if (!$endUtc) {
        return ['success' => false, 'error' => 'Missing appointment end time for Rendered upgrade'];
    }

    $providerId = trim((string)($existing['provider_id'] ?? ''));
    $startUtc = trim((string)($existing['start_utc'] ?? $parsed['startUtc'] ?? ''));
    if ($providerId !== '' && $startUtc !== '') {
        try {
            ensure_provider_schedule_clear(
                $conn,
                $providerId,
                $startUtc,
                (string)$endUtc,
                [$sessionId],
                [],
                ''
            );
        } catch (ProviderScheduleConflictException $e) {
            return $e->getPayload();
        } catch (Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    $statusCol = sessions_status_column($conn);
    $status = 'Rendered';
    $renderedHours = (string) floatval($parsed['renderedHours'] ?? 0);
    $scheduledHours = $parsed['scheduledHours'] ?? null;
    $scheduledHoursStr = $scheduledHours !== null && $scheduledHours !== ''
        ? (string) floatval($scheduledHours)
        : null;
    $quickNote = $parsed['quickNote'] ?? null;
    if (is_string($quickNote) && trim($quickNote) === '') {
        $quickNote = null;
    }

    if ($scheduledHoursStr !== null) {
        $sql = "UPDATE sessions SET `{$statusCol}` = ?, rendered_hours = ?, end_utc = ?, quick_note = ?, scheduled_hours = ? WHERE session_id = ?";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            return ['success' => false, 'error' => 'Failed to prepare Scheduled → Rendered update: ' . $conn->error];
        }
        $stmt->bind_param(
            'sssssi',
            $status,
            $renderedHours,
            $endUtc,
            $quickNote,
            $scheduledHoursStr,
            $sessionId
        );
    } else {
        $sql = "UPDATE sessions SET `{$statusCol}` = ?, rendered_hours = ?, end_utc = ?, quick_note = ? WHERE session_id = ?";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            return ['success' => false, 'error' => 'Failed to prepare Scheduled → Rendered update: ' . $conn->error];
        }
        $stmt->bind_param(
            'ssssi',
            $status,
            $renderedHours,
            $endUtc,
            $quickNote,
            $sessionId
        );
    }

    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        return ['success' => false, 'error' => 'Failed to upgrade session to Rendered: ' . $err];
    }
    $stmt->close();

    $existingExclude = normalize_session_exclude_session($existing['exclude_session'] ?? 'No');
    $excludeSession = sessions_resolve_exclude_session_for_write(
        $authUser,
        $parsed['excludeSession'] ?? null,
        $existingExclude
    );
    try {
        sessions_set_exclude_session($conn, $sessionId, $excludeSession, $excludeSession === 'Yes');
        sessions_set_service_type(
            $conn,
            $sessionId,
            normalize_session_service_type($parsed['serviceType'] ?? null),
            normalize_session_service_type($parsed['serviceType'] ?? null) === 'Direct'
        );
        ensure_session_claim_ready(
            $conn,
            $sessionId,
            $startUtc !== '' ? $startUtc : null,
            $parsed['billable'] ?? null
        );
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage(), 'session_id' => $sessionId];
    }

    return [
        'success' => true,
        'session_id' => $sessionId,
        'action' => 'update',
    ];
}

/**
 * Update exclude_session on an existing matched session (re-import with Exclude Session column).
 *
 * @return array{success:bool,session_id?:int,action?:string,error?:string,exclude_session?:string}
 */
function import_update_existing_exclude_session(
    mysqli $conn,
    array $existing,
    array $parsed,
    array $authUser,
    bool $dryRun
): array {
    $sessionId = (int)($existing['session_id'] ?? 0);
    if ($sessionId <= 0) {
        return ['success' => false, 'error' => 'Invalid session id for exclude_session update'];
    }

    $existingExclude = normalize_session_exclude_session($existing['exclude_session'] ?? 'No');
    $excludeSession = sessions_resolve_exclude_session_for_write(
        $authUser,
        $parsed['excludeSession'] ?? null,
        $existingExclude
    );

    if ($dryRun) {
        return [
            'success' => true,
            'session_id' => $sessionId,
            'action' => 'update',
            'exclude_session' => $excludeSession,
        ];
    }

    try {
        sessions_set_exclude_session($conn, $sessionId, $excludeSession, true);
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage(), 'session_id' => $sessionId];
    }

    return [
        'success' => true,
        'session_id' => $sessionId,
        'action' => 'update',
        'exclude_session' => $excludeSession,
    ];
}

/**
 * True when Excel/JSON includes an Exclude Session value so re-import may sync it
 * onto an existing duplicate match (instead of hard-rejecting).
 */
function import_row_has_exclude_session(array $parsed): bool
{
    return array_key_exists('excludeSession', $parsed) && $parsed['excludeSession'] !== null;
}

/**
 * Read Exclude Session from Excel / JSON.
 * Returns null when the column is omitted (so re-import does not wipe an existing Yes).
 * Returns Yes/No when present (including explicit No / false / 0).
 */
function import_parse_exclude_session(array $row): ?string
{
    foreach (
        [
            'Exclude Session',
            'Exclude session',
            'excludeSession',
            'exclude_session',
        ] as $key
    ) {
        if (array_key_exists($key, $row) && $row[$key] !== '' && $row[$key] !== null) {
            return normalize_session_exclude_session($row[$key]);
        }
    }
    // Case-insensitive header fallback (trailing spaces, etc.).
    foreach ($row as $k => $v) {
        if (import_normalize_token($k) === 'exclude session' && $v !== '' && $v !== null) {
            return normalize_session_exclude_session($v);
        }
    }
    return null;
}

function import_resolve_client_id(mysqli $conn, $firstName, $lastName)
{
    static $cache = [];
    $fn = import_normalize_token($firstName);
    $ln = import_normalize_token($lastName);
    if ($fn === '' || $ln === '') {
        return null;
    }
    $key = 'c:' . $fn . '|' . $ln;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }
    $stmt = $conn->prepare(
        'SELECT client_id FROM clients WHERE archived = 0
         AND LOWER(TRIM(COALESCE(first_name, \'\'))) = ?
         AND LOWER(TRIM(COALESCE(last_name, \'\'))) = ?
         LIMIT 2'
    );
    if (!$stmt) {
        $cache[$key] = null;
        return null;
    }
    $stmt->bind_param('ss', $fn, $ln);
    $stmt->execute();
    $res = $stmt->get_result();
    $ids = [];
    while ($row = $res->fetch_assoc()) {
        $ids[] = (string)$row['client_id'];
    }
    $stmt->close();
    $out = count($ids) === 1 ? $ids[0] : null;
    $cache[$key] = $out;
    return $out;
}

function import_resolve_staff_id(mysqli $conn, $firstName, $lastName)
{
    static $cache = [];
    $fn = import_normalize_token($firstName);
    $ln = import_normalize_token($lastName);
    if ($fn === '' || $ln === '') {
        return null;
    }
    $key = 's:' . $fn . '|' . $ln;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }
    $stmt = $conn->prepare(
        'SELECT id FROM staff WHERE COALESCE(archived, 0) = 0
         AND LOWER(TRIM(COALESCE(firstName, \'\'))) = ?
         AND LOWER(TRIM(COALESCE(lastName, \'\'))) = ?
         LIMIT 2'
    );
    if (!$stmt) {
        $cache[$key] = null;
        return null;
    }
    $stmt->bind_param('ss', $fn, $ln);
    $stmt->execute();
    $res = $stmt->get_result();
    $ids = [];
    while ($row = $res->fetch_assoc()) {
        $ids[] = (string)$row['id'];
    }
    $stmt->close();
    $out = count($ids) === 1 ? $ids[0] : null;
    $cache[$key] = $out;
    return $out;
}

function import_split_full_name($full)
{
    $full = trim(preg_replace('/\s+/', ' ', (string)$full));
    if ($full === '') {
        return [null, null];
    }
    $parts = explode(' ', $full);
    if (count($parts) === 1) {
        return [$parts[0], ''];
    }
    $last = array_pop($parts);
    $first = implode(' ', $parts);
    return [$first, $last];
}

function import_staff_display_name(mysqli $conn, $staffId)
{
    if (!$staffId) {
        return '';
    }
    static $cache = [];
    if (isset($cache[$staffId])) {
        return $cache[$staffId];
    }
    $stmt = $conn->prepare('SELECT firstName, lastName FROM staff WHERE id = ? LIMIT 1');
    $stmt->bind_param('s', $staffId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $name = trim(($row['firstName'] ?? '') . ' ' . ($row['lastName'] ?? ''));
    $cache[$staffId] = $name;
    return $name;
}

function import_billing_codes_match($billingCodes, $serviceCode)
{
    $svc = trim((string)$serviceCode);
    if ($svc === '') {
        return false;
    }
    $raw = trim((string)$billingCodes);
    if ($raw === $svc) {
        return true;
    }
    // Exact token match only. Do NOT use prefix matching (e.g. str_starts_with):
    // billing "97155NB" must not match import service code "97155" when both
    // auth rows share the same authorization number.
    foreach (preg_split('/[,\s]+/', $raw) as $token) {
        $token = trim($token);
        if ($token !== '' && $token === $svc) {
            return true;
        }
    }
    return false;
}

function import_format_auth_date($value): string
{
    if ($value === null || trim((string)$value) === '') {
        return '…';
    }
    $s = trim(substr((string)$value, 0, 10));
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $s, $m)) {
        return $m[2] . '/' . $m[3] . '/' . $m[1];
    }
    return $s;
}

/** Normalize client_auth start_date / end_date → Y-m-d (or null). */
function import_auth_date_ymd($value): ?string
{
    if ($value === null || trim((string)$value) === '') {
        return null;
    }
    $s = trim((string)$value);
    if (preg_match('/^(\d{4}-\d{2}-\d{2})/', $s, $m)) {
        return $m[1];
    }
    $ts = strtotime($s);
    return $ts !== false ? date('Y-m-d', $ts) : null;
}

/** True when DOS falls within the auth's start_date–end_date (open ends allowed). */
function import_auth_covers_dos(array $authRow, string $dosYmd): bool
{
    $start = import_auth_date_ymd($authRow['start_date'] ?? null);
    $end = import_auth_date_ymd($authRow['end_date'] ?? null);
    if ($start !== null && $dosYmd < $start) {
        return false;
    }
    if ($end !== null && $dosYmd > $end) {
        return false;
    }
    return true;
}

/**
 * Resolve active client_auth by authorization number + service code.
 * When the same auth number has multiple periods (different start dates),
 * disambiguate with DOS falling inside start_date–end_date.
 */
function import_resolve_auth(
    mysqli $conn,
    string $clientId,
    string $authNumber,
    string $serviceCode,
    ?string $dosYmd = null
): ?array {
    $authNumber = trim($authNumber);
    $serviceCode = trim($serviceCode);
    if ($clientId === '' || $authNumber === '' || $serviceCode === '') {
        return null;
    }
    $authNorm = import_normalize_token($authNumber);
    $stmt = $conn->prepare(
        'SELECT ca.* FROM client_auth ca
         INNER JOIN client_insurance ci ON ca.insurance_id = ci.insurance_id AND ci.client_id = ?
         WHERE UPPER(TRIM(IFNULL(ca.status, \'\'))) = \'ACTIVE\''
    );
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('s', $clientId);
    $stmt->execute();
    $res = $stmt->get_result();
    $matches = [];
    while ($row = $res->fetch_assoc()) {
        $rowAuth = import_normalize_token($row['authorization_number'] ?? '');
        if ($rowAuth !== $authNorm) {
            continue;
        }
        if (!import_billing_codes_match($row['billing_codes'] ?? '', $serviceCode)) {
            continue;
        }
        $matches[] = $row;
    }
    $stmt->close();
    if (count($matches) === 1) {
        return $matches[0];
    }
    // Same auth number reused across periods — pick the period covering DOS.
    if (count($matches) > 1 && $dosYmd !== null && $dosYmd !== '') {
        $byDos = array_values(array_filter(
            $matches,
            static fn(array $row): bool => import_auth_covers_dos($row, $dosYmd)
        ));
        if (count($byDos) === 1) {
            return $byDos[0];
        }
    }
    return null;
}

function import_auth_pk(array $authRow): ?int
{
    if (isset($authRow['auth_id']) && $authRow['auth_id'] !== '' && $authRow['auth_id'] !== null) {
        return (int)$authRow['auth_id'];
    }
    if (isset($authRow['id']) && $authRow['id'] !== '' && $authRow['id'] !== null) {
        return (int)$authRow['id'];
    }
    return null;
}

function import_auth_code_label(array $authRow): string
{
    $billing = trim((string)($authRow['billing_codes'] ?? '')) ?: '—';
    $authNum = trim((string)($authRow['authorization_number'] ?? '')) ?: '—';
    $start = import_format_auth_date($authRow['start_date'] ?? null);
    $end = import_format_auth_date($authRow['end_date'] ?? null);
    return $billing . ' - ' . $authNum . '-' . $start . '-' . $end;
}

function import_place_of_service($locationCode)
{
    $code = trim((string)$locationCode);
    return match ($code) {
        '12' => 'Home',
        '03' => 'School',
        '11' => 'Clinic',
        '02' => 'Virtual',
        default => 'Other',
    };
}

/** Read Billable Yes/No from Excel / JSON (optional; null = resolve from provider mapping). */
function import_parse_billable(array $row): ?string
{
    foreach (['Billable', 'billable'] as $key) {
        if (array_key_exists($key, $row) && $row[$key] !== '' && $row[$key] !== null) {
            return session_normalize_billable_flag($row[$key]);
        }
    }
    foreach ($row as $k => $v) {
        if (import_normalize_token($k) === 'billable' && $v !== '' && $v !== null) {
            return session_normalize_billable_flag($v);
        }
    }
    return null;
}

function import_normalize_status($status)
{
    $s = trim((string)$status);
    if ($s === '') {
        return 'Scheduled';
    }
    $lower = strtolower($s);
    if ($lower === 'cancelled') {
        return 'Cancelled';
    }
    if ($lower === 'rendered' || $lower === 'completed') {
        return 'Rendered';
    }
    return 'Scheduled';
}

function import_compute_scheduled_hours($startUtc, $endUtc)
{
    if (!$startUtc || !$endUtc) {
        return 0;
    }
    $startTs = strtotime($startUtc);
    $endTs = strtotime($endUtc);
    if ($startTs === false || $endTs === false || $endTs <= $startTs) {
        return 0;
    }
    return round(($endTs - $startTs) / 3600, 2);
}

function import_parse_row(array $row): array
{
    $dos = import_parse_excel_dos($row['DOS'] ?? null);
    $aptStartHms = import_parse_excel_time($row['Apt Start Time'] ?? null);
    $aptStart = import_combine_dos_and_time($row['DOS'] ?? null, $row['Apt Start Time'] ?? null);
    $aptEnd = import_combine_dos_and_time($row['DOS'] ?? null, $row['Apt End Time'] ?? null);

    $scheduledHours = $row['Duration Schedule In Hrs'] ?? null;
    if ($scheduledHours === '' || $scheduledHours === null) {
        $scheduledHours = import_compute_scheduled_hours($aptStart, $aptEnd);
    } else {
        $scheduledHours = (float)$scheduledHours;
    }

    $renderedHours = $row['Duration Render in Hrs'] ?? 0;
    $renderedHours = ($renderedHours === '' || $renderedHours === null) ? 0 : (float)$renderedHours;

    $notes = trim((string)($row['Notes'] ?? ''));
    $nonBillable = trim((string)($row['Non-Billable Notes'] ?? ''));
    $quickNote = $notes !== '' ? $notes : ($nonBillable !== '' ? $nonBillable : null);

    $status = import_normalize_status($row['Status'] ?? 'Scheduled');
    if ($status === 'Scheduled' && $renderedHours > 0) {
        $status = 'Rendered';
    }

    // Apt times from Excel are America/Chicago wall clocks. Convert to real UTC
    // here so import matches manual Add Session (startDateTime already UTC).
    $startUtc = import_local_wall_to_utc($aptStart, 'America/Chicago');
    $endUtc = import_local_wall_to_utc($aptEnd, 'America/Chicago');

    return [
        'clientFirst' => $row['Client First Name'] ?? '',
        'clientLast' => $row['Client Last Name'] ?? '',
        'staffFirst' => $row['Staff First Name'] ?? '',
        'staffLast' => $row['Staff Last Name'] ?? '',
        // Parsed for reference only — not written to supervising_provider_* (supervisee ≠ supervisor).
        'supervisedName' => $row['Name of RBT Supervised'] ?? '',
        'authNumber' => trim((string)($row['Authorization Number'] ?? '')),
        'serviceCode' => trim((string)($row['Service Code With Modifiers'] ?? '')),
        'dosYmd' => $dos,
        'aptStartHms' => $aptStartHms,
        'startUtc' => $startUtc,
        'endUtc' => $endUtc,
        'scheduledHours' => $scheduledHours,
        'renderedHours' => $renderedHours,
        'placeOfService' => import_place_of_service($row['Location Code'] ?? ''),
        'locationAddress' => trim((string)($row['Address'] ?? '')) ?: null,
        'quickNote' => $quickNote,
        'status' => $status,
        'billable' => import_parse_billable($row),
        'excludeSession' => import_parse_exclude_session($row),
        'serviceType' => normalize_session_service_type(
            $row['DIRECT or INDIRECT Service'] ?? $row['direct_or_indirect_service'] ?? null
        ),
    ];
}

function import_resolve_row(mysqli $conn, array $parsed): array
{
    $errors = [];

    $clientId = import_resolve_client_id($conn, $parsed['clientFirst'], $parsed['clientLast']);
    if (!$clientId) {
        $errors[] = 'Client not found (unique match required by first + last name)';
    }

    $providerId = import_resolve_staff_id($conn, $parsed['staffFirst'], $parsed['staffLast']);
    if (!$providerId) {
        $errors[] = 'Staff not found (unique match required by first + last name)';
    }

    // Do NOT map Excel "Name of RBT Supervised" → supervising_provider_*.
    // That column is the supervisee (BT/RBT), while Mahaverse Supervising Provider
    // is the supervisor (BCBA). Leave empty; set manually in Appointments if needed.
    $supervisingProviderId = null;
    $supervisingProviderName = null;

    $authRow = null;
    $authId = null;
    $authCode = null;
    if ($clientId) {
        $authRow = import_resolve_auth(
            $conn,
            $clientId,
            $parsed['authNumber'],
            $parsed['serviceCode'],
            $parsed['dosYmd'] ?? null
        );
        if (!$authRow) {
            $errors[] = 'Authorization not found for client + auth number + service code'
                . ' (if the auth number has multiple periods, DOS must fall in one start–end range)';
        } else {
            $authId = import_auth_pk($authRow);
            $authCode = import_auth_code_label($authRow);
            if (!$authId) {
                $errors[] = 'Authorization row has no usable id';
            }
        }
    }

    if (!$parsed['startUtc'] || !$parsed['endUtc']) {
        $errors[] = 'Missing appointment start or end time';
    }

    $providerName = $providerId ? import_staff_display_name($conn, $providerId) : '';

    return [
        'errors' => $errors,
        'clientId' => $clientId,
        'providerId' => $providerId,
        'providerName' => $providerName,
        'supervisingProviderId' => $supervisingProviderId,
        'supervisingProviderName' => $supervisingProviderName,
        'authId' => $authId,
        'authCode' => $authCode,
    ];
}

function import_build_session_payload(array $parsed, array $resolved): array
{
    return [
        'clientId' => $resolved['clientId'],
        'provider' => $resolved['providerId'],
        'providerName' => $resolved['providerName'],
        'supervisingProvider' => $resolved['supervisingProviderId'],
        'supervisingProviderName' => $resolved['supervisingProviderName'],
        'startDateTime' => $parsed['startUtc'],
        'endDateTime' => $parsed['endUtc'],
        'startTZ' => 'America/Chicago',
        'endTZ' => 'America/Chicago',
        'authId' => $resolved['authId'],
        'authCode' => $resolved['authCode'],
        'placeOfService' => $parsed['placeOfService'],
        'locationAddress' => $parsed['locationAddress'],
        'quickNote' => $parsed['quickNote'],
        'status' => $parsed['status'],
        'billable' => $parsed['billable'] ?? null,
        'excludeSession' => $parsed['excludeSession'] ?? 'No',
        'serviceType' => $parsed['serviceType'] ?? 'Direct',
        'scheduled_hours' => $parsed['scheduledHours'],
        'rendered_hours' => $parsed['renderedHours'],
        'recurring' => ['frequency' => 'No'],
    ];
}

/** Display Yes/No for UI / email (null Excel column → No on create). */
function import_exclude_session_label(array $parsed): string
{
    return normalize_session_exclude_session($parsed['excludeSession'] ?? 'No');
}

function import_result_errors(array $result): array
{
    $errors = [];
    if (!empty($result['error'])) {
        $errors[] = (string)$result['error'];
    }
    if (!empty($result['code']) && $result['code'] === 'provider_double_booked') {
        $msg = (string)($result['error'] ?? '');
        if ($msg !== '' && !in_array($msg, $errors, true)) {
            $errors[] = $msg;
        }
    }
    if (!empty($result['hint'])) {
        $errors[] = (string)$result['hint'];
    }
    return array_values(array_unique(array_filter($errors)));
}

function import_attach_result_meta(array &$entry, array $result): void
{
    $entry['errors'] = import_result_errors($result);
    if (!empty($result['code'])) {
        $entry['error_code'] = (string)$result['code'];
    }
    if (!empty($result['conflict']) && is_array($result['conflict'])) {
        $entry['conflict'] = $result['conflict'];
    }
}

$results = [];
$readyCount = 0;
$imported = 0;
$updated = 0;
$sessionIds = [];
$line = 0;
/** @var list<array<string,mixed>> rows that were created/updated (for admin summary email) */
$importedSummaryRows = [];
/** @var array<string,int> fingerprint => first line number in this file */
$seenDupFingerprints = [];

foreach ($rows as $row) {
    $line++;
    if (!is_array($row)) {
        continue;
    }

    try {
        $parsed = import_parse_row($row);
        $dupErrors = [];
        $existingMatch = null;
        $willUpgrade = false;
        $willExcludeUpdate = false;

        $fp = import_schedule_dup_fingerprint(
            $parsed['clientFirst'],
            $parsed['clientLast'],
            $parsed['dosYmd'] ?? null,
            $parsed['aptStartHms'] ?? null,
            $parsed['serviceCode']
        );
        if ($fp !== null) {
            if (isset($seenDupFingerprints[$fp])) {
                $dupErrors[] = 'Duplicate session in import file (same client + DOS + time + service code as row '
                    . $seenDupFingerprints[$fp] . ')';
            } else {
                $seenDupFingerprints[$fp] = $line;
            }
        }

        $resolved = import_resolve_row($conn, $parsed);

        if (
            empty($dupErrors)
            && !empty($resolved['clientId'])
            && !empty($parsed['startUtc'])
            && trim((string)$parsed['serviceCode']) !== ''
        ) {
            $existingMatch = import_find_matching_session(
                $conn,
                (string)$resolved['clientId'],
                (string)$parsed['startUtc'],
                (string)$parsed['serviceCode']
            );
            if ($existingMatch !== null) {
                if (import_is_scheduled_to_rendered_upgrade($existingMatch, (string)($parsed['status'] ?? ''))) {
                    $willUpgrade = true;
                } elseif (import_row_has_exclude_session($parsed)) {
                    $existingExclude = normalize_session_exclude_session(
                        $existingMatch['exclude_session'] ?? 'No'
                    );
                    $resolvedExclude = sessions_resolve_exclude_session_for_write(
                        $authUser,
                        $parsed['excludeSession'],
                        $existingExclude
                    );
                    if ($resolvedExclude !== $existingExclude) {
                        // Same slot already exists — sync Exclude Session No↔Yes from Excel.
                        $willExcludeUpdate = true;
                    } else {
                        $dupErrors[] = 'Duplicate session already exists (session_id '
                            . (int)$existingMatch['session_id']
                            . ': same client + DOS + time + service code)';
                    }
                } else {
                    $dupErrors[] = 'Duplicate session already exists (session_id '
                        . (int)$existingMatch['session_id']
                        . ': same client + DOS + time + service code)';
                }
            }
        }

        $isExistingUpdate = $willUpgrade || $willExcludeUpdate;
        $errors = $isExistingUpdate
            ? array_values(array_unique($dupErrors))
            : array_values(array_unique(array_merge($resolved['errors'], $dupErrors)));

        // Upgrade still needs a resolvable client (used for the match) and end time.
        if ($willUpgrade && empty($resolved['clientId'])) {
            $errors[] = 'Client not found (unique match required by first + last name)';
        }
        if ($willUpgrade && empty($parsed['endUtc'])) {
            $errors[] = 'Missing appointment end time';
        }
        if ($willExcludeUpdate && empty($resolved['clientId'])) {
            $errors[] = 'Client not found (unique match required by first + last name)';
        }

        $entry = [
            'line' => $line,
            'ready' => false,
            'action' => null,
            'errors' => $errors,
            'client' => trim($parsed['clientFirst'] . ' ' . $parsed['clientLast']),
            'staff' => trim($parsed['staffFirst'] . ' ' . $parsed['staffLast']),
            'staff_first' => $parsed['staffFirst'] ?? '',
            'staff_last' => $parsed['staffLast'] ?? '',
            'service_code' => $parsed['serviceCode'] ?? '',
            'dos' => $parsed['dosYmd'] ?? null,
            'exclude_session' => import_exclude_session_label($parsed),
            'session_id' => null,
        ];

        if (empty($errors)) {
            if ($willUpgrade && $existingMatch !== null) {
                $updateResult = import_upgrade_scheduled_to_rendered(
                    $conn,
                    $existingMatch,
                    $parsed,
                    $authUser,
                    $validateOnly
                );

                if ($updateResult['success'] ?? false) {
                    $entry['ready'] = true;
                    $entry['action'] = 'update';
                    $entry['session_id'] = $updateResult['session_id'] ?? $existingMatch['session_id'];
                    $readyCount++;
                    if (!$validateOnly) {
                        $sid = (int)($updateResult['session_id'] ?? 0);
                        if ($sid > 0) {
                            $sessionIds[] = $sid;
                        }
                        $updated++;
                        $importedSummaryRows[] = [
                            'line' => $line,
                            'action' => 'update',
                            'session_id' => $entry['session_id'],
                            'client' => $entry['client'],
                            'staff' => $entry['staff'],
                            'dos' => $entry['dos'] ?? ($parsed['dosYmd'] ?? null),
                            'service_code' => $entry['service_code'] ?? ($parsed['serviceCode'] ?? ''),
                            'status' => 'Rendered',
                        ];
                    }
                } else {
                    import_attach_result_meta($entry, $updateResult);
                }
            } elseif ($willExcludeUpdate && $existingMatch !== null) {
                $updateResult = import_update_existing_exclude_session(
                    $conn,
                    $existingMatch,
                    $parsed,
                    $authUser,
                    $validateOnly
                );

                if ($updateResult['success'] ?? false) {
                    $entry['ready'] = true;
                    $entry['action'] = 'update';
                    $entry['session_id'] = $updateResult['session_id'] ?? $existingMatch['session_id'];
                    if (!empty($updateResult['exclude_session'])) {
                        $entry['exclude_session'] = $updateResult['exclude_session'];
                    }
                    $readyCount++;
                    if (!$validateOnly) {
                        $sid = (int)($updateResult['session_id'] ?? 0);
                        if ($sid > 0) {
                            $sessionIds[] = $sid;
                        }
                        $updated++;
                        $importedSummaryRows[] = [
                            'line' => $line,
                            'action' => 'update',
                            'session_id' => $entry['session_id'],
                            'client' => $entry['client'],
                            'staff' => $entry['staff'],
                            'dos' => $entry['dos'] ?? ($parsed['dosYmd'] ?? null),
                            'service_code' => $entry['service_code'] ?? ($parsed['serviceCode'] ?? ''),
                            'status' => (string)($existingMatch['status'] ?? $parsed['status'] ?? ''),
                            'exclude_session' => $entry['exclude_session'],
                        ];
                    }
                } else {
                    import_attach_result_meta($entry, $updateResult);
                }
            } else {
                $payload = import_build_session_payload($parsed, $resolved);
                // Bulk import: no per-session emails (client/admin). One admin summary is sent after the batch.
                $createResult = mahaverse_create_scheduling_session($conn, $payload, [
                    'authUser' => $authUser,
                    'enforceRbac' => !$validateOnly,
                    'sendEmail' => false,
                    'dryRun' => $validateOnly,
                ]);

                if ($createResult['success'] ?? false) {
                    $entry['ready'] = true;
                    $entry['action'] = 'create';
                    $readyCount++;
                    if (!$validateOnly) {
                        $entry['session_id'] = $createResult['session_id'] ?? null;
                        if (!empty($createResult['session_id'])) {
                            $sessionIds[] = (int)$createResult['session_id'];
                        }
                        $imported++;
                        $importedSummaryRows[] = [
                            'line' => $line,
                            'action' => 'create',
                            'session_id' => $entry['session_id'],
                            'client' => $entry['client'],
                            'staff' => $entry['staff'],
                            'dos' => $entry['dos'] ?? ($parsed['dosYmd'] ?? null),
                            'service_code' => $entry['service_code'] ?? ($parsed['serviceCode'] ?? ''),
                            'status' => $parsed['status'] ?? '',
                        ];
                    }
                } else {
                    import_attach_result_meta($entry, $createResult);
                }
            }
        }

        $results[] = $entry;
    } catch (Throwable $e) {
        // Never abort the whole batch — surface as a single-row error.
        $results[] = [
            'line' => $line,
            'ready' => false,
            'action' => null,
            'errors' => [$e->getMessage()],
            'error_code' => $e instanceof ProviderScheduleConflictException
                ? 'provider_double_booked'
                : 'exception',
            'conflict' => $e instanceof ProviderScheduleConflictException
                ? ($e->getPayload()['conflict'] ?? null)
                : null,
            'client' => is_array($row)
                ? trim(($row['Client First Name'] ?? '') . ' ' . ($row['Client Last Name'] ?? ''))
                : '',
            'staff' => is_array($row)
                ? trim(($row['Staff First Name'] ?? '') . ' ' . ($row['Staff Last Name'] ?? ''))
                : '',
            'session_id' => null,
        ];
    }
}

$adminEmailResults = [];
if (!$validateOnly && ($imported > 0 || $updated > 0)) {
    $actor = '';
    if (is_array($authUser)) {
        $actor = trim((string)(
            $authUser['email']
            ?? $authUser['name']
            ?? $authUser['full_name']
            ?? ''
        ));
    }
    try {
        $adminEmailResults = mahaverse_send_session_import_summary_email(
            $imported,
            $updated,
            $importedSummaryRows,
            $actor
        );
    } catch (Throwable $e) {
        file_put_contents(
            'debug.log',
            'Import summary email failed: ' . $e->getMessage() . "\n",
            FILE_APPEND
        );
        $adminEmailResults = [['error' => $e->getMessage()]];
    }
}

echo json_encode([
    'success' => true,
    'validateOnly' => $validateOnly,
    'total' => count($results),
    'readyCount' => $readyCount,
    'imported' => $imported,
    'updated' => $updated,
    'session_ids' => $sessionIds,
    'rows' => $results,
    'admin_emails' => $adminEmailResults,
]);

$conn->close();

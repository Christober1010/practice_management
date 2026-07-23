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
    foreach (preg_split('/[,\s]+/', $raw) as $token) {
        $token = trim($token);
        if ($token === $svc || str_starts_with($token, $svc)) {
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

function import_resolve_auth(mysqli $conn, string $clientId, string $authNumber, string $serviceCode): ?array
{
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
    if (count($matches) !== 1) {
        return null;
    }
    return $matches[0];
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
        'supervisedName' => $row['Name of RBT Supervised'] ?? '',
        'authNumber' => trim((string)($row['Authorization Number'] ?? '')),
        'serviceCode' => trim((string)($row['Service Code With Modifiers'] ?? '')),
        'startUtc' => $startUtc,
        'endUtc' => $endUtc,
        'scheduledHours' => $scheduledHours,
        'renderedHours' => $renderedHours,
        'placeOfService' => import_place_of_service($row['Location Code'] ?? ''),
        'locationAddress' => trim((string)($row['Address'] ?? '')) ?: null,
        'quickNote' => $quickNote,
        'status' => $status,
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

    $supervisingProviderId = null;
    $supervisingProviderName = null;
    if (trim((string)$parsed['supervisedName']) !== '') {
        [$supFirst, $supLast] = import_split_full_name($parsed['supervisedName']);
        $supervisingProviderId = import_resolve_staff_id($conn, $supFirst, $supLast);
        if (!$supervisingProviderId) {
            $errors[] = 'Supervised RBT not found: ' . trim((string)$parsed['supervisedName']);
        } else {
            $supervisingProviderName = import_staff_display_name($conn, $supervisingProviderId);
        }
    }

    $authRow = null;
    $authId = null;
    $authCode = null;
    if ($clientId) {
        $authRow = import_resolve_auth($conn, $clientId, $parsed['authNumber'], $parsed['serviceCode']);
        if (!$authRow) {
            $errors[] = 'Authorization not found for client + auth number + service code';
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
        'scheduled_hours' => $parsed['scheduledHours'],
        'rendered_hours' => $parsed['renderedHours'],
        'recurring' => ['frequency' => 'No'],
    ];
}

function import_result_errors(array $result): array
{
    $errors = [];
    if (!empty($result['error'])) {
        $errors[] = (string)$result['error'];
    }
    if (!empty($result['code']) && $result['code'] === 'provider_double_booked') {
        $errors[] = (string)$result['error'];
    }
    if (!empty($result['hint'])) {
        $errors[] = (string)$result['hint'];
    }
    return array_values(array_unique(array_filter($errors)));
}

$results = [];
$readyCount = 0;
$imported = 0;
$sessionIds = [];
$line = 0;

foreach ($rows as $row) {
    $line++;
    if (!is_array($row)) {
        continue;
    }

    $parsed = import_parse_row($row);
    $resolved = import_resolve_row($conn, $parsed);

    $entry = [
        'line' => $line,
        'ready' => false,
        'errors' => $resolved['errors'],
        'client' => trim($parsed['clientFirst'] . ' ' . $parsed['clientLast']),
        'staff' => trim($parsed['staffFirst'] . ' ' . $parsed['staffLast']),
        'session_id' => null,
    ];

    if (empty($resolved['errors'])) {
        $payload = import_build_session_payload($parsed, $resolved);
        $createResult = mahaverse_create_scheduling_session($conn, $payload, [
            'authUser' => $authUser,
            'enforceRbac' => !$validateOnly,
            'sendEmail' => !$validateOnly,
            'dryRun' => $validateOnly,
        ]);

        if ($createResult['success'] ?? false) {
            $entry['ready'] = true;
            $readyCount++;
            if (!$validateOnly) {
                $entry['session_id'] = $createResult['session_id'] ?? null;
                if (!empty($createResult['session_id'])) {
                    $sessionIds[] = (int)$createResult['session_id'];
                }
                $imported++;
            }
        } else {
            $entry['errors'] = import_result_errors($createResult);
        }
    }

    $results[] = $entry;
}

echo json_encode([
    'success' => true,
    'validateOnly' => $validateOnly,
    'total' => count($results),
    'readyCount' => $readyCount,
    'imported' => $imported,
    'session_ids' => $sessionIds,
    'rows' => $results,
]);

$conn->close();

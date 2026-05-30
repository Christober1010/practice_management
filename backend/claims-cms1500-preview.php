<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$authUser = getAuthenticatedUser();
if ($authUser && !rbac_user_has_permission_key($authUser['role'], 'billing.read', 'mahaverse')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Permission denied']);
    exit();
}

function cms1500_fail($status, $message)
{
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message]);
    exit();
}

function cms1500_numeric_id_array($value)
{
    if (!is_array($value)) {
        return [];
    }
    $out = [];
    foreach ($value as $v) {
        if ($v === null || $v === '') {
            continue;
        }
        $n = (int)$v;
        if ($n > 0) {
            $out[] = $n;
        }
    }
    return array_values(array_unique($out));
}

function cms1500_placeholders($count)
{
    return implode(',', array_fill(0, $count, '?'));
}

function cms1500_split_codes($raw)
{
    if ($raw === null) {
        return [];
    }
    $raw = trim((string)$raw);
    if ($raw === '') {
        return [];
    }
    $parts = preg_split('/[,;\n\r]+/', $raw, -1, PREG_SPLIT_NO_EMPTY);
    $codes = [];
    foreach ($parts as $part) {
        $t = strtoupper(trim($part));
        if ($t !== '') {
            $codes[] = $t;
        }
    }
    return array_values(array_unique($codes));
}

function cms1500_to_bool_yes_no($raw)
{
    $v = strtolower(trim((string)$raw));
    if ($v === '' || $v === 'signature on file') {
        return 'YES';
    }
    if (in_array($v, ['yes', 'y', '1', 'true'], true)) {
        return 'YES';
    }
    if (in_array($v, ['no', 'n', '0', 'false'], true)) {
        return 'NO';
    }
    return strtoupper($v);
}

/** TinyInt/boolean insurance flags (e.g. do_not_accept_assignment_box27). */
function cms1500_insurance_flag_true($raw)
{
    if ($raw === null || $raw === '') {
        return false;
    }
    if (is_bool($raw)) {
        return $raw;
    }
    if (is_numeric($raw)) {
        return ((int)$raw) !== 0;
    }
    $v = strtolower(trim((string)$raw));
    return in_array($v, ['1', 'true', 'yes', 'y', 'on'], true);
}

function cms1500_prior_auth_number($authInfo)
{
    if (!$authInfo || !isset($authInfo['authorization_number'])) {
        return '';
    }
    return trim((string)$authInfo['authorization_number']);
}

/**
 * Box 32: keep location legal name; street/city from session service address when present.
 *
 * @param array $location locations row
 * @param array $session sessions row
 * @param array $client clients row
 */
function cms1500_service_facility_for_claim($location, $session, $client)
{
    $name = $location['facility_name'] ?? '';
    $npi = $location['facility_npi_number'] ?? '';
    $raw = trim((string)($session['location_address'] ?? ''));
    if ($raw !== '') {
        $parts = preg_split('/,\s*/', $raw, -1, PREG_SPLIT_NO_EMPTY);
        $parts = array_map('trim', $parts);
        if (count($parts) >= 2) {
            $cityLine = (string)array_pop($parts);
            $street = implode(', ', $parts);
            return [
                'name' => $name,
                'npi' => $npi,
                'address_line_1' => $street,
                'address_line_2' => '',
                'city' => '',
                'state' => '',
                'zip' => '',
                'location_line' => $cityLine,
            ];
        }
        return [
            'name' => $name,
            'npi' => $npi,
            'address_line_1' => $raw,
            'address_line_2' => '',
            'city' => $client['city'] ?? '',
            'state' => $client['state'] ?? '',
            'zip' => $client['zipcode'] ?? '',
            'location_line' => '',
        ];
    }
    return [
        'name' => $name,
        'npi' => $npi,
        'address_line_1' => $location['facility_address'] ?? '',
        'address_line_2' => $location['facility_apt_unit'] ?? '',
        'city' => $location['facility_city'] ?? '',
        'state' => $location['facility_state'] ?? '',
        'zip' => $location['facility_zip_code'] ?? '',
        'location_line' => '',
    ];
}

function cms1500_pos_code($raw)
{
    $v = trim((string)$raw);
    if ($v === '') {
        return '';
    }
    if (preg_match('/^\d{2}$/', $v)) {
        return $v;
    }
    $map = [
        'home' => '12',
        'clinic' => '11',
        'school' => '03',
        'virtual' => '02',
        'telehealth' => '02',
        'other' => '99',
    ];
    $k = strtolower($v);
    return $map[$k] ?? $v;
}

function cms1500_procedure_and_modifiers($raw)
{
    $value = strtoupper(trim((string)$raw));
    if ($value === '') {
        return ['procedure' => '', 'modifiers' => []];
    }
    $firstToken = preg_split('/[\s,;|]+/', $value, -1, PREG_SPLIT_NO_EMPTY)[0] ?? '';
    if ($firstToken === '') {
        return ['procedure' => '', 'modifiers' => []];
    }
    $parts = explode('-', $firstToken);
    $procedure = preg_replace('/[^A-Z0-9]/', '', $parts[0] ?? '');
    $modifiers = [];
    for ($i = 1; $i < count($parts); $i++) {
        $m = preg_replace('/[^A-Z0-9]/', '', $parts[$i]);
        if ($m !== '') {
            $modifiers[] = substr($m, 0, 2);
        }
    }
    return [
        'procedure' => $procedure,
        'modifiers' => array_slice($modifiers, 0, 4),
    ];
}

function cms1500_float_or_null($raw)
{
    if ($raw === null || $raw === '') {
        return null;
    }
    return round((float)$raw, 2);
}

function cms1500_fetch_client(mysqli $conn, $clientId)
{
    $stmt = $conn->prepare('SELECT * FROM clients WHERE client_id = ? LIMIT 1');
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('s', $clientId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

/**
 * Many deployments store patient street/city/state/ZIP only in client_addresses while
 * clients.address_line_* / city remain empty — merge for CMS-1500 Box 5 (& Box 7 when insured same-as patient).
 *
 * Also coalesce clients.zip → zipcode where older schemas use alternate column names.
 */
function cms1500_client_fill_zip_aliases(array &$client)
{
    $z = trim((string)($client['zipcode'] ?? ''));
    if ($z !== '') {
        return;
    }
    foreach (['zip', 'postal_code', 'post_code'] as $k) {
        if (!empty($client[$k]) && trim((string)$client[$k]) !== '') {
            $client['zipcode'] = $client[$k];
            break;
        }
    }
}

/** @param array<string,mixed> $client Mutated clients row */
function cms1500_enrich_client_with_addresses_table(mysqli $conn, array $client): array
{
    cms1500_client_fill_zip_aliases($client);
    $cid = trim((string)($client['client_id'] ?? ''));
    if ($cid === '') {
        return $client;
    }

    $stmt = $conn->prepare('SELECT * FROM client_addresses WHERE client_id = ?');
    if (!$stmt) {
        return $client;
    }
    $stmt->bind_param('s', $cid);
    if (!$stmt->execute()) {
        $stmt->close();
        return $client;
    }
    $result = $stmt->get_result();
    $fallback = null;
    $chosen = null;
    while ($row = $result->fetch_assoc()) {
        if ($fallback === null) {
            $fallback = $row;
        }
        if (trim((string)($row['address_line_1'] ?? '')) !== '') {
            $chosen = $row;
            break;
        }
    }
    $stmt->close();

    $addr = $chosen ?? $fallback;
    if (!$addr) {
        return $client;
    }

    foreach (['address_line_1', 'address_line_2', 'city', 'state'] as $k) {
        $cur = trim((string)($client[$k] ?? ''));
        $incoming = isset($addr[$k]) ? trim((string)$addr[$k]) : '';
        if ($cur === '' && $incoming !== '') {
            $client[$k] = $addr[$k];
        }
    }

    $zcur = trim((string)($client['zipcode'] ?? ''));
    if ($zcur === '') {
        foreach (['zipcode', 'zip', 'postal_code'] as $zk) {
            $incomingZ = isset($addr[$zk]) ? trim((string)$addr[$zk]) : '';
            if ($incomingZ !== '') {
                $client['zipcode'] = $incomingZ;
                break;
            }
        }
    }

    cms1500_client_fill_zip_aliases($client);

    return $client;
}

/**
 * Billing provider Box 33: when billing_* is blank, NUCC expects a valid payer address —
 * reuse facility/legal site address as a pragmatic default (common single-site setups).
 *
 * @param array<string,mixed> $loc
 * @return array<string,mixed>
 */
function cms1500_fill_location_billing_from_facility(array $loc): array
{
    $pairs = [
        ['billing_provider_name', 'facility_name'],
        ['billing_address', 'facility_address'],
        ['billing_apt_unit', 'facility_apt_unit'],
        ['billing_city', 'facility_city'],
        ['billing_state', 'facility_state'],
        ['billing_zip_code', 'facility_zip_code'],
    ];
    foreach ($pairs as $pair) {
        list($billingKey, $facKey) = $pair;
        $bv = trim((string)($loc[$billingKey] ?? ''));
        if ($bv !== '') {
            continue;
        }
        $fv = isset($loc[$facKey]) ? trim((string)$loc[$facKey]) : '';
        if ($fv !== '') {
            $loc[$billingKey] = $loc[$facKey];
        }
    }

    return $loc;
}

function cms1500_fetch_insurance(mysqli $conn, $clientId, $insuranceId)
{
    $iid = (int)$insuranceId;
    $stmt = $conn->prepare('SELECT * FROM client_insurance WHERE client_id = ? AND insurance_id = ? LIMIT 1');
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('si', $clientId, $iid);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function cms1500_fetch_location(mysqli $conn, $locationId)
{
    $stmt = $conn->prepare('SELECT * FROM locations WHERE id = ? LIMIT 1');
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('s', $locationId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function cms1500_fetch_sessions(mysqli $conn, $clientId, $sessionIds)
{
    if (count($sessionIds) === 0) {
        return [];
    }
    $ph = cms1500_placeholders(count($sessionIds));
    $sql = "SELECT * FROM sessions WHERE client_id = ? AND session_id IN ($ph) ORDER BY start_utc ASC";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return [];
    }
    $types = 's' . str_repeat('i', count($sessionIds));
    $params = array_merge([$clientId], $sessionIds);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    $stmt->close();
    return $rows;
}

function cms1500_fetch_sessions_by_ids(mysqli $conn, array $sessionIds)
{
    if (count($sessionIds) === 0) {
        return [];
    }
    $ph = cms1500_placeholders(count($sessionIds));
    $sql = "SELECT * FROM sessions WHERE session_id IN ($ph) ORDER BY start_utc ASC";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return [];
    }
    $types = str_repeat('i', count($sessionIds));
    $stmt->bind_param($types, ...$sessionIds);
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    $stmt->close();
    return $rows;
}

function cms1500_session_is_ready_to_bill(array $session): bool
{
    $claim = strtolower(trim((string)($session['claim_status'] ?? '')));
    return $claim !== '' && strpos($claim, 'ready') !== false;
}

function cms1500_resolve_insurance_id_for_session(mysqli $conn, array $session, int $overrideInsuranceId): int
{
    if ($overrideInsuranceId > 0) {
        return $overrideInsuranceId;
    }
    if (!empty($session['auth_id'])) {
        $authInfo = cms1500_fetch_auth_info($conn, $session['auth_id']);
        if ($authInfo && !empty($authInfo['insurance_id'])) {
            return (int)$authInfo['insurance_id'];
        }
    }
    return 0;
}

function cms1500_fetch_staff_map(mysqli $conn, $staffIds)
{
    $staffIds = array_values(array_unique(array_filter(array_map(function ($v) {
        return trim((string)$v);
    }, $staffIds))));
    if (count($staffIds) === 0) {
        return [];
    }
    $ph = cms1500_placeholders(count($staffIds));
    $sql = "SELECT * FROM staff WHERE id IN ($ph)";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return [];
    }
    $types = str_repeat('s', count($staffIds));
    $stmt->bind_param($types, ...$staffIds);
    $stmt->execute();
    $res = $stmt->get_result();
    $out = [];
    while ($row = $res->fetch_assoc()) {
        $out[(string)$row['id']] = $row;
    }
    $stmt->close();
    return $out;
}

function cms1500_client_auth_identifier_where(mysqli $conn, $alias = '')
{
    static $cache = [];
    $key = $alias;
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
    if ($hasAuthId && $hasId) {
        $cache[$key] = ['clause' => "({$alias}auth_id = ? OR {$alias}id = ?)", 'dual' => true];
    } elseif ($hasId && !$hasAuthId) {
        $cache[$key] = ['clause' => "{$alias}id = ?", 'dual' => false];
    } else {
        $cache[$key] = ['clause' => "{$alias}auth_id = ?", 'dual' => false];
    }
    return $cache[$key];
}

function cms1500_fetch_auth_info(mysqli $conn, $authId)
{
    if (!$authId) {
        return null;
    }
    $match = cms1500_client_auth_identifier_where($conn, '');
    $sql = "SELECT * FROM client_auth WHERE {$match['clause']} LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return null;
    }
    $aid = (int)$authId;
    if ($match['dual']) {
        $stmt->bind_param('ii', $aid, $aid);
    } else {
        $stmt->bind_param('i', $aid);
    }
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!is_array($input)) {
    cms1500_fail(400, 'Invalid JSON payload');
}

$clientIdInput = isset($input['client_id']) ? trim((string)$input['client_id']) : '';
$insuranceIdOverride = isset($input['insurance_id']) ? (int)$input['insurance_id'] : 0;
$locationId = isset($input['location_id']) ? trim((string)$input['location_id']) : '';
$sessionIds = cms1500_numeric_id_array($input['session_ids'] ?? []);

if ($locationId === '') {
    cms1500_fail(400, 'location_id is required');
}
if (count($sessionIds) === 0) {
    cms1500_fail(400, 'session_ids is required');
}
if (count($sessionIds) !== 1) {
    cms1500_fail(400, 'Send exactly one session_id per CMS-1500 form (client is resolved from the session).');
}

try {
    $conn = getDBConnection();

    $sessions = cms1500_fetch_sessions_by_ids($conn, $sessionIds);
    if (count($sessions) === 0) {
        cms1500_fail(404, 'Session not found');
    }

    $session = $sessions[0];
    if (!cms1500_session_is_ready_to_bill($session)) {
        cms1500_fail(400, 'Only sessions with claim status Ready to Bill can generate CMS-1500');
    }

    $clientId = $clientIdInput !== '' ? $clientIdInput : trim((string)($session['client_id'] ?? ''));
    if ($clientId === '') {
        cms1500_fail(400, 'Session has no client_id');
    }
    if ($clientIdInput !== '' && $clientIdInput !== trim((string)($session['client_id'] ?? ''))) {
        cms1500_fail(400, 'client_id does not match the session');
    }

    $insuranceId = cms1500_resolve_insurance_id_for_session($conn, $session, $insuranceIdOverride);
    if ($insuranceId <= 0) {
        cms1500_fail(400, 'Could not resolve insurance for session; link an authorization or pass insurance_id');
    }

    $client = cms1500_fetch_client($conn, $clientId);
    if (!$client) {
        cms1500_fail(404, 'Client not found');
    }
    $client = cms1500_enrich_client_with_addresses_table($conn, $client);

    $insurance = cms1500_fetch_insurance($conn, $clientId, $insuranceId);
    if (!$insurance) {
        cms1500_fail(404, 'Insurance not found for client');
    }

    $location = cms1500_fetch_location($conn, $locationId);
    if (!$location) {
        cms1500_fail(404, 'Location not found');
    }
    $location = cms1500_fill_location_billing_from_facility($location);

    $warnings = [];

    $staffIds = [];
    foreach ($sessions as $s) {
        if (!empty($s['provider_id'])) {
            $staffIds[] = $s['provider_id'];
        }
        if (!empty($s['supervising_provider_id'])) {
            $staffIds[] = $s['supervising_provider_id'];
        }
    }
    $staffMap = cms1500_fetch_staff_map($conn, $staffIds);

    $dxCodes = [];
    $seenDx = [];
    foreach (cms1500_split_codes($insurance['primary_diagnosis'] ?? '') as $c) {
        if ($c !== '' && !isset($seenDx[$c])) {
            $seenDx[$c] = true;
            $dxCodes[] = $c;
        }
    }
    foreach (['diagnosis_1', 'diagnosis_2', 'diagnosis_3', 'diagnosis_4', 'diagnosis_5'] as $k) {
        foreach (cms1500_split_codes($insurance[$k] ?? '') as $c) {
            if ($c !== '' && !isset($seenDx[$c])) {
                $seenDx[$c] = true;
                $dxCodes[] = $c;
            }
        }
    }
    if (count($dxCodes) === 0) {
        $warnings[] = 'No diagnosis codes found in client insurance row.';
    }

    $lines = [];
    $totalUnits = 0.0;
    $seenAuthWarnings = [];
    foreach ($sessions as $s) {
        $authInfo = null;
        if (!empty($s['auth_id'])) {
            $authInfo = cms1500_fetch_auth_info($conn, $s['auth_id']);
            if (!$authInfo && !isset($seenAuthWarnings[$s['auth_id']])) {
                $warnings[] = "No client_auth row matched auth_id {$s['auth_id']} for one or more sessions.";
                $seenAuthWarnings[$s['auth_id']] = true;
            }
        }

        $pm = cms1500_procedure_and_modifiers($s['auth_code'] ?? '');
        $units = null;
        if (isset($s['scheduled_hours']) && $s['scheduled_hours'] !== null && $s['scheduled_hours'] !== '') {
            $units = round((float)$s['scheduled_hours'] * 4, 2);
            $totalUnits += $units;
        } elseif (isset($s['rendered_hours']) && $s['rendered_hours'] !== null && $s['rendered_hours'] !== '') {
            $units = round((float)$s['rendered_hours'] * 4, 2);
            $totalUnits += $units;
            $warnings[] = "Session {$s['session_id']} used rendered_hours fallback for units.";
        } else {
            $warnings[] = "Session {$s['session_id']} is missing scheduled/rendered hours.";
        }

        $pos = cms1500_pos_code($s['place_of_service'] ?? '');
        if ($pos === '') {
            $warnings[] = "Session {$s['session_id']} is missing place_of_service.";
        }

        $provider = null;
        if (!empty($s['provider_id']) && isset($staffMap[(string)$s['provider_id']])) {
            $provider = $staffMap[(string)$s['provider_id']];
        }

        $lines[] = [
            'dos_from' => substr((string)($s['start_utc'] ?? ''), 0, 10),
            'dos_to' => substr((string)($s['end_utc'] ?? ''), 0, 10),
            'place_of_service' => $pos,
            'emergency_indicator' => false,
            'procedure_code' => $pm['procedure'],
            'modifiers' => $pm['modifiers'],
            'diagnosis_pointers' => count($dxCodes) > 0 ? [1] : [],
            'units' => $units,
            'unit_type' => 'UN',
            'charges' => null,
            'authorization_number' => cms1500_prior_auth_number($authInfo),
            'rendering_provider_name' => $provider ? trim(($provider['firstName'] ?? '') . ' ' . ($provider['lastName'] ?? '')) : ($s['provider_name'] ?? ''),
            'rendering_provider_npi' => $provider['npiNumber'] ?? null,
            'source' => [
                'type' => 'session',
                'id' => (int)$s['session_id'],
            ],
        ];
    }

    $firstSession = $sessions[0];

    $firstAuthInfo = null;
    if (!empty($firstSession['auth_id'])) {
        $firstAuthInfo = cms1500_fetch_auth_info($conn, $firstSession['auth_id']);
    }
    $priorAuthNumber = cms1500_prior_auth_number($firstAuthInfo);
    if ($priorAuthNumber === '' && !empty($firstSession['auth_id'])) {
        $warnings[] = 'Prior authorization number (Box 23) is empty; enter authorization_number on the linked client authorization.';
    }

    $renderingProvider = null;
    if (!empty($firstSession['provider_id']) && isset($staffMap[(string)$firstSession['provider_id']])) {
        $renderingProvider = $staffMap[(string)$firstSession['provider_id']];
    }
    if (!$renderingProvider) {
        $warnings[] = 'Rendering provider details not found in staff table for first selected session.';
    }

    $supervisingProvider = null;
    if (!empty($firstSession['supervising_provider_id']) && isset($staffMap[(string)$firstSession['supervising_provider_id']])) {
        $supervisingProvider = $staffMap[(string)$firstSession['supervising_provider_id']];
    }
    $signingProviderName = $supervisingProvider
        ? trim(($supervisingProvider['firstName'] ?? '') . ' ' . ($supervisingProvider['lastName'] ?? ''))
        : trim((string)($firstSession['supervising_provider_name'] ?? ''));
    $signingProviderNpi = $supervisingProvider ? trim((string)($supervisingProvider['npiNumber'] ?? '')) : '';
    if ($signingProviderName === '') {
        $warnings[] = 'Supervising provider (Box 31) is empty; set supervising BCBA on the session or staff record.';
    }

    if (empty($location['billing_npi_number'])) {
        $warnings[] = 'Selected location is missing billing NPI.';
    }
    if (empty($location['facility_npi_number'])) {
        $warnings[] = 'Selected location is missing facility NPI.';
    }
    if (empty($location['tax_id_professional'])) {
        $warnings[] = 'Selected location is missing tax ID.';
    }
    if (empty($insurance['insurance_id_number'])) {
        $warnings[] = 'Insurance row is missing insurance_id_number (Box 1a).';
    }

    $insuredSameAsPatient = cms1500_to_bool_yes_no($insurance['insured_same_as_client'] ?? '') === 'YES';

    $insuredStreetSeparate = trim((string)($insurance['insured_address'] ?? ''))
        ?: trim((string)($insurance['insured_street'] ?? ''));
    $insuredZipSeparate = trim((string)($insurance['insured_zipcode'] ?? ''))
        ?: trim((string)($insurance['insured_zip'] ?? ''));

    $payload = [
        'meta' => [
            'form' => 'CMS-1500 (02/12)',
            'generated_at' => gmdate('c'),
        ],
        'patient' => [
            'first_name' => $client['first_name'] ?? '',
            'last_name' => $client['last_name'] ?? '',
            'dob' => isset($client['date_of_birth']) ? substr((string)$client['date_of_birth'], 0, 10) : '',
            'sex' => $client['gender'] ?? '',
            'address_line_1' => $client['address_line_1'] ?? '',
            'address_line_2' => $client['address_line_2'] ?? '',
            'city' => $client['city'] ?? '',
            'state' => $client['state'] ?? '',
            'zip' => $client['zipcode'] ?? '',
        ],
        'insured' => [
            'first_name' => $insurance['insured_first_name'] ?? ($client['first_name'] ?? ''),
            'last_name' => $insurance['insured_last_name'] ?? ($client['last_name'] ?? ''),
            'dob' => isset($insurance['insured_dob']) ? substr((string)$insurance['insured_dob'], 0, 10) : '',
            'member_id' => $insurance['insurance_id_number'] ?? '',
            'relationship' => $insurance['insured_relationship'] ?? ($insurance['relationship_to_insured'] ?? ''),
            'same_as_patient' => cms1500_to_bool_yes_no($insurance['insured_same_as_client'] ?? ''),
            'address_line_1' => $insuredSameAsPatient
                ? ($client['address_line_1'] ?? '')
                : $insuredStreetSeparate,
            'address_line_2' => $insuredSameAsPatient ? ($client['address_line_2'] ?? '') : '',
            'city' => $insuredSameAsPatient ? ($client['city'] ?? '') : ($insurance['insured_city'] ?? ''),
            'state' => $insuredSameAsPatient ? ($client['state'] ?? '') : ($insurance['insured_state'] ?? ''),
            'zip' => $insuredSameAsPatient ? ($client['zipcode'] ?? '') : $insuredZipSeparate,
        ],
        'policy' => [
            'group_number' => $insurance['group_number'] ?? '',
            'plan_name' => $insurance['insurance_plan_name'] ?? '',
            'insurance_type' => $insurance['insurance_type'] ?? '',
        ],
        'diagnosis' => [
            'codes' => $dxCodes,
            'primary_index' => count($dxCodes) > 0 ? 1 : null,
        ],
        'prior_authorization_number' => $priorAuthNumber,
        'assignment' => !cms1500_insurance_flag_true($insurance['do_not_accept_assignment_box27'] ?? 0),
        'authorized_release_box12' => cms1500_to_bool_yes_no($insurance['authorized_release_box12'] ?? 'YES'),
        'authorized_release_box13' => cms1500_to_bool_yes_no($insurance['authorized_release_box13'] ?? 'YES'),
        'box12_signature_date' => !empty($insurance['date_of_signature'])
            ? substr((string)$insurance['date_of_signature'], 0, 10)
            : '',
        'billing_provider' => [
            'name' => $location['billing_provider_name'] ?? '',
            'npi' => $location['billing_npi_number'] ?? '',
            'address_line_1' => $location['billing_address'] ?? '',
            'address_line_2' => $location['billing_apt_unit'] ?? '',
            'city' => $location['billing_city'] ?? '',
            'state' => $location['billing_state'] ?? '',
            'zip' => $location['billing_zip_code'] ?? '',
            'taxonomy_code' => $location['taxonomy_code'] ?? '',
            'tax_id' => $location['tax_id_professional'] ?? '',
        ],
        'service_facility' => cms1500_service_facility_for_claim($location, $firstSession, $client),
        'rendering_provider' => [
            'name' => $renderingProvider
                ? trim(($renderingProvider['firstName'] ?? '') . ' ' . ($renderingProvider['lastName'] ?? ''))
                : ($firstSession['provider_name'] ?? ''),
            'npi' => $renderingProvider ? ($renderingProvider['npiNumber'] ?? '') : '',
        ],
        'signing_provider' => [
            'name' => $signingProviderName,
            'npi' => $signingProviderNpi,
        ],
        'patient_account_number' => trim((string)($firstSession['claim_id'] ?? '')) !== ''
            ? trim((string)$firstSession['claim_id'])
            : (string)$firstSession['session_id'],
        'lines' => $lines,
        'amounts' => [
            'total_units' => round($totalUnits, 2),
            'total_charge' => null,
        ],
    ];

    echo json_encode([
        'success' => true,
        'payload' => $payload,
        'warnings' => array_values(array_unique($warnings)),
        'sources' => [
            'client_id' => $clientId,
            'insurance_id' => $insuranceId,
            'location_id' => $locationId,
            'session_ids' => $sessionIds,
        ],
    ]);
} catch (Exception $e) {
    cms1500_fail(500, $e->getMessage());
}

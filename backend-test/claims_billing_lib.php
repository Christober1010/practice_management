<?php
/** Shared CMS-1500 / billing claim builders for backend-test. */
require_once __DIR__ . '/session_rate_lib.php';
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

function cms1500_auth_billing_date_fragment($value)
{
    $s = trim(substr((string)$value, 0, 10));
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $s, $m)) {
        return $m[2] . '/' . $m[3] . '/' . $m[1];
    }
    return $s !== '' ? $s : '…';
}

function cms1500_auth_row_matches_session_code(array $auth, string $storedCode)
{
    $code = trim($storedCode);
    if ($code === '') {
        return false;
    }
    $billing = trim((string)($auth['billing_codes'] ?? ''));
    $authNum = trim((string)($auth['authorization_number'] ?? ''));
    $start = cms1500_auth_billing_date_fragment($auth['start_date'] ?? '');
    $end = cms1500_auth_billing_date_fragment($auth['end_date'] ?? '');
    $suffix = $authNum !== '' ? "{$authNum}-{$start}-{$end}" : '';
    $candidates = array_filter([
        $billing !== '' && $suffix !== '' ? "{$billing} - {$suffix}" : '',
        $suffix,
        $billing,
        $authNum,
    ]);
    return in_array($code, $candidates, true);
}

/**
 * CMS-1500 Box 24E: pointers are letters A–L (Box 21 diagnosis positions), not digits.
 *
 * @return string[] e.g. ['A'] or ['A','B']
 */
function cms1500_parse_diagnosis_pointers($raw)
{
    $raw = trim((string)$raw);
    if ($raw === '') {
        return ['A'];
    }
    $parts = preg_split('/[\s,;]+/', strtoupper($raw), -1, PREG_SPLIT_NO_EMPTY);
    $out = [];
    foreach ($parts as $p) {
        if (preg_match('/^[A-L]$/', $p)) {
            $out[] = $p;
            continue;
        }
        if (preg_match('/^(\d+)$/', $p, $m)) {
            $i = (int)$m[1];
            if ($i >= 1 && $i <= 12) {
                $out[] = chr(ord('A') + $i - 1);
            }
        }
    }
    return count($out) > 0 ? $out : ['A'];
}

function cms1500_rendering_id_qualifier(array $session): string
{
    $q = strtoupper(trim((string)($session['rendering_id_qualifier'] ?? '')));
    return $q !== '' ? substr($q, 0, 4) : 'ZZ';
}

function cms1500_prior_auth_from_session_auth_code($authCode)
{
    $raw = trim((string)$authCode);
    if ($raw === '') {
        return '';
    }
    if (preg_match('/\s-\s([^-]+)-\d{2}\/\d{2}\/\d{4}/', $raw, $m)) {
        $n = trim($m[1]);
        return $n !== '' && $n !== '—' ? $n : '';
    }
    if (preg_match('/^([^-]+)-\d{2}\/\d{2}\/\d{4}/', $raw, $m)) {
        $n = trim($m[1]);
        return $n !== '' && $n !== '—' ? $n : '';
    }
    return '';
}

function cms1500_fetch_auth_for_session(mysqli $conn, array $session, int $insuranceId)
{
    if (!empty($session['auth_id'])) {
        $row = cms1500_fetch_auth_info($conn, $session['auth_id']);
        if ($row) {
            return $row;
        }
    }
    $authCode = trim((string)($session['auth_code'] ?? ''));
    if ($insuranceId <= 0 || $authCode === '') {
        return null;
    }
    $stmt = $conn->prepare('SELECT * FROM client_auth WHERE insurance_id = ? ORDER BY created_at DESC');
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('i', $insuranceId);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        if (cms1500_auth_row_matches_session_code($row, $authCode)) {
            $stmt->close();
            return $row;
        }
    }
    $stmt->close();
    return null;
}

function cms1500_prior_auth_number($authInfo, $insurance = null, $session = null)
{
    if (is_array($authInfo)) {
        $n = trim((string)($authInfo['authorization_number'] ?? ''));
        if ($n !== '') {
            return $n;
        }
    }
    if (is_array($insurance)) {
        $n = trim((string)($insurance['authorization_number'] ?? ''));
        if ($n !== '') {
            return $n;
        }
    }
    if (is_array($session)) {
        $n = cms1500_prior_auth_from_session_auth_code($session['auth_code'] ?? '');
        if ($n !== '') {
            return $n;
        }
    }
    return '';
}

function cms1500_resolve_claim_prior_auth_number(mysqli $conn, array $sessions, array $insurance)
{
    $insuranceId = (int)($insurance['insurance_id'] ?? 0);
    foreach ($sessions as $session) {
        $authInfo = cms1500_fetch_auth_for_session($conn, $session, $insuranceId);
        $n = cms1500_prior_auth_number($authInfo, $insurance, $session);
        if ($n !== '') {
            return $n;
        }
    }
    return cms1500_prior_auth_number(null, $insurance);
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

function cms1500_session_line_charges(mysqli $conn, array $session, ?array $insurance, ?float $units): ?float
{
    if (isset($session['line_charge']) && $session['line_charge'] !== '' && $session['line_charge'] !== null) {
        return cms1500_float_or_null($session['line_charge']);
    }

    $hours = session_rate_billing_hours($session['scheduled_hours'] ?? null, $session['rendered_hours'] ?? null);

    $providerId = trim((string)($insurance['insurance_provider_id'] ?? ''));
    if ($providerId === '' && !empty($session['auth_id']) && !empty($session['client_id'])) {
        $resolved = session_rate_fetch_insurance_provider_for_auth(
            $conn,
            (int)$session['auth_id'],
            (string)$session['client_id']
        );
        $providerId = $resolved ?? '';
    }
    if ($providerId === '' || $hours === null) {
        return null;
    }

    $billingCodes = !empty($session['auth_id'])
        ? session_rate_fetch_auth_billing_codes($conn, (int)$session['auth_id'])
        : null;
    $candidates = session_rate_procedure_candidates((string)($session['auth_code'] ?? ''), $billingCodes);
    foreach ($candidates as $procedureCode) {
        $mapping = session_rate_lookup_provider_mapping($conn, $providerId, $procedureCode);
        if ($mapping) {
            return session_rate_calc_line_charge(
                $mapping['rate'],
                $mapping['unit_type'],
                $mapping['unit_duration'],
                $hours
            );
        }
    }

    return null;
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

function cms1500_fetch_master_provider(mysqli $conn, $providerId)
{
    $pid = trim((string)$providerId);
    if ($pid === '') {
        return null;
    }
    $stmt = $conn->prepare('SELECT * FROM master_providers WHERE id = ? AND (archived IS NULL OR archived = 0) LIMIT 1');
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('s', $pid);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

/**
 * CMS-1500 top header: insurance carrier from Manage Providers (master_providers).
 *
 * @return array{name:string,id:string,address_line_1:string,address_line_2:string,city:string,state:string,zip:string}
 */
function cms1500_payer_for_claim(mysqli $conn, array $insurance, array $session, array &$warnings)
{
    $providerId = trim((string)($insurance['insurance_provider_id'] ?? ''));
    if ($providerId === '' && !empty($session['auth_id']) && !empty($session['client_id'])) {
        $resolved = session_rate_fetch_insurance_provider_for_auth(
            $conn,
            (int)$session['auth_id'],
            (string)$session['client_id']
        );
        $providerId = $resolved ?? '';
    }

    $masterProvider = $providerId !== '' ? cms1500_fetch_master_provider($conn, $providerId) : null;
    if ($providerId !== '' && !$masterProvider) {
        $warnings[] = 'Insurance provider master record not found; header address may be incomplete.';
    }

    $name = $masterProvider ? trim((string)($masterProvider['provider_name'] ?? '')) : '';
    if ($name === '') {
        $name = trim((string)($insurance['insurance_provider'] ?? ($insurance['insurance_plan_name'] ?? '')));
    }

    $payer = [
        'id' => trim((string)($insurance['carrier_payer_id'] ?? '')),
        'name' => $name,
        'address_line_1' => $masterProvider ? trim((string)($masterProvider['address1'] ?? '')) : '',
        'address_line_2' => $masterProvider ? trim((string)($masterProvider['address2'] ?? '')) : '',
        'city' => $masterProvider ? trim((string)($masterProvider['city'] ?? '')) : '',
        'state' => $masterProvider ? trim((string)($masterProvider['state'] ?? '')) : '',
        'zip' => $masterProvider ? trim((string)($masterProvider['zip_code'] ?? '')) : '',
    ];

    if ($providerId === '') {
        $warnings[] = 'Client insurance is missing insurance provider; CMS-1500 header address cannot be resolved.';
    } elseif ($masterProvider && $payer['address_line_1'] === '' && $payer['city'] === '') {
        $warnings[] = 'Insurance provider is missing address in Manage Providers.';
    }

    return $payer;
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

/**
 * Build CMS-1500 claim payload from session(s) and related records.
 *
 * @param array{require_ready_to_bill?: bool, max_sessions?: int|null} $options
 * @return array{payload: array, warnings: array, sources: array, insurance: array, sessions: array}
 */
function cms1500_build_claim_payload(mysqli $conn, array $input, array $options = []): array
{
    $requireReady = (bool)($options['require_ready_to_bill'] ?? true);
    $maxSessions = array_key_exists('max_sessions', $options) ? $options['max_sessions'] : null;

    $clientIdInput = isset($input['client_id']) ? trim((string)$input['client_id']) : '';
    $insuranceIdOverride = isset($input['insurance_id']) ? (int)$input['insurance_id'] : 0;
    $locationId = isset($input['location_id']) ? trim((string)$input['location_id']) : '';
    $sessionIds = cms1500_numeric_id_array($input['session_ids'] ?? []);

    if ($locationId === '') {
        throw new InvalidArgumentException('location_id is required');
    }
    if (count($sessionIds) === 0) {
        throw new InvalidArgumentException('session_ids is required');
    }
    if ($maxSessions !== null && count($sessionIds) > (int)$maxSessions) {
        throw new InvalidArgumentException('Too many session_ids for this operation');
    }

    $sessions = cms1500_fetch_sessions_by_ids($conn, $sessionIds);
    if (count($sessions) === 0) {
        throw new RuntimeException('Session not found', 404);
    }

    foreach ($sessions as $session) {
        if ($requireReady && !cms1500_session_is_ready_to_bill($session)) {
            throw new InvalidArgumentException('Only sessions with claim status Ready to Bill can be billed');
        }
    }

    $session = $sessions[0];
    $clientId = $clientIdInput !== '' ? $clientIdInput : trim((string)($session['client_id'] ?? ''));
    if ($clientId === '') {
        throw new InvalidArgumentException('Session has no client_id');
    }
    if ($clientIdInput !== '' && $clientIdInput !== trim((string)($session['client_id'] ?? ''))) {
        throw new InvalidArgumentException('client_id does not match the session');
    }

    $insuranceId = cms1500_resolve_insurance_id_for_session($conn, $session, $insuranceIdOverride);
    if ($insuranceId <= 0) {
        throw new InvalidArgumentException('Could not resolve insurance for session; link an authorization or pass insurance_id');
    }

    $client = cms1500_fetch_client($conn, $clientId);
    if (!$client) {
        throw new RuntimeException('Client not found', 404);
    }
    $client = cms1500_enrich_client_with_addresses_table($conn, $client);

    $insurance = cms1500_fetch_insurance($conn, $clientId, $insuranceId);
    if (!$insurance) {
        throw new RuntimeException('Insurance not found for client', 404);
    }

    $location = cms1500_fetch_location($conn, $locationId);
    if (!$location) {
        throw new RuntimeException('Location not found', 404);
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
    $totalCharges = 0.0;
    $seenAuthWarnings = [];
    $resolvedInsuranceId = (int)($insurance['insurance_id'] ?? 0);
    foreach ($sessions as $s) {
        $authInfo = cms1500_fetch_auth_for_session($conn, $s, $resolvedInsuranceId);
        if (!$authInfo && !empty($s['auth_id']) && !isset($seenAuthWarnings[$s['auth_id']])) {
            $warnings[] = "No client_auth row matched auth_id {$s['auth_id']} for one or more sessions.";
            $seenAuthWarnings[$s['auth_id']] = true;
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

        $charges = cms1500_session_line_charges($conn, $s, $insurance, $units);
        if ($charges === null && $units !== null) {
            $warnings[] = "Session {$s['session_id']} is missing line charge (Box 24F); check payer service code rate mapping.";
        } elseif ($charges !== null) {
            $totalCharges += $charges;
        }

        $lines[] = [
            'dos_from' => substr((string)($s['start_utc'] ?? ''), 0, 10),
            'dos_to' => substr((string)($s['end_utc'] ?? ''), 0, 10),
            'place_of_service' => $pos,
            'emergency_indicator' => false,
            'procedure_code' => $pm['procedure'],
            'modifiers' => $pm['modifiers'],
            'diagnosis_pointers' => count($dxCodes) > 0
                ? cms1500_parse_diagnosis_pointers($s['diagnosis_pointer'] ?? 'A')
                : [],
            'units' => $units,
            'unit_type' => 'UN',
            'charges' => $charges,
            'authorization_number' => cms1500_prior_auth_number($authInfo, $insurance, $s),
            'rendering_provider_id_qualifier' => cms1500_rendering_id_qualifier($s),
            'rendering_provider_name' => $provider ? trim(($provider['firstName'] ?? '') . ' ' . ($provider['lastName'] ?? '')) : ($s['provider_name'] ?? ''),
            'rendering_provider_npi' => $provider['npiNumber'] ?? null,
            'source' => [
                'type' => 'session',
                'id' => (int)$s['session_id'],
            ],
        ];
    }

    $firstSession = $sessions[0];

    $priorAuthNumber = cms1500_resolve_claim_prior_auth_number($conn, $sessions, $insurance);
    if ($priorAuthNumber === '') {
        $warnings[] = 'Prior authorization number (Box 23) is empty; enter authorization_number on the client authorization or insurance record.';
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

    $payer = cms1500_payer_for_claim($conn, $insurance, $firstSession, $warnings);

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
            : ('CLM' . (int)($firstSession['session_id'] ?? 0)),
        'lines' => $lines,
        'amounts' => [
            'total_units' => round($totalUnits, 2),
            'total_charge' => $totalCharges > 0 ? round($totalCharges, 2) : null,
        ],
        'payer' => $payer,
    ];

    return [
        'payload' => $payload,
        'warnings' => array_values(array_unique($warnings)),
        'sources' => [
            'client_id' => $clientId,
            'insurance_id' => $insuranceId,
            'location_id' => $locationId,
            'session_ids' => $sessionIds,
        ],
        'insurance' => $insurance,
        'sessions' => $sessions,
    ];
}

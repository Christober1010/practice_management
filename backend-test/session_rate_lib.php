<?php
/** Resolve and persist session billing rates from master_provider_service_code. */

function session_rate_columns_exist(mysqli $conn): array
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = ['unit_rate' => false, 'line_charge' => false];
    $r = @$conn->query('SHOW COLUMNS FROM `sessions`');
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $f = (string)($row['Field'] ?? '');
            if ($f === 'unit_rate') {
                $cached['unit_rate'] = true;
            }
            if ($f === 'line_charge') {
                $cached['line_charge'] = true;
            }
        }
        $r->free();
    }
    return $cached;
}

function session_auth_service_columns_exist(mysqli $conn): array
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = ['authorization_number' => false, 'service_code' => false];
    $r = @$conn->query('SHOW COLUMNS FROM `sessions`');
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $f = (string)($row['Field'] ?? '');
            if ($f === 'authorization_number') {
                $cached['authorization_number'] = true;
            }
            if ($f === 'service_code') {
                $cached['service_code'] = true;
            }
        }
        $r->free();
    }
    return $cached;
}

function session_rate_fetch_auth_identity_fields(mysqli $conn, int $authId): array
{
    $empty = ['authorization_number' => '', 'service_code' => ''];
    if ($authId <= 0) {
        return $empty;
    }
    $match = session_rate_client_auth_where($conn, '');
    $sql = "SELECT authorization_number, billing_codes FROM client_auth WHERE {$match['clause']} LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return $empty;
    }
    if ($match['dual']) {
        $stmt->bind_param('ii', $authId, $authId);
    } else {
        $stmt->bind_param('i', $authId);
    }
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) {
        return $empty;
    }
    $authNum = trim((string)($row['authorization_number'] ?? ''));
    $codes = session_rate_split_billing_codes($row['billing_codes'] ?? '');
    return [
        'authorization_number' => $authNum,
        'service_code' => count($codes) > 0 ? $codes[0] : '',
    ];
}

function session_persist_auth_service_fields(mysqli $conn, int $sessionId, int $authId): void
{
    $cols = session_auth_service_columns_exist($conn);
    if ($sessionId <= 0 || (!$cols['authorization_number'] && !$cols['service_code'])) {
        return;
    }

    $fields = session_rate_fetch_auth_identity_fields($conn, $authId);
    $authNum = $fields['authorization_number'] !== '' ? $fields['authorization_number'] : null;
    $serviceCode = $fields['service_code'] !== '' ? $fields['service_code'] : null;

    if ($cols['authorization_number'] && $cols['service_code']) {
        $stmt = $conn->prepare('UPDATE sessions SET authorization_number = ?, service_code = ? WHERE session_id = ?');
        if (!$stmt) {
            return;
        }
        $stmt->bind_param('ssi', $authNum, $serviceCode, $sessionId);
    } elseif ($cols['authorization_number']) {
        $stmt = $conn->prepare('UPDATE sessions SET authorization_number = ? WHERE session_id = ?');
        if (!$stmt) {
            return;
        }
        $stmt->bind_param('si', $authNum, $sessionId);
    } else {
        $stmt = $conn->prepare('UPDATE sessions SET service_code = ? WHERE session_id = ?');
        if (!$stmt) {
            return;
        }
        $stmt->bind_param('si', $serviceCode, $sessionId);
    }
    $stmt->execute();
    $stmt->close();
}

function session_rate_client_auth_where(mysqli $conn, string $tableAlias = ''): array
{
    static $cache = [];
    $key = $tableAlias;
    if (isset($cache[$key])) {
        return $cache[$key];
    }
    $hasAuthId = false;
    $hasId = false;
    $r = @$conn->query('SHOW COLUMNS FROM `client_auth`');
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $f = (string)($row['Field'] ?? '');
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

function session_rate_parse_procedure_code(string $raw): string
{
    $value = strtoupper(trim($raw));
    if ($value === '') {
        return '';
    }
    $firstToken = preg_split('/[\s,;|]+/', $value, -1, PREG_SPLIT_NO_EMPTY)[0] ?? '';
    if ($firstToken === '') {
        return '';
    }
    $parts = explode('-', $firstToken);
    return preg_replace('/[^A-Z0-9]/', '', (string)($parts[0] ?? ''));
}

function session_rate_split_billing_codes($raw): array
{
    if ($raw === null || $raw === '') {
        return [];
    }
    $parts = preg_split('/[\s,;|]+/', (string)$raw, -1, PREG_SPLIT_NO_EMPTY);
    $out = [];
    foreach ($parts as $p) {
        $code = session_rate_parse_procedure_code($p);
        if ($code !== '') {
            $out[] = $code;
        }
    }
    return $out;
}

function session_rate_procedure_candidates(string $authCode, ?string $billingCodesRaw = null): array
{
    $seen = [];
    $out = [];
    foreach ([session_rate_parse_procedure_code($authCode)] as $code) {
        if ($code !== '' && !isset($seen[$code])) {
            $seen[$code] = true;
            $out[] = $code;
        }
    }
    foreach (session_rate_split_billing_codes($billingCodesRaw) as $code) {
        if (!isset($seen[$code])) {
            $seen[$code] = true;
            $out[] = $code;
        }
    }
    return $out;
}

function session_rate_fetch_insurance_provider_for_auth(mysqli $conn, int $authId, string $clientId): ?string
{
    if ($authId <= 0 || trim($clientId) === '') {
        return null;
    }
    $match = session_rate_client_auth_where($conn, 'ca.');
    $sql = "
        SELECT ci.insurance_provider_id
        FROM client_auth ca
        INNER JOIN client_insurance ci ON ca.insurance_id = ci.insurance_id AND ci.client_id = ?
        WHERE {$match['clause']}
        LIMIT 1
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return null;
    }
    if ($match['dual']) {
        $stmt->bind_param('sii', $clientId, $authId, $authId);
    } else {
        $stmt->bind_param('si', $clientId, $authId);
    }
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $pid = trim((string)($row['insurance_provider_id'] ?? ''));
    return $pid !== '' ? $pid : null;
}

function session_rate_fetch_auth_billing_codes(mysqli $conn, int $authId): ?string
{
    if ($authId <= 0) {
        return null;
    }
    $match = session_rate_client_auth_where($conn, '');
    $sql = "SELECT billing_codes FROM client_auth WHERE {$match['clause']} LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return null;
    }
    if ($match['dual']) {
        $stmt->bind_param('ii', $authId, $authId);
    } else {
        $stmt->bind_param('i', $authId);
    }
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) {
        return null;
    }
    $raw = trim((string)($row['billing_codes'] ?? ''));
    return $raw !== '' ? $raw : null;
}

function session_rate_lookup_provider_mapping(mysqli $conn, string $providerId, string $procedureCode): ?array
{
    $providerId = trim($providerId);
    $procedureCode = strtoupper(trim($procedureCode));
    if ($providerId === '' || $procedureCode === '') {
        return null;
    }
    $sql = "
        SELECT psc.rate, psc.unit_type, psc.unit_duration
        FROM master_provider_service_code psc
        INNER JOIN master_service_code sc ON psc.service_code_id = sc.code_id
        WHERE psc.provider_id = ?
          AND UPPER(TRIM(sc.code)) = ?
          AND psc.archived = 0
          AND UPPER(TRIM(IFNULL(psc.status, ''))) = 'ACTIVE'
        ORDER BY psc.id DESC
        LIMIT 1
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('ss', $providerId, $procedureCode);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row || $row['rate'] === null || $row['rate'] === '') {
        return null;
    }
    return [
        'rate' => round((float)$row['rate'], 2),
        'unit_type' => trim((string)($row['unit_type'] ?? 'Minute(s)')),
        'unit_duration' => (float)($row['unit_duration'] ?? 15),
        'procedure_code' => $procedureCode,
    ];
}

function session_rate_billing_hours($scheduledHours, $renderedHours = null): ?float
{
    if ($scheduledHours !== null && $scheduledHours !== '') {
        return round((float)$scheduledHours, 4);
    }
    if ($renderedHours !== null && $renderedHours !== '') {
        return round((float)$renderedHours, 4);
    }
    return null;
}

function session_rate_billing_units(float $hours, string $unitType, float $unitDuration): float
{
    $unitType = trim($unitType);
    $unitDuration = $unitDuration > 0 ? $unitDuration : 15.0;
    if ($unitType === 'Per Session') {
        return 1.0;
    }
    if ($unitType === 'Hour(s)') {
        return round($hours, 2);
    }
    if (abs($unitDuration - 15.0) < 0.001) {
        return round($hours * 4, 2);
    }
    return round($hours * 60 / $unitDuration, 2);
}

function session_rate_calc_line_charge(float $rate, string $unitType, float $unitDuration, ?float $hours): ?float
{
    if ($hours === null || $hours <= 0) {
        return null;
    }
    $unitType = trim($unitType);
    if ($unitType === 'Per Session') {
        return round($rate, 2);
    }
    if ($unitType === 'Hour(s)') {
        return round($rate * $hours, 2);
    }
    $units = session_rate_billing_units($hours, $unitType, $unitDuration);
    return round($rate * $units, 2);
}

/**
 * @return array{unit_rate: ?float, line_charge: ?float, procedure_code: ?string}
 */
function session_resolve_billing_rates(
    mysqli $conn,
    int $authId,
    string $clientId,
    string $authCode,
    $scheduledHours,
    $renderedHours = null
): array {
    $empty = ['unit_rate' => null, 'line_charge' => null, 'procedure_code' => null];
    $hours = session_rate_billing_hours($scheduledHours, $renderedHours);
    if ($hours === null || $hours <= 0) {
        return $empty;
    }

    $providerId = session_rate_fetch_insurance_provider_for_auth($conn, $authId, $clientId);
    if ($providerId === null) {
        return $empty;
    }

    $billingCodes = session_rate_fetch_auth_billing_codes($conn, $authId);
    $candidates = session_rate_procedure_candidates($authCode, $billingCodes);
    if (count($candidates) === 0) {
        return $empty;
    }

    foreach ($candidates as $procedureCode) {
        $mapping = session_rate_lookup_provider_mapping($conn, $providerId, $procedureCode);
        if (!$mapping) {
            continue;
        }
        $lineCharge = session_rate_calc_line_charge(
            $mapping['rate'],
            $mapping['unit_type'],
            $mapping['unit_duration'],
            $hours
        );
        return [
            'unit_rate' => $mapping['rate'],
            'line_charge' => $lineCharge,
            'procedure_code' => $procedureCode,
        ];
    }

    return $empty;
}

function session_taxonomy_column_exists(mysqli $conn): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $r = @$conn->query("SHOW COLUMNS FROM `sessions` LIKE 'taxonomy_code'");
    $cached = ($r && $r->num_rows > 0);
    if ($r) {
        $r->free();
    }
    return $cached;
}

function session_staff_has_taxonomy_column(mysqli $conn): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $r = @$conn->query("SHOW COLUMNS FROM `staff` LIKE 'taxonomy_code'");
    $cached = ($r && $r->num_rows > 0);
    if ($r) {
        $r->free();
    }
    return $cached;
}

function session_fetch_staff_taxonomy_code(mysqli $conn, string $providerStaffId): ?string
{
    $providerStaffId = trim($providerStaffId);
    if ($providerStaffId === '' || !session_staff_has_taxonomy_column($conn)) {
        return null;
    }
    $stmt = $conn->prepare('SELECT taxonomy_code FROM staff WHERE id = ? LIMIT 1');
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('s', $providerStaffId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $code = trim((string)($row['taxonomy_code'] ?? ''));
    return $code !== '' ? $code : null;
}

function session_persist_taxonomy_code(
    mysqli $conn,
    int $sessionId,
    string $providerStaffId,
    ?string $override = null
): void {
    if (!session_taxonomy_column_exists($conn) || $sessionId <= 0) {
        return;
    }

    $code = null;
    if ($override !== null && trim($override) !== '') {
        $code = trim($override);
    } else {
        $code = session_fetch_staff_taxonomy_code($conn, $providerStaffId);
    }

    $stmt = $conn->prepare('UPDATE sessions SET taxonomy_code = ? WHERE session_id = ?');
    if (!$stmt) {
        return;
    }
    $stmt->bind_param('si', $code, $sessionId);
    $stmt->execute();
    $stmt->close();
}

function session_persist_billing_rates(
    mysqli $conn,
    int $sessionId,
    int $authId,
    string $clientId,
    string $authCode,
    $scheduledHours,
    $renderedHours = null
): void {
    $cols = session_rate_columns_exist($conn);
    if (!$cols['unit_rate'] || !$cols['line_charge'] || $sessionId <= 0) {
        return;
    }

    $rates = session_resolve_billing_rates($conn, $authId, $clientId, $authCode, $scheduledHours, $renderedHours);
    $unitRate = $rates['unit_rate'];
    $lineCharge = $rates['line_charge'];

    $stmt = $conn->prepare('UPDATE sessions SET unit_rate = ?, line_charge = ? WHERE session_id = ?');
    if (!$stmt) {
        return;
    }
    $stmt->bind_param('ddi', $unitRate, $lineCharge, $sessionId);
    $stmt->execute();
    $stmt->close();
}

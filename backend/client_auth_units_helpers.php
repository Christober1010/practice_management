<?php
/**
 * Sync client_auth.units_serviced from scheduling sessions marked Ready to Bill.
 * Only claim_status containing "ready" counts (not Rendered alone).
 */

function client_auth_sessions_has_claim_status(mysqli $conn): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = false;
    $r = @$conn->query("SHOW COLUMNS FROM `sessions` LIKE 'claim_status'");
    if ($r && $r->num_rows > 0) {
        $cached = true;
    }
    if ($r) {
        $r->free();
    }
    return $cached;
}

function client_auth_sessions_has_auth_id(mysqli $conn): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = false;
    $r = @$conn->query("SHOW COLUMNS FROM `sessions` LIKE 'auth_id'");
    if ($r && $r->num_rows > 0) {
        $cached = true;
    }
    if ($r) {
        $r->free();
    }
    return $cached;
}

function client_auth_sessions_has_auth_id_pdo(PDO $conn): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = false;
    try {
        $r = $conn->query("SHOW COLUMNS FROM `sessions` LIKE 'auth_id'");
        $cached = $r && $r->rowCount() > 0;
    } catch (Throwable $e) {
        $cached = false;
    }
    return $cached;
}

function client_auth_sessions_has_column_mysqli(mysqli $conn, string $column): bool
{
    static $cache = [];
    $key = $column;
    if (isset($cache[$key])) {
        return $cache[$key];
    }
    $cache[$key] = false;
    $col = str_replace('`', '', $column);
    $r = @$conn->query("SHOW COLUMNS FROM `sessions` LIKE '" . $conn->real_escape_string($col) . "'");
    if ($r && $r->num_rows > 0) {
        $cache[$key] = true;
    }
    if ($r) {
        $r->free();
    }
    return $cache[$key];
}

function client_auth_sessions_has_column_pdo(PDO $conn, string $column): bool
{
    static $cache = [];
    if (isset($cache[$column])) {
        return $cache[$column];
    }
    $cache[$column] = false;
    try {
        $stmt = $conn->prepare('SHOW COLUMNS FROM `sessions` LIKE ?');
        $stmt->execute([$column]);
        $cache[$column] = $stmt->rowCount() > 0;
    } catch (Throwable $e) {
        $cache[$column] = false;
    }
    return $cache[$column];
}

/** Optional scheduled/rendered columns (prod may only have start_utc/end_utc). */
function client_auth_sessions_hours_select_mysqli(mysqli $conn): string
{
    $parts = [];
    if (client_auth_sessions_has_column_mysqli($conn, 'scheduled_hours')) {
        $parts[] = 'scheduled_hours';
    }
    if (client_auth_sessions_has_column_mysqli($conn, 'rendered_hours')) {
        $parts[] = 'rendered_hours';
    }
    return $parts === [] ? '' : implode(', ', $parts) . ', ';
}

function client_auth_sessions_hours_select_pdo(PDO $conn): string
{
    $parts = [];
    if (client_auth_sessions_has_column_pdo($conn, 'scheduled_hours')) {
        $parts[] = 'scheduled_hours';
    }
    if (client_auth_sessions_has_column_pdo($conn, 'rendered_hours')) {
        $parts[] = 'rendered_hours';
    }
    return $parts === [] ? '' : implode(', ', $parts) . ', ';
}

function client_auth_sessions_status_select_mysqli(mysqli $conn): string
{
    $parts = [];
    if (client_auth_sessions_has_column_mysqli($conn, 'STATUS')) {
        $parts[] = 'STATUS';
    }
    if (client_auth_sessions_has_column_mysqli($conn, 'status')) {
        $parts[] = 'status';
    }
    return $parts === [] ? '' : implode(', ', $parts);
}

function client_auth_sessions_status_select_pdo(PDO $conn): string
{
    $parts = [];
    if (client_auth_sessions_has_column_pdo($conn, 'STATUS')) {
        $parts[] = 'STATUS';
    }
    if (client_auth_sessions_has_column_pdo($conn, 'status')) {
        $parts[] = 'status';
    }
    return $parts === [] ? '1 AS status_ok' : implode(', ', $parts);
}

function client_auth_session_duration_hours(array $row): float
{
    $rendered = (float)($row['rendered_hours'] ?? 0);
    if ($rendered > 0) {
        return $rendered;
    }
    $scheduled = (float)($row['scheduled_hours'] ?? 0);
    if ($scheduled > 0) {
        return $scheduled;
    }
    $start = $row['start_utc'] ?? null;
    $end = $row['end_utc'] ?? null;
    if ($start === null || $start === '' || $end === null || $end === '') {
        return 0.0;
    }
    $s = strtotime((string)$start);
    $e = strtotime((string)$end);
    if ($s === false || $e === false || $e <= $s) {
        return 0.0;
    }
    return round(($e - $s) / 3600.0, 4);
}

/** 15-minute billing units (4 units per hour). */
function client_auth_hours_to_units(float $hours): float
{
    if ($hours <= 0) {
        return 0.0;
    }
    return round($hours * 4.0, 2);
}

function client_auth_session_is_ready_to_bill(array $row): bool
{
    $claim = strtolower(trim((string)($row['claim_status'] ?? '')));
    return $claim !== '' && strpos($claim, 'ready') !== false;
}

function client_auth_session_is_cancelled(array $row): bool
{
    $status = strtolower(trim((string)($row['STATUS'] ?? $row['status'] ?? '')));
    return $status === 'cancelled';
}

function client_auth_session_service_date(array $row): string
{
    $start = $row['start_utc'] ?? null;
    if ($start !== null && $start !== '') {
        $ts = strtotime((string)$start);
        if ($ts !== false) {
            return gmdate('Y-m-d', $ts);
        }
    }
    return date('Y-m-d');
}

/**
 * Aggregate Ready to Bill units for one authorization.
 *
 * @return array{total_units: float, by_date: array<string, float>, sessions: list<array>}
 */
function client_auth_aggregate_ready_to_bill_units(mysqli $conn, int $authId): array
{
    if ($authId <= 0) {
        return ['total_units' => 0.0, 'by_date' => [], 'sessions' => []];
    }
    if (!client_auth_sessions_has_claim_status($conn) || !client_auth_sessions_has_auth_id($conn)) {
        return ['total_units' => 0.0, 'by_date' => [], 'sessions' => []];
    }

    $hoursSelect = client_auth_sessions_hours_select_mysqli($conn);
    $statusSelect = client_auth_sessions_status_select_mysqli($conn);
    $statusSql = $statusSelect !== '' ? ", {$statusSelect}" : '';

    $stmt = $conn->prepare("
        SELECT session_id, auth_id, client_id, start_utc, end_utc,
               {$hoursSelect}claim_status{$statusSql}
        FROM sessions
        WHERE auth_id = ?
          AND LOWER(TRIM(IFNULL(claim_status, ''))) LIKE '%ready%'
    ");
    if (!$stmt) {
        return ['total_units' => 0.0, 'by_date' => [], 'sessions' => []];
    }
    $stmt->bind_param('i', $authId);
    $stmt->execute();
    $result = $stmt->get_result();

    $byDate = [];
    $sessions = [];
    $total = 0.0;

    while ($row = $result->fetch_assoc()) {
        if (client_auth_session_is_cancelled($row)) {
            continue;
        }
        if (!client_auth_session_is_ready_to_bill($row)) {
            continue;
        }
        $hours = client_auth_session_duration_hours($row);
        $units = client_auth_hours_to_units($hours);
        if ($units <= 0) {
            continue;
        }
        $dateKey = client_auth_session_service_date($row);
        $byDate[$dateKey] = ($byDate[$dateKey] ?? 0.0) + $units;
        $total += $units;
        $sessions[] = [
            'session_id' => (int)($row['session_id'] ?? 0),
            'service_date' => $dateKey,
            'units' => $units,
            'hours' => round($hours, 2),
            'claim_status' => (string)($row['claim_status'] ?? ''),
        ];
    }
    $stmt->close();

    ksort($byDate);
    usort($sessions, static function ($a, $b) {
        return strcmp($a['service_date'], $b['service_date']);
    });

    return [
        'total_units' => round($total, 2),
        'by_date' => $byDate,
        'sessions' => $sessions,
    ];
}

function client_auth_identifier_where_units(mysqli $conn, string $tableAlias = ''): array
{
    static $cache = [];
    $key = $tableAlias;
    if (isset($cache[$key])) {
        return $cache[$key];
    }
    $p = $tableAlias;
    $hasAuthId = false;
    $hasId = false;
    $r = @$conn->query('SHOW COLUMNS FROM `client_auth`');
    if ($r) {
        while ($col = $r->fetch_assoc()) {
            $f = strtolower((string)($col['Field'] ?? ''));
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
        $cache[$key] = ['clause' => "({$p}auth_id = ? OR {$p}id = ?)", 'dual' => true];
    } elseif ($hasId && !$hasAuthId) {
        $cache[$key] = ['clause' => "{$p}id = ?", 'dual' => false];
    } else {
        $cache[$key] = ['clause' => "{$p}auth_id = ?", 'dual' => false];
    }
    return $cache[$key];
}

/**
 * Recompute units_serviced from Ready to Bill sessions and persist on client_auth.
 */
function client_auth_sync_units_serviced_for_auth(mysqli $conn, int $authId): array
{
    $agg = client_auth_aggregate_ready_to_bill_units($conn, $authId);
    $totalStr = number_format($agg['total_units'], 2, '.', '');

    $match = client_auth_identifier_where_units($conn, '');
    $upd = $conn->prepare(
        "UPDATE client_auth SET units_serviced = ? WHERE {$match['clause']}"
    );
    if ($upd) {
        if ($match['dual']) {
            $upd->bind_param('sii', $totalStr, $authId, $authId);
        } else {
            $upd->bind_param('si', $totalStr, $authId);
        }
        $upd->execute();
        $upd->close();
    }

    return [
        'auth_id' => $authId,
        'units_serviced' => $totalStr,
        'units_by_date' => $agg['by_date'],
        'ready_to_bill_sessions' => $agg['sessions'],
    ];
}

/**
 * Enrich authorization rows (PDO get-clients) with synced units + date breakdown.
 */
function client_auth_enrich_authorizations_pdo(PDO $conn, array &$authorizations): void
{
    if (empty($authorizations)) {
        return;
    }

    $authIds = [];
    foreach ($authorizations as $auth) {
        $id = (int)($auth['auth_id'] ?? $auth['id'] ?? 0);
        if ($id > 0) {
            $authIds[$id] = true;
        }
    }
    if (empty($authIds)) {
        return;
    }

    $ids = array_keys($authIds);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    if (!client_auth_sessions_has_auth_id_pdo($conn)) {
        return;
    }

    try {
        $colCheck = $conn->query("SHOW COLUMNS FROM sessions LIKE 'claim_status'");
        if (!$colCheck || $colCheck->rowCount() === 0) {
            return;
        }
    } catch (Throwable $e) {
        return;
    }

    $hoursSelect = client_auth_sessions_hours_select_pdo($conn);
    $statusSelect = client_auth_sessions_status_select_pdo($conn);

    $sql = "
        SELECT session_id, auth_id, start_utc, end_utc, {$hoursSelect}claim_status, {$statusSelect}
        FROM sessions
        WHERE auth_id IN ($placeholders)
          AND LOWER(TRIM(IFNULL(claim_status, ''))) LIKE '%ready%'
    ";
    $stmt = $conn->prepare($sql);
    $stmt->execute($ids);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $aggByAuth = [];
    foreach ($rows as $row) {
        $status = strtolower(trim((string)($row['STATUS'] ?? $row['status'] ?? '')));
        if ($status === 'cancelled') {
            continue;
        }
        $claim = strtolower(trim((string)($row['claim_status'] ?? '')));
        if ($claim === '' || strpos($claim, 'ready') === false) {
            continue;
        }
        $authId = (int)($row['auth_id'] ?? 0);
        if ($authId <= 0) {
            continue;
        }
        $hours = client_auth_session_duration_hours($row);
        $units = client_auth_hours_to_units($hours);
        if ($units <= 0) {
            continue;
        }
        if (!isset($aggByAuth[$authId])) {
            $aggByAuth[$authId] = ['total' => 0.0, 'by_date' => [], 'sessions' => []];
        }
        $dateKey = client_auth_session_service_date($row);
        $aggByAuth[$authId]['by_date'][$dateKey] = ($aggByAuth[$authId]['by_date'][$dateKey] ?? 0.0) + $units;
        $aggByAuth[$authId]['total'] += $units;
        $aggByAuth[$authId]['sessions'][] = [
            'session_id' => (int)($row['session_id'] ?? 0),
            'service_date' => $dateKey,
            'units' => $units,
            'hours' => round($hours, 2),
        ];
    }

    foreach ($authorizations as &$auth) {
        $authId = (int)($auth['auth_id'] ?? $auth['id'] ?? 0);
        if ($authId <= 0 || !isset($aggByAuth[$authId])) {
            continue;
        }
        $bucket = $aggByAuth[$authId];
        $total = round($bucket['total'], 2);
        $totalStr = number_format($total, 2, '.', '');

        $auth['units_serviced'] = $totalStr;
        ksort($bucket['by_date']);
        $auth['units_serviced_by_date'] = $bucket['by_date'];
        usort($bucket['sessions'], static function ($a, $b) {
            return strcmp($a['service_date'], $b['service_date']);
        });
        $auth['ready_to_bill_sessions'] = $bucket['sessions'];

        try {
            $matchId = (int)($auth['auth_id'] ?? 0);
            $upd = $conn->prepare(
                'UPDATE client_auth SET units_serviced = ? WHERE auth_id = ? OR id = ?'
            );
            $upd->execute([$totalStr, $matchId, $matchId]);
        } catch (Throwable $e) {
            // non-fatal on read path
        }
    }
    unset($auth);
}

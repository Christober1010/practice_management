<?php
/**
 * Session Log API — internal sessions workflow (misc hrs + payment status).
 * GET: list sessions LEFT JOIN session_log
 * PATCH: upsert misc_hrs / log_status by session_id (bulk)
 *
 * RBAC: reports.read (GET), reports.write (PATCH)
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PATCH, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';

$authUser = requireAuthReadWrite('reports.read', 'reports.write', 'mahaverse');
$method = $_SERVER['REQUEST_METHOD'];

$host = "db5018266079.hosting-data.io";
$dbUser = "dbu3321929";
$dbPass = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$dbName = "dbs14484433";

$conn = new mysqli($host, $dbUser, $dbPass, $dbName);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}
$conn->set_charset('utf8mb4');

function session_log_fail($code, $msg)
{
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg]);
    exit();
}

function session_log_sessions_columns(mysqli $conn): array
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = [
        'claim_id' => false,
        'claim_status' => false,
        'status_col' => 'STATUS',
    ];
    $r = @$conn->query('SHOW COLUMNS FROM `sessions`');
    if ($r) {
        $names = [];
        while ($row = $r->fetch_assoc()) {
            $f = $row['Field'] ?? '';
            $names[$f] = true;
            if ($f === 'claim_id') {
                $cached['claim_id'] = true;
            }
            if ($f === 'claim_status') {
                $cached['claim_status'] = true;
            }
        }
        $r->free();
        if (!isset($names['STATUS']) && isset($names['status'])) {
            $cached['status_col'] = 'status';
        }
    }
    return $cached;
}

function session_log_table_exists(mysqli $conn): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $r = @$conn->query("SHOW TABLES LIKE 'session_log'");
    $cached = ($r && $r->num_rows > 0);
    if ($r) {
        $r->free();
    }
    return $cached;
}

function session_log_ensure_table(mysqli $conn): void
{
    if (!session_log_table_exists($conn)) {
        $sql = "CREATE TABLE IF NOT EXISTS session_log (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          session_id INT NOT NULL,
          misc_hrs DECIMAL(5,2) NULL DEFAULT NULL,
          log_status VARCHAR(32) NULL DEFAULT NULL,
          coinsurance_amount DECIMAL(12,2) NULL DEFAULT NULL,
          copay_amount DECIMAL(12,2) NULL DEFAULT NULL,
          deductible_amount DECIMAL(12,2) NULL DEFAULT NULL,
          payer_paid_amount DECIMAL(12,2) NULL DEFAULT NULL,
          check_number VARCHAR(100) NULL DEFAULT NULL,
          ap_invoice VARCHAR(64) NULL DEFAULT NULL,
          ap_date DATE NULL DEFAULT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
          created_by VARCHAR(255) NULL DEFAULT NULL,
          updated_by VARCHAR(255) NULL DEFAULT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_session_log_session (session_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        if (!$conn->query($sql)) {
            session_log_fail(500, 'Failed to create session_log table: ' . $conn->error);
        }
    }
    session_log_ensure_payment_columns($conn);
}

function session_log_ensure_payment_columns(mysqli $conn): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $needed = [
        'coinsurance_amount' => "DECIMAL(12,2) NULL DEFAULT NULL",
        'copay_amount' => "DECIMAL(12,2) NULL DEFAULT NULL",
        'deductible_amount' => "DECIMAL(12,2) NULL DEFAULT NULL",
        'payer_paid_amount' => "DECIMAL(12,2) NULL DEFAULT NULL",
        'check_number' => "VARCHAR(100) NULL DEFAULT NULL",
        'ap_invoice' => "VARCHAR(64) NULL DEFAULT NULL",
        'ap_date' => "DATE NULL DEFAULT NULL",
    ];
    $existing = [];
    $r = @$conn->query('SHOW COLUMNS FROM `session_log`');
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $existing[$row['Field'] ?? ''] = true;
        }
        $r->free();
    }
    foreach ($needed as $col => $def) {
        if (!isset($existing[$col])) {
            @$conn->query("ALTER TABLE session_log ADD COLUMN `{$col}` {$def}");
        }
    }
    $done = true;
}

function session_log_money_or_null($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_numeric($value)) {
        return null;
    }
    return (string) round((float)$value, 2);
}

function session_log_str_or_null($value): ?string
{
    if ($value === null) {
        return null;
    }
    $s = trim((string)$value);
    return $s === '' ? null : $s;
}

function session_log_normalize_status($value): ?string
{
    if ($value === null) {
        return null;
    }
    $s = trim((string)$value);
    if ($s === '') {
        return null;
    }
    $lower = strtolower($s);
    if ($lower === 'pending payment' || $lower === 'pending') {
        return 'Pending Payment';
    }
    if ($lower === 'received payment' || $lower === 'received') {
        return 'Received Payment';
    }
    if ($lower === 'clear' || $lower === 'rendered' || $lower === 'null') {
        return null;
    }
    return null;
}

function session_log_session_status($row): string
{
    $st = strtolower(trim((string)($row['STATUS'] ?? $row['status'] ?? '')));
    if ($st === 'rendered' || $st === 'completed') {
        return 'Rendered';
    }
    if ($st === 'cancelled' || $st === 'canceled') {
        return 'Cancelled';
    }
    // Match lib/scheduling-session-status.js — prod rows often have blank STATUS
    // with rendered_hours / Ready to Bill already set.
    $hrs = (float)($row['rendered_hours'] ?? 0);
    if ($hrs > 0) {
        return 'Rendered';
    }
    $claim = strtolower(trim((string)($row['claim_status'] ?? '')));
    if ($claim !== '' && str_contains($claim, 'ready to bill')) {
        return 'Rendered';
    }
    $claimId = trim((string)($row['claim_id'] ?? ''));
    if ($claimId !== '') {
        return 'Rendered';
    }
    return 'Scheduled';
}

function session_log_tab_bucket(string $sessionStatus, ?string $logStatus): string
{
    if ($logStatus === 'Pending Payment') {
        return 'Pending Payment';
    }
    if ($logStatus === 'Received Payment') {
        return 'Received Payment';
    }
    if ($sessionStatus === 'Rendered') {
        return 'Rendered';
    }
    return 'Scheduled';
}

function session_log_split_name(?string $full): array
{
    $full = trim((string)$full);
    if ($full === '') {
        return ['', ''];
    }
    $parts = preg_split('/\s+/', $full, 2);
    return [$parts[0] ?? '', $parts[1] ?? ''];
}

function session_log_map_row(array $row): array
{
    $sessionStatus = session_log_session_status($row);
    $logStatus = session_log_normalize_status($row['log_status'] ?? null);
    $misc = $row['misc_hrs'] ?? null;
    if ($misc !== null && $misc !== '') {
        $misc = (float)$misc;
    } else {
        $misc = null;
    }

    $clientFirst = trim((string)($row['client_first_name'] ?? ''));
    $clientLast = trim((string)($row['client_last_name'] ?? ''));
    if ($clientFirst === '' && $clientLast === '') {
        [$clientFirst, $clientLast] = session_log_split_name($row['clientName'] ?? '');
    }

    $providerName = trim((string)($row['provider_name'] ?? ''));
    [$staffFirst, $staffLast] = session_log_split_name($providerName);

    $startUtc = $row['start_utc'] ?? null;
    $dos = null;
    if ($startUtc) {
        $ts = strtotime((string)$startUtc);
        if ($ts !== false) {
            $dos = date('Y-m-d', $ts);
        }
    }

    $sessionId = (int)($row['session_id'] ?? 0);

    $money = static function ($v) {
        if ($v === null || $v === '') {
            return null;
        }
        return (float)$v;
    };

    return [
        'id' => $sessionId,
        'session_id' => $sessionId,
        'client_id' => $row['client_id'] ?? null,
        'client_first_name' => $clientFirst,
        'client_last_name' => $clientLast,
        'provider_id' => $row['provider_id'] ?? null,
        'provider_name' => $providerName,
        'staff_first_name' => $staffFirst,
        'staff_last_name' => $staffLast,
        'dos' => $dos,
        'start_utc' => $startUtc,
        'end_utc' => $row['end_utc'] ?? null,
        'scheduled_hours' => isset($row['scheduled_hours']) ? (float)$row['scheduled_hours'] : null,
        'rendered_hours' => isset($row['rendered_hours']) ? (float)$row['rendered_hours'] : null,
        'auth_code' => $row['auth_code'] ?? null,
        'location_address' => $row['location_address'] ?? null,
        'claim_id' => $row['claim_id'] ?? null,
        'claim_status' => $row['claim_status'] ?? null,
        'session_status' => $sessionStatus,
        'misc_hrs' => $misc,
        'log_status' => $logStatus,
        'coinsurance_amount' => $money($row['coinsurance_amount'] ?? null),
        'copay_amount' => $money($row['copay_amount'] ?? null),
        'deductible_amount' => $money($row['deductible_amount'] ?? null),
        'payer_paid_amount' => $money($row['payer_paid_amount'] ?? null),
        'check_number' => $row['check_number'] ?? null,
        'ap_invoice' => $row['ap_invoice'] ?? null,
        'ap_date' => !empty($row['ap_date']) ? substr((string)$row['ap_date'], 0, 10) : null,
        'tab' => session_log_tab_bucket($sessionStatus, $logStatus),
    ];
}

if (!session_log_table_exists($conn)) {
    session_log_ensure_table($conn);
} else {
    session_log_ensure_payment_columns($conn);
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method === 'GET') {
    $dosFrom = isset($_GET['dos_from']) ? trim((string)$_GET['dos_from']) : '';
    $dosTo = isset($_GET['dos_to']) ? trim((string)$_GET['dos_to']) : '';
    $tab = isset($_GET['tab']) ? trim((string)$_GET['tab']) : '';
    $cols = session_log_sessions_columns($conn);
    $statusCol = $cols['status_col'];
    $claimIdSql = $cols['claim_id'] ? 's.claim_id' : 'NULL AS claim_id';
    $claimStatusSql = $cols['claim_status'] ? 's.claim_status' : 'NULL AS claim_status';

    if ($dosFrom === '' && $dosTo === '') {
        $dosTo = date('Y-m-d');
        $dosFrom = date('Y-m-d', strtotime('-7 days'));
    }

    $where = ["UPPER(TRIM(IFNULL(s.`{$statusCol}`, ''))) <> 'CANCELLED'"];
    $types = '';
    $params = [];

    if ($dosFrom !== '' && $dosTo !== '') {
        $where[] = 'DATE(s.start_utc) BETWEEN ? AND ?';
        $types .= 'ss';
        $params[] = $dosFrom;
        $params[] = $dosTo;
    } elseif ($dosFrom !== '') {
        $where[] = 'DATE(s.start_utc) >= ?';
        $types .= 's';
        $params[] = $dosFrom;
    } elseif ($dosTo !== '') {
        $where[] = 'DATE(s.start_utc) <= ?';
        $types .= 's';
        $params[] = $dosTo;
    }

    $sql = "
        SELECT
            s.session_id,
            s.client_id,
            s.provider_id,
            s.provider_name,
            s.start_utc,
            s.end_utc,
            s.auth_code,
            s.location_address,
            s.scheduled_hours,
            s.rendered_hours,
            s.`{$statusCol}` AS STATUS,
            {$claimIdSql},
            {$claimStatusSql},
            c.first_name AS client_first_name,
            c.last_name AS client_last_name,
            CONCAT(IFNULL(c.first_name, ''), ' ', IFNULL(c.last_name, '')) AS clientName,
            sl.misc_hrs,
            sl.log_status,
            sl.coinsurance_amount,
            sl.copay_amount,
            sl.deductible_amount,
            sl.payer_paid_amount,
            sl.check_number,
            sl.ap_invoice,
            sl.ap_date
        FROM sessions s
        LEFT JOIN clients c ON s.client_id = c.client_id
        LEFT JOIN session_log sl ON sl.session_id = s.session_id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY s.start_utc ASC
    ";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        session_log_fail(500, 'Failed to prepare list query: ' . $conn->error);
    }
    if ($types !== '') {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $mapped = session_log_map_row($row);
        if ($tab !== '') {
            $tabLower = strtolower($tab);
            $tabKey = strtolower($mapped['tab']);
            if ($tabLower === 'pending' || $tabLower === 'pending payment') {
                if ($tabKey !== 'pending payment') {
                    continue;
                }
            } elseif ($tabLower === 'received' || $tabLower === 'received payment') {
                if ($tabKey !== 'received payment') {
                    continue;
                }
            } elseif ($tabLower === 'scheduled' || $tabLower === 'rendered') {
                if ($tabKey !== $tabLower) {
                    continue;
                }
            }
        }
        $rows[] = $mapped;
    }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $rows]);
    $conn->close();
    exit();
}

if ($method === 'PATCH' || $method === 'PUT') {
    session_log_ensure_payment_columns($conn);

    $rows = $input['rows'] ?? null;
    if (!is_array($rows) || count($rows) === 0) {
        session_log_fail(400, 'rows array is required');
    }

    $actor = '';
    if (is_array($authUser)) {
        $actor = (string)($authUser['email'] ?? $authUser['username'] ?? $authUser['id'] ?? '');
    }

    $statusCol = session_log_sessions_columns($conn)['status_col'];
    $sessCols = session_log_sessions_columns($conn);
    $claimIdSel = $sessCols['claim_id'] ? 's.claim_id' : 'NULL AS claim_id';
    $claimStatusSel = $sessCols['claim_status'] ? 's.claim_status' : 'NULL AS claim_status';
    $selectStmt = $conn->prepare(
        "SELECT s.session_id, s.`{$statusCol}` AS STATUS,
                s.rendered_hours, {$claimStatusSel}, {$claimIdSel},
                sl.misc_hrs, sl.log_status,
                sl.coinsurance_amount, sl.copay_amount, sl.deductible_amount,
                sl.payer_paid_amount, sl.check_number, sl.ap_invoice, sl.ap_date
         FROM sessions s
         LEFT JOIN session_log sl ON sl.session_id = s.session_id
         WHERE s.session_id = ?
         LIMIT 1"
    );
    $upsertStmt = $conn->prepare(
        "INSERT INTO session_log (
            session_id, misc_hrs, log_status,
            coinsurance_amount, copay_amount, deductible_amount, payer_paid_amount,
            check_number, ap_invoice, ap_date,
            created_by, updated_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           misc_hrs = VALUES(misc_hrs),
           log_status = VALUES(log_status),
           coinsurance_amount = VALUES(coinsurance_amount),
           copay_amount = VALUES(copay_amount),
           deductible_amount = VALUES(deductible_amount),
           payer_paid_amount = VALUES(payer_paid_amount),
           check_number = VALUES(check_number),
           ap_invoice = VALUES(ap_invoice),
           ap_date = VALUES(ap_date),
           updated_by = VALUES(updated_by)"
    );
    if (!$selectStmt || !$upsertStmt) {
        session_log_fail(500, 'Failed to prepare upsert');
    }

    $updated = 0;
    $out = [];

    foreach ($rows as $patch) {
        if (!is_array($patch)) {
            continue;
        }
        $sessionId = (int)($patch['session_id'] ?? $patch['id'] ?? 0);
        if ($sessionId <= 0) {
            continue;
        }

        $selectStmt->bind_param('i', $sessionId);
        $selectStmt->execute();
        $existing = $selectStmt->get_result()->fetch_assoc();
        if (!$existing) {
            continue;
        }

        $sessionStatus = session_log_session_status($existing);
        $currentLog = session_log_normalize_status($existing['log_status'] ?? null);
        $currentMisc = $existing['misc_hrs'];
        if ($currentMisc !== null && $currentMisc !== '') {
            $currentMisc = (float)$currentMisc;
        } else {
            $currentMisc = null;
        }

        $nextMisc = $currentMisc;
        if (array_key_exists('misc_hrs', $patch)) {
            $raw = $patch['misc_hrs'];
            if ($raw === null || $raw === '') {
                $nextMisc = null;
            } else {
                $nextMisc = round((float)$raw, 2);
            }
        }

        $nextCoins = session_log_money_or_null($existing['coinsurance_amount'] ?? null);
        $nextCopay = session_log_money_or_null($existing['copay_amount'] ?? null);
        $nextDed = session_log_money_or_null($existing['deductible_amount'] ?? null);
        $nextPaid = session_log_money_or_null($existing['payer_paid_amount'] ?? null);
        $nextCheck = session_log_str_or_null($existing['check_number'] ?? null);
        $nextApInv = session_log_str_or_null($existing['ap_invoice'] ?? null);
        $nextApDate = session_log_str_or_null(
            !empty($existing['ap_date']) ? substr((string)$existing['ap_date'], 0, 10) : null
        );

        if (array_key_exists('coinsurance_amount', $patch)) {
            $nextCoins = session_log_money_or_null($patch['coinsurance_amount']);
        }
        if (array_key_exists('copay_amount', $patch)) {
            $nextCopay = session_log_money_or_null($patch['copay_amount']);
        }
        if (array_key_exists('deductible_amount', $patch)) {
            $nextDed = session_log_money_or_null($patch['deductible_amount']);
        }
        if (array_key_exists('payer_paid_amount', $patch)) {
            $nextPaid = session_log_money_or_null($patch['payer_paid_amount']);
        }
        if (array_key_exists('check_number', $patch)) {
            $nextCheck = session_log_str_or_null($patch['check_number']);
        }
        if (array_key_exists('ap_invoice', $patch)) {
            $nextApInv = session_log_str_or_null($patch['ap_invoice']);
        }
        if (array_key_exists('ap_date', $patch)) {
            $nextApDate = session_log_str_or_null($patch['ap_date']);
        }

        $nextLog = $currentLog;
        if (array_key_exists('log_status', $patch)) {
            $rawStatus = $patch['log_status'];
            if ($rawStatus === null || trim((string)$rawStatus) === '' ||
                strtolower(trim((string)$rawStatus)) === 'clear') {
                $nextLog = null;
            } else {
                $requested = session_log_normalize_status($rawStatus);
                if ($requested === 'Pending Payment') {
                    if ($sessionStatus !== 'Rendered' && $currentLog !== 'Pending Payment' && $currentLog !== 'Received Payment') {
                        session_log_fail(400, "Session {$sessionId} must be Rendered before Pending Payment");
                    }
                    $nextLog = 'Pending Payment';
                } elseif ($requested === 'Received Payment') {
                    if ($currentLog !== 'Pending Payment' && $currentLog !== 'Received Payment') {
                        session_log_fail(400, "Session {$sessionId} must be Pending Payment before Received Payment");
                    }
                    if ($nextPaid === null || $nextCheck === null) {
                        session_log_fail(400, "Session {$sessionId}: payer paid amount and check # are required before Received Payment");
                    }
                    $nextLog = 'Received Payment';
                } else {
                    session_log_fail(400, "Invalid log_status for session {$sessionId}");
                }
            }
        }

        $miscStr = $nextMisc === null ? null : (string)$nextMisc;
        $logStr = $nextLog;
        $upsertStmt->bind_param(
            'isssssssssss',
            $sessionId,
            $miscStr,
            $logStr,
            $nextCoins,
            $nextCopay,
            $nextDed,
            $nextPaid,
            $nextCheck,
            $nextApInv,
            $nextApDate,
            $actor,
            $actor
        );
        if (!$upsertStmt->execute()) {
            session_log_fail(500, 'Failed to upsert session_log: ' . $upsertStmt->error);
        }
        $updated++;
        $out[] = [
            'session_id' => $sessionId,
            'misc_hrs' => $nextMisc,
            'log_status' => $nextLog,
            'coinsurance_amount' => $nextCoins !== null ? (float)$nextCoins : null,
            'copay_amount' => $nextCopay !== null ? (float)$nextCopay : null,
            'deductible_amount' => $nextDed !== null ? (float)$nextDed : null,
            'payer_paid_amount' => $nextPaid !== null ? (float)$nextPaid : null,
            'check_number' => $nextCheck,
            'ap_invoice' => $nextApInv,
            'ap_date' => $nextApDate,
            'tab' => session_log_tab_bucket($sessionStatus, $nextLog),
        ];
    }

    $selectStmt->close();
    $upsertStmt->close();

    echo json_encode([
        'success' => true,
        'updated' => $updated,
        'data' => $out,
    ]);
    $conn->close();
    exit();
}

session_log_fail(405, 'Method not allowed');

<?php
/**
 * Payer payment entries: candidates (sessions + auth billing codes), list, batch create.
 * RBAC: manage_data.read (GET), manage_data.write (POST).
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';

$authUser = requireAuthReadWrite('manage_data.read', 'manage_data.write', 'mahaverse');
$method = $_SERVER['REQUEST_METHOD'];

$host = "db5018419668.hosting-data.io";
$dbUser = "dbu1183438";
$dbPass = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$dbName = "dbs14649042";

$conn = new mysqli($host, $dbUser, $dbPass, $dbName);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}
$conn->set_charset('utf8mb4');

function json_fail($code, $msg)
{
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg]);
    exit();
}

function payer_payment_verify_insurance(mysqli $conn, $clientId, $insuranceId)
{
    $stmt = $conn->prepare('SELECT 1 FROM client_insurance WHERE client_id = ? AND insurance_id = ? LIMIT 1');
    if (!$stmt) {
        return false;
    }
    $iid = (int)$insuranceId;
    $stmt->bind_param('si', $clientId, $iid);
    $stmt->execute();
    $ok = $stmt->get_result()->num_rows > 0;
    $stmt->close();
    return $ok;
}

/** Split client_auth.billing_codes into trimmed tokens. */
function payer_payment_split_billing_codes($raw)
{
    if ($raw === null || $raw === '') {
        return [];
    }
    $parts = preg_split('/[\s,;|]+/', (string)$raw, -1, PREG_SPLIT_NO_EMPTY);
    $out = [];
    foreach ($parts as $p) {
        $t = trim($p);
        if ($t !== '') {
            $out[] = $t;
        }
    }
    return $out;
}

/**
 * client_auth PK/link columns differ by DB (auth_id only vs id + auth_id). Same idea as add-session.php.
 *
 * @return array{join_on: string, pk_column: string}
 */
function payer_payment_client_auth_schema(mysqli $conn): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $hasAuthId = false;
    $hasId = false;
    $r = @$conn->query('SHOW COLUMNS FROM `client_auth`');
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
        $cache = [
            'join_on' => '(ca.auth_id = s.auth_id OR ca.id = s.auth_id)',
            'pk_column' => 'id',
        ];
    } elseif ($hasId && !$hasAuthId) {
        $cache = [
            'join_on' => 'ca.id = s.auth_id',
            'pk_column' => 'id',
        ];
    } else {
        $cache = [
            'join_on' => 'ca.auth_id = s.auth_id',
            'pk_column' => 'auth_id',
        ];
    }
    return $cache;
}

function payer_payment_candidates(mysqli $conn, $clientId, $insuranceId, $dos)
{
    if (!payer_payment_verify_insurance($conn, $clientId, $insuranceId)) {
        json_fail(400, 'Insurance is not linked to this client');
    }
    $iid = (int)$insuranceId;
    $seen = [];
    $rows = [];

    $caSchema = payer_payment_client_auth_schema($conn);
    $joinOn = $caSchema['join_on'];
    $pkCol = $caSchema['pk_column'];

    $sql = "
        SELECT s.session_id, s.auth_id, s.auth_code, s.start_utc, s.end_utc, ca.billing_codes
        FROM sessions s
        INNER JOIN client_auth ca ON {$joinOn}
        WHERE s.client_id = ?
          AND ca.insurance_id = ?
          AND DATE(s.start_utc) = ?
        ORDER BY s.start_utc ASC
    ";
    $stmt = $conn->prepare($sql);
    if ($stmt) {
        $stmt->bind_param('sis', $clientId, $iid, $dos);
        $stmt->execute();
        $res = $stmt->get_result();
        while ($r = $res->fetch_assoc()) {
            $codesFromAuth = payer_payment_split_billing_codes($r['billing_codes'] ?? '');
            $authCode = trim((string)($r['auth_code'] ?? ''));
            $candidates = array_unique(array_filter(array_merge($codesFromAuth, $authCode !== '' ? [$authCode] : [])));
            foreach ($candidates as $code) {
                $k = strtolower($code);
                if (isset($seen[$k])) {
                    continue;
                }
                $seen[$k] = true;
                $rows[] = [
                    'service_code' => $code,
                    'source' => 'session',
                    'session_id' => (int)$r['session_id'],
                    'auth_code' => $r['auth_code'],
                    'start_utc' => $r['start_utc'],
                    'end_utc' => $r['end_utc'],
                ];
            }
        }
        $stmt->close();
    }

    if (count($rows) === 0) {
        $q = $conn->prepare('SELECT `' . $pkCol . '` AS client_auth_pk, billing_codes FROM client_auth WHERE insurance_id = ?');
        if ($q) {
            $q->bind_param('i', $iid);
            $q->execute();
            $r2 = $q->get_result();
            while ($a = $r2->fetch_assoc()) {
                foreach (payer_payment_split_billing_codes($a['billing_codes'] ?? '') as $code) {
                    $k = strtolower($code);
                    if (isset($seen[$k])) {
                        continue;
                    }
                    $seen[$k] = true;
                    $pk = isset($a['client_auth_pk']) ? (int)$a['client_auth_pk'] : null;
                    $rows[] = [
                        'service_code' => $code,
                        'source' => 'auth_fallback',
                        'client_auth_id' => $pk,
                    ];
                }
            }
            $q->close();
        }
    }

    return $rows;
}

function payer_payment_list_entries(
    mysqli $conn,
    $clientId = null,
    $insuranceId = null,
    $startDos = null,
    $endDos = null,
    $context = null,
    $reportIds = null
) {
    $scheduleTracker = ($context === 'schedule_tracker');
    $sql = 'SELECT id, report_id, client_id, insurance_id, dos, service_code,
        coinsurance_amount, copay_amount, deductible_amount, payer_paid_amount, check_number,
        ap_invoice, ap_date,
        bank_deposited_at,
        created_at, created_by
        FROM payer_payment_entries WHERE 1=1';
    $types = '';
    $params = [];

    if ($scheduleTracker) {
        $sql .= ' AND report_id IS NOT NULL';
    }

    if (is_array($reportIds) && count($reportIds) > 0) {
        $ids = [];
        foreach ($reportIds as $rid) {
            $n = (int)$rid;
            if ($n > 0) {
                $ids[] = $n;
            }
        }
        if (count($ids) > 0) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $sql .= ' AND report_id IN (' . $placeholders . ')';
            $types .= str_repeat('i', count($ids));
            foreach ($ids as $n) {
                $params[] = $n;
            }
        }
    }

    if ($clientId !== null && $clientId !== '') {
        $sql .= ' AND client_id = ?';
        $types .= 's';
        $params[] = $clientId;
    }
    if ($insuranceId !== null && $insuranceId !== '') {
        $sql .= ' AND insurance_id = ?';
        $types .= 'i';
        $params[] = (int)$insuranceId;
    }
    if ($startDos !== null && $startDos !== '') {
        $sql .= ' AND dos >= ?';
        $types .= 's';
        $params[] = $startDos;
    }
    if ($endDos !== null && $endDos !== '') {
        $sql .= ' AND dos <= ?';
        $types .= 's';
        $params[] = $endDos;
    }
    $sql .= ' ORDER BY dos DESC, id DESC';
    if (!$scheduleTracker && !(is_array($reportIds) && count($reportIds) > 0)) {
        $sql .= ' LIMIT 500';
    }

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return [];
    }
    if ($types !== '') {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $res = $stmt->get_result();
    $out = [];
    while ($row = $res->fetch_assoc()) {
        $out[] = $row;
    }
    $stmt->close();
    return $out;
}

/** @return array<string,mixed>|null */
function payer_payment_load_report_row(mysqli $conn, $reportId)
{
    $rid = (int)$reportId;
    if ($rid <= 0) {
        return null;
    }
    $st = $conn->prepare('SELECT id, client_id, dos, service_code_with_modifiers FROM reports WHERE id = ? AND archived = 0 LIMIT 1');
    if (!$st) {
        return null;
    }
    $st->bind_param('i', $rid);
    $st->execute();
    $r = $st->get_result()->fetch_assoc();
    $st->close();
    return $r ?: null;
}

function payer_payment_report_dos_string($dos)
{
    if ($dos === null || $dos === '') {
        return '';
    }
    $t = strtotime((string)$dos);
    if ($t !== false) {
        return date('Y-m-d', $t);
    }
    return trim((string)$dos);
}

function payer_payment_has_posted_amounts($paid, $check): bool
{
    $paidOk = $paid !== null && $paid !== '' && is_numeric($paid) && (float)$paid > 0;
    $checkOk = $check !== null && trim((string)$check) !== '';
    return $paidOk && $checkOk;
}


function payer_payment_report_entry_exists(mysqli $conn, int $reportId): bool
{
    if ($reportId <= 0) {
        return false;
    }
    $st = $conn->prepare('SELECT id FROM payer_payment_entries WHERE report_id = ? LIMIT 1');
    if (!$st) {
        return false;
    }
    $st->bind_param('i', $reportId);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close();
    return !empty($row);
}

function payer_payment_mark_report_posted(mysqli $conn, int $reportId): void
{
    if ($reportId <= 0) {
        return;
    }
    $st = $conn->prepare(
        "UPDATE reports SET tracker_status = 'Pending Payment'
         WHERE id = ? AND tracker_status IN ('Reviewed', 'Pending Payment', 'Payment Posted')"
    );
    if (!$st) {
        return;
    }
    $st->bind_param('i', $reportId);
    $st->execute();
    $st->close();
}

function payer_payment_mark_reports_cleared(mysqli $conn, array $reportIds): int
{
    $updated = 0;
    $now = date('Y-m-d H:i:s');
    $markEntry = $conn->prepare(
        'UPDATE payer_payment_entries SET bank_deposited_at = ? WHERE report_id = ?'
    );
    $markReport = $conn->prepare(
        "UPDATE reports SET tracker_status = 'Received Payment'
         WHERE id = ? AND tracker_status IN ('Pending Payment', 'Received Payment', 'Payment Posted', 'Payment Cleared')"
    );
    if (!$markEntry || !$markReport) {
        if ($markEntry) {
            $markEntry->close();
        }
        if ($markReport) {
            $markReport->close();
        }
        return 0;
    }
    foreach ($reportIds as $rid) {
        $reportId = (int)$rid;
        if ($reportId <= 0) {
            continue;
        }
        $markEntry->bind_param('si', $now, $reportId);
        $markEntry->execute();
        $markReport->bind_param('i', $reportId);
        $markReport->execute();
        $updated += $markReport->affected_rows;
    }
    $markEntry->close();
    $markReport->close();
    return $updated;
}

try {
    if ($method === 'GET') {
        $action = isset($_GET['action']) ? trim((string)$_GET['action']) : 'entries';
        if ($action === 'candidates') {
            $clientId = isset($_GET['client_id']) ? trim((string)$_GET['client_id']) : '';
            $insuranceId = isset($_GET['insurance_id']) ? trim((string)$_GET['insurance_id']) : '';
            $dos = isset($_GET['dos']) ? trim((string)$_GET['dos']) : '';
            if ($clientId === '' || $insuranceId === '' || $dos === '') {
                json_fail(400, 'client_id, insurance_id, and dos are required');
            }
            $data = payer_payment_candidates($conn, $clientId, $insuranceId, $dos);
            echo json_encode(['success' => true, 'data' => $data]);
            exit;
        }
        $clientId = isset($_GET['client_id']) ? trim((string)$_GET['client_id']) : null;
        $insuranceId = isset($_GET['insurance_id']) ? trim((string)$_GET['insurance_id']) : null;
        $startDos = isset($_GET['start_dos']) ? trim((string)$_GET['start_dos']) : null;
        $endDos = isset($_GET['end_dos']) ? trim((string)$_GET['end_dos']) : null;
        $context = isset($_GET['context']) ? trim((string)$_GET['context']) : null;
        $reportIds = null;
        if (!empty($_GET['report_ids'])) {
            $reportIds = array_filter(array_map('intval', explode(',', (string)$_GET['report_ids'])));
        }
        $data = payer_payment_list_entries($conn, $clientId, $insuranceId, $startDos, $endDos, $context, $reportIds);
        echo json_encode(['success' => true, 'data' => $data]);
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $entries = isset($input['entries']) && is_array($input['entries']) ? $input['entries'] : [];
        if (count($entries) === 0) {
            json_fail(400, 'entries array is required');
        }
        $saveOnly = !empty($input['save_only']);
        $createdBy = !empty($authUser['username']) ? (string)$authUser['username'] : null;

        $conn->begin_transaction();
        try {
            $legacyIns = $conn->prepare(
                'INSERT INTO payer_payment_entries (
                    client_id, insurance_id, dos, service_code,
                    coinsurance_amount, copay_amount, deductible_amount, payer_paid_amount, check_number, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $reportUpsert = $conn->prepare(
                'INSERT INTO payer_payment_entries (
                    report_id, client_id, insurance_id, dos, service_code,
                    coinsurance_amount, copay_amount, deductible_amount, payer_paid_amount, check_number, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    client_id = VALUES(client_id),
                    insurance_id = VALUES(insurance_id),
                    dos = VALUES(dos),
                    service_code = VALUES(service_code),
                    coinsurance_amount = VALUES(coinsurance_amount),
                    copay_amount = VALUES(copay_amount),
                    deductible_amount = VALUES(deductible_amount),
                    payer_paid_amount = VALUES(payer_paid_amount),
                    check_number = VALUES(check_number),
                    created_by = VALUES(created_by)'
            );
            if (!$legacyIns || !$reportUpsert) {
                throw new Exception($conn->error);
            }
            foreach ($entries as $row) {
                $clientId = isset($row['client_id']) ? trim((string)$row['client_id']) : '';
                $insuranceId = isset($row['insurance_id']) ? (int)$row['insurance_id'] : 0;
                $dos = isset($row['dos']) ? trim((string)$row['dos']) : '';
                $svc = isset($row['service_code']) ? trim((string)$row['service_code']) : '';
                $reportId = isset($row['report_id']) ? (int)$row['report_id'] : 0;
                $coins = isset($row['coinsurance_amount']) && $row['coinsurance_amount'] !== '' ? (string)$row['coinsurance_amount'] : null;
                $copay = isset($row['copay_amount']) && $row['copay_amount'] !== '' ? (string)$row['copay_amount'] : null;
                $ded = isset($row['deductible_amount']) && $row['deductible_amount'] !== '' ? (string)$row['deductible_amount'] : null;
                $paid = isset($row['payer_paid_amount']) && $row['payer_paid_amount'] !== '' ? (string)$row['payer_paid_amount'] : null;
                $check = isset($row['check_number']) ? trim((string)$row['check_number']) : '';
                if ($check === '') {
                    $check = null;
                }

                if ($reportId > 0) {
                    $rep = payer_payment_load_report_row($conn, $reportId);
                    if (!$rep) {
                        throw new Exception('Report row not found for report_id ' . $reportId);
                    }
                    $repClient = isset($rep['client_id']) ? trim((string)$rep['client_id']) : '';
                    if ($repClient !== '' && $repClient !== $clientId) {
                        throw new Exception('report_id ' . $reportId . ' does not belong to selected client');
                    }
                    $dos = payer_payment_report_dos_string($rep['dos'] ?? '');
                    $svc = trim((string)($rep['service_code_with_modifiers'] ?? ''));
                    if ($dos === '' || $svc === '') {
                        throw new Exception('Report row is missing DOS or service code');
                    }
                }

                if ($clientId === '' || $insuranceId <= 0 || $dos === '' || $svc === '') {
                    throw new Exception('Each entry requires client_id, insurance_id, dos, and service_code');
                }
                if (!payer_payment_verify_insurance($conn, $clientId, $insuranceId)) {
                    throw new Exception('Insurance is not linked to client: ' . $clientId);
                }

                if ($reportId > 0) {
                    $reportUpsert->bind_param(
                        'isissssssss',
                        $reportId,
                        $clientId,
                        $insuranceId,
                        $dos,
                        $svc,
                        $coins,
                        $copay,
                        $ded,
                        $paid,
                        $check,
                        $createdBy
                    );
                    if (!$reportUpsert->execute()) {
                        throw new Exception($reportUpsert->error);
                    }
                    if (!payer_payment_report_entry_exists($conn, $reportId)) {
                        throw new Exception(
                            'Payment line conflict detected for report #' . $reportId
                            . '. This database still has the legacy unique key on '
                            . '(client_id, insurance_id, dos, service_code). '
                            . 'Run migration to drop uq_payer_payment_line, then retry.'
                        );
                    }
                    if (!$saveOnly && payer_payment_has_posted_amounts($paid, $check)) {
                        payer_payment_mark_report_posted($conn, $reportId);
                    }
                } else {
                    $legacyIns->bind_param(
                        'sissssssss',
                        $clientId,
                        $insuranceId,
                        $dos,
                        $svc,
                        $coins,
                        $copay,
                        $ded,
                        $paid,
                        $check,
                        $createdBy
                    );
                    if (!$legacyIns->execute()) {
                        if ($conn->errno === 1062) {
                            throw new Exception('Duplicate payment line for same client, payer, DOS, and service code');
                        }
                        throw new Exception($legacyIns->error);
                    }
                }
            }
            $legacyIns->close();
            $reportUpsert->close();
            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Payment entries saved', 'count' => count($entries)]);
        } catch (Exception $e) {
            $conn->rollback();
            if (isset($legacyIns) && $legacyIns) {
                $legacyIns->close();
            }
            if (isset($reportUpsert) && $reportUpsert) {
                $reportUpsert->close();
            }
            json_fail(500, $e->getMessage());
        }
        exit;
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $action = isset($input['action']) ? trim((string)$input['action']) : '';
        if ($action === 'save_ap') {
            $entries = isset($input['entries']) && is_array($input['entries']) ? $input['entries'] : [];
            if (count($entries) === 0) {
                json_fail(400, 'entries array is required');
            }
            $conn->begin_transaction();
            try {
                $upd = $conn->prepare(
                    'UPDATE payer_payment_entries SET ap_invoice = ?, ap_date = ? WHERE report_id = ?'
                );
                if (!$upd) {
                    throw new Exception($conn->error);
                }
                $saved = 0;
                foreach ($entries as $row) {
                    $reportId = isset($row['report_id']) ? (int)$row['report_id'] : 0;
                    if ($reportId <= 0) {
                        continue;
                    }
                    $apInvoice = isset($row['ap_invoice']) ? trim((string)$row['ap_invoice']) : '';
                    if ($apInvoice === '') {
                        $apInvoice = null;
                    }
                    $apDateRaw = isset($row['ap_date']) ? trim((string)$row['ap_date']) : '';
                    $apDate = $apDateRaw !== '' ? $apDateRaw : null;
                    $upd->bind_param('ssi', $apInvoice, $apDate, $reportId);
                    if (!$upd->execute()) {
                        throw new Exception($upd->error);
                    }
                    if ($upd->affected_rows > 0) {
                        $saved += 1;
                    }
                }
                $upd->close();
                $conn->commit();
                echo json_encode([
                    'success' => true,
                    'message' => 'AP values saved',
                    'updated' => $saved,
                ]);
            } catch (Exception $e) {
                $conn->rollback();
                if (isset($upd) && $upd) {
                    $upd->close();
                }
                json_fail(500, $e->getMessage());
            }
            exit;
        }
        if ($action !== 'mark_cleared') {
            json_fail(400, 'Unsupported action');
        }
        $reportIds = isset($input['report_ids']) && is_array($input['report_ids'])
            ? $input['report_ids']
            : [];
        if (count($reportIds) === 0) {
            json_fail(400, 'report_ids array is required');
        }
        $conn->begin_transaction();
        try {
            $updated = payer_payment_mark_reports_cleared($conn, $reportIds);
            $conn->commit();
            echo json_encode([
                'success' => true,
                'message' => 'Payment marked cleared',
                'updated' => $updated,
            ]);
        } catch (Exception $e) {
            $conn->rollback();
            json_fail(500, $e->getMessage());
        }
        exit;
    }

    json_fail(405, 'Method not allowed');
} catch (Exception $e) {
    json_fail(500, $e->getMessage());
} finally {
    $conn->close();
}

<?php
/**
 * Temporary deploy probe — upload to mahaverse-backend-test, then GET this file.
 * Optional: ?session_id=63 to resolve billable for a real session row.
 * Delete after debugging.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$sched = __DIR__ . '/scheduling_session_lib.php';
$rate = __DIR__ . '/session_rate_lib.php';
$config = __DIR__ . '/config.php';

$out = [
    'ok' => true,
    'dir' => __DIR__,
    'sched_mtime' => is_file($sched) ? date('c', filemtime($sched)) : null,
    'rate_mtime' => is_file($rate) ? date('c', filemtime($rate)) : null,
    'sched_size' => is_file($sched) ? filesize($sched) : null,
    'rate_size' => is_file($rate) ? filesize($rate) : null,
    'sched_has_Not_Applicable' => false,
    'rate_has_consensus_fallthrough' => false,
];

$schedSrc = is_file($sched) ? (string) file_get_contents($sched) : '';
$rateSrc = is_file($rate) ? (string) file_get_contents($rate) : '';
$out['sched_has_Not_Applicable'] = strpos($schedSrc, 'Not Applicable') !== false;
$out['rate_has_consensus_fallthrough'] = strpos($rateSrc, 'Payer resolved but no mapping') !== false
    || strpos($rateSrc, 'code-wide consensus') !== false;

try {
    require_once $sched;
    require_once $rate;
    $out['fn_ensure'] = function_exists('ensure_session_claim_ready');
    $out['fn_resolve'] = function_exists('session_resolve_billable');
    $out['fn_consensus'] = function_exists('session_resolve_billable_by_code_consensus');
} catch (Throwable $e) {
    $out['require_error'] = $e->getMessage();
    echo json_encode($out, JSON_PRETTY_PRINT);
    exit;
}

$sessionId = isset($_GET['session_id']) ? (int) $_GET['session_id'] : 0;
if ($sessionId > 0 && is_file($config)) {
    try {
        require_once $config;
        $conn = function_exists('getDBConnection') ? getDBConnection() : null;
        if ($conn) {
            $stmt = $conn->prepare('SELECT session_id, auth_id, client_id, provider_id, service_code, auth_code, claim_id, claim_status FROM sessions WHERE session_id = ? LIMIT 1');
            $stmt->bind_param('i', $sessionId);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            $out['session'] = $row;
            if ($row && function_exists('session_resolve_billable')) {
                $out['resolved_billable'] = session_resolve_billable($conn, $row);
            }
            if ($row && function_exists('session_rate_fetch_insurance_provider_for_auth')) {
                $out['insurance_provider_id'] = session_rate_fetch_insurance_provider_for_auth(
                    $conn,
                    (int) ($row['auth_id'] ?? 0),
                    (string) ($row['client_id'] ?? '')
                );
            }
            if (function_exists('session_resolve_billable_by_code_consensus')) {
                $proc = '';
                $ac = (string) ($row['auth_code'] ?? '');
                $sc = (string) ($row['service_code'] ?? '');
                if (preg_match('/(\d{4,5})/', strtoupper($sc), $m) || preg_match('/(\d{4,5})/', strtoupper($ac), $m)) {
                    $proc = $m[1];
                }
                $out['consensus_proc'] = $proc;
                if ($proc !== '') {
                    $out['consensus_billable'] = session_resolve_billable_by_code_consensus($conn, [$proc]);
                }
            }
        } else {
            $out['db'] = 'no getDBConnection';
        }
    } catch (Throwable $e) {
        $out['session_probe_error'] = $e->getMessage();
    }
}

echo json_encode($out, JSON_PRETTY_PRINT);

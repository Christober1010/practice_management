<?php
/**
 * Data Collection report — skill trials + behavior session data by client/date.
 *
 * GET ?client_id=&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&type=all|trials|behaviors
 * RBAC: view.reports_data_collection (preferred) or reports.read / view.reports
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';

$authUser = requireAuthAny(
    ['view.reports_data_collection', 'reports.read', 'view.reports'],
    'mahaverse'
);

try {
    $conn = getDBConnection();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}

function dc_table_exists(mysqli $conn, string $table): bool
{
    $safe = $conn->real_escape_string($table);
    $res = $conn->query("SHOW TABLES LIKE '{$safe}'");
    $ok = $res && $res->num_rows > 0;
    if ($res) {
        $res->free();
    }
    return $ok;
}

$clientId = trim((string)($_GET['client_id'] ?? ''));
$dateFrom = trim((string)($_GET['date_from'] ?? ''));
$dateTo = trim((string)($_GET['date_to'] ?? ''));
$type = strtolower(trim((string)($_GET['type'] ?? 'all')));
if (!in_array($type, ['all', 'trials', 'behaviors'], true)) {
    $type = 'all';
}

if ($dateFrom === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
    $dateFrom = date('Y-m-d', strtotime('-30 days'));
}
if ($dateTo === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    $dateTo = date('Y-m-d');
}

$rows = [];

if (($type === 'all' || $type === 'trials') && dc_table_exists($conn, 'client_session_notes')) {
    $sql = "
        SELECT
            n.id,
            n.client_id,
            n.target_id,
            n.session_date,
            n.trial_number,
            n.trial_outcome,
            n.notes,
            n.created_at,
            TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))) AS client_name,
            COALESCE(t.name, mt.name, n.target_id) AS target_name
        FROM client_session_notes n
        LEFT JOIN clients c ON c.client_id COLLATE utf8mb4_unicode_ci = n.client_id COLLATE utf8mb4_unicode_ci
        LEFT JOIN client_targets t
          ON t.id COLLATE utf8mb4_unicode_ci = n.target_id COLLATE utf8mb4_unicode_ci
         AND t.client_id COLLATE utf8mb4_unicode_ci = n.client_id COLLATE utf8mb4_unicode_ci
        LEFT JOIN master_targets mt ON mt.id COLLATE utf8mb4_unicode_ci = n.target_id COLLATE utf8mb4_unicode_ci
        WHERE n.session_date BETWEEN ? AND ?
    ";
    $types = 'ss';
    $params = [$dateFrom, $dateTo];
    if ($clientId !== '') {
        $sql .= ' AND n.client_id = ?';
        $types .= 's';
        $params[] = $clientId;
    }
    $sql .= ' ORDER BY n.session_date DESC, client_name ASC, n.trial_number ASC LIMIT 3000';

    $stmt = $conn->prepare($sql);
    if ($stmt) {
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $rows[] = [
                'id' => $row['id'],
                'data_type' => 'trial',
                'client_id' => $row['client_id'],
                'client_name' => trim((string)($row['client_name'] ?? '')) ?: 'Unknown Client',
                'session_date' => $row['session_date'],
                'target_id' => $row['target_id'],
                'target_name' => $row['target_name'],
                'trial_number' => (int)$row['trial_number'],
                'outcome' => $row['trial_outcome'],
                'notes' => $row['notes'],
                'created_at' => $row['created_at'],
            ];
        }
        $stmt->close();
    }
}

if (($type === 'all' || $type === 'behaviors') && dc_table_exists($conn, 'client_session_behavior_data')) {
    $sql = "
        SELECT
            b.id,
            b.client_id,
            b.session_id,
            b.session_date,
            b.behavior_id,
            b.recording_type,
            b.value_json,
            b.created_at,
            TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))) AS client_name,
            COALESCE(cb.name, mb.name, b.behavior_id) AS behavior_name
        FROM client_session_behavior_data b
        LEFT JOIN clients c ON c.client_id COLLATE utf8mb4_unicode_ci = b.client_id COLLATE utf8mb4_unicode_ci
        LEFT JOIN client_behaviors cb
          ON cb.id COLLATE utf8mb4_unicode_ci = b.behavior_id COLLATE utf8mb4_unicode_ci
         AND cb.client_id COLLATE utf8mb4_unicode_ci = b.client_id COLLATE utf8mb4_unicode_ci
        LEFT JOIN master_behaviors mb ON mb.id COLLATE utf8mb4_unicode_ci = b.behavior_id COLLATE utf8mb4_unicode_ci
        WHERE b.session_date BETWEEN ? AND ?
    ";
    $types = 'ss';
    $params = [$dateFrom, $dateTo];
    if ($clientId !== '') {
        $sql .= ' AND b.client_id = ?';
        $types .= 's';
        $params[] = $clientId;
    }
    $sql .= ' ORDER BY b.session_date DESC, client_name ASC LIMIT 3000';

    $stmt = $conn->prepare($sql);
    if ($stmt) {
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $valuePreview = $row['value_json'];
            if (is_string($valuePreview) && strlen($valuePreview) > 120) {
                $valuePreview = substr($valuePreview, 0, 117) . '...';
            }
            $rows[] = [
                'id' => $row['id'],
                'data_type' => 'behavior',
                'client_id' => $row['client_id'],
                'client_name' => trim((string)($row['client_name'] ?? '')) ?: 'Unknown Client',
                'session_date' => $row['session_date'],
                'session_id' => $row['session_id'],
                'behavior_id' => $row['behavior_id'],
                'behavior_name' => $row['behavior_name'],
                'recording_type' => $row['recording_type'],
                'value_preview' => $valuePreview,
                'created_at' => $row['created_at'],
            ];
        }
        $stmt->close();
    }
}

usort($rows, function ($a, $b) {
    $d = strcmp((string)($b['session_date'] ?? ''), (string)($a['session_date'] ?? ''));
    if ($d !== 0) {
        return $d;
    }
    return strcmp((string)($a['client_name'] ?? ''), (string)($b['client_name'] ?? ''));
});

$trialCount = count(array_filter($rows, fn($r) => ($r['data_type'] ?? '') === 'trial'));
$behaviorCount = count(array_filter($rows, fn($r) => ($r['data_type'] ?? '') === 'behavior'));

echo json_encode([
    'success' => true,
    'rows' => $rows,
    'summary' => [
        'total' => count($rows),
        'trials' => $trialCount,
        'behaviors' => $behaviorCount,
        'date_from' => $dateFrom,
        'date_to' => $dateTo,
    ],
]);

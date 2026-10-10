<?php
/**
 * Session Notes report — list note entries by client and appointment date.
 *
 * Columns align with Session Log: DOS, Client, Staff, Billing Code, Session ID.
 * exclude_session=Yes rows are visible to Admin role only.
 *
 * GET ?client_id=&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&search=&tz=
 * RBAC: view.reports_session_notes (preferred) or reports.read / view.reports
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
require_once __DIR__ . '/scheduling_session_lib.php';

$authUser = requireAuthAny(
    ['view.reports_session_notes', 'reports.read', 'view.reports'],
    'mahaverse'
);

try {
    $conn = getDBConnection();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}

$clientId = trim((string)($_GET['client_id'] ?? ''));
$dateFrom = trim((string)($_GET['date_from'] ?? ''));
$dateTo = trim((string)($_GET['date_to'] ?? ''));
$search = trim((string)($_GET['search'] ?? ''));
$tz = trim((string)($_GET['tz'] ?? ''));
if ($tz === '' || !preg_match('/^[A-Za-z0-9_+\-\/]+$/', $tz)) {
    $tz = 'UTC';
}
try {
    new DateTimeZone($tz);
} catch (Exception $e) {
    $tz = 'UTC';
}

if ($dateFrom === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
    $dateFrom = date('Y-m-d', strtotime('-30 days'));
}
if ($dateTo === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    $dateTo = date('Y-m-d');
}

$tables = $conn->query("SHOW TABLES LIKE 'client_session_note_entries'");
if (!$tables || $tables->num_rows === 0) {
    echo json_encode(['success' => true, 'rows' => [], 'summary' => ['total' => 0]]);
    exit();
}

$isAdmin = strtolower((string)($authUser['role'] ?? '')) === 'admin';
$excludeSelect = sessions_has_exclude_session_column($conn)
    ? 's.exclude_session'
    : "'No' AS exclude_session";

/**
 * Match calendar / session-log "Rendered" bucketing.
 */
function reports_session_notes_is_rendered(array $row): bool
{
    $st = strtolower(trim((string)($row['session_status'] ?? '')));
    if ($st === 'rendered' || $st === 'completed') {
        return true;
    }
    if (floatval($row['rendered_hours'] ?? 0) > 0) {
        return true;
    }
    $cs = strtolower(trim((string)($row['claim_status'] ?? '')));
    if (strpos($cs, 'ready to bill') !== false) {
        return true;
    }
    if (trim((string)($row['claim_id'] ?? '')) !== '') {
        return true;
    }
    return false;
}

/** Local calendar DOS from UTC start — same approach as Session Log. */
function reports_session_notes_local_ymd_from_utc(?string $startUtc, string $tz): ?string
{
    if ($startUtc === null || trim($startUtc) === '') {
        return null;
    }
    try {
        $dt = new DateTimeImmutable(trim($startUtc), new DateTimeZone('UTC'));
        return $dt->setTimezone(new DateTimeZone($tz))->format('Y-m-d');
    } catch (Exception $e) {
        $ts = strtotime(trim($startUtc));
        return $ts !== false ? date('Y-m-d', $ts) : null;
    }
}

$sql = "
    SELECT
        e.id,
        e.client_id,
        e.session_date,
        e.session_id,
        e.payload,
        e.created_at,
        e.updated_at,
        TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))) AS client_name,
        s.start_utc AS appointment_start,
        s.end_utc AS appointment_end,
        s.status AS session_status,
        s.rendered_hours,
        s.scheduled_hours,
        s.claim_status,
        s.claim_id,
        s.provider_name,
        s.auth_code,
        {$excludeSelect}
    FROM client_session_note_entries e
    LEFT JOIN clients c ON c.client_id COLLATE utf8mb4_unicode_ci = e.client_id COLLATE utf8mb4_unicode_ci
    LEFT JOIN sessions s ON CAST(s.session_id AS CHAR) = CAST(e.session_id AS CHAR)
    WHERE e.session_date BETWEEN ? AND ?
";
$types = 'ss';
$params = [$dateFrom, $dateTo];

if ($clientId !== '') {
    $sql .= ' AND e.client_id = ?';
    $types .= 's';
    $params[] = $clientId;
}

if ($search !== '') {
    $sql .= " AND (
        TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))) LIKE ?
        OR e.session_id LIKE ?
        OR e.payload LIKE ?
        OR s.provider_name LIKE ?
        OR s.auth_code LIKE ?
    )";
    $like = '%' . $search . '%';
    $types .= 'sssss';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$sql .= ' ORDER BY e.session_date DESC, client_name ASC, e.updated_at DESC LIMIT 2000';

$stmt = $conn->prepare($sql);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $conn->error]);
    exit();
}
$stmt->bind_param($types, ...$params);
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
$scheduledCount = 0;
$renderedCount = 0;
while ($row = $result->fetch_assoc()) {
    $excludeSession = normalize_session_exclude_session($row['exclude_session'] ?? 'No');
    // Exclude Session = Yes is Admin-only.
    if (!$isAdmin && $excludeSession === 'Yes') {
        continue;
    }

    $payload = [];
    if (!empty($row['payload'])) {
        $decoded = json_decode($row['payload'], true);
        if (is_array($decoded)) {
            $payload = $decoded;
        }
    }
    $sessionNotes = $payload['session_notes'] ?? $payload;
    if (!is_array($sessionNotes)) {
        $sessionNotes = [];
    }
    $summaryBits = [];
    foreach (['subjective', 'objective', 'assessment', 'plan', 'clinical_notes', 'overview', 'soapNotes'] as $key) {
        $val = $sessionNotes[$key] ?? null;
        if (is_string($val) && trim($val) !== '') {
            $summaryBits[] = strtoupper(substr($key, 0, 1)) . ': ' . substr(trim($val), 0, 80);
        }
    }
    $isRendered = reports_session_notes_is_rendered($row);
    if ($isRendered) {
        $renderedCount++;
    } else {
        $scheduledCount++;
    }
    $startUtc = $row['appointment_start'] ?? null;
    $dos = reports_session_notes_local_ymd_from_utc(
        $startUtc !== null ? (string)$startUtc : null,
        $tz
    );
    if ($dos === null || $dos === '') {
        $dos = $row['session_date'] ?? null;
    }
    $rows[] = [
        'id' => $row['id'],
        'client_id' => $row['client_id'],
        'client_name' => trim((string)($row['client_name'] ?? '')) ?: 'Unknown Client',
        'dos' => $dos,
        'appointment_date' => $dos ?: $row['session_date'],
        'session_id' => $row['session_id'],
        'appointment_start' => $startUtc,
        'start_utc' => $startUtc,
        'appointment_end' => $row['appointment_end'],
        'session_status' => $row['session_status'],
        'rendered_hours' => $row['rendered_hours'] !== null ? (float)$row['rendered_hours'] : 0,
        'scheduled_hours' => $row['scheduled_hours'] !== null ? (float)$row['scheduled_hours'] : null,
        'claim_status' => $row['claim_status'],
        'claim_id' => $row['claim_id'],
        'provider_name' => $row['provider_name'],
        'staff' => trim((string)($row['provider_name'] ?? '')),
        'auth_code' => $row['auth_code'] ?? null,
        'billing_code' => $row['auth_code'] ?? null,
        'exclude_session' => $excludeSession,
        'tab' => $isRendered ? 'Rendered' : 'Scheduled',
        'note_preview' => implode(' · ', array_slice($summaryBits, 0, 2)),
        'has_notes' => !empty($summaryBits) || !empty($payload),
        'updated_at' => $row['updated_at'],
        'created_at' => $row['created_at'],
    ];
}
$stmt->close();

echo json_encode([
    'success' => true,
    'rows' => $rows,
    'summary' => [
        'total' => count($rows),
        'scheduled' => $scheduledCount,
        'rendered' => $renderedCount,
        'date_from' => $dateFrom,
        'date_to' => $dateTo,
    ],
]);

<?php
/**
 * Dashboard stats — org-wide for admin / clients.view=all; otherwise scoped to the
 * logged-in user's assigned clients and visible staff (self + reports).
 *
 * Auth: view.dashboard | nav.dashboard | reports.read
 */
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';

$authUser = requireAuthAny(['view.dashboard', 'nav.dashboard', 'reports.read'], 'mahaverse');

$host = "db5018266079.hosting-data.io";
$user = "dbu3321929";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14484433";

function dash_fail(int $code, string $msg): void
{
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg]);
    exit();
}

function dash_time_ago($datetime): string
{
    if (!$datetime) {
        return 'recently';
    }
    $timestamp = strtotime((string)$datetime);
    if (!$timestamp) {
        return 'recently';
    }
    $diff = time() - $timestamp;
    if ($diff < 60) {
        return 'just now';
    }
    if ($diff < 3600) {
        $m = (int)floor($diff / 60);
        return $m . ' minute' . ($m > 1 ? 's' : '') . ' ago';
    }
    if ($diff < 86400) {
        $h = (int)floor($diff / 3600);
        return $h . ' hour' . ($h > 1 ? 's' : '') . ' ago';
    }
    if ($diff < 604800) {
        $d = (int)floor($diff / 86400);
        return $d . ' day' . ($d > 1 ? 's' : '') . ' ago';
    }
    return date('M j, Y', $timestamp);
}

function dash_sessions_status_col(mysqli $conn): string
{
    static $col = null;
    if ($col !== null) {
        return $col;
    }
    $col = 'STATUS';
    $r = @$conn->query('SHOW COLUMNS FROM `sessions`');
    if ($r) {
        $names = [];
        while ($row = $r->fetch_assoc()) {
            $names[$row['Field'] ?? ''] = true;
        }
        $r->free();
        if (!isset($names['STATUS']) && isset($names['status'])) {
            $col = 'status';
        }
    }
    return $col;
}

function dash_has_column(mysqli $conn, string $table, string $column): bool
{
    $t = $conn->real_escape_string($table);
    $c = $conn->real_escape_string($column);
    $r = @$conn->query("SHOW COLUMNS FROM `{$t}` LIKE '{$c}'");
    $ok = $r && $r->num_rows > 0;
    if ($r) {
        $r->free();
    }
    return $ok;
}

function dash_to_clinic(DateTimeInterface|string|null $utc): ?DateTimeImmutable
{
    if ($utc === null || $utc === '') {
        return null;
    }
    try {
        if ($utc instanceof DateTimeInterface) {
            $dt = DateTimeImmutable::createFromInterface($utc)->setTimezone(new DateTimeZone('UTC'));
        } else {
            $dt = new DateTimeImmutable((string)$utc, new DateTimeZone('UTC'));
        }
        return $dt->setTimezone(new DateTimeZone('America/Chicago'));
    } catch (Exception $e) {
        return null;
    }
}

function dash_format_time_range($startUtc, $endUtc): string
{
    $s = dash_to_clinic($startUtc);
    if (!$s) {
        return '—';
    }
    $label = $s->format('g:i A');
    $e = dash_to_clinic($endUtc);
    if ($e) {
        $label .= ' – ' . $e->format('g:i A');
    }
    return $label;
}

function dash_session_bucket(string $status, $startUtc, $endUtc): string
{
    $st = strtolower(trim($status));
    if ($st === 'rendered' || $st === 'completed') {
        return 'completed';
    }
    if ($st === 'cancelled') {
        return 'cancelled';
    }
    $now = new DateTimeImmutable('now', new DateTimeZone('America/Chicago'));
    $s = dash_to_clinic($startUtc);
    $e = dash_to_clinic($endUtc);
    if ($s && $e && $now >= $s && $now <= $e) {
        return 'in-progress';
    }
    if ($s && $now < $s) {
        return 'upcoming';
    }
    if ($s && $e && $now > $e) {
        return 'scheduled';
    }
    return 'scheduled';
}

function dash_status_label(string $bucket, string $rawStatus): string
{
    if ($bucket === 'completed') {
        return 'Rendered';
    }
    if ($bucket === 'in-progress') {
        return 'In Progress';
    }
    if ($bucket === 'upcoming') {
        return 'Upcoming';
    }
    $raw = trim($rawStatus);
    return $raw !== '' ? $raw : 'Scheduled';
}

function dash_status_color(string $bucket): string
{
    if ($bucket === 'completed') {
        return 'bg-green-100 text-green-800';
    }
    if ($bucket === 'in-progress') {
        return 'bg-blue-100 text-blue-800';
    }
    if ($bucket === 'upcoming') {
        return 'bg-slate-100 text-slate-800';
    }
    return 'bg-amber-100 text-amber-800';
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    dash_fail(405, 'Method not allowed');
}

try {
    $conn = new mysqli($host, $user, $password, $database);
    if ($conn->connect_error) {
        throw new Exception('Connection failed: ' . $conn->connect_error);
    }
    $conn->set_charset('utf8mb4');

    $role = strtolower(trim((string)($authUser['role'] ?? '')));
    $rosterScope = function_exists('rbac_client_roster_access_scope')
        ? rbac_client_roster_access_scope($authUser, $conn)
        : ($role === 'admin' ? 'all' : 'self');
    $isOrgWide = ($role === 'admin' || $rosterScope === 'all');

    $staffId = function_exists('rbac_resolve_staff_id_for_user')
        ? rbac_resolve_staff_id_for_user($conn, $authUser)
        : null;
    $assignedClientIds = function_exists('rbac_assigned_client_ids_for_user')
        ? rbac_assigned_client_ids_for_user($conn, $authUser)
        : [];
    $visibleStaffIds = function_exists('rbac_visible_staff_ids_for_user')
        ? rbac_visible_staff_ids_for_user($conn, $authUser)
        : ($staffId ? [(string)$staffId] : []);

    $today = (new DateTimeImmutable('now', new DateTimeZone('America/Chicago')))->format('Y-m-d');
    $weekStart = (new DateTimeImmutable('monday this week', new DateTimeZone('America/Chicago')))->format('Y-m-d');
    $weekEnd = (new DateTimeImmutable('sunday this week', new DateTimeZone('America/Chicago')))->format('Y-m-d');
    $monthStart = (new DateTimeImmutable('first day of this month', new DateTimeZone('America/Chicago')))->format('Y-m-d');
    $monthEnd = (new DateTimeImmutable('last day of this month', new DateTimeZone('America/Chicago')))->format('Y-m-d');
    $statusCol = dash_sessions_status_col($conn);
    $hasSupervising = dash_has_column($conn, 'sessions', 'supervising_provider_id');
    $hasLocation = dash_has_column($conn, 'sessions', 'location_address');
    $hasExclude = dash_has_column($conn, 'sessions', 'exclude_session');
    $hasRenderedHrs = dash_has_column($conn, 'sessions', 'rendered_hours');
    $hasScheduledHrs = dash_has_column($conn, 'sessions', 'scheduled_hours');
    $hasPlace = dash_has_column($conn, 'sessions', 'place_of_service');

    // ---- Active clients (is_active = Active only; exclude archived / inactive) ----
    $hasClientIsActive = dash_has_column($conn, 'clients', 'is_active');
    $activeClientWhere = 'archived = 0'
        . ($hasClientIsActive ? ' AND is_active = 1' : '');
    if ($isOrgWide) {
        $r = $conn->query("SELECT COUNT(*) AS count FROM clients WHERE {$activeClientWhere}");
        $activeClients = $r ? (int)$r->fetch_assoc()['count'] : 0;
        if ($r) {
            $r->free();
        }
    } else {
        $activeClients = 0;
        if (!empty($assignedClientIds)) {
            $placeholders = implode(',', array_fill(0, count($assignedClientIds), '?'));
            $types = str_repeat('s', count($assignedClientIds));
            $sql = "SELECT COUNT(*) AS count FROM clients WHERE {$activeClientWhere} AND client_id IN ({$placeholders})";
            $stmt = $conn->prepare($sql);
            if ($stmt) {
                $stmt->bind_param($types, ...$assignedClientIds);
                $stmt->execute();
                $res = $stmt->get_result();
                $activeClients = $res ? (int)$res->fetch_assoc()['count'] : 0;
                $stmt->close();
            }
        }
    }

    // ---- Active staff (status = Active only; org-wide only; self users get 0 / omit) ----
    $activeStaff = 0;
    if ($isOrgWide) {
        $hasStaffStatus = dash_has_column($conn, 'staff', 'status');
        $activeStaffWhere = 'archived = 0'
            . ($hasStaffStatus ? " AND status = 'Active'" : '');
        $r = $conn->query("SELECT COUNT(*) AS count FROM staff WHERE {$activeStaffWhere}");
        $activeStaff = $r ? (int)$r->fetch_assoc()['count'] : 0;
        if ($r) {
            $r->free();
        }
    }

    // ---- Load candidate sessions (today / week / month windows) then filter ----
    $locSql = $hasLocation ? 's.location_address' : 'NULL AS location_address';
    $posSql = $hasPlace ? 's.place_of_service' : 'NULL AS place_of_service';
    $supSql = $hasSupervising ? 's.supervising_provider_id' : 'NULL AS supervising_provider_id';
    $renSql = $hasRenderedHrs ? 's.rendered_hours' : 'NULL AS rendered_hours';
    $schSql = $hasScheduledHrs ? 's.scheduled_hours' : 'NULL AS scheduled_hours';
    $exclSql = $hasExclude ? 's.exclude_session' : "'No' AS exclude_session";

    $sql = "
      SELECT
        s.session_id,
        s.client_id,
        s.provider_id,
        s.provider_name,
        {$supSql},
        s.start_utc,
        s.end_utc,
        s.{$statusCol} AS session_status,
        {$locSql},
        {$posSql},
        {$renSql},
        {$schSql},
        {$exclSql},
        c.first_name AS client_first_name,
        c.last_name AS client_last_name
      FROM sessions s
      LEFT JOIN clients c ON s.client_id = c.client_id
      WHERE DATE(s.start_utc) BETWEEN ? AND ?
        AND UPPER(TRIM(IFNULL(s.{$statusCol}, ''))) <> 'CANCELLED'
      ORDER BY s.start_utc ASC
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Failed to prepare sessions query');
    }
    // Cover from week start through month end (enough for cards)
    $rangeFrom = min($weekStart, $monthStart, $today);
    $rangeTo = max($weekEnd, $monthEnd, $today);
    $stmt->bind_param('ss', $rangeFrom, $rangeTo);
    $stmt->execute();
    $res = $stmt->get_result();
    $allSessions = [];
    while ($row = $res->fetch_assoc()) {
        $allSessions[] = $row;
    }
    $stmt->close();

    if (!$isOrgWide && function_exists('rbac_filter_sessions_for_user')) {
        $allSessions = rbac_filter_sessions_for_user($conn, $authUser, $allSessions);
    }

    // Self-scoped dashboards: hours + today's schedule are the logged-in provider's
    // sessions only (not every session on assigned clients).
    $providerOwnedOnly = !$isOrgWide && $staffId !== null && $staffId !== '';
    if ($providerOwnedOnly) {
        $sid = (string)$staffId;
        $allSessions = array_values(array_filter($allSessions, static function ($row) use ($sid) {
            return (string)($row['provider_id'] ?? '') === $sid;
        }));
    }

    $sessionsTodayList = [];
    $sessionsToday = 0;
    $pendingSessions = 0;
    $completedToday = 0;
    $upcomingSessions = 0;
    $sessionsThisWeek = 0;
    $completedThisWeek = 0;
    $renderedHoursMonth = 0.0;
    $pendingNotes = 0;

    foreach ($allSessions as $row) {
        $dos = null;
        $clinicStart = dash_to_clinic($row['start_utc'] ?? null);
        if ($clinicStart) {
            $dos = $clinicStart->format('Y-m-d');
        }
        $status = trim((string)($row['session_status'] ?? ''));
        $statusUpper = strtoupper($status);
        $clientName = trim(
            trim((string)($row['client_first_name'] ?? '')) . ' ' . trim((string)($row['client_last_name'] ?? ''))
        );
        if ($clientName === '') {
            $clientName = 'Client';
        }

        $renHrs = isset($row['rendered_hours']) && $row['rendered_hours'] !== null
            ? (float)$row['rendered_hours'] : 0.0;

        if ($dos && $dos >= $monthStart && $dos <= $monthEnd && $statusUpper === 'RENDERED') {
            $renderedHoursMonth += $renHrs;
        }

        if ($dos && $dos >= $weekStart && $dos <= $weekEnd) {
            $sessionsThisWeek++;
            if ($statusUpper === 'RENDERED') {
                $completedThisWeek++;
            }
            if ($statusUpper === 'SCHEDULED') {
                $upcomingSessions++;
            }
        }

        if ($dos === $today) {
            $sessionsToday++;
            if ($statusUpper === 'SCHEDULED') {
                $pendingSessions++;
            }
            if ($statusUpper === 'RENDERED') {
                $completedToday++;
            }
            $bucket = dash_session_bucket($status, $row['start_utc'] ?? null, $row['end_utc'] ?? null);
            $sessionsTodayList[] = [
                'session_id' => (int)($row['session_id'] ?? 0),
                'client' => $clientName,
                'client_id' => $row['client_id'] ?? null,
                'provider_name' => trim((string)($row['provider_name'] ?? '')),
                'time' => dash_format_time_range($row['start_utc'] ?? null, $row['end_utc'] ?? null),
                'status' => dash_status_label($bucket, $status),
                'status_bucket' => $bucket,
                'statusColor' => dash_status_color($bucket),
                'location' => trim((string)($row['place_of_service'] ?? '')) ?: null,
                'address' => trim((string)($row['location_address'] ?? '')) ?: null,
                'start_utc' => $row['start_utc'] ?? null,
                'end_utc' => $row['end_utc'] ?? null,
            ];
        }
    }

    // Pending notes: Rendered in last 14 days without a session note entry
    $notesTableExists = false;
    $tr = @$conn->query("SHOW TABLES LIKE 'client_session_note_entries'");
    if ($tr && $tr->num_rows > 0) {
        $notesTableExists = true;
    }
    if ($tr) {
        $tr->free();
    }

    $recentRendered = [];
    if ($notesTableExists) {
        $from14 = (new DateTimeImmutable('-14 days', new DateTimeZone('America/Chicago')))->format('Y-m-d');
        $sqlNotes = "
          SELECT
            s.session_id,
            s.client_id,
            s.provider_id,
            s.provider_name,
            " . ($hasSupervising ? 's.supervising_provider_id,' : 'NULL AS supervising_provider_id,') . "
            s.start_utc,
            s.{$statusCol} AS session_status,
            " . ($hasExclude ? 's.exclude_session,' : "'No' AS exclude_session,") . "
            c.first_name AS client_first_name,
            c.last_name AS client_last_name,
            n.id AS note_id
          FROM sessions s
          LEFT JOIN clients c ON s.client_id = c.client_id
          LEFT JOIN client_session_note_entries n
            ON CAST(n.session_id AS CHAR) = CAST(s.session_id AS CHAR)
          WHERE DATE(s.start_utc) BETWEEN ? AND ?
            AND UPPER(TRIM(IFNULL(s.{$statusCol}, ''))) = 'RENDERED'
          ORDER BY s.start_utc DESC
          LIMIT 100
        ";
        $stmtN = $conn->prepare($sqlNotes);
        if ($stmtN) {
            $stmtN->bind_param('ss', $from14, $today);
            $stmtN->execute();
            $resN = $stmtN->get_result();
            $renderedRows = [];
            while ($row = $resN->fetch_assoc()) {
                $renderedRows[] = $row;
            }
            $stmtN->close();
            if (!$isOrgWide && function_exists('rbac_filter_sessions_for_user')) {
                $renderedRows = rbac_filter_sessions_for_user($conn, $authUser, $renderedRows);
            }
            if ($providerOwnedOnly) {
                $sid = (string)$staffId;
                $renderedRows = array_values(array_filter($renderedRows, static function ($row) use ($sid) {
                    return (string)($row['provider_id'] ?? '') === $sid;
                }));
            }
            foreach ($renderedRows as $row) {
                if (!empty($row['note_id'])) {
                    continue;
                }
                $pendingNotes++;
                if (count($recentRendered) < 8) {
                    $cname = trim(
                        trim((string)($row['client_first_name'] ?? '')) . ' ' . trim((string)($row['client_last_name'] ?? ''))
                    );
                    $recentRendered[] = [
                        'session_id' => (int)($row['session_id'] ?? 0),
                        'client' => $cname !== '' ? $cname : 'Client',
                        'provider_name' => trim((string)($row['provider_name'] ?? '')),
                        'date' => !empty($row['start_utc'])
                            ? (dash_to_clinic($row['start_utc'])?->format('M j, Y') ?? '')
                            : '',
                        'type' => 'Session Note',
                    ];
                }
            }
        }
    }

    // Activities — scoped
    $activities = [];
    if ($isOrgWide) {
        $recentClientsQuery = "SELECT first_name, last_name, created_at
                               FROM clients WHERE {$activeClientWhere}
                               ORDER BY created_at DESC LIMIT 3";
        $recentClientsResult = $conn->query($recentClientsQuery);
        if ($recentClientsResult) {
            while ($row = $recentClientsResult->fetch_assoc()) {
                $activities[] = [
                    'type' => 'client',
                    'title' => 'New client enrolled',
                    'description' => $row['first_name'] . ' ' . $row['last_name'] . ' - ' . dash_time_ago($row['created_at']),
                    'timestamp' => $row['created_at'],
                ];
            }
            $recentClientsResult->free();
        }
    }

    foreach (array_slice(array_reverse($allSessions), 0, 8) as $row) {
        $st = strtoupper(trim((string)($row['session_status'] ?? '')));
        if ($st !== 'RENDERED') {
            continue;
        }
        $cname = trim(
            trim((string)($row['client_first_name'] ?? '')) . ' ' . trim((string)($row['client_last_name'] ?? ''))
        );
        if ($cname === '') {
            continue;
        }
        $ts = $row['end_utc'] ?? $row['start_utc'] ?? null;
        $activities[] = [
            'type' => 'session',
            'title' => 'Session completed',
            'description' => $cname . ' - ' . dash_time_ago($ts),
            'timestamp' => $ts,
        ];
        if (count($activities) >= 10) {
            break;
        }
    }

    usort($activities, static function ($a, $b) {
        return strtotime((string)($b['timestamp'] ?? 'now')) <=> strtotime((string)($a['timestamp'] ?? 'now'));
    });
    $activities = array_slice($activities, 0, 10);

    $monthGoalHours = 20.0;
    $renderedHoursMonth = round($renderedHoursMonth, 1);
    $goalPct = $monthGoalHours > 0
        ? (int)min(100, round(($renderedHoursMonth / $monthGoalHours) * 100))
        : 0;

    echo json_encode([
        'success' => true,
        'data' => [
            'role' => $role,
            'scope' => $isOrgWide ? 'all' : 'self',
            'staff_id' => $staffId,
            'activeClients' => $activeClients,
            'myClients' => $activeClients,
            'activeStaff' => $activeStaff,
            'sessionsToday' => $sessionsToday,
            'pendingSessions' => $pendingSessions,
            'completedToday' => $completedToday,
            'upcomingSessions' => $upcomingSessions,
            'sessionsThisWeek' => $sessionsThisWeek,
            'completedThisWeek' => $completedThisWeek,
            'pendingNotes' => $pendingNotes,
            'renderedHoursMonth' => $renderedHoursMonth,
            'supervisionGoalHours' => $monthGoalHours,
            'supervisionGoalPercent' => $goalPct,
            'todaySessions' => $sessionsTodayList,
            'pendingApprovals' => $recentRendered,
            'activities' => $activities,
        ],
    ]);

    $conn->close();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

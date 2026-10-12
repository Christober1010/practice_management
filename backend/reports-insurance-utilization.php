<?php
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
$authUser = requireAuth('reports.read', 'mahaverse');

$host = "db5018266079.hosting-data.io";
$user = "dbu3321929";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14484433";

function util_query_bool(string $name, bool $default = false): bool
{
    if (!isset($_GET[$name])) {
        return $default;
    }
    $raw = strtolower(trim((string)$_GET[$name]));
    return in_array($raw, ['1', 'true', 'yes', 'on'], true);
}

function util_num($value): float
{
    if ($value === null || $value === '') {
        return 0.0;
    }
    return is_numeric($value) ? (float)$value : 0.0;
}

function util_sessions_has_column(mysqli $conn, string $column): bool
{
    static $cache = [];
    if (array_key_exists($column, $cache)) {
        return $cache[$column];
    }
    $safe = $conn->real_escape_string($column);
    $res = $conn->query("SHOW COLUMNS FROM `sessions` LIKE '{$safe}'");
    $cache[$column] = $res && $res->num_rows > 0;
    if ($res) {
        $res->free();
    }
    return $cache[$column];
}

function util_session_duration_hours(array $row): float
{
    $rendered = util_num($row['rendered_hours'] ?? null);
    if ($rendered > 0) {
        return $rendered;
    }
    $scheduled = util_num($row['scheduled_hours'] ?? null);
    if ($scheduled > 0) {
        return $scheduled;
    }
    $start = $row['start_utc'] ?? null;
    $end = $row['end_utc'] ?? null;
    if (!$start || !$end) {
        return 0.0;
    }
    $s = strtotime((string)$start);
    $e = strtotime((string)$end);
    if ($s === false || $e === false || $e <= $s) {
        return 0.0;
    }
    return round(($e - $s) / 3600.0, 4);
}

function util_insurance_label(array $row): string
{
    $name = trim((string)($row['insurance_provider'] ?? ''));
    if ($name !== '') {
        return $name;
    }
    $name = trim((string)($row['insurance_plan_name'] ?? ''));
    if ($name !== '') {
        return $name;
    }
    $name = trim((string)($row['description'] ?? ''));
    if ($name !== '') {
        return $name;
    }
    $name = trim((string)($row['insurance_type'] ?? ''));
    if ($name !== '') {
        return $name;
    }
    $name = trim((string)($row['payer_name'] ?? ''));
    if ($name !== '') {
        return $name;
    }
    return 'Insurance';
}

/** Excel ROUND((end-start)/7, 0) using calendar-day serials. */
function util_excel_weeks_between(?string $startYmd, ?string $endYmd): ?float
{
    $startYmd = trim((string)$startYmd);
    $endYmd = trim((string)$endYmd);
    if ($startYmd === '' || $endYmd === '') {
        return null;
    }
    $startTs = strtotime(substr($startYmd, 0, 10) . ' 00:00:00');
    $endTs = strtotime(substr($endYmd, 0, 10) . ' 00:00:00');
    if ($startTs === false || $endTs === false) {
        return null;
    }
    return (float)round(($endTs - $startTs) / 86400.0 / 7.0, 0);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$clientId = isset($_GET['client_id']) ? trim((string)$_GET['client_id']) : '';
$insuranceId = isset($_GET['insurance_id']) ? trim((string)$_GET['insurance_id']) : '';
$expiringWithinDays = isset($_GET['expiring_within_days']) ? (int)$_GET['expiring_within_days'] : 0;
$highRiskOnly = util_query_bool('high_risk_only', false);
// "User entry date" in the Appointment Utilization spreadsheet — defaults to today.
$asOfDate = isset($_GET['as_of']) ? trim((string)$_GET['as_of']) : '';
if ($asOfDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $asOfDate)) {
    $asOfDate = gmdate('Y-m-d');
}

$conn = new mysqli($host, $user, $password, $database);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}
$conn->set_charset('utf8mb4');

try {
    $where = ['1=1'];
    $types = '';
    $params = [];
    if ($clientId !== '') {
        $where[] = 'ci.client_id = ?';
        $types .= 's';
        $params[] = $clientId;
    }
    if ($insuranceId !== '') {
        $where[] = 'ca.insurance_id = ?';
        $types .= 's';
        $params[] = $insuranceId;
    }

    $sql = "
      SELECT
        ca.auth_id,
        ca.auth_id AS auth_row_id,
        ca.auth_uuid,
        ca.insurance_id,
        ca.authorization_number,
        ca.billing_codes,
        ca.status AS auth_status,
        ca.units_approved_per_15_min,
        ca.units_serviced,
        ca.start_date AS auth_start_date,
        ca.end_date AS auth_end_date,
        ci.*,
        c.first_name,
        c.last_name,
        c.client_status
      FROM client_auth ca
      LEFT JOIN client_insurance ci ON ci.insurance_id = ca.insurance_id
      LEFT JOIN clients c ON c.client_id = ci.client_id
      WHERE " . implode(' AND ', $where) . "
      ORDER BY c.first_name ASC, c.last_name ASC, ca.end_date ASC, ca.auth_id ASC
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception($conn->error);
    }
    if ($types !== '') {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $authRows = [];
    while ($row = $result->fetch_assoc()) {
        $authRows[] = $row;
    }
    $stmt->close();

    $authKeyToRowIndexes = [];
    foreach ($authRows as $idx => $row) {
        foreach (['auth_id', 'auth_row_id'] as $key) {
            $id = (int)($row[$key] ?? 0);
            if ($id <= 0) {
                continue;
            }
            if (!isset($authKeyToRowIndexes[$id])) {
                $authKeyToRowIndexes[$id] = [];
            }
            $authKeyToRowIndexes[$id][] = $idx;
        }
    }

    // Per-auth hours: completed (rendered/ready) vs scheduled (upcoming).
    $sessionAggByAuth = [];
    if (!empty($authKeyToRowIndexes) && util_sessions_has_column($conn, 'auth_id')) {
        $ids = array_keys($authKeyToRowIndexes);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $selectCols = ['auth_id'];
        foreach (['rendered_hours', 'scheduled_hours', 'start_utc', 'end_utc', 'claim_status', 'status', 'STATUS'] as $col) {
            if (util_sessions_has_column($conn, $col)) {
                $selectCols[] = $col;
            }
        }
        $sqlSessions = "SELECT " . implode(', ', $selectCols) . " FROM sessions WHERE auth_id IN ($placeholders)";
        $stmtSessions = $conn->prepare($sqlSessions);
        if ($stmtSessions) {
            $typesSessions = str_repeat('i', count($ids));
            $intIds = array_map('intval', $ids);
            $stmtSessions->bind_param($typesSessions, ...$intIds);
            $stmtSessions->execute();
            $resSessions = $stmtSessions->get_result();
            while ($session = $resSessions->fetch_assoc()) {
                $status = strtolower(trim((string)($session['status'] ?? $session['STATUS'] ?? '')));
                if ($status === 'cancelled') {
                    continue;
                }
                $claim = strtolower(trim((string)($session['claim_status'] ?? '')));
                $isReady = $claim !== '' && strpos($claim, 'ready') !== false;
                $isRendered = $status === 'rendered' || $status === 'completed';
                $hours = util_session_duration_hours($session);
                if ($hours <= 0) {
                    continue;
                }
                $authId = (int)($session['auth_id'] ?? 0);
                if ($authId <= 0) {
                    continue;
                }
                if (!isset($sessionAggByAuth[$authId])) {
                    $sessionAggByAuth[$authId] = [
                        'completed_hours' => 0.0,
                        'scheduled_hours' => 0.0,
                    ];
                }
                if ($isReady || $isRendered) {
                    $sessionAggByAuth[$authId]['completed_hours'] += $hours;
                } else {
                    // Remaining scheduled (not yet rendered) — spreadsheet "Scheduled Hrs".
                    $sessionAggByAuth[$authId]['scheduled_hours'] += $hours;
                }
            }
            $stmtSessions->close();
        }
    }

    $todayTs = strtotime($asOfDate . ' 00:00:00');
    if ($todayTs === false) {
        $todayTs = strtotime(gmdate('Y-m-d') . ' 00:00:00');
        $asOfDate = gmdate('Y-m-d');
    }
    $rows = [];
    $insuranceRollups = [];
    $summary = [
        'total_authorizations' => 0,
        'high_risk_authorizations' => 0,
        'expiring_soon_authorizations' => 0,
        'total_approved_units' => 0.0,
        'total_consumed_units' => 0.0,
        'total_remaining_units' => 0.0,
        'total_approved_hours' => 0.0,
        'total_completed_hours' => 0.0,
        'total_scheduled_hours' => 0.0,
        'total_remaining_hours' => 0.0,
        'as_of' => $asOfDate,
    ];

    foreach ($authRows as $idx => $row) {
        $completedHours = 0.0;
        $scheduledHours = 0.0;
        foreach (['auth_id', 'auth_row_id'] as $idKey) {
            $lookup = (int)($row[$idKey] ?? 0);
            if ($lookup > 0 && isset($sessionAggByAuth[$lookup])) {
                $completedHours = max($completedHours, (float)$sessionAggByAuth[$lookup]['completed_hours']);
                $scheduledHours = max($scheduledHours, (float)$sessionAggByAuth[$lookup]['scheduled_hours']);
            }
        }
        $approved = max(0, util_num($row['units_approved_per_15_min'] ?? null));
        $storedServiced = max(0, util_num($row['units_serviced'] ?? null));
        // Spreadsheet calc columns (Appointment Utilization Report):
        // Hrs = Approved in Units / 4
        // Remaining Hours = Hrs - Completed Hrs - Scheduled Hrs
        // Act.WkAvg = Hrs / ROUND((End-Start)/7,0)
        // Calc wks = ROUND((End - User entry date)/7,0)
        // Weekly Target Hrs = ROUND(Remaining Hours / Calc wks, 0)
        $approvedHours = round($approved / 4.0, 4);
        $completedFromUnits = round($storedServiced / 4.0, 4);
        $completedHours = round(max($completedHours, $completedFromUnits), 4);
        $scheduledHours = round($scheduledHours, 4);
        $remainingHours = round($approvedHours - $completedHours - $scheduledHours, 4);

        $consumed = round(max($completedHours * 4.0, $storedServiced), 2);
        $remaining = round($approved - $consumed - ($scheduledHours * 4.0), 2);
        $startDate = trim((string)($row['auth_start_date'] ?? ''));
        $expiryDate = trim((string)($row['auth_end_date'] ?? ''));
        if ($expiryDate === '') {
            $expiryDate = trim((string)($row['insurance_end_date'] ?? ($row['end_date'] ?? '')));
        }

        $daysToExpiry = null;
        $weeksToExpiry = null;
        $expiryStatus = 'active';
        if ($expiryDate !== '') {
            $expiryTs = strtotime($expiryDate . ' 23:59:59');
            if ($expiryTs !== false) {
                $daysToExpiry = (int)floor(($expiryTs - $todayTs) / 86400);
                $weeksToExpiry = round($daysToExpiry / 7.0, 2);
                if ($daysToExpiry < 0) {
                    $expiryStatus = 'expired';
                }
            } else {
                $expiryStatus = 'no_expiry';
            }
        } else {
            $expiryStatus = 'no_expiry';
        }

        $authPeriodWeeks = util_excel_weeks_between($startDate, $expiryDate);
        $calcWks = util_excel_weeks_between($asOfDate, $expiryDate);
        $actWkAvg = null;
        if ($authPeriodWeeks !== null && $authPeriodWeeks > 0) {
            $actWkAvg = round($approvedHours / $authPeriodWeeks, 2);
        }
        $weeklyTargetHrs = null;
        if ($calcWks !== null && $calcWks > 0) {
            $weeklyTargetHrs = (float)round($remainingHours / $calcWks, 0);
        }

        $elapsedWeeks = null;
        if ($startDate !== '') {
            $startTs = strtotime($startDate . ' 00:00:00');
            if ($startTs !== false && $todayTs >= $startTs) {
                $elapsedDays = max(1, (int)floor(($todayTs - $startTs) / 86400));
                $elapsedWeeks = max(0.14, round($elapsedDays / 7.0, 2));
            }
        }
        $consumptionRate = $elapsedWeeks && $elapsedWeeks > 0 ? round($consumed / $elapsedWeeks, 2) : 0.0;
        $weeklyUnitsRequired = $weeklyTargetHrs !== null ? round($weeklyTargetHrs * 4.0, 2) : 0.0;
        if ($weeklyUnitsRequired <= 0 && $weeksToExpiry !== null && $weeksToExpiry > 0 && $remaining > 0) {
            $weeklyUnitsRequired = round($remaining / $weeksToExpiry, 2);
        }
        $projectedOverutilization = $remainingHours < 0;
        $projectedUnderutilization = (
            !$projectedOverutilization &&
            $remainingHours > 0 &&
            $calcWks !== null &&
            $calcWks > 0 &&
            (
                $completedHours <= 0.0 ||
                ($weeklyTargetHrs !== null && $actWkAvg !== null && $weeklyTargetHrs > ($actWkAvg * 1.15)) ||
                ($weeklyUnitsRequired > 0 && $consumptionRate > 0 && $weeklyUnitsRequired > ($consumptionRate * 1.15))
            )
        );
        $expiringSoon = ($daysToExpiry !== null && $daysToExpiry >= 0 && $daysToExpiry <= 45);
        $consumedPercent = $approved > 0 ? round(($consumed / $approved) * 100.0, 2) : 0.0;

        if ($expiringWithinDays > 0) {
            if ($daysToExpiry === null || $daysToExpiry < 0 || $daysToExpiry > $expiringWithinDays) {
                continue;
            }
        }
        if ($highRiskOnly && !$projectedUnderutilization) {
            continue;
        }

        $clientIdValue = trim((string)($row['client_id'] ?? ''));
        $insuranceIdValue = trim((string)($row['insurance_id'] ?? ''));
        $clientName = trim((string)($row['first_name'] ?? '') . ' ' . (string)($row['last_name'] ?? ''));
        if ($clientName === '') {
            $clientName = 'Unknown client';
        }
        $insuranceLabel = util_insurance_label($row);
        $customerStatus = trim((string)($row['client_status'] ?? ''));
        if ($customerStatus === '') {
            $customerStatus = 'Unknown';
        }

        $out = [
            'auth_row_key' => (string)($row['auth_uuid'] ?? '') !== ''
                ? (string)$row['auth_uuid']
                : ('auth-' . (string)($row['auth_id'] ?? $row['auth_row_id'] ?? $idx)),
            'client_id' => $clientIdValue,
            'client_name' => $clientName,
            'customer_status' => $customerStatus,
            'insurance_id' => $insuranceIdValue,
            'insurance_label' => $insuranceLabel,
            'authorization_number' => (string)($row['authorization_number'] ?? ''),
            'billing_codes' => (string)($row['billing_codes'] ?? ''),
            'service_code' => (string)($row['billing_codes'] ?? ''),
            'auth_status' => (string)($row['auth_status'] ?? ''),
            'approved_units' => round($approved, 2),
            'approved_hours' => round($approvedHours, 2),
            'completed_hours' => round($completedHours, 2),
            'scheduled_hours' => round($scheduledHours, 2),
            'user_entry_date' => $asOfDate,
            'act_wk_avg' => $actWkAvg,
            'calc_wks' => $calcWks,
            'remaining_hours' => round($remainingHours, 2),
            'weekly_target_hrs' => $weeklyTargetHrs,
            'consumed_units' => round($consumed, 2),
            'remaining_units' => round($remaining, 2),
            'consumed_percent' => $consumedPercent,
            'start_date' => $startDate !== '' ? $startDate : null,
            'expiry_date' => $expiryDate !== '' ? $expiryDate : null,
            'days_to_expiry' => $daysToExpiry,
            'weeks_to_expiry' => $weeksToExpiry,
            'weekly_units_required' => $weeklyUnitsRequired,
            'weekly_units_consumed_rate' => $consumptionRate,
            'expiry_status' => $expiryStatus,
            'expiring_soon' => $expiringSoon,
            'projected_underutilization' => $projectedUnderutilization,
            'projected_overutilization' => $projectedOverutilization,
        ];
        $rows[] = $out;

        $summary['total_authorizations'] += 1;
        $summary['total_approved_units'] += $out['approved_units'];
        $summary['total_consumed_units'] += $out['consumed_units'];
        $summary['total_remaining_units'] += $out['remaining_units'];
        $summary['total_approved_hours'] += $out['approved_hours'];
        $summary['total_completed_hours'] += $out['completed_hours'];
        $summary['total_scheduled_hours'] += $out['scheduled_hours'];
        $summary['total_remaining_hours'] += $out['remaining_hours'];
        if ($out['projected_underutilization']) {
            $summary['high_risk_authorizations'] += 1;
        }
        if ($out['expiring_soon']) {
            $summary['expiring_soon_authorizations'] += 1;
        }

        $rollupKey = ($clientIdValue !== '' ? $clientIdValue : 'unknown-client') . '|' . ($insuranceIdValue !== '' ? $insuranceIdValue : 'unknown-insurance');
        if (!isset($insuranceRollups[$rollupKey])) {
            $insuranceRollups[$rollupKey] = [
                'client_id' => $clientIdValue,
                'client_name' => $clientName,
                'insurance_id' => $insuranceIdValue,
                'insurance_label' => $insuranceLabel,
                'authorization_count' => 0,
                'high_risk_authorizations' => 0,
                'approved_units' => 0.0,
                'consumed_units' => 0.0,
                'remaining_units' => 0.0,
                'nearest_days_to_expiry' => null,
            ];
        }
        $insuranceRollups[$rollupKey]['authorization_count'] += 1;
        $insuranceRollups[$rollupKey]['approved_units'] += $out['approved_units'];
        $insuranceRollups[$rollupKey]['consumed_units'] += $out['consumed_units'];
        $insuranceRollups[$rollupKey]['remaining_units'] += $out['remaining_units'];
        if ($out['projected_underutilization']) {
            $insuranceRollups[$rollupKey]['high_risk_authorizations'] += 1;
        }
        if ($out['days_to_expiry'] !== null) {
            $existing = $insuranceRollups[$rollupKey]['nearest_days_to_expiry'];
            if ($existing === null || $out['days_to_expiry'] < $existing) {
                $insuranceRollups[$rollupKey]['nearest_days_to_expiry'] = $out['days_to_expiry'];
            }
        }
    }

    usort($rows, static function ($a, $b) {
        $da = $a['days_to_expiry'];
        $db = $b['days_to_expiry'];
        if ($da === null && $db === null) {
            return strcmp((string)$a['client_name'], (string)$b['client_name']);
        }
        if ($da === null) {
            return 1;
        }
        if ($db === null) {
            return -1;
        }
        if ($da === $db) {
            return strcmp((string)$a['client_name'], (string)$b['client_name']);
        }
        return $da <=> $db;
    });

    $rollups = array_values(array_map(static function ($rollup) {
        $rollup['approved_units'] = round((float)$rollup['approved_units'], 2);
        $rollup['consumed_units'] = round((float)$rollup['consumed_units'], 2);
        $rollup['remaining_units'] = round((float)$rollup['remaining_units'], 2);
        $rollup['consumed_percent'] = $rollup['approved_units'] > 0
            ? round(($rollup['consumed_units'] / $rollup['approved_units']) * 100.0, 2)
            : 0.0;
        return $rollup;
    }, $insuranceRollups));

    usort($rollups, static function ($a, $b) {
        if ($a['client_name'] === $b['client_name']) {
            return strcmp((string)$a['insurance_label'], (string)$b['insurance_label']);
        }
        return strcmp((string)$a['client_name'], (string)$b['client_name']);
    });

    $summary['total_approved_units'] = round((float)$summary['total_approved_units'], 2);
    $summary['total_consumed_units'] = round((float)$summary['total_consumed_units'], 2);
    $summary['total_remaining_units'] = round((float)$summary['total_remaining_units'], 2);
    $summary['total_approved_hours'] = round((float)$summary['total_approved_hours'], 2);
    $summary['total_completed_hours'] = round((float)$summary['total_completed_hours'], 2);
    $summary['total_scheduled_hours'] = round((float)$summary['total_scheduled_hours'], 2);
    $summary['total_remaining_hours'] = round((float)$summary['total_remaining_hours'], 2);
    $summary['consumed_percent'] = $summary['total_approved_units'] > 0
        ? round(($summary['total_consumed_units'] / $summary['total_approved_units']) * 100.0, 2)
        : 0.0;

    echo json_encode([
        'success' => true,
        'data' => [
            'rows' => $rows,
            'insurance_rollups' => $rollups,
            'summary' => $summary,
            'meta' => [
                'generated_at' => gmdate('c'),
                'as_of' => $asOfDate,
                'consumption_basis' => 'completed_hours_plus_scheduled_hours',
                'granularity' => 'authorization',
                'calc_columns' => [
                    'approved_hours' => 'approved_units / 4',
                    'act_wk_avg' => 'approved_hours / ROUND((end_dt - start_dt) / 7, 0)',
                    'calc_wks' => 'ROUND((end_dt - user_entry_date) / 7, 0)',
                    'remaining_hours' => 'approved_hours - completed_hours - scheduled_hours',
                    'weekly_target_hrs' => 'ROUND(remaining_hours / calc_wks, 0)',
                ],
            ],
        ],
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
} finally {
    $conn->close();
}


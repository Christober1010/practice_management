<?php
// CORS + JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = requireAuth('reports.read', 'mahaverse');



// Test DB — same as config.php getDBConnection() / add-session.php
$host = "db5018419668.hosting-data.io";
$user = "dbu1183438";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14649042";

$conn = new mysqli($host, $user, $password, $database);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}
$conn->set_charset('utf8mb4');

$method = $_SERVER['REQUEST_METHOD'];
$input  = json_decode(file_get_contents('php://input'), true) ?? [];

// ---------- Helpers ----------
function excelSerialToDateTimeString($serial, $dateOnly = false) {
    if ($serial === '' || $serial === null) return null;
    if (!is_numeric($serial)) return $serial; // already a string

    // Excel 1900 date system: serial 1 = 1899-12-31; adjust for Unix epoch
    $base = 25569;
    $seconds = ($serial - $base) * 86400;
    $format = $dateOnly ? "Y-m-d" : "Y-m-d H:i:s";
    return gmdate($format, (int)$seconds);
}

/**
 * Excel time-only cells often become 1899-12-30, 1900-01-00, or 1900-01-01 plus time.
 * Merge the row's DOS calendar date with that time so MySQL stores a real datetime.
 */
function reports_merge_dos_into_apt_start($dos, $aptStart) {
    if ($dos === null || $dos === '' || $aptStart === null || $aptStart === '') {
        return $aptStart;
    }
    $dosTs = strtotime((string)$dos);
    if ($dosTs === false) {
        return $aptStart;
    }
    $dosDate = date('Y-m-d', $dosTs);
    $s = trim((string)$aptStart);
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})[\sT]+(\d{1,2}:\d{2}(?::\d{2})?)/', $s, $m)) {
        return $aptStart;
    }
    $yy = (int)$m[1];
    $mm = (int)$m[2];
    $dd = (int)$m[3];
    $timePart = $m[4];
    if (strlen($timePart) === 5) {
        $timePart .= ':00';
    }
    $isExcelTimeOnly =
        ($yy === 1899 && $mm === 12 && $dd === 30) ||
        ($yy === 1900 && $mm === 1 && ($dd === 0 || $dd === 1));
    if ($isExcelTimeOnly) {
        return $dosDate . ' ' . $timePart;
    }
    return $aptStart;
}

function sqlValue($conn, $value) {
    if ($value === null || $value === '') return "NULL";
    return "'" . $conn->real_escape_string($value) . "'";
}

function reports_row_linked_id($row, $isExcelFormat, $snakeKey, $excelLabel)
{
    if ($isExcelFormat) {
        $v = $row[$excelLabel] ?? $row[$snakeKey] ?? null;
    } else {
        $v = $row[$snakeKey] ?? null;
    }
    if ($v === null || $v === '') {
        return null;
    }
    return trim((string)$v);
}

/** Normalize for duplicate fingerprint: trim, collapse spaces, lowercase. */
function reports_normalize_token($s) {
    $s = trim(preg_replace('/\s+/', ' ', (string)$s));
    return strtolower($s);
}

/**
 * When Client ID is omitted, match one non-archived row in clients by first + last name
 * (case-insensitive, trimmed). Skips if zero or multiple matches.
 */
function reports_resolve_client_id_by_name(mysqli $conn, $firstName, $lastName)
{
    static $cache = [];
    $fn = reports_normalize_token($firstName);
    $ln = reports_normalize_token($lastName);
    if ($fn === '' || $ln === '') {
        return null;
    }
    $key = 'c:' . $fn . '|' . $ln;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }
    $stmt = $conn->prepare(
        'SELECT client_id FROM clients WHERE archived = 0
         AND LOWER(TRIM(COALESCE(first_name, \'\'))) = ?
         AND LOWER(TRIM(COALESCE(last_name, \'\'))) = ?
         LIMIT 2'
    );
    if (!$stmt) {
        $cache[$key] = null;
        return null;
    }
    $stmt->bind_param('ss', $fn, $ln);
    $stmt->execute();
    $res = $stmt->get_result();
    $ids = [];
    while ($row = $res->fetch_assoc()) {
        $ids[] = (string)$row['client_id'];
    }
    $stmt->close();
    $out = count($ids) === 1 ? $ids[0] : null;
    $cache[$key] = $out;
    return $out;
}

/**
 * When Provider ID / Staff ID is omitted, match one non-archived staff row by first + last name.
 */
function reports_resolve_staff_id_by_name(mysqli $conn, $firstName, $lastName)
{
    static $cache = [];
    $fn = reports_normalize_token($firstName);
    $ln = reports_normalize_token($lastName);
    if ($fn === '' || $ln === '') {
        return null;
    }
    $key = 's:' . $fn . '|' . $ln;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }
    $stmt = $conn->prepare(
        'SELECT id FROM staff WHERE COALESCE(archived, 0) = 0
         AND LOWER(TRIM(COALESCE(firstName, \'\'))) = ?
         AND LOWER(TRIM(COALESCE(lastName, \'\'))) = ?
         LIMIT 2'
    );
    if (!$stmt) {
        $cache[$key] = null;
        return null;
    }
    $stmt->bind_param('ss', $fn, $ln);
    $stmt->execute();
    $res = $stmt->get_result();
    $ids = [];
    while ($row = $res->fetch_assoc()) {
        $ids[] = (string)$row['id'];
    }
    $stmt->close();
    $out = count($ids) === 1 ? $ids[0] : null;
    $cache[$key] = $out;
    return $out;
}

/**
 * For schedule_tracker list: if report row is missing linked IDs, resolve from client/staff names
 * (unique match only), UPDATE the row, and set values on $row for this response.
 */
function reports_backfill_row_linked_ids_if_empty(mysqli $conn, array &$row)
{
    $rid = isset($row['id']) ? (int)$row['id'] : 0;
    if ($rid <= 0) {
        return;
    }
    $cid = isset($row['client_id']) ? trim((string)$row['client_id']) : '';
    if ($cid === '') {
        $resolved = reports_resolve_client_id_by_name(
            $conn,
            $row['client_first_name'] ?? '',
            $row['client_last_name'] ?? ''
        );
        if ($resolved !== null) {
            $st = $conn->prepare(
                'UPDATE reports SET client_id = ? WHERE id = ? AND (client_id IS NULL OR TRIM(COALESCE(client_id, \'\')) = \'\')'
            );
            if ($st) {
                $st->bind_param('si', $resolved, $rid);
                $st->execute();
                $st->close();
            }
            $row['client_id'] = $resolved;
        }
    }
    $pid = isset($row['provider_id']) ? trim((string)$row['provider_id']) : '';
    if ($pid === '') {
        $resolved = reports_resolve_staff_id_by_name(
            $conn,
            $row['staff_first_name'] ?? '',
            $row['staff_last_name'] ?? ''
        );
        if ($resolved !== null) {
            $st = $conn->prepare(
                'UPDATE reports SET provider_id = ? WHERE id = ? AND (provider_id IS NULL OR TRIM(COALESCE(provider_id, \'\')) = \'\')'
            );
            if ($st) {
                $st->bind_param('si', $resolved, $rid);
                $st->execute();
                $st->close();
            }
            $row['provider_id'] = $resolved;
        }
    }
}

/** Stable time fragment for DOS+time duplicate key (apt_start_time may be time or datetime string). */
function reports_time_token($apt) {
    if ($apt === null || $apt === '') {
        return '';
    }
    $ts = strtotime((string)$apt);
    if ($ts !== false) {
        return date('H:i:s', $ts);
    }
    if (preg_match('/(\d{1,2}:\d{2}(:\d{2})?)/', (string)$apt, $m)) {
        return strlen($m[1]) === 5 ? $m[1] . ':00' : $m[1];
    }
    return reports_normalize_token($apt);
}

/**
 * Duplicate fingerprint: same client + staff + service code + DOS (date) + apt start time.
 * Documented for Schedule Tracker imports — keep in sync with client-side checks if any.
 */
function reports_dup_fingerprint_from_values($cf, $cl, $sf, $sl, $svc, $dos, $aptStart) {
    $dosKey = '';
    if ($dos !== null && $dos !== '') {
        $t = strtotime((string)$dos);
        $dosKey = $t !== false ? date('Y-m-d', $t) : reports_normalize_token($dos);
    }
    $parts = [
        reports_normalize_token($cf),
        reports_normalize_token($cl),
        reports_normalize_token($sf),
        reports_normalize_token($sl),
        reports_normalize_token($svc),
        $dosKey,
        reports_time_token($aptStart),
    ];
    return implode('|', $parts);
}

/** Find existing report ids that match the fingerprint (archived = 0). Max 5 ids. */
function reports_find_db_duplicate_ids(mysqli $conn, $cf, $cl, $sf, $sl, $svc, $dos, $aptStart) {
    $dosKey = null;
    if ($dos !== null && $dos !== '') {
        $t = strtotime((string)$dos);
        $dosKey = $t !== false ? date('Y-m-d', $t) : null;
    }
    if ($dosKey === null) {
        return [];
    }
    $cfn = $conn->real_escape_string(reports_normalize_token($cf));
    $cln = $conn->real_escape_string(reports_normalize_token($cl));
    $sfn = $conn->real_escape_string(reports_normalize_token($sf));
    $sln = $conn->real_escape_string(reports_normalize_token($sl));
    $scn = $conn->real_escape_string(reports_normalize_token($svc));
    $dosEsc = $conn->real_escape_string($dosKey);
    $aptForTime = ($aptStart !== null && $aptStart !== '') ? (string)$aptStart : '00:00:00';
    $aptEsc = $conn->real_escape_string($aptForTime);

    $sql = "
        SELECT id FROM reports WHERE archived = 0
        AND LOWER(TRIM(COALESCE(client_first_name,''))) = '{$cfn}'
        AND LOWER(TRIM(COALESCE(client_last_name,''))) = '{$cln}'
        AND LOWER(TRIM(COALESCE(staff_first_name,''))) = '{$sfn}'
        AND LOWER(TRIM(COALESCE(staff_last_name,''))) = '{$sln}'
        AND LOWER(TRIM(COALESCE(service_code_with_modifiers,''))) = '{$scn}'
        AND DATE(dos) = '{$dosEsc}'
        AND COALESCE(TIME(apt_start_time), '00:00:00') = COALESCE(TIME('{$aptEsc}'), '00:00:00')
        LIMIT 5
    ";
    $res = $conn->query($sql);
    if (!$res) {
        return [];
    }
    $ids = [];
    while ($row = $res->fetch_assoc()) {
        $ids[] = (int)$row['id'];
    }
    $res->free();
    return $ids;
}

/** Omit billing-style columns from API responses (GET). */
function reports_strip_excluded_fields(array $row): array
{
    static $omit = [
        'duration_render_in_hrs',
        'coinsurance',
        'copay',
        'deductible',
        'insurance_actual_paid',
        'insurance_acutal_paid',
        'check_num',
        'cube_payment_date',
        'cube_invoice_ref',
        'session_hrs',
    ];
    foreach ($omit as $k) {
        unset($row[$k]);
    }
    return $row;
}

/** Schedule Tracker GET: keep duration_render_in_hrs + misc_hrs; still omit other billing columns. */
function reports_strip_excluded_fields_schedule_tracker(array $row): array
{
    static $omit = [
        'coinsurance',
        'copay',
        'deductible',
        'insurance_actual_paid',
        'insurance_acutal_paid',
        'check_num',
        'cube_payment_date',
        'cube_invoice_ref',
        'session_hrs',
    ];
    foreach ($omit as $k) {
        unset($row[$k]);
    }
    return $row;
}

/** Allowed values for reports.tracker_status (Schedule Tracker workflow). */
function reports_tracker_status_allowed(): array
{
    return ['Pending', 'Reviewed', 'Excluded', 'Pending Payment', 'Received Payment'];
}

function reports_normalize_tracker_status($value): string
{
    $s = trim((string)($value ?? ''));
    if ($s === '') {
        return 'Pending';
    }
    $legacy = [
        'payment posted' => 'Pending Payment',
        'payment cleared' => 'Received Payment',
    ];
    $lower = strtolower($s);
    if (isset($legacy[$lower])) {
        return $legacy[$lower];
    }
    foreach (reports_tracker_status_allowed() as $allowed) {
        if (strcasecmp($s, $allowed) === 0) {
            return $allowed;
        }
    }
    return 'Pending';
}

/**
 * Build the INSERT SQL string for a pending row.
 * Extracted to avoid duplicating the large SQL block.
 */
function reports_build_insert_sql(mysqli $conn, array $p): string
{
    $row           = $p['row'];
    $isExcelFormat = $p['isExcelFormat'];
    $miscHrs       = $p['miscHrs'];
    $cf            = $p['cf'];
    $cl            = $p['cl'];
    $sf            = $p['sf'];
    $sl            = $p['sl'];

    $linkClientId = reports_row_linked_id($row, $isExcelFormat, 'client_id', 'Client ID');
    $linkProviderId = reports_row_linked_id($row, $isExcelFormat, 'provider_id', 'Provider ID');
    if (($linkProviderId === null || $linkProviderId === '') && $isExcelFormat) {
        $rawSid = $row['Staff ID'] ?? $row['staff_id'] ?? '';
        if ($rawSid !== '' && $rawSid !== null) {
            $linkProviderId = trim((string)$rawSid);
        }
    }
    if (($linkProviderId === null || $linkProviderId === '') && !$isExcelFormat) {
        $rawSid = $row['staff_id'] ?? '';
        if ($rawSid !== '' && $rawSid !== null) {
            $linkProviderId = trim((string)$rawSid);
        }
    }
    if ($linkClientId === null || $linkClientId === '') {
        $resolved = reports_resolve_client_id_by_name($conn, $cf, $cl);
        if ($resolved !== null) {
            $linkClientId = $resolved;
        }
    }
    if ($linkProviderId === null || $linkProviderId === '') {
        $resolved = reports_resolve_staff_id_by_name($conn, $sf, $sl);
        if ($resolved !== null) {
            $linkProviderId = $resolved;
        }
    }

    $trackerStatus = $p['trackerStatus'] ?? null;
    if ($trackerStatus === null || $trackerStatus === '') {
        $trackerStatus = $isExcelFormat ? ($row['Status'] ?? null) : ($row['status'] ?? null);
    }
    $trackerStatus = reports_normalize_tracker_status($trackerStatus);

    return "
        INSERT INTO reports (
            client_id, provider_id,
            client_first_name, client_last_name, client_middle_name,
            staff_first_name, staff_last_name, staff_middle_name,
            name_of_rbt_supervised,
            payer, activity_type, location_code, authorization_number,
            service_code_with_modifiers,
            dos, apt_start_time, apt_end_time,
            duration_schedule_in_min, duration_schedule_in_hrs,
            rendered_date, rendered_start_time, rendered_end_time,
            duration_render_in_min, duration_render_in_hrs,
            session_completion_latency_hrs,
            address, status, non_billable_notes, billable,
            office,
            rendering_provider_first_name, rendering_provider_last_name,
            rendering_provider_middlename,
            created_by, created_date,
            notes,
            staff_signature_on_file, staff_sign_date, approx_location_staff_sign,
            guardian_signature_on_file, guardian_sign_date, approx_location_guardian_sign,
            direct_or_indirect_service,
            make_up_session, make_up_session_hours,
            exclude_from_payroll, exclude_from_mileage,
            misc_hrs,
            tracker_status,
            archived
        ) VALUES (
            " . sqlValue($conn, $linkClientId) . ",
            " . sqlValue($conn, $linkProviderId) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Client First Name'] ?? null) : ($row['client_first_name'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Client Last Name'] ?? null) : ($row['client_last_name'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Client Middle Name'] ?? null) : ($row['client_middle_name'] ?? null)) . ",

            " . sqlValue($conn, $isExcelFormat ? ($row['Staff First Name'] ?? null) : ($row['staff_first_name'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Staff Last Name'] ?? null) : ($row['staff_last_name'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Staff Middle Name'] ?? null) : ($row['staff_middle_name'] ?? null)) . ",

            " . sqlValue($conn, $isExcelFormat ? ($row['Name of RBT Supervised'] ?? null) : ($row['name_of_rbt_supervised'] ?? null)) . ",

            " . sqlValue($conn, $isExcelFormat ? ($row['Payer'] ?? null) : ($row['payer'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Activity Type'] ?? null) : ($row['activity_type'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Location Code'] ?? null) : ($row['location_code'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Authorization Number'] ?? null) : ($row['authorization_number'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Service Code With Modifiers'] ?? null) : ($row['service_code_with_modifiers'] ?? null)) . ",

            " . sqlValue($conn, $p['dos']) . ",
            " . sqlValue($conn, $p['aptStart']) . ",
            " . sqlValue($conn, $p['aptEnd'] ?? null) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Duration Schedule In Min'] ?? null) : ($row['duration_schedule_in_min'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Duration Schedule In Hrs'] ?? null) : ($row['duration_schedule_in_hrs'] ?? null)) . ",

            " . sqlValue($conn, $p['renderedDate'] ?? null) . ",
            " . sqlValue($conn, $p['renderedStart'] ?? null) . ",
            " . sqlValue($conn, $p['renderedEnd'] ?? null) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Duration Render in Min'] ?? null) : ($row['duration_render_in_min'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Duration Render in Hrs'] ?? null) : ($row['duration_render_in_hrs'] ?? null)) . ",

            " . sqlValue($conn, $isExcelFormat ? ($row['Session Completion Latency in Hrs'] ?? null) : ($row['session_completion_latency_hrs'] ?? null)) . ",

            " . sqlValue($conn, $isExcelFormat ? ($row['Address'] ?? null) : ($row['address'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Status'] ?? null) : ($row['status'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Non-Billable Notes'] ?? null) : ($row['non_billable_notes'] ?? null)) . ",
            " . $p['billable'] . ",

            " . sqlValue($conn, $isExcelFormat ? ($row['Office'] ?? null) : ($row['office'] ?? null)) . ",

            " . sqlValue($conn, $isExcelFormat ? ($row['Rendering Provider First Name'] ?? null) : ($row['rendering_provider_first_name'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Rendering Provider Last Name'] ?? null) : ($row['rendering_provider_last_name'] ?? null)) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Rendering Provider MiddleName'] ?? null) : ($row['rendering_provider_middlename'] ?? null)) . ",

            " . sqlValue($conn, $isExcelFormat ? ($row['Created By'] ?? null) : ($row['created_by'] ?? null)) . ",
            " . sqlValue($conn, $p['createdDate'] ?? null) . ",

            " . sqlValue($conn, $isExcelFormat ? ($row['Notes'] ?? null) : ($row['notes'] ?? null)) . ",

            " . $p['staffSig'] . ",
            " . sqlValue($conn, $p['staffSignDate'] ?? null) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Approx. location of Staff Sign'] ?? null) : ($row['approx_location_staff_sign'] ?? null)) . ",

            " . $p['guardianSig'] . ",
            " . sqlValue($conn, $p['guardianSignDate'] ?? null) . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Approx. location of Guardian Sign'] ?? null) : ($row['approx_location_guardian_sign'] ?? null)) . ",

            " . sqlValue($conn, $isExcelFormat ? ($row['DIRECT or INDIRECT Service'] ?? null) : ($row['direct_or_indirect_service'] ?? null)) . ",

            " . $p['makeUp'] . ",
            " . sqlValue($conn, $isExcelFormat ? ($row['Make-Up Session Hours'] ?? null) : ($row['make_up_session_hours'] ?? null)) . ",

            " . $p['excludePayroll'] . ",
            " . $p['excludeMileage'] . ",
            " . sqlValue($conn, $miscHrs) . ",
            " . sqlValue($conn, $trackerStatus) . ",
            0
        )
    ";
}

// ---------- Routing ----------
try {
    switch ($method) {
        case 'GET':
            handleGet($conn);
            break;
        case 'POST':
            handlePost($conn, $input);
            break;
        case 'PUT':
            handlePut($conn, $input);
            break;
        case 'DELETE':
            handleDelete($conn, $input);
            break;
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
} finally {
    $conn->close();
}

// ---------- GET (list or single by id) ----------
function handleGet($conn)
{
    $id = isset($_GET['id']) ? (int)$_GET['id'] : null;
    $archived = isset($_GET['archived']) ? (int)$_GET['archived'] : 0;
    $context = isset($_GET['context']) ? trim((string)$_GET['context']) : '';
    $scheduleTracker = ($context === 'schedule_tracker');

    if ($id) {
        $stmt = $conn->prepare('SELECT * FROM reports WHERE id = ?');
        $stmt->bind_param('i', $id);
    } elseif ($scheduleTracker) {
        $where = ['archived = ?'];
        $types = 'i';
        $params = [$archived];

        $cid = isset($_GET['client_id']) ? trim((string)$_GET['client_id']) : '';
        if ($cid !== '') {
            $cn = isset($_GET['or_client_name']) ? trim((string)$_GET['or_client_name']) : '';
            if ($cn !== '') {
                $likeN = '%' . $cn . '%';
                $where[] = "(client_id = ? OR ((client_id IS NULL OR client_id = '') AND CONCAT(TRIM(IFNULL(client_first_name,'')),' ',TRIM(IFNULL(client_last_name,''))) LIKE ?))";
                $types .= 'ss';
                $params[] = $cid;
                $params[] = $likeN;
            } else {
                $where[] = 'client_id = ?';
                $types .= 's';
                $params[] = $cid;
            }
        }
        $fc = isset($_GET['filter_client']) ? trim((string)$_GET['filter_client']) : '';
        if ($fc !== '') {
            $like = '%' . $fc . '%';
            $where[] = "(CONCAT(TRIM(IFNULL(client_first_name,'')),' ',TRIM(IFNULL(client_last_name,''))) LIKE ? OR CONCAT(TRIM(IFNULL(client_last_name,'')),' ',TRIM(IFNULL(client_first_name,''))) LIKE ?)";
            $types .= 'ss';
            $params[] = $like;
            $params[] = $like;
        }
        $fsc = isset($_GET['filter_service_code']) ? trim((string)$_GET['filter_service_code']) : '';
        if ($fsc !== '') {
            $where[] = 'service_code_with_modifiers LIKE ?';
            $types .= 's';
            $params[] = '%' . $fsc . '%';
        }
        $fdos = isset($_GET['filter_dos']) ? trim((string)$_GET['filter_dos']) : '';
        if ($fdos !== '') {
            $where[] = 'DATE(dos) = ?';
            $types .= 's';
            $params[] = $fdos;
        }
        $trackerStatus = isset($_GET['tracker_status']) ? trim((string)$_GET['tracker_status']) : '';
        if ($trackerStatus !== '') {
            $where[] = 'tracker_status = ?';
            $types .= 's';
            $params[] = reports_normalize_tracker_status($trackerStatus);
        }

        $sql = 'SELECT * FROM reports WHERE ' . implode(' AND ', $where) . ' ORDER BY dos DESC, id DESC';
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
            return;
        }
        $stmt->bind_param($types, ...$params);
    } else {
        $stmt = $conn->prepare('SELECT * FROM reports WHERE archived = ? ORDER BY id DESC');
        $stmt->bind_param('i', $archived);
    }

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $stmt->error]);
        return;
    }

    $result = $stmt->get_result();
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        if ($scheduleTracker) {
            reports_backfill_row_linked_ids_if_empty($conn, $row);
        }
        $row['billable']                    = (bool)$row['billable'];
        $row['staff_signature_on_file']     = (bool)$row['staff_signature_on_file'];
        $row['guardian_signature_on_file']  = (bool)$row['guardian_signature_on_file'];
        $row['make_up_session']             = (bool)$row['make_up_session'];
        $row['exclude_from_payroll']        = (bool)$row['exclude_from_payroll'];
        $row['exclude_from_mileage']        = (bool)$row['exclude_from_mileage'];
        $row['archived']                    = isset($row['archived']) ? (bool)$row['archived'] : false;
        if (isset($row['misc_hrs']) && $row['misc_hrs'] !== null) {
            $row['misc_hrs'] = (float)$row['misc_hrs'];
        }
        if (isset($row['duration_render_in_hrs']) && $row['duration_render_in_hrs'] !== null) {
            $row['duration_render_in_hrs'] = (float)$row['duration_render_in_hrs'];
        }
        $row['tracker_status'] = reports_normalize_tracker_status($row['tracker_status'] ?? null);
        $rows[] = $scheduleTracker
            ? reports_strip_excluded_fields_schedule_tracker($row)
            : reports_strip_excluded_fields($row);
    }

    echo json_encode(['success' => true, 'data' => $id ? ($rows[0] ?? null) : $rows]);
}

// ---------- POST (create single report or bulk from Excel) ----------
function handlePost($conn, $input)
{
    $scheduleTrackerImport = !empty($input['schedule_tracker']);
    if ($scheduleTrackerImport) {
        $items = isset($input['rows']) && is_array($input['rows']) ? $input['rows'] : [];
        $isBulk = count($items) > 0;
    } else {
        $isSingleReport = isset($input['id']) || (isset($input['client_first_name']) && !isset($input[0]));
        $items = $isSingleReport ? [$input] : (isset($input[0]) ? $input : [$input]);
        $isBulk = is_array($input) && isset($input[0]) && is_array($input[0]);
    }

    $pending = [];
    $lineNo = 0;
    foreach ($items as $row) {
        $lineNo++;
        $isExcelFormat = isset($row['Client First Name']) || isset($row['Billable']);

        if ($isExcelFormat) {
            $billable       = !empty($row['Billable']) && strtolower($row['Billable']) !== 'no' ? 1 : 0;
            $staffSig       = !empty($row['Staff Signature On File']) ? 1 : 0;
            $guardianSig    = !empty($row['Guardian Signature On File']) ? 1 : 0;
            $makeUp         = !empty($row['Make-Up Session']) && strtolower($row['Make-Up Session']) !== 'no' ? 1 : 0;
            $excludePayroll = !empty($row['Exclude From Payroll']) && strtolower($row['Exclude From Payroll']) !== 'no' ? 1 : 0;
            $excludeMileage = !empty($row['Exclude From Mileage']) && strtolower($row['Exclude From Mileage']) !== 'no' ? 1 : 0;
        } else {
            $billable       = !empty($row['billable']) ? (is_bool($row['billable']) ? ($row['billable'] ? 1 : 0) : (int)$row['billable']) : 0;
            $staffSig       = !empty($row['staff_signature_on_file']) ? (is_bool($row['staff_signature_on_file']) ? ($row['staff_signature_on_file'] ? 1 : 0) : (int)$row['staff_signature_on_file']) : 0;
            $guardianSig    = !empty($row['guardian_signature_on_file']) ? (is_bool($row['guardian_signature_on_file']) ? ($row['guardian_signature_on_file'] ? 1 : 0) : (int)$row['guardian_signature_on_file']) : 0;
            $makeUp         = !empty($row['make_up_session']) ? (is_bool($row['make_up_session']) ? ($row['make_up_session'] ? 1 : 0) : (int)$row['make_up_session']) : 0;
            $excludePayroll = !empty($row['exclude_from_payroll']) ? (is_bool($row['exclude_from_payroll']) ? ($row['exclude_from_payroll'] ? 1 : 0) : (int)$row['exclude_from_payroll']) : 0;
            $excludeMileage = !empty($row['exclude_from_mileage']) ? (is_bool($row['exclude_from_mileage']) ? ($row['exclude_from_mileage'] ? 1 : 0) : (int)$row['exclude_from_mileage']) : 0;
        }

        if ($isExcelFormat) {
            $dos              = excelSerialToDateTimeString($row['DOS'] ?? null, true);
            $aptStart         = excelSerialToDateTimeString($row['Apt Start Time'] ?? null, false);
            $aptStart         = reports_merge_dos_into_apt_start($dos, $aptStart);
            $aptEnd           = excelSerialToDateTimeString($row['Apt End Time'] ?? null, false);
            $renderedDate     = excelSerialToDateTimeString($row['Rendered Date'] ?? null, true);
            $renderedStart    = excelSerialToDateTimeString($row['Rendered Start Time'] ?? null, false);
            $renderedEnd      = excelSerialToDateTimeString($row['Rendered End Time'] ?? null, false);
            $createdDate      = excelSerialToDateTimeString($row['Created Date'] ?? null, false);
            $staffSignDate    = excelSerialToDateTimeString($row['Staff Sign Date'] ?? null, false);
            $guardianSignDate = excelSerialToDateTimeString($row['Guardian Sign Date'] ?? null, false);
            $miscRaw          = $row['Misc Hrs'] ?? $row['Misc hrs'] ?? null;
            $cf               = $row['Client First Name'] ?? '';
            $cl               = $row['Client Last Name'] ?? '';
            $sf               = $row['Staff First Name'] ?? '';
            $sl               = $row['Staff Last Name'] ?? '';
            $svc              = $row['Service Code With Modifiers'] ?? '';
        } else {
            $dos              = $row['dos'] ?? null;
            $aptStart         = $row['apt_start_time'] ?? null;
            $aptEnd           = $row['apt_end_time'] ?? null;
            $renderedDate     = $row['rendered_date'] ?? null;
            $renderedStart    = $row['rendered_start_time'] ?? null;
            $renderedEnd      = $row['rendered_end_time'] ?? null;
            $createdDate      = $row['created_date'] ?? null;
            $staffSignDate    = $row['staff_sign_date'] ?? null;
            $guardianSignDate = $row['guardian_sign_date'] ?? null;
            $miscRaw          = $row['misc_hrs'] ?? null;
            $cf               = $row['client_first_name'] ?? '';
            $cl               = $row['client_last_name'] ?? '';
            $sf               = $row['staff_first_name'] ?? '';
            $sl               = $row['staff_last_name'] ?? '';
            $svc              = $row['service_code_with_modifiers'] ?? '';
        }
        $miscHrs = ($miscRaw === '' || $miscRaw === null) ? null : $miscRaw;

        $fp = reports_dup_fingerprint_from_values($cf, $cl, $sf, $sl, $svc, $dos, $aptStart);

        $pending[] = [
            'line'             => $lineNo,
            'row'              => $row,
            'isExcelFormat'    => $isExcelFormat,
            'dos'              => $dos,
            'aptStart'         => $aptStart,
            'aptEnd'           => $aptEnd ?? null,
            'renderedDate'     => $renderedDate ?? null,
            'renderedStart'    => $renderedStart ?? null,
            'renderedEnd'      => $renderedEnd ?? null,
            'createdDate'      => $createdDate ?? null,
            'staffSignDate'    => $staffSignDate ?? null,
            'guardianSignDate' => $guardianSignDate ?? null,
            'miscHrs'          => $miscHrs,
            'billable'         => $billable,
            'staffSig'         => $staffSig,
            'guardianSig'      => $guardianSig,
            'makeUp'           => $makeUp,
            'excludePayroll'   => $excludePayroll,
            'excludeMileage'   => $excludeMileage,
            'cf'               => $cf,
            'cl'               => $cl,
            'sf'               => $sf,
            'sl'               => $sl,
            'svc'              => $svc,
            'fp'               => $fp,
            'trackerStatus'    => $scheduleTrackerImport ? 'Pending' : null,
        ];
    }

    // ---- Schedule Tracker import: no duplicate checks; all rows Pending ----
    if ($scheduleTrackerImport) {
        $warnings = ['duplicatesWithinFile' => [], 'duplicatesInDb' => []];
        $toInsertFinal = [];
        foreach ($pending as $p) {
            $p['trackerStatus'] = 'Pending';
            $p['_sql'] = reports_build_insert_sql($conn, $p);
            $p['_insertOk'] = true;
            $toInsertFinal[] = $p;
        }
    } else {
    // ---- Detect within-file duplicates by fingerprint ----
    $warnings   = ['duplicatesWithinFile' => [], 'duplicatesInDb' => []];
    $fpToLines  = [];
    foreach ($pending as $p) {
        $fpToLines[$p['fp']][] = $p['line'];
    }

    // Keep only the first occurrence of each fingerprint within the file
    $toInsert     = [];
    $seenFps      = [];
    foreach ($pending as $p) {
        $isDupWithinFile = count($fpToLines[$p['fp']]) > 1;
        if ($isDupWithinFile) {
            if (!isset($seenFps[$p['fp']])) {
                // Record the warning once
                $warnings['duplicatesWithinFile'][] = [
                    'fingerprint' => $p['fp'],
                    'rowIndexes'  => $fpToLines[$p['fp']],
                ];
            }
            if (isset($seenFps[$p['fp']])) {
                // Skip all subsequent occurrences
                continue;
            }
        }
        $seenFps[$p['fp']] = true;
        $toInsert[] = $p;
    }

    // ---- Check DB for duplicates and build SQL ----
    // FIX: collect results into a new array so modifications are not lost (was missing &ref + _insertOk=false).
    $toInsertFinal = [];

    if ($isBulk && count($toInsert) <= 200) {
        foreach ($toInsert as $p) {
            $ids = reports_find_db_duplicate_ids(
                $conn,
                $p['cf'], $p['cl'], $p['sf'], $p['sl'],
                $p['svc'], $p['dos'], $p['aptStart']
            );
            if (!empty($ids)) {
                // Duplicate exists in DB — record warning and explicitly skip insertion
                $warnings['duplicatesInDb'][] = [
                    'fingerprint' => $p['fp'],
                    'rowIndexes'  => [$p['line']],
                    'existingIds' => $ids,
                ];
                $p['_insertOk'] = false; // FIX: must be explicitly set to false
            } else {
                $p['_sql']      = reports_build_insert_sql($conn, $p);
                $p['_insertOk'] = true;
            }
            $toInsertFinal[] = $p; // FIX: push modified copy back into final array
        }
    } else {
        // Single insert or >200 rows: no DB-duplicate check, just build SQL for all
        foreach ($toInsert as $p) {
            $p['_sql']      = reports_build_insert_sql($conn, $p);
            $p['_insertOk'] = true;
            $toInsertFinal[] = $p;
        }
    }
    }

    // ---- Execute inserts inside a transaction ----
    $conn->begin_transaction();
    try {
        foreach ($toInsertFinal as $p) {
            if (!empty($p['_insertOk'])) {
                if (!$conn->query($p['_sql'])) {
                    throw new Exception($conn->error);
                }
            }
        }
        $conn->commit();

        $out = ['success' => true, 'message' => 'Reports created'];
        if (!empty($warnings['duplicatesWithinFile']) || !empty($warnings['duplicatesInDb'])) {
            $out['warnings'] = $warnings;
        }
        echo json_encode($out);
    } catch (Exception $e) {
        $conn->rollback();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// ---------- PUT (update by id) ----------
function handlePut($conn, $input)
{
    if (!empty($input['bulk']) && !empty($input['ids']) && is_array($input['ids'])) {
        $ids = array_values(array_filter(array_map('intval', $input['ids']), static function ($id) {
            return $id > 0;
        }));
        if (count($ids) === 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ids array is required for bulk update']);
            return;
        }
        if (!array_key_exists('tracker_status', $input)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'tracker_status is required for bulk update']);
            return;
        }
        $status = reports_normalize_tracker_status($input['tracker_status']);
        if (!in_array($status, reports_tracker_status_allowed(), true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid tracker_status']);
            return;
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql = "UPDATE reports SET tracker_status = ? WHERE id IN ($placeholders)";
        $types = 's' . str_repeat('i', count($ids));
        $params = array_merge([$status], $ids);
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
            return;
        }
        $stmt->bind_param($types, ...$params);
        if ($stmt->execute()) {
            echo json_encode([
                'success' => true,
                'message' => 'Reports updated',
                'updated' => $stmt->affected_rows,
                'tracker_status' => $status,
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $stmt->error]);
        }
        return;
    }

    if (empty($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'id is required']);
        return;
    }
    $id = (int)$input['id'];

    $allowed = [
        "client_id","provider_id",
        "client_first_name","client_last_name","client_middle_name",
        "staff_first_name","staff_last_name","staff_middle_name",
        "name_of_rbt_supervised",
        "payer","activity_type","location_code","authorization_number",
        "service_code_with_modifiers",
        "dos","apt_start_time","apt_end_time",
        "duration_schedule_in_min","duration_schedule_in_hrs",
        "rendered_date","rendered_start_time","rendered_end_time",
        "duration_render_in_min",
        "session_completion_latency_hrs",
        "address","status","non_billable_notes","billable",
        "office",
        "rendering_provider_first_name","rendering_provider_last_name",
        "rendering_provider_middlename",
        "created_by","created_date",
        "notes",
        "staff_signature_on_file","staff_sign_date","approx_location_staff_sign",
        "guardian_signature_on_file","guardian_sign_date","approx_location_guardian_sign",
        "direct_or_indirect_service",
        "make_up_session","make_up_session_hours",
        "exclude_from_payroll","exclude_from_mileage",
        "archived",
        "misc_hrs",
        "tracker_status"
    ];

    $fields = [];
    $params = [];
    $types  = "";

    foreach ($allowed as $col) {
        if (array_key_exists($col, $input)) {
            $fields[] = "$col = ?";
            $val = $input[$col];

            if (in_array($col, [
                "billable","staff_signature_on_file","guardian_signature_on_file",
                "make_up_session","exclude_from_payroll","exclude_from_mileage",
                "archived"
            ], true)) {
                $types .= "i";
                $params[] = $val ? 1 : 0;
            } else {
                $types .= "s";
                if ($col === 'tracker_status') {
                    $val = reports_normalize_tracker_status($val);
                }
                $params[] = $val;
            }
        }
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No fields to update']);
        return;
    }

    $sql = "UPDATE reports SET " . implode(", ", $fields) . " WHERE id = ?";
    $types .= "i";
    $params[] = $id;

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Report updated']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $stmt->error]);
    }
}

// ---------- DELETE (soft delete by id - set archived = 1) ----------
function handleDelete($conn, $input)
{
    if (empty($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'id is required']);
        return;
    }
    $id = (int)$input['id'];
    $archived = isset($input['archived']) ? (int)$input['archived'] : 1;

    // Soft delete: set archived flag instead of actually deleting
    $stmt = $conn->prepare("UPDATE reports SET archived = ? WHERE id = ?");
    $stmt->bind_param("ii", $archived, $id);

    if ($stmt->execute()) {
        $message = $archived ? 'Report archived' : 'Report restored';
        echo json_encode(['success' => true, 'message' => $message]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $stmt->error]);
    }
}
?>
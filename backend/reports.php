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
$user = getAuthenticatedUser();
if ($user && !rbac_user_has_permission_key($user['role'], 'reports.read', 'mahaverse')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Permission denied']);
    exit;
}

// DB connection
$host = "db5018266079.hosting-data.io";
$user = "dbu3321929";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14484433";

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

    // Excel 1900 date system: serial 1 = 1899-12-31; adjust for Unix epoch [web:176][web:198]
    $base = 25569;
    $seconds = ($serial - $base) * 86400;
    $format = $dateOnly ? "Y-m-d" : "Y-m-d H:i:s";
    return gmdate($format, (int)$seconds);
}

function sqlValue($conn, $value) {
    if ($value === null || $value === '') return "NULL";
    return "'" . $conn->real_escape_string($value) . "'";
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

    if ($id) {
        $stmt = $conn->prepare("SELECT * FROM reports WHERE id = ?");
        $stmt->bind_param("i", $id);
    } else {
        // Filter by archived status
        $stmt = $conn->prepare("SELECT * FROM reports WHERE archived = ? ORDER BY id DESC");
        $stmt->bind_param("i", $archived);
    }

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $conn->error]);
        return;
    }

    $result = $stmt->get_result();
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $row['billable']                    = (bool)$row['billable'];
        $row['staff_signature_on_file']     = (bool)$row['staff_signature_on_file'];
        $row['guardian_signature_on_file']  = (bool)$row['guardian_signature_on_file'];
        $row['make_up_session']             = (bool)$row['make_up_session'];
        $row['exclude_from_payroll']        = (bool)$row['exclude_from_payroll'];
        $row['exclude_from_mileage']        = (bool)$row['exclude_from_mileage'];
        $row['archived']                    = isset($row['archived']) ? (bool)$row['archived'] : false;
        $rows[] = $row;
    }

    echo json_encode(['success' => true, 'data' => $id ? ($rows[0] ?? null) : $rows]);
}

// ---------- POST (create single report or bulk from Excel) ----------
function handlePost($conn, $input)
{
    // Check if this is a single report (has 'id' field) or bulk Excel import
    $isSingleReport = isset($input['id']) || (isset($input['client_first_name']) && !isset($input[0]));
    $items = $isSingleReport ? [$input] : (isset($input[0]) ? $input : [$input]);

    $conn->begin_transaction();
    try {
        foreach ($items as $row) {
            // Check if this is Excel format (has capitalized keys) or form format (snake_case)
            $isExcelFormat = isset($row['Client First Name']) || isset($row['Billable']);
            
            // Handle booleans - support both Excel text format and boolean values
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

            // Handle dates - convert Excel serials or use direct values
            if ($isExcelFormat) {
                $dos              = excelSerialToDateTimeString($row['DOS'] ?? null, true);
                $aptStart         = excelSerialToDateTimeString($row['Apt Start Time'] ?? null, false);
                $aptEnd           = excelSerialToDateTimeString($row['Apt End Time'] ?? null, false);
                $renderedDate     = excelSerialToDateTimeString($row['Rendered Date'] ?? null, true);
                $renderedStart    = excelSerialToDateTimeString($row['Rendered Start Time'] ?? null, false);
                $renderedEnd      = excelSerialToDateTimeString($row['Rendered End Time'] ?? null, false);
                $createdDate      = excelSerialToDateTimeString($row['Created Date'] ?? null, false);
                $staffSignDate    = excelSerialToDateTimeString($row['Staff Sign Date'] ?? null, false);
                $guardianSignDate = excelSerialToDateTimeString($row['Guardian Sign Date'] ?? null, false);
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
            }

            $sql = "
                INSERT INTO reports (
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
                    archived
                ) VALUES (
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

                    " . sqlValue($conn, $dos) . ",
                    " . sqlValue($conn, $aptStart) . ",
                    " . sqlValue($conn, $aptEnd) . ",
                    " . sqlValue($conn, $isExcelFormat ? ($row['Duration Schedule In Min'] ?? null) : ($row['duration_schedule_in_min'] ?? null)) . ",
                    " . sqlValue($conn, $isExcelFormat ? ($row['Duration Schedule In Hrs'] ?? null) : ($row['duration_schedule_in_hrs'] ?? null)) . ",

                    " . sqlValue($conn, $renderedDate) . ",
                    " . sqlValue($conn, $renderedStart) . ",
                    " . sqlValue($conn, $renderedEnd) . ",
                    " . sqlValue($conn, $isExcelFormat ? ($row['Duration Render in Min'] ?? null) : ($row['duration_render_in_min'] ?? null)) . ",
                    " . sqlValue($conn, $isExcelFormat ? ($row['Duration Render in Hrs'] ?? null) : ($row['duration_render_in_hrs'] ?? null)) . ",

                    " . sqlValue($conn, $isExcelFormat ? ($row['Session Completion Latency in Hrs'] ?? null) : ($row['session_completion_latency_hrs'] ?? null)) . ",

                    " . sqlValue($conn, $isExcelFormat ? ($row['Address'] ?? null) : ($row['address'] ?? null)) . ",
                    " . sqlValue($conn, $isExcelFormat ? ($row['Status'] ?? null) : ($row['status'] ?? null)) . ",
                    " . sqlValue($conn, $isExcelFormat ? ($row['Non-Billable Notes'] ?? null) : ($row['non_billable_notes'] ?? null)) . ",
                    $billable,

                    " . sqlValue($conn, $isExcelFormat ? ($row['Office'] ?? null) : ($row['office'] ?? null)) . ",

                    " . sqlValue($conn, $isExcelFormat ? ($row['Rendering Provider First Name'] ?? null) : ($row['rendering_provider_first_name'] ?? null)) . ",
                    " . sqlValue($conn, $isExcelFormat ? ($row['Rendering Provider Last Name'] ?? null) : ($row['rendering_provider_last_name'] ?? null)) . ",
                    " . sqlValue($conn, $isExcelFormat ? ($row['Rendering Provider MiddleName'] ?? null) : ($row['rendering_provider_middlename'] ?? null)) . ",

                    " . sqlValue($conn, $isExcelFormat ? ($row['Created By'] ?? null) : ($row['created_by'] ?? null)) . ",
                    " . sqlValue($conn, $createdDate) . ",

                    " . sqlValue($conn, $isExcelFormat ? ($row['Notes'] ?? null) : ($row['notes'] ?? null)) . ",

                    $staffSig,
                    " . sqlValue($conn, $staffSignDate) . ",
                    " . sqlValue($conn, $isExcelFormat ? ($row['Approx. location of Staff Sign'] ?? null) : ($row['approx_location_staff_sign'] ?? null)) . ",

                    $guardianSig,
                    " . sqlValue($conn, $guardianSignDate) . ",
                    " . sqlValue($conn, $isExcelFormat ? ($row['Approx. location of Guardian Sign'] ?? null) : ($row['approx_location_guardian_sign'] ?? null)) . ",

                    " . sqlValue($conn, $isExcelFormat ? ($row['DIRECT or INDIRECT Service'] ?? null) : ($row['direct_or_indirect_service'] ?? null)) . ",

                    $makeUp,
                    " . sqlValue($conn, $isExcelFormat ? ($row['Make-Up Session Hours'] ?? null) : ($row['make_up_session_hours'] ?? null)) . ",

                    $excludePayroll,
                    $excludeMileage,
                    0
                )
            ";

            if (!$conn->query($sql)) {
                throw new Exception($conn->error);
            }
        }

        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Reports created']);
    } catch (Exception $e) {
        $conn->rollback();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// ---------- PUT (update by id – same as before) ----------
function handlePut($conn, $input)
{
    if (empty($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'id is required']);
        return;
    }
    $id = (int)$input['id'];

    $allowed = [
        "client_first_name","client_last_name","client_middle_name",
        "staff_first_name","staff_last_name","staff_middle_name",
        "name_of_rbt_supervised",
        "payer","activity_type","location_code","authorization_number",
        "service_code_with_modifiers",
        "dos","apt_start_time","apt_end_time",
        "duration_schedule_in_min","duration_schedule_in_hrs",
        "rendered_date","rendered_start_time","rendered_end_time",
        "duration_render_in_min","duration_render_in_hrs",
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
        "archived"
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

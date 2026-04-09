<?php
// CORS + JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
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

    if ($id) {
        $stmt = $conn->prepare("SELECT * FROM reports WHERE id = ?");
        $stmt->bind_param("i", $id);
    } else {
        $stmt = $conn->prepare("SELECT * FROM reports ORDER BY id DESC");
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
        $rows[] = $row;
    }

    echo json_encode(['success' => true, 'data' => $id ? ($rows[0] ?? null) : $rows]);
}

// ---------- POST (bulk create from Excel) ----------
function handlePost($conn, $input)
{
    $items = isset($input[0]) ? $input : [$input];

    $conn->begin_transaction();
    try {
        foreach ($items as $row) {
            // booleans from Excel text
            $billable       = !empty($row['Billable']) && strtolower($row['Billable']) !== 'no' ? 1 : 0;
            $staffSig       = !empty($row['Staff Signature On File']) ? 1 : 0;
            $guardianSig    = !empty($row['Guardian Signature On File']) ? 1 : 0;
            $makeUp         = !empty($row['Make-Up Session']) && strtolower($row['Make-Up Session']) !== 'no' ? 1 : 0;
            $excludePayroll = !empty($row['Exclude From Payroll']) && strtolower($row['Exclude From Payroll']) !== 'no' ? 1 : 0;
            $excludeMileage = !empty($row['Exclude From Mileage']) && strtolower($row['Exclude From Mileage']) !== 'no' ? 1 : 0;

            // convert Excel serials where needed
            $dos              = excelSerialToDateTimeString($row['DOS'] ?? null, true);
            $aptStart         = excelSerialToDateTimeString($row['Apt Start Time'] ?? null, false);
            $aptEnd           = excelSerialToDateTimeString($row['Apt End Time'] ?? null, false);
            $renderedDate     = excelSerialToDateTimeString($row['Rendered Date'] ?? null, true);
            $renderedStart    = excelSerialToDateTimeString($row['Rendered Start Time'] ?? null, false);
            $renderedEnd      = excelSerialToDateTimeString($row['Rendered End Time'] ?? null, false);
            $createdDate      = excelSerialToDateTimeString($row['Created Date'] ?? null, false);
            $staffSignDate    = excelSerialToDateTimeString($row['Staff Sign Date'] ?? null, false);
            $guardianSignDate = excelSerialToDateTimeString($row['Guardian Sign Date'] ?? null, false);

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
                    exclude_from_payroll, exclude_from_mileage
                ) VALUES (
                    " . sqlValue($conn, $row['Client First Name'] ?? null) . ",
                    " . sqlValue($conn, $row['Client Last Name'] ?? null) . ",
                    " . sqlValue($conn, $row['Client Middle Name'] ?? null) . ",

                    " . sqlValue($conn, $row['Staff First Name'] ?? null) . ",
                    " . sqlValue($conn, $row['Staff Last Name'] ?? null) . ",
                    " . sqlValue($conn, $row['Staff Middle Name'] ?? null) . ",

                    " . sqlValue($conn, $row['Name of RBT Supervised'] ?? null) . ",

                    " . sqlValue($conn, $row['Payer'] ?? null) . ",
                    " . sqlValue($conn, $row['Activity Type'] ?? null) . ",
                    " . sqlValue($conn, $row['Location Code'] ?? null) . ",
                    " . sqlValue($conn, $row['Authorization Number'] ?? null) . ",
                    " . sqlValue($conn, $row['Service Code With Modifiers'] ?? null) . ",

                    " . sqlValue($conn, $dos) . ",
                    " . sqlValue($conn, $aptStart) . ",
                    " . sqlValue($conn, $aptEnd) . ",
                    " . sqlValue($conn, $row['Duration Schedule In Min'] ?? null) . ",
                    " . sqlValue($conn, $row['Duration Schedule In Hrs'] ?? null) . ",

                    " . sqlValue($conn, $renderedDate) . ",
                    " . sqlValue($conn, $renderedStart) . ",
                    " . sqlValue($conn, $renderedEnd) . ",
                    " . sqlValue($conn, $row['Duration Render in Min'] ?? null) . ",
                    " . sqlValue($conn, $row['Duration Render in Hrs'] ?? null) . ",

                    " . sqlValue($conn, $row['Session Completion Latency in Hrs'] ?? null) . ",

                    " . sqlValue($conn, $row['Address'] ?? null) . ",
                    " . sqlValue($conn, $row['Status'] ?? null) . ",
                    " . sqlValue($conn, $row['Non-Billable Notes'] ?? null) . ",
                    $billable,

                    " . sqlValue($conn, $row['Office'] ?? null) . ",

                    " . sqlValue($conn, $row['Rendering Provider First Name'] ?? null) . ",
                    " . sqlValue($conn, $row['Rendering Provider Last Name'] ?? null) . ",
                    " . sqlValue($conn, $row['Rendering Provider MiddleName'] ?? null) . ",

                    " . sqlValue($conn, $row['Created By'] ?? null) . ",
                    " . sqlValue($conn, $createdDate) . ",

                    " . sqlValue($conn, $row['Notes'] ?? null) . ",

                    $staffSig,
                    " . sqlValue($conn, $staffSignDate) . ",
                    " . sqlValue($conn, $row['Approx. location of Staff Sign'] ?? null) . ",

                    $guardianSig,
                    " . sqlValue($conn, $guardianSignDate) . ",
                    " . sqlValue($conn, $row['Approx. location of Guardian Sign'] ?? null) . ",

                    " . sqlValue($conn, $row['DIRECT or INDIRECT Service'] ?? null) . ",

                    $makeUp,
                    " . sqlValue($conn, $row['Make-Up Session Hours'] ?? null) . ",

                    $excludePayroll,
                    $excludeMileage
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
        "exclude_from_payroll","exclude_from_mileage"
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
                "make_up_session","exclude_from_payroll","exclude_from_mileage"
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

// ---------- DELETE (by id) ----------
function handleDelete($conn, $input)
{
    if (empty($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'id is required']);
        return;
    }
    $id = (int)$input['id'];

    $stmt = $conn->prepare("DELETE FROM reports WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Report deleted']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $stmt->error]);
    }
}
?>

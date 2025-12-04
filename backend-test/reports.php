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

// Route
try {
    switch ($method) {
        case 'GET':
            handleGet($conn);
            break;
        case 'POST':
            handlePost($conn, $input);   // create
            break;
        case 'PUT':
            handlePut($conn, $input);    // update
            break;
        case 'DELETE':
            handleDelete($conn, $input); // delete
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
        // cast tinyint(1) to booleans for JSON
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

// ---------- POST (create one or many) ----------
function handlePost($conn, $input)
{
    // allow array of rows or single row
    $items = isset($input[0]) ? $input : [$input];

    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("
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
                ?,?,?,?,?,?,
                ?,
                ?,?,?,?,
                ?,
                ?,?,?,?,
                ?,
                ?,?,?,
                ?,?,
                ?,
                ?,?,?,?,
                ?,
                ?,?,
                ?,
                ?,?,
                ?,
                ?,?,
                ?,
                ?,?,
                ?,?
            )
        ");

        foreach ($items as $row) {
            $billable                   = !empty($row['Billable']) ? 1 : 0;
            $staffSig                   = !empty($row['Staff Signature On File']) ? 1 : 0;
            $guardianSig                = !empty($row['Guardian Signature On File']) ? 1 : 0;
            $makeUp                     = !empty($row['Make-Up Session']) ? 1 : 0;
            $excludePayroll             = !empty($row['Exclude From Payroll']) ? 1 : 0;
            $excludeMileage             = !empty($row['Exclude From Mileage']) ? 1 : 0;

            $stmt->bind_param(
                "ssssssssssssssidsdidsdssisssssssssissssisssii",
                $row['Client First Name'],
                $row['Client Last Name'],
                $row['Client Middle Name'],
                $row['Staff First Name'],
                $row['Staff Last Name'],
                $row['Staff Middle Name'],

                $row['Name of RBT Supervised'],

                $row['Payer'],
                $row['Activity Type'],
                $row['Location Code'],
                $row['Authorization Number'],
                $row['Service Code With Modifiers'],

                $row['DOS'],
                $row['Apt Start Time'],
                $row['Apt End Time'],
                $row['Duration Schedule In Min'],
                $row['Duration Schedule In Hrs'],

                $row['Rendered Date'],
                $row['Rendered Start Time'],
                $row['Rendered End Time'],
                $row['Duration Render in Min'],
                $row['Duration Render in Hrs'],

                $row['Session Completion Latency in Hrs'],

                $row['Address'],
                $row['Status'],
                $row['Non-Billable Notes'],
                $billable,

                $row['Office'],

                $row['Rendering Provider First Name'],
                $row['Rendering Provider Last Name'],
                $row['Rendering Provider MiddleName'],

                $row['Created By'],
                $row['Created Date'],

                $row['Notes'],

                $staffSig,
                $row['Staff Sign Date'],
                $row['Approx. location of Staff Sign'],

                $guardianSig,
                $row['Guardian Sign Date'],
                $row['Approx. location of Guardian Sign'],

                $row['DIRECT or INDIRECT Service'],

                $makeUp,
                $row['Make-Up Session Hours'],

                $excludePayroll,
                $excludeMileage
            );
            if (!$stmt->execute()) {
                throw new Exception($stmt->error);
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

// ---------- PUT (update by id) ----------
function handlePut($conn, $input)
{
    if (empty($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'id is required']);
        return;
    }
    $id = (int)$input['id'];

    // Simple dynamic update: only fields provided will be updated
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

            // Booleans
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

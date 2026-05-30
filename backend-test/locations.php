<?php
// Locations master data API (CRUD)

require_once __DIR__ . '/db.php'; // sets headers and $conn

// Handle OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$conn->set_charset('utf8mb4');

function generateId()
{
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff)
    );
}

function handleGetLocations($conn)
{
    $id = $_GET['id'] ?? null;
    $showArchived = isset($_GET['showArchived']) && $_GET['showArchived'] === 'true';

    $sql = "SELECT * FROM locations";
    if ($id) {
        $sql .= " WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("s", $id);
    } else {
        $sql .= " WHERE archived = ?";
        $archived = $showArchived ? 1 : 0;
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $archived);
    }

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch locations']);
        return;
    }

    $result = $stmt->get_result();
    $locations = [];
    while ($row = $result->fetch_assoc()) {
        $locations[] = $row;
    }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $locations]);
}

function handlePostLocation($conn, $input)
{
    $required = ['tax_id_professional', 'office_phone_number', 'location_name', 'facility_type', 
                 'facility_npi_number', 'facility_name', 'facility_address', 'facility_country',
                 'facility_city', 'facility_state', 'facility_zip_code', 'taxonomy_code'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || trim($input[$field]) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
            return;
        }
    }

    $id = generateId();
    $tax_id_professional = $input['tax_id_professional'];
    $office_phone_number = $input['office_phone_number'];
    $office_phone_ext = $input['office_phone_ext'] ?? null;
    $time_zone = $input['time_zone'] ?? null;
    $start_time = $input['start_time'] ?? null;
    $end_time = $input['end_time'] ?? null;
    $location_name = $input['location_name'];
    $location_description = $input['location_description'] ?? null;
    $facility_type = $input['facility_type'];
    $facility_npi_number = $input['facility_npi_number'];
    $facility_name = $input['facility_name'];
    $facility_address = $input['facility_address'];
    $facility_apt_unit = $input['facility_apt_unit'] ?? null;
    $facility_country = $input['facility_country'];
    $facility_city = $input['facility_city'];
    $facility_state = $input['facility_state'];
    $facility_zip_code = $input['facility_zip_code'];
    $taxonomy_code = $input['taxonomy_code'];
    $billing_npi_number = $input['billing_npi_number'] ?? null;
    $billing_provider_name = $input['billing_provider_name'] ?? null;
    $billing_address = $input['billing_address'] ?? null;
    $billing_apt_unit = $input['billing_apt_unit'] ?? null;
    $billing_country = $input['billing_country'] ?? null;
    $billing_city = $input['billing_city'] ?? null;
    $billing_state = $input['billing_state'] ?? null;
    $billing_zip_code = $input['billing_zip_code'] ?? null;
    $status = $input['status'] ?? 'Active';

    $stmt = $conn->prepare("
        INSERT INTO locations (
            id, tax_id_professional, office_phone_number, office_phone_ext, time_zone,
            start_time, end_time, location_name, location_description,
            facility_type, facility_npi_number, facility_name, facility_address,
            facility_apt_unit, facility_country, facility_city, facility_state, facility_zip_code,
            taxonomy_code, billing_npi_number, billing_provider_name, billing_address,
            billing_apt_unit, billing_country, billing_city, billing_state, billing_zip_code,
            status, archived, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW()
        )
    ");

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement: ' . $conn->error]);
        return;
    }

    $stmt->bind_param(
        "ssssssssssssssssssssssssssss",
        $id,
        $tax_id_professional,
        $office_phone_number,
        $office_phone_ext,
        $time_zone,
        $start_time,
        $end_time,
        $location_name,
        $location_description,
        $facility_type,
        $facility_npi_number,
        $facility_name,
        $facility_address,
        $facility_apt_unit,
        $facility_country,
        $facility_city,
        $facility_state,
        $facility_zip_code,
        $taxonomy_code,
        $billing_npi_number,
        $billing_provider_name,
        $billing_address,
        $billing_apt_unit,
        $billing_country,
        $billing_city,
        $billing_state,
        $billing_zip_code,
        $status
    );

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create location: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Location created successfully', 'data' => ['id' => $id]]);
}

function handlePutLocation($conn, $input)
{
    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Location id is required']);
        return;
    }

    $id = $input['id'];
    $tax_id_professional = $input['tax_id_professional'] ?? null;
    $office_phone_number = $input['office_phone_number'] ?? null;
    $office_phone_ext = $input['office_phone_ext'] ?? null;
    $time_zone = $input['time_zone'] ?? null;
    $start_time = $input['start_time'] ?? null;
    $end_time = $input['end_time'] ?? null;
    $location_name = $input['location_name'] ?? null;
    $location_description = $input['location_description'] ?? null;
    $facility_type = $input['facility_type'] ?? null;
    $facility_npi_number = $input['facility_npi_number'] ?? null;
    $facility_name = $input['facility_name'] ?? null;
    $facility_address = $input['facility_address'] ?? null;
    $facility_apt_unit = $input['facility_apt_unit'] ?? null;
    $facility_country = $input['facility_country'] ?? null;
    $facility_city = $input['facility_city'] ?? null;
    $facility_state = $input['facility_state'] ?? null;
    $facility_zip_code = $input['facility_zip_code'] ?? null;
    $taxonomy_code = $input['taxonomy_code'] ?? null;
    $billing_npi_number = $input['billing_npi_number'] ?? null;
    $billing_provider_name = $input['billing_provider_name'] ?? null;
    $billing_address = $input['billing_address'] ?? null;
    $billing_apt_unit = $input['billing_apt_unit'] ?? null;
    $billing_country = $input['billing_country'] ?? null;
    $billing_city = $input['billing_city'] ?? null;
    $billing_state = $input['billing_state'] ?? null;
    $billing_zip_code = $input['billing_zip_code'] ?? null;
    $status = $input['status'] ?? null;

    $stmt = $conn->prepare("
        UPDATE locations
        SET tax_id_professional = COALESCE(?, tax_id_professional),
            office_phone_number = COALESCE(?, office_phone_number),
            office_phone_ext = ?,
            time_zone = ?,
            start_time = ?,
            end_time = ?,
            location_name = COALESCE(?, location_name),
            location_description = ?,
            facility_type = COALESCE(?, facility_type),
            facility_npi_number = COALESCE(?, facility_npi_number),
            facility_name = COALESCE(?, facility_name),
            facility_address = COALESCE(?, facility_address),
            facility_apt_unit = ?,
            facility_country = COALESCE(?, facility_country),
            facility_city = COALESCE(?, facility_city),
            facility_state = COALESCE(?, facility_state),
            facility_zip_code = COALESCE(?, facility_zip_code),
            taxonomy_code = COALESCE(?, taxonomy_code),
            billing_npi_number = ?,
            billing_provider_name = ?,
            billing_address = ?,
            billing_apt_unit = ?,
            billing_country = ?,
            billing_city = ?,
            billing_state = ?,
            billing_zip_code = ?,
            status = COALESCE(?, status),
            updated_at = NOW()
        WHERE id = ?
    ");

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement: ' . $conn->error]);
        return;
    }

    // 28 placeholders: 27 SET columns + WHERE id (must match types count exactly).
    $stmt->bind_param(
        str_repeat("s", 28),
        $tax_id_professional,
        $office_phone_number,
        $office_phone_ext,
        $time_zone,
        $start_time,
        $end_time,
        $location_name,
        $location_description,
        $facility_type,
        $facility_npi_number,
        $facility_name,
        $facility_address,
        $facility_apt_unit,
        $facility_country,
        $facility_city,
        $facility_state,
        $facility_zip_code,
        $taxonomy_code,
        $billing_npi_number,
        $billing_provider_name,
        $billing_address,
        $billing_apt_unit,
        $billing_country,
        $billing_city,
        $billing_state,
        $billing_zip_code,
        $status,
        $id
    );

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to update location: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Location updated successfully']);
}

function handleDeleteLocation($conn, $input)
{
    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Location id is required']);
        return;
    }

    $id = $input['id'];
    $stmt = $conn->prepare("UPDATE locations SET archived = 1, updated_at = NOW() WHERE id = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement']);
        return;
    }

    $stmt->bind_param("s", $id);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to archive location: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Location archived successfully']);
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method) {
    case 'GET':
        handleGetLocations($conn);
        break;
    case 'POST':
        handlePostLocation($conn, $input);
        break;
    case 'PUT':
        handlePutLocation($conn, $input);
        break;
    case 'DELETE':
        handleDeleteLocation($conn, $input);
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}

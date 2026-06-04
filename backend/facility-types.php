<?php
// Facility Types master data API (CRUD) - CMS Place of Service (POS) codes

require_once __DIR__ . '/db.php';


// Handle OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = requireAuthReadWrite('manage_data.read', 'manage_data.write', 'mahaverse');



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

function handleGetFacilityTypes($conn)
{
    $id = $_GET['id'] ?? null;
    $showArchived = isset($_GET['showArchived']) && $_GET['showArchived'] === 'true';
    $showInactive = isset($_GET['showInactive']) && $_GET['showInactive'] === 'true';
    $activeOnly = isset($_GET['activeOnly']) && $_GET['activeOnly'] === 'true';

    $sql = "SELECT * FROM master_facility_types";
    $conditions = [];
    $params = [];
    $types = "";

    if ($id) {
        $conditions[] = "id = ?";
        $params[] = $id;
        $types .= "s";
    } else {
        // Default: show only active and non-archived unless explicitly requested
        if (!$showArchived) {
            $conditions[] = "archived = ?";
            $params[] = 0;
            $types .= "i";
        }
        
        if ($activeOnly || (!$showInactive && !$showArchived)) {
            $conditions[] = "active = ?";
            $params[] = 1;
            $types .= "i";
        }
    }

    if (!empty($conditions)) {
        $sql .= " WHERE " . implode(" AND ", $conditions);
    }

    $sql .= " ORDER BY pos_code ASC";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement: ' . $conn->error]);
        return;
    }

    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch facility types']);
        $stmt->close();
        return;
    }

    $result = $stmt->get_result();
    $facilityTypes = [];
    while ($row = $result->fetch_assoc()) {
        $facilityTypes[] = $row;
    }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $facilityTypes]);
}

function handlePostFacilityType($conn, $input)
{
    $required = ['pos_code', 'facility_name'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || trim($input[$field]) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
            return;
        }
    }

    // Check if pos_code already exists
    $checkStmt = $conn->prepare("SELECT id FROM master_facility_types WHERE pos_code = ?");
    if ($checkStmt) {
        $checkStmt->bind_param("s", $input['pos_code']);
        $checkStmt->execute();
        $result = $checkStmt->get_result();
        if ($result->num_rows > 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'POS code already exists']);
            $checkStmt->close();
            return;
        }
        $checkStmt->close();
    }

    $id = generateId();
    $pos_code = $input['pos_code'];
    $facility_name = $input['facility_name'];
    $description = $input['description'] ?? null;
    $active = isset($input['active']) ? (int)$input['active'] : 1;

    $stmt = $conn->prepare("
        INSERT INTO master_facility_types (
            id, pos_code, facility_name, description, active
        ) VALUES (?, ?, ?, ?, ?)
    ");

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement: ' . $conn->error]);
        return;
    }

    $stmt->bind_param(
        "ssssi",
        $id,
        $pos_code,
        $facility_name,
        $description,
        $active
    );

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create facility type: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Facility type created successfully', 'data' => ['id' => $id]]);
}

function handlePutFacilityType($conn, $input)
{
    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Facility type id is required']);
        return;
    }

    $id = $input['id'];
    $pos_code = $input['pos_code'] ?? null;
    $facility_name = $input['facility_name'] ?? null;
    $description = $input['description'] ?? null;
    $active = isset($input['active']) ? (int)$input['active'] : null;

    // If pos_code is being updated, check for duplicates
    if ($pos_code) {
        $checkStmt = $conn->prepare("SELECT id FROM master_facility_types WHERE pos_code = ? AND id != ?");
        if ($checkStmt) {
            $checkStmt->bind_param("ss", $pos_code, $id);
            $checkStmt->execute();
            $result = $checkStmt->get_result();
            if ($result->num_rows > 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'POS code already exists']);
                $checkStmt->close();
                return;
            }
            $checkStmt->close();
        }
    }

    $updates = [];
    $params = [];
    $types = "";

    if ($pos_code !== null) {
        $updates[] = "pos_code = ?";
        $params[] = $pos_code;
        $types .= "s";
    }
    if ($facility_name !== null) {
        $updates[] = "facility_name = ?";
        $params[] = $facility_name;
        $types .= "s";
    }
    if ($description !== null) {
        $updates[] = "description = ?";
        $params[] = $description;
        $types .= "s";
    }
    if ($active !== null) {
        $updates[] = "active = ?";
        $params[] = $active;
        $types .= "i";
    }

    if (empty($updates)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No fields to update']);
        return;
    }

    $params[] = $id;
    $types .= "s";

    $sql = "UPDATE master_facility_types SET " . implode(", ", $updates) . " WHERE id = ?";
    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement: ' . $conn->error]);
        return;
    }

    $stmt->bind_param($types, ...$params);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to update facility type: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Facility type updated successfully']);
}

function handleDeleteFacilityType($conn, $input)
{
    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Facility type id is required']);
        return;
    }

    $id = $input['id'];
    $stmt = $conn->prepare("UPDATE master_facility_types SET archived = 1 WHERE id = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement: ' . $conn->error]);
        return;
    }

    $stmt->bind_param("s", $id);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to archive facility type: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Facility type archived successfully']);
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method) {
    case 'GET':
        handleGetFacilityTypes($conn);
        break;
    case 'POST':
        handlePostFacilityType($conn, $input);
        break;
    case 'PUT':
        handlePutFacilityType($conn, $input);
        break;
    case 'DELETE':
        handleDeleteFacilityType($conn, $input);
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}

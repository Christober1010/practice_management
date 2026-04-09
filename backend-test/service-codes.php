<?php
// Service Codes master data API (CRUD)

require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$conn->set_charset('utf8mb4');

function handleGetServiceCodes($conn)
{
    $id = $_GET['id'] ?? null;
    $showArchived = isset($_GET['showArchived']) && $_GET['showArchived'] === 'true';

    $sql = "SELECT * FROM master_service_code";
    if ($id) {
        $sql .= " WHERE code_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $id);
    } else {
        $sql .= " ORDER BY code ASC";
        $stmt = $conn->prepare($sql);
    }

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch service codes']);
        return;
    }

    $result = $stmt->get_result();
    $codes = [];
    while ($row = $result->fetch_assoc()) {
        $codes[] = $row;
    }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $codes]);
}

function handlePostServiceCode($conn, $input)
{
    $required = ['code', 'code_description'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || trim($input[$field]) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
            return;
        }
    }

    $code = trim($input['code']);
    $code_description = trim($input['code_description']);

    // Check for duplicate code
    $checkStmt = $conn->prepare("SELECT code_id FROM master_service_code WHERE code = ?");
    $checkStmt->bind_param("s", $code);
    $checkStmt->execute();
    if ($checkStmt->get_result()->num_rows > 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Service code already exists']);
        $checkStmt->close();
        return;
    }
    $checkStmt->close();

    $stmt = $conn->prepare("INSERT INTO master_service_code (code, code_description) VALUES (?, ?)");

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement']);
        return;
    }

    $stmt->bind_param("ss", $code, $code_description);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create service code: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $code_id = $conn->insert_id;
    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Service code created successfully', 'data' => ['code_id' => $code_id]]);
}

function handlePutServiceCode($conn, $input)
{
    if (!isset($input['code_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Service code_id is required']);
        return;
    }

    $code_id = $input['code_id'];
    $code = $input['code'] ?? null;
    $code_description = $input['code_description'] ?? null;

    if (!$code && !$code_description) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'At least one field must be provided for update']);
        return;
    }

    $updates = [];
    $params = [];
    $types = "";

    if ($code !== null) {
        $updates[] = "code = ?";
        $params[] = $code;
        $types .= "s";
    }

    if ($code_description !== null) {
        $updates[] = "code_description = ?";
        $params[] = $code_description;
        $types .= "s";
    }

    $params[] = $code_id;
    $types .= "i";

    $sql = "UPDATE master_service_code SET " . implode(", ", $updates) . " WHERE code_id = ?";
    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement']);
        return;
    }

    $stmt->bind_param($types, ...$params);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to update service code: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Service code updated successfully']);
}

function handleDeleteServiceCode($conn, $input)
{
    if (!isset($input['code_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Service code_id is required']);
        return;
    }

    $code_id = $input['code_id'];

    // Check if code is used in any mappings
    $checkStmt = $conn->prepare("SELECT COUNT(*) as count FROM master_assign_service_code WHERE code_id = ?");
    $checkStmt->bind_param("i", $code_id);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    $row = $result->fetch_assoc();
    $checkStmt->close();

    if ($row['count'] > 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Cannot delete service code: it is used in service code mappings']);
        return;
    }

    $stmt = $conn->prepare("DELETE FROM master_service_code WHERE code_id = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement']);
        return;
    }

    $stmt->bind_param("i", $code_id);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to delete service code: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Service code deleted successfully']);
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method) {
    case 'GET':
        handleGetServiceCodes($conn);
        break;
    case 'POST':
        handlePostServiceCode($conn, $input);
        break;
    case 'PUT':
        handlePutServiceCode($conn, $input);
        break;
    case 'DELETE':
        handleDeleteServiceCode($conn, $input);
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}


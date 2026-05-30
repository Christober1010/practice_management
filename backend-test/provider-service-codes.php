<?php
// Provider Service Code mapping API (CRUD)
// Maps providers to service codes with unit duration, unit type, rate, and status

require_once __DIR__ . '/db.php';

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

function handleGetProviderServiceCodes($conn)
{
    $id = $_GET['id'] ?? null;
    $provider_id = $_GET['provider_id'] ?? null;
    $showArchived = isset($_GET['showArchived']) && $_GET['showArchived'] === 'true';

    $sql = "SELECT 
                psc.*,
                p.provider_name,
                sc.code as service_code,
                sc.code_description
            FROM master_provider_service_code psc
            LEFT JOIN master_providers p ON psc.provider_id = p.id
            LEFT JOIN master_service_code sc ON psc.service_code_id = sc.code_id";

    $conditions = [];
    $params = [];
    $types = "";

    if ($id) {
        $conditions[] = "psc.id = ?";
        $params[] = $id;
        $types .= "s";
    } else {
        $conditions[] = "psc.archived = ?";
        $archived = $showArchived ? 1 : 0;
        $params[] = $archived;
        $types .= "i";
    }

    if ($provider_id) {
        $conditions[] = "psc.provider_id = ?";
        $params[] = $provider_id;
        $types .= "s";
    }

    if (!empty($conditions)) {
        $sql .= " WHERE " . implode(" AND ", $conditions);
    }

    $sql .= " ORDER BY p.provider_name, sc.code";

    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch provider service codes']);
        return;
    }

    $result = $stmt->get_result();
    $mappings = [];
    while ($row = $result->fetch_assoc()) {
        $mappings[] = $row;
    }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $mappings]);
}

function handlePostProviderServiceCode($conn, $input)
{
    $required = ['provider_id', 'service_code_id'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || trim($input[$field]) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
            return;
        }
    }

    $id = generateId();
    $provider_id = $input['provider_id'];
    $service_code_id = $input['service_code_id'];
    $unit_duration = $input['unit_duration'] ?? '15';
    $unit_type = $input['unit_type'] ?? 'Minute(s)';
    $rate = $input['rate'] ?? null;
    $status = $input['status'] ?? 'Active';

    // Check for duplicate mapping
    $checkStmt = $conn->prepare("SELECT id FROM master_provider_service_code WHERE provider_id = ? AND service_code_id = ? AND archived = 0");
    $checkStmt->bind_param("si", $provider_id, $service_code_id);
    $checkStmt->execute();
    if ($checkStmt->get_result()->num_rows > 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'This provider-service code mapping already exists']);
        $checkStmt->close();
        return;
    }
    $checkStmt->close();

    $stmt = $conn->prepare("
        INSERT INTO master_provider_service_code (
            id, provider_id, service_code_id, unit_duration, unit_type, rate, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement']);
        return;
    }

    $stmt->bind_param("ssisdss", $id, $provider_id, $service_code_id, $unit_duration, $unit_type, $rate, $status);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create provider service code: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Provider service code mapping created successfully', 'data' => ['id' => $id]]);
}

function handlePutProviderServiceCode($conn, $input)
{
    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Provider service code id is required']);
        return;
    }

    $id = $input['id'];
    $unit_duration = $input['unit_duration'] ?? null;
    $unit_type = $input['unit_type'] ?? null;
    $rate = $input['rate'] ?? null;
    $status = $input['status'] ?? null;

    $updates = [];
    $params = [];
    $types = "";

    if ($unit_duration !== null) {
        $updates[] = "unit_duration = ?";
        $params[] = $unit_duration;
        $types .= "s";
    }

    if ($unit_type !== null) {
        $updates[] = "unit_type = ?";
        $params[] = $unit_type;
        $types .= "s";
    }

    if ($rate !== null) {
        $updates[] = "rate = ?";
        $params[] = $rate;
        $types .= "d";
    }

    if ($status !== null) {
        $updates[] = "status = ?";
        $params[] = $status;
        $types .= "s";
    }

    if (empty($updates)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'At least one field must be provided for update']);
        return;
    }

    $params[] = $id;
    $types .= "s";

    $sql = "UPDATE master_provider_service_code SET " . implode(", ", $updates) . " WHERE id = ?";
    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement']);
        return;
    }

    $stmt->bind_param($types, ...$params);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to update provider service code: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Provider service code updated successfully']);
}

function handleDeleteProviderServiceCode($conn, $input)
{
    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Provider service code id is required']);
        return;
    }

    $id = $input['id'];
    $stmt = $conn->prepare("UPDATE master_provider_service_code SET archived = 1 WHERE id = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement']);
        return;
    }

    $stmt->bind_param("s", $id);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to archive provider service code: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Provider service code archived successfully']);
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method) {
    case 'GET':
        handleGetProviderServiceCodes($conn);
        break;
    case 'POST':
        handlePostProviderServiceCode($conn, $input);
        break;
    case 'PUT':
        handlePutProviderServiceCode($conn, $input);
        break;
    case 'DELETE':
        handleDeleteProviderServiceCode($conn, $input);
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}


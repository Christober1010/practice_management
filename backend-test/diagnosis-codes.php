<?php
// Diagnosis Codes master data API (CRUD)

require_once __DIR__ . '/db.php';

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

function handleGetDiagnosisCodes($conn)
{
    $id = $_GET['id'] ?? null;
    $showArchived = isset($_GET['showArchived']) && $_GET['showArchived'] === 'true';

    $sql = "SELECT * FROM master_diagnosis";
    if ($id) {
        $sql .= " WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("s", $id);
    } else {
        $sql .= " WHERE archived = ? ORDER BY diagnosis_code ASC";
        $archived = $showArchived ? 1 : 0;
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $archived);
    }

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch diagnosis codes']);
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

function handlePostDiagnosisCode($conn, $input)
{
    $required = ['diagnosis_code', 'diagnosis_description'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || trim($input[$field]) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
            return;
        }
    }

    $id = generateId();
    $diagnosis_code = trim($input['diagnosis_code']);
    $diagnosis_description = trim($input['diagnosis_description']);

    // Check for duplicate code
    $checkStmt = $conn->prepare("SELECT id FROM master_diagnosis WHERE diagnosis_code = ? AND archived = 0");
    $checkStmt->bind_param("s", $diagnosis_code);
    $checkStmt->execute();
    if ($checkStmt->get_result()->num_rows > 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Diagnosis code already exists']);
        $checkStmt->close();
        return;
    }
    $checkStmt->close();

    $stmt = $conn->prepare("INSERT INTO master_diagnosis (id, diagnosis_code, diagnosis_description) VALUES (?, ?, ?)");

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement']);
        return;
    }

    $stmt->bind_param("sss", $id, $diagnosis_code, $diagnosis_description);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create diagnosis code: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Diagnosis code created successfully', 'data' => ['id' => $id]]);
}

function handlePutDiagnosisCode($conn, $input)
{
    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Diagnosis id is required']);
        return;
    }

    $id = $input['id'];
    $diagnosis_code = $input['diagnosis_code'] ?? null;
    $diagnosis_description = $input['diagnosis_description'] ?? null;

    if (!$diagnosis_code && !$diagnosis_description) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'At least one field must be provided for update']);
        return;
    }

    $updates = [];
    $params = [];
    $types = "";

    if ($diagnosis_code !== null) {
        $updates[] = "diagnosis_code = ?";
        $params[] = $diagnosis_code;
        $types .= "s";
    }

    if ($diagnosis_description !== null) {
        $updates[] = "diagnosis_description = ?";
        $params[] = $diagnosis_description;
        $types .= "s";
    }

    $params[] = $id;
    $types .= "s";

    $sql = "UPDATE master_diagnosis SET " . implode(", ", $updates) . " WHERE id = ?";
    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement']);
        return;
    }

    $stmt->bind_param($types, ...$params);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to update diagnosis code: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Diagnosis code updated successfully']);
}

function handleDeleteDiagnosisCode($conn, $input)
{
    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Diagnosis id is required']);
        return;
    }

    $id = $input['id'];
    $stmt = $conn->prepare("UPDATE master_diagnosis SET archived = 1 WHERE id = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement']);
        return;
    }

    $stmt->bind_param("s", $id);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to archive diagnosis code: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Diagnosis code archived successfully']);
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method) {
    case 'GET':
        handleGetDiagnosisCodes($conn);
        break;
    case 'POST':
        handlePostDiagnosisCode($conn, $input);
        break;
    case 'PUT':
        handlePutDiagnosisCode($conn, $input);
        break;
    case 'DELETE':
        handleDeleteDiagnosisCode($conn, $input);
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}


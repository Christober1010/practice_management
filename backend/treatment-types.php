<?php
// Treatment Types master data API (CRUD)

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
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function handleGet($conn)
{
    $id = $_GET['id'] ?? null;
    $showArchived = isset($_GET['showArchived']) && $_GET['showArchived'] === 'true';

    $sql = "SELECT * FROM master_treatment_types";
    $conditions = [];
    $params = [];
    $types = "";

    if ($id) {
        $conditions[] = "id = ?";
        $params[] = $id;
        $types .= "s";
    } else {
        if (!$showArchived) {
            $conditions[] = "archived = ?";
            $params[] = 0;
            $types .= "i";
        }
    }

    if (!empty($conditions)) {
        $sql .= " WHERE " . implode(" AND ", $conditions);
    }
    $sql .= " ORDER BY treatment_name ASC";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Prepare failed: ' . $conn->error]);
        return;
    }
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Execute failed']);
        $stmt->close();
        return;
    }
    $result = $stmt->get_result();
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    $stmt->close();
    echo json_encode(['success' => true, 'data' => $data]);
}

function handlePost($conn)
{
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['treatment_name'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'treatment_name is required']);
        return;
    }
    $id = generateId();
    $stmt = $conn->prepare("INSERT INTO master_treatment_types (id, treatment_name, description, active) VALUES (?, ?, ?, ?)");
    $active = isset($input['active']) ? (int)$input['active'] : 1;
    $desc = $input['description'] ?? '';
    $stmt->bind_param("sssi", $id, $input['treatment_name'], $desc, $active);
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Treatment type created', 'id' => $id]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Insert failed: ' . $stmt->error]);
    }
    $stmt->close();
}

function handlePut($conn)
{
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'id is required']);
        return;
    }
    $fields = [];
    $params = [];
    $types = "";
    foreach (['treatment_name' => 's', 'description' => 's', 'active' => 'i', 'archived' => 'i'] as $col => $t) {
        if (isset($input[$col])) {
            $fields[] = "$col = ?";
            $params[] = $input[$col];
            $types .= $t;
        }
    }
    if (empty($fields)) {
        echo json_encode(['success' => false, 'message' => 'No fields to update']);
        return;
    }
    $params[] = $input['id'];
    $types .= "s";
    $sql = "UPDATE master_treatment_types SET " . implode(", ", $fields) . " WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Treatment type updated']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Update failed: ' . $stmt->error]);
    }
    $stmt->close();
}

function handleDelete($conn)
{
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'id is required']);
        return;
    }
    $stmt = $conn->prepare("UPDATE master_treatment_types SET archived = 1 WHERE id = ?");
    $stmt->bind_param("s", $input['id']);
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Treatment type archived']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Archive failed: ' . $stmt->error]);
    }
    $stmt->close();
}

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':    handleGet($conn); break;
    case 'POST':   handlePost($conn); break;
    case 'PUT':    handlePut($conn); break;
    case 'DELETE': handleDelete($conn); break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}

<?php
/**
 * Maintenance Period master data API (CRUD).
 * Auto-creates master_maintenance_periods and seeds default frequencies.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';

$authUser = requireAuthReadWrite('master_data.read', 'master_data.write', 'mahaverse');

try {
    $conn = getDBConnection();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}

$conn->set_charset('utf8mb4');

function maintenance_periods_generate_id(): string
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

function maintenance_periods_ensure_table(mysqli $conn): void
{
    $conn->query("
        CREATE TABLE IF NOT EXISTS master_maintenance_periods (
            id VARCHAR(64) NOT NULL PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            active TINYINT(1) NOT NULL DEFAULT 1,
            archived TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_maintenance_period_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $countRes = $conn->query('SELECT COUNT(*) AS c FROM master_maintenance_periods');
    $count = 0;
    if ($countRes) {
        $row = $countRes->fetch_assoc();
        $count = (int)($row['c'] ?? 0);
        $countRes->free();
    }
    if ($count > 0) {
        return;
    }

    $defaults = [
        ['Daily', 10],
        ['Every Other Day', 20],
        ['Weekly', 30],
        ['Every Other Week', 40],
        ['Bi-Weekly', 50],
        ['Bi-Monthly', 60],
        ['Monthly', 70],
        ['Quarterly', 80],
        ['Annually', 90],
    ];
    $stmt = $conn->prepare(
        'INSERT INTO master_maintenance_periods (id, name, sort_order, active, archived) VALUES (?, ?, ?, 1, 0)'
    );
    if (!$stmt) {
        return;
    }
    foreach ($defaults as [$name, $order]) {
        $id = maintenance_periods_generate_id();
        $stmt->bind_param('ssi', $id, $name, $order);
        $stmt->execute();
    }
    $stmt->close();
}

maintenance_periods_ensure_table($conn);

function handleGetMaintenancePeriods(mysqli $conn): void
{
    $id = $_GET['id'] ?? null;
    $showArchived = isset($_GET['showArchived']) && $_GET['showArchived'] === 'true';
    $showInactive = isset($_GET['showInactive']) && $_GET['showInactive'] === 'true';
    $activeOnly = isset($_GET['activeOnly']) && $_GET['activeOnly'] === 'true';

    $sql = 'SELECT * FROM master_maintenance_periods';
    $conditions = [];
    $params = [];
    $types = '';

    if ($id) {
        $conditions[] = 'id = ?';
        $params[] = $id;
        $types .= 's';
    } else {
        if (!$showArchived) {
            $conditions[] = 'archived = ?';
            $params[] = 0;
            $types .= 'i';
        }
        if ($activeOnly || (!$showInactive && !$showArchived)) {
            $conditions[] = 'active = ?';
            $params[] = 1;
            $types .= 'i';
        }
    }

    if (!empty($conditions)) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }
    $sql .= ' ORDER BY sort_order ASC, name ASC';

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $conn->error]);
        return;
    }
    if ($types !== '') {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    $stmt->close();
    echo json_encode(['success' => true, 'data' => $rows]);
}

function handlePostMaintenancePeriod(mysqli $conn, array $input): void
{
    $name = trim((string)($input['name'] ?? ''));
    if ($name === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Name is required']);
        return;
    }
    $sortOrder = (int)($input['sort_order'] ?? 100);
    $active = !empty($input['active']) || !isset($input['active']) ? 1 : 0;
    $id = maintenance_periods_generate_id();

    $check = $conn->prepare('SELECT id FROM master_maintenance_periods WHERE name = ? AND archived = 0 LIMIT 1');
    if ($check) {
        $check->bind_param('s', $name);
        $check->execute();
        if ($check->get_result()->num_rows > 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Maintenance period name already exists']);
            $check->close();
            return;
        }
        $check->close();
    }

    $stmt = $conn->prepare(
        'INSERT INTO master_maintenance_periods (id, name, sort_order, active, archived) VALUES (?, ?, ?, ?, 0)'
    );
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $conn->error]);
        return;
    }
    $stmt->bind_param('ssii', $id, $name, $sortOrder, $active);
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $stmt->error]);
        $stmt->close();
        return;
    }
    $stmt->close();
    echo json_encode(['success' => true, 'id' => $id, 'message' => 'Maintenance period created']);
}

function handlePutMaintenancePeriod(mysqli $conn, array $input): void
{
    $id = trim((string)($input['id'] ?? ''));
    if ($id === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'id is required']);
        return;
    }
    $name = trim((string)($input['name'] ?? ''));
    if ($name === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Name is required']);
        return;
    }
    $sortOrder = (int)($input['sort_order'] ?? 100);
    $active = !empty($input['active']) ? 1 : 0;
    $archived = isset($input['archived']) ? (!empty($input['archived']) ? 1 : 0) : null;

    if ($archived !== null) {
        $stmt = $conn->prepare(
            'UPDATE master_maintenance_periods SET name = ?, sort_order = ?, active = ?, archived = ? WHERE id = ?'
        );
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
            return;
        }
        $stmt->bind_param('siiis', $name, $sortOrder, $active, $archived, $id);
    } else {
        $stmt = $conn->prepare(
            'UPDATE master_maintenance_periods SET name = ?, sort_order = ?, active = ? WHERE id = ?'
        );
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
            return;
        }
        $stmt->bind_param('siis', $name, $sortOrder, $active, $id);
    }

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $stmt->error]);
        $stmt->close();
        return;
    }
    $stmt->close();
    echo json_encode(['success' => true, 'message' => 'Maintenance period updated']);
}

function handleDeleteMaintenancePeriod(mysqli $conn, array $input): void
{
    $id = trim((string)($input['id'] ?? ''));
    if ($id === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'id is required']);
        return;
    }
    $stmt = $conn->prepare('UPDATE master_maintenance_periods SET archived = 1 WHERE id = ?');
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $conn->error]);
        return;
    }
    $stmt->bind_param('s', $id);
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $stmt->error]);
        $stmt->close();
        return;
    }
    $stmt->close();
    echo json_encode(['success' => true, 'message' => 'Maintenance period archived']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method) {
    case 'GET':
        handleGetMaintenancePeriods($conn);
        break;
    case 'POST':
        handlePostMaintenancePeriod($conn, $input);
        break;
    case 'PUT':
        handlePutMaintenancePeriod($conn, $input);
        break;
    case 'DELETE':
        handleDeleteMaintenancePeriod($conn, $input);
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}

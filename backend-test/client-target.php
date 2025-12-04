<?php
// DEBUG (remove or lower in production)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// CORS + content type
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// DB credentials
$host = "db5018419668.hosting-data.io";
$user = "dbu1183438";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14649042";

$conn = new mysqli($host, $user, $password, $database);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $conn->connect_error]);
    exit();
}

// --- Ensure connection uses utf8mb4 + unicode_ci ---
$conn->set_charset('utf8mb4');
$conn->query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'");
$conn->query("SET collation_connection = 'utf8mb4_unicode_ci'");

// Allow a lightweight diagnositic to find mismatched columns
// Usage: GET /client-target.php?diagnose=1
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['diagnose'])) {
    $db = $conn->real_escape_string($database);
    $sql = "
        SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = '$db'
          AND COLLATION_NAME IS NOT NULL
          AND COLLATION_NAME != 'utf8mb4_unicode_ci'
        ORDER BY TABLE_NAME, COLUMN_NAME
    ";
    $res = $conn->query($sql);
    $rows = [];
    if ($res) {
        while ($r = $res->fetch_assoc()) $rows[] = $r;
    }
    echo json_encode(['success' => true, 'mismatched_columns' => $rows]);
    $conn->close();
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet($conn);
        break;
    case 'POST':
        handlePost($conn);
        break;
    case 'PUT':
        handlePut($conn);
        break;
    case 'DELETE':
        handleDelete($conn);
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}

$conn->close();

/**
 * GET /client-target.php?client_id=...
 */
function handleGet($conn)
{
    $clientId = $_GET['client_id'] ?? null;

    if (!$clientId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Client ID is required']);
        return;
    }

    // Use prepared statement and explicit COLLATE on column side to avoid mix-of-collations
    $sql = "SELECT * FROM client_targets WHERE client_id COLLATE utf8mb4_unicode_ci = ? ORDER BY created_at DESC";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Prepare failed: ' . $conn->error]);
        return;
    }
    $stmt->bind_param('s', $clientId);
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Execute failed: ' . $stmt->error]);
        $stmt->close();
        return;
    }
    $res = $stmt->get_result();
    $targets = $res->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    echo json_encode(['success' => true, 'data' => ['targets' => $targets]]);
}

/**
 * POST /client-target.php
 * Accepts either { client_id, targets: [...] } or a single target object
 */
function handlePost($conn)
{
    $input = json_decode(file_get_contents('php://input'), true);

    if (isset($input['targets']) && is_array($input['targets'])) {
        $clientId = $input['client_id'] ?? null;
        $targets = $input['targets'];
    } else {
        $clientId = $input['client_id'] ?? null;
        $targets = [$input];
    }

    if (!$clientId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Client ID is required']);
        return;
    }

    // Prepared INSERT ... ON DUPLICATE KEY UPDATE
    $sql = "
        INSERT INTO client_targets
            (id, client_id, program_id, NAME, goal_description, trials, activity_type, instructions, STATUS, archived)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            program_id = VALUES(program_id),
            NAME = VALUES(NAME),
            goal_description = VALUES(goal_description),
            trials = VALUES(trials),
            activity_type = VALUES(activity_type),
            instructions = VALUES(instructions),
            STATUS = VALUES(STATUS),
            archived = VALUES(archived)
    ";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Prepare failed: ' . $conn->error]);
        return;
    }

    try {
        foreach ($targets as $target) {
            if (!isset($target['id'])) {
                throw new Exception("Target id is required");
            }

            $id = $target['id'];
            $programId = $target['program_id'] ?? '';
            $name = $target['name'] ?? '';
            $goalDescription = $target['description'] ?? '';
            $trials = (int)($target['trials'] ?? 1);
            $activityType = $target['activity_type'] ?? '';
            $instructions = $target['instructions'] ?? '';
            $status = $target['status'] ?? 'Active';
            $archived = (int)($target['archived'] ?? 0);

            // bind: id, client_id, program_id, name, goal_description, trials, activity_type, instructions, status, archived
            $bindTypes = "ssssis s s s i"; // human-readable helper (not used directly)
            // actual type string:
            $types = "sssssisssi"; // s,id; s,client_id; s,program_id; s,name; s,goalDesc; i,trials; s,activityType; s,instructions; s,status; i,archived
            $stmt->bind_param(
                $types,
                $id,
                $clientId,
                $programId,
                $name,
                $goalDescription,
                $trials,
                $activityType,
                $instructions,
                $status,
                $archived
            );

            if (!$stmt->execute()) {
                throw new Exception("Error saving target: " . $stmt->error);
            }
        }
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Targets saved successfully']);
    } catch (Exception $e) {
        if ($stmt) $stmt->close();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

/**
 * PUT /client-target.php
 * Supports:
 *  - simple archive toggle: { client_id, targetId, archived, status? }
 *  - full update: { client_id, targetId, program_id, name, description, activity_type, status, archived, trials, instructions }
 */
function handlePut($conn)
{
    $input = json_decode(file_get_contents('php://input'), true);
    $clientId = $input['client_id'] ?? null;

    if (!$clientId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Client ID is required']);
        return;
    }
    if (!isset($input['targetId'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Target ID is required']);
        return;
    }

    $targetId = $input['targetId'];

    // Simple archive/unarchive shortcut
    if (isset($input['archived']) && !isset($input['program_id']) && !isset($input['name'])) {
        $archived = (int)$input['archived'];
        $status = $input['status'] ?? ($archived ? 'Inactive' : 'Active');

        $sql = "UPDATE client_targets SET archived = ?, STATUS = ? WHERE id = ? AND client_id COLLATE utf8mb4_unicode_ci = ?";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Prepare failed: ' . $conn->error]);
            return;
        }
        $stmt->bind_param('isss', $archived, $status, $targetId, $clientId);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Target updated']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error updating target: ' . $stmt->error]);
        }
        $stmt->close();
        return;
    }

    // Full update
    $programId = $input['program_id'] ?? '';
    $name = $input['name'] ?? '';
    $goalDescription = $input['description'] ?? '';
    $activityType = $input['activity_type'] ?? '';
    $status = $input['status'] ?? 'Active';
    $archived = (int)($input['archived'] ?? 0);
    $trials = (int)($input['trials'] ?? 1);
    $instructions = $input['instructions'] ?? '';

    $sql = "
        UPDATE client_targets SET
            program_id = ?,
            NAME = ?,
            goal_description = ?,
            trials = ?,
            activity_type = ?,
            instructions = ?,
            STATUS = ?,
            archived = ?
        WHERE id = ? AND client_id COLLATE utf8mb4_unicode_ci = ?
    ";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Prepare failed: ' . $conn->error]);
        return;
    }

    $stmt->bind_param(
        'sssisssiss',
        $programId,
        $name,
        $goalDescription,
        $trials,
        $activityType,
        $instructions,
        $status,
        $archived,
        $targetId,
        $clientId
    );

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Target updated']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error updating target: ' . $stmt->error]);
    }
    $stmt->close();
}

/**
 * DELETE /client-target.php
 * Body: { client_id, targetId }
 */
function handleDelete($conn)
{
    $input = json_decode(file_get_contents('php://input'), true);
    $clientId = $input['client_id'] ?? null;
    $targetId = $input['targetId'] ?? null;

    if (!$clientId || !$targetId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Client ID and Target ID are required']);
        return;
    }

    $sql = "DELETE FROM client_targets WHERE id = ? AND client_id COLLATE utf8mb4_unicode_ci = ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Prepare failed: ' . $conn->error]);
        return;
    }
    $stmt->bind_param('ss', $targetId, $clientId);
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Target deleted']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error deleting target: ' . $stmt->error]);
    }
    $stmt->close();
}
?>

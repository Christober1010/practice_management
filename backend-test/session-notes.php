<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database credentials
$host = "db5018419668.hosting-data.io";
$user = "dbu1183438";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14649042";

function generateId() {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function ensureTrialTable($conn) {
    $tableCheck = $conn->query("SHOW TABLES LIKE 'client_session_notes'");
    return $tableCheck && $tableCheck->num_rows > 0;
}

function ensureSessionEntryTable($conn) {
    $sql = "CREATE TABLE IF NOT EXISTS client_session_note_entries (
        id VARCHAR(36) NOT NULL,
        client_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
        session_date DATE NOT NULL,
        session_id VARCHAR(36) DEFAULT NULL,
        payload LONGTEXT NOT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_client_session_date (client_id, session_date),
        KEY idx_session_id (session_id),
        CONSTRAINT fk_session_entry_client FOREIGN KEY (client_id) REFERENCES clients (client_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    if (!$conn->query($sql)) {
        throw new Exception("Failed to ensure client_session_note_entries table: " . $conn->error);
    }
}

function handleGetTrials($conn, $clientId, $targetId, $sessionDate) {
    if (!ensureTrialTable($conn)) {
        echo json_encode(['success' => true, 'data' => []]);
        return;
    }

    $stmt = $conn->prepare("
        SELECT id, client_id, target_id, session_date, trial_number, trial_outcome, notes, created_at
        FROM client_session_notes
        WHERE client_id = ? AND target_id = ? AND session_date = ?
        ORDER BY trial_number ASC
    ");
    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $conn->error);
    }

    $stmt->bind_param("sss", $clientId, $targetId, $sessionDate);
    $stmt->execute();
    $result = $stmt->get_result();

    $trials = [];
    while ($row = $result->fetch_assoc()) {
        $trials[] = [
            'id' => $row['id'],
            'client_id' => $row['client_id'],
            'target_id' => $row['target_id'],
            'session_date' => $row['session_date'],
            'trial_number' => (int)$row['trial_number'],
            'trial_outcome' => $row['trial_outcome'],
            'notes' => $row['notes'],
            'created_at' => $row['created_at'],
        ];
    }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $trials]);
}

function handleGetSessionEntry($conn, $clientId, $sessionDate) {
    ensureSessionEntryTable($conn);

    $stmt = $conn->prepare("
        SELECT id, client_id, session_date, session_id, payload, created_at, updated_at
        FROM client_session_note_entries
        WHERE client_id = ? AND session_date = ?
        LIMIT 1
    ");
    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $conn->error);
    }

    $stmt->bind_param("ss", $clientId, $sessionDate);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();

    if (!$row) {
        echo json_encode(['success' => true, 'data' => null]);
        return;
    }

    $decoded = json_decode($row['payload'], true);
    echo json_encode([
        'success' => true,
        'data' => [
            'id' => $row['id'],
            'client_id' => $row['client_id'],
            'session_date' => $row['session_date'],
            'session_id' => $row['session_id'],
            'session_notes' => is_array($decoded) ? $decoded : [],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ]
    ]);
}

function handleGet($conn) {
    $clientId = $_GET['client_id'] ?? null;
    $targetId = $_GET['target_id'] ?? null;
    $sessionDate = $_GET['session_date'] ?? date('Y-m-d');

    if (!$clientId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'client_id is required']);
        return;
    }

    if ($targetId) {
        handleGetTrials($conn, $clientId, $targetId, $sessionDate);
        return;
    }

    handleGetSessionEntry($conn, $clientId, $sessionDate);
}

function handleSaveTrial($conn, $input) {
    if (!ensureTrialTable($conn)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'client_session_notes table does not exist. Please run the migration script.']);
        return;
    }

    $clientId = (string)$input['client_id'];
    $targetId = (string)$input['target_id'];
    $sessionDate = (string)($input['session_date'] ?? date('Y-m-d'));
    $trialOutcome = (string)$input['trial_outcome'];
    $notes = isset($input['notes']) ? (string)$input['notes'] : null;

    $trialNumberStmt = $conn->prepare("
        SELECT COALESCE(MAX(trial_number), 0) + 1 as next_trial
        FROM client_session_notes
        WHERE client_id = ? AND target_id = ? AND session_date = ?
    ");
    if (!$trialNumberStmt) {
        throw new Exception("Failed to prepare statement: " . $conn->error);
    }
    $trialNumberStmt->bind_param("sss", $clientId, $targetId, $sessionDate);
    $trialNumberStmt->execute();
    $trialNumberResult = $trialNumberStmt->get_result();
    $trialRow = $trialNumberResult->fetch_assoc();
    $trialNumberStmt->close();
    $trialNumber = (int)$trialRow['next_trial'];

    $id = generateId();
    $stmt = $conn->prepare("
        INSERT INTO client_session_notes
            (id, client_id, target_id, session_date, trial_number, trial_outcome, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $conn->error);
    }

    $stmt->bind_param("ssssiss", $id, $clientId, $targetId, $sessionDate, $trialNumber, $trialOutcome, $notes);
    if (!$stmt->execute()) {
        throw new Exception("Failed to save trial: " . $stmt->error);
    }
    $stmt->close();

    echo json_encode([
        'success' => true,
        'message' => 'Trial saved successfully',
        'data' => [
            'id' => $id,
            'trial_number' => $trialNumber,
        ]
    ]);
}

function handleSaveSessionEntry($conn, $input) {
    if (!isset($input['client_id']) || !isset($input['session_notes'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'client_id and session_notes are required']);
        return;
    }

    ensureSessionEntryTable($conn);

    $clientId = (string)$input['client_id'];
    $sessionDate = (string)($input['session_date'] ?? date('Y-m-d'));
    $sessionId = isset($input['session_id']) ? (string)$input['session_id'] : null;
    $sessionNotes = is_array($input['session_notes']) ? $input['session_notes'] : [];
    $payload = json_encode($sessionNotes, JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        throw new Exception("Failed to encode session_notes payload");
    }

    $existingStmt = $conn->prepare("
        SELECT id FROM client_session_note_entries
        WHERE client_id = ? AND session_date = ?
        LIMIT 1
    ");
    if (!$existingStmt) {
        throw new Exception("Failed to prepare statement: " . $conn->error);
    }
    $existingStmt->bind_param("ss", $clientId, $sessionDate);
    $existingStmt->execute();
    $existingResult = $existingStmt->get_result();
    $existingRow = $existingResult->fetch_assoc();
    $existingStmt->close();

    if ($existingRow) {
        $updateStmt = $conn->prepare("
            UPDATE client_session_note_entries
            SET session_id = ?, payload = ?
            WHERE id = ?
        ");
        if (!$updateStmt) {
            throw new Exception("Failed to prepare statement: " . $conn->error);
        }
        $updateStmt->bind_param("sss", $sessionId, $payload, $existingRow['id']);
        if (!$updateStmt->execute()) {
            throw new Exception("Failed to update session note entry: " . $updateStmt->error);
        }
        $updateStmt->close();

        echo json_encode([
            'success' => true,
            'message' => 'Session notes updated successfully',
            'data' => ['id' => $existingRow['id']]
        ]);
        return;
    }

    $id = generateId();
    $insertStmt = $conn->prepare("
        INSERT INTO client_session_note_entries (id, client_id, session_date, session_id, payload)
        VALUES (?, ?, ?, ?, ?)
    ");
    if (!$insertStmt) {
        throw new Exception("Failed to prepare statement: " . $conn->error);
    }
    $insertStmt->bind_param("sssss", $id, $clientId, $sessionDate, $sessionId, $payload);
    if (!$insertStmt->execute()) {
        throw new Exception("Failed to create session note entry: " . $insertStmt->error);
    }
    $insertStmt->close();

    echo json_encode([
        'success' => true,
        'message' => 'Session notes saved successfully',
        'data' => ['id' => $id]
    ]);
}

function handlePost($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON body']);
        return;
    }

    if (isset($input['target_id']) && isset($input['trial_outcome']) && isset($input['client_id'])) {
        handleSaveTrial($conn, $input);
        return;
    }

    handleSaveSessionEntry($conn, $input);
}

function handleDelete($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input) || !isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'id is required']);
        return;
    }

    if (!ensureTrialTable($conn)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'client_session_notes table does not exist']);
        return;
    }

    $id = (string)$input['id'];
    $stmt = $conn->prepare("DELETE FROM client_session_notes WHERE id = ?");
    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $conn->error);
    }
    $stmt->bind_param("s", $id);
    if (!$stmt->execute()) {
        throw new Exception("Failed to delete trial: " . $stmt->error);
    }
    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Trial deleted successfully']);
}

try {
    $conn = new mysqli($host, $user, $password, $database);
    $conn->set_charset("utf8mb4");

    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }

    $method = $_SERVER['REQUEST_METHOD'];
    switch ($method) {
        case 'GET':
            handleGet($conn);
            break;
        case 'POST':
            handlePost($conn);
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
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}


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

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
require_once __DIR__ . '/client_auth_units_helpers.php';
require_once __DIR__ . '/behavior_helpers.php';

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

    $entryRow = $row;
    $decoded = json_decode($entryRow['payload'], true);
    $sessionNotes = is_array($decoded) ? $decoded : [];
    $sessionIdInt = !empty($entryRow['session_id']) && is_numeric($entryRow['session_id'])
        ? (int)$entryRow['session_id']
        : null;

    $clientBehaviors = br_fetch_client_behaviors($conn, $clientId);
    $behaviorDataRows = br_fetch_session_behavior_data($conn, $clientId, $sessionDate, $sessionIdInt);
    $abcDataRows = br_fetch_session_abc_data($conn, $clientId, $sessionDate, $sessionIdInt);

    if (!empty($clientBehaviors) && function_exists('br_merge_behavior_data_into_rows')) {
        $mergedBehaviors = br_merge_behavior_data_into_rows($clientBehaviors, $behaviorDataRows);
        $payloadRows = $sessionNotes['behaviorReductionData'] ?? [];
        if (!empty($payloadRows) && is_array($payloadRows)) {
            $byId = [];
            foreach ($payloadRows as $payloadRow) {
                if (is_array($payloadRow) && !empty($payloadRow['id'])) {
                    $byId[$payloadRow['id']] = $payloadRow;
                }
            }
            $mergedBehaviors = array_map(function ($behaviorRow) use ($byId) {
                $saved = $byId[$behaviorRow['id']] ?? null;
                return $saved ? array_merge($behaviorRow, $saved) : $behaviorRow;
            }, $mergedBehaviors);
        }
        $sessionNotes['behaviorReductionData'] = $mergedBehaviors;
    }

    if (!empty($abcDataRows)) {
        $sessionNotes['abcData'] = array_map(function ($abcRow) {
            return [
                'id' => $abcRow['id'],
                'antecedent_id' => $abcRow['antecedent_id'],
                'behavior_id' => $abcRow['behavior_id'],
                'consequence_id' => $abcRow['consequence_id'],
                'location_id' => $abcRow['location_id'],
                'notes' => $abcRow['notes'] ?? '',
                'created_at' => $abcRow['created_at'] ?? null,
            ];
        }, $abcDataRows);
    } elseif (!isset($sessionNotes['abcData'])) {
        $sessionNotes['abcData'] = [];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'id' => $entryRow['id'],
            'client_id' => $entryRow['client_id'],
            'session_date' => $entryRow['session_date'],
            'session_id' => $entryRow['session_id'],
            'session_notes' => $sessionNotes,
            'created_at' => $entryRow['created_at'],
            'updated_at' => $entryRow['updated_at'],
        ]
    ]);
}

function handleGet($conn) {
    $clientId = $_GET['client_id'] ?? null;
    $targetId = $_GET['target_id'] ?? null;
    $sessionDate = $_GET['session_date'] ?? date('Y-m-d');

    $authU = getAuthenticatedUser();
    if ($authU && $clientId && !rbac_user_may_access_client_row($authU, $conn, (string) $clientId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Permission denied']);
        return;
    }

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

/**
 * Claim columns on sessions (optional migration).
 *
 * @return array{claim_id: bool, claim_status: bool}
 */
function sessions_has_claim_columns_notes(mysqli $conn): array
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = ['claim_id' => false, 'claim_status' => false];
    $r = @$conn->query('SHOW COLUMNS FROM `sessions`');
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $f = $row['Field'] ?? '';
            if ($f === 'claim_id') {
                $cached['claim_id'] = true;
            }
            if ($f === 'claim_status') {
                $cached['claim_status'] = true;
            }
        }
        $r->free();
    }

    return $cached;
}

/**
 * Hours covered by appointment window (sessions.start_utc → end_utc).
 */
function session_duration_hours_from_bounds($startUtc, $endUtc): float
{
    if ($startUtc === null || $startUtc === '' || $endUtc === null || $endUtc === '') {
        return 0.0;
    }
    $s = strtotime((string)$startUtc);
    $e = strtotime((string)$endUtc);
    if ($s === false || $e === false || $e <= $s) {
        return 0.0;
    }
    return round(($e - $s) / 3600.0, 4);
}

function sessions_has_authorized_hours_column_notes(mysqli $conn): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = false;
    $r = @$conn->query("SHOW COLUMNS FROM `sessions` LIKE 'authorized_hours'");
    if ($r && $r->num_rows > 0) {
        $cached = true;
    }
    if ($r) {
        $r->free();
    }

    return $cached;
}

function build_claim_id_notes(int $sessionId, $startUtc = null): string
{
    $datePart = date('Ymd');
    if (!empty($startUtc)) {
        $ts = strtotime((string)$startUtc);
        if ($ts !== false) {
            $datePart = gmdate('Ymd', $ts);
        }
    }

    return "CLM-{$datePart}-{$sessionId}";
}

/**
 * Persist note payload; return new or existing entry id.
 *
 * @throws Exception on DB errors
 */
function persist_session_note_entry(mysqli $conn, array $input): string
{
    if (!isset($input['client_id']) || !isset($input['session_notes'])) {
        throw new InvalidArgumentException('client_id and session_notes are required fields');
    }

    ensureSessionEntryTable($conn);

    $clientId = (string)$input['client_id'];
    $sessionDate = (string)($input['session_date'] ?? date('Y-m-d'));
    $sessionIdRaw = array_key_exists('session_id', $input) ? $input['session_id'] : null;
    $sessionId = $sessionIdRaw !== null && $sessionIdRaw !== ''
        ? (string)$sessionIdRaw
        : null;

    $sessionNotes = is_array($input['session_notes']) ? $input['session_notes'] : [];
    $payload = json_encode($sessionNotes, JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        throw new Exception('Failed to encode session_notes payload');
    }

    $existingStmt = $conn->prepare('
        SELECT id FROM client_session_note_entries
        WHERE client_id = ? AND session_date = ?
        LIMIT 1
    ');
    if (!$existingStmt) {
        throw new Exception('Failed to prepare statement: ' . $conn->error);
    }
    $existingStmt->bind_param('ss', $clientId, $sessionDate);
    $existingStmt->execute();
    $existingResult = $existingStmt->get_result();
    $existingRow = $existingResult->fetch_assoc();
    $existingStmt->close();

    if ($existingRow) {
        if ($sessionId !== null) {
            $updateStmt = $conn->prepare('
                UPDATE client_session_note_entries
                SET session_id = ?, payload = ?
                WHERE id = ?
            ');
            if (!$updateStmt) {
                throw new Exception('Failed to prepare statement: ' . $conn->error);
            }
            $updateStmt->bind_param('sss', $sessionId, $payload, $existingRow['id']);
            if (!$updateStmt->execute()) {
                throw new Exception('Failed to update session note entry: ' . $updateStmt->error);
            }
            $updateStmt->close();
        } else {
            $updateStmt = $conn->prepare('
                UPDATE client_session_note_entries
                SET session_id = NULL, payload = ?
                WHERE id = ?
            ');
            if (!$updateStmt) {
                throw new Exception('Failed to prepare statement: ' . $conn->error);
            }
            $updateStmt->bind_param('ss', $payload, $existingRow['id']);
            if (!$updateStmt->execute()) {
                throw new Exception('Failed to update session note entry: ' . $updateStmt->error);
            }
            $updateStmt->close();
        }

        return (string)$existingRow['id'];
    }

    $id = generateId();
    if ($sessionId !== null) {
        $insertStmt = $conn->prepare('
            INSERT INTO client_session_note_entries (id, client_id, session_date, session_id, payload)
            VALUES (?, ?, ?, ?, ?)
        ');
        if (!$insertStmt) {
            throw new Exception('Failed to prepare statement: ' . $conn->error);
        }
        $insertStmt->bind_param('sssss', $id, $clientId, $sessionDate, $sessionId, $payload);
        if (!$insertStmt->execute()) {
            throw new Exception('Failed to create session note entry: ' . $insertStmt->error);
        }
        $insertStmt->close();
    } else {
        $insertStmt = $conn->prepare('
            INSERT INTO client_session_note_entries (id, client_id, session_date, session_id, payload)
            VALUES (?, ?, ?, NULL, ?)
        ');
        if (!$insertStmt) {
            throw new Exception('Failed to prepare statement: ' . $conn->error);
        }
        $insertStmt->bind_param('ssss', $id, $clientId, $sessionDate, $payload);
        if (!$insertStmt->execute()) {
            throw new Exception('Failed to create session note entry: ' . $insertStmt->error);
        }
        $insertStmt->close();
    }

    return $id;
}

/**
 * Mark scheduling session Rendered, sync rendered hours, set claim id/status when columns exist.
 * Updates client_auth.units_serviced from all Ready to Bill sessions on this authorization.
 *
 * @throws Exception
 */
function finalize_session_ready_to_bill_notes(mysqli $conn, string $clientId, int $sessionId): array
{
    $stmt = $conn->prepare('SELECT * FROM sessions WHERE session_id = ? LIMIT 1');
    if (!$stmt) {
        throw new Exception('Failed to prepare session lookup: ' . $conn->error);
    }
    $stmt->bind_param('i', $sessionId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) {
        throw new Exception('Session not found');
    }
    if (trim((string)($row['client_id'] ?? '')) !== trim($clientId)) {
        throw new Exception('Session does not belong to this client');
    }

    $statusRaw = (string)($row['STATUS'] ?? $row['status'] ?? '');
    if (strcasecmp($statusRaw, 'Cancelled') === 0) {
        throw new Exception('Cannot complete a cancelled session');
    }

    $fromWindow = session_duration_hours_from_bounds($row['start_utc'] ?? null, $row['end_utc'] ?? null);
    $sched = (float)($row['scheduled_hours'] ?? 0);
    if ($sched <= 0 && $fromWindow > 0) {
        $sched = $fromWindow;
    }

    $rend = (float)($row['rendered_hours'] ?? 0);
    $newRendered = $rend > 0 ? $rend : $sched;
    /** If still unknown, rounding noise from DECIMAL strings */
    if ($newRendered <= 0 && $fromWindow > 0) {
        $newRendered = $fromWindow;
    }

    $repairScheduledDb = ($fromWindow > 0 && (float)($row['scheduled_hours'] ?? 0) <= 0);
    $hasAuthCol = sessions_has_authorized_hours_column_notes($conn);
    $authExisting = isset($row['authorized_hours']) ? (float)$row['authorized_hours'] : 0.0;
    $repairAuthDb = $hasAuthCol && $authExisting <= 0 && $newRendered > 0;

    $cols = sessions_has_claim_columns_notes($conn);
    $claimIdExisting = trim((string)($row['claim_id'] ?? ''));
    $claimStatusExisting = trim((string)($row['claim_status'] ?? ''));

    $nextClaimId = $claimIdExisting;
    if ($cols['claim_id'] && $nextClaimId === '') {
        $nextClaimId = build_claim_id_notes($sessionId, $row['start_utc'] ?? null);
    }

    $submitted = $cols['claim_status'] && stripos($claimStatusExisting, 'submitted') !== false;
    $nextClaimStatus = $claimStatusExisting;
    if ($cols['claim_status'] && !$submitted) {
        $nextClaimStatus = 'Ready to Bill';
    }

    $sets = ['`STATUS` = ?', 'rendered_hours = ?'];
    $types = 'sd';
    $bind = ['Rendered', $newRendered];

    if ($repairScheduledDb) {
        $sets[] = 'scheduled_hours = ?';
        $types .= 'd';
        $bind[] = $fromWindow;
    }

    if ($repairAuthDb) {
        $sets[] = 'authorized_hours = ?';
        $types .= 'd';
        $bind[] = $newRendered;
    }

    if ($cols['claim_id'] && $nextClaimId !== '') {
        $sets[] = 'claim_id = ?';
        $types .= 's';
        $bind[] = $nextClaimId;
    }
    if ($cols['claim_status'] && !$submitted) {
        $sets[] = 'claim_status = ?';
        $types .= 's';
        $bind[] = $nextClaimStatus !== '' ? $nextClaimStatus : 'Ready to Bill';
    }

    $sql = 'UPDATE sessions SET ' . implode(', ', $sets) . ' WHERE session_id = ? AND client_id = ?';
    $types .= 'is';
    $bind[] = $sessionId;
    $bind[] = $clientId;

    $upd = $conn->prepare($sql);
    if (!$upd) {
        throw new Exception('Failed to prepare session update: ' . $conn->error);
    }
    $params = array_merge([$types], $bind);
    $refs = [];
    foreach ($params as $key => $_) {
        $refs[$key] = &$params[$key];
    }
    call_user_func_array([$upd, 'bind_param'], $refs);
    if (!$upd->execute()) {
        throw new Exception('Failed to update session: ' . $upd->error);
    }
    $affected = $upd->affected_rows;
    $upd->close();

    $authSync = null;
    $authId = (int)($row['auth_id'] ?? 0);
    if ($authId > 0) {
        $authSync = client_auth_sync_units_serviced_for_auth($conn, $authId);
    }

    return [
        'session_id' => $sessionId,
        'claim_id' => $cols['claim_id'] ? $nextClaimId : null,
        'claim_status' => $cols['claim_status'] ? $nextClaimStatus : null,
        'rendered_hours' => $newRendered,
        'rows_affected' => $affected,
        'auth_units' => $authSync,
    ];
}

function session_notes_date_is_future(string $sessionDate): bool
{
    $sessionDate = trim($sessionDate);
    if ($sessionDate === '') {
        return false;
    }
    return $sessionDate > date('Y-m-d');
}

function handleCompleteSessionNotes(mysqli $conn, array $input): void
{
    $sessionDate = (string)($input['session_date'] ?? date('Y-m-d'));
    if (session_notes_date_is_future($sessionDate)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'code' => 'future_session_date',
            'message' => 'You cannot complete session notes for a future date.',
        ]);

        return;
    }

    if (empty($input['session_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'session_id is required to complete and mark ready to bill']);

        return;
    }
    $sessionId = (int)$input['session_id'];
    if ($sessionId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid session_id']);

        return;
    }

    if (!isset($input['client_id']) || !isset($input['session_notes'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'client_id and session_notes are required']);

        return;
    }

    try {
        $conn->begin_transaction();
        $entryId = persist_session_note_entry($conn, $input);
        br_persist_from_session_notes_input($conn, $input);
        $bill = finalize_session_ready_to_bill_notes($conn, (string)$input['client_id'], $sessionId);
        $conn->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Session notes saved and session marked ready to bill',
            'data' => [
                'note_entry_id' => $entryId,
                'billing' => $bill,
            ],
        ]);
    } catch (InvalidArgumentException $e) {
        $conn->rollback();
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    } catch (Exception $e) {
        $conn->rollback();
        throw $e;
    }
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
    $notes = isset($input['notes']) && $input['notes'] !== null ? (string)$input['notes'] : '';

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
    try {
        $id = persist_session_note_entry($conn, $input);
        br_persist_from_session_notes_input($conn, $input);
    } catch (InvalidArgumentException $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);

        return;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Session notes saved successfully',
        'data' => ['id' => $id],
    ]);
}

function handlePost($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON body']);
        return;
    }

    $authU = getAuthenticatedUser();
    if ($authU && !empty($input['client_id']) && !rbac_user_may_access_client_row($authU, $conn, (string) $input['client_id'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Permission denied']);
        return;
    }

    if (isset($input['target_id']) && isset($input['trial_outcome']) && isset($input['client_id'])) {
        handleSaveTrial($conn, $input);
        return;
    }

    if (!empty($input['complete_session'])) {
        handleCompleteSessionNotes($conn, $input);
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
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}


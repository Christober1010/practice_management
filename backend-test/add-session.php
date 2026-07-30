<?php
// =======
// SESSION MANAGEMENT API - CRUD + Email Notifications + Recurring Sessions
// Updated with recurring_id, auth_id, cancelled_by, cancelled_reason
// =======

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Cache-Control, Accept");
header("Access-Control-Max-Age: 86400");
header("Content-Type: application/json; charset=UTF-8");

ini_set('display_errors', 1);
error_reporting(E_ALL);

$headers = getallheaders();
file_put_contents('debug.log', "Request Method: {$_SERVER['REQUEST_METHOD']}\nRequest Headers: " . print_r($headers, true) . "\n", FILE_APPEND);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    file_put_contents('debug.log', "OPTIONS request handled\n", FILE_APPEND);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/scheduling_session_lib.php';
require_once __DIR__ . '/rbac_helpers.php';
require_once __DIR__ . '/session_rate_lib.php';

// Use the same DB as provider-service-codes / get-clients (config.php), not a hardcoded host.
try {
    $conn = getDBConnection();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit();
}

// Mutations stay scheduling-write. Claims Billing (biller) lists sessions with billing.read.
$methodEarly = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if (in_array($methodEarly, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
    $authUser = requireAuth('scheduling.write', 'mahaverse');
} else {
    $authUser = requireAuthAny(['scheduling.read', 'billing.read'], 'mahaverse');
}

// Main Logic
$method = $_SERVER['REQUEST_METHOD'];
$rawInput = file_get_contents("php://input");
$input = json_decode($rawInput, true);

file_put_contents('debug.log', "Raw Input: $rawInput\nParsed Input: " . print_r($input, true) . "\n", FILE_APPEND);

try {
    switch ($method) {
        // POST Case: Create single or recurring sessions
        case "POST":
            file_put_contents('debug.log', "Checking fields: clientId=" . ($input['clientId'] ?? 'missing') . ", provider=" . ($input['provider'] ?? 'missing') . ", providerName=" . ($input['providerName'] ?? 'missing') . ", startDateTime=" . ($input['startDateTime'] ?? 'missing') . ", endDateTime=" . ($input['endDateTime'] ?? 'missing') . ", authId=" . ($input['authId'] ?? 'missing') . "\n", FILE_APPEND);

            $authUser = $authUser ?? requireUser();
            $result = mahaverse_create_scheduling_session($conn, $input, [
                'authUser' => $authUser,
                'enforceRbac' => true,
                'sendEmail' => true,
            ]);
            if (!($result['success'] ?? false)) {
                $code = (int)($result['_httpCode'] ?? 400);
                unset($result['_httpCode']);
                http_response_code($code);
                echo json_encode($result);
                exit();
            }
            echo json_encode($result);
            break;

        case "GET":
            if (isset($_GET['id'])) {
                $stmt = $conn->prepare("
                    SELECT s.*, CONCAT(c.first_name, ' ', c.last_name) AS clientName
                    FROM sessions s
                    LEFT JOIN clients c ON s.client_id = c.client_id
                    WHERE s.session_id = ?
                ");
                $stmt->bind_param("i", $_GET['id']);
                $stmt->execute();
                $result = $stmt->get_result();
                $session = $result->fetch_assoc();
                $stmt->close();

                if ($session) {
                    $allowed = rbac_filter_sessions_for_user($conn, $authUser, [$session]);
                    if (empty($allowed)) {
                        http_response_code(403);
                        echo json_encode(["error" => "Permission denied"]);
                    } else {
                        echo json_encode($session);
                    }
                } else {
                    http_response_code(404);
                    echo json_encode(["error" => "Session not found"]);
                }
            } else {
                $whereConditions = [];
                $params = [];
                $types = "";

                if (isset($_GET['client_id'])) {
                    $whereConditions[] = "s.client_id = ?";
                    $params[] = $_GET['client_id'];
                    $types .= "s";
                }
                if (isset($_GET['provider_id'])) {
                    $whereConditions[] = "s.provider_id = ?";
                    $params[] = $_GET['provider_id'];
                    $types .= "s";
                }
                if (isset($_GET['status'])) {
                    $whereConditions[] = "s.STATUS = ?";
                    $params[] = $_GET['status'];
                    $types .= "s";
                }
                if (isset($_GET['date'])) {
                    $whereConditions[] = "DATE(s.start_utc) = ?";
                    $params[] = $_GET['date'];
                    $types .= "s";
                }
                if (isset($_GET['start_date']) && isset($_GET['end_date'])) {
                    $whereConditions[] = "DATE(s.start_utc) BETWEEN ? AND ?";
                    $params[] = $_GET['start_date'];
                    $params[] = $_GET['end_date'];
                    $types .= "ss";
                }

                $sql = "
                    SELECT s.*, CONCAT(c.first_name, ' ', c.last_name) AS clientName
                    FROM sessions s
                    LEFT JOIN clients c ON s.client_id = c.client_id
                ";

                if (!empty($whereConditions)) {
                    $sql .= " WHERE " . implode(" AND ", $whereConditions);
                }

                $sql .= " ORDER BY s.start_utc ASC";

                if (!empty($params)) {
                    $stmt = $conn->prepare($sql);
                    $stmt->bind_param($types, ...$params);
                } else {
                    $stmt = $conn->prepare($sql);
                }

                $stmt->execute();
                $result = $stmt->get_result();
                $sessions = $result->fetch_all(MYSQLI_ASSOC);
                $stmt->close();

                // Non-admin: only sessions for assigned clients / related providers
                $sessions = rbac_filter_sessions_for_user($conn, $authUser, $sessions);

                echo json_encode($sessions);
            }
            break;

        // PUT Case: Update single or recurring sessions
        case "PUT":
            if (!isset($input['session_id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Session ID required in payload"]);
                exit();
            }

            $sessionId = (int)$input['session_id'];
            $editMode = isset($input['editMode']) ? (string)$input['editMode'] : 'single';

            $sessionsHasAuthorizedHours = sessions_has_authorized_hours_column($conn);
            $authHoursSelect = $sessionsHasAuthorizedHours ? ', authorized_hours' : '';
            $excludeSelect = sessions_has_exclude_session_column($conn) ? ', exclude_session' : '';
            $serviceTypeSelect = sessions_has_service_type_column($conn) ? ', service_type' : '';

            // Get the current session
            $stmt = $conn->prepare("
        SELECT client_id, auth_id, provider_id, provider_name, supervising_provider_id, supervising_provider_name,
               start_utc, end_utc, start_tz, end_tz, auth_code, place_of_service, location_address,
               quick_note, recurring, recurring_days, status{$authHoursSelect}, scheduled_hours, rendered_hours, recurring_id{$excludeSelect}{$serviceTypeSelect}
        FROM sessions WHERE session_id = ?
    ");
            $stmt->bind_param("i", $sessionId);
            $stmt->execute();
            $result = $stmt->get_result();
            $currentSession = $result->fetch_assoc();
            $stmt->close();

            if (!$currentSession) {
                http_response_code(404);
                echo json_encode(["error" => "Session not found"]);
                exit();
            }

            $incomingRecurring = is_array($input['recurring'] ?? null) ? $input['recurring'] : null;
            $hasRecurringPayload = is_array($incomingRecurring);
            $targetRecurringFrequency = $hasRecurringPayload
                ? (string)($incomingRecurring['frequency'] ?? 'No')
                : (string)($currentSession['recurring'] ?? 'No');
            if ($targetRecurringFrequency === '' || $targetRecurringFrequency === 'Never') {
                $targetRecurringFrequency = 'No';
            }
            if (!in_array($targetRecurringFrequency, ['No', 'Daily', 'Weekly', 'Biweekly', 'Monthly'], true)) {
                http_response_code(400);
                echo json_encode(["error" => "Invalid recurring frequency in update"]);
                exit();
            }

            $targetRecurringDays = null;
            if ($targetRecurringFrequency === 'Weekly') {
                if ($hasRecurringPayload && !empty($incomingRecurring['days']) && is_array($incomingRecurring['days'])) {
                    $targetRecurringDays = implode(',', $incomingRecurring['days']);
                } else {
                    $targetRecurringDays = $currentSession['recurring_days'] ?? null;
                }
            }

            $targetRecurringId = $currentSession['recurring_id'] ?? null;
            if ($targetRecurringFrequency === 'No') {
                $targetRecurringId = null;
            } elseif (empty($targetRecurringId)) {
                $targetRecurringId = (int)(microtime(true) * 10000) . rand(1000, 9999);
            }

            $authUserPut = $authUser ?? requireUser();
            $noteAction = 'update';
            if (
                isset($input['quickNote']) &&
                trim((string) $input['quickNote']) !== '' &&
                empty($input['startDateTime']) &&
                empty($input['endDateTime'])
            ) {
                $noteAction = 'notes';
            }
            rbac_enforce_session_action($authUserPut, $conn, $noteAction, $currentSession['provider_id'] ?? null);

            $conn->begin_transaction();
            try {
                $sessionsToUpdate = [];
                if ($editMode === 'recurring' && !empty($currentSession['recurring_id'])) {
                    $stmt = $conn->prepare("SELECT session_id, client_id, auth_id, start_utc, end_utc, scheduled_hours, status FROM sessions WHERE recurring_id = ?");
                    $stmt->bind_param("i", $currentSession['recurring_id']);
                    $stmt->execute();
                    $result = $stmt->get_result();
                    while ($row = $result->fetch_assoc()) {
                        $sessionsToUpdate[] = [
                            'session_id' => $row['session_id'],
                            'client_id' => $row['client_id'],
                            'auth_id' => $row['auth_id'],
                            'start_utc' => $row['start_utc'],
                            'end_utc' => $row['end_utc'],
                            'scheduled_hours' => $row['scheduled_hours'],
                            'status' => $row['status']
                        ];
                    }
                    $stmt->close();
                    file_put_contents('debug.log', "Edit Mode: RECURRING - Found " . count($sessionsToUpdate) . " sessions to update with recurring_id: {$currentSession['recurring_id']}\n", FILE_APPEND);
                } else {
                    $sessionsToUpdate[] = [
                        'session_id' => $sessionId,
                        'client_id' => $currentSession['client_id'],
                        'auth_id' => $currentSession['auth_id'],
                        'start_utc' => $currentSession['start_utc'],
                        'end_utc' => $currentSession['end_utc'],
                        'scheduled_hours' => $currentSession['scheduled_hours'],
                        'status' => $currentSession['status']
                    ];
                    file_put_contents('debug.log', "Edit Mode: SINGLE - Updating session_id: $sessionId\n", FILE_APPEND);
                }

                $allExcludeSessionIds = array_values(array_unique(array_map(
                    static fn($s) => (int)$s['session_id'],
                    $sessionsToUpdate
                )));
                $providerForLock = isset($input['provider'])
                    ? (string)$input['provider']
                    : (string)($currentSession['provider_id'] ?? '');
                lock_provider_sessions_for_update($conn, $providerForLock);
                $pendingPutWindows = [];

                $rowsAffected = 0;
                $totalHoursChange = 0;
                $totalAuthDelta = 0;
                $includeCancelFields =
                    array_key_exists('cancelledBy', $input) ||
                    array_key_exists('cancelledReason', $input) ||
                    (isset($input['status']) && strcasecmp((string)$input['status'], 'Cancelled') === 0);
                $excludeSessionRequested = array_key_exists('excludeSession', $input) || array_key_exists('exclude_session', $input)
                    ? ($input['excludeSession'] ?? $input['exclude_session'])
                    : null;
                $excludeSession = sessions_resolve_exclude_session_for_write(
                    $authUserPut,
                    $excludeSessionRequested,
                    $currentSession['exclude_session'] ?? 'No'
                );
                $serviceTypeRaw = array_key_exists('serviceType', $input)
                    || array_key_exists('service_type', $input)
                    || array_key_exists('direct_or_indirect_service', $input)
                    || array_key_exists('directOrIndirectService', $input)
                    ? ($input['serviceType']
                        ?? $input['service_type']
                        ?? $input['direct_or_indirect_service']
                        ?? $input['directOrIndirectService'])
                    : ($currentSession['service_type'] ?? 'Indirect');
                $serviceType = normalize_session_service_type($serviceTypeRaw);

                foreach ($sessionsToUpdate as $session) {
                    $sessionId = (int)$session['session_id'];
                    $originalScheduledHours = (float)$session['scheduled_hours'];

                    // Get values from input or use current session values as fallback
                    $clientId = isset($input['clientId']) ? (string)$input['clientId'] : $currentSession['client_id'];
                    $provider = isset($input['provider']) ? (string)$input['provider'] : $currentSession['provider_id'];
                    $providerName = isset($input['providerName']) ? (string)$input['providerName'] : $currentSession['provider_name'];
                    $supervisingProvider = isset($input['supervisingProvider']) ? (string)$input['supervisingProvider'] : $currentSession['supervising_provider_id'];
                    $supervisingProviderName = isset($input['supervisingProviderName']) ? (string)$input['supervisingProviderName'] : $currentSession['supervising_provider_name'];
                    $startTz = isset($input['startTZ']) ? (string)$input['startTZ'] : $currentSession['start_tz'];
                    $endTz = isset($input['endTZ']) ? (string)$input['endTZ'] : $currentSession['end_tz'];
                    $authCode = isset($input['authCode']) ? (string)$input['authCode'] : $currentSession['auth_code'];
                    $placeOfService = isset($input['placeOfService']) ? (string)$input['placeOfService'] : $currentSession['place_of_service'];
                    $locationAddress = isset($input['locationAddress']) ? (string)$input['locationAddress'] : $currentSession['location_address'];
                    $quickNote = isset($input['quickNote']) ? (string)$input['quickNote'] : $currentSession['quick_note'];
                    if (isset($input['quickNote']) && !empty(trim($input['quickNote']))) {
                        $status = 'Rendered';
                    } else {
                        // Keep current status if quickNote is not being updated
                        if (isset($input['status'])) {
                            $status = ucfirst(strtolower((string)$input['status']));
                        } else {
                            $status = $currentSession['status'];
                        }
                    }
                    $authorizedHours = isset($input['authorizedHours'])
                        ? floatval($input['authorizedHours'])
                        : (isset($input['authorized_hours']) ? floatval($input['authorized_hours']) : floatval($currentSession['authorized_hours'] ?? '0.00'));
                    $scheduledHours = isset($input['scheduledHours'])
                        ? floatval($input['scheduledHours'])
                        : (isset($input['scheduled_hours']) ? floatval($input['scheduled_hours']) : floatval($currentSession['scheduled_hours']));
                    $renderedHours = isset($input['renderedHours'])
                        ? floatval($input['renderedHours'])
                        : (isset($input['rendered_hours']) ? floatval($input['rendered_hours']) : floatval($currentSession['rendered_hours'] ?? '0.00'));

                    // Validate parameters
                    if ($scheduledHours === null) {
                        throw new Exception("scheduled_hours is null for session_id: $sessionId");
                    }
                    if ($renderedHours === null) {
                        throw new Exception("rendered_hours is null for session_id: $sessionId");
                    }

                    if (!in_array($placeOfService, ['Home', 'Clinic', 'School', 'Virtual', 'Other'])) {
                        throw new Exception("Invalid place_of_service: $placeOfService");
                    }
                    if (!in_array($status, ['Scheduled', 'Rendered', 'Cancelled'])) {
                        throw new Exception("Invalid status: $status. Must be 'Scheduled', 'Rendered', or 'Cancelled'");
                    }

                    $startUtc = $session['start_utc'];
                    $endUtc = $session['end_utc'];

                    // Handle datetime updates for recurring sessions
                    if ($editMode === 'recurring' && (isset($input['startDateTime']) || isset($input['endDateTime']))) {
                        $inputStartDateTime = isset($input['startDateTime']) ? convertToMySQLDateTime($input['startDateTime']) : $currentSession['start_utc'];
                        $inputEndDateTime = isset($input['endDateTime']) ? convertToMySQLDateTime($input['endDateTime']) : $currentSession['end_utc'];

                        try {
                            $inputStartDt = new DateTime($inputStartDateTime, new DateTimeZone('UTC'));
                            $inputEndDt = new DateTime($inputEndDateTime, new DateTimeZone('UTC'));
                            $originalStartDt = new DateTime($session['start_utc'], new DateTimeZone('UTC'));

                            $newStartDt = new DateTime(
                                $originalStartDt->format('Y-m-d') . ' ' . $inputStartDt->format('H:i:s'),
                                new DateTimeZone('UTC')
                            );

                            $duration = $inputEndDt->getTimestamp() - $inputStartDt->getTimestamp();
                            $newEndDt = clone $newStartDt;
                            $newEndDt->modify("+$duration seconds");

                            $startUtc = $newStartDt->format('Y-m-d H:i:s');
                            $endUtc = $newEndDt->format('Y-m-d H:i:s');

                            if (!isset($input['scheduledHours'])) {
                                $scheduledHours = floatval(computeScheduledHours($startUtc, $endUtc));
                            }
                        } catch (Exception $e) {
                            throw new Exception("DateTime error: " . $e->getMessage());
                        }
                    } elseif (isset($input['startDateTime']) || isset($input['endDateTime'])) {
                        // For single sessions, update datetime directly
                        $startUtc = isset($input['startDateTime']) ? convertToMySQLDateTime($input['startDateTime']) : $session['start_utc'];
                        $endUtc = isset($input['endDateTime']) ? convertToMySQLDateTime($input['endDateTime']) : $session['end_utc'];

                        if (!isset($input['scheduledHours'])) {
                            $scheduledHours = floatval(computeScheduledHours($startUtc, $endUtc));
                        }
                    }

                    $lockRow = array_merge($currentSession, $session);
                    if (session_row_is_completed($lockRow)) {
                        $clientId = (string)$currentSession['client_id'];
                        $provider = (string)$currentSession['provider_id'];
                        $providerName = (string)$currentSession['provider_name'];
                        $supervisingProvider = (string)($currentSession['supervising_provider_id'] ?? '');
                        $supervisingProviderName = (string)($currentSession['supervising_provider_name'] ?? '');
                        $authCode = (string)$currentSession['auth_code'];
                        $quickNote = (string)($currentSession['quick_note'] ?? '');
                        $status = ucfirst(strtolower((string)($currentSession['status'] ?? 'Rendered')));
                        $renderedHours = floatval($currentSession['rendered_hours'] ?? 0);
                        $authorizedHours = floatval($currentSession['authorized_hours'] ?? 0);
                        $targetRecurringFrequency = (string)($currentSession['recurring'] ?? 'No');
                        $targetRecurringDays = $currentSession['recurring_days'] ?? null;
                        $targetRecurringId = $currentSession['recurring_id'] ?? null;
                    }

                    if (!session_status_is_cancelled($status)) {
                        ensure_provider_schedule_clear(
                            $conn,
                            $provider,
                            $startUtc,
                            $endUtc,
                            $allExcludeSessionIds,
                            $pendingPutWindows,
                            $providerName
                        );
                    }

                    $hoursChange = $scheduledHours - $originalScheduledHours;
                    $totalHoursChange += $hoursChange;

                    file_put_contents('debug.log', "Updating session_id: $sessionId with hours change: $hoursChange\n", FILE_APPEND);

                    // Auth balance delta must reflect both hours changes and cancellation/uncancellation.
                    $originalStatus = ucfirst(strtolower((string)($session['status'] ?? $currentSession['status'] ?? 'Scheduled')));
                    $newStatus = ucfirst(strtolower((string)($status ?? 'Scheduled')));
                    $oldActive = strtolower($originalStatus) !== 'cancelled';
                    $newActive = strtolower($newStatus) !== 'cancelled';

                    if ($oldActive && $newActive) {
                        // still active: only adjust by the scheduled hours difference
                        $totalAuthDelta += -($scheduledHours - $originalScheduledHours);
                    } elseif ($oldActive && !$newActive) {
                        // cancelling: return the previously scheduled hours
                        $totalAuthDelta += $originalScheduledHours;
                    } elseif (!$oldActive && $newActive) {
                        // un-cancelling: reserve hours again
                        $totalAuthDelta += -$scheduledHours;
                    }

                    $authHoursSet = $sessionsHasAuthorizedHours ? "authorized_hours = ?,\n                    " : "";

                    $updateSql = "
                UPDATE sessions SET
                    client_id = ?,
                    provider_id = ?,
                    provider_name = ?,
                    supervising_provider_id = ?,
                    supervising_provider_name = ?,
                    start_utc = ?,
                    end_utc = ?,
                    start_tz = ?,
                    end_tz = ?,
                    auth_code = ?,
                    place_of_service = ?,
                    location_address = ?,
                    quick_note = ?,
                    recurring = ?,
                    recurring_days = ?,
                    recurring_id = ?,
                    STATUS = ?,
                    " . ($includeCancelFields ? "cancelled_by = ?, cancelled_reason = ?," : "") . "
                    {$authHoursSet}scheduled_hours = ?,
                    rendered_hours = ?
                WHERE session_id = ?
            ";

                    $updateStmt = $conn->prepare($updateSql);
                    if (!$updateStmt) {
                        throw new Exception("Prepare failed: " . $conn->error);
                    }

                    if ($includeCancelFields) {
                        $cancelledBy = isset($input['cancelledBy']) ? (string)$input['cancelledBy'] : null;
                        $cancelledReason = isset($input['cancelledReason']) ? (string)$input['cancelledReason'] : null;
                        if (strtolower($newStatus) === 'cancelled') {
                            if (empty(trim((string)$cancelledReason))) {
                                throw new Exception("Cancellation reason is required when setting status to Cancelled");
                            }
                            if (!in_array($cancelledBy, ['Client', 'Staff'], true)) {
                                throw new Exception("Invalid cancelledBy value. Must be 'Client' or 'Staff'");
                            }
                        } else {
                            // For non-cancelled updates, don't change these fields unless explicitly cancelling.
                            $cancelledBy = null;
                            $cancelledReason = null;
                        }

                        if ($sessionsHasAuthorizedHours) {
                            $updateStmt->bind_param(
                                "ssssssssssssssssssidddi",
                                $clientId,
                                $provider,
                                $providerName,
                                $supervisingProvider,
                                $supervisingProviderName,
                                $startUtc,
                                $endUtc,
                                $startTz,
                                $endTz,
                                $authCode,
                                $placeOfService,
                                $locationAddress,
                                $quickNote,
                                $targetRecurringFrequency,
                                $targetRecurringDays,
                                $targetRecurringId,
                                $status,
                                $cancelledBy,
                                $cancelledReason,
                                $authorizedHours,
                                $scheduledHours,
                                $renderedHours,
                                $sessionId
                            );
                        } else {
                            $updateStmt->bind_param(
                                "ssssssssssssssssssiddi",
                                $clientId,
                                $provider,
                                $providerName,
                                $supervisingProvider,
                                $supervisingProviderName,
                                $startUtc,
                                $endUtc,
                                $startTz,
                                $endTz,
                                $authCode,
                                $placeOfService,
                                $locationAddress,
                                $quickNote,
                                $targetRecurringFrequency,
                                $targetRecurringDays,
                                $targetRecurringId,
                                $status,
                                $cancelledBy,
                                $cancelledReason,
                                $scheduledHours,
                                $renderedHours,
                                $sessionId
                            );
                        }
                    } else {
                        if ($sessionsHasAuthorizedHours) {
                            $updateStmt->bind_param(
                                "ssssssssssssssssidddi",
                                $clientId,
                                $provider,
                                $providerName,
                                $supervisingProvider,
                                $supervisingProviderName,
                                $startUtc,
                                $endUtc,
                                $startTz,
                                $endTz,
                                $authCode,
                                $placeOfService,
                                $locationAddress,
                                $quickNote,
                                $targetRecurringFrequency,
                                $targetRecurringDays,
                                $targetRecurringId,
                                $status,
                                $authorizedHours,
                                $scheduledHours,
                                $renderedHours,
                                $sessionId
                            );
                        } else {
                            $updateStmt->bind_param(
                                "ssssssssssssssssiddi",
                                $clientId,
                                $provider,
                                $providerName,
                                $supervisingProvider,
                                $supervisingProviderName,
                                $startUtc,
                                $endUtc,
                                $startTz,
                                $endTz,
                                $authCode,
                                $placeOfService,
                                $locationAddress,
                                $quickNote,
                                $targetRecurringFrequency,
                                $targetRecurringDays,
                                $targetRecurringId,
                                $status,
                                $scheduledHours,
                                $renderedHours,
                                $sessionId
                            );
                        }
                    }

                    if (!$updateStmt->execute()) {
                        throw new Exception("Failed to update session_id: $sessionId - " . $updateStmt->error);
                    }

                    $rowsAffected += $updateStmt->affected_rows;
                    $updateStmt->close();
                    sessions_set_exclude_session($conn, $sessionId, $excludeSession, true);
                    sessions_set_service_type($conn, $sessionId, $serviceType, true);
                    if (!session_status_is_cancelled($status)) {
                        $pendingPutWindows[] = [
                            'start' => $startUtc,
                            'end' => $endUtc,
                        ];
                    }
                    if (session_is_completed_status($status)) {
                        ensure_session_claim_ready($conn, $sessionId, $startUtc);
                    }
                    $putAuthId = isset($input['authId']) && $input['authId'] !== null && $input['authId'] !== ''
                        ? (int)$input['authId']
                        : (int)($session['auth_id'] ?? $currentSession['auth_id'] ?? 0);
                    if (!session_row_is_completed(array_merge($currentSession, $session))) {
                        session_persist_billing_rates(
                            $conn,
                            $sessionId,
                            $putAuthId,
                            $clientId,
                            $authCode,
                            $scheduledHours,
                            $renderedHours
                        );
                        session_persist_auth_service_fields($conn, $sessionId, $putAuthId);
                        session_persist_taxonomy_code($conn, $sessionId, $provider);
                    }
                    file_put_contents('debug.log', "Successfully updated session_id: $sessionId\n", FILE_APPEND);
                }

                // If recurring payload is present, ensure requested occurrences exist.
                $createdSessionIds = [];
                if ($hasRecurringPayload && $targetRecurringFrequency !== 'No') {
                    $baseStartUtc = isset($input['startDateTime']) ? convertToMySQLDateTime($input['startDateTime']) : $currentSession['start_utc'];
                    $baseEndUtc = isset($input['endDateTime']) ? convertToMySQLDateTime($input['endDateTime']) : $currentSession['end_utc'];
                    $baseStartDt = new DateTime($baseStartUtc, new DateTimeZone('UTC'));
                    $baseEndDt = new DateTime($baseEndUtc, new DateTimeZone('UTC'));
                    $durationSec = max(0, $baseEndDt->getTimestamp() - $baseStartDt->getTimestamp());

                    $ends = is_array($incomingRecurring['ends'] ?? null) ? $incomingRecurring['ends'] : [];
                    $endsType = (string)($ends['type'] ?? 'After');
                    if ($endsType !== 'On' && $endsType !== 'After') {
                        $endsType = 'After';
                    }
                    $endsDate = !empty($ends['date']) ? (string)$ends['date'] : null;
                    $occurrences = (int)($ends['occurrences'] ?? 1);
                    $weeklyDays = is_array($incomingRecurring['days'] ?? null) ? $incomingRecurring['days'] : [];

                    $desiredAdditionalStarts = buildRecurringOccurrenceStarts(
                        $baseStartDt,
                        $targetRecurringFrequency,
                        $weeklyDays,
                        $endsType,
                        $endsDate,
                        $occurrences
                    );
                    $desiredStartMap = [];
                    $desiredStartMap[$baseStartDt->format('Y-m-d H:i:s')] = true;
                    foreach ($desiredAdditionalStarts as $d) {
                        $desiredStartMap[$d->format('Y-m-d H:i:s')] = true;
                    }

                    $existingStartMap = [];
                    if (!empty($targetRecurringId)) {
                        $existStmt = $conn->prepare("SELECT start_utc FROM sessions WHERE recurring_id = ?");
                        if ($existStmt) {
                            $existStmt->bind_param("i", $targetRecurringId);
                            $existStmt->execute();
                            $existRes = $existStmt->get_result();
                            while ($er = $existRes->fetch_assoc()) {
                                $existingStartMap[(string)$er['start_utc']] = true;
                            }
                            $existStmt->close();
                        }
                    }

                    if ($sessionsHasAuthorizedHours) {
                        $insertStmt = $conn->prepare("
                            INSERT INTO sessions (
                                client_id, provider_id, provider_name, supervising_provider_id, supervising_provider_name,
                                start_utc, end_utc, start_tz, end_tz, auth_code, recurring, recurring_days, place_of_service,
                                location_address, quick_note, status, authorized_hours, scheduled_hours, rendered_hours,
                                recurring_id, auth_id
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ");
                    } else {
                        $insertStmt = $conn->prepare("
                            INSERT INTO sessions (
                                client_id, provider_id, provider_name, supervising_provider_id, supervising_provider_name,
                                start_utc, end_utc, start_tz, end_tz, auth_code, recurring, recurring_days, place_of_service,
                                location_address, quick_note, status, scheduled_hours, rendered_hours,
                                recurring_id, auth_id
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ");
                    }
                    if (!$insertStmt) {
                        throw new Exception("Failed to prepare recurring insert statement");
                    }

                    foreach (array_keys($desiredStartMap) as $occStartUtc) {
                        if (isset($existingStartMap[$occStartUtc])) {
                            continue;
                        }
                        $occStart = new DateTime($occStartUtc, new DateTimeZone('UTC'));
                        $occEnd = clone $occStart;
                        $occEnd->modify("+{$durationSec} seconds");
                        $occEndUtc = $occEnd->format('Y-m-d H:i:s');

                        if (!session_status_is_cancelled($status)) {
                            ensure_provider_schedule_clear(
                                $conn,
                                $provider,
                                $occStartUtc,
                                $occEndUtc,
                                $allExcludeSessionIds,
                                $pendingPutWindows,
                                $providerName
                            );
                        }

                        if ($sessionsHasAuthorizedHours) {
                            $insertStmt->bind_param(
                                "ssssssssssssssssdddii",
                                $clientId,
                                $provider,
                                $providerName,
                                $supervisingProvider,
                                $supervisingProviderName,
                                $occStartUtc,
                                $occEndUtc,
                                $startTz,
                                $endTz,
                                $authCode,
                                $targetRecurringFrequency,
                                $targetRecurringDays,
                                $placeOfService,
                                $locationAddress,
                                $quickNote,
                                $status,
                                $authorizedHours,
                                $scheduledHours,
                                $renderedHours,
                                $targetRecurringId,
                                $authId
                            );
                        } else {
                            $insertStmt->bind_param(
                                "ssssssssssssssssddii",
                                $clientId,
                                $provider,
                                $providerName,
                                $supervisingProvider,
                                $supervisingProviderName,
                                $occStartUtc,
                                $occEndUtc,
                                $startTz,
                                $endTz,
                                $authCode,
                                $targetRecurringFrequency,
                                $targetRecurringDays,
                                $placeOfService,
                                $locationAddress,
                                $quickNote,
                                $status,
                                $scheduledHours,
                                $renderedHours,
                                $targetRecurringId,
                                $authId
                            );
                        }

                        if (!$insertStmt->execute()) {
                            throw new Exception("Failed creating recurring occurrence: " . $insertStmt->error);
                        }
                        $newSessionId = (int)$insertStmt->insert_id;
                        $createdSessionIds[] = $newSessionId;
                        $allExcludeSessionIds[] = $newSessionId;
                        sessions_set_exclude_session($conn, $newSessionId, $excludeSession, true);
                        sessions_set_service_type($conn, $newSessionId, $serviceType, true);
                        if (!session_status_is_cancelled($status)) {
                            $pendingPutWindows[] = [
                                'start' => $occStartUtc,
                                'end' => $occEndUtc,
                            ];
                        }
                        if (session_is_completed_status($status)) {
                            ensure_session_claim_ready($conn, $newSessionId, $occStartUtc);
                        }
                        $recurringPutAuthId = isset($input['authId']) && $input['authId'] !== null && $input['authId'] !== ''
                            ? (int)$input['authId']
                            : (int)($currentSession['auth_id'] ?? 0);
                        session_persist_billing_rates(
                            $conn,
                            $newSessionId,
                            $recurringPutAuthId,
                            $clientId,
                            $authCode,
                            $scheduledHours,
                            $renderedHours
                        );
                        session_persist_auth_service_fields($conn, $newSessionId, $recurringPutAuthId);
                        session_persist_taxonomy_code($conn, $newSessionId, $provider);
                    }
                    $insertStmt->close();

                    if (strtolower((string)$status) !== 'cancelled') {
                        $totalAuthDelta += -(count($createdSessionIds) * (float)$scheduledHours);
                    }
                    file_put_contents('debug.log', "Recurring ensure created " . count($createdSessionIds) . " additional sessions.\n", FILE_APPEND);
                }

                // Update auth balance based on active-session delta (covers cancel/uncancel, hour changes, and new recurring occurrences)
                $authId = isset($input['authId']) && $input['authId'] !== null ? (int)$input['authId'] : $currentSession['auth_id'];
                if ($totalAuthDelta != 0 && !empty($authId)) {
                    if (!updateClientAuthUnitsScheduled($conn, $currentSession['client_id'], $authId, $totalAuthDelta)) {
                        throw new Exception("Failed to update client_auth balance_units");
                    }
                } else {
                    file_put_contents('debug.log', "Skipped updateClientAuthUnitsScheduled: auth_id=$authId or no auth delta ($totalAuthDelta)\n", FILE_APPEND);
                }

                // Send notification emails
                $adminEmail = "christoberedward@gmail.com";
                $adminName = "Admin";
                $emailData = getEmailRecipients($conn, $currentSession['client_id'], $currentSession['provider_id'], $currentSession['supervising_provider_id']);

                if ($emailData) {
                    $clientName = $emailData['clientName'];
                    $recipients = $emailData['recipients'];

                    foreach ($sessionsToUpdate as $session) {
                        $sessionId = $session['session_id'];
                        $localStartDt = convertUtcToTz($session['start_utc'], $startTz ?: 'UTC');
                        $localEndDt = convertUtcToTz($session['end_utc'], $endTz ?: 'UTC');
                        $displayStart = $localStartDt ? $localStartDt->format('Y-m-d g:i A') : $session['start_utc'];
                        $displayEnd = $localEndDt ? $localEndDt->format('Y-m-d g:i A') : $session['end_utc'];

                        $subject = "Session Updated - Mahaverse";
                        $body = '
                <div style="background-color: #ffffff; padding: 15px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <p style="margin: 10px 0;"><strong>Client:</strong> ' . htmlspecialchars($clientName) . '</p>
                    <p style="margin: 10px 0;"><strong>Provider:</strong> ' . htmlspecialchars($providerName) . '</p>
                    <p style="margin: 10px 0;"><strong>Start:</strong> ' . htmlspecialchars($displayStart) . ' (' . htmlspecialchars($startTz ?: 'UTC') . ')</p>
                    <p style="margin: 10px 0;"><strong>End:</strong> ' . htmlspecialchars($displayEnd) . ' (' . htmlspecialchars($endTz ?: 'UTC') . ')</p>
                    <p style="margin: 10px 0;"><strong>Location:</strong> ' . htmlspecialchars($locationAddress ?? 'Not specified') . '</p>
                    <p style="margin: 10px 0;"><strong>Notes:</strong> ' . htmlspecialchars($quickNote ?? 'None') . '</p>
                    <p style="margin: 10px 0;"><strong>Status:</strong> ' . htmlspecialchars($status) . '</p>
                </div>';

                        $icsContent = generateICS($clientName, $providerName, $session['start_utc'], $session['end_utc'], $locationAddress, $quickNote, $startTz);

                        foreach ($recipients as $recipient) {
                            $emailSent = sendEmail($recipient['email'], $recipient['name'], $subject, $body, $icsContent);
                            file_put_contents('debug.log', ucfirst($recipient['type']) . " Email Sent to: {$recipient['email']} ({$recipient['name']}) - " . ($emailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                        }

                        $adminEmailSent = sendEmail($adminEmail, $adminName, $subject, $body, $icsContent);
                        file_put_contents('debug.log', "Admin Email Sent: " . ($adminEmailSent ? 'Success' : 'Failed') . "\n", FILE_APPEND);
                    }
                }

                $conn->commit();
                echo json_encode([
                    "success" => true,
                    "rows_affected" => $rowsAffected,
                    "edit_mode" => $editMode,
                    "sessions_updated" => array_column($sessionsToUpdate, 'session_id'),
                    "sessions_created" => $createdSessionIds,
                    "recurring_id" => $targetRecurringId,
                    "total_hours_change" => $totalHoursChange,
                    "exclude_session" => $excludeSession,
                    "service_type" => $serviceType,
                ]);
            } catch (ProviderScheduleConflictException $e) {
                $conn->rollback();
                http_response_code(409);
                echo json_encode($e->getPayload());
                file_put_contents('debug.log', "PUT provider conflict: " . $e->getMessage() . "\n", FILE_APPEND);
                exit();
            } catch (Exception $e) {
                $conn->rollback();
                http_response_code(500);
                echo json_encode([
                    "error" => "Failed to update sessions: " . $e->getMessage(),
                    "success" => false,
                ]);
                file_put_contents('debug.log', "PUT Transaction failed: " . $e->getMessage() . "\n", FILE_APPEND);
                exit();
            }
            break;

        // DELETE Case: Hard delete single or recurring sessions
        case "DELETE":
            if (!isset($input['session_id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Session ID required in payload"]);
                exit();
            }

            $sessionId = (int)$input['session_id'];
            $editMode = isset($input['editMode']) ? (string)$input['editMode'] : 'single';

            $conn->begin_transaction();
            try {
                $stmt = $conn->prepare("SELECT session_id, client_id, auth_id, recurring_id, scheduled_hours, status, provider_id FROM sessions WHERE session_id = ?");
                $stmt->bind_param("i", $sessionId);
                $stmt->execute();
                $result = $stmt->get_result();
                $currentSession = $result->fetch_assoc();
                $stmt->close();

                if (!$currentSession) {
                    http_response_code(404);
                    echo json_encode(["error" => "Session not found"]);
                    exit();
                }

                $authUserDel = $authUser ?? requireUser();
                rbac_enforce_session_action($authUserDel, $conn, 'delete', $currentSession['provider_id'] ?? null);

                $sessionsToDelete = [];
                if ($editMode === 'recurring' && !empty($currentSession['recurring_id'])) {
                    $stmt = $conn->prepare("SELECT session_id, client_id, auth_id, scheduled_hours, status FROM sessions WHERE recurring_id = ?");
                    $stmt->bind_param("i", $currentSession['recurring_id']);
                    $stmt->execute();
                    $result = $stmt->get_result();
                    while ($row = $result->fetch_assoc()) {
                        $sessionsToDelete[] = $row;
                    }
                    $stmt->close();
                    file_put_contents('debug.log', "DELETE Mode: RECURRING - Found " . count($sessionsToDelete) . " sessions to delete with recurring_id: {$currentSession['recurring_id']}\n", FILE_APPEND);
                } else {
                    $sessionsToDelete[] = $currentSession;
                    file_put_contents('debug.log', "DELETE Mode: SINGLE - Deleting session_id: $sessionId\n", FILE_APPEND);
                }

                // Return scheduled hours to authorization balance for sessions that are not already cancelled
                $hoursReturnByAuth = []; // key: client_id|auth_id => float hours
                foreach ($sessionsToDelete as $s) {
                    $clientId = (string)($s['client_id'] ?? '');
                    $authId = isset($s['auth_id']) ? (int)$s['auth_id'] : 0;
                    if (!$clientId || !$authId) continue;

                    $status = strtolower(trim((string)($s['status'] ?? '')));
                    if ($status === 'cancelled') {
                        continue; // avoid double returning hours
                    }

                    $hrs = (float)($s['scheduled_hours'] ?? 0);
                    if ($hrs == 0) continue;
                    $key = $clientId . '|' . $authId;
                    $hoursReturnByAuth[$key] = ($hoursReturnByAuth[$key] ?? 0) + $hrs;
                }

                // Delete sessions
                $rowsAffected = 0;
                $deletedIds = array_map(function ($s) {
                    return (int)$s['session_id'];
                }, $sessionsToDelete);

                if ($editMode === 'recurring' && !empty($currentSession['recurring_id'])) {
                    $stmt = $conn->prepare("DELETE FROM sessions WHERE recurring_id = ?");
                    $stmt->bind_param("i", $currentSession['recurring_id']);
                    if (!$stmt->execute()) {
                        throw new Exception("Failed to delete recurring sessions: " . $stmt->error);
                    }
                    $rowsAffected = $stmt->affected_rows;
                    $stmt->close();
                } else {
                    $stmt = $conn->prepare("DELETE FROM sessions WHERE session_id = ?");
                    $stmt->bind_param("i", $sessionId);
                    if (!$stmt->execute()) {
                        throw new Exception("Failed to delete session: " . $stmt->error);
                    }
                    $rowsAffected = $stmt->affected_rows;
                    $stmt->close();
                }

                // Update auth balances
                $totalHoursReturned = 0;
                foreach ($hoursReturnByAuth as $key => $hrs) {
                    [$clientId, $authIdStr] = explode('|', $key);
                    $authId = (int)$authIdStr;
                    if ($hrs != 0) {
                        $totalHoursReturned += (float)$hrs;
                        if (!updateClientAuthUnitsScheduled($conn, $clientId, $authId, (float)$hrs)) {
                            throw new Exception("Failed to update client_auth balance_units for auth_id=$authId");
                        }
                    }
                }

                $conn->commit();
                echo json_encode([
                    "success" => true,
                    "message" => "Session(s) deleted successfully",
                    "rows_affected" => $rowsAffected,
                    "edit_mode" => $editMode,
                    "sessions_deleted" => $deletedIds,
                    "total_hours_returned" => $totalHoursReturned
                ]);
            } catch (Exception $e) {
                $conn->rollback();
                http_response_code(500);
                echo json_encode(["error" => "Failed to delete session(s): " . $e->getMessage()]);
                file_put_contents('debug.log', "DELETE Transaction failed: " . $e->getMessage() . "\n", FILE_APPEND);
                exit();
            }
            break;

        default:
            http_response_code(405);
            echo json_encode(["error" => "Method not allowed"]);
            break;
    }
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => "Internal server error", "message" => $e->getMessage()]);
    file_put_contents('debug.log', "Exception: " . $e->getMessage() . "\n", FILE_APPEND);
}

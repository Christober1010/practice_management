<?php
// =======
// SESSION MANAGEMENT API - UNIFIED DATETIME + PROVIDER (with provider names)
// =======

// CORS headers - MUST be first
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Enable error reporting for debugging (disable in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Handle OPTIONS request (CORS preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// DB Connection
$host = "db5018266079.hosting-data.io";
$database = "dbs14484433";
$username = "dbu3321929";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";

try {
    $conn = new mysqli($host, $username, $password, $database);
    if ($conn->connect_error) {
        error_log("Database connection failed: " . $conn->connect_error);
        http_response_code(500);
        echo json_encode(["error" => "Database connection failed"]);
        exit();
    }
} catch (Exception $e) {
    error_log("Database connection exception: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit();
}

// Get request method and input
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents("php://input"), true);
error_log("Session API - Method: " . $method);
if ($input) {
    error_log("Session API - Input: " . json_encode($input));
}

// Helper function to convert datetime-local to MySQL datetime
function convertToMySQLDateTime($datetime)
{
    if (empty($datetime)) return null;
    if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $datetime)) {
        $datetime .= ':00';
    }
    return str_replace('T', ' ', $datetime);
}

try {
    switch ($method) {
        // CREATE session
        case "POST":
            error_log("Session API - Creating session for client: " . ($input['clientId'] ?? 'missing'));

            if (!isset($input['clientId'], $input['provider'], $input['providerName'], $input['startDateTime'], $input['endDateTime'])) {
                http_response_code(400);
                echo json_encode([
                    "error" => "Missing required fields",
                    "required" => ["clientId", "provider", "providerName", "startDateTime", "endDateTime"]
                ]);
                exit();
            }

            $clientId = $input['clientId'];
            $provider = $input['provider'];
            $providerName = $input['providerName'];
            $supervisingProvider = $input['supervisingProvider'] ?? null;
            $supervisingProviderName = $input['supervisingProviderName'] ?? null;

            // Validate provider ID
            $providerCheck = $conn->prepare("SELECT id FROM staff WHERE id = ?");
            $providerCheck->bind_param("s", $provider);
            $providerCheck->execute();
            $providerResult = $providerCheck->get_result();
            if ($providerResult->num_rows === 0) {
                http_response_code(400);
                echo json_encode(["error" => "Invalid provider ID", "provided_provider" => $provider]);
                exit();
            }
            $providerCheck->close();

            // Validate supervising provider ID if provided
            if (!empty($supervisingProvider)) {
                $spCheck = $conn->prepare("SELECT id FROM staff WHERE id = ?");
                $spCheck->bind_param("s", $supervisingProvider);
                $spCheck->execute();
                $spRes = $spCheck->get_result();
                if ($spRes->num_rows === 0) {
                    http_response_code(400);
                    echo json_encode(["error" => "Invalid supervising provider ID", "provided_supervising_provider" => $supervisingProvider]);
                    exit();
                }
                $spCheck->close();
            }

            // Validate ENUM values
            $validRecurring = ['No', 'Daily', 'Weekly', 'Biweekly', 'Monthly'];
            $validPlaceOfService = ['Home', 'Clinic', 'School', 'Virtual', 'Other'];
            $validStatus = ['upcoming', 'in-progress', 'confirmed', 'cancelled', 'completed'];

            $recurring = $input['recurring'] ?? 'No';
            $placeOfService = $input['placeOfService'] ?? 'Clinic';
            $status = $input['status'] ?? 'upcoming';

            if (
                !in_array($recurring, $validRecurring) ||
                !in_array($placeOfService, $validPlaceOfService) ||
                !in_array($status, $validStatus)
            ) {
                http_response_code(400);
                echo json_encode([
                    "error" => "Invalid ENUM values",
                    "validRecurring" => $validRecurring,
                    "validPlaceOfService" => $validPlaceOfService,
                    "validStatus" => $validStatus
                ]);
                exit();
            }

            $startMySQL = convertToMySQLDateTime($input['startDateTime']);
            $endMySQL = convertToMySQLDateTime($input['endDateTime']);
            $startTz = $input['startTZ'] ?? null;
            $endTz = $input['endTZ'] ?? null;
            $authCode = $input['authCode'] ?? null;
            $locationAddress = $input['locationAddress'] ?? null;
            $quickNote = $input['quickNote'] ?? null;

            // INSERT with provider names
            // Fixed INSERT statement - corrected from 16 to 15 parameter placeholders
            $stmt = $conn->prepare("INSERT INTO sessions (
    client_id,
    provider_id,
    provider_name,
    supervising_provider_id,
    supervising_provider_name,
    start_utc,
    end_utc,
    start_tz,
    end_tz,
    auth_code,
    recurring,
    place_of_service,
    location_address,
    quick_note,
    status
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            // Fixed bind_param - corrected from 16 to 15 's' parameters
            $stmt->bind_param(
                "sssssssssssssss", // 15 's' parameters (was 16)
                $clientId,
                $provider,
                $providerName,
                $supervisingProvider,
                $supervisingProviderName,
                $startMySQL,
                $endMySQL,
                $startTz,
                $endTz,
                $authCode,
                $recurring,
                $placeOfService,
                $locationAddress,
                $quickNote,
                $status
            );


            if ($stmt->execute()) {
                echo json_encode(["success" => true, "session_id" => $stmt->insert_id]);
            } else {
                http_response_code(500);
                echo json_encode(["error" => "Failed to create session", "details" => $stmt->error]);
            }
            $stmt->close();
            break;

        // READ sessions
        case "GET":
            if (isset($_GET['id'])) {
                $stmt = $conn->prepare("SELECT * FROM sessions WHERE session_id = ?");
                $stmt->bind_param("i", $_GET['id']);
                $stmt->execute();
                $result = $stmt->get_result();
                $session = $result->fetch_assoc();
                echo $session ? json_encode($session) : json_encode(["error" => "Session not found"]);
                $stmt->close();
            } else {
                $result = $conn->query("SELECT * FROM sessions ORDER BY start_utc DESC");
                $rows = [];
                while ($row = $result->fetch_assoc()) $rows[] = $row;
                echo json_encode($rows);
            }
            break;

        // UPDATE session
        case "PUT":
            if (!isset($input['session_id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing session ID"]);
                exit();
            }

            $validRecurring = ['No', 'Daily', 'Weekly', 'Biweekly', 'Monthly'];
            $validPlaceOfService = ['Home', 'Clinic', 'School', 'Virtual', 'Other'];
            $validStatus = ['upcoming', 'in-progress', 'confirmed', 'cancelled', 'completed'];

            if (isset($input['recurring']) && !in_array($input['recurring'], $validRecurring)) {
                http_response_code(400);
                echo json_encode(["error" => "Invalid recurring"]);
                exit();
            }
            if (isset($input['placeOfService']) && !in_array($input['placeOfService'], $validPlaceOfService)) {
                http_response_code(400);
                echo json_encode(["error" => "Invalid placeOfService"]);
                exit();
            }
            if (isset($input['status']) && !in_array($input['status'], $validStatus)) {
                http_response_code(400);
                echo json_encode(["error" => "Invalid status"]);
                exit();
            }

            // Optional provider validation
            if (!empty($input['provider'])) {
                $pchk = $conn->prepare("SELECT id FROM staff WHERE id = ?");
                $pchk->bind_param("s", $input['provider']);
                $pchk->execute();
                $pres = $pchk->get_result();
                if ($pres->num_rows === 0) {
                    http_response_code(400);
                    echo json_encode(["error" => "Invalid provider ID"]);
                    exit();
                }
                $pchk->close();
            }

            // Optional supervising provider validation
            if (!empty($input['supervisingProvider'])) {
                $spCheck = $conn->prepare("SELECT id FROM staff WHERE id = ?");
                $spCheck->bind_param("s", $input['supervisingProvider']);
                $spCheck->execute();
                $spRes = $spCheck->get_result();
                if ($spRes->num_rows === 0) {
                    http_response_code(400);
                    echo json_encode(["error" => "Invalid supervising provider ID"]);
                    exit();
                }
                $spCheck->close();
            }

            $startMySQL = isset($input['startDateTime']) ? convertToMySQLDateTime($input['startDateTime']) : null;
            $endMySQL = isset($input['endDateTime']) ? convertToMySQLDateTime($input['endDateTime']) : null;

            $fields = [];
            $params = [];
            $types = "";

            $map = [
                "clientId" => ["client_id", "s"],
                "provider" => ["provider_id", "s"],
                "providerName" => ["provider_name", "s"],
                "supervisingProvider" => ["supervising_provider_id", "s"],
                "supervisingProviderName" => ["supervising_provider_name", "s"],
                "startTZ" => ["start_tz", "s"],
                "endTZ" => ["end_tz", "s"],
                "authCode" => ["auth_code", "s"],
                "recurring" => ["recurring", "s"],
                "placeOfService" => ["place_of_service", "s"],
                "locationAddress" => ["location_address", "s"],
                "quickNote" => ["quick_note", "s"],
                "status" => ["status", "s"],
            ];

            foreach ($map as $key => [$col, $t]) {
                if (array_key_exists($key, $input)) {
                    $fields[] = "$col = ?";
                    $types .= $t;
                    $params[] = $input[$key] === "" ? null : $input[$key];
                }
            }

            if ($startMySQL !== null) {
                $fields[] = "start_utc = ?";
                $types .= "s";
                $params[] = $startMySQL;
            }
            if ($endMySQL !== null) {
                $fields[] = "end_utc = ?";
                $types .= "s";
                $params[] = $endMySQL;
            }

            if (empty($fields)) {
                http_response_code(400);
                echo json_encode(["error" => "No fields to update"]);
                exit();
            }

            $fieldsSql = implode(", ", $fields);
            $sql = "UPDATE sessions SET $fieldsSql WHERE session_id = ?";
            $stmt = $conn->prepare($sql);

            $types .= "i";
            $params[] = $input['session_id'];
            $stmt->bind_param($types, ...$params);

            if ($stmt->execute()) {
                echo $stmt->affected_rows > 0
                    ? json_encode(["success" => true, "message" => "Session updated successfully"])
                    : json_encode(["error" => "Session not found or no changes made"]);
            } else {
                http_response_code(500);
                echo json_encode(["error" => "Failed to update session", "details" => $stmt->error]);
            }
            $stmt->close();
            break;

        // DELETE session (soft delete)
        case "DELETE":
            if (!isset($_GET['id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing session ID"]);
                exit();
            }
            $stmt = $conn->prepare("UPDATE sessions SET status = 'cancelled' WHERE session_id = ?");
            $stmt->bind_param("i", $_GET['id']);
            $stmt->execute();
            echo $stmt->affected_rows > 0
                ? json_encode(["success" => true, "message" => "Session cancelled successfully"])
                : json_encode(["error" => "Session not found"]);
            $stmt->close();
            break;

        default:
            http_response_code(405);
            echo json_encode(["error" => "Method not allowed"]);
    }
} catch (Exception $e) {
    error_log("Session API - Unexpected error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Internal server error", "details" => $e->getMessage()]);
}

$conn->close();

<?php
// ===============================
// SESSION MANAGEMENT API - FIXED
// ===============================

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
$host = "db5018419668.hosting-data.io";
$database = "dbs14649042";
$username = "dbu1183438";
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
function convertToMySQLDateTime($datetime) {
    if (empty($datetime)) return null;
    
    // If it doesn't have seconds, add them
    if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $datetime)) {
        $datetime .= ':00';
    }
    
    // Convert from datetime-local format (YYYY-MM-DDTHH:MM:SS) to MySQL format (YYYY-MM-DD HH:MM:SS)
    return str_replace('T', ' ', $datetime);
}

// ===============================
// SESSION CRUD HANDLER
// ===============================
try {
    switch ($method) {

        // CREATE session
        case "POST":
            error_log("Session API - Creating session for client: " . ($input['clientId'] ?? 'missing'));
            
            // DEBUG: Test database connection and tables
            $debugResult = $conn->query("SELECT DATABASE()");
            if ($debugResult) {
                $db = $debugResult->fetch_row();
                error_log("DEBUG: Current database: " . $db[0]);
            }
            
            $debugResult = $conn->query("SHOW TABLES");
            if ($debugResult) {
                $tables = [];
                while ($row = $debugResult->fetch_row()) {
                    $tables[] = $row[0];
                }
                error_log("DEBUG: Available tables: " . implode(", ", $tables));
            }
            
            // DEBUG: Test sessions table specifically
            $debugResult = $conn->query("DESCRIBE sessions");
            if ($debugResult) {
                error_log("DEBUG: Sessions table exists and is accessible");
                while ($row = $debugResult->fetch_assoc()) {
                    error_log("DEBUG: Sessions column: " . $row['Field'] . " (" . $row['Type'] . ")");
                }
            } else {
                error_log("DEBUG: Cannot access sessions table: " . $conn->error);
            }
            
            // Validate required fields
            if (!isset($input['clientId'], $input['therapist'], $input['tech']['start'], $input['tech']['end'])) {
                error_log("Session API - Missing required fields");
                http_response_code(400);
                echo json_encode([
                    "error" => "Missing required fields", 
                    "required" => ["clientId", "therapist", "tech.start", "tech.end"]
                ]);
                exit();
            }

            // FIXED: Validate that therapist exists in staff table using correct column name
            $therapist = $input['therapist'];
            $therapistCheck = $conn->prepare("SELECT id FROM staff WHERE id = ?");
            if ($therapistCheck) {
                $therapistCheck->bind_param("s", $therapist);
                if (!$therapistCheck->execute()) {
                    error_log("DEBUG: Failed to execute staff query: " . $therapistCheck->error);
                    http_response_code(500);
                    echo json_encode(["error" => "Failed to execute staff validation", "details" => $therapistCheck->error]);
                    exit();
                }
                $therapistResult = $therapistCheck->get_result();
                if ($therapistResult->num_rows === 0) {
                    error_log("Session API - Invalid therapist ID: " . $therapist);
                    http_response_code(400);
                    echo json_encode([
                        "error" => "Invalid therapist ID. Therapist must exist in staff table.",
                        "provided_therapist" => $therapist
                    ]);
                    $therapistCheck->close();
                    exit();
                }
                error_log("DEBUG: Therapist validation passed");
                $therapistCheck->close();
            }

            // Check if client exists - you'll need a separate clients table for this
            // Commenting out for now since we need to clarify your clients table structure
            $clientId = $input['clientId'];
            // TODO: Add client validation once clients table structure is confirmed

            // Validate ENUM values
            $validRecurring = ['No', 'Daily', 'Weekly', 'Biweekly', 'Monthly'];
            $validPlaceOfService = ['Home', 'Clinic', 'School', 'Virtual', 'Other'];
            $validStatus = ['upcoming', 'in-progress', 'confirmed', 'cancelled', 'completed'];
            
            $recurring = $input['recurring'] ?? 'No';
            $placeOfService = $input['placeOfService'] ?? 'Clinic';
            $status = $input['status'] ?? 'upcoming';
            
            if (!in_array($recurring, $validRecurring) || 
                !in_array($placeOfService, $validPlaceOfService) || 
                !in_array($status, $validStatus)) {
                error_log("Session API - Invalid ENUM values");
                http_response_code(400);
                echo json_encode([
                    "error" => "Invalid ENUM values",
                    "validRecurring" => $validRecurring,
                    "validPlaceOfService" => $validPlaceOfService,
                    "validStatus" => $validStatus
                ]);
                exit();
            }

            // Convert datetime fields to MySQL format
            $techStartMySQL = convertToMySQLDateTime($input['tech']['start']);
            $techEndMySQL = convertToMySQLDateTime($input['tech']['end']);
            $bcbaStartMySQL = convertToMySQLDateTime($input['bcba']['start'] ?? null);
            $bcbaEndMySQL = convertToMySQLDateTime($input['bcba']['end'] ?? null);

            error_log("Session API - Tech start MySQL format: " . $techStartMySQL);
            error_log("Session API - Tech end MySQL format: " . $techEndMySQL);

            // IMPORTANT: Make sure you have a 'sessions' table in your database
            // If your sessions table has a different name, update it here
            error_log("DEBUG: About to prepare INSERT statement for sessions table");
            $stmt = $conn->prepare("INSERT INTO sessions (
                client_id, 
                therapist_id, 
                tech_start_utc, 
                tech_end_utc, 
                tech_tz, 
                tech_auth_code,
                tech_auth_id,
                bcba_start_utc, 
                bcba_end_utc, 
                bcba_tz, 
                bcba_auth_code,
                bcba_auth_id,
                recurring, 
                place_of_service, 
                location_address, 
                quick_note, 
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            
            if (!$stmt) {
                error_log("Session API - Prepare failed: " . $conn->error);
                error_log("DEBUG: Failed to prepare INSERT statement - this is likely where the 'id' error occurs");
                http_response_code(500);
                echo json_encode(["error" => "Database prepare failed", "details" => $conn->error]);
                exit();
            }
            error_log("DEBUG: INSERT statement prepared successfully");
            
            // Set up variables
            $therapist = $input['therapist'];
            $techTz = $input['tech']['timeZone'] ?? null;
            $techAuthCode = $input['tech']['authCode'] ?? null;
            $techAuthId = null;
            $bcbaTz = isset($input['bcba']['timeZone']) ? $input['bcba']['timeZone'] : null;
            $bcbaAuthCode = isset($input['bcba']['authCode']) ? $input['bcba']['authCode'] : null;
            $bcbaAuthId = null;
            $locationAddress = $input['locationAddress'] ?? null;
            $quickNote = $input['quickNote'] ?? null;
            
            // Bind parameters - 17 parameters total
            $stmt->bind_param(
                "ssssssissssisssss",
                $clientId,
                $therapist,
                $techStartMySQL,
                $techEndMySQL,
                $techTz,
                $techAuthCode,
                $techAuthId,
                $bcbaStartMySQL,
                $bcbaEndMySQL,
                $bcbaTz,
                $bcbaAuthCode,
                $bcbaAuthId,
                $recurring,
                $placeOfService,
                $locationAddress,
                $quickNote,
                $status
            );
            
            if ($stmt->execute()) {
                $insertId = $stmt->insert_id;
                error_log("Session API - Session created successfully with ID: " . $insertId);
                echo json_encode([
                    "success" => true, 
                    "session_id" => $insertId,
                    "message" => "Session created successfully"
                ]);
            } else {
                error_log("Session API - Execute failed: " . $stmt->error);
                http_response_code(500);
                echo json_encode([
                    "error" => "Failed to create session", 
                    "details" => $stmt->error
                ]);
            }
            $stmt->close();
            break;

        // READ sessions (all or by ID)
        case "GET":
            if (isset($_GET['id'])) {
                $stmt = $conn->prepare("SELECT * FROM sessions WHERE session_id = ?");
                if (!$stmt) {
                    http_response_code(500);
                    echo json_encode(["error" => "Database prepare failed"]);
                    exit();
                }
                $stmt->bind_param("i", $_GET['id']);
                $stmt->execute();
                $result = $stmt->get_result();
                $session = $result->fetch_assoc();
                
                if ($session) {
                    echo json_encode($session);
                } else {
                    http_response_code(404);
                    echo json_encode(["error" => "Session not found"]);
                }
                $stmt->close();
            } else {
                $result = $conn->query("SELECT * FROM sessions ORDER BY tech_start_utc DESC");
                if (!$result) {
                    http_response_code(500);
                    echo json_encode(["error" => "Database query failed"]);
                    exit();
                }
                
                $rows = [];
                while ($row = $result->fetch_assoc()) {
                    $rows[] = $row;
                }
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

            // Validate ENUM values
            $validRecurring = ['No', 'Daily', 'Weekly', 'Biweekly', 'Monthly'];
            $validPlaceOfService = ['Home', 'Clinic', 'School', 'Virtual', 'Other'];
            $validStatus = ['upcoming', 'in-progress', 'confirmed', 'cancelled', 'completed'];
            
            $recurring = $input['recurring'] ?? 'No';
            $placeOfService = $input['placeOfService'] ?? 'Clinic';
            $status = $input['status'] ?? 'upcoming';
            
            if (!in_array($recurring, $validRecurring) || 
                !in_array($placeOfService, $validPlaceOfService) || 
                !in_array($status, $validStatus)) {
                http_response_code(400);
                echo json_encode([
                    "error" => "Invalid ENUM values",
                    "validRecurring" => $validRecurring,
                    "validPlaceOfService" => $validPlaceOfService,
                    "validStatus" => $validStatus
                ]);
                exit();
            }

            // Convert datetime fields
            $techStartMySQL = convertToMySQLDateTime($input['tech']['start'] ?? null);
            $techEndMySQL = convertToMySQLDateTime($input['tech']['end'] ?? null);
            $bcbaStartMySQL = convertToMySQLDateTime($input['bcba']['start'] ?? null);
            $bcbaEndMySQL = convertToMySQLDateTime($input['bcba']['end'] ?? null);

            // UPDATE statement
            $stmt = $conn->prepare("UPDATE sessions SET 
                client_id=?, 
                therapist_id=?, 
                tech_start_utc=?, 
                tech_end_utc=?, 
                tech_tz=?, 
                tech_auth_code=?,
                tech_auth_id=?,
                bcba_start_utc=?, 
                bcba_end_utc=?, 
                bcba_tz=?, 
                bcba_auth_code=?,
                bcba_auth_id=?,
                recurring=?, 
                place_of_service=?, 
                location_address=?, 
                quick_note=?, 
                status=?
                WHERE session_id=?");
            
            if (!$stmt) {
                error_log("Session API - Prepare failed: " . $conn->error);
                http_response_code(500);
                echo json_encode(["error" => "Database prepare failed", "details" => $conn->error]);
                exit();
            }
            
            $clientId = $input['clientId'];
            $therapist = $input['therapist'];
            $techTz = $input['tech']['timeZone'] ?? null;
            $techAuthCode = $input['tech']['authCode'] ?? null;
            $techAuthId = null;
            $bcbaTz = isset($input['bcba']['timeZone']) ? $input['bcba']['timeZone'] : null;
            $bcbaAuthCode = isset($input['bcba']['authCode']) ? $input['bcba']['authCode'] : null;
            $bcbaAuthId = null;
            $locationAddress = $input['locationAddress'] ?? null;
            $quickNote = $input['quickNote'] ?? null;
            $sessionId = $input['session_id'];
            
            // Bind parameters - 18 parameters total
            $stmt->bind_param(
                "ssssssissssisssssi",
                $clientId,
                $therapist,
                $techStartMySQL,
                $techEndMySQL,
                $techTz,
                $techAuthCode,
                $techAuthId,
                $bcbaStartMySQL,
                $bcbaEndMySQL,
                $bcbaTz,
                $bcbaAuthCode,
                $bcbaAuthId,
                $recurring,
                $placeOfService,
                $locationAddress,
                $quickNote,
                $status,
                $sessionId
            );
            
            if ($stmt->execute()) {
                if ($stmt->affected_rows > 0) {
                    error_log("Session API - Session updated successfully with ID: " . $input['session_id']);
                    echo json_encode(["success" => true, "message" => "Session updated successfully"]);
                } else {
                    http_response_code(404);
                    echo json_encode(["error" => "Session not found or no changes made"]);
                }
            } else {
                error_log("Session API - Execute failed: " . $stmt->error);
                http_response_code(500);
                echo json_encode(["error" => "Failed to update session", "details" => $stmt->error]);
            }
            $stmt->close();
            break;

        // DELETE session (soft delete - set status to cancelled)
        case "DELETE":
            if (!isset($_GET['id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing session ID"]);
                exit();
            }

            $stmt = $conn->prepare("UPDATE sessions SET status = 'cancelled' WHERE session_id = ?");
            if (!$stmt) {
                http_response_code(500);
                echo json_encode(["error" => "Database prepare failed"]);
                exit();
            }
            
            $stmt->bind_param("i", $_GET['id']);
            if ($stmt->execute()) {
                if ($stmt->affected_rows > 0) {
                    error_log("Session API - Session cancelled successfully with ID: " . $_GET['id']);
                    echo json_encode(["success" => true, "message" => "Session cancelled successfully"]);
                } else {
                    http_response_code(404);
                    echo json_encode(["error" => "Session not found"]);
                }
            } else {
                error_log("Session API - Execute failed: " . $stmt->error);
                http_response_code(500);
                echo json_encode(["error" => "Failed to cancel session"]);
            }
            $stmt->close();
            break;

        default:
            http_response_code(405);
            echo json_encode(["error" => "Method not allowed"]);
            break;
    }
} catch (Exception $e) {
    error_log("Session API - Unexpected error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Internal server error", "details" => $e->getMessage()]);
}

$conn->close();
?>
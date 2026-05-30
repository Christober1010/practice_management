<?php
// CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Test DB — same as config.php getDBConnection() / add-session.php
$host = "db5018419668.hosting-data.io";
$user = "dbu1183438";
$pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$db   = "dbs14649042";

// Connect DB
$conn = new mysqli($host, $user, $pass, $db);

// Check connection
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit;
}

// Fetch sessions
$sql = "SELECT id, client_id, staff_id, session_date, session_time, session_type, notes, created_at 
        FROM sessions 
        ORDER BY created_at DESC";

$result = $conn->query($sql);

if (!$result) {
    http_response_code(500);
    echo json_encode(["error" => "Query failed: " . $conn->error]);
    exit;
}

$sessions = [];
while ($row = $result->fetch_assoc()) {
    $sessions[] = $row;
}

// Return JSON
echo json_encode([
    "success" => true,
    "sessions" => $sessions
]);

$conn->close();
?>

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

// Database config
$host = "db5015906524.hosting-data.io"; 
$user = "dbu1350454"; 
$pass = "Christo@2024"; 
$db   = "dbs12924256";

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

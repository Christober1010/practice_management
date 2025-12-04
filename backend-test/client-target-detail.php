<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

$host = "db5018419668.hosting-data.io";
$user = "dbu1183438";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14649042";

$conn = new mysqli($host, $user, $password, $database);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$targetId = $_GET['target_id'] ?? null;

if (!$targetId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Target ID is required']);
    exit();
}

$targetId = $conn->real_escape_string($targetId);

$prompts = [];
$promptQuery = "SELECT * FROM client_prompts WHERE target_id = '$targetId' ORDER BY created_at DESC";
$promptResult = $conn->query($promptQuery);
if ($promptResult) {
    while ($row = $promptResult->fetch_assoc()) {
        $prompts[] = $row;
    }
}

echo json_encode([
    'success' => true,
    'data' => [
        'prompts' => $prompts,
    ]
]);

$conn->close();
?>

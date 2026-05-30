<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Accept');

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
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = requireAuthReadWrite('master_data.read', 'master_data.write', 'mahaverse');



$programId = $_GET['program_id'] ?? null;

if (!$programId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Program ID is required']);
    exit();

}

$programId = $conn->real_escape_string($programId);

$targets = [];
$targetQuery = "SELECT * FROM client_targets WHERE program_id = '$programId' ORDER BY created_at DESC";
$targetResult = $conn->query($targetQuery);
if ($targetResult) {
    while ($row = $targetResult->fetch_assoc()) {
        $targets[] = $row;
    }
}

echo json_encode([
    'success' => true,
    'data' => [
        'targets' => $targets,
    ]
]);

$conn->close();
?>

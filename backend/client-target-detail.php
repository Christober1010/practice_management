<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Accept');

$host = "db5018266079.hosting-data.io";
$user = "dbu3321929";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14484433";

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

<?php
// Set CORS headers at the very start
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Accept');

// Handle OPTIONS preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = requireAuthReadWrite('master_data.read', 'master_data.write', 'mahaverse');



// Database connection
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

$conn->set_charset('utf8mb4');

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        handleGet($conn);
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
} finally {
    $conn->close();
}

function handleGet($conn)
{
    $domainId = $_GET['domain_id'] ?? null;

    if (!$domainId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Domain ID is required']);
        return;
    }

    $domainId = $conn->real_escape_string($domainId);

    // Fetch programs for this domain
    $programs = [];
    $programQuery = "SELECT * FROM client_programs WHERE domain_id = '$domainId' ORDER BY created_at DESC";
    $programResult = $conn->query($programQuery);
    if ($programResult) {
        while ($row = $programResult->fetch_assoc()) {
            $programs[] = $row;
        }
    }

    // Fetch targets/activities for this domain's programs
    $targets = [];
    if (!empty($programs)) {
        $programIds = array_map(function($p) { return $p['id']; }, $programs);
        $escapedIds = array_map([$conn, 'real_escape_string'], $programIds);
        $idsList = "'" . implode("','", $escapedIds) . "'";

        $targetQuery = "SELECT * FROM client_targets WHERE program_id IN ($idsList) ORDER BY created_at DESC";
        $targetResult = $conn->query($targetQuery);
        if ($targetResult) {
            while ($row = $targetResult->fetch_assoc()) {
                $targets[] = $row;
            }
        }
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'programs' => $programs,
            'targets' => $targets
        ]
    ]);
}
?>

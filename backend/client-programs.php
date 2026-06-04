<?php
// Set CORS headers at the top
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Accept');

// Handle OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = requireAuthReadWrite('master_data.read', 'master_data.write', 'mahaverse');



// Database connection info
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
    $clientId = $_GET['client_id'] ?? null;
    if (!$clientId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Client ID is required']);
        return;
    }
    $clientId = $conn->real_escape_string($clientId);

    // Fetch domains belonging to this client
    $domains = [];
    $domainQuery = "SELECT * FROM client_domains WHERE client_id = '$clientId' ORDER BY name ASC";
    $domainResult = $conn->query($domainQuery);
    if ($domainResult) {
        while ($row = $domainResult->fetch_assoc()) {
            $domains[] = $row;
        }
    }

    // Fetch modules belonging to this client
    $modules = [];
    $moduleQuery = "SELECT * FROM client_modules WHERE client_id = '$clientId' ORDER BY name ASC";
    $moduleResult = $conn->query($moduleQuery);
    if ($moduleResult) {
        while ($row = $moduleResult->fetch_assoc()) {
            $modules[] = $row;
        }
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'domains' => $domains,
            'modules' => $modules,
        ]
    ]);
}
?>

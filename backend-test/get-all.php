<?php
// CORS + JSON headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Preflight for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

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

// Fetch all modules with client information
$sql = "
    SELECT 
        cm.id,
        cm.client_id,
        cm.NAME,
        cm.description,
        cm.STATUS,
        cm.archived,
        cm.created_at,
        cm.updated_at,
        c.client_name
    FROM client_modules cm
    LEFT JOIN clients c ON cm.client_id = c.client_id
    ORDER BY cm.NAME, c.client_name
";
$result = $conn->query($sql);

$modules = [];
$clients = []; // For dropdown options

if ($result) {
    while ($row = $result->fetch_assoc()) {
        // Collect client names for dropdown
        if ($row['client_name'] && !in_array($row['client_name'], $clients)) {
            $clients[] = $row['client_name'];
        }
        
        // Normalize module data
        $modules[] = [
            'id' => $row['id'],
            'client_id' => $row['client_id'],
            'name' => $row['NAME'],
            'description' => $row['description'] ?? '',
            'status' => $row['STATUS'] ?? 'Active',
            'archived' => $row['archived'] == 1 || $row['archived'] === true,
            'client_name' => $row['client_name'] ?? 'Unknown Client',
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at']
        ];
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Query failed: ' . $conn->error]);
    exit();
}

echo json_encode([
    'success' => true, 
    'modules' => $modules,
    'clients' => $clients
]);

$conn->close();
?>

<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $host = "db5018419668.hosting-data.io";
    $user = "dbu1183438";
    $password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
    $database = "dbs14649042";

    $conn = new mysqli($host, $user, $password, $database);
    if ($conn->connect_error) {
        throw new Exception("Connection failed");
    }
    $conn->set_charset('utf8mb4');

    // First: Get the actual column name for client name from clients table
    $nameColumn = 'client_name'; // default guess

    $colsResult = $conn->query("SHOW COLUMNS FROM clients LIKE '%name%'");
    if ($colsResult && $colsResult->num_rows > 0) {
        $row = $colsResult->fetch_assoc();
        $nameColumn = $row['Field']; // This will be: client_name, name, full_name, etc.
    }

    // Now build the query safely
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
            COALESCE(c.`$nameColumn`, 'Unknown Client') AS client_display_name
        FROM client_modules cm
        LEFT JOIN clients c ON cm.client_id = c.client_id
        ORDER BY client_display_name, cm.NAME
    ";

    $result = $conn->query($sql);
    if (!$result) {
        throw new Exception("Query failed: " . $conn->error);
    }

    $modules = [];
    $clients = [];

    while ($row = $result->fetch_assoc()) {
        $clientName = $row['client_display_name'];

        // Add client to list (unique)
        if (!in_array($clientName, $clients, true)) {
            $clients[] = $clientName;
        }

        $modules[] = [
            'id'               => $row['id'],
            'client_id'        => $row['client_id'],
            'name'             => $row['NAME'] ?? 'Unnamed Module',
            'description'      => $row['description'] ?? '',
            'status'           => $row['STATUS'] ?? 'Active',
            'archived'         => (bool)$row['archived'],
            'client_name'      => $clientName,
            'created_at'       => $row['created_at'],
            'updated_at'       => $row['updated_at']
        ];
    }

    // Sort clients alphabetically
    sort($clients);

    echo json_encode([
        'success' => true,
        'modules' => $modules,
        'clients' => $clients
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
} finally {
    if (isset($conn)) $conn->close();
}
?>
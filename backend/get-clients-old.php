<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = "db5018266079.hosting-data.io";
$dbname = "dbs14484433";
$user = "dbu3321929";
$pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $clientsData = [];

    // 1. Fetch all clients
    $stmtClients = $conn->query("SELECT * FROM clients ORDER BY created_at DESC");
    while ($client = $stmtClients->fetch(PDO::FETCH_ASSOC)) {
        $client['insurances'] = [];
        $client['authorizations'] = [];
        $client['documents'] = []; // Initialize documents array
        $clientsData[$client['client_id']] = $client; // Use client_id as the unique key
    }

    // 2. Fetch all insurances and group by client_id
    $stmtInsurances = $conn->query("SELECT * FROM client_insurance");
    $insurancesByClient = [];
    while ($insurance = $stmtInsurances->fetch(PDO::FETCH_ASSOC)) {
        $insurancesByClient[$insurance['client_id']][] = $insurance;
    }

    // 3. Fetch all authorizations and group by client_id (via linked insurance)
    $stmtAuthorizations = $conn->query("
        SELECT ca.*, ci.client_id
        FROM client_auth ca
        JOIN client_insurance ci ON ca.insurance_id = ci.insurance_id
    ");
    $authorizationsByClient = [];
    while ($auth = $stmtAuthorizations->fetch(PDO::FETCH_ASSOC)) {
        $clientId = $auth['client_id'];
        unset($auth['client_id']); // Remove client_id from auth object itself
        $authorizationsByClient[$clientId][] = $auth;
    }

    // 4. Fetch all documents and group by client_id
    $stmtDocuments = $conn->query("SELECT * FROM client_documents");
    $documentsByClient = [];
    while ($document = $stmtDocuments->fetch(PDO::FETCH_ASSOC)) {
        $documentsByClient[$document['client_id']][] = $document;
    }

    // 5. Combine all data
    foreach ($clientsData as $clientId => &$client) {
        if (isset($insurancesByClient[$clientId])) {
            $client['insurances'] = $insurancesByClient[$clientId];
        }
        if (isset($authorizationsByClient[$clientId])) {
            $client['authorizations'] = $authorizationsByClient[$clientId];
        }
        if (isset($documentsByClient[$clientId])) {
            $client['documents'] = $documentsByClient[$clientId]; // Assign documents
        }
    }
    unset($client); // Break the reference

    echo json_encode(["success" => true, "clients" => array_values($clientsData)]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>

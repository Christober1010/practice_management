<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json");
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}
$host = "db5018419668.hosting-data.io";
$dbname = "dbs14649042";
$user = "dbu1183438";
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
        $client['documents'] = [];
        $client['addresses'] = [];
        $client['availability'] = [];
        $clientsData[$client['client_id']] = $client;
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
        unset($auth['client_id']);
        $authorizationsByClient[$clientId][] = $auth;
    }
    // 4. Fetch all documents and group by client_id
    $stmtDocuments = $conn->query("SELECT * FROM client_documents");
    $documentsByClient = [];
    while ($document = $stmtDocuments->fetch(PDO::FETCH_ASSOC)) {
        $documentsByClient[$document['client_id']][] = $document;
    }
    $addressesByClient = [];
    try {
        $stmtAddresses = $conn->query("SELECT * FROM client_addresses");
        while ($address = $stmtAddresses->fetch(PDO::FETCH_ASSOC)) {
            $addressesByClient[$address['client_id']][] = $address;
        }
    } catch (PDOException $e) {
        // Table might not exist yet, ignore error
        error_log("client_addresses table not found: " . $e->getMessage());
    }
    // 5. Fetch all availability and group by client_id
    $availabilityByClient = [];
    try {
        $stmtAvailability = $conn->query("SELECT * FROM client_availability");
        while ($avail = $stmtAvailability->fetch(PDO::FETCH_ASSOC)) {
            $clientId = $avail['client_id'];
            $day = $avail['day'];
            $availabilityByClient[$clientId][$day] = [
                'available' => (bool) $avail['available'],
                'start' => $avail['start_time'],
                'end' => $avail['end_time']
            ];
        }
    } catch (PDOException $e) {
        // Table might not exist yet, ignore error
        error_log("client_availability table not found: " . $e->getMessage());
    }
    // 6. Combine all data
    foreach ($clientsData as $clientId => &$client) {
        if (isset($insurancesByClient[$clientId])) {
            $client['insurances'] = $insurancesByClient[$clientId];
        }
        if (isset($authorizationsByClient[$clientId])) {
            $client['authorizations'] = $authorizationsByClient[$clientId];
        }
        if (isset($documentsByClient[$clientId])) {
            $client['documents'] = $documentsByClient[$clientId];
        }
        
        $primaryAddress = [
            'id' => 1,
            'service_location' => $client['service_location'] ?? 'Home',
            'address_line_1' => $client['address_line_1'] ?? '',
            'address_line_2' => $client['address_line_2'] ?? '',
            'city' => $client['city'] ?? '',
            'state' => $client['state'] ?? '',
            'zipcode' => $client['zipcode'] ?? '',
            'country' => $client['country'] ?? 'USA',
            'countryOther' => ''
        ];
        
        $client['addresses'] = [$primaryAddress];
        
        if (isset($addressesByClient[$clientId])) {
            foreach ($addressesByClient[$clientId] as $index => $addr) {
                $client['addresses'][] = [
                    'id' => $index + 2,
                    'service_location' => $addr['service_location'] ?? 'Home',
                    'address_line_1' => $addr['address_line_1'] ?? '',
                    'address_line_2' => $addr['address_line_2'] ?? '',
                    'city' => $addr['city'] ?? '',
                    'state' => $addr['state'] ?? '',
                    'zipcode' => $addr['zipcode'] ?? '',
                    'country' => $addr['country'] ?? 'USA',
                    'countryOther' => ''
                ];
            }
        }

        if (isset($availabilityByClient[$clientId])) {
            $client['availability'] = $availabilityByClient[$clientId];
        }
    }
    unset($client);
    echo json_encode(["success" => true, "clients" => array_values($clientsData)]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>

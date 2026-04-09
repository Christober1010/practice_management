<?php
// CORS: run before any output. Preflight must not use JSON Content-Type.
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept, Accept-Language, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With");
header("Access-Control-Max-Age: 86400");

if (($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS") {
    http_response_code(204);
    exit();
}

header("Content-Type: application/json; charset=utf-8");

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$user = getAuthenticatedUser();
if ($user && !rbac_user_has_permission_key($user['role'], 'clients.read', 'mahaverse')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Permission denied']);
    exit;
}

$host = "db5018266079.hosting-data.io";
$dbname = "dbs14484433";
$user = "dbu3321929";
$pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // DEBUG: Let's see what's actually in the client_auth table
    $debugData = [];

    // Check if data was inserted
    $stmtDebugAuth = $conn->query("SELECT * FROM client_auth ORDER BY created_at DESC LIMIT 5");
    $allAuths = $stmtDebugAuth->fetchAll(PDO::FETCH_ASSOC);
    $debugData['all_authorizations'] = $allAuths;

    // Check specific auth_uuid from your payload
    $stmtSpecificAuth = $conn->prepare("SELECT * FROM client_auth WHERE auth_uuid = ?");
    $stmtSpecificAuth->execute(['auth_1758992039062']);
    $specificAuth = $stmtSpecificAuth->fetchAll(PDO::FETCH_ASSOC);
    $debugData['specific_auth'] = $specificAuth;

    // Check client_insurance table
    $stmtInsurance = $conn->query("SELECT insurance_id, client_id FROM client_insurance ORDER BY updated_at DESC LIMIT 5");
    $allInsurance = $stmtInsurance->fetchAll(PDO::FETCH_ASSOC);
    $debugData['recent_insurance'] = $allInsurance;

    // Check the specific client
    $stmtClient = $conn->prepare("SELECT client_id, first_name, last_name FROM clients WHERE client_id = ?");
    $stmtClient->execute(['ae97aa29-b87b-49fe-926e-740c192fdb69']);
    $clientInfo = $stmtClient->fetchAll(PDO::FETCH_ASSOC);
    $debugData['client_info'] = $clientInfo;

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

    // 2. Fetch all insurances with joined provider name and group by client_id
    $stmtInsurances = $conn->query("
    SELECT ci.*, 
           ci.provider_staff_id, 
           CONCAT(s.firstName, ' ', s.lastName) AS provider_name
    FROM client_insurance ci 
    LEFT JOIN staff s ON ci.provider_staff_id = s.id
");
    $insurancesByClient = [];
    $insuranceIdToClient = []; // Map insurance_id to client_id
    while ($insurance = $stmtInsurances->fetch(PDO::FETCH_ASSOC)) {
        $insurancesByClient[$insurance['client_id']][] = $insurance;
        $insuranceIdToClient[$insurance['insurance_id']] = $insurance['client_id'];
    }


    // 3. Fetch ALL authorizations and try to link them
    $authorizationsByClient = [];

    // Get all authorizations
    $stmtAllAuth = $conn->query("SELECT * FROM client_auth");
    while ($auth = $stmtAllAuth->fetch(PDO::FETCH_ASSOC)) {
        $clientId = null;

        // Try to link via insurance_id
        if (!empty($auth['insurance_id']) && isset($insuranceIdToClient[$auth['insurance_id']])) {
            $clientId = $insuranceIdToClient[$auth['insurance_id']];
        }

        // If we found a client connection, add it
        if ($clientId) {
            $authorizationsByClient[$clientId][] = $auth;
        } else {
            // Store unlinked authorizations for debugging
            $debugData['unlinked_authorizations'][] = $auth;
        }
    }

    // 4. Fetch documents
    $documentsByClient = [];
    try {
        // Try client_documents first (as used in old working code)
        $stmtDocuments = $conn->query("SELECT * FROM client_documents");
        while ($document = $stmtDocuments->fetch(PDO::FETCH_ASSOC)) {
            $documentsByClient[$document['client_id']][] = $document;
        }
    } catch (PDOException $e) {
        try {
            // Fallback to client_doc if client_documents doesn't exist
            $stmtDocuments = $conn->query("SELECT * FROM client_doc");
            while ($document = $stmtDocuments->fetch(PDO::FETCH_ASSOC)) {
                $documentsByClient[$document['client_id']][] = $document;
            }
        } catch (PDOException $e2) {
            $debugData['doc_error'] = "Both client_documents and client_doc failed: " . $e2->getMessage();
        }
    }

    // 5. Fetch addresses
    $addressesByClient = [];
    try {
        $stmtAddresses = $conn->query("SELECT * FROM client_addresses");
        while ($address = $stmtAddresses->fetch(PDO::FETCH_ASSOC)) {
            $addressesByClient[$address['client_id']][] = $address;
        }
    } catch (PDOException $e) {
        $debugData['address_error'] = $e->getMessage();
    }

    // 6. Fetch availability
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
        $debugData['availability_error'] = $e->getMessage();
    }

    // 7. Combine all data
    foreach ($clientsData as $clientId => &$client) {
        // Add insurances
        if (isset($insurancesByClient[$clientId])) {
            $client['insurances'] = $insurancesByClient[$clientId];
        }

        // Add authorizations
        if (isset($authorizationsByClient[$clientId])) {
            $client['authorizations'] = $authorizationsByClient[$clientId];
        }

        // Add documents
        if (isset($documentsByClient[$clientId])) {
            $client['documents'] = $documentsByClient[$clientId];
        }

        // // Build addresses
        // $primaryAddress = [
        //     'id' => 1,
        //     'service_location' => $client['service_location'] ?? 'Home',
        //     'address_line_1' => $client['address_line_1'] ?? '',
        //     'address_line_2' => $client['address_line_2'] ?? '',
        //     'city' => $client['city'] ?? '',
        //     'state' => $client['state'] ?? '',
        //     'zipcode' => $client['zipcode'] ?? '',
        //     'country' => $client['country'] ?? 'USA',
        //     'countryOther' => ''
        // ];

        // // Remove fake primaryAddress (these fields no longer exist in clients)
        // // Instead, rely entirely on client_addresses table

        // $client['addresses'] = [];

        // if (isset($addressesByClient[$clientId])) {
        //     foreach ($addressesByClient[$clientId] as $addr) {
        //         $client['addresses'][] = [
        //             'id' => $addr['id'] ?? null,
        //             'service_location' => $addr['service_location'] ?? 'Home',
        //             'address_line_1' => $addr['address_line_1'] ?? '',
        //             'address_line_2' => $addr['address_line_2'] ?? '',
        //             'city' => $addr['city'] ?? '',
        //             'state' => $addr['state'] ?? '',
        //             'zipcode' => $addr['zipcode'] ?? '',
        //             'country' => $addr['country'] ?? 'USA',
        //             'countryOther' => ''
        //         ];
        //     }
        // }
        $client['addresses'] = [];
        $primaryLocation = null; // Will hold the location field value

        if (isset($addressesByClient[$clientId])) {
            foreach ($addressesByClient[$clientId] as $addr) {
                $client['addresses'][] = [
                    'id' => $addr['id'] ?? null,
                    'service_location' => $addr['service_location'] ?? 'Home',
                    'address_line_1' => $addr['address_line_1'] ?? '',
                    'address_line_2' => $addr['address_line_2'] ?? '',
                    'city' => $addr['city'] ?? '',
                    'state' => $addr['state'] ?? '',
                    'zipcode' => $addr['zipcode'] ?? '',
                    'country' => $addr['country'] ?? 'USA',
                    'countryOther' => ''
                ];

                // Use first address's location field as the top-level location
                if ($primaryLocation === null) {
                    $primaryLocation = $addr['location'] ?? null;
                }
            }
        }

        // Add location field at top level (from the location column in client_addresses table)
        $client['location'] = $primaryLocation;

        // Add availability
        if (isset($availabilityByClient[$clientId])) {
            $client['availability'] = $availabilityByClient[$clientId];
        } else {
            $client['availability'] = [
                'monday' => ['available' => false, 'start' => null, 'end' => null],
                'tuesday' => ['available' => false, 'start' => null, 'end' => null],
                'wednesday' => ['available' => false, 'start' => null, 'end' => null],
                'thursday' => ['available' => false, 'start' => null, 'end' => null],
                'friday' => ['available' => false, 'start' => null, 'end' => null],
                'saturday' => ['available' => false, 'start' => null, 'end' => null],
                'sunday' => ['available' => false, 'start' => null, 'end' => null]
            ];
        }
    }
    unset($client);

    echo json_encode([
        "success" => true,
        "clients" => array_values($clientsData),
        "debug" => $debugData
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
}

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

    // Decode JSON input
    $input = json_decode(file_get_contents("php://input"), true);

    // --- DEBUGGING: Log the received input data ---
    error_log("Received input for update-clients.php: " . print_r($input, true));
    // --- END DEBUGGING ---

    // Validate required fields
    $required = ["client_id", "first_name", "last_name", "date_of_birth"];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Missing required field: $field"]);
            exit();
        }
    }

    $clientId = $input["client_id"];

    // Begin transaction for atomic operations
    $conn->beginTransaction();

    // Check if client exists
    $stmtCheck = $conn->prepare("SELECT COUNT(*) FROM clients WHERE client_id = :client_id");
    $stmtCheck->execute([":client_id" => $clientId]);
    $exists = $stmtCheck->fetchColumn() > 0;

    if ($exists) {
        // Update client
        $sql = "UPDATE clients SET
            client_uuid = :client_uuid,
            client_status = :client_status,
            wait_list_status = :wait_list_status,
            first_name = :first_name,
            middle_name = :middle_name,
            last_name = :last_name,
            date_of_birth = :date_of_birth,
            gender = :gender,
            preferred_language = :preferred_language,
            phone = :phone,
            email = :email,
            appointment_reminder = :appointment_reminder,
            address_line_1 = :address_line_1,
            address_line_2 = :address_line_2,
            city = :city,
            state = :state,
            zipcode = :zipcode,
            country = :country,
            service_location = :service_location,
            parent_first_name = :parent_first_name,
            parent_last_name = :parent_last_name,
            relationship_to_insured = :relationship_to_insured,
            relation_other = :relation_other,
            emergency_contact_name = :emergency_contact_name,
            emg_relationship = :emg_relationship,
            emg_phone = :emg_phone,
            emg_email = :emg_email,
            client_notes = :client_notes,
            other_information = :other_information,
            archived = :archived,
            updated_at = CURRENT_TIMESTAMP
            WHERE client_id = :client_id";
    } else {
        // Insert new client
        $sql = "INSERT INTO clients (
            client_id, client_uuid, client_status, wait_list_status,
            first_name, middle_name, last_name, date_of_birth, gender,
            preferred_language, phone, email, appointment_reminder,
            address_line_1, address_line_2, city, state, zipcode, country, service_location,
            parent_first_name, parent_last_name, relationship_to_insured, relation_other,
            emergency_contact_name, emg_relationship, emg_phone, emg_email,
            client_notes, other_information, archived
        ) VALUES (
            :client_id, :client_uuid, :client_status, :wait_list_status,
            :first_name, :middle_name, :last_name, :date_of_birth, :gender,
            :preferred_language, :phone, :email, :appointment_reminder,
            :address_line_1, :address_line_2, :city, :state, :zipcode, :country, :service_location,
            :parent_first_name, :parent_last_name, :relationship_to_insured, :relation_other,
            :emergency_contact_name, :emg_relationship, :emg_phone, :emg_email,
            :client_notes, :other_information, :archived
        )";
    }

    $stmt = $conn->prepare($sql);

    // Prepare parameters for execution
    $params = [
        ":client_id" => $clientId,
        ":client_uuid" => $input["client_uuid"] ?? '',
        ":client_status" => $input["client_status"] ?? 'New',
        ":wait_list_status" => $input["wait_list_status"] ?? 'No',
        ":first_name" => $input["first_name"],
        ":middle_name" => $input["middle_name"] ?? '',
        ":last_name" => $input["last_name"],
        ":date_of_birth" => $input["date_of_birth"],
        ":gender" => $input["gender"] ?? '',
        ":preferred_language" => $input["preferred_language"] ?? '',
        ":phone" => $input["phone"] ?? '',
        ":email" => $input["email"] ?? '',
        ":appointment_reminder" => $input["appointment_reminder"] ?? '',
        ":address_line_1" => $input["address_line_1"] ?? '',
        ":address_line_2" => $input["address_line_2"] ?? '',
        ":city" => $input["city"] ?? '',
        ":state" => $input["state"] ?? '',
        ":zipcode" => $input["zipcode"] ?? '',
        ":country" => $input["country"] ?? 'USA',
        ":service_location" => $input["service_location"] ?? 'Home',
        ":parent_first_name" => $input["parent_first_name"] ?? '',
        ":parent_last_name" => $input["parent_last_name"] ?? '',
        ":relationship_to_insured" => $input["relationship_to_insured"] ?? '',
        ":relation_other" => $input["relation_other"] ?? '',
        ":emergency_contact_name" => $input["emergency_contact_name"] ?? '',
        ":emg_relationship" => $input["emg_relationship"] ?? '',
        ":emg_phone" => $input["emg_phone"] ?? '',
        ":emg_email" => $input["emg_email"] ?? '',
        ":client_notes" => $input["client_notes"] ?? '',
        ":other_information" => $input["other_information"] ?? '',
        ":archived" => $input["archived"] ?? 0
    ];

    // --- DEBUGGING: Log parameters before execution ---
    error_log("Executing SQL with parameters: " . print_r($params, true));
    // --- END DEBUGGING ---

    $stmt->execute($params);

    // Handle additional addresses without deletion
    if (isset($input["addresses"]) && is_array($input["addresses"]) && count($input["addresses"]) > 1) {
        // Fetch existing additional addresses
        $existingAddressesStmt = $conn->prepare("SELECT id, service_location, address_line_1, address_line_2, city, state, zipcode, country FROM client_addresses WHERE client_id = ?");
        $existingAddressesStmt->execute([$clientId]);
        $existingAddresses = $existingAddressesStmt->fetchAll(PDO::FETCH_ASSOC);

        // Prepare statements for insert/update
        $insertAddressStmt = $conn->prepare("INSERT INTO client_addresses (
            client_id, service_location, address_line_1, address_line_2, 
            city, state, zipcode, country
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $updateAddressStmt = $conn->prepare("UPDATE client_addresses SET
            service_location = ?, address_line_1 = ?, address_line_2 = ?, 
            city = ?, state = ?, zipcode = ?, country = ?
            WHERE id = ? AND client_id = ?");

        // Process input addresses starting from index 1
        for ($i = 1; $i < count($input["addresses"]); $i++) {
            $addr = $input["addresses"][$i];
            $country = $addr["country"] === "Other" ? $addr["countryOther"] : ($addr["country"] ?? 'USA');

            if (isset($addr["id"]) && !empty($addr["id"])) {
                // Update existing
                $updateAddressStmt->execute([
                    $addr["service_location"] ?? 'Home',
                    $addr["address_line_1"] ?? '',
                    $addr["address_line_2"] ?? '',
                    $addr["city"] ?? '',
                    $addr["state"] ?? '',
                    $addr["zipcode"] ?? '',
                    $country,
                    $addr["id"],
                    $clientId
                ]);
            } else {
                // Insert new
                $insertAddressStmt->execute([
                    $clientId,
                    $addr["service_location"] ?? 'Home',
                    $addr["address_line_1"] ?? '',
                    $addr["address_line_2"] ?? '',
                    $addr["city"] ?? '',
                    $addr["state"] ?? '',
                    $addr["zipcode"] ?? '',
                    $country
                ]);
            }
        }
    }

    // Handle insurances without deletion
    if (isset($input["insurances"]) && is_array($input["insurances"])) {
        // Fetch existing insurances
        $existingInsStmt = $conn->prepare("SELECT insurance_id, insurance_type, insurance_provider FROM client_insurance WHERE client_id = ?");
        $existingInsStmt->execute([$clientId]);
        $existingIns = $existingInsStmt->fetchAll(PDO::FETCH_ASSOC);
        $existingInsMap = [];
        foreach ($existingIns as $ins) {
            $key = $ins['insurance_type'] . '|' . $ins['insurance_provider']; // Simple key for matching
            $existingInsMap[$key] = $ins['insurance_id'];
        }

        $insertInsStmt = $conn->prepare("INSERT INTO client_insurance (
            client_id, description, insurance_type, insurance_provider, treatment_type, rendering_provider, start_date, end_date,
            authorization_number, insurance_id_number, group_number, diagnosis_1, diagnosis_2, diagnosis_3, diagnosis_4, diagnosis_5,
            coinsurance, deductible, copay_per, copay_rate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $updateInsStmt = $conn->prepare("UPDATE client_insurance SET
            description = ?, treatment_type = ?, rendering_provider = ?, start_date = ?, end_date = ?,
            authorization_number = ?, insurance_id_number = ?, group_number = ?, diagnosis_1 = ?, diagnosis_2 = ?,
            diagnosis_3 = ?, diagnosis_4 = ?, diagnosis_5 = ?, coinsurance = ?, deductible = ?, copay_per = ?, copay_rate = ?
            WHERE insurance_id = ? AND client_id = ?");

        $processedKeys = [];
        foreach ($input["insurances"] as $ins) {
            $key = ($ins["insurance_type"] ?? 'Primary') . '|' . ($ins["insurance_provider"] ?? '');

            if (isset($existingInsMap[$key])) {
                // Update existing
                $insId = $existingInsMap[$key];
                $updateInsStmt->execute([
                    $ins["description"] ?? '',
                    $ins["treatment_type"] ?? '',
                    $ins["rendering_provider"] ?? '',
                    empty($ins["start_date"]) ? null : $ins["start_date"],
                    empty($ins["end_date"]) ? null : $ins["end_date"],
                    $ins["authorization_number"] ?? '',
                    $ins["insurance_id_number"] ?? '',
                    $ins["group_number"] ?? '',
                    $ins["diagnosis_1"] ?? '', $ins["diagnosis_2"] ?? '', $ins["diagnosis_3"] ?? '', $ins["diagnosis_4"] ?? '', $ins["diagnosis_5"] ?? '',
                    $ins["coinsurance"] ?? '',
                    $ins["deductible"] ?? '',
                    $ins["copay_per"] ?? 'hr',
                    empty($ins["copay_rate"]) ? null : $ins["copay_rate"],
                    $insId,
                    $clientId
                ]);
                $insuranceIds[] = $insId;
            } else {
                // Insert new
                $insertInsStmt->execute([
                    $clientId,
                    $ins["description"] ?? '',
                    $ins["insurance_type"] ?? 'Primary',
                    $ins["insurance_provider"] ?? '',
                    $ins["treatment_type"] ?? '',
                    $ins["rendering_provider"] ?? '',
                    empty($ins["start_date"]) ? null : $ins["start_date"],
                    empty($ins["end_date"]) ? null : $ins["end_date"],
                    $ins["authorization_number"] ?? '',
                    $ins["insurance_id_number"] ?? '',
                    $ins["group_number"] ?? '',
                    $ins["diagnosis_1"] ?? '', $ins["diagnosis_2"] ?? '', $ins["diagnosis_3"] ?? '', $ins["diagnosis_4"] ?? '', $ins["diagnosis_5"] ?? '',
                    $ins["coinsurance"] ?? '',
                    $ins["deductible"] ?? '',
                    $ins["copay_per"] ?? 'hr',
                    empty($ins["copay_rate"]) ? null : $ins["copay_rate"],
                ]);
                $insuranceIds[] = $conn->lastInsertId();
            }
            $processedKeys[] = $key;
        }

        // Optionally, delete insurances not in processedKeys if desired, but skipping per user request
    }

    // Similar handling for authorizations, documents, etc., but adapted to update/insert without delete

    // Handle availability without deletion
    if (isset($input["availability"]) && is_array($input["availability"])) {
        $availStmt = $conn->prepare("
            INSERT INTO client_availability (client_id, day, available, start_time, end_time)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE available = VALUES(available), start_time = VALUES(start_time), end_time = VALUES(end_time)
        ");
        foreach ($input["availability"] as $day => $data) {
            $availStmt->execute([
                $clientId,
                $day,
                isset($data["available"]) && $data["available"] ? 1 : 0,
                !empty($data["start"]) ? $data["start"] : null,
                !empty($data["end"]) ? $data["end"] : null
            ]);
        }
    }

    $conn->commit();
    echo json_encode([
        "success" => true,
        "message" => $exists ? "Client updated successfully" : "Client added successfully"
    ]);

} catch (PDOException $e) {
    if ($conn && $conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log("Database error in update-clients.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ]);
}
?>

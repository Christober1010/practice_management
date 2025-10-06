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

    $input = json_decode(file_get_contents("php://input"), true);

    // --- DEBUGGING ---
    error_log("Received input for update-clients.php: " . print_r($input, true));
    // -----------------

    $required = ["client_id", "first_name", "last_name", "date_of_birth"];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Missing required field: $field"]);
            exit();
        }
    }

    $clientId = $input["client_id"];

    $conn->beginTransaction();

    // Check if client exists
    $stmtCheck = $conn->prepare("SELECT COUNT(*) FROM clients WHERE client_id = :client_id");
    $stmtCheck->execute([":client_id" => $clientId]);
    $exists = $stmtCheck->fetchColumn() > 0;

    if ($exists) {
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
        $sql = "INSERT INTO clients (
        client_id, client_uuid, client_status, wait_list_status,
        first_name, middle_name, last_name, date_of_birth, gender,
        preferred_language, phone, email, appointment_reminder,
        parent_first_name, parent_last_name, relationship_to_insured, relation_other,
        emergency_contact_name, emg_relationship, emg_phone, emg_email,
        client_notes, other_information, archived
    ) VALUES (
        :client_id, :client_uuid, :client_status, :wait_list_status,
        :first_name, :middle_name, :last_name, :date_of_birth, :gender,
        :preferred_language, :phone, :email, :appointment_reminder,
        :parent_first_name, :parent_last_name, :relationship_to_insured, :relation_other,
        :emergency_contact_name, :emg_relationship, :emg_phone, :emg_email,
        :client_notes, :other_information, :archived
    )";
    }



    $stmt = $conn->prepare($sql);

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

    error_log("Executing SQL with parameters: " . print_r($params, true));
    $stmt->execute($params);
    // ------------------------
    // Handle addresses in new table
    // ------------------------
    $conn->prepare("DELETE FROM client_addresses WHERE client_id = ?")->execute([$clientId]);

    if (isset($input["addresses"]) && is_array($input["addresses"])) {
        $addressStmt = $conn->prepare("INSERT INTO client_addresses (
        client_id, service_location, location, address_line_1, address_line_2, city, state, zipcode, country
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");

        // Get the top-level location field (this is what you want to store)
        $topLevelLocation = $input["location"] ?? null;

        foreach ($input["addresses"] as $addr) {
            $addressStmt->execute([
                $clientId,
                $addr["service_location"] ?? 'Home',
                $topLevelLocation,  // <-- Use the top-level location field
                $addr["address_line_1"] ?? '',
                $addr["address_line_2"] ?? '',
                $addr["city"] ?? '',
                $addr["state"] ?? '',
                $addr["zipcode"] ?? '',
                $addr["country"] === "Other" ? ($addr["countryOther"] ?? 'USA') : ($addr["country"] ?? 'USA')
            ]);
        }
    }
    // ------------------------

    // --- keep all your insurance, authorization, document, availability handling below unchanged ---
    // (your code here for insurances, client_auth, documents, availability...)
    // Clear existing insurances & related data to prevent orphans
    $conn->prepare("DELETE FROM client_auth WHERE insurance_id IN (SELECT insurance_id FROM client_insurance WHERE client_id = ?)")->execute([$clientId]);
    $conn->prepare("DELETE FROM client_insurance WHERE client_id = ?")->execute([$clientId]);

    // Clear documents (check if table exists first)
    try {
        $conn->prepare("DELETE FROM client_documents WHERE client_id = ?")->execute([$clientId]);
    } catch (PDOException $e) {
        // Table might not exist, try client_doc instead
        try {
            $conn->prepare("DELETE FROM client_doc WHERE client_id = ?")->execute([$clientId]);
        } catch (PDOException $e2) {
            error_log("Neither client_documents nor client_doc table exists: " . $e2->getMessage());
        }
    }

    $insuranceIds = [];
    // Insert insurances and record their IDs
    if (isset($input["insurances"]) && is_array($input["insurances"])) {
        $stmtIns = $conn->prepare("INSERT INTO client_insurance (
            client_id, description, insurance_type, insurance_provider, treatment_type, rendering_provider, start_date, end_date,
            authorization_number, insurance_id_number, group_number, diagnosis_1, diagnosis_2, diagnosis_3, diagnosis_4, diagnosis_5,
            coinsurance, deductible, copay_per, copay_rate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

        foreach ($input["insurances"] as $ins) {
            $stmtIns->execute([
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
                $ins["diagnosis_1"] ?? '',
                $ins["diagnosis_2"] ?? '',
                $ins["diagnosis_3"] ?? '',
                $ins["diagnosis_4"] ?? '',
                $ins["diagnosis_5"] ?? '',
                $ins["coinsurance"] ?? '',
                $ins["deductible"] ?? '',
                $ins["copay_per"] ?? 'hr',
                empty($ins["copay_rate"]) ? null : $ins["copay_rate"]
            ]);
            $insuranceIds[] = $conn->lastInsertId();
        }
    }

    // Insert authorizations linked to their insurances
    if (isset($input["authorizations"]) && is_array($input["authorizations"])) {
        $authStmt = $conn->prepare("INSERT INTO client_auth (
            auth_uuid, insurance_id, authorization_number, billing_codes,
            units_approved_per_15_min, units_serviced, balance_units, start_date, end_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

        foreach ($input["authorizations"] as $auth) {
            // Map insurance_id from frontend to actual database insurance_id
            $linkedInsuranceId = null;

            if (isset($auth["insurance_id"]) && $auth["insurance_id"] !== "0" && $auth["insurance_id"] !== "") {
                $insuranceIndex = intval($auth["insurance_id"]);
                if ($insuranceIndex >= 0 && isset($insuranceIds[$insuranceIndex])) {
                    $linkedInsuranceId = $insuranceIds[$insuranceIndex];
                }
            }

            // If no valid insurance link and we have at least one insurance, use the first one
            if (!$linkedInsuranceId && !empty($insuranceIds)) {
                $linkedInsuranceId = $insuranceIds[0];
            }

            // Skip authorization if we can't link it to an insurance
            if (!$linkedInsuranceId) {
                error_log("Skipping authorization - no valid insurance link: " . print_r($auth, true));
                continue;
            }

            $authStmt->execute([
                $auth["auth_uuid"] ?? uniqid("auth_", true),
                $linkedInsuranceId,
                $auth["authorization_number"] ?? '',
                $auth["billing_codes"] ?? '',
                !empty($auth["units_approved_per_15_min"]) ? $auth["units_approved_per_15_min"] : null,
                !empty($auth["units_serviced"]) ? $auth["units_serviced"] : null,
                !empty($auth["balance_units"]) ? $auth["balance_units"] : null,
                !empty($auth["start_date"]) ? $auth["start_date"] : null,
                !empty($auth["end_date"]) ? $auth["end_date"] : null,
                $auth["status"] ?? 'Active'
            ]);
        }
    }

    // Insert documents (try both table names)
    if (isset($input["documents"]) && is_array($input["documents"])) {
        $docTableExists = false;
        $docStmt = null;

        // Try client_documents first
        try {
            $docStmt = $conn->prepare("INSERT INTO client_documents (
                client_id, doc_uuid, document_type, file_url
            ) VALUES (?, ?, ?, ?)");
            $docTableExists = true;
        } catch (PDOException $e) {
            // Try client_doc instead
            try {
                $docStmt = $conn->prepare("INSERT INTO client_doc (
                    client_id, doc_uuid, document_type, document_path
                ) VALUES (?, ?, ?, ?)");
                $docTableExists = true;
            } catch (PDOException $e2) {
                error_log("No document table found: " . $e2->getMessage());
            }
        }

        if ($docTableExists && $docStmt) {
            foreach ($input["documents"] as $doc) {
                $docUuid = !empty($doc["doc_uuid"]) ? $doc["doc_uuid"] : uniqid("doc_", true);
                $docStmt->execute([
                    $clientId,
                    $docUuid,
                    $doc["document_type"] ?? 'misc',
                    $doc["file_url"] ?? $doc["document_path"] ?? ''
                ]);
            }
        }
    }

    // Handle availability
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

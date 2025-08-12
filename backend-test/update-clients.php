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
            address_line_1, address_line_2, city, state, zipcode, country,
            parent_first_name, parent_last_name, relationship_to_insured, relation_other,
            emergency_contact_name, emg_relationship, emg_phone, emg_email,
            client_notes, other_information, archived
        ) VALUES (
            :client_id, :client_uuid, :client_status, :wait_list_status,
            :first_name, :middle_name, :last_name, :date_of_birth, :gender,
            :preferred_language, :phone, :email, :appointment_reminder,
            :address_line_1, :address_line_2, :city, :state, :zipcode, :country,
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
        ":appointment_reminder" => $input["appointment_reminder"] ?? '', // Ensure this is bound
        ":address_line_1" => $input["address_line_1"] ?? '',
        ":address_line_2" => $input["address_line_2"] ?? '',
        ":city" => $input["city"] ?? '',
        ":state" => $input["state"] ?? '',
        ":zipcode" => $input["zipcode"] ?? '',
        ":country" => $input["country"] ?? 'USA',
        ":parent_first_name" => $input["parent_first_name"] ?? '',
        ":parent_last_name" => $input["parent_last_name"] ?? '',
        ":relationship_to_insured" => $input["relationship_to_insured"] ?? '', // Ensure this is bound
        ":relation_other" => $input["relation_other"] ?? '', // Ensure this is bound
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

    // Clear existing insurances & authorizations & documents for this client to prevent orphans
    $conn->prepare("DELETE FROM client_auth WHERE insurance_id IN (SELECT insurance_id FROM client_insurance WHERE client_id = ?)")->execute([$clientId]);
    $conn->prepare("DELETE FROM client_insurance WHERE client_id = ?")->execute([$clientId]);
    $conn->prepare("DELETE FROM client_documents WHERE client_id = ?")->execute([$clientId]); // Delete existing documents

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
                $ins["diagnosis_1"] ?? '', $ins["diagnosis_2"] ?? '', $ins["diagnosis_3"] ?? '', $ins["diagnosis_4"] ?? '', $ins["diagnosis_5"] ?? '',
                $ins["coinsurance"] ?? '',
                $ins["deductible"] ?? '',
                $ins["copay_per"] ?? 'hr',
                empty($ins["copay_rate"]) ? null : $ins["copay_rate"],
            ]);
            $insuranceIds[] = $conn->lastInsertId();
        }
    }

    // Insert authorizations linked to their insurances
    if (isset($input["authorizations"]) && is_array($input["authorizations"])) {
        $authStmt = $conn->prepare("INSERT INTO client_auth (
            auth_uuid, insurance_id, authorization_number, billing_codes,
            units_approved_per_15_min, units_serviced, balance_units, start_date, end_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"); // Added units_serviced, balance_units
        foreach ($input["authorizations"] as $auth) {
            // Map insurance_id from frontend index to real insurance_id
            $insuranceIndex = isset($auth["insurance_id"]) ? intval($auth["insurance_id"]) : -1;
            $linkedInsuranceId = ($insuranceIndex >= 0 && isset($insuranceIds[$insuranceIndex]))
                ? $insuranceIds[$insuranceIndex]
                : null;

            if (!$linkedInsuranceId) {
                // Skip authorizations not linked to an existing insurance (e.g., if the linked insurance was new and not saved)
                continue;
            }

            $authStmt->execute([
                uniqid("auth_", true),
                $linkedInsuranceId,
                $auth["authorization_number"] ?? '',
                $auth["billing_codes"] ?? '',
                !empty($auth["units_approved_per_15_min"]) ? $auth["units_approved_per_15_min"] : null,
                !empty($auth["units_serviced"]) ? $auth["units_serviced"] : null, // Added
                !empty($auth["balance_units"]) ? $auth["balance_units"] : null, // Added
                !empty($auth["start_date"]) ? $auth["start_date"] : null,
                !empty($auth["end_date"]) ? $auth["end_date"] : null,
                $auth["status"] ?? 'Active',
            ]);
        }
    }

    // Insert documents
    if (isset($input["documents"]) && is_array($input["documents"])) {
        $docStmt = $conn->prepare("INSERT INTO client_documents (
            client_id, doc_uuid, document_type, file_url
        ) VALUES (?, ?, ?, ?)");
        foreach ($input["documents"] as $doc) {
            // Ensure doc_uuid is not empty. If it is, generate a new one.
            $docUuid = !empty($doc["doc_uuid"]) ? $doc["doc_uuid"] : uniqid("doc_", true);
            $docStmt->execute([
                $clientId,
                $docUuid, // Use the generated/provided UUID
                $doc["document_type"] ?? '',
                $doc["file_url"] ?? ''
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
    error_log("Database error in update-clients.php: " . $e->getMessage()); // More specific log
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ]);
}
?>

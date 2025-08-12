<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json");

// Handle CORS preflight
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

    // Decode JSON input
    $input = json_decode(file_get_contents("php://input"), true);

    // Validate required fields
    $required = ["id", "first_name", "last_name", "date_of_birth"];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Missing required field: $field"]);
            exit();
        }
    }

    $clientId = $input["id"];

    // Begin transaction for atomic operations
    $conn->beginTransaction();

    // Check if client exists
    $stmtCheck = $conn->prepare("SELECT COUNT(*) FROM clients WHERE id = :id");
    $stmtCheck->execute([":id" => $clientId]);
    $exists = $stmtCheck->fetchColumn() > 0;

    if ($exists) {
        // Update client
        $sql = "UPDATE clients SET 
            first_name = :firstName,
            middle_name = :middleName,
            last_name = :lastName,
            date_of_birth = :dob,
            gender = :gender,
            preferred_language = :preferredLanguage,
            client_status = :status,
            wait_list_status = :waitListStatus,
            phone = :phone,
            email = :email,
            appointment_reminder = :appointmentReminder,
            address_line_1 = :address_line_1,
            address_line_2 = :address_line_2,
            city = :city,
            state = :state,
            zipcode = :zipcode,
            country = :country,
            parent_first_name = :parentFirstName,
            parent_last_name = :parentLastName,
            relationship_to_insured = :relationshipToInsured,
            relation_other = :relationOther,
            emergency_contact_name = :emergencyContactName,
            emg_relationship = :emgRelationship,
            emg_phone = :emgPhone,
            emg_email = :emgEmail,
            client_notes = :clientNotes,
            other_information = :otherInformation,
            archived = :archived,
            updated_at = CURRENT_TIMESTAMP
            WHERE id = :id";
    } else {
        // Insert new client
        $sql = "INSERT INTO clients (
            id, first_name, middle_name, last_name, date_of_birth, gender, preferred_language,
            client_status, wait_list_status, phone, email, appointment_reminder,
            address_line_1, address_line_2, city, state, zipcode, country,
            parent_first_name, parent_last_name, relationship_to_insured, relation_other,
            emergency_contact_name, emg_relationship, emg_phone, emg_email,
            client_notes, other_information, archived
        ) VALUES (
            :id, :firstName, :middleName, :lastName, :dob, :gender, :preferredLanguage,
            :status, :waitListStatus, :phone, :email, :appointmentReminder,
            :address_line_1, :address_line_2, :city, :state, :zipcode, :country,
            :parentFirstName, :parentLastName, :relationshipToInsured, :relationOther,
            :emergencyContactName, :emgRelationship, :emgPhone, :emgEmail,
            :clientNotes, :otherInformation, :archived
        )";
    }

    $stmt = $conn->prepare($sql);

    $stmt->execute([
        ":id" => $clientId,
        ":firstName" => $input["first_name"],
        ":middleName" => $input["middle_name"] ?? '',
        ":lastName" => $input["last_name"],
        ":dob" => $input["date_of_birth"],
        ":gender" => $input["gender"] ?? '',
        ":preferredLanguage" => $input["preferred_language"] ?? '',
        ":status" => $input["client_status"] ?? 'Active',
        ":waitListStatus" => $input["wait_list_status"] ?? 'No',
        ":phone" => $input["phone"] ?? '',
        ":email" => $input["email"] ?? '',
        ":appointmentReminder" => $input["appointment_reminder"] ?? '',
        ":address_line_1" => $input["address_line_1"] ?? '',
        ":address_line_2" => $input["address_line_2"] ?? '',
        ":city" => $input["city"] ?? '',
        ":state" => $input["state"] ?? '',
        ":zipcode" => $input["zipcode"] ?? '',
        ":country" => $input["country"] ?? '',
        ":parentFirstName" => $input["parent_first_name"] ?? '',
        ":parentLastName" => $input["parent_last_name"] ?? '',
        ":relationshipToInsured" => $input["relationship_to_insured"] ?? '',
        ":relationOther" => $input["relation_other"] ?? '',
        ":emergencyContactName" => $input["emergency_contact_name"] ?? '',
        ":emgRelationship" => $input["emg_relationship"] ?? '',
        ":emgPhone" => $input["emg_phone"] ?? '',
        ":emgEmail" => $input["emg_email"] ?? '',
        ":clientNotes" => $input["client_notes"] ?? '',
        ":otherInformation" => $input["other_information"] ?? '',
        ":archived" => $input["archived"] ?? 0,
    ]);

    // Clear existing insurances & authorizations for this client to prevent orphans
    $conn->prepare("DELETE FROM client_auth WHERE insurance_id IN (SELECT insurance_id FROM client_insurance WHERE client_id = ?)")->execute([$clientId]);
    $conn->prepare("DELETE FROM client_insurance WHERE client_id = ?")->execute([$clientId]);

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
                $ins["insurance_type"] ?? '',
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
                $ins["copay_per"] ?? '',
                empty($ins["copay_rate"]) ? null : $ins["copay_rate"],
            ]);

            $insuranceIds[] = $conn->lastInsertId();
        }
    }

    // Insert authorizations linked to their insurances
    if (isset($input["authorizations"]) && is_array($input["authorizations"])) {
        $stmtAuth = $conn->prepare("INSERT INTO client_auth (
            auth_uuid, insurance_id, authorization_number, billing_codes, units_approved_per_15_min, start_date, end_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

        foreach ($input["authorizations"] as $auth) {
            $insuranceIndex = isset($auth["insurance_id"]) ? intval($auth["insurance_id"]) : -1;
            $linkedInsuranceId = ($insuranceIndex >= 0 && isset($insuranceIds[$insuranceIndex]))
                ? $insuranceIds[$insuranceIndex]
                : null;

            if (!$linkedInsuranceId) {
                // Skip authorizations not linked to an existing insurance
                continue;
            }

            $stmtAuth->execute([
                uniqid("auth_", true),
                $linkedInsuranceId,
                $auth["authorization_number"] ?? '',
                $auth["billing_codes"] ?? '',
                empty($auth["units_approved_per_15_min"]) ? null : $auth["units_approved_per_15_min"],
                empty($auth["start_date"]) ? null : $auth["start_date"],
                empty($auth["end_date"]) ? null : $auth["end_date"],
                $auth["status"] ?? 'Active',
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
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
}

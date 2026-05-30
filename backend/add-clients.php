<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json");

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = getAuthenticatedUser();
if (
    $authUser
    && !rbac_user_has_permission_key($authUser['role'], 'clients.create', 'mahaverse')
    && !rbac_user_has_permission_key($authUser['role'], 'clients.write', 'mahaverse')
) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Permission denied']);
    exit;
}

$host = "db5018266079.hosting-data.io";
$dbname = "dbs14484433";
$dbUser = "dbu3321929";
$pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $dbUser, $pass);
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

    if ($authUser) {
        $rbacM = getDBConnection();
        rbac_enforce_client_action($authUser, $rbacM, 'create', null);
    }

    // Begin transaction for atomic operations
    $conn->beginTransaction();

    // Check if client exists
    $stmtCheck = $conn->prepare("SELECT COUNT(*) FROM clients WHERE id = :id");
    $stmtCheck->execute([":id" => $clientId]);
    $exists = $stmtCheck->fetchColumn() > 0;

    // Check if is_active column exists (so we don't 500 before migrations run)
    $checkIsActiveColumn = $conn->query("SHOW COLUMNS FROM clients LIKE 'is_active'");
    $hasIsActiveColumn = $checkIsActiveColumn->rowCount() > 0;

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
            " . ($hasIsActiveColumn ? "is_active = :isActive," : "") . "
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
            client_status," . ($hasIsActiveColumn ? " is_active," : "") . " wait_list_status, phone, email, appointment_reminder,
            address_line_1, address_line_2, city, state, zipcode, country,
            parent_first_name, parent_last_name, relationship_to_insured, relation_other,
            emergency_contact_name, emg_relationship, emg_phone, emg_email,
            client_notes, other_information, archived
        ) VALUES (
            :id, :firstName, :middleName, :lastName, :dob, :gender, :preferredLanguage,
            :status," . ($hasIsActiveColumn ? " :isActive," : "") . " :waitListStatus, :phone, :email, :appointmentReminder,
            :address_line_1, :address_line_2, :city, :state, :zipcode, :country,
            :parentFirstName, :parentLastName, :relationshipToInsured, :relationOther,
            :emergencyContactName, :emgRelationship, :emgPhone, :emgEmail,
            :clientNotes, :otherInformation, :archived
        )";
    }

    $stmt = $conn->prepare($sql);

    $params = [
        ":id" => $clientId,
        ":firstName" => $input["first_name"],
        ":middleName" => $input["middle_name"] ?? '',
        ":lastName" => $input["last_name"],
        ":dob" => $input["date_of_birth"],
        ":gender" => $input["gender"] ?? '',
        ":preferredLanguage" => $input["preferred_language"] ?? '',
        ":status" => $input["client_status"] ?? 'New',
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
    ];

    if ($hasIsActiveColumn) {
        $params[":isActive"] = isset($input["is_active"]) ? ($input["is_active"] ? 1 : 0) : 1;
    }

    $stmt->execute($params);

    // Clear existing insurances & authorizations for this client to prevent orphans
    $conn->prepare("DELETE FROM client_auth WHERE insurance_id IN (SELECT insurance_id FROM client_insurance WHERE client_id = ?)")->execute([$clientId]);
    $conn->prepare("DELETE FROM client_insurance WHERE client_id = ?")->execute([$clientId]);

    $insuranceIds = [];

    // Insert insurances and record their IDs
    if (isset($input["insurances"]) && is_array($input["insurances"])) {
        // Check optional insurance columns (to avoid 500s before migrations)
        $checkProviderIdColumn = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'insurance_provider_id'");
        $hasProviderIdColumn = $checkProviderIdColumn->rowCount() > 0;
        $checkPrimaryDiagnosisColumn = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'primary_diagnosis'");
        $hasPrimaryDiagnosisColumn = $checkPrimaryDiagnosisColumn->rowCount() > 0;
        $checkProviderStaffIdColumn = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'provider_staff_id'");
        $hasProviderStaffIdColumn = $checkProviderStaffIdColumn->rowCount() > 0;
        
        // Check for new insurance form fields
        $checkCarrierPayerId = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'carrier_payer_id'");
        $hasCarrierPayerId = $checkCarrierPayerId->rowCount() > 0;
        
        $checkInsuranceCompanyAddress = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'insurance_company_address'");
        $hasInsuranceCompanyAddress = $checkInsuranceCompanyAddress->rowCount() > 0;
        
        $checkInsuranceIssueDate = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'insurance_issue_date'");
        $hasInsuranceIssueDate = $checkInsuranceIssueDate->rowCount() > 0;
        
        $checkInsurancePlanName = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'insurance_plan_name'");
        $hasInsurancePlanName = $checkInsurancePlanName->rowCount() > 0;
        
        $checkDateOfSignature = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'date_of_signature'");
        $hasDateOfSignature = $checkDateOfSignature->rowCount() > 0;
        
        $checkAuthorizedPaymentBox13 = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'authorized_payment_box13'");
        $hasAuthorizedPaymentBox13 = $checkAuthorizedPaymentBox13->rowCount() > 0;
        
        $checkAuthorizedReleaseBox12 = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'authorized_release_box12'");
        $hasAuthorizedReleaseBox12 = $checkAuthorizedReleaseBox12->rowCount() > 0;
        
        $checkAuthorizedReleaseBox17 = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'authorized_release_box17'");
        $hasAuthorizedReleaseBox17 = $checkAuthorizedReleaseBox17->rowCount() > 0;
        
        $checkAdditionalClaimInfoBox19 = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'additional_claim_info_box19'");
        $hasAdditionalClaimInfoBox19 = $checkAdditionalClaimInfoBox19->rowCount() > 0;
        
        $checkDoNotAcceptAssignmentBox27 = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'do_not_accept_assignment_box27'");
        $hasDoNotAcceptAssignmentBox27 = $checkDoNotAcceptAssignmentBox27->rowCount() > 0;
        
        $checkInsuranceNotes = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'insurance_notes'");
        $hasInsuranceNotes = $checkInsuranceNotes->rowCount() > 0;
        
        $checkPrimaryInsuranceNotes = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'primary_insurance_notes'");
        $hasPrimaryInsuranceNotes = $checkPrimaryInsuranceNotes->rowCount() > 0;
        
        $checkInsuredSameAsClient = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'insured_same_as_client'");
        $hasInsuredSameAsClient = $checkInsuredSameAsClient->rowCount() > 0;
        
        $checkInsuredPersonFields = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'insured_first_name'");
        $hasInsuredPersonFields = $checkInsuredPersonFields->rowCount() > 0;
        
        $checkInsuranceInactive = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'insurance_inactive'");
        $hasInsuranceInactive = $checkInsuranceInactive->rowCount() > 0;
        
        $checkDeleteInsurance = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'delete_insurance'");
        $hasDeleteInsurance = $checkDeleteInsurance->rowCount() > 0;

        $insuranceColumns = "client_id, description, insurance_type, insurance_provider";
        $insurancePlaceholders = "?, ?, ?, ?";

        if ($hasProviderIdColumn) {
            $insuranceColumns .= ", insurance_provider_id";
            $insurancePlaceholders .= ", ?";
        }

        if ($hasPrimaryDiagnosisColumn) {
            $insuranceColumns .= ", primary_diagnosis";
            $insurancePlaceholders .= ", ?";
        }

        $insuranceColumns .= ", treatment_type";
        $insurancePlaceholders .= ", ?";

        if ($hasProviderStaffIdColumn) {
            $insuranceColumns .= ", provider_staff_id";
            $insurancePlaceholders .= ", ?";
        }

        $insuranceColumns .= ", rendering_provider, start_date, end_date,
            authorization_number, insurance_id_number, group_number, diagnosis_1, diagnosis_2, diagnosis_3, diagnosis_4, diagnosis_5,
            coinsurance, deductible, copay_per, copay_rate";
        // 15 values: rendering_provider, start_date, end_date, authorization_number, insurance_id_number, group_number,
        // diagnosis_1..diagnosis_5, coinsurance, deductible, copay_per, copay_rate
        $insurancePlaceholders .= ", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?";
        
        // Add new insurance form fields if columns exist
        if ($hasCarrierPayerId) {
            $insuranceColumns .= ", carrier_payer_id";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasInsuranceCompanyAddress) {
            $insuranceColumns .= ", insurance_company_address";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasInsuranceIssueDate) {
            $insuranceColumns .= ", insurance_issue_date";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasInsurancePlanName) {
            $insuranceColumns .= ", insurance_plan_name";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasDateOfSignature) {
            $insuranceColumns .= ", date_of_signature";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasAuthorizedPaymentBox13) {
            $insuranceColumns .= ", authorized_payment_box13";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasAuthorizedReleaseBox12) {
            $insuranceColumns .= ", authorized_release_box12";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasAuthorizedReleaseBox17) {
            $insuranceColumns .= ", authorized_release_box17";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasAdditionalClaimInfoBox19) {
            $insuranceColumns .= ", additional_claim_info_box19";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasDoNotAcceptAssignmentBox27) {
            $insuranceColumns .= ", do_not_accept_assignment_box27";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasInsuranceNotes) {
            $insuranceColumns .= ", insurance_notes";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasPrimaryInsuranceNotes) {
            $insuranceColumns .= ", primary_insurance_notes";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasInsuredSameAsClient) {
            $insuranceColumns .= ", insured_same_as_client";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasInsuredPersonFields) {
            $insuranceColumns .= ", insured_first_name, insured_last_name, insured_dob, insured_gender, insured_relationship, insured_address, insured_city, insured_state, insured_zipcode, insured_phone, insured_id_number";
            $insurancePlaceholders .= ", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?";
        }
        
        if ($hasInsuranceInactive) {
            $insuranceColumns .= ", insurance_inactive";
            $insurancePlaceholders .= ", ?";
        }
        
        if ($hasDeleteInsurance) {
            $insuranceColumns .= ", delete_insurance";
            $insurancePlaceholders .= ", ?";
        }

        $stmtIns = $conn->prepare("INSERT INTO client_insurance ($insuranceColumns) VALUES ($insurancePlaceholders)");

        foreach ($input["insurances"] as $ins) {
            $insuranceParams = [
                $clientId,
                $ins["description"] ?? '',
                $ins["insurance_type"] ?? '',
                $ins["insurance_provider"] ?? '',
            ];

            if ($hasProviderIdColumn) {
                $insuranceParams[] = $ins["insurance_provider_id"] ?? null;
            }

            if ($hasPrimaryDiagnosisColumn) {
                $insuranceParams[] = $ins["primary_diagnosis"] ?? null;
            }

            $insuranceParams = array_merge($insuranceParams, [
                $ins["treatment_type"] ?? '',
            ]);

            if ($hasProviderStaffIdColumn) {
                // Convert empty string to NULL to satisfy foreign key constraint
                $providerStaffId = $ins["provider_staff_id"] ?? null;
                $insuranceParams[] = ($providerStaffId === '' || $providerStaffId === null) ? null : $providerStaffId;
            }

            $insuranceParams = array_merge($insuranceParams, [
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
            
            // Add new insurance form fields if columns exist
            if ($hasCarrierPayerId) {
                $insuranceParams[] = $ins["carrier_payer_id"] ?? null;
            }
            
            if ($hasInsuranceCompanyAddress) {
                $insuranceParams[] = $ins["insurance_company_address"] ?? null;
            }
            
            if ($hasInsuranceIssueDate) {
                $insuranceParams[] = empty($ins["insurance_issue_date"]) ? null : $ins["insurance_issue_date"];
            }
            
            if ($hasInsurancePlanName) {
                $insuranceParams[] = $ins["insurance_plan_name"] ?? null;
            }
            
            if ($hasDateOfSignature) {
                $insuranceParams[] = empty($ins["date_of_signature"]) ? null : $ins["date_of_signature"];
            }
            
            if ($hasAuthorizedPaymentBox13) {
                $insuranceParams[] = $ins["authorized_payment_box13"] ?? 'Signature on File';
            }
            
            if ($hasAuthorizedReleaseBox12) {
                $insuranceParams[] = $ins["authorized_release_box12"] ?? 'Signature on File';
            }
            
            if ($hasAuthorizedReleaseBox17) {
                $insuranceParams[] = $ins["authorized_release_box17"] ?? 'Signature on File';
            }
            
            if ($hasAdditionalClaimInfoBox19) {
                $insuranceParams[] = $ins["additional_claim_info_box19"] ?? null;
            }
            
            if ($hasDoNotAcceptAssignmentBox27) {
                $insuranceParams[] = isset($ins["do_not_accept_assignment_box27"]) ? ($ins["do_not_accept_assignment_box27"] ? 1 : 0) : 0;
            }
            
            if ($hasInsuranceNotes) {
                $insuranceParams[] = $ins["insurance_notes"] ?? null;
            }
            
            if ($hasPrimaryInsuranceNotes) {
                $insuranceParams[] = $ins["primary_insurance_notes"] ?? null;
            }
            
            if ($hasInsuredSameAsClient) {
                $insuranceParams[] = isset($ins["insured_same_as_client"]) ? ($ins["insured_same_as_client"] ? 1 : 0) : 1;
            }
            
            if ($hasInsuredPersonFields) {
                $insuranceParams[] = $ins["insured_first_name"] ?? '';
                $insuranceParams[] = $ins["insured_last_name"] ?? '';
                $insuranceParams[] = empty($ins["insured_dob"]) ? null : $ins["insured_dob"];
                $insuranceParams[] = $ins["insured_gender"] ?? '';
                $insuranceParams[] = $ins["insured_relationship"] ?? '';
                $insuranceParams[] = $ins["insured_address"] ?? '';
                $insuranceParams[] = $ins["insured_city"] ?? '';
                $insuranceParams[] = $ins["insured_state"] ?? '';
                $insuranceParams[] = $ins["insured_zipcode"] ?? '';
                $insuranceParams[] = $ins["insured_phone"] ?? '';
                $insuranceParams[] = $ins["insured_id_number"] ?? '';
            }
            
            if ($hasInsuranceInactive) {
                $insuranceParams[] = isset($ins["insurance_inactive"]) ? ($ins["insurance_inactive"] ? 1 : 0) : 0;
            }
            
            if ($hasDeleteInsurance) {
                // Skip inserting insurance if delete_insurance is checked
                if (isset($ins["delete_insurance"]) && $ins["delete_insurance"]) {
                    continue; // Skip this insurance
                }
                $insuranceParams[] = isset($ins["delete_insurance"]) ? ($ins["delete_insurance"] ? 1 : 0) : 0;
            }

            $stmtIns->execute($insuranceParams);

            $insuranceIds[] = $conn->lastInsertId();
        }
    }

    // Insert authorizations linked to their insurances
    if (isset($input["authorizations"]) && is_array($input["authorizations"])) {
        $stmtAuth = $conn->prepare("INSERT INTO client_auth (
            auth_uuid, insurance_id, authorization_number, billing_codes, units_approved_per_15_min, start_date, end_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

        foreach ($input["authorizations"] as $auth) {
            $linkedInsuranceId = mahaverse_resolve_authorization_insurance_id($auth, $insuranceIds);

            if (!$linkedInsuranceId) {
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

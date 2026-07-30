<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = requireAuthAny(['clients.update', 'clients.write', 'clients.archive'], 'mahaverse');



// Must match backend-test/config.php getDBConnection() and add-session.php (test DB)
$host = "db5018419668.hosting-data.io";
$dbname = "dbs14649042";
$dbUser = "dbu1183438";
$pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $dbUser, $pass);
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

    if ($authUser) {
        $rbacM = getDBConnection();
        $archiveAction = false;
        if (array_key_exists('archived', $input)) {
            $newArchived = (int) $input['archived'] ? 1 : 0;
            $curStmt = $conn->prepare("SELECT archived FROM clients WHERE client_id = :client_id LIMIT 1");
            $curStmt->execute([":client_id" => $clientId]);
            $curArchived = $curStmt->fetchColumn();
            if ($curArchived !== false) {
                $archiveAction = ((int) $curArchived ? 1 : 0) !== $newArchived;
            } else {
                // New row path shouldn't hit update-clients, but treat archived=1 as archive.
                $archiveAction = $newArchived === 1;
            }
        }
        if ($archiveAction) {
            rbac_enforce_client_action($authUser, $rbacM, 'archive', $clientId);
        } else {
            rbac_enforce_client_action($authUser, $rbacM, 'update', $clientId);
        }
    }

    // Normalize workflow status: empty / whitespace → "New". (If client_status is still an ENUM
    // that omits labels like "Active Treatment", MySQL may coerce invalid values to '' — run
    // 20260412_201107_alter-clients-client-status-varchar.sql on the database.)
    $clientStatusRaw = $input["client_status"] ?? null;
    $clientStatus = is_string($clientStatusRaw)
        ? trim($clientStatusRaw)
        : (string) ($clientStatusRaw ?? '');
    if ($clientStatus === '') {
        $clientStatus = 'New';
    }

    $conn->beginTransaction();

    // Check if client exists
    $stmtCheck = $conn->prepare("SELECT COUNT(*) FROM clients WHERE client_id = :client_id");
    $stmtCheck->execute([":client_id" => $clientId]);
    $exists = $stmtCheck->fetchColumn() > 0;

    $hasIsActive = false;
    try {
        $colStmt = $conn->query("SHOW COLUMNS FROM clients LIKE 'is_active'");
        $hasIsActive = $colStmt && $colStmt->rowCount() > 0;
    } catch (Exception $e) {
        $hasIsActive = false;
    }

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
        archived = :archived,";
        if ($hasIsActive) {
            $sql .= "
        is_active = :is_active,";
        }
        $sql .= "
        updated_at = CURRENT_TIMESTAMP
        WHERE client_id = :client_id";
    } else {
        $insertCols = "client_id, client_uuid, client_status, wait_list_status,
        first_name, middle_name, last_name, date_of_birth, gender,
        preferred_language, phone, email, appointment_reminder,
        parent_first_name, parent_last_name, relationship_to_insured, relation_other,
        emergency_contact_name, emg_relationship, emg_phone, emg_email,
        client_notes, other_information, archived";
        $insertVals = ":client_id, :client_uuid, :client_status, :wait_list_status,
        :first_name, :middle_name, :last_name, :date_of_birth, :gender,
        :preferred_language, :phone, :email, :appointment_reminder,
        :parent_first_name, :parent_last_name, :relationship_to_insured, :relation_other,
        :emergency_contact_name, :emg_relationship, :emg_phone, :emg_email,
        :client_notes, :other_information, :archived";
        if ($hasIsActive) {
            $insertCols .= ", is_active";
            $insertVals .= ", :is_active";
        }
        $sql = "INSERT INTO clients (
        $insertCols
    ) VALUES (
        $insertVals
    )";
    }



    $stmt = $conn->prepare($sql);

    $params = [
        ":client_id" => $clientId,
        ":client_uuid" => $input["client_uuid"] ?? '',
        ":client_status" => $clientStatus,
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

    if ($hasIsActive) {
        $params[":is_active"] = isset($input["is_active"]) ? ((int)(bool)$input["is_active"]) : 1;
    }

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
        // Check if insurance_document_path and insurance_document_filename columns exist
        $checkColumns = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'insurance_document_path'");
        $hasDocumentColumns = $checkColumns->rowCount() > 0;

        $checkProviderStaffIdColumn = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'provider_staff_id'");
        $hasProviderStaffIdColumn = $checkProviderStaffIdColumn->rowCount() > 0;
        
        $checkProviderIdColumn = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'insurance_provider_id'");
        $hasProviderIdColumn = $checkProviderIdColumn->rowCount() > 0;
        
        $checkPrimaryDiagnosisColumn = $conn->query("SHOW COLUMNS FROM client_insurance LIKE 'primary_diagnosis'");
        $hasPrimaryDiagnosisColumn = $checkPrimaryDiagnosisColumn->rowCount() > 0;
        
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
        
        // Build base columns
        $insuranceCols = "client_id, description, insurance_type, insurance_provider";
        $insuranceVals = "?, ?, ?, ?";
        
        if ($hasProviderIdColumn) {
            $insuranceCols .= ", insurance_provider_id";
            $insuranceVals .= ", ?";
        }
        
        if ($hasPrimaryDiagnosisColumn) {
            $insuranceCols .= ", primary_diagnosis";
            $insuranceVals .= ", ?";
        }
        
        $insuranceCols .= ", treatment_type";
        $insuranceVals .= ", ?";
        
        if ($hasProviderStaffIdColumn) {
            $insuranceCols .= ", provider_staff_id";
            $insuranceVals .= ", ?";
        }
        
        $insuranceCols .= ", rendering_provider, start_date, end_date,
            authorization_number, insurance_id_number, group_number, diagnosis_1, diagnosis_2, diagnosis_3, diagnosis_4, diagnosis_5,
            coinsurance, deductible, copay_per, copay_rate";
        $insuranceVals .= ", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?";
        
        // Add new insurance form fields if columns exist
        if ($hasCarrierPayerId) {
            $insuranceCols .= ", carrier_payer_id";
            $insuranceVals .= ", ?";
        }
        
        if ($hasInsuranceCompanyAddress) {
            $insuranceCols .= ", insurance_company_address";
            $insuranceVals .= ", ?";
        }
        
        if ($hasInsuranceIssueDate) {
            $insuranceCols .= ", insurance_issue_date";
            $insuranceVals .= ", ?";
        }
        
        if ($hasInsurancePlanName) {
            $insuranceCols .= ", insurance_plan_name";
            $insuranceVals .= ", ?";
        }
        
        if ($hasDateOfSignature) {
            $insuranceCols .= ", date_of_signature";
            $insuranceVals .= ", ?";
        }
        
        if ($hasAuthorizedPaymentBox13) {
            $insuranceCols .= ", authorized_payment_box13";
            $insuranceVals .= ", ?";
        }
        
        if ($hasAuthorizedReleaseBox12) {
            $insuranceCols .= ", authorized_release_box12";
            $insuranceVals .= ", ?";
        }
        
        if ($hasAuthorizedReleaseBox17) {
            $insuranceCols .= ", authorized_release_box17";
            $insuranceVals .= ", ?";
        }
        
        if ($hasAdditionalClaimInfoBox19) {
            $insuranceCols .= ", additional_claim_info_box19";
            $insuranceVals .= ", ?";
        }
        
        if ($hasDoNotAcceptAssignmentBox27) {
            $insuranceCols .= ", do_not_accept_assignment_box27";
            $insuranceVals .= ", ?";
        }
        
        if ($hasInsuranceNotes) {
            $insuranceCols .= ", insurance_notes";
            $insuranceVals .= ", ?";
        }
        
        if ($hasPrimaryInsuranceNotes) {
            $insuranceCols .= ", primary_insurance_notes";
            $insuranceVals .= ", ?";
        }
        
        if ($hasInsuredSameAsClient) {
            $insuranceCols .= ", insured_same_as_client";
            $insuranceVals .= ", ?";
        }
        
        if ($hasInsuredPersonFields) {
            $insuranceCols .= ", insured_first_name, insured_last_name, insured_dob, insured_gender, insured_relationship, insured_address, insured_city, insured_state, insured_zipcode, insured_phone, insured_id_number";
            $insuranceVals .= ", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?";
        }
        
        if ($hasInsuranceInactive) {
            $insuranceCols .= ", insurance_inactive";
            $insuranceVals .= ", ?";
        }
        
        if ($hasDeleteInsurance) {
            $insuranceCols .= ", delete_insurance";
            $insuranceVals .= ", ?";
        }
        
        if ($hasDocumentColumns) {
            $insuranceCols .= ", insurance_document_path, insurance_document_filename";
            $insuranceVals .= ", ?, ?";
        }

        $stmtIns = $conn->prepare("INSERT INTO client_insurance ($insuranceCols) VALUES ($insuranceVals)");

        foreach ($input["insurances"] as $ins) {
            // Skip insurance if delete_insurance is checked
            if ($hasDeleteInsurance && isset($ins["delete_insurance"]) && $ins["delete_insurance"]) {
                continue;
            }
            
            $insuranceParams = [
                $clientId,
                $ins["description"] ?? '',
                $ins["insurance_type"] ?? 'Primary',
                $ins["insurance_provider"] ?? '',
            ];
            
            if ($hasProviderIdColumn) {
                $insuranceParams[] = $ins["insurance_provider_id"] ?? null;
            }
            
            if ($hasPrimaryDiagnosisColumn) {
                $insuranceParams[] = $ins["primary_diagnosis"] ?? null;
            }
            
            $insuranceParams[] = $ins["treatment_type"] ?? '';
            
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
                $ins["copay_per"] ?? 'hr',
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
                $insuranceParams[] = isset($ins["delete_insurance"]) ? ($ins["delete_insurance"] ? 1 : 0) : 0;
            }
            
            if ($hasDocumentColumns) {
                $insuranceParams[] = $ins["insurance_document_path"] ?? '';
                $insuranceParams[] = $ins["insurance_document_filename"] ?? '';
            }
            
            $stmtIns->execute($insuranceParams);
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
            $linkedInsuranceId = mahaverse_resolve_authorization_insurance_id($auth, $insuranceIds);

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
        
        // Check optional columns in client_documents
        $checkColumns = $conn->query("SHOW COLUMNS FROM client_documents LIKE 'document_path'");
        $hasPathColumns = $checkColumns->rowCount() > 0;

        $checkOrigName = $conn->query("SHOW COLUMNS FROM client_documents LIKE 'document_original_filename'");
        $hasOriginalFilename = $checkOrigName->rowCount() > 0;
        
        // Try client_documents first
        try {
            if ($hasPathColumns && $hasOriginalFilename) {
                $docStmt = $conn->prepare("INSERT INTO client_documents (
                    client_id, doc_uuid, document_type, file_url, document_path, document_filename, document_original_filename
                ) VALUES (?, ?, ?, ?, ?, ?, ?)");
            } elseif ($hasPathColumns) {
                $docStmt = $conn->prepare("INSERT INTO client_documents (
                    client_id, doc_uuid, document_type, file_url, document_path, document_filename
                ) VALUES (?, ?, ?, ?, ?, ?)");
            } else {
                $docStmt = $conn->prepare("INSERT INTO client_documents (
                    client_id, doc_uuid, document_type, file_url
                ) VALUES (?, ?, ?, ?)");
            }
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
                if ($hasPathColumns) {
                    // Normalize document_path/document_filename for legacy payloads.
                    // - Drive: legacy stored drive://<folderId> in document_path, but actual fileId is in document_filename.
                    //   Canonicalize to drive://<fileId>.
                    // - Local: legacy stored uploads/.../documents (folder). If document_filename exists, append it.
                    $docPath = $doc["document_path"] ?? $doc["file_url"] ?? '';
                    $docFilename = $doc["document_filename"] ?? '';

                    if (!empty($docPath) && is_string($docPath) && (substr($docPath, 0, 8) === 'drive://') && !empty($docFilename)) {
                        $docPath = 'drive://' . $docFilename;
                    }

                    if (!empty($docPath) && is_string($docPath) && (substr($docPath, 0, 8) === 'uploads/') && !empty($docFilename)) {
                        if (preg_match('#/documents/?$#', $docPath) === 1) {
                            $docPath = rtrim($docPath, "/") . "/" . $docFilename;
                        }
                    }

                    $docOriginal = $doc["document_original_filename"] ?? null;
                    if ($hasOriginalFilename) {
                        $docStmt->execute([
                            $clientId,
                            $docUuid,
                            $doc["document_type"] ?? 'misc',
                            $doc["file_url"] ?? $docPath,
                            $docPath,
                            $docFilename,
                            $docOriginal
                        ]);
                    } else {
                        $docStmt->execute([
                            $clientId,
                            $docUuid,
                            $doc["document_type"] ?? 'misc',
                            $doc["file_url"] ?? $docPath,
                            $docPath,
                            $docFilename
                        ]);
                    }
                } else {
                    $docStmt->execute([
                        $clientId,
                        $docUuid,
                        $doc["document_type"] ?? 'misc',
                        $doc["file_url"] ?? $doc["document_path"] ?? ''
                    ]);
                }
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

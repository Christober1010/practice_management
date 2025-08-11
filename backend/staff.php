<?php
require_once 'db.php'; // Include the database connection file

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetStaff($conn);
        break;
    case 'POST':
        handleAddStaff($conn);
        break;
    case 'PUT':
        handleUpdateStaff($conn);
        break;
    case 'DELETE':
        handleArchiveStaff($conn); // Using DELETE for archiving/restoring
        break;
    case 'OPTIONS':
        // Respond to preflight requests
        http_response_code(200);
        exit();
    default:
        http_response_code(405); // Method Not Allowed
        echo json_encode(["success" => false, "message" => "Method not allowed"]);
        break;
}

function handleGetStaff($conn) {
    $id = $_GET['id'] ?? null;
    $showArchived = isset($_GET['showArchived']) && $_GET['showArchived'] === 'true';

    $sql = "SELECT * FROM staff";
    if ($id) {
        $sql .= " WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("s", $id);
    } else {
        $sql .= " WHERE archived = ?";
        $stmt = $conn->prepare($sql);
        $archived_val = $showArchived ? 1 : 0;
        $stmt->bind_param("i", $archived_val);
    }

    $stmt->execute();
    $result = $stmt->get_result();
    $staff = [];
    while ($row = $result->fetch_assoc()) {
        // Decode JSON fields
        $row['availability'] = json_decode($row['availability'], true);
        $row['locationPreferences'] = json_decode($row['locationPreferences'], true);
        $staff[] = $row;
    }

    echo json_encode(["success" => true, "data" => $staff]);
    $stmt->close();
}

function handleAddStaff($conn) {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!isset($data['firstName'], $data['lastName'], $data['staffType'], $data['certificationNumber'], $data['email'], $data['dateOfJoining'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Missing required fields."]);
        return;
    }

    // Check for duplicate email before adding
    $checkDuplicateSql = "SELECT COUNT(*) FROM staff WHERE email = ?";
    $checkDuplicateStmt = $conn->prepare($checkDuplicateSql);
    $checkDuplicateStmt->bind_param("s", $data['email']);
    $checkDuplicateStmt->execute();
    $duplicateResult = $checkDuplicateStmt->get_result();
    $row = $duplicateResult->fetch_row();
    $count = $row[0];
    $checkDuplicateStmt->close();

    if ($count > 0) {
        http_response_code(409); // Conflict
        echo json_encode(["success" => false, "message" => "Error adding staff: Email already exists."]);
        return;
    }

    // Generate a unique ID if not provided (or if it's a new record)
    $id = $data['id'] ?? 'ST' . uniqid();
    $fullName = trim($data['firstName']) . ' ' . trim($data['lastName']);
    $npiNumber = $data['npiNumber'] ?? null;
    $address = $data['address'] ?? null;
    $phone = $data['phone'] ?? null;
    $dateOfLeaving = $data['dateOfLeaving'] ?? null;
    $status = $data['status'] ?? 'Active';

    // Encode availability and locationPreferences to JSON strings
    $availability_json = json_encode($data['availability'] ?? []);
    if ($availability_json === false) {
        error_log("JSON Encode Error for availability: " . json_last_error_msg());
        $availability_json = '[]'; // Default to empty JSON array on error
    }
    $locationPreferences_json = json_encode($data['locationPreferences'] ?? []);
    if ($locationPreferences_json === false) {
        error_log("JSON Encode Error for locationPreferences: " . json_last_error_msg());
        $locationPreferences_json = '[]'; // Default to empty JSON array on error
    }
    $archived = $data['archived'] ?? false;

    // Use CAST(? AS JSON) for JSON columns
    $sql = "INSERT INTO staff (id, firstName, lastName, fullName, staffType, certificationNumber, npiNumber, address, email, phone, dateOfJoining, dateOfLeaving, status, availability, locationPreferences, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("sssssssssssssisi",
        $id, $data['firstName'], $data['lastName'], $fullName, $data['staffType'],
        $data['certificationNumber'], $npiNumber, $address, $data['email'], $phone,
        $data['dateOfJoining'], $dateOfLeaving, $status, $availability_json, // Use the encoded JSON string
        $locationPreferences_json, // Use the encoded JSON string
        $archived
    );

    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Staff added successfully", "id" => $id]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error adding staff: " . $stmt->error]);
    }
    $stmt->close();
}

function handleUpdateStaff($conn) {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!isset($data['id'], $data['firstName'], $data['lastName'], $data['staffType'], $data['certificationNumber'], $data['email'], $data['dateOfJoining'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Missing required fields for update."]);
        return;
    }

    $id = $data['id'];
    $newEmail = $data['email'];

    // 1. Fetch the current staff record to compare
    $currentStaffSql = "SELECT * FROM staff WHERE id = ?";
    $currentStaffStmt = $conn->prepare($currentStaffSql);
    $currentStaffStmt->bind_param("s", $id);
    $currentStaffStmt->execute();
    $currentStaffResult = $currentStaffStmt->get_result();
    $currentStaffRow = $currentStaffResult->fetch_assoc();
    $currentStaffStmt->close();

    if (!$currentStaffRow) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Staff member not found."]);
        return;
    }

    // Decode current JSON fields for semantic comparison
    $oldAvailability = json_decode($currentStaffRow['availability'], true);
    $oldLocationPreferences = json_decode($currentStaffRow['locationPreferences'], true);

    // Prepare new values from incoming data
    $fullName = trim($data['firstName']) . ' ' . trim($data['lastName']);
    $npiNumber = $data['npiNumber'] ?? null;
    $address = $data['address'] ?? null;
    $phone = $data['phone'] ?? null;
    $dateOfLeaving = $data['dateOfLeaving'] ?? null;
    $status = $data['status'] ?? 'Active';
    $archived = $data['archived'] ?? false;

    // Encode incoming availability and locationPreferences to JSON strings for DB
    $availability_json = json_encode($data['availability'] ?? []);
    if ($availability_json === false) {
        error_log("JSON Encode Error for availability: " . json_last_error_msg());
        $availability_json = '[]';
    }
    $locationPreferences_json = json_encode($data['locationPreferences'] ?? []);
    if ($locationPreferences_json === false) {
        error_log("JSON Encode Error for locationPreferences: " . json_last_error_msg());
        $locationPreferences_json = '[]';
    }

    // Decode incoming JSON for semantic comparison
    $newAvailability = $data['availability'] ?? [];
    $newLocationPreferences = $data['locationPreferences'] ?? [];

    // Check if any data has actually changed
    $hasChanged = false;
    if ($currentStaffRow['firstName'] !== $data['firstName']) $hasChanged = true;
    if ($currentStaffRow['lastName'] !== $data['lastName']) $hasChanged = true;
    if ($currentStaffRow['fullName'] !== $fullName) $hasChanged = true;
    if ($currentStaffRow['staffType'] !== $data['staffType']) $hasChanged = true;
    if ($currentStaffRow['certificationNumber'] !== $data['certificationNumber']) $hasChanged = true;
    if (($currentStaffRow['npiNumber'] ?? null) !== $npiNumber) $hasChanged = true;
    if (($currentStaffRow['address'] ?? null) !== $address) $hasChanged = true;
    if ($currentStaffRow['email'] !== $newEmail) $hasChanged = true;
    if (($currentStaffRow['phone'] ?? null) !== $phone) $hasChanged = true;
    if ($currentStaffRow['dateOfJoining'] !== $data['dateOfJoining']) $hasChanged = true;
    if (($currentStaffRow['dateOfLeaving'] ?? null) !== $dateOfLeaving) $hasChanged = true;
    if ($currentStaffRow['status'] !== $status) $hasChanged = true;
    if ($currentStaffRow['archived'] != $archived) $hasChanged = true; // Compare boolean/int

    // Compare JSON fields semantically (as PHP arrays)
    if ($oldAvailability !== $newAvailability) $hasChanged = true;
    if ($oldLocationPreferences !== $newLocationPreferences) $hasChanged = true;

    // If email has changed, check for duplicates among other staff members
    if ($currentStaffRow['email'] !== $newEmail) {
        $checkDuplicateSql = "SELECT COUNT(*) FROM staff WHERE email = ? AND id != ?";
        $checkDuplicateStmt = $conn->prepare($checkDuplicateSql);
        $checkDuplicateStmt->bind_param("ss", $newEmail, $id);
        $checkDuplicateStmt->execute();
        $duplicateResult = $checkDuplicateStmt->get_result();
        $row = $duplicateResult->fetch_row();
        $count = $row[0];
        $checkDuplicateStmt->close();

        if ($count > 0) {
            http_response_code(409); // Conflict
            echo json_encode(["success" => false, "message" => "Error updating staff: Email already exists for another staff member."]);
            return;
        }
    }

    // If no changes were detected after all comparisons, return early
    if (!$hasChanged) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Staff member found, but no changes were made."]);
        return;
    }

    // Proceed with update only if changes were detected
    $sql = "UPDATE staff SET firstName=?, lastName=?, fullName=?, staffType=?, certificationNumber=?, npiNumber=?, address=?, email=?, phone=?, dateOfJoining=?, dateOfLeaving=?, status=?, availability=CAST(? AS JSON), locationPreferences=CAST(? AS JSON), archived=? WHERE id=?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("sssssssssssssisi",
        $data['firstName'], $data['lastName'], $fullName, $data['staffType'],
        $data['certificationNumber'], $npiNumber, $address, $newEmail, $phone,
        $data['dateOfJoining'], $dateOfLeaving, $status, $availability_json,
        $locationPreferences_json,
        $archived, $id
    );

    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Staff updated successfully"]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error updating staff: " . $stmt->error]);
    }
    $stmt->close();
}

function handleArchiveStaff($conn) {
    $data = json_decode(file_get_contents("php://input"), true); // For DELETE with body
    $id = $data['id'] ?? $_GET['id'] ?? null;
    $archived_status = $data['archived'] ?? null; // Expecting true/false for archive/restore

    if (!$id || !isset($archived_status)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Missing staff ID or archived status."]);
        return;
    }

    $sql = "UPDATE staff SET archived = ? WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("is", $archived_status, $id);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            echo json_encode(["success" => true, "message" => "Staff status updated successfully"]);
        } else {
            http_response_code(404);
            echo json_encode(["success" => false, "message" => "Staff member not found or status already set."]);
        }
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error updating staff status: " . $stmt->error]);
    }
    $stmt->close();
}

$conn->close();
?>

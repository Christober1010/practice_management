<?php
// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
// Add CORS headers - MUST be at the top before any other output
header("Access-Control-Allow-Origin: *"); // Allow requests from any origin (for development)
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Content-Type: application/json");
require_once 'db.php'; // Include the database connection file
// Safe JSON decode function to avoid deprecated warnings
function safe_json_decode($json_str) {
    if (is_null($json_str) || $json_str === '') {
        return null; // or [] depending on context; using null to match original behavior
    }
    $decoded = json_decode($json_str, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('JSON decode error: ' . json_last_error_msg());
        return null;
    }
    return $decoded;
}
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
    $sql = "SELECT s.*,
            (SELECT JSON_ARRAYAGG(sa.fullName)
             FROM JSON_TABLE(s.assignedStaff, '$[*]' COLUMNS (assigned_id VARCHAR(20) PATH '$')) AS jt_staff
             LEFT JOIN staff sa ON sa.id = jt_staff.assigned_id) AS assignedStaffNames,
            (SELECT JSON_ARRAYAGG(CONCAT(c.first_name, ' ', c.last_name))
             FROM JSON_TABLE(s.assignedClients, '$[*]' COLUMNS (assigned_client_id VARCHAR(36) PATH '$')) AS jt_client
             LEFT JOIN clients c ON c.client_id = jt_client.assigned_client_id) AS assignedClientNames
            FROM staff s";
    if ($id) {
        $sql .= " WHERE s.id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("s", $id);
    } else {
        $sql .= " WHERE s.archived = ?";
        $stmt = $conn->prepare($sql);
        $archived_val = $showArchived ? 1 : 0;
        $stmt->bind_param("i", $archived_val);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $staff = [];
    while ($row = $result->fetch_assoc()) {
        // Decode JSON fields safely
        $row['availability'] = safe_json_decode($row['availability']);
        $row['locationPreferences'] = safe_json_decode($row['locationPreferences']);
        $row['assignedStaff'] = safe_json_decode($row['assignedStaff']);
        $row['assignedClients'] = safe_json_decode($row['assignedClients']);
        $row['assignedStaffNames'] = safe_json_decode($row['assignedStaffNames']);
        $row['assignedClientNames'] = safe_json_decode($row['assignedClientNames']);
        $staff[] = $row;
    }
    echo json_encode(["success" => true, "staff_records" => $staff]);
    $stmt->close();
}
function handleAddStaff($conn) {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!isset($data['firstName'], $data['lastName'], $data['staffType'], $data['certificationNumber'], $data['email'], $data['dateOfJoining'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Missing required fields."]);
        return;
    }
    // Generate a unique ID if not provided (or if it's a new record)
    $id = $data['id'] ?? 'ST' . uniqid();
    $fullName = trim($data['firstName']) . ' ' . trim($data['lastName']);
    $npiNumber = $data['npiNumber'] ?? null;
    $address = $data['address'] ?? null;
    $phone = $data['phone'] ?? null;
    $dateOfJoining = $data['dateOfJoining'] ?? null;
    $dateOfLeaving = $data['dateOfLeaving'] ?? null;
    $status = $data['status'] ?? 'Active';
    $dob = $data['dob'] ?? null;
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
    $assignedStaff_json = json_encode($data['assignedStaff'] ?? []);
    if ($assignedStaff_json === false) {
        error_log("JSON Encode Error for assignedStaff: " . json_last_error_msg());
        $assignedStaff_json = '[]'; // Default to empty JSON array on error
    }
    $assignedClients_json = json_encode($data['assignedClients'] ?? []);
    if ($assignedClients_json === false) {
        error_log("JSON Encode Error for assignedClients: " . json_last_error_msg());
        $assignedClients_json = '[]'; // Default to empty JSON array on error
    }
    $archived = $data['archived'] ?? false;
    // Use INSERT IGNORE to skip duplicates without error
    $sql = "INSERT IGNORE INTO staff (id, firstName, lastName, fullName, staffType, certificationNumber, npiNumber, address, email, phone, dateOfJoining, dateOfLeaving, status, dob, availability, locationPreferences, assignedStaff, assignedClients, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?)";
    $stmt = $conn->prepare($sql);
    // Correct bind_param string: 14 's' for initial fields, 4 's' for JSON, 1 'i' for archived
    $stmt->bind_param("ssssssssssssssssssi",
        $id, $data['firstName'], $data['lastName'], $fullName, $data['staffType'],
        $data['certificationNumber'], $npiNumber, $address, $data['email'], $phone,
        $dateOfJoining, $dateOfLeaving, $status, $dob, $availability_json, // Use the encoded JSON string
        $locationPreferences_json, // Use the encoded JSON string
        $assignedStaff_json, // New JSON field
        $assignedClients_json, // New JSON field
        $archived
    );
    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            echo json_encode(["success" => true, "message" => "Staff added successfully", "id" => $id]);
        } else {
            echo json_encode(["success" => false, "message" => "Staff not added (possible duplicate email skipped)"]);
        }
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
    $oldAvailability = safe_json_decode($currentStaffRow['availability']);
    $oldLocationPreferences = safe_json_decode($currentStaffRow['locationPreferences']);
    $oldAssignedStaff = safe_json_decode($currentStaffRow['assignedStaff']);
    $oldAssignedClients = safe_json_decode($currentStaffRow['assignedClients']);
    // Prepare new values from incoming data
    $fullName = trim($data['firstName']) . ' ' . trim($data['lastName']);
    $npiNumber = $data['npiNumber'] ?? null;
    $address = $data['address'] ?? null;
    $phone = $data['phone'] ?? null;
    $dateOfJoining = $data['dateOfJoining'] ?? null;
    $dateOfLeaving = $data['dateOfLeaving'] ?? null;
    $status = $data['status'] ?? 'Active';
    $dob = $data['dob'] ?? null;
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
    $assignedStaff_json = json_encode($data['assignedStaff'] ?? []);
    if ($assignedStaff_json === false) {
        error_log("JSON Encode Error for assignedStaff: " . json_last_error_msg());
        $assignedStaff_json = '[]';
    }
    $assignedClients_json = json_encode($data['assignedClients'] ?? []);
    if ($assignedClients_json === false) {
        error_log("JSON Encode Error for assignedClients: " . json_last_error_msg());
        $assignedClients_json = '[]';
    }
    // Decode incoming JSON for semantic comparison
    $newAvailability = $data['availability'] ?? [];
    $newLocationPreferences = $data['locationPreferences'] ?? [];
    $newAssignedStaff = $data['assignedStaff'] ?? [];
    $newAssignedClients = $data['assignedClients'] ?? [];
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
    if ($currentStaffRow['dateOfJoining'] !== $dateOfJoining) $hasChanged = true;
    if (($currentStaffRow['dateOfLeaving'] ?? null) !== $dateOfLeaving) $hasChanged = true;
    if ($currentStaffRow['status'] !== $status) $hasChanged = true;
    if (($currentStaffRow['dob'] ?? null) !== $dob) $hasChanged = true;
    if ($currentStaffRow['archived'] != $archived) $hasChanged = true; // Compare boolean/int
    // Compare JSON fields semantically (as PHP arrays)
    if ($oldAvailability !== $newAvailability) $hasChanged = true;
    if ($oldLocationPreferences !== $newLocationPreferences) $hasChanged = true;
    if ($oldAssignedStaff !== $newAssignedStaff) $hasChanged = true;
    if ($oldAssignedClients !== $newAssignedClients) $hasChanged = true;
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
    $sql = "UPDATE staff SET firstName=?, lastName=?, fullName=?, staffType=?, certificationNumber=?, npiNumber=?, address=?, email=?, phone=?, dateOfJoining=?, dateOfLeaving=?, status=?, dob=?, availability=CAST(? AS JSON), locationPreferences=CAST(? AS JSON), assignedStaff=CAST(? AS JSON), assignedClients=CAST(? AS JSON), archived=? WHERE id=?";
    $stmt = $conn->prepare($sql);
    // Correct bind_param string: 13 's' for initial fields, 4 's' for JSON, 1 'i' for archived, 1 's' for WHERE id
    $stmt->bind_param("sssssssssssssssssis",
        $data['firstName'], $data['lastName'], $fullName, $data['staffType'],
        $data['certificationNumber'], $npiNumber, $address, $newEmail, $phone,
        $dateOfJoining, $dateOfLeaving, $status, $dob, $availability_json,
        $locationPreferences_json, $assignedStaff_json, $assignedClients_json,
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

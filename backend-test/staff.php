<?php
// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Add CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Content-Type: application/json");

require_once 'db.php';

// Safe JSON decode function
function safe_json_decode($json_str)
{
    if (is_null($json_str) || $json_str === '') {
        return null;
    }
    $decoded = json_decode($json_str, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('JSON decode error: ' . json_last_error_msg());
        return null;
    }
    return $decoded;
}

// ============ AVAILABILITY HELPERS ============
function getStaffAvailability($conn, $staff_id)
{
    $sql = "SELECT day, available, start_time, end_time 
            FROM staff_availability 
            WHERE staff_id = ? 
            ORDER BY FIELD(day, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $staff_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $availability = [];
    while ($row = $result->fetch_assoc()) {
        $day = strtolower($row['day']);
        $availability[$day] = [
            'available' => (bool)$row['available'],
            'start' => $row['start_time'] ?? '00:00:00',
            'end' => $row['end_time'] ?? '00:00:00'
        ];
    }
    $stmt->close();

    // Ensure all days are present
    $allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    foreach ($allDays as $day) {
        if (!isset($availability[$day])) {
            $availability[$day] = ['available' => false, 'start' => '00:00:00', 'end' => '00:00:00'];
        }
    }

    return $availability;
}

function insertStaffAvailability($conn, $staff_id, $availability)
{
    if (empty($availability)) return;

    $sql = "INSERT INTO staff_availability (staff_id, day, available, start_time, end_time) 
            VALUES (?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
                available = VALUES(available), 
                start_time = VALUES(start_time), 
                end_time = VALUES(end_time)";

    $stmt = $conn->prepare($sql);

    foreach ($availability as $day => $slot) {
        $day = strtolower($day);
        $available = isset($slot['available']) ? (int)$slot['available'] : 0;
        $start = $slot['start'] ?? null;
        $end = $slot['end'] ?? null;

        $stmt->bind_param("ssiss", $staff_id, $day, $available, $start, $end);
        $stmt->execute();
    }

    $stmt->close();
}

function updateStaffAvailability($conn, $staff_id, $availability)
{
    // Delete existing
    $deleteSql = "DELETE FROM staff_availability WHERE staff_id = ?";
    $deleteStmt = $conn->prepare($deleteSql);
    $deleteStmt->bind_param("s", $staff_id);
    $deleteStmt->execute();
    $deleteStmt->close();

    // Insert new
    insertStaffAvailability($conn, $staff_id, $availability);
}

function getStaffCertifications($conn, $staff_id)
{
    $sql = "SELECT id, certification_type, certification_number, issue_date, expiry_date,
                   CASE 
                     WHEN expiry_date >= CURDATE() THEN 'Active'
                     ELSE 'Expired'
                   END as status
            FROM staff_certifications
            WHERE staff_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $staff_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $certifications = [];
    while ($row = $result->fetch_assoc()) {
        $certifications[] = $row;
    }
    $stmt->close();

    return $certifications;
}

// ============ STAFF ASSIGNMENT HELPERS ============
function getAssignedStaff($conn, $staff_id)
{
    $sql = "SELECT assigned_staff_id FROM staff_assignments WHERE staff_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $staff_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $assignedStaff = [];
    while ($row = $result->fetch_assoc()) {
        $assignedStaff[] = $row['assigned_staff_id'];
    }
    $stmt->close();

    return $assignedStaff;
}

function getAssignedStaffNames($conn, $staff_id)
{
    $sql = "SELECT s.fullName 
            FROM staff_assignments sa
            JOIN staff s ON sa.assigned_staff_id = s.id
            WHERE sa.staff_id = ?";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $staff_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $names = [];
    while ($row = $result->fetch_assoc()) {
        $names[] = $row['fullName'];
    }
    $stmt->close();

    return $names;
}

function updateAssignedStaff($conn, $staff_id, $assignedStaffArray)
{
    // Delete existing assignments
    $deleteSql = "DELETE FROM staff_assignments WHERE staff_id = ?";
    $deleteStmt = $conn->prepare($deleteSql);
    $deleteStmt->bind_param("s", $staff_id);
    $deleteStmt->execute();
    $deleteStmt->close();

    // Insert new assignments
    if (!empty($assignedStaffArray)) {
        $insertSql = "INSERT INTO staff_assignments (staff_id, assigned_staff_id) VALUES (?, ?)";
        $insertStmt = $conn->prepare($insertSql);

        foreach ($assignedStaffArray as $assigned_staff_id) {
            $insertStmt->bind_param("ss", $staff_id, $assigned_staff_id);
            $insertStmt->execute();
        }

        $insertStmt->close();
    }
}

// ============ CLIENT ASSIGNMENT HELPERS ============
function getAssignedClients($conn, $staff_id)
{
    $sql = "SELECT client_id FROM staff_client_assignments WHERE staff_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $staff_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $assignedClients = [];
    while ($row = $result->fetch_assoc()) {
        $assignedClients[] = $row['client_id'];
    }
    $stmt->close();

    return $assignedClients;
}

function getAssignedClientNames($conn, $staff_id)
{
    $sql = "SELECT CONCAT(c.first_name, ' ', c.last_name) AS fullName
            FROM staff_client_assignments sca
            JOIN clients c ON sca.client_id = c.client_id
            WHERE sca.staff_id = ?";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $staff_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $names = [];
    while ($row = $result->fetch_assoc()) {
        $names[] = $row['fullName'];
    }
    $stmt->close();

    return $names;
}

function updateAssignedClients($conn, $staff_id, $assignedClientsArray)
{
    // Delete existing assignments
    $deleteSql = "DELETE FROM staff_client_assignments WHERE staff_id = ?";
    $deleteStmt = $conn->prepare($deleteSql);
    $deleteStmt->bind_param("s", $staff_id);
    $deleteStmt->execute();
    $deleteStmt->close();

    // Insert new assignments
    if (!empty($assignedClientsArray)) {
        $insertSql = "INSERT INTO staff_client_assignments (staff_id, client_id) VALUES (?, ?)";
        $insertStmt = $conn->prepare($insertSql);

        foreach ($assignedClientsArray as $client_id) {
            $insertStmt->bind_param("ss", $staff_id, $client_id);
            $insertStmt->execute();
        }

        $insertStmt->close();
    }
}

// ============ MAIN REQUEST HANDLERS ============
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
        handleArchiveStaff($conn);
        break;
    case 'OPTIONS':
        http_response_code(200);
        exit();
    default:
        http_response_code(405);
        echo json_encode(["success" => false, "message" => "Method not allowed"]);
        break;
}

// ============ COMPLETE STAFF.PHP UPDATED FUNCTIONS ============

// Update the handleGetStaff function to not return certificationNumber from staff table
function handleGetStaff($conn)
{
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
        // Decode existing JSON fields
        $row['locationPreferences'] = safe_json_decode($row['locationPreferences']);

        // Fetch from separate tables
        $row['availability'] = getStaffAvailability($conn, $row['id']);
        $row['assignedStaff'] = getAssignedStaff($conn, $row['id']);
        $row['assignedClients'] = getAssignedClients($conn, $row['id']);
        $row['assignedStaffNames'] = getAssignedStaffNames($conn, $row['id']);
        $row['assignedClientNames'] = getAssignedClientNames($conn, $row['id']);
        $row['certifications'] = getStaffCertifications($conn, $row['id']);

        // Get certificationNumber from certifications table (first cert or null)
        if (!empty($row['certifications'])) {
            $row['certificationNumber'] = $row['certifications'][0]['certification_number'];
        } else {
            $row['certificationNumber'] = null;
        }

        $staff[] = $row;
    }

    echo json_encode(["success" => true, "staff_records" => $staff]);
    $stmt->close();
}

function handleAddStaff($conn)
{
    $data = json_decode(file_get_contents("php://input"), true);

    if (!isset($data['firstName'], $data['lastName'], $data['staffType'], $data['email'], $data['dateOfJoining'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Missing required fields."]);
        return;
    }

    $id = $data['id'] ?? 'ST' . uniqid();
    $fullName = trim($data['firstName']) . ' ' . trim($data['lastName']);
    $npiNumber = $data['npiNumber'] ?? null;
    $address = $data['address'] ?? null;
    $phone = $data['phone'] ?? null;
    $dateOfJoining = $data['dateOfJoining'] ?? null;
    $dateOfLeaving = $data['dateOfLeaving'] ?? null;
    $status = $data['status'] ?? 'Active';
    $dob = $data['dob'] ?? null;
    $location = $data['location'] ?? null;
    $archived = $data['archived'] ?? false;

    // Encode only locationPreferences
    $locationPreferences_json = json_encode($data['locationPreferences'] ?? []);
    if ($locationPreferences_json === false) {
        error_log("JSON Encode Error for locationPreferences: " . json_last_error_msg());
        $locationPreferences_json = '[]';
    }

    // Insert main staff record WITHOUT certificationNumber
    $sql = "INSERT IGNORE INTO staff (id, firstName, lastName, fullName, staffType, npiNumber, address, email, phone, dateOfJoining, dateOfLeaving, status, dob, location, locationPreferences, archived) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?)";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param(
        "sssssssssssssssi",
        $id,
        $data['firstName'],
        $data['lastName'],
        $fullName,
        $data['staffType'],
        $npiNumber,
        $address,
        $data['email'],
        $phone,
        $dateOfJoining,
        $dateOfLeaving,
        $status,
        $dob,
        $location,
        $locationPreferences_json,
        $archived
    );

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            // Insert into separate tables
            insertStaffAvailability($conn, $id, $data['availability'] ?? []);
            updateAssignedStaff($conn, $id, $data['assignedStaff'] ?? []);
            updateAssignedClients($conn, $id, $data['assignedClients'] ?? []);

            // Handle certifications
            $certifications = $data['certifications'] ?? [];

            // If no certifications array but certificationNumber is provided, create one
            if (empty($certifications) && !empty($data['certificationNumber'])) {
                $certifications = [[
                    'certification_type' => $data['staffType'],
                    'certification_number' => $data['certificationNumber'],
                    'issue_date' => date('Y-m-d'),
                    'expiry_date' => date('Y-m-d', strtotime('+1 year'))
                ]];
            }

            if (!empty($certifications)) {
                $certSql = "INSERT INTO staff_certifications (staff_id, certification_type, certification_number, issue_date, expiry_date)
                VALUES (?, ?, ?, ?, ?)";
                $certStmt = $conn->prepare($certSql);

                foreach ($certifications as $cert) {
                    $certType = $cert['certification_type'] ?? $data['staffType'];
                    $certNumber = $cert['certification_number'] ?? null;
                    $issueDate = $cert['issue_date'] ?? date('Y-m-d');
                    $expiryDate = $cert['expiry_date'] ?? date('Y-m-d', strtotime('+1 year'));

                    $certStmt->bind_param(
                        "sssss",
                        $id,
                        $certType,
                        $certNumber,
                        $issueDate,
                        $expiryDate
                    );
                    $certStmt->execute();
                }
                $certStmt->close();
            }

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

function handleUpdateStaff($conn)
{
    $data = json_decode(file_get_contents("php://input"), true);

    if (!isset($data['id'], $data['firstName'], $data['lastName'], $data['staffType'], $data['email'], $data['dateOfJoining'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Missing required fields for update."]);
        return;
    }

    $id = $data['id'];
    $newEmail = $data['email'];

    // Fetch current staff record
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

    // Get old values from separate tables
    $oldAvailability = getStaffAvailability($conn, $id);
    $oldAssignedStaff = getAssignedStaff($conn, $id);
    $oldAssignedClients = getAssignedClients($conn, $id);
    $oldLocationPreferences = safe_json_decode($currentStaffRow['locationPreferences']);
    $oldCertifications = getStaffCertifications($conn, $id);

    // Prepare new values
    $fullName = trim($data['firstName']) . ' ' . trim($data['lastName']);
    $npiNumber = $data['npiNumber'] ?? null;
    $address = $data['address'] ?? null;
    $phone = $data['phone'] ?? null;
    $dateOfJoining = $data['dateOfJoining'] ?? null;
    $dateOfLeaving = $data['dateOfLeaving'] ?? null;
    $status = $data['status'] ?? 'Active';
    $dob = $data['dob'] ?? null;
    $location = $data['location'] ?? null;
    $archived = $data['archived'] ?? false;

    $locationPreferences_json = json_encode($data['locationPreferences'] ?? []);
    if ($locationPreferences_json === false) {
        error_log("JSON Encode Error for locationPreferences: " . json_last_error_msg());
        $locationPreferences_json = '[]';
    }

    $newAvailability = $data['availability'] ?? [];
    $newLocationPreferences = $data['locationPreferences'] ?? [];
    $newAssignedStaff = $data['assignedStaff'] ?? [];
    $newAssignedClients = $data['assignedClients'] ?? [];

    // Prepare new certifications
    $newCertifications = $data['certifications'] ?? [];

    // If no certifications array but certificationNumber is provided, create one
    if (empty($newCertifications) && !empty($data['certificationNumber'])) {
        $newCertifications = [[
            'certification_type' => $data['staffType'],
            'certification_number' => $data['certificationNumber'],
            'issue_date' => date('Y-m-d'),
            'expiry_date' => date('Y-m-d', strtotime('+1 year'))
        ]];
    }

    // Check if any data has changed
    $hasChanged = false;

    if ($currentStaffRow['firstName'] !== $data['firstName']) $hasChanged = true;
    if ($currentStaffRow['lastName'] !== $data['lastName']) $hasChanged = true;
    if ($currentStaffRow['fullName'] !== $fullName) $hasChanged = true;
    if ($currentStaffRow['staffType'] !== $data['staffType']) $hasChanged = true;
    if (($currentStaffRow['npiNumber'] ?? null) !== $npiNumber) $hasChanged = true;
    if (($currentStaffRow['address'] ?? null) !== $address) $hasChanged = true;
    if ($currentStaffRow['email'] !== $newEmail) $hasChanged = true;
    if (($currentStaffRow['phone'] ?? null) !== $phone) $hasChanged = true;
    if ($currentStaffRow['dateOfJoining'] !== $dateOfJoining) $hasChanged = true;
    if (($currentStaffRow['dateOfLeaving'] ?? null) !== $dateOfLeaving) $hasChanged = true;
    if ($currentStaffRow['status'] !== $status) $hasChanged = true;
    if (($currentStaffRow['dob'] ?? null) !== $dob) $hasChanged = true;
    if (($currentStaffRow['location'] ?? null) !== $location) $hasChanged = true;
    if ($currentStaffRow['archived'] != $archived) $hasChanged = true;

    // Compare arrays/objects
    if ($oldAvailability !== $newAvailability) $hasChanged = true;
    if ($oldLocationPreferences !== $newLocationPreferences) $hasChanged = true;

    // Compare certifications (normalize for comparison)
    $oldCertsNormalized = array_map(function ($cert) {
        unset($cert['id'], $cert['status']);
        return $cert;
    }, $oldCertifications);

    $newCertsNormalized = array_map(function ($cert) {
        unset($cert['id'], $cert['status']);
        return $cert;
    }, $newCertifications);

    if (json_encode($oldCertsNormalized) !== json_encode($newCertsNormalized)) $hasChanged = true;

    // Compare assigned staff and clients
    sort($oldAssignedStaff);
    sort($newAssignedStaff);
    sort($oldAssignedClients);
    sort($newAssignedClients);

    if ($oldAssignedStaff !== $newAssignedStaff) $hasChanged = true;
    if ($oldAssignedClients !== $newAssignedClients) $hasChanged = true;

    // Check for duplicate email
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
            http_response_code(409);
            echo json_encode(["success" => false, "message" => "Error updating staff: Email already exists for another staff member."]);
            return;
        }
    }

    if (!$hasChanged) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Staff member found, but no changes were made."]);
        return;
    }

    // Update main staff table WITHOUT certificationNumber
    $sql = "UPDATE staff SET 
        firstName=?, lastName=?, fullName=?, staffType=?,
        npiNumber=?, address=?, email=?, phone=?, dateOfJoining=?, dateOfLeaving=?, 
        status=?, dob=?, location=?, locationPreferences=CAST(? AS JSON), archived=? 
        WHERE id=?";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param(
        "ssssssssssssssis",
        $data['firstName'],
        $data['lastName'],
        $fullName,
        $data['staffType'],
        $npiNumber,
        $address,
        $newEmail,
        $phone,
        $dateOfJoining,
        $dateOfLeaving,
        $status,
        $dob,
        $location,
        $locationPreferences_json,
        $archived,
        $id
    );

    if ($stmt->execute()) {
        // Update separate tables if changed
        if ($oldAvailability !== $newAvailability) {
            updateStaffAvailability($conn, $id, $newAvailability);
        }

        sort($oldAssignedStaff);
        sort($newAssignedStaff);
        if ($oldAssignedStaff !== $newAssignedStaff) {
            updateAssignedStaff($conn, $id, $newAssignedStaff);
        }

        sort($oldAssignedClients);
        sort($newAssignedClients);
        if ($oldAssignedClients !== $newAssignedClients) {
            updateAssignedClients($conn, $id, $newAssignedClients);
        }

        // ===== Update Certifications =====
        if (!empty($newCertifications) || !empty($data['certificationNumber'])) {
            // Delete existing certifications
            $deleteCertSql = "DELETE FROM staff_certifications WHERE staff_id = ?";
            $deleteCertStmt = $conn->prepare($deleteCertSql);
            $deleteCertStmt->bind_param("s", $id);
            $deleteCertStmt->execute();
            $deleteCertStmt->close();

            // Ensure there is at least one certification
            if (empty($newCertifications) && !empty($data['certificationNumber'])) {
                $newCertifications = [[
                    'certification_type' => $data['staffType'],
                    'certification_number' => $data['certificationNumber'],
                    'issue_date' => date('Y-m-d'),
                    'expiry_date' => date('Y-m-d', strtotime('+1 year'))
                ]];
            }

            // Insert certifications
            $certSql = "INSERT INTO staff_certifications (staff_id, certification_type, certification_number, issue_date, expiry_date)
        VALUES (?, ?, ?, ?, ?)";
            $certStmt = $conn->prepare($certSql);

            foreach ($newCertifications as $cert) {
                $certType = $cert['certification_type'] ?? $data['staffType'];
                $certNumber = $cert['certification_number'] ?? null;
                $issueDate = $cert['issue_date'] ?? date('Y-m-d');
                $expiryDate = $cert['expiry_date'] ?? date('Y-m-d', strtotime('+1 year'));

                $certStmt->bind_param(
                    "sssss",
                    $id,
                    $certType,
                    $certNumber,
                    $issueDate,
                    $expiryDate
                );
                $certStmt->execute();
            }

            $certStmt->close();
        }


        echo json_encode(["success" => true, "message" => "Staff updated successfully"]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error updating staff: " . $stmt->error]);
    }

    $stmt->close();
}

function handleArchiveStaff($conn)
{
    $data = json_decode(file_get_contents("php://input"), true);
    $id = $data['id'] ?? $_GET['id'] ?? null;
    $archived_status = $data['archived'] ?? null;

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

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

    // Generate a unique ID if not provided (or if it's a new record)
    $id = $data['id'] ?? 'ST' . uniqid();
    $fullName = trim($data['firstName']) . ' ' . trim($data['lastName']);
    $npiNumber = $data['npiNumber'] ?? null;
    $address = $data['address'] ?? null;
    $phone = $data['phone'] ?? null;
    $dateOfLeaving = $data['dateOfLeaving'] ?? null;
    $status = $data['status'] ?? 'Active';
    $availability = json_encode($data['availability'] ?? []);
    $locationPreferences = json_encode($data['locationPreferences'] ?? []);
    $archived = $data['archived'] ?? false;

    $sql = "INSERT INTO staff (id, firstName, lastName, fullName, staffType, certificationNumber, npiNumber, address, email, phone, dateOfJoining, dateOfLeaving, status, availability, locationPreferences, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("sssssssssssssssi",
        $id, $data['firstName'], $data['lastName'], $fullName, $data['staffType'],
        $data['certificationNumber'], $npiNumber, $address, $data['email'], $phone,
        $data['dateOfJoining'], $dateOfLeaving, $status, $availability,
        $locationPreferences, $archived
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
    $fullName = trim($data['firstName']) . ' ' . trim($data['lastName']);
    $npiNumber = $data['npiNumber'] ?? null;
    $address = $data['address'] ?? null;
    $phone = $data['phone'] ?? null;
    $dateOfLeaving = $data['dateOfLeaving'] ?? null;
    $status = $data['status'] ?? 'Active';
    $availability = json_encode($data['availability'] ?? []);
    $locationPreferences = json_encode($data['locationPreferences'] ?? []);
    $archived = $data['archived'] ?? false;

    $sql = "UPDATE staff SET firstName=?, lastName=?, fullName=?, staffType=?, certificationNumber=?, npiNumber=?, address=?, email=?, phone=?, dateOfJoining=?, dateOfLeaving=?, status=?, availability=?, locationPreferences=?, archived=? WHERE id=?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("sssssssssssssisi",
        $data['firstName'], $data['lastName'], $fullName, $data['staffType'],
        $data['certificationNumber'], $npiNumber, $address, $data['email'], $phone,
        $data['dateOfJoining'], $dateOfLeaving, $status, $availability,
        $locationPreferences, $archived, $id
    );

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            echo json_encode(["success" => true, "message" => "Staff updated successfully"]);
        } else {
            http_response_code(404);
            echo json_encode(["success" => false, "message" => "Staff member not found or no changes made."]);
        }
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
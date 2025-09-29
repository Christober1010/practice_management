<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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
    error_log("Received input for update-users.php: " . print_r($input, true));

    // Validate required fields
    $required = ["id", "email", "role"];  // Password optional for updates
    foreach ($required as $field) {
        if (empty($input[$field])) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Missing required field: $field"]);
            exit();
        }
    }

    $userId = $input["id"];

    // Check if user exists
    $stmtCheck = $conn->prepare("SELECT COUNT(*) FROM users WHERE id = :id");
    $stmtCheck->execute([":id" => $userId]);
    $exists = $stmtCheck->fetchColumn() > 0;

    if ($exists) {
        // Update user
        $sql = "UPDATE users SET
            email = :email,
            role = :role,
            first_name = :first_name,
            last_name = :last_name,
            is_active = :is_active,
            updated_at = CURRENT_TIMESTAMP";
        
        // Handle password only if provided
        if (!empty($input["PASSWORD"])) {
            $sql .= ", PASSWORD = :PASSWORD";
        }
        
        $sql .= " WHERE id = :id";
    } else {
        // Insert new user (require password for create)
        if (empty($input["PASSWORD"])) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Password is required for new users"]);
            exit();
        }
        
        $sql = "INSERT INTO users (
            id, email, PASSWORD, role, first_name, last_name, is_active
        ) VALUES (
            :id, :email, :PASSWORD, :role, :first_name, :last_name, :is_active
        )";
    }

    $stmt = $conn->prepare($sql);

    $params = [
        ":id" => $userId,
        ":email" => $input["email"],
        ":role" => $input["role"],
        ":first_name" => $input["first_name"] ?? '',
        ":last_name" => $input["last_name"] ?? '',
        ":is_active" => $input["is_active"] ?? 1
    ];

    // Add hashed password if provided
    if (!empty($input["PASSWORD"])) {
        $params[":PASSWORD"] = password_hash($input["PASSWORD"], PASSWORD_DEFAULT);
    }

    error_log("Executing SQL with parameters: " . print_r($params, true));

    $stmt->execute($params);

    echo json_encode([
        "success" => true,
        "message" => $exists ? "User updated successfully" : "User added successfully"
    ]);
} catch (PDOException $e) {
    error_log("Database error in update-users.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ]);
}
?>

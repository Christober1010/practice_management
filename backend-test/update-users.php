<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = requireAuth('users.write', 'mahaverse');



// Test environment (align with backend-test/config.php)
$host = "db5018419668.hosting-data.io";
$dbname = "dbs14649042";
$dbUser = "dbu1183438";
$pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";

/**
 * Ensure role actually stuck. Older prod schemas used an ENUM that omitted
 * values like `biller` / `planner` / `client`; MySQL then stored '' while
 * still reporting a successful UPDATE. Widen to VARCHAR and rewrite once.
 */
function ensureUserRolePersisted(PDO $conn, $userId, string $expectedRole): void
{
    $expectedRole = trim($expectedRole);
    $stmt = $conn->prepare('SELECT `role` FROM users WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $userId]);
    $stored = trim((string) ($stmt->fetchColumn() ?: ''));
    if (strcasecmp($stored, $expectedRole) === 0) {
        return;
    }

    error_log("users.role mismatch for id={$userId}: expected={$expectedRole} stored={$stored}; widening column");
    $conn->exec("ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(64) NOT NULL DEFAULT ''");

    $upd = $conn->prepare('UPDATE users SET `role` = :role WHERE id = :id');
    $upd->execute([':role' => $expectedRole, ':id' => $userId]);

    $stmt->execute([':id' => $userId]);
    $stored = trim((string) ($stmt->fetchColumn() ?: ''));
    if (strcasecmp($stored, $expectedRole) !== 0) {
        throw new RuntimeException(
            "Role '{$expectedRole}' could not be saved (database stored '{$stored}'). " .
            "Run migration/shared/migrate_users_role_varchar_v1.sql on this database."
        );
    }
}

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $dbUser, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $input = json_decode(file_get_contents("php://input"), true);
    error_log("Received input for update-users.php: " . print_r($input, true));

    $emailTrim = trim((string) ($input["email"] ?? ''));
    $roleTrim = trim((string) ($input["role"] ?? ''));

    // Validate required fields (id optional for new users — UI sends UUID but DB may use AUTO_INCREMENT int)
    if ($emailTrim === '' || $roleTrim === '') {
        http_response_code(400);
        $missing = $emailTrim === '' ? 'email' : 'role';
        echo json_encode(["success" => false, "message" => "Missing required field: $missing"]);
        exit();
    }

    $clientId = isset($input["id"]) ? $input["id"] : null;
    $isUuidClientId = is_string($clientId) && preg_match(
        '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i',
        $clientId
    );

    $idColRow = $conn->query("SHOW COLUMNS FROM `users` WHERE Field = 'id'")->fetch(PDO::FETCH_ASSOC);
    $idType = strtolower((string) ($idColRow['Type'] ?? ''));
    $idExtra = strtolower((string) ($idColRow['Extra'] ?? ''));
    $idIsAutoIncrement = strpos($idExtra, 'auto_increment') !== false;
    $idColumnIsNumeric = (bool) preg_match('/^(tinyint|smallint|mediumint|int|bigint)/', $idType);

    // --- New user from Add User modal (React sends a UUID placeholder) ---
    if ($isUuidClientId) {
        if (empty($input["PASSWORD"])) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Password is required for new users"]);
            exit();
        }

        $dupStmt = $conn->prepare("SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(?) LIMIT 1");
        $dupStmt->execute([$emailTrim]);
        if ($dupStmt->fetch(PDO::FETCH_ASSOC)) {
            http_response_code(409);
            echo json_encode(["success" => false, "message" => "A user with this email already exists."]);
            exit();
        }

        $hash = password_hash($input["PASSWORD"], PASSWORD_DEFAULT);
        $paramsBase = [
            ":email" => $emailTrim,
            ":pwd" => $hash,
            ":role" => $roleTrim,
            ":first_name" => $input["first_name"] ?? '',
            ":last_name" => $input["last_name"] ?? '',
            ":is_active" => isset($input["is_active"]) ? (int) $input["is_active"] : 1,
        ];

        // Typical production schema: INT/BIGINT PRIMARY KEY AUTO_INCREMENT — omit id so MySQL assigns next id.
        if ($idColumnIsNumeric && $idIsAutoIncrement) {
            $sql = "INSERT INTO users (email, `password`, role, first_name, last_name, is_active)
                    VALUES (:email, :pwd, :role, :first_name, :last_name, :is_active)";
            $stmt = $conn->prepare($sql);
            $stmt->execute($paramsBase);
            $newId = $conn->lastInsertId();
            ensureUserRolePersisted($conn, $newId, $roleTrim);
            echo json_encode([
                "success" => true,
                "message" => "User added successfully",
                "id" => $newId,
            ]);
            exit();
        }

        // VARCHAR/CHAR PK (e.g. UUID string): persist client id
        if (!$idColumnIsNumeric) {
            $sql = "INSERT INTO users (id, email, `password`, role, first_name, last_name, is_active)
                    VALUES (:id, :email, :pwd, :role, :first_name, :last_name, :is_active)";
            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ":id" => $clientId,
                ":email" => $emailTrim,
                ":pwd" => $hash,
                ":role" => $roleTrim,
                ":first_name" => $input["first_name"] ?? '',
                ":last_name" => $input["last_name"] ?? '',
                ":is_active" => isset($input["is_active"]) ? (int) $input["is_active"] : 1,
            ]);
            ensureUserRolePersisted($conn, $clientId, $roleTrim);
            echo json_encode([
                "success" => true,
                "message" => "User added successfully",
                "id" => $clientId,
            ]);
            exit();
        }

        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Cannot create user: users.id must be AUTO_INCREMENT or a non-numeric primary key. Check your database schema.",
        ]);
        exit();
    }

    // --- Edit existing user or legacy insert with explicit numeric/string id ---
    if ($clientId === null || $clientId === '') {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Missing required field: id"]);
        exit();
    }

    $userId = $clientId;

    $stmtCheck = $conn->prepare("SELECT COUNT(*) FROM users WHERE id = :id");
    $stmtCheck->execute([":id" => $userId]);
    $exists = $stmtCheck->fetchColumn() > 0;

    if ($exists) {
        $sql = "UPDATE users SET
            email = :email,
            role = :role,
            first_name = :first_name,
            last_name = :last_name,
            is_active = :is_active,
            updated_at = CURRENT_TIMESTAMP";

        if (!empty($input["PASSWORD"])) {
            $sql .= ", `password` = :pwd";
        }

        $sql .= " WHERE id = :id";
    } else {
        if (empty($input["PASSWORD"])) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Password is required for new users"]);
            exit();
        }

        $sql = "INSERT INTO users (
            id, email, `password`, role, first_name, last_name, is_active
        ) VALUES (
            :id, :email, :pwd, :role, :first_name, :last_name, :is_active
        )";
    }

    $stmt = $conn->prepare($sql);

    $params = [
        ":id" => $userId,
        ":email" => $emailTrim,
        ":role" => $roleTrim,
        ":first_name" => $input["first_name"] ?? '',
        ":last_name" => $input["last_name"] ?? '',
        ":is_active" => isset($input["is_active"]) ? (int) $input["is_active"] : 1,
    ];

    if (!empty($input["PASSWORD"])) {
        $params[":pwd"] = password_hash($input["PASSWORD"], PASSWORD_DEFAULT);
    }

    error_log("Executing SQL with parameters: " . print_r($params, true));

    $stmt->execute($params);
    ensureUserRolePersisted($conn, $userId, $roleTrim);

    echo json_encode([
        "success" => true,
        "message" => $exists ? "User updated successfully" : "User added successfully",
    ]);
} catch (RuntimeException $e) {
    error_log("Role persist error in update-users.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
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

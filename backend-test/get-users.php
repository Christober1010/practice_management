<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = getAuthenticatedUser();
if ($authUser && !rbac_user_has_permission_key($authUser['role'], 'users.read', 'mahaverse')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Permission denied']);
    exit;
}

// Test DB — same as config.php getDBConnection() / add-session.php
$host = "db5018419668.hosting-data.io";
$dbname = "dbs14649042";
$dbUser = "dbu1183438";
$pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $dbUser, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $conn->query(
        'SELECT id, email, `role`, first_name, last_name, is_active FROM users ORDER BY id DESC'
    );
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($users as &$row) {
        $row['role'] = isset($row['role']) ? trim((string) $row['role']) : '';
        $raw = $row['is_active'] ?? null;
        $row['is_active'] = ($raw === 1 || $raw === '1' || $raw === true) ? 1 : 0;
    }
    unset($row);

    echo json_encode([
        "success" => true,
        "users" => $users
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
}
?>

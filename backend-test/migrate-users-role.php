<?php
/**
 * One-shot: widen users.role to VARCHAR(64) so planner/client (and any future roles) persist.
 * DELETE this file after a successful run.
 *
 * POST or GET with admin auth (users.write).
 */
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = requireAuth('users.write', 'mahaverse');

$host = "db5018419668.hosting-data.io";
$dbname = "dbs14649042";
$dbUser = "dbu1183438";
$pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $dbUser, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $before = $conn->query("SHOW COLUMNS FROM users LIKE 'role'")->fetch(PDO::FETCH_ASSOC);
    $conn->exec("ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(64) NOT NULL DEFAULT ''");
    $after = $conn->query("SHOW COLUMNS FROM users LIKE 'role'")->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "message" => "users.role widened to VARCHAR(64)",
        "before" => $before['Type'] ?? null,
        "after" => $after['Type'] ?? null,
        "note" => "Delete migrate-users-role.php after confirming.",
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Server error: " . $e->getMessage(),
    ]);
}

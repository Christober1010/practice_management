<?php
/**
 * One-shot: widen clients.client_status to VARCHAR(64) so workflow labels persist
 * (Service Terminated, Active Treatment, etc.). Safe to re-run.
 *
 * GET or POST with clients.update (or clients.write) auth.
 * Prefer deleting after confirming both test + prod, or leave as idempotent repair.
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
$authUser = requireAuthAny(['clients.update', 'clients.write'], 'mahaverse');

$host = "db5018266079.hosting-data.io";
$dbname = "dbs14484433";
$dbUser = "dbu3321929";
$pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $dbUser, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $result = mahaverse_ensure_clients_client_status_varchar($conn);

    echo json_encode([
        "success" => true,
        "message" => $result['changed']
            ? "clients.client_status widened to VARCHAR(64); blank statuses normalized to New"
            : "clients.client_status already wide enough",
        "before" => $result['before'],
        "after" => $result['after'],
        "changed" => $result['changed'],
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Server error: " . $e->getMessage(),
    ]);
}

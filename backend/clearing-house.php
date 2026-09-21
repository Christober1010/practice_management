<?php
/**
 * Manage Data → Clearing House (Office Ally SFTP settings).
 * GET: read settings (manage_data.read)
 * PUT: save settings (manage_data.write)
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
require_once __DIR__ . '/clearing_house_settings_lib.php';
require_once __DIR__ . '/officeally_config_helper.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$host = "db5018266079.hosting-data.io";
$dbUser = "dbu3321929";
$dbPass = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$dbName = "dbs14484433";

$conn = new mysqli($host, $dbUser, $dbPass, $dbName);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}
$conn->set_charset('utf8mb4');

function clearing_house_fail(int $code, string $message): void
{
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message]);
    exit();
}

if ($method === 'GET') {
    requireAuth('manage_data.read', 'mahaverse');
    $row = clearing_house_load_row($conn);
    $settings = clearing_house_public_settings($row);
    $effective = officeally_public_config(officeally_get_config($conn));
    echo json_encode([
        'success' => true,
        'settings' => $settings,
        'effective' => $effective,
    ]);
    $conn->close();
    exit();
}

if ($method === 'PUT') {
    $authUser = requireAuth('manage_data.write', 'mahaverse');
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        clearing_house_fail(400, 'Invalid JSON body');
    }
    $actor = '';
    if (is_array($authUser)) {
        $actor = (string)($authUser['email'] ?? $authUser['username'] ?? $authUser['id'] ?? '');
    }
    try {
        $settings = clearing_house_save_settings($conn, $input, $actor);
        $effective = officeally_public_config(officeally_get_config($conn));
        echo json_encode([
            'success' => true,
            'message' => 'Clearing house settings saved',
            'settings' => $settings,
            'effective' => $effective,
        ]);
    } catch (InvalidArgumentException $e) {
        clearing_house_fail(400, $e->getMessage());
    } catch (RuntimeException $e) {
        clearing_house_fail(500, $e->getMessage());
    }
    $conn->close();
    exit();
}

clearing_house_fail(405, 'Method not allowed');

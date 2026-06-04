<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
require_once __DIR__ . '/config.php';
$authUser = requireAuthReadWrite('master_data.read', 'master_data.write', 'mahaverse');

mahaverse_require_helper('behavior_helpers');

$host = "db5018266079.hosting-data.io";
$user = "dbu3321929";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14484433";

$conn = new mysqli($host, $user, $password, $database);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();

}
$conn->set_charset('utf8mb4');

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?: [];

try {
    if ($method === 'GET') {
        echo json_encode([
            'success' => true,
            'data' => [
                'categories' => br_fetch_master_categories($conn),
                'behaviors' => br_fetch_master_behaviors($conn),
            ],
        ]);
    } elseif ($method === 'POST') {
        if (!empty($input['categories']) && is_array($input['categories'])) {
            foreach ($input['categories'] as $cat) {
                br_upsert_master_category($conn, $cat);
            }
        }
        if (!empty($input['behaviors']) && is_array($input['behaviors'])) {
            foreach ($input['behaviors'] as $b) {
                br_upsert_master_behavior($conn, $b);
            }
        }
        echo json_encode(['success' => true, 'message' => 'Saved successfully']);
    } elseif ($method === 'PUT') {
        $type = $input['type'] ?? '';
        if ($type === 'category') {
            br_upsert_master_category($conn, $input);
        } elseif ($type === 'behavior') {
            br_upsert_master_behavior($conn, $input);
        } else {
            throw new Exception('type must be category or behavior');
        }
        echo json_encode(['success' => true, 'message' => 'Updated successfully']);
    } elseif ($method === 'DELETE') {
        $type = $input['type'] ?? '';
        $id = $conn->real_escape_string($input['id'] ?? '');
        if ($id === '') {
            throw new Exception('id is required');
        }
        if ($type === 'category') {
            $conn->query("UPDATE master_behavior_categories SET archived = 1, status = 'Inactive' WHERE id = '$id'");
        } elseif ($type === 'behavior') {
            $conn->query("UPDATE master_behaviors SET archived = 1, status = 'Inactive', is_active = 0 WHERE id = '$id'");
        } else {
            throw new Exception('type must be category or behavior');
        }
        echo json_encode(['success' => true, 'message' => 'Archived successfully']);
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
} finally {
    $conn->close();
}

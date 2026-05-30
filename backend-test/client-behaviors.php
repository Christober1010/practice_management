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

$host = "db5018419668.hosting-data.io";
$user = "dbu1183438";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14649042";

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
        $clientId = $_GET['client_id'] ?? null;
        if (!$clientId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'client_id is required']);
            exit();

        }
        $abc = br_fetch_abc_setup($conn, (string)$clientId);
        $rawAbc = [];
        if (br_table_exists($conn, 'client_session_abc_data')) {
            $cid = $conn->real_escape_string((string)$clientId);
            $limit = isset($_GET['raw_abc_limit']) ? max(1, min(500, (int)$_GET['raw_abc_limit'])) : 100;
            $r = $conn->query("SELECT * FROM client_session_abc_data WHERE client_id = '$cid' ORDER BY session_date DESC, created_at DESC LIMIT $limit");
            if ($r) {
                while ($row = $r->fetch_assoc()) {
                    $rawAbc[] = $row;
                }
            }
        }
        echo json_encode([
            'success' => true,
            'data' => [
                'behaviors' => br_fetch_client_behaviors($conn, (string)$clientId),
                'abc_antecedents' => $abc['antecedents'],
                'abc_consequences' => $abc['consequences'],
                'abc_locations' => $abc['locations'],
                'raw_abc' => $rawAbc,
            ],
        ]);
    } elseif ($method === 'POST') {
        $clientId = $input['client_id'] ?? null;
        if (!$clientId) {
            throw new Exception('client_id is required');
        }
        if (!empty($input['behaviors']) && is_array($input['behaviors'])) {
            foreach ($input['behaviors'] as $b) {
                br_upsert_client_behavior($conn, (string)$clientId, $b);
            }
        }
        foreach (['abc_antecedents' => 'client_abc_antecedents', 'abc_consequences' => 'client_abc_consequences', 'abc_locations' => 'client_abc_locations'] as $key => $table) {
            if (!empty($input[$key]) && is_array($input[$key])) {
                foreach ($input[$key] as $item) {
                    br_upsert_abc_item($conn, $table, (string)$clientId, $item);
                }
            }
        }
        echo json_encode(['success' => true, 'message' => 'Saved successfully']);
    } elseif ($method === 'PUT') {
        $clientId = $input['client_id'] ?? null;
        if (!$clientId) {
            throw new Exception('client_id is required');
        }
        $type = $input['type'] ?? '';
        if ($type === 'behavior') {
            br_upsert_client_behavior($conn, (string)$clientId, $input);
        } elseif (in_array($type, ['antecedent', 'consequence', 'location'], true)) {
            $tableMap = [
                'antecedent' => 'client_abc_antecedents',
                'consequence' => 'client_abc_consequences',
                'location' => 'client_abc_locations',
            ];
            br_upsert_abc_item($conn, $tableMap[$type], (string)$clientId, $input);
        } else {
            throw new Exception('Invalid type');
        }
        echo json_encode(['success' => true, 'message' => 'Updated successfully']);
    } elseif ($method === 'DELETE') {
        $clientId = $input['client_id'] ?? null;
        $id = $conn->real_escape_string($input['id'] ?? '');
        $type = $input['type'] ?? '';
        if (!$clientId || $id === '') {
            throw new Exception('client_id and id are required');
        }
        $cid = $conn->real_escape_string((string)$clientId);
        if ($type === 'behavior') {
            $conn->query("UPDATE client_behaviors SET archived = 1, status = 'Inactive', is_active = 0 WHERE id = '$id' AND client_id = '$cid'");
        } elseif ($type === 'antecedent') {
            $conn->query("UPDATE client_abc_antecedents SET is_active = 0 WHERE id = '$id' AND client_id = '$cid'");
        } elseif ($type === 'consequence') {
            $conn->query("UPDATE client_abc_consequences SET is_active = 0 WHERE id = '$id' AND client_id = '$cid'");
        } elseif ($type === 'location') {
            $conn->query("UPDATE client_abc_locations SET is_active = 0 WHERE id = '$id' AND client_id = '$cid'");
        } elseif ($type === 'abc_entry') {
            $conn->query("DELETE FROM client_session_abc_data WHERE id = '$id' AND client_id = '$cid'");
        } else {
            throw new Exception('Invalid type');
        }
        echo json_encode(['success' => true, 'message' => 'Deleted successfully']);
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

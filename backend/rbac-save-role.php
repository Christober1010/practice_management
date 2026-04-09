<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$user = requireUser();
if (strtolower((string) $user['role']) !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Admin role required']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
    exit;
}

$roleName = isset($input['role']) ? strtolower(trim((string) $input['role'])) : '';
$permKeys = isset($input['permission_keys']) && is_array($input['permission_keys']) ? $input['permission_keys'] : [];
$scope = isset($input['scope']) ? strtolower(trim((string) $input['scope'])) : 'mahaverse';
if (!in_array($scope, ['mahaverse', 'launchpad'], true)) {
    $scope = 'mahaverse';
}

if ($roleName === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'role is required']);
    exit;
}

$allowedRoles = $scope === 'mahaverse'
    ? ['admin', 'bcba', 'rbt', 'parent', 'biller']
    : ['admin', 'hr', 'staff', 'viewer'];
if (!in_array($roleName, $allowedRoles, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid role for this scope']);
    exit;
}

// Normalize permission keys
$permKeys = array_values(array_unique(array_map(function ($k) {
    return strtolower(trim((string) $k));
}, $permKeys)));

if ($scope === 'mahaverse' && $roleName === 'admin') {
    if (!in_array('users.write', $permKeys, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Admin role must retain users.write (prevents lockout).']);
        exit;
    }
}

if ($scope === 'launchpad' && $roleName === 'admin') {
    if (!in_array('launchpad.users', $permKeys, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Launchpad admin must retain launchpad.users.']);
        exit;
    }
}

try {
    $conn = getDBConnection();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database unavailable']);
    exit;
}

if (!rbac_tables_exist($conn)) {
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => 'RBAC tables not installed']);
    exit;
}

    $conn->begin_transaction();

try {
    $del = $conn->prepare('DELETE FROM rbac_role_grants WHERE LOWER(role_name) = ?');
    $del->bind_param('s', $roleName);
    $del->execute();
    $del->close();

    foreach ($permKeys as $pk) {
        $stmt = $conn->prepare('SELECT id FROM rbac_permissions WHERE perm_key = ? AND app_scope = ? LIMIT 1');
        $stmt->bind_param('ss', $pk, $scope);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $stmt->close();
        if (!$row) {
            continue;
        }
        $pid = (int) $row['id'];
        $ins = $conn->prepare('INSERT INTO rbac_role_grants (role_name, permission_id) VALUES (?, ?)');
        $ins->bind_param('si', $roleName, $pid);
        $ins->execute();
        $ins->close();
    }

    $conn->commit();
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to save grants']);
    exit;
}

echo json_encode(['success' => true, 'role' => $roleName, 'scope' => $scope]);

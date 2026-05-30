<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
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

$scope = isset($_GET['scope']) ? strtolower(trim((string) $_GET['scope'])) : 'mahaverse';
if (!in_array($scope, ['mahaverse', 'launchpad'], true)) {
    $scope = 'mahaverse';
}

try {
    $conn = getDBConnection();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database unavailable']);
    exit;
}

if (!rbac_tables_exist($conn)) {
    echo json_encode([
        'success' => false,
        'message' => 'RBAC tables not installed. Run migration/launchpad/shared/create_rbac_tables.sql',
    ]);
    exit;
}

$permStmt = $conn->prepare("
    SELECT id, perm_key, label, perm_group, app_scope, sort_order
    FROM rbac_permissions
    WHERE app_scope = ?
    ORDER BY sort_order ASC, perm_key ASC
");
$permStmt->bind_param('s', $scope);
$permStmt->execute();
$permRes = $permStmt->get_result();
$permissions = [];
while ($row = $permRes->fetch_assoc()) {
    $permissions[] = $row;
}
$permStmt->close();

$roles = [];
if ($scope === 'mahaverse') {
    $roles = ['admin', 'bcba', 'rbt', 'parent', 'biller'];
} else {
    $roles = ['admin', 'hr', 'staff', 'viewer'];
}

$grants = [];
$rg = $conn->query("
    SELECT LOWER(rg.role_name) AS role_name, p.perm_key
    FROM rbac_role_grants rg
    JOIN rbac_permissions p ON p.id = rg.permission_id
    WHERE p.app_scope = '" . $conn->real_escape_string($scope) . "'
");
if ($rg) {
    while ($row = $rg->fetch_assoc()) {
        $rn = $row['role_name'];
        if (!isset($grants[$rn])) {
            $grants[$rn] = [];
        }
        $grants[$rn][] = $row['perm_key'];
    }
}

echo json_encode([
    'success' => true,
    'scope' => $scope,
    'permissions' => $permissions,
    'roles' => $roles,
    'grants' => $grants,
]);

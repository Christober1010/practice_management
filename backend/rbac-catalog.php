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
        'success' => true,
        'permissions' => [],
        'message' => 'RBAC tables not installed; using legacy role defaults.',
    ]);
    exit;
}

$stmt = $conn->prepare("
    SELECT id, perm_key, label, perm_group, app_scope, sort_order
    FROM rbac_permissions
    WHERE app_scope = ?
    ORDER BY sort_order ASC, perm_key ASC
");
$stmt->bind_param('s', $scope);
$stmt->execute();
$res = $stmt->get_result();
$rows = [];
while ($row = $res->fetch_assoc()) {
    $rows[] = $row;
}
$stmt->close();

echo json_encode(['success' => true, 'permissions' => $rows, 'scope' => $scope]);

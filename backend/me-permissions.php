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
$scope = isset($_GET['scope']) ? strtolower(trim((string) $_GET['scope'])) : 'mahaverse';
if (!in_array($scope, ['mahaverse', 'launchpad'], true)) {
    $scope = 'mahaverse';
}

$perms = rbac_get_effective_permissions($user['role'], $scope);

echo json_encode([
    'success' => true,
    'role' => $user['role'],
    'scope' => $scope,
    'permissions' => $perms,
]);

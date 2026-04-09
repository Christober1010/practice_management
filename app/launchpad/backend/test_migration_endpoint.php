<?php
/**
 * Simple test endpoint to verify migration script is accessible
 */

// Suppress any output that might interfere with JSON response
ob_start();

try {
    require_once __DIR__ . '/config.php';
} catch (Throwable $e) {
    ob_clean();
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Config load failed: ' . $e->getMessage()]);
    exit;
}

ob_clean();
header('Content-Type: application/json; charset=utf-8');

$authUser = requireUser();
$role = isset($authUser['role']) ? strtolower((string)$authUser['role']) : 'staff';
$isAdminLike = ($role === 'admin' || $role === 'hr');

if (!$isAdminLike) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Admin/HR access required']);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Migration endpoint is accessible',
    'user' => [
        'id' => $authUser['id'] ?? null,
        'username' => $authUser['username'] ?? null,
        'role' => $role
    ],
    'timestamp' => date('Y-m-d H:i:s')
]);


<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config.php';

$user = requireUser();

echo json_encode([
    'valid' => true,
    'success' => true,
    'user' => [
        'id' => $user['id'],
        'username' => $user['username'] ?? null,
        'role' => $user['role'] ?? null,
    ],
]);

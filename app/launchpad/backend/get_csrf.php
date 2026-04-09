<?php
require_once 'config.php';

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit;
}

// Require authentication to get CSRF token
requireAuth();

$token = generateCSRFToken();

echo json_encode([
    'success' => true,
    'token' => $token
]);
?>


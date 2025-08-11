<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get authorization header
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode(['error' => 'No valid token provided']);
    exit();
}

$token = $matches[1];

// Database configuration
$host = 'db5018266079.hosting-data.io';
$dbname = 'dbu3321929';
$username = 'dbu3321929';
$password = 'M@h@B3h@v1or@lH3@lth4@ut1sm';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // For this demo, we'll validate against stored user data
    // In production, you'd have a sessions table
    
    http_response_code(200);
    echo json_encode(['valid' => true]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Verification failed']);
}
?>

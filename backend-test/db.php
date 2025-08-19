<?php
// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *"); // Allow requests from any origin (for development)
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Content-Type: application/json");

// Database credentials from environment variables (recommended for production)
// For local testing, you might hardcode them or use a .env file (not supported by Next.js)
define('DB_HOST', getenv('DB_HOST') ?: 'db5018419668.hosting-data.io');
define('DB_USER', getenv('DB_USER') ?: 'dbu3321929');
define('DB_PASS', getenv('DB_PASS') ?: 'M@h@B3h@v1or@lH3@lth4@ut1sm');
define('DB_NAME', getenv('DB_NAME') ?: 'dbs14484433');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Connection failed: " . $conn->connect_error]);
    exit();
}
?>
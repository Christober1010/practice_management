<?php
// Debug script to check session state
// DELETE THIS FILE AFTER USE - IT'S FOR DEBUGGING ONLY

require_once 'config.php';

echo "<pre>";
echo "=== Session Debug Info ===\n\n";

echo "Session Status: " . (session_status() === PHP_SESSION_ACTIVE ? "ACTIVE" : "NOT ACTIVE") . "\n";
echo "Session ID: " . session_id() . "\n";
echo "Session Name: " . session_name() . "\n\n";

echo "Session Data:\n";
print_r($_SESSION);

echo "\n\n=== Cookie Info ===\n";
echo "Cookies sent by browser:\n";
print_r($_COOKIE);

echo "\n\n=== Request Headers ===\n";
echo "Origin: " . (isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'Not set') . "\n";
echo "Host: " . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'Not set') . "\n";
echo "HTTPS: " . (isset($_SERVER['HTTPS']) ? $_SERVER['HTTPS'] : 'Not set') . "\n";
echo "Request Method: " . $_SERVER['REQUEST_METHOD'] . "\n";

echo "\n\n=== Session Cookie Params ===\n";
$cookieParams = session_get_cookie_params();
print_r($cookieParams);

echo "\n\n=== Authentication Check ===\n";
echo "Is Authenticated: " . (isAuthenticated() ? "YES" : "NO") . "\n";
if (isAuthenticated()) {
    echo "User ID: " . $_SESSION['user_id'] . "\n";
    echo "Username: " . $_SESSION['username'] . "\n";
    echo "Role: " . $_SESSION['role'] . "\n";
}

echo "</pre>";
?>


<?php
// Test script to check if session cookie is being set
// DELETE THIS FILE AFTER USE

// Start output buffering to capture headers
ob_start();

// Manually configure session before starting
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_secure', 0);
ini_set('session.cookie_samesite', 'Lax');

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'domain' => '',
    'secure' => false,
    'httponly' => true,
    'samesite' => 'Lax'
]);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Set a test value
$_SESSION['test'] = 'cookie_test_' . time();

// Get headers that were sent
$headers = headers_list();

echo "<pre>";
echo "=== Session Cookie Test ===\n\n";
echo "Session ID: " . session_id() . "\n";
echo "Session Name: " . session_name() . "\n\n";

echo "Headers sent:\n";
foreach ($headers as $header) {
    echo $header . "\n";
}

echo "\n\nSession Data:\n";
print_r($_SESSION);

echo "\n\nCookie Parameters:\n";
print_r(session_get_cookie_params());

echo "\n\n=== Instructions ===\n";
echo "1. Check browser DevTools -> Application -> Cookies\n";
echo "2. Look for PHPSESSID cookie\n";
echo "3. Refresh this page and check if the session persists\n";
echo "</pre>";
?>


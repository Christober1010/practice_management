<?php
/**
 * Test Environment Variables
 * 
 * This file helps you verify that your .env file is being loaded correctly.
 * 
 * ⚠️ SECURITY: Delete this file after testing!
 */

require_once __DIR__ . '/config.php';

header('Content-Type: text/plain');

echo "=== Environment Variables Test ===\n\n";

// Check if .env file exists
$envPath = __DIR__ . '/.env';
echo "1. .env file exists: " . (file_exists($envPath) ? "YES ✓" : "NO ✗") . "\n";
if (file_exists($envPath)) {
    echo "   Location: $envPath\n";
    echo "   Size: " . filesize($envPath) . " bytes\n";
    echo "   Permissions: " . substr(sprintf('%o', fileperms($envPath)), -4) . "\n";
    echo "\n";
    echo "   First 10 lines of .env file:\n";
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach (array_slice($lines, 0, 10) as $i => $line) {
        $line = trim($line);
        if (strpos($line, '#') === 0) continue; // Skip comments
        if (strpos($line, 'SECRET') !== false || strpos($line, 'KEY') !== false) {
            // Hide sensitive values
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                echo "   " . trim($key) . "=" . (trim($value) ? "[SET - " . strlen(trim($value)) . " chars]" : "[EMPTY ✗]") . "\n";
            }
        } else {
            echo "   " . substr($line, 0, 80) . "\n";
        }
    }
}
echo "\n";

// Check OAuth variables
echo "2. OAuth Configuration (from getenv):\n";
$clientId = getenv('GOOGLE_DRIVE_OAUTH_CLIENT_ID');
$clientSecret = getenv('GOOGLE_DRIVE_OAUTH_CLIENT_SECRET');
$redirectUri = getenv('GOOGLE_DRIVE_OAUTH_REDIRECT_URI');

echo "   GOOGLE_DRIVE_OAUTH_CLIENT_ID: " . ($clientId ? "SET ✓ ($clientId)" : "NOT FOUND ✗") . "\n";
echo "   GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: " . ($clientSecret ? "SET ✓ (" . strlen($clientSecret) . " chars)" : "EMPTY/NOT FOUND ✗") . "\n";
echo "   GOOGLE_DRIVE_OAUTH_REDIRECT_URI: " . ($redirectUri ? "SET ✓ ($redirectUri)" : "NOT FOUND ✗") . "\n";
echo "\n";

// Check other Drive variables
echo "3. Other Drive Configuration:\n";
echo "   GOOGLE_DRIVE_ENABLED: " . (getenv('GOOGLE_DRIVE_ENABLED') ?: 'NOT SET') . "\n";
echo "   GOOGLE_DRIVE_AUTH_MODE: " . (getenv('GOOGLE_DRIVE_AUTH_MODE') ?: 'NOT SET') . "\n";
echo "   GOOGLE_DRIVE_ROOT_FOLDER_ID: " . (getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID') ? "SET ✓" : "NOT SET ✗") . "\n";
echo "   GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY: " . (getenv('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY') ? "SET ✓ (" . strlen(getenv('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY')) . " chars)" : "NOT SET ✗") . "\n";
echo "\n";

// Summary
echo "=== Summary ===\n";
if ($clientId && $clientSecret && strlen($clientSecret) > 0) {
    echo "✅ OAuth credentials are configured!\n";
    echo "✅ Client ID: " . substr($clientId, 0, 30) . "...\n";
    echo "✅ Client Secret: " . strlen($clientSecret) . " characters\n";
} else {
    echo "❌ OAuth credentials are missing or incomplete!\n";
    echo "\n";
    if (!$clientId) {
        echo "   ✗ GOOGLE_DRIVE_OAUTH_CLIENT_ID is missing\n";
    }
    if (!$clientSecret || strlen($clientSecret) === 0) {
        echo "   ✗ GOOGLE_DRIVE_OAUTH_CLIENT_SECRET is missing or empty\n";
        echo "      This is REQUIRED! Get it from Google Cloud Console\n";
    }
    if (!$redirectUri) {
        echo "   ✗ GOOGLE_DRIVE_OAUTH_REDIRECT_URI is missing\n";
    }
    echo "\n";
    echo "To fix:\n";
    echo "1. Open backend/.env file on your SERVER\n";
    echo "2. Make sure GOOGLE_DRIVE_OAUTH_CLIENT_SECRET has a value (not empty)\n";
    echo "3. Get Client Secret from: https://console.cloud.google.com/apis/credentials\n";
    echo "4. Make sure there are NO spaces around the = sign\n";
    echo "5. Make sure the value is on the same line as the key\n";
}


<?php
/**
 * Debug Environment Variables Loading
 * 
 * This will help diagnose why .env file isn't being read
 */

echo "<pre>";
echo "=== Environment Variables Debug ===\n\n";

// Check if .env file exists
$envPath = __DIR__ . '/.env';
echo "1. .env file check:\n";
echo "   Path: $envPath\n";
echo "   Exists: " . (file_exists($envPath) ? "YES ✓" : "NO ✗") . "\n";

if (file_exists($envPath)) {
    echo "   Size: " . filesize($envPath) . " bytes\n";
    echo "   Permissions: " . substr(sprintf('%o', fileperms($envPath)), -4) . "\n";
    echo "   Readable: " . (is_readable($envPath) ? "YES ✓" : "NO ✗") . "\n";
    echo "\n";
    
    // Show raw file contents (first 20 lines)
    echo "2. Raw .env file contents (first 20 lines):\n";
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach (array_slice($lines, 0, 20) as $i => $line) {
        $lineNum = $i + 1;
        // Hide sensitive values
        if (strpos($line, 'SECRET') !== false || strpos($line, 'KEY') !== false) {
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $value = trim($value);
                $display = $value ? "[HIDDEN - " . strlen($value) . " chars]" : "[EMPTY]";
                echo "   Line $lineNum: " . trim($key) . "=$display\n";
            } else {
                echo "   Line $lineNum: $line\n";
            }
        } else {
            echo "   Line $lineNum: " . substr($line, 0, 100) . "\n";
        }
    }
    echo "\n";
}

// Test config.php loading
echo "3. Testing config.php .env loading:\n";
require_once __DIR__ . '/config.php';

// Check what getenv returns
echo "   After loading config.php:\n";
$enabled = getenv('GOOGLE_DRIVE_ENABLED');
$authMode = getenv('GOOGLE_DRIVE_AUTH_MODE');
$clientId = getenv('GOOGLE_DRIVE_OAUTH_CLIENT_ID');
$clientSecret = getenv('GOOGLE_DRIVE_OAUTH_CLIENT_SECRET');

echo "   GOOGLE_DRIVE_ENABLED: " . var_export($enabled, true) . "\n";
echo "   GOOGLE_DRIVE_AUTH_MODE: " . var_export($authMode, true) . "\n";
echo "   GOOGLE_DRIVE_OAUTH_CLIENT_ID: " . ($clientId ? substr($clientId, 0, 30) . "..." : "NULL/EMPTY") . "\n";
echo "   GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: " . ($clientSecret ? "[SET - " . strlen($clientSecret) . " chars]" : "NULL/EMPTY") . "\n";
echo "\n";

// Check $_ENV array
echo "4. \$_ENV array check:\n";
echo "   GOOGLE_DRIVE_ENABLED in \$_ENV: " . (isset($_ENV['GOOGLE_DRIVE_ENABLED']) ? var_export($_ENV['GOOGLE_DRIVE_ENABLED'], true) : "NOT SET") . "\n";
echo "   GOOGLE_DRIVE_AUTH_MODE in \$_ENV: " . (isset($_ENV['GOOGLE_DRIVE_AUTH_MODE']) ? var_export($_ENV['GOOGLE_DRIVE_AUTH_MODE'], true) : "NOT SET") . "\n";
echo "\n";

// Summary
echo "=== Summary ===\n";
if ($enabled === 'true' || $enabled === '1') {
    echo "✅ GOOGLE_DRIVE_ENABLED is correctly set\n";
} else {
    echo "❌ GOOGLE_DRIVE_ENABLED is NOT set correctly (got: " . var_export($enabled, true) . ")\n";
}

if ($authMode === 'oauth') {
    echo "✅ GOOGLE_DRIVE_AUTH_MODE is correctly set to 'oauth'\n";
} else {
    echo "❌ GOOGLE_DRIVE_AUTH_MODE is NOT set to 'oauth' (got: " . var_export($authMode, true) . ")\n";
}

if ($clientId && $clientSecret) {
    echo "✅ OAuth credentials are set\n";
} else {
    echo "❌ OAuth credentials are missing\n";
}

echo "</pre>";


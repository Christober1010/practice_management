<?php
/**
 * Test OAuth Start - Debug version
 * This will show what's happening instead of redirecting
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/drive_helper.php';

header('Content-Type: text/plain');

echo "=== OAuth Start Debug ===\n\n";

// Check authentication
$authUser = null;
if (isset($_GET['token']) && $_GET['token'] !== '') {
    $authUser = getAuthenticatedUserFromToken(trim((string)$_GET['token']));
}

if (!$authUser) {
    echo "❌ Authentication failed\n";
    echo "Token provided: " . (isset($_GET['token']) ? "YES" : "NO") . "\n";
    exit;
}

echo "✅ Authenticated as: " . $authUser['username'] . " (role: " . $authUser['role'] . ")\n\n";

// Check role
$role = isset($authUser['role']) ? $authUser['role'] : 'staff';
$isAdminLike = ($role === 'admin' || $role === 'hr');
if (!$isAdminLike) {
    echo "❌ Access denied - not admin/hr\n";
    exit;
}

echo "✅ Role check passed\n\n";

// Check Google Client
if (!class_exists('Google\\Client')) {
    echo "❌ Google Client class not found\n";
    exit;
}
echo "✅ Google Client class found\n\n";

// Check OAuth credentials
$clientId = getenv('GOOGLE_DRIVE_OAUTH_CLIENT_ID');
$clientSecret = getenv('GOOGLE_DRIVE_OAUTH_CLIENT_SECRET');
$redirectUri = getenv('GOOGLE_DRIVE_OAUTH_REDIRECT_URI');

echo "OAuth Configuration:\n";
echo "  Client ID: " . ($clientId ? substr($clientId, 0, 30) . "..." : "NOT SET") . "\n";
echo "  Client Secret: " . ($clientSecret ? "[SET - " . strlen($clientSecret) . " chars]" : "NOT SET") . "\n";
echo "  Redirect URI: " . ($redirectUri ?: "NOT SET") . "\n\n";

if (empty($clientId) || empty($clientSecret)) {
    echo "❌ OAuth credentials missing\n";
    exit;
}

if (empty($redirectUri)) {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $redirectUri = $scheme . '://' . $host . '/backend/drive_oauth_callback.php';
    echo "⚠️  Using default redirect URI: $redirectUri\n\n";
}

// Try to create Google Client
try {
    $client = new Google\Client();
    $client->setClientId($clientId);
    $client->setClientSecret($clientSecret);
    $client->setRedirectUri($redirectUri);
    
    $scopesEnv = getenv('GOOGLE_DRIVE_SCOPES');
    $scopes = $scopesEnv ? array_values(array_filter(array_map('trim', explode(',', $scopesEnv)))) : [];
    if (empty($scopes)) $scopes = ['https://www.googleapis.com/auth/drive.file'];
    $client->setScopes($scopes);
    
    $client->setAccessType('offline');
    $client->setPrompt('consent');
    $client->setIncludeGrantedScopes(true);
    
    echo "✅ Google Client configured\n";
    echo "  Scopes: " . implode(', ', $scopes) . "\n\n";
    
    // Try to create auth URL
    $authUrl = $client->createAuthUrl();
    
    if (empty($authUrl)) {
        echo "❌ Failed to create auth URL\n";
        exit;
    }
    
    echo "✅ Auth URL created successfully!\n";
    echo "  URL: $authUrl\n\n";
    echo "=== Next Steps ===\n";
    echo "1. Copy the URL above\n";
    echo "2. Open it in your browser\n";
    echo "3. Or use the normal endpoint: drive_oauth_start.php\n";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "  File: " . $e->getFile() . "\n";
    echo "  Line: " . $e->getLine() . "\n";
}


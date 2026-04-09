<?php
/**
 * OAuth Debug - Shows what redirect URI is being used
 */

header('Content-Type: application/json');
require_once __DIR__ . '/config.php';

$debug = [
    'success' => true,
    'env_redirect_uri' => getenv('GOOGLE_DRIVE_OAUTH_REDIRECT_URI'),
    'env_client_id' => getenv('GOOGLE_DRIVE_OAUTH_CLIENT_ID'),
    'env_client_secret_set' => !empty(getenv('GOOGLE_DRIVE_OAUTH_CLIENT_SECRET')),
    'server_info' => [
        'http_host' => $_SERVER['HTTP_HOST'] ?? 'N/A',
        'request_scheme' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http',
        'script_name' => $_SERVER['SCRIPT_NAME'] ?? 'N/A',
        'request_uri' => $_SERVER['REQUEST_URI'] ?? 'N/A',
    ],
    'computed_redirect_uri' => null,
    'recommendations' => []
];

// Compute what redirect URI would be used
$redirectUri = getenv('GOOGLE_DRIVE_OAUTH_REDIRECT_URI');
if (empty($redirectUri)) {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $redirectUri = $scheme . '://' . $host . '/backend/drive_oauth_callback.php';
    $debug['computed_redirect_uri'] = $redirectUri;
    $debug['recommendations'][] = 'GOOGLE_DRIVE_OAUTH_REDIRECT_URI not set - using computed default';
} else {
    $debug['computed_redirect_uri'] = $redirectUri;
}

// Check if redirect URI matches expected format
$expectedUri = 'https://www.mahabehavioralhealth.com/mahaverse-backend-logics/drive_oauth_callback.php';
if ($redirectUri !== $expectedUri) {
    $debug['recommendations'][] = "Redirect URI mismatch! Expected: $expectedUri, Got: $redirectUri";
    $debug['recommendations'][] = "Make sure your .env file has: GOOGLE_DRIVE_OAUTH_REDIRECT_URI=$expectedUri";
}

// Check Google Cloud Console requirements
$debug['google_cloud_console_checklist'] = [
    'step_1' => 'Go to https://console.cloud.google.com/',
    'step_2' => 'Navigate to: APIs & Services → Credentials',
    'step_3' => 'Click on your OAuth 2.0 Client ID: ' . (getenv('GOOGLE_DRIVE_OAUTH_CLIENT_ID') ?: 'NOT SET'),
    'step_4' => 'Under "Authorized redirect URIs", add EXACTLY this URI:',
    'redirect_uri_to_add' => $expectedUri,
    'step_5' => 'Save and wait 2-5 minutes for changes to propagate',
    'step_6' => 'Make sure OAuth consent screen is configured (if required)',
];

echo json_encode($debug, JSON_PRETTY_PRINT);


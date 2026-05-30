<?php
/**
 * Temporary auth/DB diagnostic (remove after test deploy is stable).
 * GET /health-auth.php
 * GET /health-auth.php with Authorization: Bearer <token> or X-Auth-Token
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$out = ['steps' => [], 'ok' => true];

try {
    $out['steps'][] = 'start';
    require_once __DIR__ . '/config.php';
    $out['steps'][] = 'config_loaded';
    $out['php_version'] = PHP_VERSION;
    $out['requireUser'] = function_exists('requireUser');
    $out['requireAuth'] = function_exists('requireAuth');

    $conn = getDBConnection();
    $dbRow = $conn->query('SELECT DATABASE() AS db');
    $out['database'] = $dbRow ? ($dbRow->fetch_assoc()['db'] ?? null) : null;
    $out['steps'][] = 'db_connected';

    $tc = $conn->query("SHOW TABLES LIKE 'AuthTokens'");
    $out['auth_tokens_table'] = ($tc && $tc->num_rows > 0);
    if ($out['auth_tokens_table']) {
        $cnt = $conn->query('SELECT COUNT(*) AS c FROM AuthTokens WHERE revoked_at IS NULL AND expires_at > NOW()');
        $out['active_tokens'] = $cnt ? (int) ($cnt->fetch_assoc()['c'] ?? 0) : null;
    }

    mahaverse_require_helper('client_auth_units_helpers');
    $out['steps'][] = 'helpers_loaded';
    $out['enrich_fn'] = function_exists('client_auth_enrich_authorizations_pdo');

    $token = getBearerTokenFromRequest();
    if (!$token) {
        $token = getTokenFromCustomHeaders();
    }
    $out['request_has_token'] = ($token !== '');
    if ($token !== '') {
        $out['token_length'] = strlen($token);
        $user = getAuthenticatedUserFromToken($token);
        $out['token_valid'] = (bool) $user;
        if ($user) {
            $out['user_id'] = (int) $user['id'];
            $out['role'] = $user['role'] ?? null;
        }
    }

    $out['authorization_header_present'] = (getAuthorizationHeader() !== '');
} catch (Throwable $e) {
    $out['ok'] = false;
    $out['error'] = $e->getMessage();
    $out['error_file'] = basename($e->getFile());
    $out['error_line'] = $e->getLine();
    http_response_code(500);
}

echo json_encode($out, JSON_PRETTY_PRINT);

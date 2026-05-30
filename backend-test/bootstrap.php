<?php
/**
 * Shared API bootstrap for backend-test JSON endpoints.
 * Include after setting any endpoint-specific headers if needed.
 */
require_once __DIR__ . '/config.php';

function api_json_cors_headers(array $methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']): void {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: ' . implode(', ', $methods));
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Accept, Accept-Language, Cache-Control');
    header('Access-Control-Max-Age: 86400');
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
    }
}

function api_handle_options_preflight(int $code = 204): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code($code);
        exit;
    }
}

function api_bootstrap_auth(?string $permissionKey = null, string $scope = 'mahaverse'): array {
    api_json_cors_headers();
    api_handle_options_preflight();
    return requireAuth($permissionKey, $scope);
}

function api_bootstrap_auth_read_write(string $readPerm, string $writePerm, string $scope = 'mahaverse'): array {
    api_json_cors_headers();
    api_handle_options_preflight();
    return requireAuthReadWrite($readPerm, $writePerm, $scope);
}

<?php
/**
 * Shared CORS allowlist for Launchpad PHP backend.
 * Mahaverse static host may be http or https (e.g. http://mahaverse.mahabehavioralhealth.com).
 */

function launchpad_cors_allowed_origins(): array
{
    return [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://localhost:3000',
        'https://localhost:3001',
        'http://mahaverse-dev.mahabehavioralhealth.com',
        'https://mahaverse-dev.mahabehavioralhealth.com',
        'http://mahaverse.mahabehavioralhealth.com',
        'https://mahaverse.mahabehavioralhealth.com',
        'http://www.mahabehavioralhealth.com',
        'https://www.mahabehavioralhealth.com',
        'http://launchpad.dev.mahabehavioralhealth.com',
        'https://launchpad.dev.mahabehavioralhealth.com',
        'https://launchpad.mahabehavioralhealth.com',
        'https://maha-launchpad.mahabehavioralhealth.com',
    ];
}

function launchpad_is_allowed_cors_origin(?string $origin): bool
{
    if ($origin === null || $origin === '') {
        return false;
    }

    if (in_array($origin, launchpad_cors_allowed_origins(), true)) {
        return true;
    }

    $host = parse_url($origin, PHP_URL_HOST);
    $scheme = parse_url($origin, PHP_URL_SCHEME);
    if (!$host || !in_array($scheme, ['http', 'https'], true)) {
        return false;
    }

    // Any subdomain of mahabehavioralhealth.com (http or https).
    return preg_match('/(^|\.)mahabehavioralhealth\.com$/i', $host) === 1;
}

function launchpad_origin_is_allowed(?string $origin, ?string $requestHost = null): bool
{
    $requestHost = $requestHost ?? ($_SERVER['HTTP_HOST'] ?? '');
    $isSameDomain = !empty($origin)
        && !empty($requestHost)
        && parse_url($origin, PHP_URL_HOST) === $requestHost;

    return $isSameDomain || launchpad_is_allowed_cors_origin($origin);
}

function launchpad_apply_cors_headers(string $methods = 'GET, POST, OPTIONS'): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $requestHost = $_SERVER['HTTP_HOST'] ?? '';

    if (launchpad_origin_is_allowed($origin, $requestHost)) {
        header("Access-Control-Allow-Origin: $origin");
    }

    header('Access-Control-Allow-Credentials: true');
    header("Access-Control-Allow-Methods: $methods");
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, Accept, Origin, Authorization, X-Auth-Token, X-CSRF-Token, X-SSO-Secret');
    header('Access-Control-Max-Age: 86400');
}

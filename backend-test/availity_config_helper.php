<?php
/**
 * Availity SFTP / EDI configuration from environment variables.
 */

function availity_env(string $key, string $default = ''): string
{
    $v = getenv($key);
    if ($v === false || $v === null) {
        return $default;
    }
    return trim((string)$v);
}

function availity_is_enabled(): bool
{
    $v = strtolower(availity_env('AVAILITY_ENABLED', 'false'));
    return in_array($v, ['1', 'true', 'yes', 'on'], true);
}

/** @return array<string, mixed> */
function availity_get_config(): array
{
    $env = strtolower(availity_env('AVAILITY_ENV', 'test'));
    $isTest = $env !== 'production' && $env !== 'prod';

    // Availity retired ftp.availity.com / qa-ftp.availity.com (NXDOMAIN as of 2024+).
    // Current MFT hosts: qa-files.availity.com (test), files.availity.com (production), port 22.
    $defaultHost = $isTest ? 'qa-files.availity.com' : 'files.availity.com';
    $usageIndicator = strtoupper(availity_env('AVAILITY_USAGE_INDICATOR', $isTest ? 'T' : 'P'));
    if (!in_array($usageIndicator, ['T', 'P'], true)) {
        $usageIndicator = $isTest ? 'T' : 'P';
    }

    return [
        'enabled' => availity_is_enabled(),
        'environment' => $isTest ? 'test' : 'production',
        'sftp_host' => availity_env('AVAILITY_SFTP_HOST', $defaultHost),
        'sftp_port' => (int)availity_env('AVAILITY_SFTP_PORT', '22'),
        'sftp_user' => availity_env('AVAILITY_SFTP_USER'),
        'sftp_password' => availity_env('AVAILITY_SFTP_PASSWORD'),
        'sftp_remote_dir' => availity_env('AVAILITY_SFTP_REMOTE_DIR', 'Send'),
        'isa_sender_id' => availity_env('AVAILITY_ISA_SENDER_ID'),
        'isa_password' => availity_env('AVAILITY_ISA_PASSWORD'),
        'gs_sender_code' => availity_env('AVAILITY_GS_SENDER_CODE'),
        'submitter_name' => availity_env('AVAILITY_SUBMITTER_NAME', 'MAHA BEHAVIORAL HEALTH'),
        'receiver_id' => availity_env('AVAILITY_RECEIVER_ID', '030240928'),
        'usage_indicator' => $usageIndicator,
        'file_prefix' => availity_env('AVAILITY_FILE_PREFIX', '837P'),
    ];
}

function availity_assert_config_ready(array $config): void
{
    if (!$config['enabled']) {
        throw new RuntimeException('Availity integration is disabled. Set AVAILITY_ENABLED=true in backend-test/.env', 503);
    }

    $missing = [];
    foreach (['sftp_user', 'sftp_password', 'isa_sender_id', 'isa_password', 'gs_sender_code'] as $key) {
        if (empty($config[$key])) {
            $missing[] = $key;
        }
    }
    if ($missing !== []) {
        throw new RuntimeException(
            'Availity is not fully configured. Missing: ' . implode(', ', $missing),
            503
        );
    }
}

function availity_public_config(array $config): array
{
    return [
        'enabled' => (bool)$config['enabled'],
        'environment' => $config['environment'],
        'sftp_host' => $config['sftp_host'],
        'sftp_port' => (int)$config['sftp_port'],
        'sftp_remote_dir' => $config['sftp_remote_dir'],
        'usage_indicator' => $config['usage_indicator'],
        'configured' => $config['enabled']
            && $config['sftp_user'] !== ''
            && $config['sftp_password'] !== ''
            && $config['isa_sender_id'] !== ''
            && $config['isa_password'] !== ''
            && $config['gs_sender_code'] !== '',
    ];
}

<?php
/**
 * Office Ally SFTP / EDI configuration.
 * Primary source: Manage Data → Clearing House (clearing_house_settings).
 * Legacy fallback: OFFICEALLY_* environment variables when no DB row exists.
 */

function officeally_env(string $key, string $default = ''): string
{
    $v = getenv($key);
    if ($v === false || $v === null) {
        return $default;
    }
    return trim((string)$v);
}

function officeally_is_enabled(): bool
{
    $v = strtolower(officeally_env('OFFICEALLY_ENABLED', 'false'));
    return in_array($v, ['1', 'true', 'yes', 'on'], true);
}

/** @return array<string, mixed> */
function officeally_env_config(): array
{
    $env = strtolower(officeally_env('OFFICEALLY_ENV', 'test'));
    $isTest = $env !== 'production' && $env !== 'prod';
    $isaSender = officeally_env('OFFICEALLY_ISA_SENDER_ID');

    return [
        'enabled' => officeally_is_enabled(),
        'environment' => $isTest ? 'test' : 'production',
        'sftp_host' => officeally_env('OFFICEALLY_SFTP_HOST', 'ftp10.officeally.com'),
        'sftp_port' => (int)officeally_env('OFFICEALLY_SFTP_PORT', '22'),
        'sftp_user' => officeally_env('OFFICEALLY_SFTP_USER'),
        'sftp_password' => officeally_env('OFFICEALLY_SFTP_PASSWORD'),
        'sftp_remote_dir' => officeally_env('OFFICEALLY_SFTP_REMOTE_DIR', 'inbound'),
        'sftp_reports_dir' => officeally_env('OFFICEALLY_SFTP_REPORTS_DIR', 'outbound'),
        'isa_sender_id' => $isaSender,
        'isa_sender_qualifier' => officeally_env('OFFICEALLY_ISA_SENDER_QUALIFIER', 'ZZ'),
        'isa_receiver_qualifier' => officeally_env('OFFICEALLY_ISA_RECEIVER_QUALIFIER', 'ZZ'),
        'gs_sender_code' => officeally_env('OFFICEALLY_GS_SENDER_CODE') ?: $isaSender,
        'gs_receiver_code' => officeally_env('OFFICEALLY_GS_RECEIVER_CODE', 'OA'),
        'submitter_name' => officeally_env('OFFICEALLY_SUBMITTER_NAME', 'MAHA BEHAVIORAL HEALTH'),
        'receiver_id' => officeally_env('OFFICEALLY_RECEIVER_ID', '330897513'),
        'receiver_name' => officeally_env('OFFICEALLY_RECEIVER_NAME', 'OFFICE ALLY'),
        'file_prefix' => officeally_env('OFFICEALLY_FILE_PREFIX', '837P'),
    ];
}

/** @param array<string, mixed> $config */
function officeally_env_has_values(array $config): bool
{
    return trim((string)($config['sftp_user'] ?? '')) !== ''
        || trim((string)($config['sftp_password'] ?? '')) !== ''
        || trim((string)($config['isa_sender_id'] ?? '')) !== ''
        || !empty($config['enabled']);
}

/** @return array<string, mixed> */
function officeally_get_config(?mysqli $conn = null): array
{
    if ($conn instanceof mysqli) {
        if (!function_exists('clearing_house_officeally_config')) {
            require_once __DIR__ . '/clearing_house_settings_lib.php';
        }
        return clearing_house_officeally_config($conn);
    }

    return officeally_env_config();
}

function officeally_assert_config_ready(array $config): void
{
    if (!$config['enabled']) {
        throw new RuntimeException(
            'Office Ally integration is disabled. Enable it under Manage Data → Clearing House.',
            503
        );
    }

    $missing = [];
    foreach (['sftp_host', 'sftp_user', 'sftp_password', 'isa_sender_id'] as $key) {
        if (empty($config[$key])) {
            $missing[] = $key;
        }
    }
    if ($missing !== []) {
        throw new RuntimeException(
            'Office Ally is not fully configured in Clearing House. Missing: ' . implode(', ', $missing),
            503
        );
    }
}

function officeally_public_config(array $config): array
{
    $gsSender = (string)$config['gs_sender_code'] !== ''
        ? (string)$config['gs_sender_code']
        : (string)$config['isa_sender_id'];

    return [
        'enabled' => (bool)$config['enabled'],
        'environment' => $config['environment'],
        'sftp_host' => $config['sftp_host'],
        'sftp_port' => (int)$config['sftp_port'],
        'sftp_remote_dir' => $config['sftp_remote_dir'],
        'sftp_reports_dir' => $config['sftp_reports_dir'],
        'isa_sender_id' => (string)($config['isa_sender_id'] ?? ''),
        'configured' => $config['enabled']
            && $config['sftp_user'] !== ''
            && $config['sftp_password'] !== ''
            && $config['isa_sender_id'] !== ''
            && $gsSender !== '',
    ];
}

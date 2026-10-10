<?php
/**
 * Office Ally SFTP / EDI configuration.
 * Environment variables supply defaults; values saved in Master Data → Clearing House
 * (clearing_house_settings) override them when non-empty.
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

/** Columns admins may edit from the Clearing House screen (password handled separately). */
function officeally_settings_fields(): array
{
    return [
        'sftp_host', 'sftp_port', 'sftp_user', 'sftp_remote_dir', 'sftp_reports_dir',
        'isa_sender_id', 'isa_sender_qualifier', 'isa_receiver_qualifier',
        'gs_sender_code', 'gs_receiver_code', 'submitter_name', 'receiver_id',
        'receiver_name', 'file_prefix',
    ];
}

function officeally_settings_ensure_table(mysqli $conn): void
{
    $conn->query("
        CREATE TABLE IF NOT EXISTS clearing_house_settings (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            clearing_house VARCHAR(40) NOT NULL DEFAULT 'officeally',
            enabled TINYINT(1) NULL,
            environment VARCHAR(20) NULL,
            sftp_host VARCHAR(255) NULL,
            sftp_port INT NULL,
            sftp_user VARCHAR(255) NULL,
            sftp_password_enc TEXT NULL,
            sftp_remote_dir VARCHAR(255) NULL,
            sftp_reports_dir VARCHAR(255) NULL,
            isa_sender_id VARCHAR(40) NULL,
            isa_sender_qualifier VARCHAR(4) NULL,
            isa_receiver_qualifier VARCHAR(4) NULL,
            gs_sender_code VARCHAR(40) NULL,
            gs_receiver_code VARCHAR(40) NULL,
            submitter_name VARCHAR(120) NULL,
            receiver_id VARCHAR(40) NULL,
            receiver_name VARCHAR(120) NULL,
            file_prefix VARCHAR(20) NULL,
            updated_by VARCHAR(255) NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

/** @return array<string, mixed>|null */
function officeally_settings_load(mysqli $conn): ?array
{
    officeally_settings_ensure_table($conn);
    $res = $conn->query('SELECT * FROM clearing_house_settings WHERE id = 1 LIMIT 1');
    if (!$res) {
        return null;
    }
    $row = $res->fetch_assoc();
    $res->free();
    return $row ?: null;
}

/** 32-byte AES key: OFFICEALLY_CONFIG_ENCRYPTION_KEY, else the existing SSN / Drive keys. */
function officeally_crypto_key(): ?string
{
    foreach (['OFFICEALLY_CONFIG_ENCRYPTION_KEY', 'SSN_ENCRYPTION_KEY', 'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY'] as $name) {
        $b64 = officeally_env($name);
        if ($b64 === '') {
            continue;
        }
        $norm = strtr($b64, '-_', '+/');
        $rem = strlen($norm) % 4;
        if ($rem) {
            $norm .= str_repeat('=', 4 - $rem);
        }
        $raw = base64_decode($norm, true);
        if ($raw !== false && strlen($raw) === 32) {
            return $raw;
        }
    }
    return null;
}

function officeally_encrypt_secret(string $plaintext): ?string
{
    $key = officeally_crypto_key();
    if (!$key || !function_exists('openssl_encrypt')) {
        return null;
    }
    $iv = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    if ($ciphertext === false || $tag === '') {
        return null;
    }
    return base64_encode($iv . $tag . $ciphertext);
}

function officeally_decrypt_secret(string $payloadB64): ?string
{
    $key = officeally_crypto_key();
    if (!$key || !function_exists('openssl_decrypt')) {
        return null;
    }
    $raw = base64_decode($payloadB64, true);
    if ($raw === false || strlen($raw) < 29) {
        return null;
    }
    $plaintext = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
    return $plaintext === false ? null : $plaintext;
}

/** @return array<string, mixed> */
function officeally_get_config(?mysqli $conn = null): array
{
    $config = officeally_env_config();
    $config['password_source'] = $config['sftp_password'] !== '' ? 'env' : 'none';

    if ($conn === null && function_exists('getDBConnection')) {
        try {
            $conn = getDBConnection();
        } catch (Throwable $e) {
            $conn = null;
        }
    }
    $row = $conn ? officeally_settings_load($conn) : null;
    if (!$row) {
        return $config;
    }

    if ($row['enabled'] !== null) {
        $config['enabled'] = (int)$row['enabled'] === 1;
    }
    $dbEnv = strtolower(trim((string)($row['environment'] ?? '')));
    if ($dbEnv !== '') {
        $config['environment'] = ($dbEnv === 'production' || $dbEnv === 'prod') ? 'production' : 'test';
    }
    foreach (officeally_settings_fields() as $field) {
        $v = trim((string)($row[$field] ?? ''));
        if ($v !== '') {
            $config[$field] = $field === 'sftp_port' ? (int)$v : $v;
        }
    }
    $enc = trim((string)($row['sftp_password_enc'] ?? ''));
    if ($enc !== '') {
        $plain = officeally_decrypt_secret($enc);
        if ($plain !== null && $plain !== '') {
            $config['sftp_password'] = $plain;
            $config['password_source'] = 'db';
        }
    }
    return $config;
}

/** @return array<string, mixed> */
function officeally_env_config(): array
{
    $env = strtolower(officeally_env('OFFICEALLY_ENV', 'test'));
    $isTest = $env !== 'production' && $env !== 'prod';

    return [
        'enabled' => officeally_is_enabled(),
        'environment' => $isTest ? 'test' : 'production',
        'sftp_host' => officeally_env('OFFICEALLY_SFTP_HOST', 'ftp10.officeally.com'),
        'sftp_port' => (int)officeally_env('OFFICEALLY_SFTP_PORT', '22'),
        'sftp_user' => officeally_env('OFFICEALLY_SFTP_USER'),
        'sftp_password' => officeally_env('OFFICEALLY_SFTP_PASSWORD'),
        'sftp_remote_dir' => officeally_env('OFFICEALLY_SFTP_REMOTE_DIR', 'inbound'),
        'sftp_reports_dir' => officeally_env('OFFICEALLY_SFTP_REPORTS_DIR', 'outbound'),
        'isa_sender_id' => officeally_env('OFFICEALLY_ISA_SENDER_ID'),
        'isa_sender_qualifier' => officeally_env('OFFICEALLY_ISA_SENDER_QUALIFIER', 'ZZ'),
        'isa_receiver_qualifier' => officeally_env('OFFICEALLY_ISA_RECEIVER_QUALIFIER', 'ZZ'),
        'gs_sender_code' => officeally_env('OFFICEALLY_GS_SENDER_CODE') ?: officeally_env('OFFICEALLY_ISA_SENDER_ID'),
        'gs_receiver_code' => officeally_env('OFFICEALLY_GS_RECEIVER_CODE', 'OA'),
        'submitter_name' => officeally_env('OFFICEALLY_SUBMITTER_NAME', 'MAHA BEHAVIORAL HEALTH'),
        'receiver_id' => officeally_env('OFFICEALLY_RECEIVER_ID', '330897513'),
        'receiver_name' => officeally_env('OFFICEALLY_RECEIVER_NAME', 'OFFICE ALLY'),
        'file_prefix' => officeally_env('OFFICEALLY_FILE_PREFIX', '837P'),
    ];
}

function officeally_assert_config_ready(array $config): void
{
    if (!$config['enabled']) {
        throw new RuntimeException(
            'Office Ally integration is disabled. Enable it in Master Data → Clearing House (or OFFICEALLY_ENABLED=true in .env)',
            503
        );
    }

    $missing = [];
    foreach (['sftp_user', 'sftp_password', 'isa_sender_id'] as $key) {
        if (empty($config[$key])) {
            $missing[] = $key;
        }
    }
    if ($missing !== []) {
        throw new RuntimeException(
            'Office Ally is not fully configured. Missing: ' . implode(', ', $missing),
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
        'configured' => $config['enabled']
            && $config['sftp_user'] !== ''
            && $config['sftp_password'] !== ''
            && $config['isa_sender_id'] !== ''
            && $gsSender !== '',
    ];
}

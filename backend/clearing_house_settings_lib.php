<?php
/**
 * Clearing House settings — primary Office Ally SFTP + EDI config (Manage Data).
 */

function clearing_house_table_exists(mysqli $conn): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $r = @$conn->query("SHOW TABLES LIKE 'clearing_house_settings'");
    $cached = ($r && $r->num_rows > 0);
    if ($r) {
        $r->free();
    }
    return $cached;
}

function clearing_house_ensure_edi_columns(mysqli $conn): void
{
    if (!clearing_house_table_exists($conn)) {
        return;
    }
    $columns = [
        'environment' => "ADD COLUMN environment VARCHAR(16) NOT NULL DEFAULT 'test' AFTER provider_key",
        'isa_sender_id' => 'ADD COLUMN isa_sender_id VARCHAR(32) NULL DEFAULT NULL AFTER sftp_reports_dir',
        'isa_sender_qualifier' => "ADD COLUMN isa_sender_qualifier VARCHAR(4) NOT NULL DEFAULT 'ZZ' AFTER isa_sender_id",
        'isa_receiver_qualifier' => "ADD COLUMN isa_receiver_qualifier VARCHAR(4) NOT NULL DEFAULT 'ZZ' AFTER isa_sender_qualifier",
        'gs_sender_code' => 'ADD COLUMN gs_sender_code VARCHAR(32) NULL DEFAULT NULL AFTER isa_receiver_qualifier',
        'gs_receiver_code' => "ADD COLUMN gs_receiver_code VARCHAR(16) NOT NULL DEFAULT 'OA' AFTER gs_sender_code",
        'submitter_name' => 'ADD COLUMN submitter_name VARCHAR(128) NULL DEFAULT NULL AFTER gs_receiver_code',
        'receiver_id' => 'ADD COLUMN receiver_id VARCHAR(32) NULL DEFAULT NULL AFTER submitter_name',
        'receiver_name' => "ADD COLUMN receiver_name VARCHAR(64) NULL DEFAULT 'OFFICE ALLY' AFTER receiver_id",
        'file_prefix' => "ADD COLUMN file_prefix VARCHAR(16) NOT NULL DEFAULT '837P' AFTER receiver_name",
    ];
    foreach ($columns as $name => $ddl) {
        $r = @$conn->query("SHOW COLUMNS FROM clearing_house_settings LIKE '{$name}'");
        $exists = ($r && $r->num_rows > 0);
        if ($r) {
            $r->free();
        }
        if (!$exists) {
            @$conn->query("ALTER TABLE clearing_house_settings {$ddl}");
        }
    }
}

function clearing_house_ensure_table(mysqli $conn): void
{
    if (clearing_house_table_exists($conn)) {
        clearing_house_ensure_edi_columns($conn);
        return;
    }
    $sql = "CREATE TABLE IF NOT EXISTS clearing_house_settings (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
        provider_key VARCHAR(32) NOT NULL DEFAULT 'office_ally',
        environment VARCHAR(16) NOT NULL DEFAULT 'test',
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        sftp_host VARCHAR(255) NULL DEFAULT NULL,
        sftp_port INT NOT NULL DEFAULT 22,
        sftp_user VARCHAR(128) NULL DEFAULT NULL,
        sftp_password VARCHAR(255) NULL DEFAULT NULL,
        sftp_remote_dir VARCHAR(128) NULL DEFAULT 'inbound',
        sftp_reports_dir VARCHAR(128) NULL DEFAULT 'outbound',
        isa_sender_id VARCHAR(32) NULL DEFAULT NULL,
        isa_sender_qualifier VARCHAR(4) NOT NULL DEFAULT 'ZZ',
        isa_receiver_qualifier VARCHAR(4) NOT NULL DEFAULT 'ZZ',
        gs_sender_code VARCHAR(32) NULL DEFAULT NULL,
        gs_receiver_code VARCHAR(16) NOT NULL DEFAULT 'OA',
        submitter_name VARCHAR(128) NULL DEFAULT NULL,
        receiver_id VARCHAR(32) NULL DEFAULT NULL,
        receiver_name VARCHAR(64) NULL DEFAULT 'OFFICE ALLY',
        file_prefix VARCHAR(16) NOT NULL DEFAULT '837P',
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updated_by VARCHAR(128) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";
    @$conn->query($sql);
}

/** @return array<string, mixed>|null */
function clearing_house_load_row(mysqli $conn): ?array
{
    clearing_house_ensure_table($conn);
    if (!clearing_house_table_exists($conn)) {
        return null;
    }
    $res = $conn->query('SELECT * FROM clearing_house_settings WHERE id = 1 LIMIT 1');
    if (!$res) {
        return null;
    }
    $row = $res->fetch_assoc();
    $res->free();
    return is_array($row) ? $row : null;
}

function clearing_house_mask_password(?string $password): string
{
    $password = trim((string)$password);
    if ($password === '') {
        return '';
    }
    if (strlen($password) <= 4) {
        return '****';
    }
    return str_repeat('*', max(4, strlen($password) - 4)) . substr($password, -4);
}

function clearing_house_normalize_environment(?string $value): string
{
    $v = strtolower(trim((string)$value));
    return ($v === 'production' || $v === 'prod') ? 'production' : 'test';
}

/** Test vs production follows server OFFICEALLY_ENV (each deployment sets its own .env). */
function clearing_house_resolve_environment(): string
{
    if (!function_exists('officeally_env')) {
        require_once __DIR__ . '/officeally_config_helper.php';
    }
    return clearing_house_normalize_environment(officeally_env('OFFICEALLY_ENV', 'test'));
}

/** @return array<string, mixed> */
function clearing_house_public_settings(?array $row): array
{
    if (!$row) {
        return [
            'provider_key' => 'office_ally',
            'environment' => clearing_house_resolve_environment(),
            'enabled' => false,
            'sftp_host' => '',
            'sftp_port' => 22,
            'sftp_user' => '',
            'sftp_password_set' => false,
            'sftp_remote_dir' => 'inbound',
            'sftp_reports_dir' => 'outbound',
            'isa_sender_id' => '',
            'isa_sender_qualifier' => 'ZZ',
            'isa_receiver_qualifier' => 'ZZ',
            'gs_sender_code' => '',
            'gs_receiver_code' => 'OA',
            'submitter_name' => '',
            'receiver_id' => '',
            'receiver_name' => 'OFFICE ALLY',
            'file_prefix' => '837P',
            'updated_at' => null,
            'updated_by' => null,
        ];
    }

    $password = trim((string)($row['sftp_password'] ?? ''));

    return [
        'provider_key' => (string)($row['provider_key'] ?? 'office_ally'),
        'environment' => clearing_house_resolve_environment(),
        'enabled' => !empty($row['enabled']),
        'sftp_host' => (string)($row['sftp_host'] ?? ''),
        'sftp_port' => (int)($row['sftp_port'] ?? 22),
        'sftp_user' => (string)($row['sftp_user'] ?? ''),
        'sftp_password_set' => $password !== '',
        'sftp_password_masked' => clearing_house_mask_password($password),
        'sftp_remote_dir' => (string)($row['sftp_remote_dir'] ?? 'inbound'),
        'sftp_reports_dir' => (string)($row['sftp_reports_dir'] ?? 'outbound'),
        'isa_sender_id' => (string)($row['isa_sender_id'] ?? ''),
        'isa_sender_qualifier' => (string)($row['isa_sender_qualifier'] ?? 'ZZ'),
        'isa_receiver_qualifier' => (string)($row['isa_receiver_qualifier'] ?? 'ZZ'),
        'gs_sender_code' => (string)($row['gs_sender_code'] ?? ''),
        'gs_receiver_code' => (string)($row['gs_receiver_code'] ?? 'OA'),
        'submitter_name' => (string)($row['submitter_name'] ?? ''),
        'receiver_id' => (string)($row['receiver_id'] ?? ''),
        'receiver_name' => (string)($row['receiver_name'] ?? 'OFFICE ALLY'),
        'file_prefix' => (string)($row['file_prefix'] ?? '837P'),
        'updated_at' => $row['updated_at'] ?? null,
        'updated_by' => $row['updated_by'] ?? null,
    ];
}

/** @return array<string, mixed> */
function clearing_house_row_to_officeally_config(array $row): array
{
    $env = clearing_house_resolve_environment();
    $isaSender = trim((string)($row['isa_sender_id'] ?? ''));
    $gsSender = trim((string)($row['gs_sender_code'] ?? ''));

    return [
        'enabled' => !empty($row['enabled']),
        'environment' => $env,
        'sftp_host' => trim((string)($row['sftp_host'] ?? '')),
        'sftp_port' => max(1, (int)($row['sftp_port'] ?? 22)),
        'sftp_user' => trim((string)($row['sftp_user'] ?? '')),
        'sftp_password' => (string)($row['sftp_password'] ?? ''),
        'sftp_remote_dir' => trim((string)($row['sftp_remote_dir'] ?? '')) ?: 'inbound',
        'sftp_reports_dir' => trim((string)($row['sftp_reports_dir'] ?? '')) ?: 'outbound',
        'isa_sender_id' => $isaSender,
        'isa_sender_qualifier' => trim((string)($row['isa_sender_qualifier'] ?? 'ZZ')) ?: 'ZZ',
        'isa_receiver_qualifier' => trim((string)($row['isa_receiver_qualifier'] ?? 'ZZ')) ?: 'ZZ',
        'gs_sender_code' => $gsSender !== '' ? $gsSender : $isaSender,
        'gs_receiver_code' => trim((string)($row['gs_receiver_code'] ?? 'OA')) ?: 'OA',
        'submitter_name' => trim((string)($row['submitter_name'] ?? '')),
        'receiver_id' => trim((string)($row['receiver_id'] ?? '')),
        'receiver_name' => trim((string)($row['receiver_name'] ?? '')) ?: 'OFFICE ALLY',
        'file_prefix' => trim((string)($row['file_prefix'] ?? '')) ?: '837P',
    ];
}

/**
 * Primary Office Ally config: clearing_house_settings row (imports legacy env once if empty).
 *
 * @return array<string, mixed>
 */
function clearing_house_officeally_config(mysqli $conn): array
{
    if (!function_exists('officeally_env_config')) {
        require_once __DIR__ . '/officeally_config_helper.php';
    }

    clearing_house_ensure_table($conn);
    $row = clearing_house_load_row($conn);
    if (!$row) {
        $envConfig = officeally_env_config();
        if (officeally_env_has_values($envConfig)) {
            clearing_house_import_env_config($conn, $envConfig);
            $row = clearing_house_load_row($conn);
        }
    }

    if ($row) {
        return clearing_house_row_to_officeally_config($row);
    }

    return officeally_env_config();
}

/** @deprecated Use clearing_house_officeally_config */
function clearing_house_merge_officeally_config(mysqli $conn, array $config): array
{
    unset($config);
    return clearing_house_officeally_config($conn);
}

/**
 * @param array<string, mixed> $input
 * @return array<string, mixed>
 */
function clearing_house_save_settings(mysqli $conn, array $input, string $updatedBy = ''): array
{
    clearing_house_ensure_table($conn);
    if (!clearing_house_table_exists($conn)) {
        throw new RuntimeException('clearing_house_settings table is unavailable');
    }

    $existing = clearing_house_load_row($conn);
    $enabled = array_key_exists('enabled', $input)
        ? (!empty($input['enabled']) ? 1 : 0)
        : (int)!empty($existing['enabled'] ?? 0);

    $environment = clearing_house_resolve_environment();

    $host = array_key_exists('sftp_host', $input)
        ? trim((string)$input['sftp_host'])
        : trim((string)($existing['sftp_host'] ?? ''));
    $port = array_key_exists('sftp_port', $input)
        ? (int)$input['sftp_port']
        : (int)($existing['sftp_port'] ?? 22);
    if ($port <= 0 || $port > 65535) {
        throw new InvalidArgumentException('SFTP port must be between 1 and 65535');
    }
    $user = array_key_exists('sftp_user', $input)
        ? trim((string)$input['sftp_user'])
        : trim((string)($existing['sftp_user'] ?? ''));
    $remoteDir = array_key_exists('sftp_remote_dir', $input)
        ? trim((string)$input['sftp_remote_dir'])
        : trim((string)($existing['sftp_remote_dir'] ?? 'inbound'));
    $reportsDir = array_key_exists('sftp_reports_dir', $input)
        ? trim((string)$input['sftp_reports_dir'])
        : trim((string)($existing['sftp_reports_dir'] ?? 'outbound'));

    $password = trim((string)($existing['sftp_password'] ?? ''));
    if (array_key_exists('sftp_password', $input)) {
        $incoming = trim((string)$input['sftp_password']);
        if ($incoming !== '') {
            $password = $incoming;
        }
    }

    $isaSender = array_key_exists('isa_sender_id', $input)
        ? trim((string)$input['isa_sender_id'])
        : trim((string)($existing['isa_sender_id'] ?? ''));
    $isaSenderQual = array_key_exists('isa_sender_qualifier', $input)
        ? trim((string)$input['isa_sender_qualifier'])
        : trim((string)($existing['isa_sender_qualifier'] ?? 'ZZ'));
    $isaReceiverQual = array_key_exists('isa_receiver_qualifier', $input)
        ? trim((string)$input['isa_receiver_qualifier'])
        : trim((string)($existing['isa_receiver_qualifier'] ?? 'ZZ'));
    $gsSender = array_key_exists('gs_sender_code', $input)
        ? trim((string)$input['gs_sender_code'])
        : trim((string)($existing['gs_sender_code'] ?? ''));
    $gsReceiver = array_key_exists('gs_receiver_code', $input)
        ? trim((string)$input['gs_receiver_code'])
        : trim((string)($existing['gs_receiver_code'] ?? 'OA'));
    $submitterName = array_key_exists('submitter_name', $input)
        ? trim((string)$input['submitter_name'])
        : trim((string)($existing['submitter_name'] ?? ''));
    $receiverId = array_key_exists('receiver_id', $input)
        ? trim((string)$input['receiver_id'])
        : trim((string)($existing['receiver_id'] ?? ''));
    $receiverName = array_key_exists('receiver_name', $input)
        ? trim((string)$input['receiver_name'])
        : trim((string)($existing['receiver_name'] ?? 'OFFICE ALLY'));
    $filePrefix = array_key_exists('file_prefix', $input)
        ? trim((string)$input['file_prefix'])
        : trim((string)($existing['file_prefix'] ?? '837P'));

    $providerKey = trim((string)($input['provider_key'] ?? $existing['provider_key'] ?? 'office_ally'));
    if ($providerKey === '') {
        $providerKey = 'office_ally';
    }

    $stmt = $conn->prepare(
        'INSERT INTO clearing_house_settings (
            id, provider_key, environment, enabled, sftp_host, sftp_port, sftp_user, sftp_password,
            sftp_remote_dir, sftp_reports_dir,
            isa_sender_id, isa_sender_qualifier, isa_receiver_qualifier,
            gs_sender_code, gs_receiver_code, submitter_name, receiver_id, receiver_name, file_prefix,
            updated_by
         ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            provider_key = VALUES(provider_key),
            environment = VALUES(environment),
            enabled = VALUES(enabled),
            sftp_host = VALUES(sftp_host),
            sftp_port = VALUES(sftp_port),
            sftp_user = VALUES(sftp_user),
            sftp_password = VALUES(sftp_password),
            sftp_remote_dir = VALUES(sftp_remote_dir),
            sftp_reports_dir = VALUES(sftp_reports_dir),
            isa_sender_id = VALUES(isa_sender_id),
            isa_sender_qualifier = VALUES(isa_sender_qualifier),
            isa_receiver_qualifier = VALUES(isa_receiver_qualifier),
            gs_sender_code = VALUES(gs_sender_code),
            gs_receiver_code = VALUES(gs_receiver_code),
            submitter_name = VALUES(submitter_name),
            receiver_id = VALUES(receiver_id),
            receiver_name = VALUES(receiver_name),
            file_prefix = VALUES(file_prefix),
            updated_by = VALUES(updated_by)'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare clearing house save: ' . $conn->error);
    }
    $stmt->bind_param(
        'ssisissssssssssssss',
        $providerKey,
        $environment,
        $enabled,
        $host,
        $port,
        $user,
        $password,
        $remoteDir,
        $reportsDir,
        $isaSender,
        $isaSenderQual,
        $isaReceiverQual,
        $gsSender,
        $gsReceiver,
        $submitterName,
        $receiverId,
        $receiverName,
        $filePrefix,
        $updatedBy
    );
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        throw new RuntimeException('Failed to save clearing house settings: ' . $err);
    }
    $stmt->close();

    return clearing_house_public_settings(clearing_house_load_row($conn));
}

/** @param array<string, mixed> $config */
function clearing_house_import_env_config(mysqli $conn, array $config, string $updatedBy = 'env-import'): void
{
    clearing_house_save_settings($conn, [
        'enabled' => !empty($config['enabled']),
        'environment' => clearing_house_resolve_environment(),
        'sftp_host' => $config['sftp_host'] ?? '',
        'sftp_port' => $config['sftp_port'] ?? 22,
        'sftp_user' => $config['sftp_user'] ?? '',
        'sftp_password' => $config['sftp_password'] ?? '',
        'sftp_remote_dir' => $config['sftp_remote_dir'] ?? 'inbound',
        'sftp_reports_dir' => $config['sftp_reports_dir'] ?? 'outbound',
        'isa_sender_id' => $config['isa_sender_id'] ?? '',
        'isa_sender_qualifier' => $config['isa_sender_qualifier'] ?? 'ZZ',
        'isa_receiver_qualifier' => $config['isa_receiver_qualifier'] ?? 'ZZ',
        'gs_sender_code' => $config['gs_sender_code'] ?? '',
        'gs_receiver_code' => $config['gs_receiver_code'] ?? 'OA',
        'submitter_name' => $config['submitter_name'] ?? '',
        'receiver_id' => $config['receiver_id'] ?? '',
        'receiver_name' => $config['receiver_name'] ?? 'OFFICE ALLY',
        'file_prefix' => $config['file_prefix'] ?? '837P',
    ], $updatedBy);
}

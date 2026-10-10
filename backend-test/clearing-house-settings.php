<?php
/**
 * Master Data → Clearing House (Office Ally SFTP / EDI settings).
 * GET: current effective settings (password never returned).
 * PUT: save overrides; blank password keeps the stored one, clear_password=true removes it.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
require_once __DIR__ . '/officeally_config_helper.php';

$authUser = requireAuthReadWrite('master_data.read', 'master_data.write', 'mahaverse');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function clearing_house_fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message]);
    exit();
}

function clearing_house_response(mysqli $conn): array
{
    $config = officeally_get_config($conn);
    $row = officeally_settings_load($conn);
    $data = [
        'enabled' => (bool)$config['enabled'],
        'environment' => $config['environment'],
        'has_password' => $config['sftp_password'] !== '',
        'password_source' => $config['password_source'],
        'encryption_available' => officeally_crypto_key() !== null,
        'updated_by' => $row['updated_by'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
        'configured' => officeally_public_config($config)['configured'],
    ];
    foreach (officeally_settings_fields() as $field) {
        $data[$field] = $config[$field];
    }
    return $data;
}

try {
    $conn = getDBConnection();
    $conn->set_charset('utf8mb4');
} catch (Throwable $e) {
    clearing_house_fail(500, 'Database connection failed');
}

if ($method === 'GET') {
    echo json_encode(['success' => true, 'data' => clearing_house_response($conn)]);
    exit();
}

if ($method !== 'PUT') {
    clearing_house_fail(405, 'Method not allowed');
}

// SFTP credentials: Master Data write alone is not enough.
rbac_require_permission_user($authUser, 'billing.sftp', 'mahaverse');

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    clearing_house_fail(400, 'Invalid JSON body');
}

$values = [];
foreach (officeally_settings_fields() as $field) {
    if (!array_key_exists($field, $input)) {
        continue;
    }
    $v = trim((string)$input[$field]);
    if ($field === 'sftp_port' && $v !== '') {
        $port = (int)$v;
        if ($port < 1 || $port > 65535) {
            clearing_house_fail(400, 'SFTP port must be between 1 and 65535');
        }
        $v = (string)$port;
    }
    $values[$field] = $v === '' ? null : $v;
}
if (array_key_exists('enabled', $input)) {
    $values['enabled'] = !empty($input['enabled']) ? 1 : 0;
}
if (array_key_exists('environment', $input)) {
    $envIn = strtolower(trim((string)$input['environment']));
    if (!in_array($envIn, ['test', 'production'], true)) {
        clearing_house_fail(400, 'Environment must be test or production');
    }
    $values['environment'] = $envIn;
}

$newPassword = (string)($input['sftp_password'] ?? '');
if (!empty($input['clear_password'])) {
    $values['sftp_password_enc'] = null;
} elseif ($newPassword !== '') {
    $enc = officeally_encrypt_secret($newPassword);
    if ($enc === null) {
        clearing_house_fail(
            503,
            'Cannot store the SFTP password: set OFFICEALLY_CONFIG_ENCRYPTION_KEY (base64, 32 bytes) in the backend .env'
        );
    }
    $values['sftp_password_enc'] = $enc;
}

$values['updated_by'] = (string)($authUser['email'] ?? $authUser['username'] ?? $authUser['id'] ?? '');

officeally_settings_ensure_table($conn);
$conn->query("INSERT IGNORE INTO clearing_house_settings (id, clearing_house) VALUES (1, 'officeally')");

$sets = [];
$types = '';
$params = [];
foreach ($values as $col => $val) {
    $sets[] = "`{$col}` = ?";
    $types .= 's';
    $params[] = $val;
}
$stmt = $conn->prepare('UPDATE clearing_house_settings SET ' . implode(', ', $sets) . ' WHERE id = 1');
if (!$stmt) {
    clearing_house_fail(500, 'Failed to prepare update');
}
$stmt->bind_param($types, ...$params);
if (!$stmt->execute()) {
    clearing_house_fail(500, 'Failed to save clearing house settings');
}
$stmt->close();

echo json_encode(['success' => true, 'data' => clearing_house_response($conn)]);

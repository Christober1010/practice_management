<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
require_once __DIR__ . '/availity_config_helper.php';
require_once __DIR__ . '/availity_sftp_helper.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$authUser = requireAuth('billing.read', 'mahaverse');

function availity_test_fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message]);
    exit();
}

try {
    $config = availity_get_config();
    $result = [
        'success' => true,
        'config' => availity_public_config($config),
    ];

    if (!empty($_GET['connect']) && $_GET['connect'] === '1') {
        if (!$config['enabled']) {
            availity_test_fail(503, 'Availity integration is disabled');
        }
        availity_assert_config_ready($config);
        $result['connection'] = availity_sftp_test_connection($config);
    }

    echo json_encode($result);
} catch (RuntimeException $e) {
    $code = $e->getCode();
    availity_test_fail(($code >= 400 && $code < 600) ? $code : 502, $e->getMessage());
} catch (Exception $e) {
    availity_test_fail(500, $e->getMessage());
}

<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
require_once __DIR__ . '/claims_billing_lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$authUser = requireAuth('billing.read', 'mahaverse');

function cms1500_fail($status, $message)
{
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message]);
    exit();
}

$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!is_array($input)) {
    cms1500_fail(400, 'Invalid JSON payload');
}

$sessionIds = cms1500_numeric_id_array($input['session_ids'] ?? []);
if (count($sessionIds) !== 1) {
    cms1500_fail(400, 'Send exactly one session_id per CMS-1500 form (client is resolved from the session).');
}

try {
    $conn = getDBConnection();
    $built = cms1500_build_claim_payload($conn, $input, [
        'require_ready_to_bill' => true,
        'max_sessions' => 1,
    ]);

    echo json_encode([
        'success' => true,
        'payload' => $built['payload'],
        'warnings' => $built['warnings'],
        'sources' => $built['sources'],
    ]);
} catch (InvalidArgumentException $e) {
    cms1500_fail(400, $e->getMessage());
} catch (RuntimeException $e) {
    $code = $e->getCode();
    if ($code >= 400 && $code < 600) {
        cms1500_fail($code, $e->getMessage());
    }
    cms1500_fail(500, $e->getMessage());
} catch (Exception $e) {
    cms1500_fail(500, $e->getMessage());
}

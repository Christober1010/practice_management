<?php
/**
 * CMS-1500 preview API (test).
 *
 * Payload mapping is owned by claims_billing_lib.php (same builder as Office Ally /
 * Availity submit) so preview and electronic claims cannot drift.
 */
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

function cms1500_preview_fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message]);
    exit();
}

$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!is_array($input)) {
    cms1500_preview_fail(400, 'Invalid JSON payload');
}

$clientIdInput = isset($input['client_id']) ? trim((string)$input['client_id']) : '';
$insuranceIdOverride = isset($input['insurance_id']) ? (int)$input['insurance_id'] : 0;
$locationId = isset($input['location_id']) ? trim((string)$input['location_id']) : '';
$sessionIds = cms1500_numeric_id_array($input['session_ids'] ?? []);

if ($locationId === '') {
    cms1500_preview_fail(400, 'location_id is required');
}
if (count($sessionIds) === 0) {
    cms1500_preview_fail(400, 'session_ids is required');
}

try {
    $conn = getDBConnection();
    $built = cms1500_build_claim_payload(
        $conn,
        [
            'client_id' => $clientIdInput !== '' ? $clientIdInput : null,
            'insurance_id' => $insuranceIdOverride > 0 ? $insuranceIdOverride : null,
            'location_id' => $locationId,
            'session_ids' => $sessionIds,
        ],
        [
            'require_ready_to_bill' => true,
            'max_sessions' => 50,
        ]
    );

    echo json_encode([
        'success' => true,
        'payload' => $built['payload'],
        'warnings' => $built['warnings'],
        'sources' => $built['sources'],
    ]);
} catch (InvalidArgumentException $e) {
    cms1500_preview_fail(400, $e->getMessage());
} catch (RuntimeException $e) {
    $code = (int)$e->getCode();
    if ($code < 400 || $code >= 600) {
        $code = 500;
    }
    cms1500_preview_fail($code, $e->getMessage());
} catch (Throwable $e) {
    cms1500_preview_fail(500, $e->getMessage());
}

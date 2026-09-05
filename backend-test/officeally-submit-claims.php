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
require_once __DIR__ . '/officeally_config_helper.php';
require_once __DIR__ . '/officeally_sftp_helper.php';
require_once __DIR__ . '/officeally_edi837_builder.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$authUser = requireAuth('billing.sftp', 'mahaverse');

/** Inclusive calendar days between Y-m-d dates; max allowed for SFTP batch. */
function officeally_sftp_max_dos_days(): int
{
    return 14;
}

function officeally_sftp_inclusive_day_span(string $fromYmd, string $toYmd): int
{
    $fromYmd = substr(trim($fromYmd), 0, 10);
    $toYmd = substr(trim($toYmd), 0, 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fromYmd) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $toYmd)) {
        return 0;
    }
    try {
        $a = new DateTimeImmutable($fromYmd . ' 00:00:00', new DateTimeZone('UTC'));
        $b = new DateTimeImmutable($toYmd . ' 00:00:00', new DateTimeZone('UTC'));
    } catch (Exception $e) {
        return 0;
    }
    if ($b < $a) {
        return 0;
    }
    return (int)$a->diff($b)->days + 1;
}

/**
 * Ensure selected sessions' DOS span is within the SFTP 2-week limit.
 * @param list<array<string,mixed>> $sessions
 */
function officeally_assert_sessions_within_sftp_range(array $sessions): void
{
    $min = null;
    $max = null;
    foreach ($sessions as $s) {
        $raw = trim((string)($s['start_utc'] ?? ''));
        if ($raw === '') {
            continue;
        }
        $ymd = substr(str_replace('T', ' ', $raw), 0, 10);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $ymd)) {
            continue;
        }
        if ($min === null || $ymd < $min) {
            $min = $ymd;
        }
        if ($max === null || $ymd > $max) {
            $max = $ymd;
        }
    }
    if ($min === null || $max === null) {
        throw new InvalidArgumentException('Selected sessions are missing dates of service.');
    }
    $days = officeally_sftp_inclusive_day_span($min, $max);
    $maxDays = officeally_sftp_max_dos_days();
    if ($days <= 0 || $days > $maxDays) {
        throw new InvalidArgumentException(
            "Office Ally SFTP is limited to a {$maxDays}-day (2-week) DOS range. Selected sessions span {$days} days ({$min} to {$max}). Narrow the selection and try again."
        );
    }
}

function officeally_submit_fail(int $status, string $message, array $extra = []): void
{
    http_response_code($status);
    echo json_encode(array_merge(['success' => false, 'message' => $message], $extra));
    exit();
}

function officeally_sessions_have_claim_status(mysqli $conn): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = false;
    $r = @$conn->query("SHOW COLUMNS FROM sessions LIKE 'claim_status'");
    if ($r && $r->num_rows > 0) {
        $cached = true;
    }
    if ($r) {
        $r->free();
    }
    return $cached;
}

function officeally_mark_sessions_submitted(mysqli $conn, array $sessionIds): void
{
    if (!officeally_sessions_have_claim_status($conn) || $sessionIds === []) {
        return;
    }
    $ids = cms1500_numeric_id_array($sessionIds);
    if ($ids === []) {
        return;
    }
    $ph = cms1500_placeholders(count($ids));
    $status = 'Submitted';
    $sql = "UPDATE sessions SET claim_status = ? WHERE session_id IN ($ph)";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare session status update');
    }
    $types = 's' . str_repeat('i', count($ids));
    $params = array_merge([$status], $ids);
    $stmt->bind_param($types, ...$params);
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        throw new RuntimeException('Failed to update claim status: ' . $err);
    }
    $stmt->close();
}

$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!is_array($input)) {
    officeally_submit_fail(400, 'Invalid JSON payload');
}

$locationId = isset($input['location_id']) ? trim((string)$input['location_id']) : '';
$insuranceIdOverride = isset($input['insurance_id']) ? (int)$input['insurance_id'] : 0;
$sessionIds = cms1500_numeric_id_array($input['session_ids'] ?? []);
$dryRun = !empty($input['dry_run']);

if ($locationId === '') {
    officeally_submit_fail(400, 'location_id is required');
}
if ($sessionIds === []) {
    officeally_submit_fail(400, 'session_ids is required');
}

try {
    $config = officeally_get_config();
    officeally_assert_config_ready($config);

    $conn = getDBConnection();
    $rangeSessions = cms1500_fetch_sessions_by_ids($conn, $sessionIds);
    if (count($rangeSessions) === 0) {
        officeally_submit_fail(404, 'Session not found');
    }
    officeally_assert_sessions_within_sftp_range($rangeSessions);

    $builtClaims = [];
    $allWarnings = [];
    $submittedSessionIds = [];

    foreach ($sessionIds as $sessionId) {
        $built = cms1500_build_claim_payload($conn, [
            'location_id' => $locationId,
            'insurance_id' => $insuranceIdOverride > 0 ? $insuranceIdOverride : null,
            'session_ids' => [$sessionId],
        ], [
            'require_ready_to_bill' => true,
            'max_sessions' => 1,
        ]);
        $builtClaims[] = $built;
        $allWarnings = array_merge($allWarnings, $built['warnings']);
        $submittedSessionIds[] = $sessionId;
    }

    $ediContent = officeally_build_837_from_claims($builtClaims, $config);
    $filename = officeally_build_submission_filename($config);

    if ($dryRun) {
        echo json_encode([
            'success' => true,
            'dry_run' => true,
            'filename' => $filename,
            'bytes' => strlen($ediContent),
            'session_ids' => $submittedSessionIds,
            'warnings' => array_values(array_unique($allWarnings)),
            'config' => officeally_public_config($config),
        ]);
        exit();
    }

    $upload = officeally_sftp_upload_content($config, $filename, $ediContent);
    officeally_mark_sessions_submitted($conn, $submittedSessionIds);

    echo json_encode([
        'success' => true,
        'message' => 'Claim file uploaded to Office Ally SFTP',
        'filename' => $filename,
        'remote_path' => $upload['remote_path'],
        'bytes' => $upload['bytes'],
        'session_ids' => $submittedSessionIds,
        'warnings' => array_values(array_unique($allWarnings)),
        'environment' => $config['environment'],
    ]);
} catch (InvalidArgumentException $e) {
    officeally_submit_fail(400, $e->getMessage());
} catch (RuntimeException $e) {
    $code = $e->getCode();
    officeally_submit_fail(($code >= 400 && $code < 600) ? $code : 502, $e->getMessage());
} catch (Exception $e) {
    officeally_submit_fail(500, $e->getMessage());
}

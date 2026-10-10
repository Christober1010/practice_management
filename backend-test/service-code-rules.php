<?php
// Public (scheduling) read-only view of service code supervising rules.

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token");
header("Access-Control-Allow-Methods: GET, OPTIONS");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Scheduling users need this; manage_data users should also be allowed.
requireAuthAny(['scheduling.read', 'scheduling.session.view', 'manage_data.read'], 'mahaverse');

$conn->set_charset('utf8mb4');

function service_codes_has_supervising_rule_column(mysqli $conn): bool
{
    static $cachedTrue = false;
    if ($cachedTrue) {
        return true;
    }
    $r = @$conn->query("SHOW COLUMNS FROM `master_service_code` LIKE 'supervising_provider_rule'");
    $ok = ($r && $r->num_rows > 0);
    if ($r) {
        $r->free();
    }
    if ($ok) {
        $cachedTrue = true;
    }
    return $ok;
}

try {
    $hasRule = service_codes_has_supervising_rule_column($conn);
    $select = $hasRule
        ? "SELECT code, supervising_provider_rule FROM master_service_code ORDER BY code ASC"
        : "SELECT code, '' AS supervising_provider_rule FROM master_service_code ORDER BY code ASC";

    $stmt = $conn->prepare($select);
    if (!$stmt || !$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch service code rules']);
        exit();
    }
    $result = $stmt->get_result();
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = [
            'code' => (string)($row['code'] ?? ''),
            'supervising_provider_rule' => (string)($row['supervising_provider_rule'] ?? ''),
        ];
    }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $rows]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch service code rules']);
}


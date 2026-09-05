<?php
/**
 * ONE-SHOT: restore christoberedward@gmail.com to admin on TEST.
 * Upload to mahaverse-backend-test, GET once, then DELETE this file.
 *
 * GET ?key=maha-restore-20260810
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$key = (string) ($_GET['key'] ?? '');
if ($key !== 'maha-restore-20260810') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}

require_once __DIR__ . '/config.php';

$email = 'christoberedward@gmail.com';
$out = ['success' => false, 'email' => $email];

try {
    $conn = getDBConnection();
    $stmt = $conn->prepare('UPDATE users SET role = ? WHERE LOWER(TRIM(email)) = LOWER(?) LIMIT 1');
    $role = 'admin';
    $stmt->bind_param('ss', $role, $email);
    $ok = $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    $check = $conn->prepare('SELECT id, email, role FROM users WHERE LOWER(TRIM(email)) = LOWER(?) LIMIT 1');
    $check->bind_param('s', $email);
    $check->execute();
    $row = $check->get_result()->fetch_assoc();
    $check->close();

    $out['success'] = (bool) $ok;
    $out['affected_rows'] = $affected;
    $out['user'] = $row;
    $out['hint'] = 'Delete restore-admin-once.php from the server now.';
} catch (Throwable $e) {
    http_response_code(500);
    $out['message'] = $e->getMessage();
}

echo json_encode($out, JSON_PRETTY_PRINT);

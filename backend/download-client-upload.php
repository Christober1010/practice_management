<?php
/**
 * Download a locally stored client upload (uploads/...) with CORS-friendly headers. (backend)
 *
 * Query params:
 * - path: relative path under uploads/, e.g. uploads/client_<id>/documents/<file>
 * - filename: optional download name
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Accept");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Expose-Headers: Content-Type, Content-Disposition, Content-Length");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = requireAuth('clients.read', 'mahaverse');



$rel = $_GET['path'] ?? '';
$dlName = $_GET['filename'] ?? '';

if (!$rel || !is_string($rel)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'path is required']);
    exit();
}

$rel = ltrim($rel, "/\\");
if (substr($rel, 0, 8) !== 'uploads/') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'path must start with uploads/']);
    exit();
}
if (strpos($rel, '..') !== false) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'invalid path']);
    exit();
}

$abs = __DIR__ . DIRECTORY_SEPARATOR . $rel;
if (!file_exists($abs) || !is_file($abs)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'file not found']);
    exit();

}

$mime = 'application/octet-stream';
if (function_exists('mime_content_type')) {
    $m = @mime_content_type($abs);
    if (is_string($m) && $m) $mime = $m;
}

$name = (is_string($dlName) && $dlName) ? $dlName : basename($abs);
header('Content-Type: ' . $mime);
header('Content-Disposition: attachment; filename="' . addslashes($name) . '"');
header('Content-Length: ' . filesize($abs));
header('Cache-Control: private, max-age=3600');

readfile($abs);



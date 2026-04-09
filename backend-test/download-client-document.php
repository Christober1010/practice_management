<?php
/**
 * Download Client Document from Google Drive (backend-test)
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Expose-Headers: Content-Type, Content-Disposition, Content-Length");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Load environment variables
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
}

// Load Composer autoloader if available (required for Google Drive API)
$vendorPaths = [
    __DIR__ . '/vendor/autoload.php',
    __DIR__ . '/../maha-launchpad/vendor/autoload.php',
    dirname(__DIR__) . '/maha-launchpad/vendor/autoload.php',
];
foreach ($vendorPaths as $vp) {
    if (file_exists($vp)) {
        require_once $vp;
        break;
    }
}

require_once __DIR__ . '/drive_helper.php';

try {
    $fileId = $_GET['file_id'] ?? null;
    $filename = $_GET['filename'] ?? 'document';

    if (!$fileId) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'File ID is required']);
        exit();
    }

    if (!function_exists('isGoogleDriveEnabled') || !isGoogleDriveEnabled()) {
        http_response_code(503);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Google Drive is not enabled']);
        exit();
    }

    $useSharedDrive = function_exists('isSharedDriveEnabled') ? isSharedDriveEnabled() : false;

    $driveError = null;
    $metadata = function_exists('getDriveFileMetadata') ? getDriveFileMetadata($fileId, $useSharedDrive, $driveError) : null;
    if (!$metadata) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'File not found in Drive',
            'error_detail' => $driveError ?? 'Unknown error'
        ]);
        exit();
    }

    $fileContent = function_exists('downloadFileFromDrive') ? downloadFileFromDrive($fileId, $useSharedDrive) : null;
    if ($fileContent === null) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Failed to download file from Drive']);
        exit();
    }

    $mimeType = $metadata['mimeType'] ?? 'application/octet-stream';
    $actualFilename = $metadata['name'] ?? $filename;

    header('Content-Type: ' . $mimeType);
    header('Content-Disposition: attachment; filename="' . addslashes($actualFilename) . '"');
    header('Content-Length: ' . strlen($fileContent));
    header('Cache-Control: private, max-age=3600');

    echo $fileContent;
} catch (Exception $e) {
    error_log("Error in download-client-document.php: " . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()]);
}



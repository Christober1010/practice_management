<?php
/**
 * Upload staff documents to Google Drive or local storage. TEST ENVIRONMENT.
 * Client documents use upload-client-document.php — separate URL so logs and DevTools match the entity.
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept, Accept-Language, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With");
header("Access-Control-Max-Age: 86400");

if (($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS") {
    http_response_code(204);
    exit();
}
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = requireAuth('staff.write', 'mahaverse');



header("Content-Type: application/json; charset=utf-8");

if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
}

$possiblePaths = [
    __DIR__ . '/drive_helper.php',
    __DIR__ . '/backend/drive_helper.php',
    dirname(__DIR__) . '/backend/drive_helper.php',
    __DIR__ . '/../maha-launchpad/backend/drive_helper.php',
    dirname(__DIR__) . '/maha-launchpad/backend/drive_helper.php',
];
$driveHelperPath = null;
foreach ($possiblePaths as $path) {
    if ($path && file_exists($path)) {
        $driveHelperPath = $path;
        break;
    }
}

$vendorPaths = [
    __DIR__ . '/vendor/autoload.php',
    __DIR__ . '/backend/vendor/autoload.php',
    dirname(__DIR__) . '/vendor/autoload.php',
    dirname(__DIR__) . '/backend/vendor/autoload.php',
    __DIR__ . '/../maha-launchpad/vendor/autoload.php',
    dirname(__DIR__) . '/maha-launchpad/vendor/autoload.php',
];
foreach ($vendorPaths as $vp) {
    if (file_exists($vp)) {
        require_once $vp;
        break;
    }
}

if ($driveHelperPath) {
    require_once $driveHelperPath;
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No file uploaded or upload error']);
    exit();
}

$file = $_FILES['file'];
$staffId = trim((string)($_POST['staff_id'] ?? ''));
$docUuid = $_POST['doc_uuid'] ?? '';

if ($staffId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'staff_id is required']);
    exit();
}

$maxSize = 10 * 1024 * 1024;
if ($file['size'] > $maxSize) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'File size exceeds 10MB limit']);
    exit();
}

$mime = false;
if (class_exists('finfo')) {
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
} elseif (function_exists('mime_content_type')) {
    $mime = mime_content_type($file['tmp_name']);
}
$allowedMimes = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/jpg' => 'jpg', 'image/png' => 'png'];
if (!$mime || !isset($allowedMimes[$mime])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid file type. Only PDF, JPG, and PNG are allowed']);
    exit();
}

$ext = $allowedMimes[$mime];
$originalFilename = basename($file['name']);
$storedFilename = bin2hex(random_bytes(16)) . '.' . $ext;

$savedToDrive = false;
$documentPath = '';
$documentFilename = '';

if ($driveHelperPath && function_exists('isGoogleDriveEnabled') && isGoogleDriveEnabled() && function_exists('uploadFileContentToDrive') && function_exists('getOrCreateDriveFolder')) {
    try {
        $folderName = 'staff_' . $staffId;
        $rootFolderId = function_exists('getDriveRootFolderId') ? getDriveRootFolderId() : null;
        $useSharedDrive = function_exists('isSharedDriveEnabled') ? isSharedDriveEnabled() : false;
        $folderId = getOrCreateDriveFolder($folderName, $rootFolderId, $useSharedDrive);
        if (!$folderId) {
            throw new Exception("Failed to create staff folder");
        }
        $fileContent = file_get_contents($file['tmp_name']);
        if ($fileContent === false) {
            throw new Exception("Failed to read file");
        }
        $driveResult = uploadFileContentToDrive($fileContent, $storedFilename, $mime, $folderId, $useSharedDrive);
        if (!$driveResult || !isset($driveResult['fileId'])) {
            throw new Exception("Failed to upload to Drive");
        }
        $documentPath = 'drive://' . $driveResult['fileId'];
        $documentFilename = $driveResult['fileId'];
        $savedToDrive = true;
    } catch (Throwable $e) {
        error_log("Drive staff document upload failed: " . $e->getMessage());
    }
}

if (!$savedToDrive) {
    $uploadBaseAbs = __DIR__ . '/uploads';
    $staffDirAbs = $uploadBaseAbs . '/staff_' . $staffId . '/documents';
    if (!is_dir($staffDirAbs)) {
        if (!mkdir($staffDirAbs, 0755, true)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to create upload directory']);
            exit();
        }
    }
    $destAbs = rtrim($staffDirAbs, '/\\') . DIRECTORY_SEPARATOR . $storedFilename;
    if (!move_uploaded_file($file['tmp_name'], $destAbs)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to save uploaded file']);
        exit();

    }
    $documentPath = 'uploads/staff_' . $staffId . '/documents/' . $storedFilename;
    $documentFilename = $storedFilename;
}

echo json_encode([
    'success' => true,
    'message' => 'Document uploaded successfully',
    'filename' => $originalFilename,
    'document_path' => $documentPath,
    'document_filename' => $documentFilename,
    'saved_to_drive' => $savedToDrive,
]);

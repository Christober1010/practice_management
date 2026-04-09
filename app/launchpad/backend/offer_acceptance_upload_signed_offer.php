<?php
// Upload signed offer letter PDF (generated client-side) and store as StaffAttachment (Drive preferred).
require_once __DIR__ . '/config.php';

// Load composer autoloader (Drive client)
$autoload = __DIR__ . '/../vendor/autoload.php';
if (file_exists($autoload)) {
    require_once $autoload;
}
if (file_exists(__DIR__ . '/drive_helper.php')) {
    require_once __DIR__ . '/drive_helper.php';
}

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$authUser = requireUser();
$role = isset($authUser['role']) ? strtolower((string)$authUser['role']) : 'staff';
$isAdminLike = ($role === 'admin' || $role === 'hr');

$conn = getDBConnection();

function sanitizeFileStem(string $name): string {
    $name = preg_replace('/[^\w\s.-]/', '', $name);
    $name = preg_replace('/\s+/', '_', trim((string)$name));
    $name = substr($name, 0, 80);
    return $name !== '' ? $name : 'document';
}

try {
    $currentUserId = isset($authUser['id']) ? (int)$authUser['id'] : 0;
    if ($currentUserId <= 0) {
        throw new Exception('Authentication required');
    }

    // Determine staff_id
    $staffId = 0;
    if ($isAdminLike && isset($_POST['staff_id']) && $_POST['staff_id'] !== '') {
        $staffId = (int)$_POST['staff_id'];
    }
    if ($staffId <= 0) {
        $stmt = $conn->prepare("SELECT staff_id FROM Staff WHERE created_by_user_id = ? ORDER BY staff_id DESC LIMIT 1");
        if (!$stmt) throw new Exception('Staff lookup failed');
        $stmt->bind_param("i", $currentUserId);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $stmt->close();
        $staffId = $row ? (int)$row['staff_id'] : 0;
    }
    if ($staffId <= 0) throw new Exception('No staff profile found for this account.');

    // If not admin-like, enforce ownership
    if (!$isAdminLike) {
        $own = $conn->prepare("SELECT created_by_user_id FROM Staff WHERE staff_id = ? LIMIT 1");
        if (!$own) throw new Exception('Authorization check failed');
        $own->bind_param("i", $staffId);
        $own->execute();
        $ownRes = $own->get_result();
        $ownRow = $ownRes ? $ownRes->fetch_assoc() : null;
        $own->close();
        $createdBy = $ownRow ? (int)$ownRow['created_by_user_id'] : 0;
        if ($createdBy <= 0 || $createdBy !== $currentUserId) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied']);
            exit;
        }
    }

    // Ensure offer is accepted
    $offerStmt = $conn->prepare("
        SELECT offer_id, employee_name, accepted_date
        FROM StaffOfferAcceptances
        WHERE staff_id = ?
        LIMIT 1
    ");
    if (!$offerStmt) throw new Exception('Offer lookup failed');
    $offerStmt->bind_param("i", $staffId);
    $offerStmt->execute();
    $offerRes = $offerStmt->get_result();
    $offer = $offerRes ? $offerRes->fetch_assoc() : null;
    $offerStmt->close();

    if (!$offer) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Offer has not been accepted yet.']);
        exit;
    }

    if (!isset($_FILES['pdf'])) {
        throw new Exception('Missing PDF file.');
    }
    $file = $_FILES['pdf'];
    if (!is_array($file) || !isset($file['error'])) {
        throw new Exception('Invalid upload.');
    }
    if ((int)$file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Upload failed (error ' . (int)$file['error'] . ').');
    }
    $tmpPath = (string)($file['tmp_name'] ?? '');
    if ($tmpPath === '' || !file_exists($tmpPath)) {
        throw new Exception('Upload temp file missing.');
    }

    $maxBytes = 12 * 1024 * 1024; // 12MB safety cap
    $sizeBytes = (int)($file['size'] ?? 0);
    if ($sizeBytes <= 0 || $sizeBytes > $maxBytes) {
        throw new Exception('PDF size is invalid (max 12MB).');
    }

    // Try to detect mime type
    $mimeType = 'application/pdf';
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $det = finfo_file($finfo, $tmpPath);
            finfo_close($finfo);
            if (is_string($det) && $det !== '') $mimeType = $det;
        }
    }
    if ($mimeType !== 'application/pdf') {
        // Keep this permissive; some servers report application/octet-stream.
        // We'll still store as PDF.
        $mimeType = 'application/pdf';
    }

    $pdfContent = file_get_contents($tmpPath);
    if (!is_string($pdfContent) || $pdfContent === '') throw new Exception('Failed to read uploaded PDF.');

    $sha256 = hash('sha256', $pdfContent);
    if (!$sha256) throw new Exception('Failed to hash PDF.');

    $employeeName = sanitizeFileStem((string)($offer['employee_name'] ?? 'Employee'));
    $acceptedDate = (string)($offer['accepted_date'] ?? date('Y-m-d'));
    $friendlyName = "Offer_Letter_{$employeeName}_SIGNED_{$acceptedDate}.pdf";
    $driveName = bin2hex(random_bytes(16)) . ".pdf";

    $storedPath = '';
    $storedName = '';
    $savedToDrive = false;

    $driveEnabled = function_exists('isGoogleDriveEnabled') ? isGoogleDriveEnabled() : false;
    if (
        $driveEnabled &&
        function_exists('uploadFileToDrive') &&
        function_exists('getOrCreateDriveFolder')
    ) {
        try {
            $useSharedDrive = function_exists('isSharedDriveEnabled') ? isSharedDriveEnabled() : false;
            $rootFolderId = function_exists('getDriveRootFolderId') ? getDriveRootFolderId() : null;

            // Parent folder for signed offers (prefer explicit folder id, otherwise create by name under root).
            $signedOffersFolderId = getenv('GOOGLE_DRIVE_SIGNED_OFFERS_FOLDER_ID');
            if (!$signedOffersFolderId) {
                $signedOffersFolderId = getOrCreateDriveFolder('signed_offer_letters', $rootFolderId, $useSharedDrive);
            }
            if (!$signedOffersFolderId) throw new Exception('Signed offers folder not configured.');

            // Staff subfolder under the signed offers folder
            $staffFolderId = getOrCreateDriveFolder('staff_' . $staffId, $signedOffersFolderId, $useSharedDrive);
            if (!$staffFolderId) throw new Exception('Failed to create staff folder for signed offers.');

            $driveResult = uploadFileToDrive($tmpPath, $friendlyName, 'application/pdf', $staffFolderId, $useSharedDrive);
            if (!$driveResult || !isset($driveResult['fileId'])) throw new Exception('uploadFileToDrive failed');

            $storedPath = 'drive://' . $staffFolderId;
            $storedName = $driveResult['fileId']; // store drive fileId
            $savedToDrive = true;
        } catch (Throwable $e) {
            error_log("Drive signed offer upload failed; falling back to local. staff_id={$staffId} err=" . $e->getMessage());
            $savedToDrive = false;
        }
    }

    if (!$savedToDrive) {
        // Fallback to local filesystem storage
        $uploadBaseAbs = __DIR__ . '/uploads';
        $staffDirAbs = $uploadBaseAbs . '/staff_' . $staffId;
        $staffDirRel = 'uploads/staff_' . $staffId;
        if (!is_dir($staffDirAbs)) {
            if (!mkdir($staffDirAbs, 0755, true)) {
                throw new Exception("Failed to create upload directory.");
            }
        }
        $storedFilename = $driveName; // random filename
        $destAbs = rtrim($staffDirAbs, '/\\') . DIRECTORY_SEPARATOR . $storedFilename;
        if (file_put_contents($destAbs, $pdfContent) === false) {
            throw new Exception("Failed to save signed offer PDF.");
        }
        $storedPath = $staffDirRel;
        $storedName = $storedFilename;
    }

    // Insert attachment row
    $att = $conn->prepare("
        INSERT INTO StaffAttachments
            (staff_id, uploaded_by_user_id, attachment_type,
             original_filename, stored_path, stored_filename,
             mime_type, size_bytes, sha256, created_at)
        VALUES (?, ?, 'SIGNED_OFFER_LETTER', ?, ?, ?, ?, ?, ?, NOW())
    ");
    if (!$att) throw new Exception('Attachment insert prepare failed');
    $att->bind_param(
        "iissssis",
        $staffId,
        $currentUserId,
        $friendlyName,
        $storedPath,
        $storedName,
        $mimeType,
        $sizeBytes,
        $sha256
    );
    if (!$att->execute()) throw new Exception('Attachment insert failed: ' . $att->error);
    $attachmentId = (int)$conn->insert_id;
    $att->close();

    echo json_encode([
        'success' => true,
        'message' => 'Signed offer letter stored.',
        'staff_id' => $staffId,
        'attachment_id' => $attachmentId,
        'stored_in' => ($savedToDrive ? 'drive' : 'local'),
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();



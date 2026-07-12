<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ob_start();

require_once __DIR__ . '/cors_helpers.php';

function setCorsHeadersForClientIntake() {
    launchpad_apply_cors_headers('POST, OPTIONS');
}

register_shutdown_function(function () {
    $err = error_get_last();
    if (!$err) return;

    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR];
    if (!in_array($err['type'], $fatalTypes, true)) return;

    while (ob_get_level() > 0) {
        @ob_end_clean();
    }

    setCorsHeadersForClientIntake();
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8', true);
        echo json_encode([
            'success' => false,
            'title' => 'Submission Failed',
            'message' => 'Internal server error while submitting the client intake form.',
        ]);
    }
});

$autoload = __DIR__ . '/../vendor/autoload.php';
if (file_exists($autoload)) {
    require_once $autoload;
}

require_once 'config.php';

if (file_exists(__DIR__ . '/drive_helper.php')) {
    require_once __DIR__ . '/drive_helper.php';
}
if (file_exists(__DIR__ . '/client_intake_drive_lib.php')) {
    require_once __DIR__ . '/client_intake_drive_lib.php';
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    setCorsHeadersForClientIntake();
    http_response_code(200);
    exit;
}

setCorsHeadersForClientIntake();
header('Content-Type: application/json; charset=utf-8', true);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'title' => 'Submission Failed',
        'message' => 'Invalid request method.',
    ]);
    exit;
}

function intake_string($payload, $key) {
    if (!is_array($payload) || !array_key_exists($key, $payload)) return '';
    $value = $payload[$key];
    if (is_array($value) || is_object($value)) return '';
    return trim((string)$value);
}

function intake_bool($payload, $key) {
    return is_array($payload) && !empty($payload[$key]);
}

function intake_valid_signature($value) {
    return is_string($value) && preg_match('/^data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+\/=]+$/', $value) === 1;
}

function intake_sanitize_drive_folder_id($raw): ?string {
    $raw = trim((string)$raw);
    if ($raw === '' || preg_match('#^https?://#i', $raw)) {
        return null;
    }
    if (!preg_match('/^[A-Za-z0-9_-]{10,}$/', $raw)) {
        return null;
    }
    return $raw;
}

function intake_signature_upload_filename(string $attachmentType): string {
    switch ($attachmentType) {
        case 'PARENT_GUARDIAN_SIGNATURE':
            return 'parent_guardian_signature.png';
        case 'PROVIDER_SIGNATURE':
            return 'provider_signature.png';
        default:
            return strtolower($attachmentType) . '.png';
    }
}

function intake_decode_signature_data_url(string $dataUrl, string $uploadFilename): array {
    if (!preg_match('/^data:image\/(png|jpeg|jpg);base64,(.+)$/', $dataUrl, $matches)) {
        throw new Exception('Invalid signature format.');
    }

    $imageData = base64_decode($matches[2], true);
    if ($imageData === false) {
        throw new Exception('Failed to decode signature image.');
    }

    $maxBytes = 2 * 1024 * 1024;
    if (strlen($imageData) > $maxBytes) {
        throw new Exception('Signature image is too large (max 2MB).');
    }

    $sha256 = hash('sha256', $imageData);
    if ($sha256 === false) {
        throw new Exception('Failed to hash signature image.');
    }

    return [
        'imageData' => $imageData,
        'sha256' => $sha256,
        'sizeBytes' => strlen($imageData),
        'mime_type' => 'image/png',
        'storedFilename' => $uploadFilename,
        'original_filename' => $uploadFilename,
    ];
}

function intake_save_signature_attachment(
    mysqli $conn,
    int $intakeId,
    int $uploadedByUserId,
    string $attachmentType,
    string $dataUrl,
    bool $driveEnabled,
    ?string $clientDriveFolderId,
    string $localFolderName,
    array &$savedLocalFiles,
    array &$driveFallbacks,
    array &$driveErrors
): void {
    $uploadFilename = intake_signature_upload_filename($attachmentType);
    $decoded = intake_decode_signature_data_url($dataUrl, $uploadFilename);
    $storedFilename = $decoded['storedFilename'];
    $storedPath = '';
    $storedFileRef = $storedFilename;
    $savedToDrive = false;

    if (
        $driveEnabled &&
        $clientDriveFolderId &&
        function_exists('uploadFileContentToDrive')
    ) {
        try {
            if (!function_exists('getGoogleDriveClient') || !getGoogleDriveClient()) {
                throw new Exception(
                    'Drive OAuth client unavailable. Re-link Drive in Launchpad (required after changing GOOGLE_DRIVE_SCOPES).'
                );
            }

            $useSharedDrive = isSharedDriveEnabled();
            $driveResult = uploadFileContentToDrive(
                $decoded['imageData'],
                $storedFilename,
                $decoded['mime_type'],
                $clientDriveFolderId,
                $useSharedDrive
            );
            if (!$driveResult || !isset($driveResult['fileId'])) {
                throw new Exception('uploadFileContentToDrive failed');
            }

            $storedPath = 'drive://' . $clientDriveFolderId;
            $storedFileRef = $driveResult['fileId'];
            $savedToDrive = true;
        } catch (Throwable $e) {
            $driveFallbacks[] = $attachmentType;
            $driveErrors[] = [
                'type' => $attachmentType,
                'error' => $e->getMessage(),
            ];
            error_log(
                "Drive client intake signature upload failed; falling back to local. intake_id={$intakeId} type={$attachmentType} err="
                . $e->getMessage()
            );
        }
    } elseif ($driveEnabled && !$clientDriveFolderId) {
        $driveFallbacks[] = $attachmentType;
    }

    if (!$savedToDrive) {
        $dirAbs = __DIR__ . '/uploads/' . $localFolderName;
        if (!is_dir($dirAbs) && !mkdir($dirAbs, 0755, true)) {
            throw new Exception('Failed to create upload directory for client intake signature.');
        }

        $destAbs = rtrim($dirAbs, '/\\') . DIRECTORY_SEPARATOR . $storedFilename;
        if (file_put_contents($destAbs, $decoded['imageData']) === false) {
            throw new Exception('Failed to save client intake signature locally.');
        }

        $savedLocalFiles[] = $destAbs;
        $storedPath = 'uploads/' . $localFolderName;
        $storedFileRef = $storedFilename;
    }

    $sql = "
        INSERT INTO ClientIntakeAttachments
            (intake_id, uploaded_by_user_id, attachment_type,
             original_filename, stored_path, stored_filename,
             mime_type, size_bytes, sha256, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Client intake attachment SQL prepare failed: ' . $conn->error);
    }

    $stmt->bind_param(
        'iisssssis',
        $intakeId,
        $uploadedByUserId,
        $attachmentType,
        $decoded['original_filename'],
        $storedPath,
        $storedFileRef,
        $decoded['mime_type'],
        $decoded['sizeBytes'],
        $decoded['sha256']
    );

    if (!$stmt->execute()) {
        throw new Exception('Client intake attachment insert failed: ' . $stmt->error);
    }
    $stmt->close();
}

$response = [
    'success' => false,
    'title' => 'Submission Failed',
    'message' => 'An unexpected error occurred.',
];

$conn = null;
$savedLocalFiles = [];
$driveFallbacks = [];
$driveErrors = [];

try {
    $authUser = requireUser();
    $role = isset($authUser['role']) ? strtolower((string)$authUser['role']) : 'staff';
    $canSubmit = in_array($role, ['admin', 'hr', 'staff', 'employee'], true);
    if (!$canSubmit) {
        http_response_code(403);
        throw new Exception('Only Admin, HR, and Staff can submit client intake packets.');
    }

    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        throw new Exception('Invalid JSON payload.');
    }

    $childLegalName = intake_string($payload, 'childLegalName');
    $childDob = intake_string($payload, 'childDob');
    $completedBy = intake_string($payload, 'completedBy');
    $childHomeAddress = intake_string($payload, 'childHomeAddress');
    $homePhone = intake_string($payload, 'homePhone');
    $cellPhone = intake_string($payload, 'cellPhone');
    $therapyGoals = intake_string($payload, 'therapyGoals');
    $diagnosis = intake_string($payload, 'diagnosis');
    $parentSignature = intake_string($payload, 'parentGuardianSignature');
    $parentSignatureDate = intake_string($payload, 'parentGuardianSignatureDate');
    $providerSignature = intake_string($payload, 'providerSignature');
    $providerSignatureDate = intake_string($payload, 'providerSignatureDate');

    if ($childLegalName === '') throw new Exception('Legal name of child is required.');
    if ($childDob === '') throw new Exception("Child's date of birth is required.");
    if ($completedBy === '') throw new Exception('Name of person completing this form is required.');
    if ($childHomeAddress === '') throw new Exception("Child's home address is required.");
    if ($homePhone === '' && $cellPhone === '') throw new Exception('At least one telephone number is required.');
    if ($therapyGoals === '') throw new Exception('Therapy goals are required.');
    if ($diagnosis === '') throw new Exception("Child's diagnosis is required.");
    if (!intake_bool($payload, 'caregiverGuidelinesAccepted')) {
        throw new Exception('Caregiver guidelines must be accepted.');
    }
    if (function_exists('intake_all_consents_accepted') && !intake_all_consents_accepted($payload)) {
        $missing = function_exists('intake_missing_consent_labels')
            ? intake_missing_consent_labels($payload)
            : [];
        $detail = !empty($missing) ? (' Missing: ' . implode('; ', $missing)) : '';
        throw new Exception('All consents and authorizations must be accepted before submission.' . $detail);
    }
    if (!intake_valid_signature($parentSignature)) {
        throw new Exception('Parent/guardian signature is required.');
    }
    if ($parentSignatureDate === '') {
        throw new Exception('Parent/guardian signature date is required.');
    }
    if ($providerSignature !== '' && !intake_valid_signature($providerSignature)) {
        throw new Exception('Invalid provider signature format.');
    }
    if ($providerSignature !== '' && $providerSignatureDate === '') {
        throw new Exception('Provider signature date is required when provider signature is captured.');
    }

    $createdByUserId = isset($authUser['id']) ? (int)$authUser['id'] : null;
    if (!$createdByUserId) {
        throw new Exception('Authentication required. Please log in again.');
    }

    $payloadForStorage = $payload;
    unset($payloadForStorage['completedFormPdf']);
    $payloadJson = json_encode($payloadForStorage, JSON_UNESCAPED_SLASHES);
    if ($payloadJson === false) {
        throw new Exception('Failed to encode intake payload.');
    }

    $contactPhone = $cellPhone !== '' ? $cellPhone : $homePhone;
    $providerSignatureNullable = $providerSignature !== '' ? $providerSignature : null;
    $providerSignatureDateNullable = $providerSignatureDate !== '' ? $providerSignatureDate : null;
    $driveEnabled = function_exists('isGoogleDriveEnabled') && isGoogleDriveEnabled();

    $conn = getDBConnection();
    $conn->begin_transaction();

    $stmt = $conn->prepare("
        INSERT INTO ClientIntakePackets
            (created_by_user_id, child_legal_name, child_dob, completed_by,
             contact_phone, payload_json, parent_guardian_signature_data_url,
             parent_guardian_signature_date, provider_signature_data_url,
             provider_signature_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ");
    if (!$stmt) {
        throw new Exception('Client intake SQL prepare failed: ' . $conn->error);
    }

    $stmt->bind_param(
        'isssssssss',
        $createdByUserId,
        $childLegalName,
        $childDob,
        $completedBy,
        $contactPhone,
        $payloadJson,
        $parentSignature,
        $parentSignatureDate,
        $providerSignatureNullable,
        $providerSignatureDateNullable
    );

    if (!$stmt->execute()) {
        throw new Exception('Client intake insert failed: ' . $stmt->error);
    }

    $intakeId = (int)$conn->insert_id;
    $stmt->close();

    $localFolderName = function_exists('intake_client_folder_name')
        ? intake_client_folder_name($intakeId, $childLegalName)
        : ('client_intake_' . $intakeId);
    $clientDriveFolderId = null;
    $clientDriveFolderName = $localFolderName;
    $clientDriveParentId = null;

    if ($driveEnabled && function_exists('intake_get_or_create_client_folder')) {
        $useSharedDrive = function_exists('isSharedDriveEnabled') && isSharedDriveEnabled();
        $folderResult = intake_get_or_create_client_folder($intakeId, $childLegalName, $useSharedDrive);
        $clientDriveFolderId = is_array($folderResult) ? ($folderResult['id'] ?? null) : null;
        $clientDriveParentId = is_array($folderResult) ? ($folderResult['parent_id'] ?? null) : null;
        if (!$clientDriveFolderId) {
            $driveFallbacks[] = 'CLIENT_FOLDER';
            $driveErrors[] = [
                'type' => 'CLIENT_FOLDER',
                'error' => is_array($folderResult)
                    ? ($folderResult['error'] ?? 'Could not create client intake folder in Drive.')
                    : 'Could not create client intake folder in Drive.',
                'parent_id' => is_array($folderResult)
                    ? ($folderResult['parent_id'] ?? null)
                    : null,
                'parent_candidates' => is_array($folderResult)
                    ? ($folderResult['parent_candidates'] ?? (function_exists('intake_client_parent_folder_candidates')
                        ? intake_client_parent_folder_candidates()
                        : []))
                    : [],
                'parent_errors' => is_array($folderResult) ? ($folderResult['parent_errors'] ?? []) : [],
            ];
        }
    }

    intake_save_signature_attachment(
        $conn,
        $intakeId,
        $createdByUserId,
        'PARENT_GUARDIAN_SIGNATURE',
        $parentSignature,
        $driveEnabled,
        $clientDriveFolderId,
        $localFolderName,
        $savedLocalFiles,
        $driveFallbacks,
        $driveErrors
    );

    if ($providerSignature !== '') {
        intake_save_signature_attachment(
            $conn,
            $intakeId,
            $createdByUserId,
            'PROVIDER_SIGNATURE',
            $providerSignature,
            $driveEnabled,
            $clientDriveFolderId,
            $localFolderName,
            $savedLocalFiles,
            $driveFallbacks,
            $driveErrors
        );
    }

    if (function_exists('intake_save_completed_form_attachment')) {
        intake_save_completed_form_attachment(
            $conn,
            $intakeId,
            $createdByUserId,
            $payload,
            $childLegalName,
            $driveEnabled,
            $clientDriveFolderId,
            $savedLocalFiles,
            $driveFallbacks,
            $driveErrors
        );
    }

    if (function_exists('intake_save_consents_attachment')) {
        intake_save_consents_attachment(
            $conn,
            $intakeId,
            $createdByUserId,
            $payload,
            $childLegalName,
            $driveEnabled,
            $clientDriveFolderId,
            $savedLocalFiles,
            $driveFallbacks,
            $driveErrors
        );
    }

    $conn->commit();

    $response = [
        'success' => true,
        'title' => 'Client Intake Submitted',
        'message' => "Client intake packet for {$childLegalName} submitted successfully.",
        'intake_id' => $intakeId,
        'drive' => [
            'enabled' => (bool)$driveEnabled,
            'connected' => function_exists('isDriveOAuthConnected') ? isDriveOAuthConnected() : null,
            'connected_as' => function_exists('intake_drive_oauth_connected_account')
                ? intake_drive_oauth_connected_account()
                : null,
            'folder_id' => $clientDriveFolderId,
            'folder_name' => $clientDriveFolderName,
            'folder_url' => $clientDriveFolderId
                ? ('https://drive.google.com/drive/folders/' . $clientDriveFolderId)
                : null,
            'parent_folder_id' => $clientDriveParentId,
            'parent_folder_url' => $clientDriveParentId
                ? ('https://drive.google.com/drive/folders/' . $clientDriveParentId)
                : null,
            'parent_candidates' => function_exists('intake_client_parent_folder_candidates')
                ? intake_client_parent_folder_candidates()
                : [],
            'fallbacks' => array_values(array_unique($driveFallbacks)),
            'errors' => $driveErrors,
            'hint' => empty($driveFallbacks)
                ? null
                : (function_exists('isDriveOAuthConnected') && !isDriveOAuthConnected()
                    ? 'Drive OAuth is not connected. Re-link Drive in Launchpad after updating GOOGLE_DRIVE_SCOPES.'
                    : (function_exists('intake_drive_parent_access_hint')
                        ? intake_drive_parent_access_hint($driveErrors, $clientDriveParentId)
                        : 'Some Drive uploads failed and were saved locally. See drive.errors for details.')),
        ],
    ];
} catch (Throwable $e) {
    if ($conn instanceof mysqli) {
        $conn->rollback();
    }
    foreach ($savedLocalFiles as $path) {
        if (is_string($path) && file_exists($path)) {
            @unlink($path);
        }
    }
    $response['message'] = $e->getMessage();
    error_log('Client intake submission error: ' . $e->getMessage());
} finally {
    if ($conn instanceof mysqli) {
        $conn->close();
    }
}

while (ob_get_level() > 0) {
    @ob_end_clean();
}

setCorsHeadersForClientIntake();
header('Content-Type: application/json; charset=utf-8', true);
echo json_encode($response);
?>

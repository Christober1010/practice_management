<?php
/**
 * Google Drive layout + completed-form export for client intake packets.
 */

require_once __DIR__ . '/client_intake_form_html.php';
require_once __DIR__ . '/client_intake_consent_html.php';
require_once __DIR__ . '/client_intake_pdf.php';

function intake_client_folder_name(int $intakeId, string $childLegalName): string {
    $safe = preg_replace('/[^A-Za-z0-9._ -]+/', '', $childLegalName);
    $safe = trim(preg_replace('/\s+/', '_', (string)$safe));
    if ($safe === '') {
        $safe = 'client';
    }
    if (strlen($safe) > 60) {
        $safe = substr($safe, 0, 60);
    }
    return 'client_intake_' . $intakeId . '_' . $safe;
}

function intake_client_parent_folder_candidates(): array {
    if (!function_exists('intake_sanitize_drive_folder_id')) {
        return [];
    }

    $signedOffers = intake_sanitize_drive_folder_id(getenv('GOOGLE_DRIVE_SIGNED_OFFERS_FOLDER_ID'));
    $clientIntake = intake_sanitize_drive_folder_id(getenv('GOOGLE_DRIVE_CLIENT_INTAKE_FOLDER_ID'));
    $root = function_exists('getDriveRootFolderId') ? intake_sanitize_drive_folder_id(getDriveRootFolderId()) : null;

    // app_offerletter (signed offers) is accessible to OAuth; app_launchpad (root) often is not.
    $ordered = [
        $signedOffers,
        ($clientIntake && $clientIntake !== $root) ? $clientIntake : null,
        $clientIntake,
        $root,
    ];

    $candidates = [];
    foreach ($ordered as $id) {
        if ($id && !in_array($id, $candidates, true)) {
            $candidates[] = $id;
        }
    }

    return $candidates;
}

function intake_no_accessible_parent_message(array $parentErrors): string {
    $tried = [];
    foreach ($parentErrors as $entry) {
        if (!empty($entry['parent_id'])) {
            $tried[] = (string)$entry['parent_id'];
        }
    }
    $triedText = !empty($tried) ? implode(', ', $tried) : '(none configured)';

    return 'No accessible client intake parent folder. Tried folder id(s): ' . $triedText . '. '
        . 'On the Launchpad server backend/.env set GOOGLE_DRIVE_CLIENT_INTAKE_FOLDER_ID and '
        . 'GOOGLE_DRIVE_SIGNED_OFFERS_FOLDER_ID to app_offerletter (same folder id offer letters use), '
        . 'not app_launchpad. Then upload the latest client_intake_drive_lib.php.';
}

function intake_drive_oauth_connected_account(): ?string {
    if (!function_exists('getDBConnection')) {
        return null;
    }
    try {
        $conn = getDBConnection();
        $res = $conn->query("SELECT connected_by_username FROM GoogleDriveOAuthTokens WHERE id = 1 LIMIT 1");
        if (!$res) {
            return null;
        }
        $row = $res->fetch_assoc();
        $username = isset($row['connected_by_username']) ? trim((string)$row['connected_by_username']) : '';
        return $username !== '' ? $username : null;
    } catch (Throwable $e) {
        return null;
    }
}

function intake_format_drive_api_error(string $rawMessage, ?string $parentFolderId = null): string {
    $connectedAs = intake_drive_oauth_connected_account();
    $connectedHint = $connectedAs
        ? "Launchpad Drive is connected as \"{$connectedAs}\" (use that Google account when sharing folders)."
        : 'Launchpad Drive is connected via OAuth (use that same Google account when sharing folders).';

    $decoded = json_decode($rawMessage, true);
    if (is_array($decoded) && isset($decoded['error']['message'])) {
        $rawMessage = (string)$decoded['error']['message'];
    }

    if (stripos($rawMessage, 'not found') !== false && $parentFolderId) {
        return "Parent folder not accessible to the linked Google account ({$parentFolderId}). "
            . 'Use app_offerletter (same folder as offer letters), not app_launchpad. '
            . "Share that folder with the OAuth Google account as Editor. {$connectedHint}";
    }

    if (stripos($rawMessage, 'insufficient') !== false || stripos($rawMessage, '403') !== false) {
        return "Insufficient Drive permission for parent folder {$parentFolderId}. {$connectedHint}";
    }

    return $rawMessage;
}

function intake_drive_parent_access_hint(array $driveErrors, ?string $parentFolderId): string {
    foreach ($driveErrors as $err) {
        if (!is_array($err) || ($err['type'] ?? '') !== 'CLIENT_FOLDER') {
            continue;
        }
        $folder = $parentFolderId ?: 'your configured parent folder';
        $connectedAs = intake_drive_oauth_connected_account();
        return 'Use a parent folder the Launchpad OAuth account can access (e.g. app_offerletter / '
            . $folder
            . '). Set GOOGLE_DRIVE_CLIENT_INTAKE_FOLDER_ID to that folder id'
            . ($connectedAs ? ' (Drive linked as ' . $connectedAs . ').' : '.');
    }

    return 'Some Drive uploads failed and were saved locally. See drive.errors for details.';
}

function intake_drive_create_or_find_subfolder(Google\Service\Drive $drive, string $folderName, string $parentId): ?string {
    $escapedName = str_replace("'", "\\'", $folderName);
    $query = "name = '" . $escapedName . "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '" . addslashes($parentId) . "' in parents";
    $listed = $drive->files->listFiles([
        'q' => $query,
        'fields' => 'files(id,name)',
        'pageSize' => 1,
        'supportsAllDrives' => true,
        'includeItemsFromAllDrives' => true,
    ]);
    if (count($listed->getFiles()) > 0) {
        return $listed->getFiles()[0]->getId();
    }

    $folderMetadata = new Google\Service\Drive\DriveFile([
        'name' => $folderName,
        'mimeType' => 'application/vnd.google-apps.folder',
        'parents' => [$parentId],
    ]);
    $created = $drive->files->create($folderMetadata, [
        'supportsAllDrives' => true,
        'fields' => 'id,name,parents',
    ]);

    return $created->getId() ?: null;
}

function intake_get_or_create_client_folder(int $intakeId, string $childLegalName, bool $useSharedDrive): array {
    $candidates = intake_client_parent_folder_candidates();
    $result = [
        'id' => null,
        'error' => null,
        'parent_id' => null,
        'parent_candidates' => $candidates,
        'parent_errors' => [],
    ];

    if (!function_exists('getGoogleDriveClient')) {
        $result['error'] = 'Drive helper is not loaded.';
        return $result;
    }

    $client = getGoogleDriveClient();
    if (!$client) {
        $result['error'] = 'Drive OAuth client unavailable. Re-link Drive in Launchpad.';
        return $result;
    }

    if (empty($candidates)) {
        $result['error'] = 'No client intake parent folder configured. Set GOOGLE_DRIVE_SIGNED_OFFERS_FOLDER_ID on the server.';
        return $result;
    }

    if (!class_exists('Google\\Service\\Drive')) {
        $result['error'] = 'Google Drive API client is not available on the server.';
        return $result;
    }

    $drive = new Google\Service\Drive($client);
    $folderName = intake_client_folder_name($intakeId, $childLegalName);

    foreach ($candidates as $parentId) {
        if (function_exists('getOrCreateDriveFolder')) {
            $folderId = getOrCreateDriveFolder($folderName, $parentId, $useSharedDrive);
            if ($folderId) {
                $result['id'] = $folderId;
                $result['parent_id'] = $parentId;
                return $result;
            }
        }

        try {
            $folderId = intake_drive_create_or_find_subfolder($drive, $folderName, $parentId);
            if ($folderId) {
                $result['id'] = $folderId;
                $result['parent_id'] = $parentId;
                return $result;
            }
            $result['parent_errors'][] = [
                'parent_id' => $parentId,
                'error' => 'Drive API returned no folder id after create.',
            ];
        } catch (Throwable $e) {
            $result['parent_errors'][] = [
                'parent_id' => $parentId,
                'error' => intake_format_drive_api_error($e->getMessage(), $parentId),
            ];
        }
    }

    $result['parent_id'] = $candidates[0];
    $result['error'] = !empty($result['parent_errors'])
        ? ('Could not create client intake folder under any parent. ' . (string)$result['parent_errors'][0]['error'])
        : intake_no_accessible_parent_message($result['parent_errors']);
    return $result;
}

function intake_html_escape($value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function intake_save_completed_form_attachment(
    mysqli $conn,
    int $intakeId,
    int $uploadedByUserId,
    array $payload,
    string $childLegalName,
    bool $driveEnabled,
    ?string $clientDriveFolderId,
    array &$savedLocalFiles,
    array &$driveFallbacks,
    array &$driveErrors
): void {
    $folderName = intake_client_folder_name($intakeId, $childLegalName);
    $storedPath = '';
    $storedFileRef = '';
    $savedToDrive = false;

    $pdfDecoded = intake_build_completed_form_pdf($intakeId, $payload, $childLegalName);
    if (!$pdfDecoded) {
        $pdfDecoded = intake_decode_completed_form_pdf($payload);
    }

    if ($pdfDecoded) {
        $filename = $pdfDecoded['filename'];
        $mimeType = $pdfDecoded['mime_type'];
        $content = $pdfDecoded['content'];
        $sizeBytes = $pdfDecoded['sizeBytes'];
        $sha256 = $pdfDecoded['sha256'];
    } else {
        error_log("Client intake PDF generation unavailable; saving HTML fallback. intake_id={$intakeId}");
        $html = intake_build_completed_form_html($intakeId, $payload, $childLegalName);
        $filename = 'client_intake_form.html';
        $mimeType = 'text/html';
        $content = $html;
        $sizeBytes = strlen($html);
        $sha256 = hash('sha256', $html);
        if ($sha256 === false) {
            throw new Exception('Failed to hash completed client intake form.');
        }
    }

    if (
        $driveEnabled &&
        $clientDriveFolderId &&
        function_exists('uploadFileContentToDrive')
    ) {
        try {
            if (!function_exists('getGoogleDriveClient') || !getGoogleDriveClient()) {
                throw new Exception('Drive OAuth client unavailable.');
            }

            $useSharedDrive = function_exists('isSharedDriveEnabled') && isSharedDriveEnabled();
            $driveResult = uploadFileContentToDrive(
                $content,
                $filename,
                $mimeType,
                $clientDriveFolderId,
                $useSharedDrive
            );
            if (!$driveResult || !isset($driveResult['fileId'])) {
                throw new Exception('uploadFileContentToDrive failed for completed form');
            }

            $storedPath = 'drive://' . $clientDriveFolderId;
            $storedFileRef = $driveResult['fileId'];
            $savedToDrive = true;
        } catch (Throwable $e) {
            $driveFallbacks[] = 'COMPLETED_FORM';
            $driveErrors[] = [
                'type' => 'COMPLETED_FORM',
                'error' => $e->getMessage(),
            ];
            error_log(
                "Drive client intake form upload failed; falling back to local. intake_id={$intakeId} err="
                . $e->getMessage()
            );
        }
    } elseif ($driveEnabled && !$clientDriveFolderId) {
        $driveFallbacks[] = 'COMPLETED_FORM';
    }

    if (!$savedToDrive) {
        $dirAbs = __DIR__ . '/uploads/' . $folderName;
        if (!is_dir($dirAbs) && !mkdir($dirAbs, 0755, true)) {
            throw new Exception('Failed to create upload directory for client intake form.');
        }

        $destAbs = rtrim($dirAbs, '/\\') . DIRECTORY_SEPARATOR . $filename;
        if (file_put_contents($destAbs, $content) === false) {
            throw new Exception('Failed to save client intake form locally.');
        }

        $savedLocalFiles[] = $destAbs;
        $storedPath = 'uploads/' . $folderName;
        $storedFileRef = $filename;
    }

    $sql = "
        INSERT INTO ClientIntakeAttachments
            (intake_id, uploaded_by_user_id, attachment_type,
             original_filename, stored_path, stored_filename,
             mime_type, size_bytes, sha256, created_at)
        VALUES (?, ?, 'COMPLETED_FORM', ?, ?, ?, ?, ?, ?, NOW())
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Client intake form attachment SQL prepare failed: ' . $conn->error);
    }

    $stmt->bind_param(
        'iissssis',
        $intakeId,
        $uploadedByUserId,
        $filename,
        $storedPath,
        $storedFileRef,
        $mimeType,
        $sizeBytes,
        $sha256
    );

    if (!$stmt->execute()) {
        throw new Exception('Client intake form attachment insert failed: ' . $stmt->error);
    }
    $stmt->close();
}

function intake_save_consents_attachment(
    mysqli $conn,
    int $intakeId,
    int $uploadedByUserId,
    array $payload,
    string $childLegalName,
    bool $driveEnabled,
    ?string $clientDriveFolderId,
    array &$savedLocalFiles,
    array &$driveFallbacks,
    array &$driveErrors
): void {
    $folderName = intake_client_folder_name($intakeId, $childLegalName);
    $storedPath = '';
    $storedFileRef = '';
    $savedToDrive = false;

    $pdfDecoded = function_exists('intake_build_consent_form_pdf')
        ? intake_build_consent_form_pdf($intakeId, $payload, $childLegalName)
        : null;

    if ($pdfDecoded) {
        $filename = $pdfDecoded['filename'];
        $mimeType = $pdfDecoded['mime_type'];
        $content = $pdfDecoded['content'];
        $sizeBytes = $pdfDecoded['sizeBytes'];
        $sha256 = $pdfDecoded['sha256'];
    } else {
        $html = function_exists('intake_build_consent_pages_html')
            ? intake_build_consent_pages_html($payload, $childLegalName, $intakeId)
            : '';
        if ($html === '') {
            return;
        }
        $filename = 'client_intake_consents.html';
        $mimeType = 'text/html';
        $content = $html;
        $sizeBytes = strlen($html);
        $sha256 = hash('sha256', $html);
        if ($sha256 === false) {
            throw new Exception('Failed to hash client intake consents document.');
        }
    }

    if (
        $driveEnabled &&
        $clientDriveFolderId &&
        function_exists('uploadFileContentToDrive')
    ) {
        try {
            if (!function_exists('getGoogleDriveClient') || !getGoogleDriveClient()) {
                throw new Exception('Drive OAuth client unavailable.');
            }

            $useSharedDrive = function_exists('isSharedDriveEnabled') && isSharedDriveEnabled();
            $driveResult = uploadFileContentToDrive(
                $content,
                $filename,
                $mimeType,
                $clientDriveFolderId,
                $useSharedDrive
            );
            if (!$driveResult || !isset($driveResult['fileId'])) {
                throw new Exception('uploadFileContentToDrive failed for consents document');
            }

            $storedPath = 'drive://' . $clientDriveFolderId;
            $storedFileRef = $driveResult['fileId'];
            $savedToDrive = true;
        } catch (Throwable $e) {
            $driveFallbacks[] = 'CONSENT_FORM';
            $driveErrors[] = [
                'type' => 'CONSENT_FORM',
                'error' => $e->getMessage(),
            ];
            error_log(
                "Drive client intake consents upload failed; falling back to local. intake_id={$intakeId} err="
                . $e->getMessage()
            );
        }
    } elseif ($driveEnabled && !$clientDriveFolderId) {
        $driveFallbacks[] = 'CONSENT_FORM';
    }

    if (!$savedToDrive) {
        $dirAbs = __DIR__ . '/uploads/' . $folderName;
        if (!is_dir($dirAbs) && !mkdir($dirAbs, 0755, true)) {
            throw new Exception('Failed to create upload directory for client intake consents.');
        }

        $destAbs = rtrim($dirAbs, '/\\') . DIRECTORY_SEPARATOR . $filename;
        if (file_put_contents($destAbs, $content) === false) {
            throw new Exception('Failed to save client intake consents locally.');
        }

        $savedLocalFiles[] = $destAbs;
        $storedPath = 'uploads/' . $folderName;
        $storedFileRef = $filename;
    }

    $sql = "
        INSERT INTO ClientIntakeAttachments
            (intake_id, uploaded_by_user_id, attachment_type,
             original_filename, stored_path, stored_filename,
             mime_type, size_bytes, sha256, created_at)
        VALUES (?, ?, 'CONSENT_FORM', ?, ?, ?, ?, ?, ?, NOW())
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Client intake consents attachment SQL prepare failed: ' . $conn->error);
    }

    $stmt->bind_param(
        'iissssis',
        $intakeId,
        $uploadedByUserId,
        $filename,
        $storedPath,
        $storedFileRef,
        $mimeType,
        $sizeBytes,
        $sha256
    );

    if (!$stmt->execute()) {
        throw new Exception('Client intake consents attachment insert failed: ' . $stmt->error);
    }
    $stmt->close();
}

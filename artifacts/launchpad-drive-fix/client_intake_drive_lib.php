<?php
/**
 * Google Drive layout + completed-form export for client intake packets.
 */

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

function intake_client_parent_folder_id(bool $useSharedDrive): ?string {
    if (!function_exists('intake_sanitize_drive_folder_id')) {
        return null;
    }

    $intakeRoot = intake_sanitize_drive_folder_id(getenv('GOOGLE_DRIVE_CLIENT_INTAKE_FOLDER_ID'));
    if ($intakeRoot) {
        return $intakeRoot;
    }

    $rootFolderId = function_exists('getDriveRootFolderId') ? intake_sanitize_drive_folder_id(getDriveRootFolderId()) : null;
    if ($rootFolderId && function_exists('getOrCreateDriveFolder')) {
        $parent = getOrCreateDriveFolder('client_intake', $rootFolderId, $useSharedDrive);
        if ($parent) {
            return $parent;
        }
    }

    return intake_sanitize_drive_folder_id(getenv('GOOGLE_DRIVE_SIGNED_OFFERS_FOLDER_ID'));
}

function intake_get_or_create_client_folder(int $intakeId, string $childLegalName, bool $useSharedDrive): ?string {
    if (!function_exists('getOrCreateDriveFolder')) {
        return null;
    }

    $parentId = intake_client_parent_folder_id($useSharedDrive);
    if (!$parentId) {
        return null;
    }

    $folderName = intake_client_folder_name($intakeId, $childLegalName);
    return getOrCreateDriveFolder($folderName, $parentId, $useSharedDrive);
}

function intake_html_escape($value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function intake_form_row(string $label, $value): string {
    $text = trim((string)$value);
    if ($text === '') {
        $text = '—';
    }
    return '<tr><th style="text-align:left;width:34%;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;">'
        . intake_html_escape($label)
        . '</th><td style="padding:8px 12px;border:1px solid #e2e8f0;">'
        . nl2br(intake_html_escape($text))
        . '</td></tr>';
}

function intake_build_completed_form_html(int $intakeId, array $payload, string $childLegalName): string {
    $conditions = is_array($payload['conditions'] ?? null) ? $payload['conditions'] : [];
    $conditionLabels = [];
    foreach ($conditions as $key => $checked) {
        if ($checked) {
            $conditionLabels[] = ucfirst((string)$key);
        }
    }

    $medicationsHtml = '';
    $medications = is_array($payload['medications'] ?? null) ? $payload['medications'] : [];
    $medRows = [];
    foreach ($medications as $med) {
        if (!is_array($med)) {
            continue;
        }
        $name = trim((string)($med['name'] ?? ''));
        $dosage = trim((string)($med['dosageAdminTime'] ?? ''));
        $start = trim((string)($med['startDate'] ?? ''));
        $indication = trim((string)($med['indication'] ?? ''));
        if ($name === '' && $dosage === '' && $start === '' && $indication === '') {
            continue;
        }
        $medRows[] = '<li><strong>' . intake_html_escape($name !== '' ? $name : 'Medication') . '</strong>'
            . ' — Dosage/time: ' . intake_html_escape($dosage !== '' ? $dosage : '—')
            . '; Start: ' . intake_html_escape($start !== '' ? $start : '—')
            . '; Indication: ' . intake_html_escape($indication !== '' ? $indication : '—')
            . '</li>';
    }
    if (!empty($medRows)) {
        $medicationsHtml = '<ul style="margin:0;padding-left:20px;">' . implode('', $medRows) . '</ul>';
    } else {
        $medicationsHtml = '—';
    }

    $preferences = is_array($payload['preferences'] ?? null) ? $payload['preferences'] : [];
    $parentSignature = trim((string)($payload['parentGuardianSignature'] ?? ''));
    $providerSignature = trim((string)($payload['providerSignature'] ?? ''));
    $submittedAt = gmdate('Y-m-d H:i:s') . ' UTC';

    $signatureBlock = function (?string $dataUrl, string $label, string $date) {
        if ($dataUrl === '' || !preg_match('/^data:image\//', $dataUrl)) {
            return '<p><em>No ' . intake_html_escape($label) . ' captured.</em></p>';
        }
        return '<div style="margin-bottom:16px;">'
            . '<p style="margin:0 0 8px;font-weight:600;">' . intake_html_escape($label) . '</p>'
            . '<img src="' . intake_html_escape($dataUrl) . '" alt="' . intake_html_escape($label) . '" style="max-width:320px;border:1px solid #cbd5e1;background:#fff;" />'
            . '<p style="margin:8px 0 0;">Date: ' . intake_html_escape($date !== '' ? $date : '—') . '</p>'
            . '</div>';
    };

    $rows = [
        intake_form_row('Intake ID', (string)$intakeId),
        intake_form_row('Legal name of child', $childLegalName),
        intake_form_row("Child's date of birth", $payload['childDob'] ?? ''),
        intake_form_row('Completed by', $payload['completedBy'] ?? ''),
        intake_form_row("Child's home address", $payload['childHomeAddress'] ?? ''),
        intake_form_row('Telephone (home)', $payload['homePhone'] ?? ''),
        intake_form_row('Telephone (cell)', $payload['cellPhone'] ?? ''),
        intake_form_row("Physician name/location", $payload['physicianNameLocation'] ?? ''),
        intake_form_row("Neurologist name/location", $payload['neurologistNameLocation'] ?? ''),
        intake_form_row('Family composition', $payload['familyComposition'] ?? ''),
        intake_form_row('Goals for therapy', $payload['therapyGoals'] ?? ''),
        intake_form_row('Preferred schedule', $payload['preferredSchedule'] ?? ''),
        intake_form_row('Preferred edible items', $preferences['edible'] ?? ''),
        intake_form_row('Preferred tangible items', $preferences['tangible'] ?? ''),
        intake_form_row('Preferred social items', $preferences['social'] ?? ''),
        intake_form_row('Preferred activities', $preferences['activity'] ?? ''),
        intake_form_row('Diagnosis', $payload['diagnosis'] ?? ''),
        intake_form_row('Medical conditions', $payload['medicalConditions'] ?? ''),
        intake_form_row('Special diet', $payload['specialDiet'] ?? ''),
        intake_form_row('Applicable conditions', !empty($conditionLabels) ? implode(', ', $conditionLabels) : '—'),
        intake_form_row('Condition details', $payload['conditionDetails'] ?? ''),
        intake_form_row('School name', $payload['schoolName'] ?? ''),
        intake_form_row('Grade', $payload['grade'] ?? ''),
        intake_form_row("Teacher(s)", $payload['teachers'] ?? ''),
        intake_form_row('Classroom type', $payload['classroomType'] ?? ''),
        intake_form_row('School address', $payload['schoolAddress'] ?? ''),
        intake_form_row('School hours', $payload['schoolHours'] ?? ''),
        intake_form_row('Transportation', $payload['transportation'] ?? ''),
        intake_form_row('Supportive therapies', $payload['supportiveTherapies'] ?? ''),
        intake_form_row('Previous ABA therapy', $payload['previousAbaTherapy'] ?? ''),
        intake_form_row('Caregiver guidelines accepted', !empty($payload['caregiverGuidelinesAccepted']) ? 'Yes' : 'No'),
        intake_form_row('Submitted at', $submittedAt),
    ];

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />'
        . '<title>Client Intake — ' . intake_html_escape($childLegalName) . '</title>'
        . '<style>@media print { body { margin: 0.5in; } }</style></head><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5;">'
        . '<header style="margin-bottom:24px;border-bottom:3px solid #0d9488;padding-bottom:12px;">'
        . '<p style="margin:0;color:#0d9488;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Maha Behavioral Health Services</p>'
        . '<h1 style="margin:8px 0 0;font-size:24px;">Client Intake Packet</h1>'
        . '<p style="margin:4px 0 0;color:#475569;">' . intake_html_escape(intake_client_folder_name($intakeId, $childLegalName)) . '</p>'
        . '</header>'
        . '<table style="width:100%;border-collapse:collapse;margin-bottom:28px;">' . implode('', $rows) . '</table>'
        . '<section><h2 style="font-size:18px;margin:0 0 12px;">Medications</h2>' . $medicationsHtml . '</section>'
        . '<section style="margin-top:28px;"><h2 style="font-size:18px;margin:0 0 12px;">Signatures</h2>'
        . $signatureBlock($parentSignature, 'Parent / Guardian', (string)($payload['parentGuardianSignatureDate'] ?? ''))
        . $signatureBlock($providerSignature, 'MBHS Behavior Analysis Provider', (string)($payload['providerSignatureDate'] ?? ''))
        . '</section></body></html>';
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
    $html = intake_build_completed_form_html($intakeId, $payload, $childLegalName);
    $filename = 'client_intake_form.html';
    $folderName = intake_client_folder_name($intakeId, $childLegalName);
    $storedPath = '';
    $storedFileRef = $filename;
    $savedToDrive = false;
    $sizeBytes = strlen($html);
    $sha256 = hash('sha256', $html);
    if ($sha256 === false) {
        throw new Exception('Failed to hash completed client intake form.');
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
                $html,
                $filename,
                'text/html',
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
    }

    if (!$savedToDrive) {
        $dirAbs = __DIR__ . '/uploads/' . $folderName;
        if (!is_dir($dirAbs) && !mkdir($dirAbs, 0755, true)) {
            throw new Exception('Failed to create upload directory for client intake form.');
        }

        $destAbs = rtrim($dirAbs, '/\\') . DIRECTORY_SEPARATOR . $filename;
        if (file_put_contents($destAbs, $html) === false) {
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
        VALUES (?, ?, 'COMPLETED_FORM', ?, ?, ?, 'text/html', ?, ?, NOW())
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Client intake form attachment SQL prepare failed: ' . $conn->error);
    }

    $stmt->bind_param(
        'iisssis',
        $intakeId,
        $uploadedByUserId,
        $filename,
        $storedPath,
        $storedFileRef,
        $sizeBytes,
        $sha256
    );

    if (!$stmt->execute()) {
        throw new Exception('Client intake form attachment insert failed: ' . $stmt->error);
    }
    $stmt->close();
}

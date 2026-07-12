<?php
/**
 * Official-style Client Intake Packet HTML (matches docs/1.Maha_Client Intake information.pdf).
 */

function intake_form_val($value): string {
    $text = trim((string)$value);
    return $text === '' ? '&nbsp;' : nl2br(intake_html_escape($text));
}

function intake_form_line_field(string $label, $value, string $width = '100%'): string {
    return '<div class="field" style="width:' . $width . '">'
        . '<div class="label">' . intake_html_escape($label) . '</div>'
        . '<div class="line">' . intake_form_val($value) . '</div>'
        . '</div>';
}

function intake_form_section_header(string $title): string {
    return intake_form_brand_header()
        . '<h2 class="section-title">' . intake_html_escape($title) . '</h2>';
}

function intake_form_brand_header(): string {
    return '<div class="brand">'
        . '<div class="brand-name">Maha Behavioral Health Services</div>'
        . '<div class="brand-tagline">Engage, Empower, Excel</div>'
        . '</div>';
}

function intake_form_checkbox(string $label, bool $checked): string {
    $box = $checked ? '☑' : '☐';
    return '<span class="checkbox-item"><span class="box">' . $box . '</span> ' . intake_html_escape($label) . '</span>';
}

function intake_build_completed_form_html(int $intakeId, array $payload, string $childLegalName): string {
    if (!function_exists('intake_build_consent_pages_for_intake_html')) {
        require_once __DIR__ . '/client_intake_consent_html.php';
    }

    $conditions = is_array($payload['conditions'] ?? null) ? $payload['conditions'] : [];
    $preferences = is_array($payload['preferences'] ?? null) ? $payload['preferences'] : [];
    $medications = is_array($payload['medications'] ?? null) ? $payload['medications'] : [];

    $parentSignature = trim((string)($payload['parentGuardianSignature'] ?? ''));
    $providerSignature = trim((string)($payload['providerSignature'] ?? ''));
    $parentDate = trim((string)($payload['parentGuardianSignatureDate'] ?? ''));
    $providerDate = trim((string)($payload['providerSignatureDate'] ?? ''));
    $guidelinesAccepted = !empty($payload['caregiverGuidelinesAccepted']);

    $medRowsHtml = '';
    $hasMeds = false;
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
        $hasMeds = true;
        $medRowsHtml .= '<tr>'
            . '<td>' . intake_form_val($name) . '</td>'
            . '<td>' . intake_form_val($dosage) . '</td>'
            . '<td>' . intake_form_val($start) . '</td>'
            . '<td>' . intake_form_val($indication) . '</td>'
            . '</tr>';
    }
    if (!$hasMeds) {
        $medRowsHtml = '<tr><td colspan="4" class="empty">None reported</td></tr>';
    }

    $signatureImg = function (?string $dataUrl) {
        if ($dataUrl !== '' && preg_match('/^data:image\//', $dataUrl)) {
            return '<img src="' . intake_html_escape($dataUrl) . '" alt="Signature" class="signature-img" />';
        }
        return '<span class="signature-placeholder">&nbsp;</span>';
    };

    $css = <<<'CSS'
@page { margin: 0.55in; }
body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #111; line-height: 1.35; margin: 0; }
.page { page-break-after: always; padding: 0; }
.page:last-child { page-break-after: auto; }
.brand { text-align: center; margin-bottom: 10px; }
.brand-name { font-size: 14pt; font-weight: bold; }
.brand-tagline { font-size: 11pt; font-style: italic; margin-top: 2px; }
.doc-title { text-align: center; font-size: 13pt; font-weight: bold; margin: 8px 0 12px; }
.intro { font-size: 10.5pt; margin-bottom: 14px; text-align: justify; }
.section-title { font-size: 12pt; font-weight: bold; margin: 0 0 10px; border-bottom: 1px solid #333; padding-bottom: 4px; }
.q { margin: 0 0 10px; }
.q-num { font-weight: bold; }
.field-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.field { margin-bottom: 8px; }
.label { font-size: 10.5pt; margin-bottom: 2px; }
.line { min-height: 18px; border-bottom: 1px solid #111; padding: 2px 0 1px; }
.block { min-height: 48px; border-bottom: 1px solid #111; padding: 4px 0; margin-bottom: 8px; }
.pref-table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; }
.pref-table th, .pref-table td { border: 1px solid #333; padding: 6px; vertical-align: top; width: 25%; }
.pref-table th { font-weight: bold; background: #f5f5f5; }
.med-table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 10pt; }
.med-table th, .med-table td { border: 1px solid #333; padding: 5px; vertical-align: top; }
.med-table th { background: #f5f5f5; font-weight: bold; }
.checkbox-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
.checkbox-table td { font-size: 10.5pt; padding: 3px 8px 3px 0; vertical-align: top; width: 33%; }
.checkbox-item { font-size: 10.5pt; }
.box { font-family: DejaVu Sans, sans-serif; }
.guidelines { font-size: 10pt; margin: 0; padding-left: 18px; }
.guidelines li { margin-bottom: 6px; }
.sick-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 6px 0 0 18px; }
.sick-table td { padding: 1px 10px 1px 0; vertical-align: top; width: 33%; }
.sig-block { margin-top: 18px; }
.sig-table { width: 100%; border-collapse: collapse; margin-top: 14px; }
.sig-table td { vertical-align: bottom; padding: 0 8px 0 0; }
.sig-line { border-bottom: 1px solid #111; min-height: 52px; padding-bottom: 2px; }
.sig-caption { font-size: 10pt; margin-top: 4px; }
.signature-img { max-height: 48px; max-width: 280px; }
.meta { font-size: 9pt; color: #444; margin-top: 8px; }
.empty { color: #666; font-style: italic; }
.consent-section { margin-bottom: 14px; }
.consent-title { font-size: 11pt; font-weight: bold; margin: 0 0 6px; text-transform: uppercase; }
.consent-body { margin: 0 0 6px; text-align: justify; font-size: 10pt; }
.consent-check { margin: 0; font-weight: bold; font-size: 10pt; }
.accepted { color: #0f5132; }
.declined { color: #842029; }
.child-line { margin: 12px 0 16px; font-size: 10.5pt; }
CSS;

    $html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />'
        . '<title>Client Intake Packet — ' . intake_html_escape($childLegalName) . '</title>'
        . '<style>' . $css . '</style></head><body>';

    // Page 1 — Demographic
    $html .= '<div class="page">';
    $html .= intake_form_brand_header();
    $html .= '<div class="doc-title">Client Intake Packet</div>';
    $html .= '<p class="intro">This questionnaire is to be completed by the child\'s parent or legal guardian so that '
        . 'Maha Behavioral Health Services (MBHS) may learn essential information about your child for use in treatment planning. '
        . 'Maha Behavioral Health Services will ensure that any information provided by you is kept confidential according to HIPAA guidelines. '
        . 'Please contact the behavior analyst if you have any questions when completing this form. Please use the back of the page if you need more space.</p>';
    $html .= intake_form_section_header('Demographic/Biopsychosocial Information');

    $html .= '<p class="q"><span class="q-num">1.</span> Legal name of child: '
        . '<span class="line" style="display:inline-block;min-width:220px;">' . intake_form_val($childLegalName) . '</span>'
        . ' &nbsp; Child\'s DOB: <span class="line" style="display:inline-block;min-width:100px;">' . intake_form_val($payload['childDob'] ?? '') . '</span></p>';

    $html .= '<p class="q"><span class="q-num">2.</span> Name of Person Completing this form:</p>'
        . '<div class="line">' . intake_form_val($payload['completedBy'] ?? '') . '</div>';

    $html .= '<p class="q"><span class="q-num">3.</span> Child\'s Home Address:</p>'
        . '<div class="block">' . intake_form_val($payload['childHomeAddress'] ?? '') . '</div>';

    $html .= '<p class="q"><span class="q-num">4.</span> Telephone Number: '
        . '<span class="line" style="display:inline-block;min-width:140px;">' . intake_form_val($payload['homePhone'] ?? '') . '</span> (home) '
        . '<span class="line" style="display:inline-block;min-width:140px;">' . intake_form_val($payload['cellPhone'] ?? '') . '</span> (cell)</p>';

    $html .= '<p class="q"><span class="q-num">5.</span> Child\'s physician\'s name/location:</p>'
        . '<div class="block">' . intake_form_val($payload['physicianNameLocation'] ?? '') . '</div>';

    $html .= '<p class="q"><span class="q-num">6.</span> Child\'s neurologist\'s name/location:</p>'
        . '<div class="block">' . intake_form_val($payload['neurologistNameLocation'] ?? '') . '</div>';

    $html .= '<p class="q"><span class="q-num">7.</span> Describe family composition (including siblings/ages, and others living in the home):</p>'
        . '<div class="block" style="min-height:72px;">' . intake_form_val($payload['familyComposition'] ?? '') . '</div>';
    $html .= '</div>';

    // Page 2 — General
    $html .= '<div class="page">';
    $html .= intake_form_section_header('General Information');

    $html .= '<p class="q"><span class="q-num">8.</span> Please indicate your goals for therapy?</p>'
        . '<div class="block" style="min-height:72px;">' . intake_form_val($payload['therapyGoals'] ?? '') . '</div>';

    $html .= '<p class="q"><span class="q-num">9.</span> Please indicate your preferred days/times for therapy (weekdays/weekends). '
        . 'Note that behavior therapy is most effective when implemented continuously and frequently.</p>'
        . '<div class="block" style="min-height:56px;">' . intake_form_val($payload['preferredSchedule'] ?? '') . '</div>';

    $html .= '<p class="q"><span class="q-num">10.</span> Please indicate items that your child prefers (approaches and/or engages with consistently and independently) in each category below:</p>';
    $html .= '<table class="pref-table"><thead><tr>'
        . '<th>Edible (e.g., chips)</th><th>Tangible (e.g., balls)</th><th>Social (e.g., tickles)</th><th>Activity (e.g., swim)</th>'
        . '</tr></thead><tbody><tr>'
        . '<td>' . intake_form_val($preferences['edible'] ?? '') . '</td>'
        . '<td>' . intake_form_val($preferences['tangible'] ?? '') . '</td>'
        . '<td>' . intake_form_val($preferences['social'] ?? '') . '</td>'
        . '<td>' . intake_form_val($preferences['activity'] ?? '') . '</td>'
        . '</tr></tbody></table>';
    $html .= '</div>';

    // Page 3 — Medical
    $html .= '<div class="page">';
    $html .= intake_form_section_header('Medical History');

    $html .= '<p class="q"><span class="q-num">11.</span> Indicate child\'s diagnosis, including age at diagnosis.</p>'
        . '<div class="block">' . intake_form_val($payload['diagnosis'] ?? '') . '</div>';

    $html .= '<p class="q"><span class="q-num">12.</span> Indicate any medical conditions/serious illnesses (e.g., asthma, recurrent ear infections) experienced by your child.</p>'
        . '<div class="block">' . intake_form_val($payload['medicalConditions'] ?? '') . '</div>';

    $html .= '<p class="q"><span class="q-num">13.</span> Does your child require a special diet? If yes, please describe.</p>'
        . '<div class="block">' . intake_form_val($payload['specialDiet'] ?? '') . '</div>';

    $html .= '<p class="q"><span class="q-num">14.</span> Indicate any medications taken by your child, including dosage, time of administration (e.g., morning), start date, and indication (purpose of medication).</p>';
    $html .= '<table class="med-table"><thead><tr>'
        . '<th>Medication Name</th><th>Dosage/Admin Time</th><th>Start Date</th><th>Indication</th>'
        . '</tr></thead><tbody>' . $medRowsHtml . '</tbody></table>';

    $html .= '<p class="q"><span class="q-num">15.</span> Check any applicable conditions experienced by your child, and provide descriptive information about the conditions below.</p>';
    $html .= '<table class="checkbox-table"><tr>'
        . '<td>' . intake_form_checkbox('Allergies', !empty($conditions['allergies'])) . '</td>'
        . '<td>' . intake_form_checkbox('Vision', !empty($conditions['vision'])) . '</td>'
        . '<td>' . intake_form_checkbox('Hearing', !empty($conditions['hearing'])) . '</td>'
        . '</tr><tr>'
        . '<td>' . intake_form_checkbox('Sleep', !empty($conditions['sleep'])) . '</td>'
        . '<td>' . intake_form_checkbox('Feeding', !empty($conditions['feeding'])) . '</td>'
        . '<td>' . intake_form_checkbox('Sensory', !empty($conditions['sensory'])) . '</td>'
        . '</tr><tr>'
        . '<td>' . intake_form_checkbox('Educational', !empty($conditions['educational'])) . '</td>'
        . '<td colspan="2">' . intake_form_checkbox('Other (e.g., processing disorder)', !empty($conditions['other'])) . '</td>'
        . '</tr></table>';
    $html .= '<div class="block" style="min-height:56px;">' . intake_form_val($payload['conditionDetails'] ?? '') . '</div>';
    $html .= '</div>';

    // Page 4 — Educational
    $html .= '<div class="page">';
    $html .= intake_form_section_header('Educational Information');

    $html .= '<p class="q"><span class="q-num">16.</span> Please provide information about your child\'s current school:</p>';
    $html .= '<p class="q">a. School name: <span class="line" style="display:inline-block;min-width:200px;">' . intake_form_val($payload['schoolName'] ?? '') . '</span>'
        . ' &nbsp; Grade: <span class="line" style="display:inline-block;min-width:80px;">' . intake_form_val($payload['grade'] ?? '') . '</span></p>';
    $html .= '<p class="q">b. Child\'s teacher(s): <span class="line" style="display:inline-block;min-width:280px;">' . intake_form_val($payload['teachers'] ?? '') . '</span></p>';
    $html .= '<p class="q">c. Type of classroom (e.g., self-contained): <span class="line" style="display:inline-block;min-width:220px;">' . intake_form_val($payload['classroomType'] ?? '') . '</span></p>';
    $html .= '<p class="q">d. Address:</p><div class="block">' . intake_form_val($payload['schoolAddress'] ?? '') . '</div>';
    $html .= '<p class="q">e. School hours: <span class="line" style="display:inline-block;min-width:200px;">' . intake_form_val($payload['schoolHours'] ?? '') . '</span></p>';
    $html .= '<p class="q">f. Transportation information (e.g., bus):</p><div class="block">' . intake_form_val($payload['transportation'] ?? '') . '</div>';
    $html .= '<p class="q">g. Please indicate if your child currently receives supportive therapies (e.g., Speech and Language, Occupational?). Please indicate arranged times.</p>'
        . '<div class="block" style="min-height:56px;">' . intake_form_val($payload['supportiveTherapies'] ?? '') . '</div>';

    $html .= '<p class="q"><span class="q-num">17.</span> Has your child received ABA therapy in the past? If yes, please indicate time period and outcomes.</p>'
        . '<div class="block" style="min-height:56px;">' . intake_form_val($payload['previousAbaTherapy'] ?? '') . '</div>';
    $html .= '</div>';

    // Pages 5–6 — Consents & authorizations
    $html .= intake_build_consent_pages_for_intake_html($payload, $childLegalName, $intakeId);

    // Page 7 — Caregiver guidelines
    $html .= '<div class="page">';
    $html .= intake_form_section_header('Caregiver Guidelines');
    $html .= '<p class="intro">The following guidelines are suggested for caregivers during applied behavior therapy. '
        . 'Caregiver participation in therapy is a must, and required by funding sources.</p>';
    $html .= '<ol class="guidelines">'
        . '<li>A parent or responsible adult (over 18 years of age) must be in the home when therapy is being provided.</li>'
        . '<li>Caregivers are expected to participate in therapy sessions. Specifically, caregivers will be trained to implement their child\'s behavior program, and data on the accuracy of their implementation will be collected.</li>'
        . '<li>The area being used for therapy must be clean, of comfortable temperature, and well lit. In some cases, the therapist may ask for distracting stimuli to be removed from the training environment. Caregivers should not smoke in the home when a therapist is present. In addition, pets should be removed from therapy area to the greatest extent possible.</li>'
        . '<li>Therapy may be conducted at home, school, or other environment (i.e., community), and will be allocated to those locations in which the child has the most difficulty.</li>'
        . '<li>The materials and reinforcers used for therapy should be reserved for therapy sessions unless otherwise stated by the therapist.</li>'
        . '<li>The child should be dressed and fed prior to therapist arrival unless these skills are being addressed in the program.</li>'
        . '<li>Caregivers should contact the therapist 24 hours prior to the appointment if they know they are going to cancel a session. If more than 20% of sessions are canceled in a 3-month period, your child may lose his/her therapy slot.</li>'
        . '<li>Sickness. Please give the therapist as much notice as possible prior to the scheduled session if you know that your child is sick. Sickness includes, but not limited to the following:'
        . '<table class="sick-table"><tr>'
        . '<td>Temperature above 100</td><td>Communicable Disease</td><td>Foot/Mouth Disease</td>'
        . '</tr><tr>'
        . '<td>Vomit</td><td>Mumps</td><td>Chicken Pox</td>'
        . '</tr><tr>'
        . '<td>Measles</td><td>Diarrhea</td><td>Pin Worm</td>'
        . '</tr><tr>'
        . '<td>Strep Throat</td><td>Lice</td><td>Rash</td>'
        . '</tr><tr>'
        . '<td colspan="3">Pink Eye</td>'
        . '</tr></table></li>'
        . '<li>If the therapist arrives, and the child is not at home, the therapist will wait 15 minutes before leaving. This will be considered a no-show. More than two no-shows within a 2-month period may result in your child losing his therapy slot.</li>'
        . '<li>A therapist cannot change appointment times without agreement with the family.</li>'
        . '<li>The therapist will give the family as much notice as possible before canceling a session. The therapist will call the family if they are going to be arriving more than 5 min late.</li>'
        . '<li>Please do not call the therapist before 8 am or after 8 pm.</li>'
        . '<li>In case of an accident or unusual incident (e.g., Baker Act, runaway), the family should immediately notify the therapist, who will inform their Regional Director of the event.</li>'
        . '<li>Parents and contractors should be respectful and courteous to each other. Open communication between parents and contractors is essential to the establishment of a successful program for the child.</li>'
        . '<li>If there are any problems or concerns, please contact the Lead Analyst on the case immediately.</li>'
        . '</ol>';
    $html .= '</div>';

    // Page 8 — Signatures
    $html .= '<div class="page">';
    $html .= intake_form_brand_header();
    $html .= '<div class="sig-block">';
    $html .= '<p class="q">I understand and agree to the caregiver guidelines: '
        . ($guidelinesAccepted ? '<strong>Yes</strong>' : '<strong>No</strong>') . '</p>';

    $html .= '<table class="sig-table"><tr>'
        . '<td width="72%"><div class="sig-line">' . $signatureImg($parentSignature) . '</div><div class="sig-caption">Signature of Parent / Guardian</div></td>'
        . '<td width="28%"><div class="sig-line">' . intake_form_val($parentDate) . '</div><div class="sig-caption">Date</div></td>'
        . '</tr></table>';

    $html .= '<table class="sig-table"><tr>'
        . '<td width="72%"><div class="sig-line">' . $signatureImg($providerSignature) . '</div><div class="sig-caption">Signature of MBHS Behavior Analysis Provider</div></td>'
        . '<td width="28%"><div class="sig-line">' . intake_form_val($providerDate) . '</div><div class="sig-caption">Date</div></td>'
        . '</tr></table>';

    $html .= '<p class="meta">Intake ID: ' . (int)$intakeId . ' · Packet: ' . intake_html_escape(intake_client_folder_name($intakeId, $childLegalName)) . '</p>';
    $html .= '</div></div>';

    $html .= '</body></html>';
    return $html;
}

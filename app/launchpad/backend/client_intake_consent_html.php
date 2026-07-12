<?php
/**
 * Consent & authorization pages for client intake (2-page packet).
 */

function intake_consent_sections(): array {
    return [
        [
            'key' => 'consentInformedTreatmentAccepted',
            'title' => 'Informed Consent for Treatment',
            'body' => 'I voluntarily consent to applied behavior analysis and related behavioral health services for my child from Maha Behavioral Health Services (MBHS). I understand the nature of the services proposed, including assessment, treatment planning, direct therapy, caregiver training, and data collection. MBHS staff have explained the anticipated benefits, risks, and alternatives. I understand I may ask questions at any time and may withdraw consent for future services by providing written notice, subject to any contractual or funding-source requirements.',
        ],
        [
            'key' => 'consentReleaseInformationAccepted',
            'title' => 'Authorization to Release Information',
            'body' => 'I authorize MBHS to use and disclose protected health information (PHI) about my child as necessary to provide treatment, obtain payment, and conduct healthcare operations, including coordination with schools, physicians, funding sources, and other providers involved in my child\'s care. I authorize release of records to insurance companies and authorized payers for claims and utilization review. This authorization remains in effect until revoked in writing, except where law requires continued retention or disclosure.',
        ],
        [
            'key' => 'consentAssignmentOfBenefitsAccepted',
            'title' => 'Assignment of Benefits',
            'body' => 'I assign payment of insurance and third-party benefits for services rendered by MBHS directly to Maha Behavioral Health Services. I authorize MBHS to submit claims on my behalf and to accept assignment of benefits from my insurer or other payers. I understand I am financially responsible for any amounts not covered by insurance, including deductibles, co-payments, co-insurance, and non-covered services, unless otherwise prohibited by law or my plan.',
        ],
        [
            'key' => 'consentAdditionalFeesAccepted',
            'title' => 'Authorization for Additional Fees',
            'body' => 'I understand that services such as missed-appointment fees, late-cancellation fees, record-copy fees, travel fees when applicable, and other administrative or clinical fees not covered by insurance may apply according to MBHS policies and my funding source. I authorize MBHS to charge me for applicable fees as disclosed in the financial policy and caregiver guidelines. I agree to maintain current insurance and funding information and to notify MBHS promptly of changes.',
        ],
        [
            'key' => 'consentTreatmentAuthorizationAccepted',
            'title' => 'Authorization for Treatment',
            'body' => 'I authorize MBHS providers to evaluate and treat my child, implement behavior-analytic and related interventions, and modify the treatment plan as clinically indicated with my participation. I agree to participate in caregiver training and to implement agreed-upon strategies between sessions when requested. I confirm that I am the parent or legal guardian authorized to consent to treatment for this child and that the information provided in this intake packet is accurate to the best of my knowledge.',
        ],
    ];
}

function intake_consent_accepted(array $payload, string $key): bool {
    return !empty($payload[$key]);
}

function intake_consent_acceptance_line(array $payload, string $key): string {
    return intake_consent_accepted($payload, $key)
        ? '<span class="accepted">☑ I have read and agree</span>'
        : '<span class="declined">☐ Not accepted</span>';
}

function intake_consent_section_html(array $section, array $payload): string {
    $key = (string)$section['key'];
    return '<section class="consent-section">'
        . '<h3 class="consent-title">' . intake_html_escape($section['title']) . '</h3>'
        . '<p class="consent-body">' . intake_html_escape($section['body']) . '</p>'
        . '<p class="consent-check">' . intake_consent_acceptance_line($payload, $key) . '</p>'
        . '</section>';
}

function intake_consent_document_css(): string {
    return <<<'CSS'
@page { margin: 0.55in; }
body { font-family: "Times New Roman", Times, serif; font-size: 10.5pt; color: #111; line-height: 1.4; margin: 0; }
.page { page-break-after: always; padding: 0; }
.page:last-child { page-break-after: auto; }
.brand { text-align: center; margin-bottom: 10px; }
.brand-name { font-size: 14pt; font-weight: bold; }
.brand-tagline { font-size: 11pt; font-style: italic; margin-top: 2px; }
.doc-title { text-align: center; font-size: 12pt; font-weight: bold; margin: 8px 0 14px; }
.consent-section { margin-bottom: 14px; }
.consent-title { font-size: 11pt; font-weight: bold; margin: 0 0 6px; text-transform: uppercase; }
.consent-body { margin: 0 0 6px; text-align: justify; }
.consent-check { margin: 0; font-weight: bold; font-size: 10pt; }
.accepted { color: #0f5132; }
.declined { color: #842029; }
.child-line { margin: 12px 0 16px; font-size: 10.5pt; }
CSS;
}

function intake_build_consent_pages_html(array $payload, string $childLegalName, int $intakeId = 0): string {
    $sections = intake_consent_sections();
    $pageOne = array_slice($sections, 0, 2);
    $pageTwo = array_slice($sections, 2);

    $html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />'
        . '<title>Client Intake Consents — ' . intake_html_escape($childLegalName) . '</title>'
        . '<style>' . intake_consent_document_css() . '</style></head><body>';

    $html .= '<div class="page">' . intake_form_brand_header()
        . '<div class="doc-title">Consents &amp; Authorizations</div>'
        . '<p class="child-line"><strong>Child:</strong> ' . intake_form_val($childLegalName)
        . ' &nbsp; <strong>DOB:</strong> ' . intake_form_val($payload['childDob'] ?? '') . '</p>';
    foreach ($pageOne as $section) {
        $html .= intake_consent_section_html($section, $payload);
    }
    $html .= '</div>';

    $html .= '<div class="page">' . intake_form_brand_header()
        . '<div class="doc-title">Consents &amp; Authorizations (continued)</div>';
    foreach ($pageTwo as $section) {
        $html .= intake_consent_section_html($section, $payload);
    }
    if ($intakeId > 0) {
        $html .= '<p style="font-size:9pt;color:#444;margin-top:12px;">Intake ID: ' . (int)$intakeId . '</p>';
    }
    $html .= '</div></body></html>';

    return $html;
}

function intake_all_consents_accepted(array $payload): bool {
    foreach (intake_consent_sections() as $section) {
        if (!intake_consent_accepted($payload, (string)$section['key'])) {
            return false;
        }
    }
    return true;
}

function intake_missing_consent_labels(array $payload): array {
    $missing = [];
    foreach (intake_consent_sections() as $section) {
        if (!intake_consent_accepted($payload, (string)$section['key'])) {
            $missing[] = (string)$section['title'];
        }
    }
    return $missing;
}

function intake_build_consent_pages_for_intake_html(array $payload, string $childLegalName, int $intakeId = 0): string {
    $sections = intake_consent_sections();
    $pageOne = array_slice($sections, 0, 2);
    $pageTwo = array_slice($sections, 2);

    $html = '<div class="page">' . intake_form_brand_header()
        . '<div class="doc-title">Consents &amp; Authorizations</div>'
        . '<p class="child-line"><strong>Child:</strong> ' . intake_form_val($childLegalName)
        . ' &nbsp; <strong>DOB:</strong> ' . intake_form_val($payload['childDob'] ?? '') . '</p>';
    foreach ($pageOne as $section) {
        $html .= intake_consent_section_html($section, $payload);
    }
    $html .= '</div>';

    $html .= '<div class="page">' . intake_form_brand_header()
        . '<div class="doc-title">Consents &amp; Authorizations (continued)</div>';
    foreach ($pageTwo as $section) {
        $html .= intake_consent_section_html($section, $payload);
    }
    if ($intakeId > 0) {
        $html .= '<p class="meta">Intake ID: ' . (int)$intakeId . '</p>';
    }
    $html .= '</div>';

    return $html;
}

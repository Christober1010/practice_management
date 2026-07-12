<?php
/**
 * Convert official client intake HTML to PDF (dompdf).
 */

function intake_load_dompdf_autoloader(): bool {
    static $loaded = null;
    if ($loaded !== null) {
        return $loaded;
    }

    $candidates = [
        __DIR__ . '/../vendor/autoload.php',
        __DIR__ . '/vendor/autoload.php',
    ];

    foreach ($candidates as $path) {
        if (is_file($path)) {
            require_once $path;
            $loaded = class_exists('Dompdf\\Dompdf');
            return $loaded;
        }
    }

    $loaded = false;
    return false;
}

function intake_html_to_pdf(string $html): ?string {
    if (!intake_load_dompdf_autoloader() || !class_exists('Dompdf\\Dompdf')) {
        return null;
    }

    try {
        $options = new Dompdf\Options();
        $options->set('isRemoteEnabled', false);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('defaultFont', 'Times-Roman');

        $dompdf = new Dompdf\Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('letter', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    } catch (Throwable $e) {
        error_log('Client intake PDF generation failed: ' . $e->getMessage());
        return null;
    }
}

function intake_build_consent_form_pdf(int $intakeId, array $payload, string $childLegalName): ?array {
    if (!function_exists('intake_build_consent_pages_html')) {
        return null;
    }

    $html = intake_build_consent_pages_html($payload, $childLegalName, $intakeId);
    $pdfData = intake_html_to_pdf($html);
    if ($pdfData === null || $pdfData === '') {
        return null;
    }

    if (strncmp($pdfData, '%PDF-', 5) !== 0) {
        return null;
    }

    $sha256 = hash('sha256', $pdfData);
    if ($sha256 === false) {
        throw new Exception('Failed to hash client intake consents PDF.');
    }

    return [
        'content' => $pdfData,
        'filename' => 'client_intake_consents.pdf',
        'mime_type' => 'application/pdf',
        'sizeBytes' => strlen($pdfData),
        'sha256' => $sha256,
    ];
}

function intake_build_completed_form_pdf(int $intakeId, array $payload, string $childLegalName): ?array {
    if (!function_exists('intake_build_completed_form_html')) {
        return null;
    }

    $html = intake_build_completed_form_html($intakeId, $payload, $childLegalName);
    $pdfData = intake_html_to_pdf($html);
    if ($pdfData === null || $pdfData === '') {
        return null;
    }

    if (strncmp($pdfData, '%PDF-', 5) !== 0) {
        return null;
    }

    $maxBytes = 12 * 1024 * 1024;
    if (strlen($pdfData) > $maxBytes) {
        return null;
    }

    $sha256 = hash('sha256', $pdfData);
    if ($sha256 === false) {
        throw new Exception('Failed to hash completed client intake PDF.');
    }

    return [
        'content' => $pdfData,
        'filename' => 'client_intake_form.pdf',
        'mime_type' => 'application/pdf',
        'sizeBytes' => strlen($pdfData),
        'sha256' => $sha256,
    ];
}

function intake_decode_completed_form_pdf(array $payload): ?array {
    $raw = trim((string)($payload['completedFormPdf'] ?? ''));
    if ($raw === '') {
        return null;
    }

    $base64 = $raw;
    if (preg_match('/^data:application\/pdf;base64,(.+)$/i', $raw, $matches)) {
        $base64 = $matches[1];
    }

    $pdfData = base64_decode($base64, true);
    if ($pdfData === false || $pdfData === '') {
        return null;
    }

    if (strncmp($pdfData, '%PDF-', 5) !== 0) {
        return null;
    }

    $maxBytes = 12 * 1024 * 1024;
    if (strlen($pdfData) > $maxBytes) {
        return null;
    }

    $sha256 = hash('sha256', $pdfData);
    if ($sha256 === false) {
        throw new Exception('Failed to hash completed form PDF.');
    }

    return [
        'content' => $pdfData,
        'filename' => 'client_intake_form.pdf',
        'mime_type' => 'application/pdf',
        'sizeBytes' => strlen($pdfData),
        'sha256' => $sha256,
    ];
}

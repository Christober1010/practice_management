<?php
/**
 * Verify dompdf is available for server-side client intake PDF generation.
 */
header('Content-Type: application/json');

require_once __DIR__ . '/client_intake_pdf.php';

$autoloadPaths = [
    __DIR__ . '/../vendor/autoload.php',
    __DIR__ . '/vendor/autoload.php',
];

$autoloadFound = null;
foreach ($autoloadPaths as $path) {
    if (is_file($path)) {
        $autoloadFound = $path;
        break;
    }
}

$result = [
    'autoload' => $autoloadFound,
    'dompdf_class' => class_exists('Dompdf\\Dompdf'),
    'ext_dom' => extension_loaded('dom'),
    'ext_mbstring' => extension_loaded('mbstring'),
    'can_generate_pdf' => false,
];

if (!$result['dompdf_class'] && $autoloadFound) {
    require_once $autoloadFound;
    $result['dompdf_class'] = class_exists('Dompdf\\Dompdf');
}

$result['can_generate_pdf'] = $result['dompdf_class'] && $result['ext_dom'] && $result['ext_mbstring'];

if ($result['can_generate_pdf']) {
    $sample = intake_build_completed_form_pdf(0, [
        'childDob' => '2020-01-01',
        'completedBy' => 'Test',
        'childHomeAddress' => '123 Main',
        'caregiverGuidelinesAccepted' => true,
        'preferences' => [],
        'conditions' => [],
        'medications' => [],
    ], 'Sample Child');
    $result['sample_pdf_bytes'] = $sample ? $sample['sizeBytes'] : null;
    $result['sample_ok'] = $sample !== null;
} else {
    $result['hint'] = 'Run composer install in app/launchpad and upload vendor/ to the server, or rely on client-generated PDF from the Launchpad frontend.';
}

echo json_encode($result, JSON_PRETTY_PRINT);

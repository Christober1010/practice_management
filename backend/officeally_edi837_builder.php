<?php
/**
 * Build X12 837P batch files for Office Ally SFTP upload.
 */

require_once __DIR__ . '/edi837_helpers.php';
require_once __DIR__ . '/officeally_config_helper.php';

/**
 * @param array<int, array{payload: array}> $builtClaims
 */
function officeally_build_837_from_claims(array $builtClaims, array $config): string
{
    $gsSender = (string)$config['gs_sender_code'] !== ''
        ? (string)$config['gs_sender_code']
        : (string)$config['isa_sender_id'];

    $config['gs_sender_code'] = $gsSender;
    $config['receiver_name'] = $config['receiver_name'] ?? 'OFFICE ALLY';
    $config['clearinghouse_label'] = 'Office Ally';

    $isaSenderQual = strtoupper(substr((string)($config['isa_sender_qualifier'] ?? 'ZZ'), 0, 2)) ?: 'ZZ';
    $isaReceiverQual = strtoupper(substr((string)($config['isa_receiver_qualifier'] ?? 'ZZ'), 0, 2)) ?: 'ZZ';
    $isaSender = edi837_pad((string)$config['isa_sender_id'], 15);
    $receiver = edi837_pad((string)$config['receiver_id'], 15);
    $gsReceiver = edi837_sanitize((string)($config['gs_receiver_code'] ?? 'OA'), 15) ?: 'OA';

    $built = edi837_build_st_se_segments($builtClaims, $config);
    $transactionBody = implode('', $built['segments']);
    $control = $built['control'];
    $nowIso = $built['now_iso'];
    $gsControl = '1';

    // Companion guide: ISA15 is P; test files are flagged with OATEST in the filename.
    $isa = edi837_segment('ISA', [
        '00', edi837_pad('', 10),
        '00', edi837_pad('', 10),
        $isaSenderQual, $isaSender,
        $isaReceiverQual, $receiver,
        edi837_date6($nowIso), edi837_time4($nowIso), '^', '00501', $control, '0', 'P', ':',
    ]);

    $gs = edi837_segment('GS', [
        'HC',
        trim($gsSender),
        $gsReceiver,
        edi837_date8($nowIso),
        edi837_time4($nowIso),
        $gsControl,
        'X',
        '005010X222A1',
    ]);
    $ge = edi837_segment('GE', ['1', $gsControl]);
    $iea = edi837_segment('IEA', ['1', $control]);

    return $isa . $gs . $transactionBody . $ge . $iea;
}

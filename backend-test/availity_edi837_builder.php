<?php
/**
 * Build X12 837P (professional) batch files for Availity SFTP upload.
 */

require_once __DIR__ . '/edi837_helpers.php';
require_once __DIR__ . '/availity_config_helper.php';

/**
 * @param array<int, array{payload: array}> $builtClaims
 */
function availity_build_837_from_claims(array $builtClaims, array $config): string
{
    $config['receiver_name'] = $config['receiver_name'] ?? 'AVAILITY';
    $config['clearinghouse_label'] = 'Availity';

    $isaSender = edi837_pad((string)$config['isa_sender_id'], 10);
    $isaPassword = edi837_pad((string)$config['isa_password'], 10);
    $gsSender = edi837_pad((string)$config['gs_sender_code'], 15);
    $receiver = edi837_pad((string)$config['receiver_id'], 15);
    $usage = strtoupper((string)$config['usage_indicator']) === 'P' ? 'P' : 'T';

    $built = edi837_build_st_se_segments($builtClaims, $config);
    $transactionBody = implode('', $built['segments']);
    $control = $built['control'];
    $nowIso = $built['now_iso'];
    $gsControl = '1';

    $isa = edi837_segment('ISA', [
        '00', edi837_pad('', 10), '03', $isaPassword, '01', edi837_pad('', 10),
        'ZZ', edi837_pad($isaSender, 15), '01', $receiver,
        edi837_date6($nowIso), edi837_time4($nowIso), '^', '00501', $control, '0', $usage, ':',
    ]);

    $gs = edi837_segment('GS', ['HC', trim($gsSender), trim($receiver), edi837_date8($nowIso), edi837_time4($nowIso), $gsControl, 'X', '005010X222A1']);
    $ge = edi837_segment('GE', ['1', $gsControl]);
    $iea = edi837_segment('IEA', ['1', $control]);

    return $isa . $gs . $transactionBody . $ge . $iea;
}

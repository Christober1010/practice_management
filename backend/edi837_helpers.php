<?php
/**
 * Shared X12 837P segment helpers.
 */

function edi837_sanitize(string $value, int $maxLen = 0): string
{
    $value = strtoupper(trim($value));
    $value = str_replace(['*', '~', ':', '|'], ' ', $value);
    $value = preg_replace('/\s+/', ' ', $value) ?? '';
    if ($maxLen > 0 && strlen($value) > $maxLen) {
        $value = substr($value, 0, $maxLen);
    }
    return $value;
}

/** Digits only (for NPI / tax id / zip). */
function edi837_digits(string $value): string
{
    return preg_replace('/\D+/', '', $value) ?? '';
}

/**
 * Normalize to a 10-digit NPI, or '' if not exactly 10 digits after stripping.
 * Office Ally RC81/RC82 reject non-10-digit Box 32a/33a values.
 */
function edi837_npi(string $value): string
{
    $digits = edi837_digits($value);
    return strlen($digits) === 10 ? $digits : '';
}

/** CMS NPI check digit (Luhn over 80840 + NPI). */
function edi837_npi_check_digit_ok(string $npi): bool
{
    if (!preg_match('/^\d{10}$/', $npi)) {
        return false;
    }
    $full = '80840' . $npi;
    $sum = 0;
    $len = strlen($full);
    for ($i = 0; $i < $len; $i++) {
        $digit = (int)$full[$len - 1 - $i];
        if ($i % 2 === 1) {
            $digit *= 2;
            if ($digit > 9) {
                $digit -= 9;
            }
        }
        $sum += $digit;
    }
    return $sum % 10 === 0;
}

/**
 * @throws InvalidArgumentException when missing or not a valid 10-digit NPI
 */
function edi837_require_npi(string $value, string $label): string
{
    $npi = edi837_npi($value);
    if ($npi === '') {
        throw new InvalidArgumentException(
            $label . ' must be exactly 10 digits (Office Ally RC81/RC82)'
        );
    }
    if (!edi837_npi_check_digit_ok($npi)) {
        throw new InvalidArgumentException(
            $label . ' failed NPI check-digit validation (' . $npi . ')'
        );
    }
    return $npi;
}

function edi837_pad(string $value, int $len, string $padChar = ' ', bool $left = false): string
{
    $value = edi837_sanitize($value, $len);
    if (strlen($value) >= $len) {
        return substr($value, 0, $len);
    }
    $pad = str_repeat($padChar, $len - strlen($value));
    return $left ? ($pad . $value) : ($value . $pad);
}

function edi837_date8(?string $isoDate): string
{
    $isoDate = trim((string)$isoDate);
    if ($isoDate === '') {
        return gmdate('Ymd');
    }
    $ts = strtotime($isoDate);
    if ($ts === false) {
        return gmdate('Ymd');
    }
    return gmdate('Ymd', $ts);
}

function edi837_date6(?string $isoDate = null): string
{
    if ($isoDate === null || trim($isoDate) === '') {
        return gmdate('ymd');
    }
    $ts = strtotime($isoDate);
    if ($ts === false) {
        return gmdate('ymd');
    }
    return gmdate('ymd', $ts);
}

function edi837_time4(?string $isoDate = null): string
{
    if ($isoDate === null || trim($isoDate) === '') {
        return gmdate('Hi');
    }
    $ts = strtotime($isoDate);
    if ($ts === false) {
        return gmdate('Hi');
    }
    return gmdate('Hi', $ts);
}

function edi837_gender(?string $raw): string
{
    $v = strtoupper(substr(trim((string)$raw), 0, 1));
    return in_array($v, ['M', 'F'], true) ? $v : 'U';
}

function edi837_segment(string $tag, array $elements): string
{
    $parts = array_merge([$tag], array_map(static function ($el) {
        if ($el === null) {
            return '';
        }
        if (is_bool($el)) {
            return $el ? 'Y' : 'N';
        }
        return (string)$el;
    }, $elements));
    return implode('*', $parts) . '~';
}

function edi837_hi_diagnosis(array $codes): string
{
    $pairs = [];
    $i = 0;
    foreach (array_slice($codes, 0, 12) as $code) {
        $q = $i === 0 ? 'ABK' : 'ABF';
        $pairs[] = $q . ':' . edi837_sanitize((string)$code, 30);
        $i++;
    }
    if ($pairs === []) {
        return '';
    }
    return edi837_segment('HI', $pairs);
}

function edi837_modifiers(array $modifiers): string
{
    $mods = array_slice(array_values(array_filter(array_map(static function ($m) {
        return edi837_sanitize((string)$m, 2);
    }, $modifiers))), 0, 4);
    if ($mods === []) {
        return '';
    }
    return ':' . implode(':', $mods);
}

/** First non-empty place-of-service from claim lines (CLM05); default 12 (Home). */
function edi837_claim_place_of_service(array $payload): string
{
    foreach ($payload['lines'] ?? [] as $line) {
        $pos = edi837_sanitize((string)($line['place_of_service'] ?? ''), 2);
        if ($pos !== '') {
            return $pos;
        }
    }
    return '12';
}

/**
 * Build ST..SE professional claim segments (no ISA/GS envelope).
 *
 * @param array<int, array{payload: array}> $builtClaims
 * @return array{segments: array<int, string>, control: string, st_control: string}
 */
function edi837_build_st_se_segments(array $builtClaims, array $config): array
{
    if ($builtClaims === []) {
        throw new InvalidArgumentException('No claims to submit');
    }

    $gsSender = edi837_pad((string)$config['gs_sender_code'], 15);
    $receiver = trim((string)$config['receiver_id']);
    $submitterName = edi837_sanitize((string)$config['submitter_name'], 60);
    $receiverName = edi837_sanitize((string)($config['receiver_name'] ?? 'CLEARINGHOUSE'), 60);
    $clearinghouseLabel = (string)($config['clearinghouse_label'] ?? 'clearinghouse');

    $control = str_pad((string)random_int(1, 999999999), 9, '0', STR_PAD_LEFT);
    $stControl = '0001';
    $nowIso = gmdate('c');

    $transactionSegments = [];
    $transactionSegments[] = edi837_segment('ST', ['837', $stControl, '005010X222A1']);
    $transactionSegments[] = edi837_segment('BHT', ['0019', '00', $control, edi837_date8($nowIso), edi837_time4($nowIso), 'CH']);
    $transactionSegments[] = edi837_segment('NM1', ['41', '2', $submitterName, '', '', '', '', '46', trim($gsSender)]);
    $transactionSegments[] = edi837_segment('NM1', ['40', '2', $receiverName, '', '', '', '', '46', $receiver]);

    $hl = 1;
    $transactionSegments[] = edi837_segment('HL', [(string)$hl, '', '20', '1']);
    $billingHl = $hl;
    $hl++;

    $firstPayload = $builtClaims[0]['payload'];
    $billing = $firstPayload['billing_provider'] ?? [];
    $billingName = edi837_sanitize((string)($billing['name'] ?? ''), 60);
    $billingNpi = edi837_require_npi((string)($billing['npi'] ?? ''), 'Billing provider NPI (Box 33a)');
    $billingTaxId = edi837_digits((string)($billing['tax_id'] ?? ''));
    if (strlen($billingTaxId) !== 9) {
        throw new InvalidArgumentException(
            'Billing tax ID (Box 25) must be exactly 9 digits (got "'
            . edi837_sanitize((string)($billing['tax_id'] ?? ''), 20) . '")'
        );
    }

    $transactionSegments[] = edi837_segment('NM1', ['85', '2', $billingName, '', '', '', '', 'XX', $billingNpi]);
    $transactionSegments[] = edi837_segment('N3', [edi837_sanitize((string)($billing['address_line_1'] ?? ''), 55)]);
    if (!empty($billing['address_line_2'])) {
        $transactionSegments[] = edi837_segment('N3', [edi837_sanitize((string)$billing['address_line_2'], 55)]);
    }
    $transactionSegments[] = edi837_segment('N4', [
        edi837_sanitize((string)($billing['city'] ?? ''), 30),
        edi837_sanitize((string)($billing['state'] ?? ''), 2),
        edi837_sanitize((string)($billing['zip'] ?? ''), 15),
    ]);
    $transactionSegments[] = edi837_segment('REF', ['EI', $billingTaxId]);

    $billingTaxonomy = edi837_sanitize((string)($billing['taxonomy_code'] ?? ''), 10);
    if ($billingTaxonomy !== '') {
        $transactionSegments[] = edi837_segment('PRV', ['BI', 'PXC', $billingTaxonomy]);
    }

    foreach ($builtClaims as $claimIndex => $built) {
        $payload = $built['payload'];
        $patient = $payload['patient'] ?? [];
        $insured = $payload['insured'] ?? [];
        $payer = $payload['payer'] ?? [];
        $payerId = edi837_sanitize((string)($payer['id'] ?? ''), 80);
        $payerName = edi837_sanitize((string)($payer['name'] ?? 'PAYER'), 60);
        if ($payerId === '') {
            throw new InvalidArgumentException(
                'Insurance carrier_payer_id is required for ' . $clearinghouseLabel
                . ' submission (session claim #' . ($claimIndex + 1) . ')'
            );
        }

        $transactionSegments[] = edi837_segment('HL', [(string)$hl, (string)$billingHl, '22', '0']);
        $hl++;

        $memberId = edi837_sanitize((string)($insured['member_id'] ?? ''), 80);
        $transactionSegments[] = edi837_segment('SBR', ['P', '18', '', '', '', '', '', '', 'CI']);
        $transactionSegments[] = edi837_segment('NM1', ['IL', '1', edi837_sanitize((string)($insured['last_name'] ?? ''), 60), edi837_sanitize((string)($insured['first_name'] ?? ''), 35), '', '', '', 'MI', $memberId]);
        $transactionSegments[] = edi837_segment('N3', [edi837_sanitize((string)($insured['address_line_1'] ?? ''), 55)]);
        $transactionSegments[] = edi837_segment('N4', [
            edi837_sanitize((string)($insured['city'] ?? ''), 30),
            edi837_sanitize((string)($insured['state'] ?? ''), 2),
            edi837_sanitize((string)($insured['zip'] ?? ''), 15),
        ]);
        $transactionSegments[] = edi837_segment('DMG', ['D8', edi837_date8((string)($insured['dob'] ?? ($patient['dob'] ?? ''))), edi837_gender((string)($patient['sex'] ?? ''))]);
        $transactionSegments[] = edi837_segment('NM1', ['PR', '2', $payerName, '', '', '', '', 'PI', $payerId]);

        $claimId = edi837_sanitize((string)($payload['patient_account_number'] ?? ('CLM' . ($claimIndex + 1))), 38);
        $totalCharge = 0.0;
        foreach ($payload['lines'] ?? [] as $line) {
            $totalCharge += (float)($line['charges'] ?? 0);
        }
        if ($totalCharge <= 0) {
            $totalCharge = 0.01 * max(1, count($payload['lines'] ?? []));
        }
        $claimPos = edi837_claim_place_of_service($payload);
        $transactionSegments[] = edi837_segment('CLM', [
            $claimId,
            number_format($totalCharge, 2, '.', ''),
            '',
            '',
            sprintf('%s:B:1', $claimPos),
            'Y',
            'A',
            'Y',
            'Y',
        ]);

        $dx = $payload['diagnosis']['codes'] ?? [];
        $hi = edi837_hi_diagnosis($dx);
        if ($hi !== '') {
            $transactionSegments[] = $hi;
        }

        if (!empty($payload['prior_authorization_number'])) {
            $transactionSegments[] = edi837_segment('REF', ['G1', edi837_sanitize((string)$payload['prior_authorization_number'], 50)]);
        }

        $facility = $payload['service_facility'] ?? [];
        $facilityName = edi837_sanitize((string)($facility['name'] ?? ''), 60);
        $facilityNpiRaw = trim((string)($facility['npi'] ?? ''));
        if ($facilityName !== '' || $facilityNpiRaw !== '') {
            $facilityNpi = edi837_require_npi(
                $facilityNpiRaw !== '' ? $facilityNpiRaw : $billingNpi,
                'Facility NPI (Box 32a)'
            );
            $transactionSegments[] = edi837_segment(
                'NM1',
                ['77', '2', $facilityName !== '' ? $facilityName : $billingName, '', '', '', '', 'XX', $facilityNpi]
            );
        }

        $lineNumber = 1;
        foreach ($payload['lines'] ?? [] as $line) {
            $proc = edi837_sanitize((string)($line['procedure_code'] ?? ''), 48);
            if ($proc === '') {
                continue;
            }
            $units = $line['units'] ?? 1;
            $charge = (float)($line['charges'] ?? 0);
            if ($charge <= 0) {
                $charge = 0.01;
            }
            $dos = edi837_date8((string)($line['dos_from'] ?? ''));
            $modStr = edi837_modifiers($line['modifiers'] ?? []);
            $composite = 'HC:' . $proc . $modStr;
            $transactionSegments[] = edi837_segment('LX', [(string)$lineNumber]);
            $transactionSegments[] = edi837_segment('SV1', [
                $composite,
                number_format($charge, 2, '.', ''),
                'UN',
                (string)$units,
                '',
                edi837_sanitize((string)($line['place_of_service'] ?? ''), 2),
            ]);
            $transactionSegments[] = edi837_segment('DTP', ['472', 'D8', $dos]);

            $renderingNpi = edi837_npi((string)($line['rendering_provider_npi'] ?? ($payload['rendering_provider']['npi'] ?? '')));
            if ($renderingNpi !== '') {
                if (!edi837_npi_check_digit_ok($renderingNpi)) {
                    throw new InvalidArgumentException(
                        'Rendering provider NPI failed check-digit validation (' . $renderingNpi . ')'
                    );
                }
                $renderingName = edi837_sanitize((string)($line['rendering_provider_name'] ?? ($payload['rendering_provider']['name'] ?? '')), 60);
                $parts = preg_split('/\s+/', $renderingName, 2) ?: [];
                $last = $parts[0] ?? 'PROVIDER';
                $first = $parts[1] ?? '';
                $transactionSegments[] = edi837_segment('NM1', ['82', '1', $last, $first, '', '', '', 'XX', $renderingNpi]);
            }

            $lineNumber++;
        }
    }

    $segmentCount = count($transactionSegments) + 1;
    $transactionSegments[] = edi837_segment('SE', [(string)$segmentCount, $stControl]);

    return [
        'segments' => $transactionSegments,
        'control' => $control,
        'st_control' => $stControl,
        'now_iso' => $nowIso,
    ];
}

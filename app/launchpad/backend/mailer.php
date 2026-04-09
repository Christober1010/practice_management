<?php

/**
 * Central mail helper.
 *
 * Uses SMTP when MAIL_TRANSPORT=smtp is set in the backend .env.
 * Falls back to PHP mail() if SMTP is not configured.
 *
 * This is intentionally lightweight and avoids external dependencies.
 * It supports basic HTML emails over SMTPS (port 465) with LOGIN auth.
 */

// Tiny helper: getenv with default, defined locally so we don't depend on other files.
if (!function_exists('getenv_or_default')) {
    function getenv_or_default(string $key, string $default = ''): string
    {
        $val = getenv($key);
        if ($val === false || $val === null) {
            return $default;
        }
        return (string)$val;
    }
}

/**
 * Send an email.
 *
 * @param string $to
 * @param string $subject
 * @param string $htmlBody
 * @param string|null $textBody Optional plain-text fallback. If null, a stripped version of HTML is used.
 * @return bool
 */
function sendMail(string $to, string $subject, string $htmlBody, ?string $textBody = null): bool
{
    $transport = getenv_or_default('MAIL_TRANSPORT', 'mail'); // "smtp" or "mail"

    if ($transport !== 'smtp') {
        // Legacy behaviour: PHP mail()
        $from      = getenv_or_default('MAIL_FROM', 'noreply@mahabehavioralhealth.com');
        $fromName  = getenv_or_default('MAIL_FROM_NAME', 'Maha Launchpad');
        $fromHeader = sprintf('%s <%s>', $fromName, $from);

        $headers  = "MIME-Version: 1.0\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8\r\n";
        $headers .= "From: {$fromHeader}\r\n";

        return @mail($to, $subject, $htmlBody, $headers);
    }

    // SMTP configuration
    $smtpHost   = getenv_or_default('SMTP_HOST', '');
    $smtpPort   = (int) getenv_or_default('SMTP_PORT', '465');
    $smtpUser   = getenv_or_default('SMTP_USER', '');
    $smtpPass   = getenv_or_default('SMTP_PASS', '');
    $smtpSecure = strtolower(getenv_or_default('SMTP_SECURE', 'ssl')); // "ssl" or "tls" (we use implicit SSL by default)

    $from      = getenv_or_default('MAIL_FROM', $smtpUser ?: 'noreply@mahabehavioralhealth.com');
    $fromName  = getenv_or_default('MAIL_FROM_NAME', 'Maha Launchpad');

    if (!$smtpHost || !$smtpUser || !$smtpPass) {
        error_log('sendMail: SMTP is selected but SMTP_HOST/SMTP_USER/SMTP_PASS are not fully configured. Falling back to mail().');

        $headers  = "MIME-Version: 1.0\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8\r\n";
        $headers .= "From: {$fromName} <{$from}>\r\n";

        return @mail($to, $subject, $htmlBody, $headers);
    }

    if ($textBody === null) {
        $textBody = trim(html_entity_decode(strip_tags($htmlBody)));
    }

    // Build a simple multipart/alternative email body so both HTML and text are available
    $boundary = '=_Boundary_' . bin2hex(random_bytes(12));

    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "From: {$fromName} <{$from}>\r\n";
    $headers .= "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n";

    $body  = "--{$boundary}\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $body .= $textBody . "\r\n\r\n";

    $body .= "--{$boundary}\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $body .= $htmlBody . "\r\n\r\n";
    $body .= "--{$boundary}--\r\n";

    if ($smtpSecure === 'ssl') {
        $remote = "ssl://{$smtpHost}:{$smtpPort}";
    } else {
        // STARTTLS is more complex; for now prefer implicit SSL (port 465).
        $remote = "{$smtpHost}:{$smtpPort}";
    }

    $errno  = 0;
    $errstr = '';

    $fp = @fsockopen($remote, $smtpPort, $errno, $errstr, 30);
    if (!$fp) {
        error_log("sendMail: Failed to connect to SMTP server: {$errstr} ({$errno})");
        return false;
    }

    stream_set_timeout($fp, 30);

    $read = function () use ($fp): string {
        $data = '';
        while ($str = fgets($fp, 515)) {
            $data .= $str;
            if (substr($str, 3, 1) === ' ') {
                break;
            }
        }
        return $data;
    };

    $expect = function (string $prefix) use ($read, $fp): bool {
        $resp = $read();
        if (substr($resp, 0, 3) !== $prefix) {
            error_log("sendMail SMTP error, expected {$prefix}, got: {$resp}");
            return false;
        }
        return true;
    };

    $write = function (string $cmd) use ($fp): void {
        fwrite($fp, $cmd . "\r\n");
    };

    if (!$expect('220')) {
        fclose($fp);
        return false;
    }

    $hostName = gethostname() ?: 'localhost';
    $write("EHLO {$hostName}");
    if (!$expect('250')) {
        fclose($fp);
        return false;
    }

    if ($smtpSecure === 'tls') {
        // For STARTTLS we'd need to send STARTTLS and enable crypto; not implemented here.
        // To avoid half-secure setups, we log and abort.
        error_log('sendMail: SMTP_SECURE=tls is not supported in this lightweight mailer. Use ssl with port 465.');
        fclose($fp);
        return false;
    }

    // AUTH LOGIN
    $write('AUTH LOGIN');
    if (!$expect('334')) {
        fclose($fp);
        return false;
    }

    $write(base64_encode($smtpUser));
    if (!$expect('334')) {
        fclose($fp);
        return false;
    }

    $write(base64_encode($smtpPass));
    if (!$expect('235')) {
        fclose($fp);
        return false;
    }

    $write("MAIL FROM:<{$from}>");
    if (!$expect('250')) {
        fclose($fp);
        return false;
    }

    $write("RCPT TO:<{$to}>");
    if (!$expect('250')) {
        fclose($fp);
        return false;
    }

    $write('DATA');
    if (!$expect('354')) {
        fclose($fp);
        return false;
    }

    $message  = "Subject: {$subject}\r\n";
    $message .= $headers . "\r\n";
    $message .= $body;
    $message .= "\r\n.";

    $write($message);
    if (!$expect('250')) {
        fclose($fp);
        return false;
    }

    $write('QUIT');
    fclose($fp);

    return true;
}



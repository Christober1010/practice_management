<?php
/**
 * Office Ally SFTP upload helper (phpseclib).
 */

require_once __DIR__ . '/officeally_config_helper.php';

function officeally_sftp_autoload(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $autoload = __DIR__ . '/vendor/autoload.php';
    if (!is_file($autoload)) {
        throw new RuntimeException(
            'SFTP library missing. Run composer install in the backend directory (phpseclib).',
            503
        );
    }
    require_once $autoload;
    $loaded = true;
}

/** @return \phpseclib3\Net\SFTP */
function officeally_sftp_connect(array $config, int $timeout = 30)
{
    officeally_sftp_autoload();

    $host = (string)$config['sftp_host'];
    $port = (int)$config['sftp_port'];
    $user = (string)$config['sftp_user'];
    $pass = (string)$config['sftp_password'];

    if ($host === '' || $user === '' || $pass === '') {
        throw new RuntimeException('Office Ally SFTP host, user, and password are required', 503);
    }

    $sftp = new \phpseclib3\Net\SFTP($host, $port, $timeout);
    if (!$sftp->login($user, $pass)) {
        throw new RuntimeException(
            'Office Ally SFTP login failed. Check credentials and firewall (port ' . $port . ').',
            502
        );
    }

    return $sftp;
}

function officeally_sftp_normalize_remote_dir(string $dir): string
{
    $dir = trim(str_replace('\\', '/', $dir));
    return trim($dir, '/');
}

function officeally_sftp_remote_path(array $config, string $filename): string
{
    $dir = officeally_sftp_normalize_remote_dir((string)$config['sftp_remote_dir']);
    $filename = ltrim(str_replace('\\', '/', $filename), '/');
    if ($dir === '') {
        return $filename;
    }
    return $dir . '/' . $filename;
}

/** @return array{ok: bool, host: string, port: int, remote_pwd: string, remote_dir: string, reports_dir: string, listing: array<int, string>} */
function officeally_sftp_test_connection(array $config): array
{
    $sftp = officeally_sftp_connect($config);
    $pwd = (string)$sftp->pwd();
    $remoteDir = officeally_sftp_normalize_remote_dir((string)$config['sftp_remote_dir']);
    $reportsDir = officeally_sftp_normalize_remote_dir((string)($config['sftp_reports_dir'] ?? 'outbound'));

    if ($remoteDir !== '') {
        if (!$sftp->chdir($remoteDir)) {
            throw new RuntimeException(
                'Office Ally SFTP remote directory not found or not accessible: ' . $remoteDir,
                502
            );
        }
    }

    $listing = $sftp->nlist('.') ?: [];
    $names = [];
    foreach ($listing as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        $names[] = (string)$name;
        if (count($names) >= 20) {
            break;
        }
    }

    return [
        'ok' => true,
        'host' => (string)$config['sftp_host'],
        'port' => (int)$config['sftp_port'],
        'remote_pwd' => $pwd,
        'remote_dir' => $remoteDir !== '' ? $remoteDir : '/',
        'reports_dir' => $reportsDir !== '' ? $reportsDir : 'outbound',
        'listing' => $names,
    ];
}

/** @return array{remote_path: string, bytes: int} */
function officeally_sftp_upload_content(array $config, string $filename, string $content): array
{
    $sftp = officeally_sftp_connect($config);
    $remotePath = officeally_sftp_remote_path($config, $filename);
    $remoteDir = officeally_sftp_normalize_remote_dir((string)$config['sftp_remote_dir']);

    if ($remoteDir !== '' && !$sftp->chdir($remoteDir)) {
        throw new RuntimeException('Office Ally SFTP remote directory not found: ' . $remoteDir, 502);
    }

    $ok = $sftp->put(basename($remotePath), $content);
    if (!$ok) {
        throw new RuntimeException('Office Ally SFTP upload failed for ' . $remotePath, 502);
    }

    return [
        'remote_path' => $remotePath,
        'bytes' => strlen($content),
    ];
}

function officeally_build_submission_filename(array $config): string
{
    $prefix = preg_replace('/[^A-Za-z0-9_-]/', '', (string)$config['file_prefix']);
    if ($prefix === '') {
        $prefix = '837P';
    }
    // Office Ally routes test vs production by filename keyword OATEST, not ISA15.
    $testTag = ($config['environment'] ?? '') === 'test' ? '_OATEST' : '';
    return $prefix . $testTag . '_' . gmdate('Ymd_His') . '.txt';
}

<?php
/**
 * Availity SFTP upload helper (phpseclib).
 */

require_once __DIR__ . '/availity_config_helper.php';

function availity_sftp_autoload(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $autoload = __DIR__ . '/vendor/autoload.php';
    if (!is_file($autoload)) {
        throw new RuntimeException(
            'SFTP library missing. Run: cd backend-test && php composer.phar install',
            503
        );
    }
    require_once $autoload;
    $loaded = true;
}

/** @return \phpseclib3\Net\SFTP */
function availity_sftp_connect(array $config, int $timeout = 30)
{
    availity_sftp_autoload();

    $host = (string)$config['sftp_host'];
    $port = (int)$config['sftp_port'];
    $user = (string)$config['sftp_user'];
    $pass = (string)$config['sftp_password'];

    if ($host === '' || $user === '' || $pass === '') {
        throw new RuntimeException('Availity SFTP host, user, and password are required', 503);
    }

    $sftp = new \phpseclib3\Net\SFTP($host, $port, $timeout);
    if (!$sftp->login($user, $pass)) {
        throw new RuntimeException('Availity SFTP login failed. Check credentials and firewall (port ' . $port . ').', 502);
    }

    return $sftp;
}

function availity_sftp_normalize_remote_dir(string $dir): string
{
    $dir = trim(str_replace('\\', '/', $dir));
    $dir = trim($dir, '/');
    return $dir;
}

function availity_sftp_remote_path(array $config, string $filename): string
{
    $dir = availity_sftp_normalize_remote_dir((string)$config['sftp_remote_dir']);
    $filename = ltrim(str_replace('\\', '/', $filename), '/');
    if ($dir === '') {
        return $filename;
    }
    return $dir . '/' . $filename;
}

/** @return array{ok: bool, host: string, port: int, remote_pwd: string, remote_dir: string} */
function availity_sftp_test_connection(array $config): array
{
    $sftp = availity_sftp_connect($config);
    $pwd = (string)$sftp->pwd();
    $remoteDir = availity_sftp_normalize_remote_dir((string)$config['sftp_remote_dir']);

    if ($remoteDir !== '') {
        if (!$sftp->chdir($remoteDir)) {
            throw new RuntimeException('Availity SFTP remote directory not found or not accessible: ' . $remoteDir, 502);
        }
    }

    return [
        'ok' => true,
        'host' => (string)$config['sftp_host'],
        'port' => (int)$config['sftp_port'],
        'remote_pwd' => $pwd,
        'remote_dir' => $remoteDir !== '' ? $remoteDir : '/',
    ];
}

/** @return array{remote_path: string, bytes: int} */
function availity_sftp_upload_content(array $config, string $filename, string $content): array
{
    $sftp = availity_sftp_connect($config);
    $remotePath = availity_sftp_remote_path($config, $filename);
    $remoteDir = availity_sftp_normalize_remote_dir((string)$config['sftp_remote_dir']);

    if ($remoteDir !== '' && !$sftp->chdir($remoteDir)) {
        throw new RuntimeException('Availity SFTP remote directory not found: ' . $remoteDir, 502);
    }

    $ok = $sftp->put(basename($remotePath), $content);
    if (!$ok) {
        throw new RuntimeException('Availity SFTP upload failed for ' . $remotePath, 502);
    }

    return [
        'remote_path' => $remotePath,
        'bytes' => strlen($content),
    ];
}

function availity_build_submission_filename(array $config): string
{
    $prefix = preg_replace('/[^A-Za-z0-9_-]/', '', (string)$config['file_prefix']);
    if ($prefix === '') {
        $prefix = '837P';
    }
    return $prefix . '_' . gmdate('Ymd_His') . '.edi';
}

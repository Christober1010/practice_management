<?php
header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 0);

$result = [
    'success' => true,
    'message' => 'PHP is working',
    'php_version' => PHP_VERSION,
    'script_path' => __FILE__,
    'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'N/A',
    'request_uri' => $_SERVER['REQUEST_URI'] ?? 'N/A',
];

// Test file operations
$testDir = __DIR__ . '/backend';
$testFile = $testDir . '/test.txt';

try {
    if (!is_dir($testDir)) {
        $result['mkdir_attempt'] = @mkdir($testDir, 0755, true);
        $result['mkdir_success'] = is_dir($testDir);
    } else {
        $result['mkdir_success'] = true;
        $result['dir_exists'] = true;
    }
    
    if (is_dir($testDir)) {
        $result['write_test'] = @file_put_contents($testFile, 'test');
        $result['read_test'] = @file_get_contents($testFile);
        @unlink($testFile);
    }
} catch (Throwable $e) {
    $result['file_ops_error'] = $e->getMessage();
}

echo json_encode($result, JSON_PRETTY_PRINT);


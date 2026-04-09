<?php
header('Content-Type: text/plain');
echo "OK - File is accessible\n";
echo "Script path: " . __FILE__ . "\n";
echo "Document root: " . ($_SERVER['DOCUMENT_ROOT'] ?? 'N/A') . "\n";
echo "Request URI: " . ($_SERVER['REQUEST_URI'] ?? 'N/A') . "\n";
echo "Script filename: " . ($_SERVER['SCRIPT_FILENAME'] ?? 'N/A') . "\n";


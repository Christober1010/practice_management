<?php
// Temporary script to test password hashing and verification
// DELETE THIS FILE AFTER USE - IT'S FOR DEBUGGING ONLY

// Test password
$testPassword = 'Admin@123';

// Generate a new hash
$newHash = password_hash($testPassword, PASSWORD_DEFAULT);
echo "Generated hash for 'Admin@123': " . $newHash . "\n\n";

// Test the hash from the SQL file
$sqlHash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
echo "Testing SQL hash against 'Admin@123':\n";
$result = password_verify($testPassword, $sqlHash);
echo "Result: " . ($result ? "MATCH ✓" : "NO MATCH ✗") . "\n\n";

// Test the new hash
echo "Testing new hash against 'Admin@123':\n";
$result2 = password_verify($testPassword, $newHash);
echo "Result: " . ($result2 ? "MATCH ✓" : "NO MATCH ✗") . "\n\n";

// SQL statement to update password
echo "Use this SQL to update the admin password if needed:\n";
echo "UPDATE Users SET password_hash = '" . $newHash . "' WHERE username = 'admin';\n";
?>


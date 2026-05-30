<?php
// Script to check and fix the admin password
// DELETE THIS FILE AFTER USE - IT'S FOR DEBUGGING ONLY

require_once 'config.php';

// Test password
$adminPassword = 'Admin@123';
$conn = getDBConnection();

// Check if admin user exists
$stmt = $conn->prepare("SELECT id, username, password_hash, is_active FROM Users WHERE username = ? LIMIT 1");
$stmt->bind_param("s", $username);
$username = 'admin';
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo "ERROR: Admin user not found in database!\n";
    echo "You need to run the SQL script: migration/launchpad/shared/create_users_table.sql\n";
    exit(1);
}

$user = $result->fetch_assoc();
$stmt->close();

echo "Admin user found in database:\n";
echo "ID: " . $user['id'] . "\n";
echo "Username: " . $user['username'] . "\n";
echo "Is Active: " . ($user['is_active'] ? 'Yes' : 'No') . "\n";
echo "Current Hash: " . $user['password_hash'] . "\n\n";

// Test if current hash works
echo "Testing current hash against 'Admin@123':\n";
$currentMatch = password_verify($adminPassword, $user['password_hash']);
echo "Result: " . ($currentMatch ? "MATCH ✓" : "NO MATCH ✗") . "\n\n";

if (!$currentMatch) {
    echo "Password hash doesn't match! Generating new hash...\n";
    $newHash = password_hash($adminPassword, PASSWORD_DEFAULT);
    
    // Update the password
    $updateStmt = $conn->prepare("UPDATE Users SET password_hash = ? WHERE username = 'admin'");
    $updateStmt->bind_param("s", $newHash);
    
    if ($updateStmt->execute()) {
        echo "✓ Password hash updated successfully!\n";
        echo "New hash: " . $newHash . "\n\n";
        
        // Verify the new hash works
        $verifyStmt = $conn->prepare("SELECT password_hash FROM Users WHERE username = 'admin'");
        $verifyStmt->execute();
        $verifyResult = $verifyStmt->get_result();
        $updatedUser = $verifyResult->fetch_assoc();
        $verifyStmt->close();
        
        if (password_verify($adminPassword, $updatedUser['password_hash'])) {
            echo "✓ Verification successful! You can now login with:\n";
            echo "  Username: admin\n";
            echo "  Password: Admin@123\n";
        } else {
            echo "✗ Error: Verification failed after update!\n";
        }
    } else {
        echo "✗ Error updating password: " . $updateStmt->error . "\n";
    }
    $updateStmt->close();
} else {
    echo "Password hash is correct! If login still fails, check:\n";
    echo "1. CORS configuration\n";
    echo "2. Session configuration\n";
    echo "3. Database connection\n";
    echo "4. Check browser console for errors\n";
}

$conn->close();
?>


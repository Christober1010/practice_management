<?php
/**
 * Generate Encryption Key for Google Drive OAuth Refresh Token
 * 
 * This script generates a secure base64-encoded encryption key.
 * 
 * Access: https://launchpad.mahabehavioralhealth.com/backend/generate_encryption_key.php
 * 
 * ⚠️ SECURITY: Delete this file after generating your key!
 */

header('Content-Type: text/plain');

// Generate 32 random bytes and encode as base64
$key = base64_encode(random_bytes(32));

echo "========================================\n";
echo "ENCRYPTION KEY GENERATED\n";
echo "========================================\n\n";
echo "Add this to your backend/.env file:\n\n";
echo "GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY=" . $key . "\n\n";
echo "========================================\n";
echo "⚠️ IMPORTANT:\n";
echo "1. Copy the key above\n";
echo "2. Add it to backend/.env\n";
echo "3. DELETE this file (generate_encryption_key.php) for security!\n";
echo "========================================\n";


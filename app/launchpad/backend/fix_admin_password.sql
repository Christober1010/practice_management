-- Fix admin password hash
-- This updates the admin password to work with 'Admin@123'
-- Run this SQL command if you're having login issues

UPDATE `Users` 
SET `password_hash` = '$2y$10$0b01KSn3WGVIlyr0zw9iROqgdDh7q30rjPJYA2CeJMp4H.a3Y87SK' 
WHERE `username` = 'admin';


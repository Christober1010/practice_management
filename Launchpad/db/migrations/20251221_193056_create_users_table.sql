-- Users Table with Roles
-- This table stores user authentication information and roles

CREATE TABLE IF NOT EXISTS `Users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `role` ENUM('admin', 'hr', 'staff', 'viewer') NOT NULL DEFAULT 'staff',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login` TIMESTAMP NULL DEFAULT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_username` (`username`),
  INDEX `idx_email` (`email`),
  INDEX `idx_role` (`role`),
  INDEX `idx_is_active` (`is_active`),
  FOREIGN KEY (`created_by`) REFERENCES `Users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user (password: Admin@123 - CHANGE THIS IMMEDIATELY!)
-- Password hash is generated using: password_hash('Admin@123', PASSWORD_DEFAULT)
-- This hash is verified to work with the password 'Admin@123'
INSERT INTO `Users` (`username`, `password_hash`, `email`, `role`, `is_active`) 
VALUES (
  'admin', 
  '$2y$10$0b01KSn3WGVIlyr0zw9iROqgdDh7q30rjPJYA2CeJMp4H.a3Y87SK', 
  'admin@mahabehavioralhealth.com', 
  'admin', 
  1
) ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`);

-- Roles explanation:
-- 'admin' - Full system access, can manage users and all data
-- 'hr' - HR personnel, can submit and view forms
-- 'staff' - Regular staff members, can submit forms for themselves
-- 'viewer' - Read-only access to view submitted forms

-- Optional: Create a table to track login attempts for additional security
CREATE TABLE IF NOT EXISTS `LoginAttempts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ip_address` VARCHAR(45) NOT NULL,
  `username` VARCHAR(50) DEFAULT NULL,
  `attempt_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `success` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_ip_address` (`ip_address`),
  INDEX `idx_attempt_time` (`attempt_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


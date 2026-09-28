-- Launchpad bootstrap (aligned with migration/launchpad/shared)

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

CREATE TABLE IF NOT EXISTS `LoginAttempts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ip_address` VARCHAR(45) NOT NULL,
  `username` VARCHAR(50) DEFAULT NULL,
  `attempt_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `success` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(100) NOT NULL,
  `otp_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `used_at` DATETIME NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_password_resets_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AuthTokens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` TIMESTAMP NULL DEFAULT NULL,
  `revoked_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_token_hash` (`token_hash`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_authtokens_user` FOREIGN KEY (`user_id`) REFERENCES `Users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Staff` (
  `staff_id` INT NOT NULL AUTO_INCREMENT,
  `action_type` VARCHAR(50) NOT NULL DEFAULT 'New Hire',
  `first_name` VARCHAR(100) NOT NULL,
  `middle_name` VARCHAR(100) NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `job_title` VARCHAR(255) NULL,
  `employment_status` VARCHAR(100) NULL,
  `ssn_last_4_digits` CHAR(4) NULL,
  `ssn_encrypted` TEXT NULL,
  `date_of_birth` DATE NULL,
  `full_address` TEXT NULL,
  `cell_phone` VARCHAR(50) NULL,
  `home_phone` VARCHAR(50) NULL,
  `work_phone` VARCHAR(50) NULL,
  `email` VARCHAR(255) NOT NULL,
  `created_by_user_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`staff_id`),
  KEY `idx_staff_created_by_user_id` (`created_by_user_id`),
  KEY `idx_staff_email` (`email`),
  CONSTRAINT `fk_staff_created_by_user_id` FOREIGN KEY (`created_by_user_id`) REFERENCES `Users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `EmergencyContact` (
  `emergency_contact_id` INT NOT NULL AUTO_INCREMENT,
  `staff_id` INT NOT NULL,
  `contact_name` VARCHAR(255) NOT NULL,
  `relationship` VARCHAR(100) NOT NULL,
  `primary_phone` VARCHAR(50) NOT NULL,
  `secondary_phone` VARCHAR(50) NULL,
  PRIMARY KEY (`emergency_contact_id`),
  UNIQUE KEY `uniq_emergency_contact_staff` (`staff_id`),
  CONSTRAINT `fk_emergency_contact_staff` FOREIGN KEY (`staff_id`) REFERENCES `Staff` (`staff_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProfessionalData` (
  `professional_data_id` INT NOT NULL AUTO_INCREMENT,
  `staff_id` INT NOT NULL,
  `highest_degree` VARCHAR(100) NULL,
  `year_awarded` INT NULL,
  `major` VARCHAR(255) NULL,
  `license_status` VARCHAR(50) NULL,
  `license_exp_date` DATE NULL,
  `npi_number` VARCHAR(50) NULL,
  `languages` VARCHAR(255) NULL,
  `specialty_areas` TEXT NULL,
  PRIMARY KEY (`professional_data_id`),
  UNIQUE KEY `uniq_professional_data_staff` (`staff_id`),
  CONSTRAINT `fk_professional_data_staff` FOREIGN KEY (`staff_id`) REFERENCES `Staff` (`staff_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StaffCertification` (
  `certification_id` INT NOT NULL AUTO_INCREMENT,
  `staff_id` INT NOT NULL,
  `cert_type` VARCHAR(100) NOT NULL,
  `cert_number` VARCHAR(100) NULL,
  `exp_date` DATE NULL,
  PRIMARY KEY (`certification_id`),
  KEY `idx_staff_certification_staff_id` (`staff_id`),
  CONSTRAINT `fk_staff_certification_staff` FOREIGN KEY (`staff_id`) REFERENCES `Staff` (`staff_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `BankInfo` (
  `bank_info_id` INT NOT NULL AUTO_INCREMENT,
  `staff_id` INT NOT NULL,
  `bank_name` VARCHAR(255) NOT NULL,
  `account_name` VARCHAR(255) NOT NULL,
  `account_number_encrypted` VARCHAR(512) NOT NULL,
  `routing_number_encrypted` VARCHAR(512) NOT NULL,
  `account_type` VARCHAR(50) NOT NULL,
  `authorization_agreed` TINYINT(1) NOT NULL DEFAULT 0,
  `authorization_timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`bank_info_id`),
  UNIQUE KEY `uniq_bank_info_staff` (`staff_id`),
  CONSTRAINT `fk_bank_info_staff` FOREIGN KEY (`staff_id`) REFERENCES `Staff` (`staff_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ComplianceAgreement` (
  `compliance_id` INT NOT NULL AUTO_INCREMENT,
  `staff_id` INT NOT NULL,
  `hipaa_acknowledged` TINYINT(1) NOT NULL DEFAULT 0,
  `hipaa_acknowledged_at` TIMESTAMP NULL DEFAULT NULL,
  `abuse_reporting_acknowledged` TINYINT(1) NOT NULL DEFAULT 0,
  `abuse_reporting_acknowledged_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`compliance_id`),
  UNIQUE KEY `uniq_compliance_agreement_staff` (`staff_id`),
  CONSTRAINT `fk_compliance_agreement_staff` FOREIGN KEY (`staff_id`) REFERENCES `Staff` (`staff_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StaffAttachments` (
  `attachment_id` INT NOT NULL AUTO_INCREMENT,
  `staff_id` INT NOT NULL,
  `uploaded_by_user_id` INT UNSIGNED NOT NULL,
  `attachment_type` VARCHAR(50) NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `stored_path` VARCHAR(512) NOT NULL,
  `stored_filename` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `size_bytes` INT NOT NULL,
  `sha256` CHAR(64) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`attachment_id`),
  KEY `idx_staff_attachments_staff_id` (`staff_id`),
  CONSTRAINT `fk_staff_attachments_staff` FOREIGN KEY (`staff_id`) REFERENCES `Staff` (`staff_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StaffShareKeys` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `staff_id` INT NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `token_prefix` VARCHAR(12) NOT NULL,
  `created_by_user_id` INT UNSIGNED NOT NULL,
  `created_by_username` VARCHAR(150) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  `revoked_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_staff_share_keys_staff` (`staff_id`),
  KEY `idx_staff_share_keys_hash` (`token_hash`),
  CONSTRAINT `fk_staff_share_keys_staff` FOREIGN KEY (`staff_id`) REFERENCES `Staff` (`staff_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `GoogleDriveOAuthTokens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `access_token_encrypted` TEXT NOT NULL,
  `refresh_token_encrypted` TEXT NULL,
  `token_expiry` DATETIME NULL,
  `scopes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_drive_oauth_user` (`user_id`),
  CONSTRAINT `fk_drive_oauth_user` FOREIGN KEY (`user_id`) REFERENCES `Users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StaffOfferInitiations` (
  `initiation_id` INT NOT NULL AUTO_INCREMENT,
  `staff_id` INT NOT NULL,
  `initiated_by_user_id` INT UNSIGNED NOT NULL,
  `employee_name` VARCHAR(255) NOT NULL,
  `job_title` VARCHAR(255) NOT NULL,
  `pay_rate` VARCHAR(100) NULL,
  `position_code` VARCHAR(100) NULL,
  `offer_letter_body` LONGTEXT NULL,
  `initiated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`initiation_id`),
  UNIQUE KEY `uniq_offer_initiation_staff` (`staff_id`),
  CONSTRAINT `fk_offer_initiation_staff` FOREIGN KEY (`staff_id`) REFERENCES `Staff` (`staff_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StaffOfferAcceptances` (
  `offer_id` INT NOT NULL AUTO_INCREMENT,
  `staff_id` INT NOT NULL,
  `created_by_user_id` INT UNSIGNED NOT NULL,
  `employee_name` VARCHAR(255) NOT NULL,
  `job_title` VARCHAR(255) NOT NULL,
  `pay_rate` VARCHAR(100) NOT NULL,
  `signature_attachment_id` INT NOT NULL,
  `accepted_date` DATE NOT NULL,
  `jd_read_ack` TINYINT(1) NOT NULL DEFAULT 0,
  `hipaa_ack` TINYINT(1) NOT NULL DEFAULT 0,
  `abuse_ack` TINYINT(1) NOT NULL DEFAULT 0,
  `signed_offer_attachment_id` INT NULL,
  `accepted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`offer_id`),
  UNIQUE KEY `uniq_offer_acceptance_staff` (`staff_id`),
  CONSTRAINT `fk_offer_acceptance_staff` FOREIGN KEY (`staff_id`) REFERENCES `Staff` (`staff_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `OfferLetterPositions` (
  `position_id` INT NOT NULL AUTO_INCREMENT,
  `position_code` VARCHAR(50) NOT NULL,
  `position_name` VARCHAR(255) NOT NULL,
  `offer_letter_template` TEXT NOT NULL,
  `job_description_template` TEXT NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`position_id`),
  UNIQUE KEY `uniq_offer_position_code` (`position_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ClientIntakePackets` (
  `intake_id` INT NOT NULL AUTO_INCREMENT,
  `created_by_user_id` INT UNSIGNED NOT NULL,
  `child_legal_name` VARCHAR(255) NOT NULL,
  `child_dob` DATE NOT NULL,
  `completed_by` VARCHAR(255) NOT NULL,
  `contact_phone` VARCHAR(64) NOT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `parent_guardian_signature_data_url` LONGTEXT NOT NULL,
  `parent_guardian_signature_date` DATE NOT NULL,
  `provider_signature_data_url` LONGTEXT NULL,
  `provider_signature_date` DATE NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`intake_id`),
  KEY `idx_client_intake_created_by` (`created_by_user_id`),
  CONSTRAINT `fk_client_intake_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `Users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ClientIntakeAttachments` (
  `attachment_id` INT NOT NULL AUTO_INCREMENT,
  `intake_id` INT NOT NULL,
  `uploaded_by_user_id` INT UNSIGNED NOT NULL,
  `attachment_type` VARCHAR(50) NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `stored_path` VARCHAR(512) NOT NULL,
  `stored_filename` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `size_bytes` INT NOT NULL,
  `sha256` CHAR(64) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`attachment_id`),
  KEY `idx_client_intake_attachments_intake_id` (`intake_id`),
  CONSTRAINT `fk_client_intake_attachments_intake` FOREIGN KEY (`intake_id`) REFERENCES `ClientIntakePackets` (`intake_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rbac_permissions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `perm_key` VARCHAR(160) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `perm_group` VARCHAR(80) NOT NULL DEFAULT 'general',
  `app_scope` VARCHAR(32) NOT NULL DEFAULT 'launchpad',
  `sort_order` INT NOT NULL DEFAULT 0,
  UNIQUE KEY `uq_perm_key` (`perm_key`),
  KEY `idx_group` (`perm_group`),
  KEY `idx_scope` (`app_scope`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rbac_role_grants` (
  `role_name` VARCHAR(64) NOT NULL,
  `permission_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`role_name`, `permission_id`),
  CONSTRAINT `fk_rbac_perm_lp` FOREIGN KEY (`permission_id`) REFERENCES `rbac_permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

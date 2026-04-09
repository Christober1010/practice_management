-- ============================================
-- COMPLETE DATABASE MIGRATION FOR PRODUCTION
-- All tables in correct dependency order
-- Safe to run multiple times (IF NOT EXISTS)
-- ============================================

-- ============================================
-- STEP 1: Standalone Master Tables (No Dependencies)
-- ============================================

CREATE TABLE IF NOT EXISTS `master_insurance` (
 `insurance_id` int NOT NULL AUTO_INCREMENT,
 `insurance_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
 PRIMARY KEY (`insurance_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `master_domains` (
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `NAME` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
 `description` text COLLATE utf8mb4_general_ci,
 `STATUS` enum('Active','Inactive') COLLATE utf8mb4_general_ci DEFAULT 'Active',
 `archived` tinyint(1) DEFAULT '0',
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `master_modules` (
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `NAME` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
 `description` text COLLATE utf8mb4_general_ci,
 `STATUS` enum('Active','Inactive') COLLATE utf8mb4_general_ci DEFAULT 'Active',
 `archived` tinyint(1) DEFAULT '0',
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `master_prompts` (
 `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
 `prompt_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
 `max_score` int DEFAULT '0',
 `score_as_independent` tinyint(1) DEFAULT '0',
 `dtt` tinyint(1) DEFAULT '0',
 `ta` tinyint(1) DEFAULT '0',
 `maintenance` tinyint(1) DEFAULT '0',
 `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 UNIQUE KEY `prompt_name` (`prompt_name`),
 KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `master_service_code` (
 `code_id` int NOT NULL AUTO_INCREMENT,
 `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
 `code_description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`code_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `master_providers` (
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `provider_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
 `provider_code` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
 `email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
 `phone` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
 `fax` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
 `address1` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
 `address2` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
 `city` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
 `state` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
 `country` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
 `zip_code` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
 `status` enum('Active','Inactive') COLLATE utf8mb4_general_ci DEFAULT 'Active',
 `archived` tinyint(1) DEFAULT '0',
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 UNIQUE KEY `uk_provider_code` (`provider_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `prompts` (
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `prompt_text` text COLLATE utf8mb4_general_ci NOT NULL,
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `reports` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `client_first_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `client_last_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `client_middle_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `staff_first_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `staff_last_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `staff_middle_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `name_of_rbt_supervised` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `payer` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `activity_type` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `location_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `authorization_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `service_code_with_modifiers` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `dos` date DEFAULT NULL,
 `apt_start_time` time DEFAULT NULL,
 `apt_end_time` time DEFAULT NULL,
 `duration_schedule_in_min` int DEFAULT NULL,
 `duration_schedule_in_hrs` decimal(5,2) DEFAULT NULL,
 `rendered_date` date DEFAULT NULL,
 `rendered_start_time` time DEFAULT NULL,
 `rendered_end_time` time DEFAULT NULL,
 `duration_render_in_min` int DEFAULT NULL,
 `duration_render_in_hrs` decimal(5,2) DEFAULT NULL,
 `session_completion_latency_hrs` decimal(6,2) DEFAULT NULL,
 `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `STATUS` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `non_billable_notes` text COLLATE utf8mb4_unicode_ci,
 `billable` tinyint(1) DEFAULT NULL,
 `office` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `rendering_provider_first_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `rendering_provider_last_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `rendering_provider_middlename` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `created_by` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `created_date` datetime DEFAULT NULL,
 `notes` text COLLATE utf8mb4_unicode_ci,
 `staff_signature_on_file` tinyint(1) DEFAULT NULL,
 `staff_sign_date` datetime DEFAULT NULL,
 `approx_location_staff_sign` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `guardian_signature_on_file` tinyint(1) DEFAULT NULL,
 `guardian_sign_date` datetime DEFAULT NULL,
 `approx_location_guardian_sign` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `direct_or_indirect_service` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `make_up_session` tinyint(1) DEFAULT NULL,
 `make_up_session_hours` decimal(5,2) DEFAULT NULL,
 `exclude_from_payroll` tinyint(1) DEFAULT NULL,
 `exclude_from_mileage` tinyint(1) DEFAULT NULL,
 `archived` tinyint(1) DEFAULT '0',
 PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STEP 2: Master Tables with Dependencies
-- ============================================

CREATE TABLE IF NOT EXISTS `master_programs` (
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `domain_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `NAME` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
 `description` text COLLATE utf8mb4_general_ci,
 `STATUS` enum('Active','Inactive') COLLATE utf8mb4_general_ci DEFAULT 'Active',
 `archived` tinyint(1) DEFAULT '0',
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `idx_domain_id` (`domain_id`),
 CONSTRAINT `master_programs_ibfk_1` FOREIGN KEY (`domain_id`) REFERENCES `master_domains` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `master_targets` (
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `program_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `NAME` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
 `goal_description` text COLLATE utf8mb4_general_ci,
 `trials` int DEFAULT '1',
 `activity_type` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
 `instructions` text COLLATE utf8mb4_general_ci,
 `prompts` json DEFAULT NULL,
 `STATUS` enum('Active','Inactive') COLLATE utf8mb4_general_ci DEFAULT 'Active',
 `archived` tinyint(1) DEFAULT '0',
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `idx_program_id` (`program_id`),
 CONSTRAINT `master_targets_ibfk_1` FOREIGN KEY (`program_id`) REFERENCES `master_programs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- STEP 3: Master Association Tables
-- ============================================

CREATE TABLE IF NOT EXISTS `master_target_prompts` (
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `target_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `prompt_text` longtext COLLATE utf8mb4_general_ci NOT NULL,
 `prompt_order` int DEFAULT '0',
 `STATUS` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'Active',
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 `prompt_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 PRIMARY KEY (`id`),
 KEY `idx_target_id` (`target_id`),
 KEY `idx_status` (`STATUS`),
 KEY `idx_prompt_id` (`prompt_id`),
 CONSTRAINT `fk_prompt_id` FOREIGN KEY (`prompt_id`) REFERENCES `master_prompts` (`id`) ON DELETE SET NULL,
 CONSTRAINT `master_target_prompts_ibfk_1` FOREIGN KEY (`target_id`) REFERENCES `master_targets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `master_target_tasks` (
 `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
 `activity_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
 `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
 `step_order` int NOT NULL,
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `idx_activity_id` (`activity_id`),
 CONSTRAINT `activity_tasks_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `master_targets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `master_assign_service_code` (
 `service_id` int NOT NULL,
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `insurance_id` int NOT NULL,
 `code_id` int NOT NULL,
 `billable` enum('Yes','No') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Yes',
 `required_auth` enum('Yes','No') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Yes',
 `unit_duration` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '15',
 `unit_type` enum('Hour(s)','Minute(s)','Per Session') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Minute(s)',
 `unit_rate` decimal(10,2) DEFAULT NULL,
 `unit_currency` enum('USD') COLLATE utf8mb4_general_ci DEFAULT 'USD',
 PRIMARY KEY (`id`),
 UNIQUE KEY `uk_id` (`id`),
 KEY `insurance_id` (`insurance_id`),
 KEY `code_id` (`code_id`),
 CONSTRAINT `master_assign_service_code_ibfk_1` FOREIGN KEY (`insurance_id`) REFERENCES `master_insurance` (`insurance_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
 CONSTRAINT `master_assign_service_code_ibfk_2` FOREIGN KEY (`code_id`) REFERENCES `master_service_code` (`code_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- STEP 4: Client Tables (Depend on clients table)
-- ============================================

CREATE TABLE IF NOT EXISTS `client_domains` (
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `client_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `NAME` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
 `description` text COLLATE utf8mb4_general_ci,
 `STATUS` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'Active',
 `archived` tinyint(1) DEFAULT '0',
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `idx_client_id` (`client_id`),
 CONSTRAINT `fk_domains_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `client_modules` (
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `client_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `NAME` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
 `description` text COLLATE utf8mb4_general_ci,
 `STATUS` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'Active',
 `archived` tinyint(1) DEFAULT '0',
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `idx_client_id` (`client_id`),
 CONSTRAINT `fk_modules_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `client_programs` (
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `client_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `domain_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `NAME` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
 `description` text COLLATE utf8mb4_general_ci,
 `STATUS` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'Active',
 `archived` tinyint(1) DEFAULT '0',
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `idx_client_id` (`client_id`),
 KEY `idx_domain_id` (`domain_id`),
 CONSTRAINT `fk_programs_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `fk_programs_domain` FOREIGN KEY (`domain_id`) REFERENCES `client_domains` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `client_targets` (
 `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 `client_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 `program_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `NAME` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `goal_description` text COLLATE utf8mb4_unicode_ci,
 `trials` int DEFAULT '1',
 `activity_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `instructions` text COLLATE utf8mb4_unicode_ci,
 `STATUS` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
 `archived` tinyint(1) DEFAULT '0',
 `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
 `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `idx_client_id` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `client_targets_old` (
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `client_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `program_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `NAME` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
 `goal_description` text COLLATE utf8mb4_general_ci,
 `trials` int DEFAULT '1',
 `activity_type` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
 `instructions` text COLLATE utf8mb4_general_ci,
 `STATUS` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'Active',
 `archived` tinyint(1) DEFAULT '0',
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `idx_client_id` (`client_id`),
 KEY `idx_program_id` (`program_id`),
 CONSTRAINT `fk_targets_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `fk_targets_program` FOREIGN KEY (`program_id`) REFERENCES `client_programs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- STEP 5: Client Association Tables
-- ============================================

CREATE TABLE IF NOT EXISTS `client_target_prompts` (
  `id` varchar(36) NOT NULL,
  `target_id` varchar(36) NOT NULL,
  `prompt_id` varchar(36) NOT NULL,
  `prompt_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_target_id` (`target_id`),
  KEY `idx_prompt_id` (`prompt_id`),
  CONSTRAINT `client_target_prompts_ibfk_1` FOREIGN KEY (`target_id`) REFERENCES `client_targets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `client_target_prompts_ibfk_2` FOREIGN KEY (`prompt_id`) REFERENCES `master_prompts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `client_target_tasks` (
 `id` varchar(36) NOT NULL,
 `client_id` varchar(36) NOT NULL,
 `activity_id` varchar(36) NOT NULL,
 `name` varchar(255) NOT NULL,
 `step_order` int NOT NULL,
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `idx_client_activity_id` (`client_id`, `activity_id`),
 KEY `idx_activity_id` (`activity_id`),
 CONSTRAINT `client_activity_tasks_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `client_targets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STEP 6: Session Notes Tables (From Previous Migration)
-- ============================================

CREATE TABLE IF NOT EXISTS `client_session_notes` (
  `id` varchar(36) NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `target_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_date` date NOT NULL,
  `trial_number` int NOT NULL,
  `trial_outcome` varchar(50) NOT NULL COMMENT 'Correct, Gestural Prompt, Partial Physical, Full Physical, Verbal Prompt, Incorrect',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_target` (`client_id`, `target_id`),
  KEY `idx_session_date` (`session_date`),
  KEY `idx_target_id` (`target_id`),
  CONSTRAINT `fk_session_notes_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_notes_target` FOREIGN KEY (`target_id`) REFERENCES `client_targets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `client_session_note_entries` (
  `id` VARCHAR(36) NOT NULL,
  `client_id` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `session_date` DATE NOT NULL,
  `session_id` VARCHAR(36) DEFAULT NULL,
  `payload` LONGTEXT NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_client_session_date` (`client_id`, `session_date`),
  KEY `idx_session_id` (`session_id`),
  CONSTRAINT `fk_session_entry_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STEP 7: Manage Data Tables (Provider, Service Code, Diagnosis, Provider Service Code Mapping)
-- ============================================

-- Master Diagnosis Codes
CREATE TABLE IF NOT EXISTS `master_diagnosis` (
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `diagnosis_code` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
 `diagnosis_description` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
 `archived` tinyint(1) DEFAULT '0',
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 UNIQUE KEY `uk_diagnosis_code` (`diagnosis_code`, `archived`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Provider Service Code Mapping (links providers to service codes with rate/unit info)
CREATE TABLE IF NOT EXISTS `master_provider_service_code` (
 `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `provider_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
 `service_code_id` int NOT NULL,
 `unit_duration` varchar(20) COLLATE utf8mb4_general_ci DEFAULT '15',
 `unit_type` enum('Hour(s)','Minute(s)','Per Session') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Minute(s)',
 `rate` decimal(10,2) DEFAULT NULL,
 `status` enum('Active','Inactive') COLLATE utf8mb4_general_ci DEFAULT 'Active',
 `archived` tinyint(1) DEFAULT '0',
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `idx_provider_id` (`provider_id`),
 KEY `idx_service_code_id` (`service_code_id`),
 CONSTRAINT `fk_provider_service_code_provider` FOREIGN KEY (`provider_id`) REFERENCES `master_providers` (`id`) ON DELETE CASCADE,
 CONSTRAINT `fk_provider_service_code_service` FOREIGN KEY (`service_code_id`) REFERENCES `master_service_code` (`code_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- MIGRATION COMPLETE
-- All tables created in correct dependency order
-- Safe to run multiple times (IF NOT EXISTS)
-- ============================================


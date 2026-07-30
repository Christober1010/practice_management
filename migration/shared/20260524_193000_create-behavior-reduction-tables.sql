-- Behavior Reduction two-layer schema (master + client + session data)
-- Safe to run multiple times (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS `master_behavior_categories` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `status` enum('Active','Inactive') COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `master_behaviors` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `category_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `goal_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `function` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `definition` text COLLATE utf8mb4_general_ci,
  `recording_type` varchar(64) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Frequency',
  `do_not_zero_out` tinyint(1) DEFAULT '0',
  `exclude_from_abc` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `status` enum('Active','Inactive') COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category_id` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `client_behaviors` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `master_behavior_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `category_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `goal_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `function` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `definition` text COLLATE utf8mb4_general_ci,
  `recording_type` varchar(64) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Frequency',
  `do_not_zero_out` tinyint(1) DEFAULT '0',
  `exclude_from_abc` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `status` enum('Active','Inactive') COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_client_active` (`client_id`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `client_abc_antecedents` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_id` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `client_abc_consequences` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_id` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `client_abc_locations` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_id` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `client_session_behavior_data` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `session_id` int DEFAULT NULL,
  `session_date` date NOT NULL,
  `behavior_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `recording_type` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `value_json` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_date` (`client_id`, `session_date`),
  KEY `idx_behavior_id` (`behavior_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `client_session_abc_data` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `session_id` int DEFAULT NULL,
  `session_date` date NOT NULL,
  `antecedent_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `behavior_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `consequence_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `location_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_date` (`client_id`, `session_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

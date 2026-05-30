-- ============================================
-- MANAGE DATA TABLES MIGRATION
-- Creates tables for Provider, Service Code, Diagnosis, and Provider Service Code Mapping
-- Safe to run multiple times (IF NOT EXISTS)
-- ============================================

-- ============================================
-- Master Providers Table
-- ============================================
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

-- ============================================
-- Master Diagnosis Codes Table
-- ============================================
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

-- ============================================
-- Provider Service Code Mapping Table
-- Links providers to service codes with rate/unit info
-- ============================================
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
-- ============================================


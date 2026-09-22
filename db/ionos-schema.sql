-- phpMyAdmin SQL Dump
-- version 4.9.11
-- https://www.phpmyadmin.net/
--
-- Host: db5018266079.hosting-data.io
-- Generation Time: Sep 21, 2026 at 05:19 PM
-- Server version: 8.0.36
-- PHP Version: 7.4.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `dbs14484433`
--

-- --------------------------------------------------------

--
-- Table structure for table `AuthTokens`
--

CREATE TABLE `AuthTokens` (
  `id` int UNSIGNED NOT NULL,
  `user_id` int NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `clearing_house_settings`
--

CREATE TABLE `clearing_house_settings` (
  `id` tinyint UNSIGNED NOT NULL DEFAULT '1',
  `provider_key` varchar(32) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'office_ally',
  `environment` varchar(16) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'test',
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `sftp_host` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sftp_port` int NOT NULL DEFAULT '22',
  `sftp_user` varchar(128) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sftp_password` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sftp_remote_dir` varchar(128) COLLATE utf8mb4_general_ci DEFAULT 'inbound',
  `sftp_reports_dir` varchar(128) COLLATE utf8mb4_general_ci DEFAULT 'outbound',
  `isa_sender_id` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `isa_sender_qualifier` varchar(4) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'ZZ',
  `isa_receiver_qualifier` varchar(4) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'ZZ',
  `gs_sender_code` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `gs_receiver_code` varchar(16) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'OA',
  `submitter_name` varchar(128) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `receiver_id` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `receiver_name` varchar(64) COLLATE utf8mb4_general_ci DEFAULT 'OFFICE ALLY',
  `file_prefix` varchar(16) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '837P',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` varchar(128) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `clients`
--

CREATE TABLE `clients` (
  `client_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `client_uuid` varchar(16) COLLATE utf8mb4_general_ci NOT NULL,
  `client_status` varchar(64) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'New',
  `wait_list_status` enum('Yes','No') COLLATE utf8mb4_general_ci DEFAULT 'No',
  `first_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `middle_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `date_of_birth` date NOT NULL,
  `gender` enum('Male','Female','Other','Prefer not to say') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `parent_first_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `parent_last_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `relationship_to_insured` enum('Self','Guardian','Other','Spouse','Parent') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Self',
  `relation_other` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `preferred_language` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `insurance` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `state` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `zipcode` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'USA',
  `phone` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `appointment_reminder` enum('sms','email','phone','none','both') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'both',
  `emergency_contact_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `emg_relationship` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `emg_phone` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `emg_email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `client_notes` text COLLATE utf8mb4_general_ci,
  `other_information` text COLLATE utf8mb4_general_ci,
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `service_location` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Home',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Client active status (separate from workflow status)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_abc_antecedents`
--

CREATE TABLE `client_abc_antecedents` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_abc_consequences`
--

CREATE TABLE `client_abc_consequences` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_abc_locations`
--

CREATE TABLE `client_abc_locations` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_addresses`
--

CREATE TABLE `client_addresses` (
  `id` int NOT NULL,
  `client_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `service_location` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Home',
  `location` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `city` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `state` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `zipcode` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'USA',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_auth`
--

CREATE TABLE `client_auth` (
  `auth_id` int NOT NULL,
  `auth_uuid` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `insurance_id` int DEFAULT NULL,
  `authorization_number` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `billing_codes` text COLLATE utf8mb4_general_ci,
  `units_approved_per_15_min` int DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` enum('Active','Inactive','Expired') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Active',
  `units_serviced` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '',
  `balance_units` varchar(255) COLLATE utf8mb4_general_ci DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_availability`
--

CREATE TABLE `client_availability` (
  `id` int NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `day` enum('monday','tuesday','wednesday','thursday','friday','saturday','sunday') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `available` tinyint(1) DEFAULT '0',
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_behaviors`
--

CREATE TABLE `client_behaviors` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `master_behavior_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `category_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `goal_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `function` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `definition` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `recording_type` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Frequency',
  `do_not_zero_out` tinyint(1) DEFAULT '0',
  `exclude_from_abc` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `status` enum('Active','Inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_doc`
--

CREATE TABLE `client_doc` (
  `doc_id` int NOT NULL,
  `doc_uuid` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `document_type` enum('Insurance','intake doc','clinical doc','service doc','misc') COLLATE utf8mb4_general_ci DEFAULT 'misc',
  `document_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `document_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_documents`
--

CREATE TABLE `client_documents` (
  `doc_id` int NOT NULL,
  `doc_uuid` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `document_type` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `file_url` varchar(2048) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `document_original_filename` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_domains`
--

CREATE TABLE `client_domains` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `module_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `NAME` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `STATUS` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_insurance`
--

CREATE TABLE `client_insurance` (
  `insurance_id` int NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `insurance_type` enum('Primary','Secondary') COLLATE utf8mb4_general_ci DEFAULT 'Primary',
  `insurance_provider` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `provider_staff_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `treatment_type` varchar(255) COLLATE utf8mb4_general_ci DEFAULT 'Behavioral therapy',
  `rendering_provider` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `authorization_number` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `insurance_id_number` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `group_number` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `diagnosis_1` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `diagnosis_2` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `diagnosis_3` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `diagnosis_4` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `diagnosis_5` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `coinsurance` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `deductible` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `copay_per` enum('hr','Day','Week','month','yr') COLLATE utf8mb4_general_ci DEFAULT 'hr',
  `copay_rate` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `primary_diagnosis` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Primary diagnosis code for this insurance',
  `insurance_provider_id` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Reference to master_providers.id',
  `insurance_document_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Path to insurance document (Drive path or local path)',
  `insurance_document_filename` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Filename or Drive file ID for insurance document',
  `carrier_payer_id` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Carrier Payer ID',
  `insurance_company_address` text COLLATE utf8mb4_general_ci COMMENT 'Insurance company address',
  `insurance_issue_date` date DEFAULT NULL COMMENT 'Insurance issue date',
  `insurance_plan_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Insurance plan name',
  `date_of_signature` date DEFAULT NULL COMMENT 'Date of signature',
  `authorized_payment_box13` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'Signature on File' COMMENT 'Authorized Payment (Box 13)',
  `authorized_release_box12` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'Signature on File' COMMENT 'Authorization Release (Box 12)',
  `authorized_release_box17` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'Signature on File' COMMENT 'Authorized Release (Box 17)',
  `additional_claim_info_box19` text COLLATE utf8mb4_general_ci COMMENT 'Additional Claim Information (Box 19)',
  `do_not_accept_assignment_box27` tinyint(1) DEFAULT '0' COMMENT 'Do Not Accept Assignment (Box 27)',
  `insurance_notes` text COLLATE utf8mb4_general_ci COMMENT 'General insurance notes',
  `primary_insurance_notes` text COLLATE utf8mb4_general_ci COMMENT 'Primary insurance specific notes',
  `insured_same_as_client` tinyint(1) DEFAULT '1' COMMENT 'Insured person is the same as client',
  `insurance_inactive` tinyint(1) DEFAULT '0' COMMENT 'Insurance inactive flag',
  `delete_insurance` tinyint(1) DEFAULT '0' COMMENT 'Mark insurance for deletion'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_modules`
--

CREATE TABLE `client_modules` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `NAME` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `STATUS` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_notes`
--

CREATE TABLE `client_notes` (
  `note_id` int NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `note` text COLLATE utf8mb4_general_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_programs`
--

CREATE TABLE `client_programs` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `domain_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `NAME` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `STATUS` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_service`
--

CREATE TABLE `client_service` (
  `service_id` int NOT NULL,
  `service_uuid` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `auth_id` int DEFAULT NULL,
  `service_code` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `frequency` enum('Hours','Minutes') COLLATE utf8mb4_general_ci DEFAULT 'Hours',
  `total_units` int DEFAULT NULL,
  `scheduled_units` int DEFAULT NULL,
  `rendered_units` int DEFAULT NULL,
  `remaining_units` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_session_abc_data`
--

CREATE TABLE `client_session_abc_data` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `session_id` int DEFAULT NULL,
  `session_date` date NOT NULL,
  `antecedent_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `behavior_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `consequence_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `location_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_session_behavior_data`
--

CREATE TABLE `client_session_behavior_data` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `session_id` int DEFAULT NULL,
  `session_date` date NOT NULL,
  `behavior_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `recording_type` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `value_json` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_session_notes`
--

CREATE TABLE `client_session_notes` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `target_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_date` date NOT NULL,
  `trial_number` int NOT NULL,
  `trial_outcome` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Correct, Gestural Prompt, Partial Physical, Full Physical, Verbal Prompt, Incorrect',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_session_note_entries`
--

CREATE TABLE `client_session_note_entries` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `session_date` date NOT NULL,
  `session_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_targets`
--

CREATE TABLE `client_targets` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `program_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `NAME` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `goal_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `trials` int DEFAULT '1',
  `activity_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `instructions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `STATUS` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_targets_old`
--

CREATE TABLE `client_targets_old` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `program_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `NAME` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `goal_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `trials` int DEFAULT '1',
  `activity_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `instructions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `STATUS` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_target_prompts`
--

CREATE TABLE `client_target_prompts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prompt_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prompt_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `client_target_tasks`
--

CREATE TABLE `client_target_tasks` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activity_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `step_order` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `GoogleDriveOAuthTokens`
--

CREATE TABLE `GoogleDriveOAuthTokens` (
  `id` int NOT NULL,
  `refresh_token_encrypted` text COLLATE utf8mb4_general_ci NOT NULL,
  `connected_by_user_id` int DEFAULT NULL,
  `connected_by_username` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `locations`
--

CREATE TABLE `locations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tax_id_professional` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `office_phone_number` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `office_phone_ext` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `time_zone` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `location_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location_description` text COLLATE utf8mb4_unicode_ci,
  `facility_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `facility_npi_number` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `facility_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `facility_address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `facility_apt_unit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `facility_country` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'US',
  `facility_city` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `facility_state` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `facility_zip_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `taxonomy_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `billing_npi_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `billing_provider_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `billing_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `billing_apt_unit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `billing_country` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'US',
  `billing_city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `billing_state` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `billing_zip_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `STATUS` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_assign_service_code`
--

CREATE TABLE `master_assign_service_code` (
  `service_id` int NOT NULL,
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `insurance_id` int NOT NULL,
  `code_id` int NOT NULL,
  `billable` enum('Yes','No') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Yes',
  `required_auth` enum('Yes','No') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Yes',
  `unit_duration` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '15',
  `unit_type` enum('Hour(s)','Minute(s)','Per Session') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Minute(s)',
  `unit_rate` decimal(10,2) DEFAULT NULL,
  `unit_currency` enum('USD') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'USD'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_behaviors`
--

CREATE TABLE `master_behaviors` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `category_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `goal_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `function` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `definition` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `recording_type` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Frequency',
  `do_not_zero_out` tinyint(1) DEFAULT '0',
  `exclude_from_abc` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `status` enum('Active','Inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_behavior_categories`
--

CREATE TABLE `master_behavior_categories` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `status` enum('Active','Inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_diagnosis`
--

CREATE TABLE `master_diagnosis` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `diagnosis_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `diagnosis_description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_document_types`
--

CREATE TABLE `master_document_types` (
  `id` varchar(36) NOT NULL,
  `type_name` varchar(255) NOT NULL,
  `description` text,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `archived` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_domains`
--

CREATE TABLE `master_domains` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `module_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `NAME` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `STATUS` enum('Active','Inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_facility_types`
--

CREATE TABLE `master_facility_types` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pos_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `facility_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `active` tinyint(1) DEFAULT '1',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_insurance`
--

CREATE TABLE `master_insurance` (
  `insurance_id` int NOT NULL,
  `insurance_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_modules`
--

CREATE TABLE `master_modules` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `NAME` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `STATUS` enum('Active','Inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_programs`
--

CREATE TABLE `master_programs` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `domain_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `NAME` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `STATUS` enum('Active','Inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_prompts`
--

CREATE TABLE `master_prompts` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `prompt_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `max_score` int DEFAULT '0',
  `score_as_independent` tinyint(1) DEFAULT '0',
  `dtt` tinyint(1) DEFAULT '0',
  `ta` tinyint(1) DEFAULT '0',
  `maintenance` tinyint(1) DEFAULT '0',
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_providers`
--

CREATE TABLE `master_providers` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `provider_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `provider_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `fax` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `city` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `state` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `zip_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('Active','Inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `edi_payer` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'EDI Payer Yes/No',
  `technician_is_rendering_provider` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Technician is Rendering Provider Yes/No'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_provider_service_code`
--

CREATE TABLE `master_provider_service_code` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `provider_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `service_code_id` int NOT NULL,
  `unit_duration` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '15',
  `unit_type` enum('Hour(s)','Minute(s)','Per Session') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Minute(s)',
  `rate` decimal(10,2) DEFAULT NULL,
  `status` enum('Active','Inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `billable` enum('Yes','No') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Yes',
  `authorization_required` enum('Yes','No') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Yes',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_service_code`
--

CREATE TABLE `master_service_code` (
  `code_id` int NOT NULL,
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `code_description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `supervising_provider_rule` varchar(64) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_targets`
--

CREATE TABLE `master_targets` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `program_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `NAME` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `goal_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `trials` int DEFAULT '1',
  `activity_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `instructions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `prompts` json DEFAULT NULL,
  `STATUS` enum('Active','Inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_target_prompts`
--

CREATE TABLE `master_target_prompts` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `target_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `prompt_text` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `prompt_order` int DEFAULT '0',
  `STATUS` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `prompt_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_target_tasks`
--

CREATE TABLE `master_target_tasks` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `activity_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `step_order` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_treatment_types`
--

CREATE TABLE `master_treatment_types` (
  `id` varchar(36) NOT NULL,
  `treatment_name` varchar(255) NOT NULL,
  `description` text,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `archived` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `mileage_claims`
--

CREATE TABLE `mileage_claims` (
  `id` bigint UNSIGNED NOT NULL,
  `provider_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `claim_date` date NOT NULL,
  `rate_per_mile` decimal(8,4) NOT NULL,
  `total_miles` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_cost` decimal(10,2) NOT NULL DEFAULT '0.00',
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'submitted' COMMENT 'draft | submitted | approved | void',
  `payment_status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending_payment' COMMENT 'pending_payment | paid',
  `pay_date` date DEFAULT NULL COMMENT 'Required when payment_status = paid',
  `check_number` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Required when payment_status = paid',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `mileage_legs`
--

CREATE TABLE `mileage_legs` (
  `id` bigint UNSIGNED NOT NULL,
  `claim_id` bigint UNSIGNED NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `from_session_id` int DEFAULT NULL,
  `to_session_id` int DEFAULT NULL,
  `from_stop_key` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'home:{provider_id} or session:{id}',
  `to_stop_key` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `from_label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `to_label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_address` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_address` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `from_lat` decimal(10,7) DEFAULT NULL,
  `from_lng` decimal(10,7) DEFAULT NULL,
  `to_lat` decimal(10,7) DEFAULT NULL,
  `to_lng` decimal(10,7) DEFAULT NULL,
  `miles` decimal(10,2) NOT NULL DEFAULT '0.00',
  `cost` decimal(10,2) NOT NULL DEFAULT '0.00',
  `excluded` tinyint(1) NOT NULL DEFAULT '0',
  `is_home_leg` tinyint(1) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `mileage_settings`
--

CREATE TABLE `mileage_settings` (
  `id` tinyint UNSIGNED NOT NULL DEFAULT '1',
  `rate_per_mile` decimal(8,4) NOT NULL DEFAULT '0.4500' COMMENT 'USD (or currency) reimbursed per mile',
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USD',
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_resets`
--

CREATE TABLE `password_resets` (
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `otp_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `attempts` int DEFAULT '0',
  `is_verified` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payer_payment_entries`
--

CREATE TABLE `payer_payment_entries` (
  `id` bigint UNSIGNED NOT NULL,
  `report_id` int UNSIGNED DEFAULT NULL COMMENT 'reports.id',
  `client_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `insurance_id` int NOT NULL,
  `dos` date NOT NULL,
  `service_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `coinsurance_amount` decimal(12,2) DEFAULT NULL,
  `copay_amount` decimal(12,2) DEFAULT NULL,
  `deductible_amount` decimal(12,2) DEFAULT NULL,
  `payer_paid_amount` decimal(12,2) DEFAULT NULL,
  `check_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ap_invoice` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Accounts payable invoice reference',
  `ap_date` date DEFAULT NULL COMMENT 'Accounts payable date',
  `bank_deposited_at` datetime DEFAULT NULL COMMENT 'When check was deposited to bank (Received Payment)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `prompts`
--

CREATE TABLE `prompts` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `prompt_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rbac_permissions`
--

CREATE TABLE `rbac_permissions` (
  `id` int UNSIGNED NOT NULL,
  `perm_key` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `perm_group` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general',
  `app_scope` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mahaverse',
  `sort_order` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rbac_role_grants`
--

CREATE TABLE `rbac_role_grants` (
  `role_name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `permission_id` int UNSIGNED NOT NULL,
  `access_scope` enum('all','self') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reports`
--

CREATE TABLE `reports` (
  `id` int UNSIGNED NOT NULL,
  `client_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mahaverse clients.client_id',
  `provider_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'staff.id or rendering provider key',
  `client_first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_middle_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `staff_first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `staff_last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `staff_middle_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name_of_rbt_supervised` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payer` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activity_type` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `authorization_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `service_code_with_modifiers` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `STATUS` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `non_billable_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `billable` tinyint(1) DEFAULT NULL,
  `office` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rendering_provider_first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rendering_provider_last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rendering_provider_middlename` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `staff_signature_on_file` tinyint(1) DEFAULT NULL,
  `staff_sign_date` datetime DEFAULT NULL,
  `approx_location_staff_sign` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guardian_signature_on_file` tinyint(1) DEFAULT NULL,
  `guardian_sign_date` datetime DEFAULT NULL,
  `approx_location_guardian_sign` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direct_or_indirect_service` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `make_up_session` tinyint(1) DEFAULT NULL,
  `make_up_session_hours` decimal(5,2) DEFAULT NULL,
  `exclude_from_payroll` tinyint(1) DEFAULT NULL,
  `exclude_from_mileage` tinyint(1) DEFAULT NULL,
  `archived` tinyint(1) DEFAULT '0',
  `misc_hrs` decimal(5,2) DEFAULT NULL COMMENT 'Schedule tracker: misc hours',
  `tracker_status` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT 'Pending' COMMENT 'Schedule tracker workflow status'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `session_id` bigint UNSIGNED NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `provider_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `provider_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `supervising_provider_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `supervising_provider_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `start_utc` datetime NOT NULL,
  `end_utc` datetime NOT NULL,
  `start_tz` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `end_tz` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `auth_code` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `therapist_id_old` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tech_start_utc_old` datetime DEFAULT NULL,
  `tech_end_utc_old` datetime DEFAULT NULL,
  `tech_tz_old` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tech_auth_code_old` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tech_auth_id_old` int DEFAULT NULL,
  `bcba_start_utc_old` datetime DEFAULT NULL,
  `bcba_end_utc_old` datetime DEFAULT NULL,
  `bcba_tz_old` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bcba_auth_code_old` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bcba_auth_id_old` int DEFAULT NULL,
  `recurring` enum('No','Daily','Weekly','Biweekly','Monthly') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'No',
  `place_of_service` enum('Home','Clinic','School','Virtual','Other') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Clinic',
  `service_type` enum('Direct','Indirect') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Direct' COMMENT 'DIRECT or INDIRECT service',
  `location_address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `quick_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `STATUS` varchar(32) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Scheduled',
  `exclude_session` enum('Yes','No') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'No' COMMENT 'Exclude session from billing/reporting flows',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `recurring_days` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `authorized_hours` decimal(12,4) NOT NULL DEFAULT '0.0000' COMMENT 'Authorized units/hours for billing',
  `claim_id` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `claim_status` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `auth_id` int DEFAULT NULL COMMENT 'client_auth id or auth_id',
  `scheduled_hours` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `rendered_hours` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `recurring_id` int DEFAULT NULL COMMENT 'Links rows in a recurring series',
  `unit_rate` decimal(10,2) DEFAULT NULL COMMENT 'Per billing unit rate from master_provider_service_code at session save',
  `line_charge` decimal(10,2) DEFAULT NULL COMMENT 'CMS-1500 Box 24F line charge (unit_rate × billing units) at session save',
  `taxonomy_code` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Rendering provider taxonomy at session save (from staff.taxonomy_code)',
  `authorization_number` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Auth # from client_auth at session save',
  `service_code` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Primary billing/service code from client_auth at session save'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `session_log`
--

CREATE TABLE `session_log` (
  `id` bigint UNSIGNED NOT NULL,
  `session_id` int NOT NULL,
  `misc_hrs` decimal(5,2) DEFAULT NULL COMMENT 'Session log: misc / miss hours',
  `log_status` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Pending Payment | Received Payment; NULL = Rendered tray',
  `coinsurance_amount` decimal(12,2) DEFAULT NULL COMMENT 'Session log: co-insurance amount',
  `copay_amount` decimal(12,2) DEFAULT NULL COMMENT 'Session log: copay amount',
  `deductible_amount` decimal(12,2) DEFAULT NULL COMMENT 'Session log: deductible amount',
  `payer_paid_amount` decimal(12,2) DEFAULT NULL COMMENT 'Session log: payer paid amount',
  `check_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Session log: check number',
  `ap_invoice` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Session log: AP invoice reference',
  `ap_date` date DEFAULT NULL COMMENT 'Session log: AP date',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff`
--

CREATE TABLE `staff` (
  `id` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `firstName` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `lastName` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `fullName` varchar(510) COLLATE utf8mb4_general_ci NOT NULL,
  `staffType` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `certificationNumber` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `npiNumber` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_general_ci,
  `email` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `phone` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `dateOfJoining` date NOT NULL,
  `dateOfLeaving` date DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `availability` json DEFAULT NULL,
  `locationPreferences` json DEFAULT NULL,
  `archived` tinyint(1) DEFAULT '0',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `assignedStaff` json DEFAULT NULL,
  `assignedClients` json DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `location` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ssn_encrypted` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `job_title` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `state` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `zipcode` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) COLLATE utf8mb4_general_ci DEFAULT 'USA',
  `emergency_contact_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `emergency_relationship` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `emergency_phone` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `emergency_email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `highest_degree` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `year_awarded` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `major` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `taxonomy_code` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'NUCC taxonomy code (e.g. 103K00000X for Behavior Analyst)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff_assignments`
--

CREATE TABLE `staff_assignments` (
  `id` int NOT NULL,
  `staff_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `assigned_staff_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff_availability`
--

CREATE TABLE `staff_availability` (
  `id` int NOT NULL,
  `staff_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `day` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `available` tinyint(1) NOT NULL DEFAULT '0',
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff_certifications`
--

CREATE TABLE `staff_certifications` (
  `id` bigint NOT NULL,
  `staff_id` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `certification_type` enum('BCBA','RBT','BCaBA','Other') COLLATE utf8mb4_general_ci NOT NULL,
  `certification_number` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `issue_date` date NOT NULL,
  `expiry_date` date NOT NULL,
  `status` enum('Active','Expired') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff_client_assignments`
--

CREATE TABLE `staff_client_assignments` (
  `id` int NOT NULL,
  `staff_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff_documents`
--

CREATE TABLE `staff_documents` (
  `id` int NOT NULL,
  `staff_id` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `doc_uuid` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `document_type` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `document_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `document_filename` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `document_original_filename` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_url` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `PASSWORD` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `role` varchar(64) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `first_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_active` tinyint(1) DEFAULT '1',
  `link_staff_id` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Mahaverse staff.id for this login (self RBAC)',
  `link_client_id` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Mahaverse clients.client_id for client portal logins'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `AuthTokens`
--
ALTER TABLE `AuthTokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_token_hash` (`token_hash`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Indexes for table `clearing_house_settings`
--
ALTER TABLE `clearing_house_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `clients`
--
ALTER TABLE `clients`
  ADD PRIMARY KEY (`client_id`),
  ADD UNIQUE KEY `client_uuid` (`client_uuid`),
  ADD KEY `idx_clients_status` (`client_status`),
  ADD KEY `idx_clients_archived` (`archived`),
  ADD KEY `idx_clients_uuid` (`client_uuid`),
  ADD KEY `idx_clients_name` (`first_name`,`last_name`);

--
-- Indexes for table `client_abc_antecedents`
--
ALTER TABLE `client_abc_antecedents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_client_id` (`client_id`);

--
-- Indexes for table `client_abc_consequences`
--
ALTER TABLE `client_abc_consequences`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_client_id` (`client_id`);

--
-- Indexes for table `client_abc_locations`
--
ALTER TABLE `client_abc_locations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_client_id` (`client_id`);

--
-- Indexes for table `client_addresses`
--
ALTER TABLE `client_addresses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `client_id` (`client_id`);

--
-- Indexes for table `client_auth`
--
ALTER TABLE `client_auth`
  ADD PRIMARY KEY (`auth_id`),
  ADD UNIQUE KEY `auth_uuid` (`auth_uuid`),
  ADD KEY `idx_auth_insurance` (`insurance_id`);

--
-- Indexes for table `client_availability`
--
ALTER TABLE `client_availability`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_client_day` (`client_id`,`day`);

--
-- Indexes for table `client_behaviors`
--
ALTER TABLE `client_behaviors`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_client_id` (`client_id`),
  ADD KEY `idx_client_active` (`client_id`,`is_active`);

--
-- Indexes for table `client_doc`
--
ALTER TABLE `client_doc`
  ADD PRIMARY KEY (`doc_id`),
  ADD UNIQUE KEY `doc_uuid` (`doc_uuid`),
  ADD KEY `idx_doc_client` (`client_id`);

--
-- Indexes for table `client_documents`
--
ALTER TABLE `client_documents`
  ADD PRIMARY KEY (`doc_id`),
  ADD UNIQUE KEY `doc_uuid` (`doc_uuid`),
  ADD KEY `client_id` (`client_id`);

--
-- Indexes for table `client_domains`
--
ALTER TABLE `client_domains`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_client_id` (`client_id`),
  ADD KEY `idx_module_id` (`module_id`);

--
-- Indexes for table `client_insurance`
--
ALTER TABLE `client_insurance`
  ADD PRIMARY KEY (`insurance_id`),
  ADD KEY `idx_insurance_client` (`client_id`),
  ADD KEY `fk_provider_staff` (`provider_staff_id`);

--
-- Indexes for table `client_modules`
--
ALTER TABLE `client_modules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_client_id` (`client_id`);

--
-- Indexes for table `client_notes`
--
ALTER TABLE `client_notes`
  ADD PRIMARY KEY (`note_id`),
  ADD KEY `client_id` (`client_id`);

--
-- Indexes for table `client_programs`
--
ALTER TABLE `client_programs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_client_id` (`client_id`),
  ADD KEY `idx_domain_id` (`domain_id`);

--
-- Indexes for table `client_service`
--
ALTER TABLE `client_service`
  ADD PRIMARY KEY (`service_id`),
  ADD UNIQUE KEY `service_uuid` (`service_uuid`),
  ADD KEY `idx_service_auth` (`auth_id`);

--
-- Indexes for table `client_session_abc_data`
--
ALTER TABLE `client_session_abc_data`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_client_date` (`client_id`,`session_date`);

--
-- Indexes for table `client_session_behavior_data`
--
ALTER TABLE `client_session_behavior_data`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_client_date` (`client_id`,`session_date`),
  ADD KEY `idx_behavior_id` (`behavior_id`);

--
-- Indexes for table `client_session_notes`
--
ALTER TABLE `client_session_notes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_client_target` (`client_id`,`target_id`),
  ADD KEY `idx_session_date` (`session_date`),
  ADD KEY `idx_target_id` (`target_id`);

--
-- Indexes for table `client_session_note_entries`
--
ALTER TABLE `client_session_note_entries`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_client_session_id` (`client_id`,`session_id`),
  ADD KEY `idx_session_id` (`session_id`),
  ADD KEY `idx_note_entry_client` (`client_id`);

--
-- Indexes for table `client_targets`
--
ALTER TABLE `client_targets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_client_id` (`client_id`);

--
-- Indexes for table `client_targets_old`
--
ALTER TABLE `client_targets_old`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_client_id` (`client_id`),
  ADD KEY `idx_program_id` (`program_id`);

--
-- Indexes for table `client_target_prompts`
--
ALTER TABLE `client_target_prompts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_target_id` (`target_id`),
  ADD KEY `idx_prompt_id` (`prompt_id`);

--
-- Indexes for table `client_target_tasks`
--
ALTER TABLE `client_target_tasks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_client_activity_id` (`client_id`,`activity_id`),
  ADD KEY `idx_activity_id` (`activity_id`);

--
-- Indexes for table `GoogleDriveOAuthTokens`
--
ALTER TABLE `GoogleDriveOAuthTokens`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `locations`
--
ALTER TABLE `locations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_location_name` (`location_name`),
  ADD KEY `idx_facility_name` (`facility_name`),
  ADD KEY `idx_status` (`STATUS`),
  ADD KEY `idx_archived` (`archived`);

--
-- Indexes for table `master_assign_service_code`
--
ALTER TABLE `master_assign_service_code`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_id` (`id`),
  ADD KEY `insurance_id` (`insurance_id`),
  ADD KEY `code_id` (`code_id`);

--
-- Indexes for table `master_behaviors`
--
ALTER TABLE `master_behaviors`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_category_id` (`category_id`);

--
-- Indexes for table `master_behavior_categories`
--
ALTER TABLE `master_behavior_categories`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `master_diagnosis`
--
ALTER TABLE `master_diagnosis`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_diagnosis_code` (`diagnosis_code`,`archived`);

--
-- Indexes for table `master_document_types`
--
ALTER TABLE `master_document_types`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `master_domains`
--
ALTER TABLE `master_domains`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_module_id` (`module_id`);

--
-- Indexes for table `master_facility_types`
--
ALTER TABLE `master_facility_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `pos_code` (`pos_code`),
  ADD KEY `idx_pos_code` (`pos_code`),
  ADD KEY `idx_active` (`active`),
  ADD KEY `idx_archived` (`archived`);

--
-- Indexes for table `master_insurance`
--
ALTER TABLE `master_insurance`
  ADD PRIMARY KEY (`insurance_id`);

--
-- Indexes for table `master_modules`
--
ALTER TABLE `master_modules`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `master_programs`
--
ALTER TABLE `master_programs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_domain_id` (`domain_id`);

--
-- Indexes for table `master_prompts`
--
ALTER TABLE `master_prompts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `prompt_name` (`prompt_name`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `master_providers`
--
ALTER TABLE `master_providers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_provider_code` (`provider_code`);

--
-- Indexes for table `master_provider_service_code`
--
ALTER TABLE `master_provider_service_code`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_provider_id` (`provider_id`),
  ADD KEY `idx_service_code_id` (`service_code_id`);

--
-- Indexes for table `master_service_code`
--
ALTER TABLE `master_service_code`
  ADD PRIMARY KEY (`code_id`);

--
-- Indexes for table `master_targets`
--
ALTER TABLE `master_targets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_program_id` (`program_id`);

--
-- Indexes for table `master_target_prompts`
--
ALTER TABLE `master_target_prompts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_target_id` (`target_id`),
  ADD KEY `idx_status` (`STATUS`),
  ADD KEY `idx_prompt_id` (`prompt_id`);

--
-- Indexes for table `master_target_tasks`
--
ALTER TABLE `master_target_tasks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_activity_id` (`activity_id`);

--
-- Indexes for table `master_treatment_types`
--
ALTER TABLE `master_treatment_types`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `mileage_claims`
--
ALTER TABLE `mileage_claims`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_mileage_claim_provider_date` (`provider_id`,`claim_date`),
  ADD KEY `idx_mileage_claims_date` (`claim_date`),
  ADD KEY `idx_mileage_claims_payment_status` (`payment_status`);

--
-- Indexes for table `mileage_legs`
--
ALTER TABLE `mileage_legs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_mileage_legs_claim` (`claim_id`);

--
-- Indexes for table `mileage_settings`
--
ALTER TABLE `mileage_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `password_resets`
--
ALTER TABLE `password_resets`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `payer_payment_entries`
--
ALTER TABLE `payer_payment_entries`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_payer_payment_report_id` (`report_id`);

--
-- Indexes for table `prompts`
--
ALTER TABLE `prompts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `rbac_permissions`
--
ALTER TABLE `rbac_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_perm_key` (`perm_key`),
  ADD KEY `idx_group` (`perm_group`),
  ADD KEY `idx_scope` (`app_scope`);

--
-- Indexes for table `rbac_role_grants`
--
ALTER TABLE `rbac_role_grants`
  ADD PRIMARY KEY (`role_name`,`permission_id`),
  ADD KEY `fk_rbac_perm` (`permission_id`);

--
-- Indexes for table `reports`
--
ALTER TABLE `reports`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`session_id`),
  ADD KEY `idx_sessions_client_date` (`client_id`,`tech_start_utc_old`),
  ADD KEY `idx_sessions_date` (`tech_start_utc_old`),
  ADD KEY `idx_sessions_status` (`STATUS`),
  ADD KEY `fk_sessions_therapist` (`therapist_id_old`),
  ADD KEY `fk_sessions_tech_auth` (`tech_auth_id_old`),
  ADD KEY `fk_sessions_bcba_auth` (`bcba_auth_id_old`);

--
-- Indexes for table `session_log`
--
ALTER TABLE `session_log`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_session_log_session` (`session_id`);

--
-- Indexes for table `staff`
--
ALTER TABLE `staff`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `staff_assignments`
--
ALTER TABLE `staff_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_staff_assignment` (`staff_id`,`assigned_staff_id`),
  ADD KEY `assigned_staff_id` (`assigned_staff_id`);

--
-- Indexes for table `staff_availability`
--
ALTER TABLE `staff_availability`
  ADD PRIMARY KEY (`id`),
  ADD KEY `staff_id` (`staff_id`);

--
-- Indexes for table `staff_certifications`
--
ALTER TABLE `staff_certifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_staff_certifications_staff` (`staff_id`);

--
-- Indexes for table `staff_client_assignments`
--
ALTER TABLE `staff_client_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_staff_client_assignment` (`staff_id`,`client_id`),
  ADD KEY `client_id` (`client_id`);

--
-- Indexes for table `staff_documents`
--
ALTER TABLE `staff_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_staff_documents_staff` (`staff_id`),
  ADD KEY `idx_staff_documents_uuid` (`doc_uuid`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `AuthTokens`
--
ALTER TABLE `AuthTokens`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `client_addresses`
--
ALTER TABLE `client_addresses`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `client_auth`
--
ALTER TABLE `client_auth`
  MODIFY `auth_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `client_availability`
--
ALTER TABLE `client_availability`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `client_doc`
--
ALTER TABLE `client_doc`
  MODIFY `doc_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `client_documents`
--
ALTER TABLE `client_documents`
  MODIFY `doc_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `client_insurance`
--
ALTER TABLE `client_insurance`
  MODIFY `insurance_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `client_notes`
--
ALTER TABLE `client_notes`
  MODIFY `note_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `client_service`
--
ALTER TABLE `client_service`
  MODIFY `service_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `master_insurance`
--
ALTER TABLE `master_insurance`
  MODIFY `insurance_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `master_service_code`
--
ALTER TABLE `master_service_code`
  MODIFY `code_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `mileage_claims`
--
ALTER TABLE `mileage_claims`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `mileage_legs`
--
ALTER TABLE `mileage_legs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payer_payment_entries`
--
ALTER TABLE `payer_payment_entries`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rbac_permissions`
--
ALTER TABLE `rbac_permissions`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reports`
--
ALTER TABLE `reports`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sessions`
--
ALTER TABLE `sessions`
  MODIFY `session_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `session_log`
--
ALTER TABLE `session_log`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `staff_assignments`
--
ALTER TABLE `staff_assignments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `staff_availability`
--
ALTER TABLE `staff_availability`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `staff_certifications`
--
ALTER TABLE `staff_certifications`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `staff_client_assignments`
--
ALTER TABLE `staff_client_assignments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `staff_documents`
--
ALTER TABLE `staff_documents`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `AuthTokens`
--
ALTER TABLE `AuthTokens`
  ADD CONSTRAINT `fk_authtokens_user_mahaverse` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `client_addresses`
--
ALTER TABLE `client_addresses`
  ADD CONSTRAINT `client_addresses_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE;

--
-- Constraints for table `client_auth`
--
ALTER TABLE `client_auth`
  ADD CONSTRAINT `fk_client_auth_insurance` FOREIGN KEY (`insurance_id`) REFERENCES `client_insurance` (`insurance_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `client_availability`
--
ALTER TABLE `client_availability`
  ADD CONSTRAINT `fk_client_availability_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE;

--
-- Constraints for table `client_doc`
--
ALTER TABLE `client_doc`
  ADD CONSTRAINT `fk_client_doc_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `client_documents`
--
ALTER TABLE `client_documents`
  ADD CONSTRAINT `client_documents_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE;

--
-- Constraints for table `client_domains`
--
ALTER TABLE `client_domains`
  ADD CONSTRAINT `fk_domains_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `client_insurance`
--
ALTER TABLE `client_insurance`
  ADD CONSTRAINT `fk_insurance_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_provider_staff` FOREIGN KEY (`provider_staff_id`) REFERENCES `staff` (`id`);

--
-- Constraints for table `client_modules`
--
ALTER TABLE `client_modules`
  ADD CONSTRAINT `fk_modules_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `client_notes`
--
ALTER TABLE `client_notes`
  ADD CONSTRAINT `client_notes_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE;

--
-- Constraints for table `client_programs`
--
ALTER TABLE `client_programs`
  ADD CONSTRAINT `fk_programs_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_programs_domain` FOREIGN KEY (`domain_id`) REFERENCES `client_domains` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `client_service`
--
ALTER TABLE `client_service`
  ADD CONSTRAINT `fk_client_service_auth` FOREIGN KEY (`auth_id`) REFERENCES `client_auth` (`auth_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `client_session_notes`
--
ALTER TABLE `client_session_notes`
  ADD CONSTRAINT `fk_session_notes_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_session_notes_target` FOREIGN KEY (`target_id`) REFERENCES `client_targets` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `client_session_note_entries`
--
ALTER TABLE `client_session_note_entries`
  ADD CONSTRAINT `fk_session_entry_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE;

--
-- Constraints for table `client_targets_old`
--
ALTER TABLE `client_targets_old`
  ADD CONSTRAINT `fk_targets_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_targets_program` FOREIGN KEY (`program_id`) REFERENCES `client_programs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `client_target_prompts`
--
ALTER TABLE `client_target_prompts`
  ADD CONSTRAINT `client_target_prompts_ibfk_1` FOREIGN KEY (`target_id`) REFERENCES `client_targets` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `client_target_prompts_ibfk_2` FOREIGN KEY (`prompt_id`) REFERENCES `master_prompts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `client_target_tasks`
--
ALTER TABLE `client_target_tasks`
  ADD CONSTRAINT `client_activity_tasks_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `client_targets` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `master_assign_service_code`
--
ALTER TABLE `master_assign_service_code`
  ADD CONSTRAINT `master_assign_service_code_ibfk_1` FOREIGN KEY (`insurance_id`) REFERENCES `master_insurance` (`insurance_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `master_assign_service_code_ibfk_2` FOREIGN KEY (`code_id`) REFERENCES `master_service_code` (`code_id`) ON DELETE CASCADE ON UPDATE RESTRICT;

--
-- Constraints for table `master_programs`
--
ALTER TABLE `master_programs`
  ADD CONSTRAINT `master_programs_ibfk_1` FOREIGN KEY (`domain_id`) REFERENCES `master_domains` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `master_provider_service_code`
--
ALTER TABLE `master_provider_service_code`
  ADD CONSTRAINT `fk_provider_service_code_provider` FOREIGN KEY (`provider_id`) REFERENCES `master_providers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_provider_service_code_service` FOREIGN KEY (`service_code_id`) REFERENCES `master_service_code` (`code_id`) ON DELETE CASCADE;

--
-- Constraints for table `master_targets`
--
ALTER TABLE `master_targets`
  ADD CONSTRAINT `master_targets_ibfk_1` FOREIGN KEY (`program_id`) REFERENCES `master_programs` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `master_target_prompts`
--
ALTER TABLE `master_target_prompts`
  ADD CONSTRAINT `fk_prompt_id` FOREIGN KEY (`prompt_id`) REFERENCES `master_prompts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `master_target_prompts_ibfk_1` FOREIGN KEY (`target_id`) REFERENCES `master_targets` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `master_target_tasks`
--
ALTER TABLE `master_target_tasks`
  ADD CONSTRAINT `activity_tasks_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `master_targets` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `mileage_legs`
--
ALTER TABLE `mileage_legs`
  ADD CONSTRAINT `fk_mileage_legs_claim` FOREIGN KEY (`claim_id`) REFERENCES `mileage_claims` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `rbac_role_grants`
--
ALTER TABLE `rbac_role_grants`
  ADD CONSTRAINT `fk_rbac_perm` FOREIGN KEY (`permission_id`) REFERENCES `rbac_permissions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sessions`
--
ALTER TABLE `sessions`
  ADD CONSTRAINT `fk_sessions_bcba_auth` FOREIGN KEY (`bcba_auth_id_old`) REFERENCES `client_auth` (`auth_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sessions_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sessions_tech_auth` FOREIGN KEY (`tech_auth_id_old`) REFERENCES `client_auth` (`auth_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sessions_therapist` FOREIGN KEY (`therapist_id_old`) REFERENCES `staff` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `staff_assignments`
--
ALTER TABLE `staff_assignments`
  ADD CONSTRAINT `staff_assignments_ibfk_1` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `staff_assignments_ibfk_2` FOREIGN KEY (`assigned_staff_id`) REFERENCES `staff` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `staff_availability`
--
ALTER TABLE `staff_availability`
  ADD CONSTRAINT `staff_availability_ibfk_1` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `staff_certifications`
--
ALTER TABLE `staff_certifications`
  ADD CONSTRAINT `fk_staff_certifications_staff` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `staff_client_assignments`
--
ALTER TABLE `staff_client_assignments`
  ADD CONSTRAINT `staff_client_assignments_ibfk_1` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `staff_client_assignments_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

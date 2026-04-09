-- Session Notes Table for storing trial data
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


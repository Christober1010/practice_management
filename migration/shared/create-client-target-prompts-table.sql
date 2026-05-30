-- Creates a prompt association table for client targets (activities).
-- Stores ONLY associations to master prompts (by ID), not client-specific prompts.

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

-- If the table already exists but is missing prompt_id, run:
-- ALTER TABLE client_target_prompts ADD COLUMN prompt_id varchar(36) NOT NULL AFTER target_id;


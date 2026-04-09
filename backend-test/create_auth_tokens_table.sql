-- Token table for Bearer auth (main Mahaverse users table: `users`)
-- user_id must match users.id exactly (often INT signed, not INT UNSIGNED — see MySQL #3780).
CREATE TABLE IF NOT EXISTS `AuthTokens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` TIMESTAMP NULL DEFAULT NULL,
  `revoked_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_token_hash` (`token_hash`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `fk_authtokens_user_mahaverse` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Still #3780? Run SHOW CREATE TABLE `users`; — if `id` is BIGINT UNSIGNED, use BIGINT NOT NULL for user_id (and drop/recreate this table if needed).

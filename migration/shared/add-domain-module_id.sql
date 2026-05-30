-- Re-attach module_id to domains (parent module selection on domain create).
-- Safe to run when column already exists (skips via information_schema).

SET @db = DATABASE();

-- master_domains.module_id
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'master_domains' AND COLUMN_NAME = 'module_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `master_domains` ADD COLUMN `module_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL AFTER `id`, ADD INDEX `idx_module_id` (`module_id`)',
  'SELECT ''master_domains.module_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- client_domains.module_id
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'client_domains' AND COLUMN_NAME = 'module_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `client_domains` ADD COLUMN `module_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL AFTER `client_id`, ADD INDEX `idx_module_id` (`module_id`)',
  'SELECT ''client_domains.module_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

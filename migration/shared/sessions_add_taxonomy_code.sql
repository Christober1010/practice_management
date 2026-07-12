-- NUCC taxonomy code snapshot on session at schedule time (from rendering staff).
-- Safe to re-run: skips ALTER when column already exists.

SET @sess_db := DATABASE();

SET @taxonomy_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'taxonomy_code'
);
SET @taxonomy_sql := IF(@taxonomy_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `taxonomy_code` VARCHAR(20) NULL DEFAULT NULL COMMENT ''Rendering provider taxonomy at session save (from staff.taxonomy_code)''',
  'SELECT ''skip: sessions.taxonomy_code already exists'' AS sessions_migration_note'
);
PREPARE taxonomy_stmt FROM @taxonomy_sql;
EXECUTE taxonomy_stmt;
DEALLOCATE PREPARE taxonomy_stmt;

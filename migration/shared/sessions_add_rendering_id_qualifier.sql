-- CMS-1500 Box 24I rendering provider ID qualifier (e.g. ZZ for taxonomy, DN for NPI).
-- Safe to re-run: skips ALTER when column already exists.

SET @sess_db := DATABASE();

SET @id_qual_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'rendering_id_qualifier'
);
SET @id_qual_sql := IF(@id_qual_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `rendering_id_qualifier` VARCHAR(4) NULL DEFAULT ''ZZ'' COMMENT ''CMS-1500 Box 24I ID qualifier above rendering provider ID''',
  'SELECT ''skip: sessions.rendering_id_qualifier already exists'' AS sessions_migration_note'
);
PREPARE id_qual_stmt FROM @id_qual_sql;
EXECUTE id_qual_stmt;
DEALLOCATE PREPARE id_qual_stmt;

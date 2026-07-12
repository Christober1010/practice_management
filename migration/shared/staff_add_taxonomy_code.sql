-- NUCC taxonomy code for staff (CMS-1500 rendering provider / professional credentials).
-- Safe to re-run: skips ALTER when column already exists.

SET @staff_db := DATABASE();

SET @taxonomy_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @staff_db AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'taxonomy_code'
);
SET @taxonomy_sql := IF(@taxonomy_exists = 0,
  'ALTER TABLE `staff` ADD COLUMN `taxonomy_code` VARCHAR(20) NULL DEFAULT NULL COMMENT ''NUCC taxonomy code (e.g. 103K00000X for Behavior Analyst)''',
  'SELECT ''skip: staff.taxonomy_code already exists'' AS staff_migration_note'
);
PREPARE taxonomy_stmt FROM @taxonomy_sql;
EXECUTE taxonomy_stmt;
DEALLOCATE PREPARE taxonomy_stmt;

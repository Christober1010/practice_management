-- Box 24E diagnosis pointer per session (CMS-1500 uses A–L for Box 21 codes).
-- Safe to re-run: skips ALTER when column already exists.

SET @sess_db := DATABASE();

SET @diag_ptr_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'diagnosis_pointer'
);
SET @diag_ptr_sql := IF(@diag_ptr_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `diagnosis_pointer` VARCHAR(12) NULL DEFAULT ''A'' COMMENT ''CMS-1500 Box 24E pointer(s) to Box 21 diagnosis, e.g. A or A,B''',
  'SELECT ''skip: sessions.diagnosis_pointer already exists'' AS sessions_migration_note'
);
PREPARE diag_ptr_stmt FROM @diag_ptr_sql;
EXECUTE diag_ptr_stmt;
DEALLOCATE PREPARE diag_ptr_stmt;

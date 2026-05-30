-- Adds sessions.claim_id and sessions.claim_status for billing / CMS-1500 flows.
-- Safe to re-run: skips ALTER when each column already exists.
-- Does not use AFTER auth_id (that column may be missing on older schemas).

SET @sess_db := DATABASE();

SET @claim_id_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'claim_id'
);
SET @claim_id_sql := IF(@claim_id_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `claim_id` VARCHAR(64) NULL',
  'SELECT ''skip: sessions.claim_id already exists'' AS sessions_migration_note'
);
PREPARE claim_id_stmt FROM @claim_id_sql;
EXECUTE claim_id_stmt;
DEALLOCATE PREPARE claim_id_stmt;

SET @claim_status_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'claim_status'
);
SET @claim_status_sql := IF(@claim_status_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `claim_status` VARCHAR(50) NULL',
  'SELECT ''skip: sessions.claim_status already exists'' AS sessions_migration_note'
);
PREPARE claim_status_stmt FROM @claim_status_sql;
EXECUTE claim_status_stmt;
DEALLOCATE PREPARE claim_status_stmt;

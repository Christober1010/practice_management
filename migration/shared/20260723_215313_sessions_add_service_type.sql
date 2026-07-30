-- Appointments: Direct / Indirect service type (default Indirect).
-- Safe to re-run: skips ALTER when the column already exists.

SET @sess_db := DATABASE();

SET @st_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'service_type'
);
SET @st_sql := IF(@st_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `service_type` enum(''Direct'',''Indirect'') COLLATE utf8mb4_general_ci NOT NULL DEFAULT ''Indirect'' COMMENT ''DIRECT or INDIRECT service'' AFTER `place_of_service`',
  'SELECT ''skip: sessions.service_type already exists'' AS sessions_migration_note'
);
PREPARE st_stmt FROM @st_sql;
EXECUTE st_stmt;
DEALLOCATE PREPARE st_stmt;

-- Appointments: Exclude session Yes/No (default No).
-- Safe to re-run: skips ALTER when the column already exists.

SET @sess_db := DATABASE();

SET @ex_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'exclude_session'
);
SET @ex_sql := IF(@ex_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `exclude_session` enum(''Yes'',''No'') COLLATE utf8mb4_general_ci NOT NULL DEFAULT ''No'' COMMENT ''Exclude session from billing/reporting flows'' AFTER `status`',
  'SELECT ''skip: sessions.exclude_session already exists'' AS sessions_migration_note'
);
PREPARE ex_stmt FROM @ex_sql;
EXECUTE ex_stmt;
DEALLOCATE PREPARE ex_stmt;

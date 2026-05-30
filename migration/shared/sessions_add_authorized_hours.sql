-- Adds sessions.authorized_hours expected by add-session.php (INSERT / PUT).
-- Safe to re-run: skips ALTER when the column already exists.

SET @sess_db := DATABASE();
SET @sess_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'authorized_hours'
);
SET @sess_sql := IF(@sess_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `authorized_hours` DECIMAL(12, 4) NOT NULL DEFAULT 0 COMMENT ''Authorized units/hours for billing''',
  'SELECT ''skip: sessions.authorized_hours already exists'' AS sessions_migration_note'
);
PREPARE sess_stmt FROM @sess_sql;
EXECUTE sess_stmt;
DEALLOCATE PREPARE sess_stmt;

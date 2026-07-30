-- Groups recurring session rows (required by add-session.php INSERT/UPDATE).
-- Safe to re-run: skips ALTER when the column already exists.

SET @sess_db := DATABASE();
SET @sess_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'recurring_id'
);
SET @sess_sql := IF(@sess_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `recurring_id` INT NULL DEFAULT NULL COMMENT ''Links rows in a recurring series''',
  'SELECT ''skip: sessions.recurring_id already exists'' AS sessions_migration_note'
);
PREPARE sess_stmt FROM @sess_sql;
EXECUTE sess_stmt;
DEALLOCATE PREPARE sess_stmt;

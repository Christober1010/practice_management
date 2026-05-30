-- Links sessions to client_auth (required by add-session.php and units_serviced sync).
-- Safe to re-run: skips ALTER when the column already exists.

SET @sess_db := DATABASE();
SET @sess_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'auth_id'
);
SET @sess_sql := IF(@sess_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `auth_id` INT NULL DEFAULT NULL COMMENT ''client_auth id or auth_id''',
  'SELECT ''skip: sessions.auth_id already exists'' AS sessions_migration_note'
);
PREPARE sess_stmt FROM @sess_sql;
EXECUTE sess_stmt;
DEALLOCATE PREPARE sess_stmt;

-- Scheduling/billing hour columns on sessions (present on test DB; may be missing on prod).
-- Safe to re-run: skips each ALTER when the column already exists.

SET @sess_db := DATABASE();

SET @sched_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'scheduled_hours'
);
SET @sched_sql := IF(@sched_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `scheduled_hours` DECIMAL(12, 4) NOT NULL DEFAULT 0',
  'SELECT ''skip: sessions.scheduled_hours already exists'' AS sessions_migration_note'
);
PREPARE sched_stmt FROM @sched_sql;
EXECUTE sched_stmt;
DEALLOCATE PREPARE sched_stmt;

SET @rend_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'rendered_hours'
);
SET @rend_sql := IF(@rend_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `rendered_hours` DECIMAL(12, 4) NOT NULL DEFAULT 0',
  'SELECT ''skip: sessions.rendered_hours already exists'' AS sessions_migration_note'
);
PREPARE rend_stmt FROM @rend_sql;
EXECUTE rend_stmt;
DEALLOCATE PREPARE rend_stmt;

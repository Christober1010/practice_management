-- Per-session billing rate from master_provider_service_code (Box 24F charge inputs).
-- Safe to re-run: skips ALTER when columns already exist.

SET @sess_db := DATABASE();

SET @unit_rate_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'unit_rate'
);
SET @unit_rate_sql := IF(@unit_rate_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `unit_rate` DECIMAL(10,2) NULL DEFAULT NULL COMMENT ''Per billing unit rate from master_provider_service_code at session save''',
  'SELECT ''skip: sessions.unit_rate already exists'' AS sessions_migration_note'
);
PREPARE unit_rate_stmt FROM @unit_rate_sql;
EXECUTE unit_rate_stmt;
DEALLOCATE PREPARE unit_rate_stmt;

SET @line_charge_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'line_charge'
);
SET @line_charge_sql := IF(@line_charge_exists = 0,
  'ALTER TABLE `sessions` ADD COLUMN `line_charge` DECIMAL(10,2) NULL DEFAULT NULL COMMENT ''CMS-1500 Box 24F line charge (unit_rate × billing units) at session save''',
  'SELECT ''skip: sessions.line_charge already exists'' AS sessions_migration_note'
);
PREPARE line_charge_stmt FROM @line_charge_sql;
EXECUTE line_charge_stmt;
DEALLOCATE PREPARE line_charge_stmt;

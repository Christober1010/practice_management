-- Fix clients.client_status so workflow labels actually persist.
--
-- Symptom: update-clients.php returns success, but get-clients shows "" (or UI "New")
-- for values like "Service Terminated" / "Active Treatment". MySQL ENUM in non-strict
-- mode stores invalid values as empty string.
--
-- Safe to re-run. Apply on test (dbs14649042) and prod (dbs14484433).

SET @clients_db := DATABASE();

SET @cs_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @clients_db
    AND TABLE_NAME = 'clients'
    AND COLUMN_NAME = 'client_status'
  LIMIT 1
);

SET @fix_sql := IF(
  @cs_type IS NULL,
  'SELECT ''skip: clients.client_status missing'' AS clients_client_status_migration_note',
  'ALTER TABLE `clients` MODIFY COLUMN `client_status` VARCHAR(64) NOT NULL DEFAULT ''New'''
);

PREPARE clients_cs_stmt FROM @fix_sql;
EXECUTE clients_cs_stmt;
DEALLOCATE PREPARE clients_cs_stmt;

-- Empty string was the ENUM rejection placeholder; normalize to New.
UPDATE `clients`
SET `client_status` = 'New'
WHERE TRIM(COALESCE(`client_status`, '')) = '';

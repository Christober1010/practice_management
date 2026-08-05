-- Fix sessions.status / STATUS so Scheduled | Rendered | Cancelled actually persist.
--
-- Prod previously used a column type that rejected those values (same class of bug as
-- users.role ENUM → blank string in non-strict MySQL). Complete/create still updated
-- rendered_hours and claim_* in the same statement, so billing looked fine while STATUS
-- stayed ''.
--
-- Safe to re-run. Run on test (dbs14649042) and prod (dbs14484433).

SET @sess_db := DATABASE();

SET @status_col := (
  SELECT COLUMN_NAME
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db
    AND TABLE_NAME = 'sessions'
    AND LOWER(COLUMN_NAME) = 'status'
  ORDER BY CASE WHEN COLUMN_NAME = 'STATUS' THEN 0 WHEN COLUMN_NAME = 'status' THEN 1 ELSE 2 END
  LIMIT 1
);

-- Widen / normalize to VARCHAR so app values stick (idempotent if already VARCHAR).
SET @fix_sql := IF(
  @status_col IS NULL,
  'SELECT ''skip: sessions has no status column'' AS sessions_status_migration_note',
  CONCAT(
    'ALTER TABLE `sessions` MODIFY COLUMN `',
    @status_col,
    '` VARCHAR(32) NOT NULL DEFAULT ''Scheduled'''
  )
);
PREPARE status_fix_stmt FROM @fix_sql;
EXECUTE status_fix_stmt;
DEALLOCATE PREPARE status_fix_stmt;

-- Backfill completed rows that were stored as blank / invalid.
SET @backfill_rendered_sql := IF(
  @status_col IS NULL,
  'SELECT ''skip: no status backfill'' AS sessions_status_migration_note',
  CONCAT(
    'UPDATE `sessions` SET `', @status_col, '` = ''Rendered'' ',
    'WHERE (TRIM(IFNULL(`', @status_col, '`, '''')) = '''' ',
    '   OR LOWER(TRIM(IFNULL(`', @status_col, '`, ''''))) NOT IN (''scheduled'', ''rendered'', ''cancelled'', ''canceled'')) ',
    'AND (',
    '  IFNULL(`rendered_hours`, 0) > 0 ',
    '  OR TRIM(IFNULL(`claim_id`, '''')) <> '''' ',
    '  OR LOWER(IFNULL(`claim_status`, '''')) LIKE ''%ready to bill%''',
    ')'
  )
);
PREPARE status_bf_rendered FROM @backfill_rendered_sql;
EXECUTE status_bf_rendered;
DEALLOCATE PREPARE status_bf_rendered;

-- Everything else still blank/invalid → Scheduled.
SET @backfill_scheduled_sql := IF(
  @status_col IS NULL,
  'SELECT ''skip: no status backfill scheduled'' AS sessions_status_migration_note',
  CONCAT(
    'UPDATE `sessions` SET `', @status_col, '` = ''Scheduled'' ',
    'WHERE TRIM(IFNULL(`', @status_col, '`, '''')) = '''' ',
    '   OR LOWER(TRIM(IFNULL(`', @status_col, '`, ''''))) NOT IN (''scheduled'', ''rendered'', ''cancelled'', ''canceled'')'
  )
);
PREPARE status_bf_scheduled FROM @backfill_scheduled_sql;
EXECUTE status_bf_scheduled;
DEALLOCATE PREPARE status_bf_scheduled;

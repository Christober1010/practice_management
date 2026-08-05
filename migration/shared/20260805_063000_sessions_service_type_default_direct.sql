-- New sessions should default to Direct (session log / resource hours expect Direct).
-- Does not rewrite existing rows — only changes the column default for future INSERTs
-- that omit service_type.

SET @sess_db := DATABASE();

SET @st_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sess_db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'service_type'
);

SET @st_sql := IF(@st_exists = 0,
  'SELECT ''skip: sessions.service_type missing'' AS sessions_migration_note',
  'ALTER TABLE `sessions` MODIFY COLUMN `service_type` enum(''Direct'',''Indirect'') COLLATE utf8mb4_general_ci NOT NULL DEFAULT ''Direct'' COMMENT ''DIRECT or INDIRECT service'''
);
PREPARE st_stmt FROM @st_sql;
EXECUTE st_stmt;
DEALLOCATE PREPARE st_stmt;

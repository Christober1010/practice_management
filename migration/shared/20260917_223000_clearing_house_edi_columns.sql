-- Clearing House: EDI / submitter fields (Manage Data → Clearing House).

SET @ch_db := DATABASE();

-- environment
SET @ch_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @ch_db AND TABLE_NAME = 'clearing_house_settings' AND COLUMN_NAME = 'environment'
);
SET @ch_sql := IF(@ch_col = 0,
  "ALTER TABLE clearing_house_settings ADD COLUMN environment VARCHAR(16) NOT NULL DEFAULT 'test' AFTER provider_key",
  "SELECT 'skip: clearing_house_settings.environment' AS note");
PREPARE ch_stmt FROM @ch_sql; EXECUTE ch_stmt; DEALLOCATE PREPARE ch_stmt;

-- isa_sender_id
SET @ch_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @ch_db AND TABLE_NAME = 'clearing_house_settings' AND COLUMN_NAME = 'isa_sender_id'
);
SET @ch_sql := IF(@ch_col = 0,
  'ALTER TABLE clearing_house_settings ADD COLUMN isa_sender_id VARCHAR(32) NULL DEFAULT NULL AFTER sftp_reports_dir',
  "SELECT 'skip: isa_sender_id' AS note");
PREPARE ch_stmt FROM @ch_sql; EXECUTE ch_stmt; DEALLOCATE PREPARE ch_stmt;

SET @ch_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @ch_db AND TABLE_NAME = 'clearing_house_settings' AND COLUMN_NAME = 'isa_sender_qualifier'
);
SET @ch_sql := IF(@ch_col = 0,
  "ALTER TABLE clearing_house_settings ADD COLUMN isa_sender_qualifier VARCHAR(4) NOT NULL DEFAULT 'ZZ' AFTER isa_sender_id",
  "SELECT 'skip: isa_sender_qualifier' AS note");
PREPARE ch_stmt FROM @ch_sql; EXECUTE ch_stmt; DEALLOCATE PREPARE ch_stmt;

SET @ch_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @ch_db AND TABLE_NAME = 'clearing_house_settings' AND COLUMN_NAME = 'isa_receiver_qualifier'
);
SET @ch_sql := IF(@ch_col = 0,
  "ALTER TABLE clearing_house_settings ADD COLUMN isa_receiver_qualifier VARCHAR(4) NOT NULL DEFAULT 'ZZ' AFTER isa_sender_qualifier",
  "SELECT 'skip: isa_receiver_qualifier' AS note");
PREPARE ch_stmt FROM @ch_sql; EXECUTE ch_stmt; DEALLOCATE PREPARE ch_stmt;

SET @ch_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @ch_db AND TABLE_NAME = 'clearing_house_settings' AND COLUMN_NAME = 'gs_sender_code'
);
SET @ch_sql := IF(@ch_col = 0,
  'ALTER TABLE clearing_house_settings ADD COLUMN gs_sender_code VARCHAR(32) NULL DEFAULT NULL AFTER isa_receiver_qualifier',
  "SELECT 'skip: gs_sender_code' AS note");
PREPARE ch_stmt FROM @ch_sql; EXECUTE ch_stmt; DEALLOCATE PREPARE ch_stmt;

SET @ch_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @ch_db AND TABLE_NAME = 'clearing_house_settings' AND COLUMN_NAME = 'gs_receiver_code'
);
SET @ch_sql := IF(@ch_col = 0,
  "ALTER TABLE clearing_house_settings ADD COLUMN gs_receiver_code VARCHAR(16) NOT NULL DEFAULT 'OA' AFTER gs_sender_code",
  "SELECT 'skip: gs_receiver_code' AS note");
PREPARE ch_stmt FROM @ch_sql; EXECUTE ch_stmt; DEALLOCATE PREPARE ch_stmt;

SET @ch_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @ch_db AND TABLE_NAME = 'clearing_house_settings' AND COLUMN_NAME = 'submitter_name'
);
SET @ch_sql := IF(@ch_col = 0,
  'ALTER TABLE clearing_house_settings ADD COLUMN submitter_name VARCHAR(128) NULL DEFAULT NULL AFTER gs_receiver_code',
  "SELECT 'skip: submitter_name' AS note");
PREPARE ch_stmt FROM @ch_sql; EXECUTE ch_stmt; DEALLOCATE PREPARE ch_stmt;

SET @ch_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @ch_db AND TABLE_NAME = 'clearing_house_settings' AND COLUMN_NAME = 'receiver_id'
);
SET @ch_sql := IF(@ch_col = 0,
  'ALTER TABLE clearing_house_settings ADD COLUMN receiver_id VARCHAR(32) NULL DEFAULT NULL AFTER submitter_name',
  "SELECT 'skip: receiver_id' AS note");
PREPARE ch_stmt FROM @ch_sql; EXECUTE ch_stmt; DEALLOCATE PREPARE ch_stmt;

SET @ch_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @ch_db AND TABLE_NAME = 'clearing_house_settings' AND COLUMN_NAME = 'receiver_name'
);
SET @ch_sql := IF(@ch_col = 0,
  "ALTER TABLE clearing_house_settings ADD COLUMN receiver_name VARCHAR(64) NULL DEFAULT 'OFFICE ALLY' AFTER receiver_id",
  "SELECT 'skip: receiver_name' AS note");
PREPARE ch_stmt FROM @ch_sql; EXECUTE ch_stmt; DEALLOCATE PREPARE ch_stmt;

SET @ch_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @ch_db AND TABLE_NAME = 'clearing_house_settings' AND COLUMN_NAME = 'file_prefix'
);
SET @ch_sql := IF(@ch_col = 0,
  "ALTER TABLE clearing_house_settings ADD COLUMN file_prefix VARCHAR(16) NOT NULL DEFAULT '837P' AFTER receiver_name",
  "SELECT 'skip: file_prefix' AS note");
PREPARE ch_stmt FROM @ch_sql; EXECUTE ch_stmt; DEALLOCATE PREPARE ch_stmt;

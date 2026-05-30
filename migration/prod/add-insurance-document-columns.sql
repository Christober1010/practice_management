-- Add insurance document columns to client_insurance table
-- Mahaverse backend (production folder)
-- Run this SQL to add support for storing insurance document references

-- MySQL doesn't support IF NOT EXISTS for ADD COLUMN, so we check first and add conditionally
-- Option 1: Simple version (will error if columns already exist, but that's safe to ignore)
ALTER TABLE client_insurance 
ADD COLUMN insurance_document_path VARCHAR(500) DEFAULT NULL COMMENT 'Path to insurance document (Drive path or local path)',
ADD COLUMN insurance_document_filename VARCHAR(255) DEFAULT NULL COMMENT 'Filename or Drive file ID for insurance document';

-- Option 2: Safe version that checks first (uncomment if you prefer this approach)
-- SET @dbname = DATABASE();
-- SET @tablename = 'client_insurance';
-- SET @columnname1 = 'insurance_document_path';
-- SET @columnname2 = 'insurance_document_filename';
-- 
-- SET @preparedStatement = (SELECT IF(
--   (
--     SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
--     WHERE
--       (table_name = @tablename)
--       AND (table_schema = @dbname)
--       AND (column_name = @columnname1)
--   ) > 0,
--   'SELECT 1',
--   CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname1, ' VARCHAR(500) DEFAULT NULL COMMENT ''Path to insurance document (Drive path or local path)''')
-- ));
-- PREPARE alterIfNotExists FROM @preparedStatement;
-- EXECUTE alterIfNotExists;
-- DEALLOCATE PREPARE alterIfNotExists;
-- 
-- SET @preparedStatement = (SELECT IF(
--   (
--     SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
--     WHERE
--       (table_name = @tablename)
--       AND (table_schema = @dbname)
--       AND (column_name = @columnname2)
--   ) > 0,
--   'SELECT 1',
--   CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname2, ' VARCHAR(255) DEFAULT NULL COMMENT ''Filename or Drive file ID for insurance document''')
-- ));
-- PREPARE alterIfNotExists FROM @preparedStatement;
-- EXECUTE alterIfNotExists;
-- DEALLOCATE PREPARE alterIfNotExists;


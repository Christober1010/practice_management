-- PROD MIGRATION: Client Management enhancements (safe/idempotent style)
-- Date: 2026-02-28
--
-- Includes:
-- - clients.is_active
-- - client_insurance.primary_diagnosis
-- - client_insurance.insurance_provider_id
-- - client_documents.document_original_filename
-- - Optional backfill to fix legacy client_documents.document_path values
--
-- NOTE: This script uses INFORMATION_SCHEMA checks + dynamic SQL so it can be run safely
-- even if some columns already exist (works on MySQL 5.7+).

-- -------------------------
-- clients.is_active
-- -------------------------
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'clients'
    AND COLUMN_NAME = 'is_active'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE clients ADD COLUMN is_active TINYINT(1) DEFAULT 1 COMMENT ''Client active status (separate from workflow status)''',
  'SELECT ''clients.is_active already exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -------------------------
-- client_insurance.primary_diagnosis
-- -------------------------
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'client_insurance'
    AND COLUMN_NAME = 'primary_diagnosis'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE client_insurance ADD COLUMN primary_diagnosis VARCHAR(50) DEFAULT NULL COMMENT ''Primary diagnosis code for this insurance''',
  'SELECT ''client_insurance.primary_diagnosis already exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -------------------------
-- client_insurance.insurance_provider_id
-- -------------------------
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'client_insurance'
    AND COLUMN_NAME = 'insurance_provider_id'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE client_insurance ADD COLUMN insurance_provider_id VARCHAR(50) DEFAULT NULL COMMENT ''Reference to master_providers.id''',
  'SELECT ''client_insurance.insurance_provider_id already exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -------------------------
-- client_documents.document_original_filename
-- -------------------------
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'client_documents'
    AND COLUMN_NAME = 'document_original_filename'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE client_documents ADD COLUMN document_original_filename VARCHAR(255) NULL',
  'SELECT ''client_documents.document_original_filename already exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -------------------------
-- OPTIONAL BACKFILL (safe): fix legacy document_path values
-- Only runs if client_documents has document_path + document_filename columns.
-- -------------------------
SET @has_doc_path := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'client_documents'
    AND COLUMN_NAME = 'document_path'
);
SET @has_doc_filename := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'client_documents'
    AND COLUMN_NAME = 'document_filename'
);

-- Local uploads: append filename when document_path is just the folder
SET @sql := IF(
  (@has_doc_path > 0 AND @has_doc_filename > 0),
  "UPDATE client_documents
   SET
     document_path = CONCAT(TRIM(TRAILING '/' FROM document_path), '/', document_filename),
     file_url = COALESCE(NULLIF(file_url, ''), CONCAT(TRIM(TRAILING '/' FROM document_path), '/', document_filename))
   WHERE
     document_path LIKE 'uploads/%/documents%'
     AND (document_path NOT LIKE 'uploads/%/documents/%')
     AND document_filename IS NOT NULL
     AND document_filename <> ''",
  "SELECT 'Skipping legacy local backfill (missing document_path/document_filename columns)' AS info"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Drive uploads: canonicalize to drive://<fileId>
SET @sql := IF(
  (@has_doc_path > 0 AND @has_doc_filename > 0),
  "UPDATE client_documents
   SET
     document_path = CONCAT('drive://', document_filename),
     file_url = CONCAT('drive://', document_filename)
   WHERE
     document_path LIKE 'drive://%'
     AND document_filename IS NOT NULL
     AND document_filename <> ''
     AND document_path <> CONCAT('drive://', document_filename)",
  "SELECT 'Skipping legacy drive backfill (missing document_path/document_filename columns)' AS info"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;



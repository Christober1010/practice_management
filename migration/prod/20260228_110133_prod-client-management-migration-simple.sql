-- PROD MIGRATION (SIMPLE): Client Management enhancements
-- Run these one-by-one. If a column already exists, MySQL will error with "Duplicate column name" — you can ignore that and continue.

-- 1) clients.is_active
ALTER TABLE clients
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1
  COMMENT 'Client active status (separate from workflow status)';

-- 2) client_insurance.primary_diagnosis
ALTER TABLE client_insurance
  ADD COLUMN primary_diagnosis VARCHAR(50) NULL DEFAULT NULL
  COMMENT 'Primary diagnosis code for this insurance';

-- 3) client_insurance.insurance_provider_id
ALTER TABLE client_insurance
  ADD COLUMN insurance_provider_id VARCHAR(50) NULL DEFAULT NULL
  COMMENT 'Reference to master_providers.id';

-- 4) client_documents.document_original_filename
ALTER TABLE client_documents
  ADD COLUMN document_original_filename VARCHAR(255) NULL DEFAULT NULL;

-- 5) OPTIONAL: Fix legacy local document_path values (only if you have document_path + document_filename columns)
UPDATE client_documents
SET
  document_path = CONCAT(TRIM(TRAILING '/' FROM document_path), '/', document_filename),
  file_url = COALESCE(NULLIF(file_url, ''), CONCAT(TRIM(TRAILING '/' FROM document_path), '/', document_filename))
WHERE
  document_path LIKE 'uploads/%/documents%'
  AND document_path NOT LIKE 'uploads/%/documents/%'
  AND document_filename IS NOT NULL
  AND document_filename <> '';

-- 6) OPTIONAL: Fix legacy Drive document_path values (only if you stored Drive fileId in document_filename)
UPDATE client_documents
SET
  document_path = CONCAT('drive://', document_filename),
  file_url = CONCAT('drive://', document_filename)
WHERE
  document_path LIKE 'drive://%'
  AND document_filename IS NOT NULL
  AND document_filename <> ''
  AND document_path <> CONCAT('drive://', document_filename);



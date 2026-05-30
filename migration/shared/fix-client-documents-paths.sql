-- Fix legacy client_documents rows where document_path stored only the folder
-- and document_filename contains the actual stored filename.

UPDATE client_documents
SET
  document_path = CONCAT(TRIM(TRAILING '/' FROM document_path), '/', document_filename),
  file_url = COALESCE(NULLIF(file_url, ''), CONCAT(TRIM(TRAILING '/' FROM document_path), '/', document_filename))
WHERE
  document_path LIKE 'uploads/%/documents%'
  AND (document_path NOT LIKE 'uploads/%/documents/%')
  AND document_filename IS NOT NULL
  AND document_filename <> '';

UPDATE client_documents
SET
  document_path = CONCAT('drive://', document_filename),
  file_url = CONCAT('drive://', document_filename)
WHERE
  document_path LIKE 'drive://%'
  AND document_filename IS NOT NULL
  AND document_filename <> ''
  AND document_path <> CONCAT('drive://', document_filename);



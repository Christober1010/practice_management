-- Add column to persist the user-friendly/original filename for client documents
ALTER TABLE client_documents
  ADD COLUMN document_original_filename VARCHAR(255) NULL;



-- Staff documents table (Driver License, Background Check, etc.)
-- Uses same document_type from master_document_types as clients

CREATE TABLE IF NOT EXISTS staff_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id VARCHAR(50) NOT NULL,
  doc_uuid VARCHAR(100) NOT NULL,
  document_type VARCHAR(100) DEFAULT NULL,
  document_path VARCHAR(500) DEFAULT NULL,
  document_filename VARCHAR(255) DEFAULT NULL,
  document_original_filename VARCHAR(255) DEFAULT NULL,
  file_url VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_staff_documents_staff (staff_id),
  INDEX idx_staff_documents_uuid (doc_uuid)
);

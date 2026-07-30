-- Add Driver License and Background Check to master_document_types for Staff documents
INSERT INTO master_document_types (id, type_name, description, active) VALUES
(UUID(), 'Driver License', 'Driver license or state ID', 1),
(UUID(), 'Background Check', 'Background check document', 1);

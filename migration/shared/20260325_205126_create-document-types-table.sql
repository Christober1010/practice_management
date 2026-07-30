CREATE TABLE IF NOT EXISTS master_document_types (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    type_name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    archived TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO master_document_types (id, type_name, description, active) VALUES
(UUID(), 'Insurance Card', 'Insurance card (front/back)', 1),
(UUID(), 'Photo ID', 'Government-issued photo identification', 1),
(UUID(), 'Intake Doc', 'Intake documentation and forms', 1),
(UUID(), 'Clinical Doc', 'Clinical documentation and assessments', 1),
(UUID(), 'Service Doc', 'Service-related documents', 1),
(UUID(), 'Authorization', 'Insurance authorization letters', 1),
(UUID(), 'Assessment Report', 'Assessment and evaluation reports', 1),
(UUID(), 'Treatment Plan', 'Treatment and behavior intervention plans', 1),
(UUID(), 'Progress Report', 'Progress notes and reports', 1),
(UUID(), 'Consent Form', 'Signed consent forms', 1),
(UUID(), 'Medical Record', 'Medical records and history', 1),
(UUID(), 'Misc', 'Miscellaneous documents', 1);

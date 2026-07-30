CREATE TABLE IF NOT EXISTS master_treatment_types (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    treatment_name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    archived TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO master_treatment_types (id, treatment_name, description, active) VALUES
(UUID(), 'Behavioral therapy', 'Applied Behavior Analysis (ABA) and related behavioral interventions', 1),
(UUID(), 'Speech therapy', 'Speech-language pathology services', 1),
(UUID(), 'Occupational therapy', 'Occupational therapy services', 1),
(UUID(), 'Physical therapy', 'Physical therapy services', 1),
(UUID(), 'Social skills training', 'Social skills group or individual training', 1),
(UUID(), 'Parent training', 'Parent/caregiver training and education', 1),
(UUID(), 'Psychological testing', 'Psychological and developmental testing', 1),
(UUID(), 'Other', 'Other treatment type', 1);

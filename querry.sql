CREATE TABLE IF NOT EXISTS intake_forms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Demographic
  child_name VARCHAR(255) NOT NULL,
  child_dob DATE NOT NULL,
  completer_name VARCHAR(255) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(120) NULL,
  state VARCHAR(120) NULL,
  zip VARCHAR(40) NULL,
  country VARCHAR(120) NULL,
  phone_home VARCHAR(50) NULL,
  phone_cell VARCHAR(50) NULL,
  physician VARCHAR(255) NULL,
  neurologist VARCHAR(255) NULL,
  family_composition TEXT NULL,

  -- General
  goals_for_therapy TEXT NULL,
  preferred_times TEXT NULL,
  pref_edible TEXT NULL,
  pref_tangible TEXT NULL,
  pref_social TEXT NULL,
  pref_activity TEXT NULL,

  -- Medical
  diagnosis TEXT NULL,
  medical_conditions TEXT NULL,
  special_diet TEXT NULL,
  conditions_json TEXT NULL,
  conditions_description TEXT NULL,
  medications_json TEXT NULL,

  -- Education
  school_name VARCHAR(255) NULL,
  grade VARCHAR(50) NULL,
  teachers VARCHAR(255) NULL,
  classroom_type VARCHAR(255) NULL,
  school_address VARCHAR(255) NULL,
  school_hours VARCHAR(120) NULL,
  transportation VARCHAR(255) NULL,
  supportive_therapies TEXT NULL,
  past_aba TEXT NULL,

  -- Guidelines & Signatures
  guidelines_agree TINYINT(1) NOT NULL DEFAULT 0,
  guidelines_version VARCHAR(50) NOT NULL DEFAULT 'MBHS-CG-v1',
  signature_guardian VARCHAR(255) NOT NULL,
  signature_guardian_date DATE NOT NULL,
  signature_provider VARCHAR(255) NULL,
  signature_provider_date DATE NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

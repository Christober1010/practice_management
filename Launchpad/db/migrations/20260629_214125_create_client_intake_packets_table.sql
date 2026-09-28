-- Client intake packet submissions for Maha Launchpad.
-- Run on both Launchpad prod and test databases before enabling the form.

CREATE TABLE IF NOT EXISTS ClientIntakePackets (
  intake_id INT AUTO_INCREMENT PRIMARY KEY,
  created_by_user_id INT UNSIGNED NOT NULL,
  child_legal_name VARCHAR(255) NOT NULL,
  child_dob DATE NOT NULL,
  completed_by VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(64) NOT NULL,
  payload_json LONGTEXT NOT NULL COMMENT 'Full client intake packet JSON payload',
  parent_guardian_signature_data_url LONGTEXT NOT NULL,
  parent_guardian_signature_date DATE NOT NULL,
  provider_signature_data_url LONGTEXT NULL,
  provider_signature_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_client_intake_child_name (child_legal_name),
  INDEX idx_client_intake_child_dob (child_dob),
  INDEX idx_client_intake_created_by (created_by_user_id),
  CONSTRAINT fk_client_intake_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES Users(id)
    ON DELETE RESTRICT
);

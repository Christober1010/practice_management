-- Client intake signature/file attachments (Drive or local storage references).
-- Run after 20260629_214125_create_client_intake_packets_table.sql on Launchpad prod and test DBs.

CREATE TABLE IF NOT EXISTS ClientIntakeAttachments (
  attachment_id INT AUTO_INCREMENT PRIMARY KEY,
  intake_id INT NOT NULL,
  uploaded_by_user_id INT UNSIGNED NOT NULL,
  attachment_type VARCHAR(50) NOT NULL COMMENT 'PARENT_GUARDIAN_SIGNATURE, PROVIDER_SIGNATURE, COMPLETED_FORM',
  original_filename VARCHAR(255) NOT NULL,
  stored_path VARCHAR(512) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_client_intake_attachments_intake_id (intake_id),
  INDEX idx_client_intake_attachments_type (attachment_type),
  CONSTRAINT fk_client_intake_attachments_intake
    FOREIGN KEY (intake_id) REFERENCES ClientIntakePackets(intake_id) ON DELETE CASCADE,
  CONSTRAINT fk_client_intake_attachments_user
    FOREIGN KEY (uploaded_by_user_id) REFERENCES Users(id) ON DELETE RESTRICT
);

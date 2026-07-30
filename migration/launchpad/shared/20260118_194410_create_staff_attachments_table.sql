-- StaffAttachments: stores metadata for uploaded files (files stored on disk; DB stores references)
-- Assumes Staff table primary key is staff_id (matches backend/list_staff.php)

CREATE TABLE IF NOT EXISTS StaffAttachments (
  attachment_id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  uploaded_by_user_id INT NOT NULL,
  attachment_type VARCHAR(50) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_path VARCHAR(512) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_staff_attachments_staff_id (staff_id),
  INDEX idx_staff_attachments_type (attachment_type),
  CONSTRAINT fk_staff_attachments_staff FOREIGN KEY (staff_id) REFERENCES Staff(staff_id) ON DELETE CASCADE
);



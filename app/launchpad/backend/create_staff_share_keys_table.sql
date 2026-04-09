CREATE TABLE IF NOT EXISTS StaffShareKeys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  token_prefix VARCHAR(12) NOT NULL,
  created_by_user_id INT NOT NULL,
  created_by_username VARCHAR(150) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  INDEX idx_staff_share_keys_staff (staff_id),
  INDEX idx_staff_share_keys_hash (token_hash),
  INDEX idx_staff_share_keys_expires (expires_at),
  CONSTRAINT fk_staff_share_keys_staff FOREIGN KEY (staff_id) REFERENCES Staff(staff_id) ON DELETE CASCADE
);


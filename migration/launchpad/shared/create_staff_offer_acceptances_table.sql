-- StaffOfferAcceptances: stores signed offer acceptance metadata per staff record
-- Signature image itself is stored in StaffAttachments with attachment_type = 'OFFER_SIGNATURE'

CREATE TABLE IF NOT EXISTS StaffOfferAcceptances (
  offer_id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  created_by_user_id INT NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  job_title VARCHAR(255) NOT NULL,
  pay_rate VARCHAR(100) NOT NULL,
  signature_attachment_id INT NOT NULL,
  accepted_date DATE NOT NULL,
  accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_staff_offer (staff_id),
  INDEX idx_offer_created_by_user_id (created_by_user_id),
  CONSTRAINT fk_offer_staff FOREIGN KEY (staff_id) REFERENCES Staff(staff_id) ON DELETE CASCADE,
  CONSTRAINT fk_offer_signature_attachment FOREIGN KEY (signature_attachment_id) REFERENCES StaffAttachments(attachment_id) ON DELETE CASCADE
);



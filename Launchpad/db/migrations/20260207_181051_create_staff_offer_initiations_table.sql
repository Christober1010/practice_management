-- StaffOfferInitiations: stores offer letter details initiated by Admin/HR (before staff signs).
-- This allows the offer letter to be locked (staff cannot edit pay/title/name) until acceptance.

CREATE TABLE IF NOT EXISTS StaffOfferInitiations (
  initiation_id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  initiated_by_user_id INT NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  job_title VARCHAR(255) NOT NULL,
  pay_rate VARCHAR(100) NOT NULL,
  initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_staff_offer_initiation (staff_id),
  INDEX idx_offer_initiated_by_user_id (initiated_by_user_id)
);



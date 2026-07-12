-- OfferLetterPositions: stores job position codes, names, and their offer letter / job description templates.
-- Templates use placeholders: {{first_name}}, {{pay_rate}}, {{position}}
-- Admin selects a position when initiating an offer; the template pre-fills and can be freely edited before sending.

CREATE TABLE IF NOT EXISTS OfferLetterPositions (
  position_id   INT AUTO_INCREMENT PRIMARY KEY,
  position_code VARCHAR(50)   NOT NULL UNIQUE COMMENT 'Short unique code, e.g. RBT, BC, BCBA',
  position_name VARCHAR(255)  NOT NULL COMMENT 'Full display name shown in drop-down',
  offer_letter_template  TEXT NOT NULL COMMENT 'Plain-text offer body. Placeholders: {{first_name}}, {{pay_rate}}, {{position}}',
  job_description_template TEXT NOT NULL COMMENT 'Plain-text job description body',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_offer_positions_active (is_active)
);

-- Adds position_code and offer_letter_body to StaffOfferInitiations.
-- position_code links to OfferLetterPositions.position_code (soft FK).
-- offer_letter_body stores the admin-customized offer text at the time of initiation.
--
-- Run each statement separately if re-running on a partially-migrated DB.

ALTER TABLE StaffOfferInitiations
  ADD COLUMN position_code    VARCHAR(50) NULL COMMENT 'Links to OfferLetterPositions.position_code' AFTER pay_rate;

ALTER TABLE StaffOfferInitiations
  ADD COLUMN offer_letter_body TEXT        NULL COMMENT 'Admin-edited offer body stored at initiation time' AFTER position_code;

-- Add acknowledgement columns to StaffOfferAcceptances.
-- Safe to run on existing tables; columns are only added if not already present.

ALTER TABLE StaffOfferAcceptances
  ADD COLUMN jd_read_ack TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Staff confirmed reading job responsibilities' AFTER accepted_date;

ALTER TABLE StaffOfferAcceptances
  ADD COLUMN hipaa_ack TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Staff confirmed reading HIPAA agreement' AFTER jd_read_ack;

ALTER TABLE StaffOfferAcceptances
  ADD COLUMN abuse_ack TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Staff confirmed reading child abuse reporting requirements' AFTER hipaa_ack;

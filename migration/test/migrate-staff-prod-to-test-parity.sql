-- Align production `staff` with the extended test schema (personal / address / emergency / education).
--
-- Intended source (prod): columns through at least
--   dob, location, ssn_encrypted
-- and WITHOUT: job_title, address_line_1, …, major
--
-- What this does:
--   1. Widen ssn_encrypted from VARCHAR(32) to VARCHAR(255) (matches test; avoids truncation).
--   2. Append new columns after ssn_encrypted (physical order differs from test but behavior matches).
--
-- Run once on production after a backup. If any ADD fails with "Duplicate column", remove that
-- line and re-run (partial migrations).
--
-- Does NOT drop UNIQUE(email) or other prod-only indexes.

ALTER TABLE staff
  MODIFY COLUMN ssn_encrypted VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN job_title VARCHAR(255) NULL DEFAULT NULL AFTER ssn_encrypted,
  ADD COLUMN address_line_1 VARCHAR(255) NULL DEFAULT NULL AFTER job_title,
  ADD COLUMN address_line_2 VARCHAR(255) NULL DEFAULT NULL AFTER address_line_1,
  ADD COLUMN city VARCHAR(100) NULL DEFAULT NULL AFTER address_line_2,
  ADD COLUMN state VARCHAR(50) NULL DEFAULT NULL AFTER city,
  ADD COLUMN zipcode VARCHAR(20) NULL DEFAULT NULL AFTER state,
  ADD COLUMN country VARCHAR(100) NULL DEFAULT 'USA' AFTER zipcode,
  ADD COLUMN emergency_contact_name VARCHAR(255) NULL DEFAULT NULL AFTER country,
  ADD COLUMN emergency_relationship VARCHAR(100) NULL DEFAULT NULL AFTER emergency_contact_name,
  ADD COLUMN emergency_phone VARCHAR(30) NULL DEFAULT NULL AFTER emergency_relationship,
  ADD COLUMN emergency_email VARCHAR(255) NULL DEFAULT NULL AFTER emergency_phone,
  ADD COLUMN highest_degree VARCHAR(100) NULL DEFAULT NULL AFTER emergency_email,
  ADD COLUMN year_awarded VARCHAR(10) NULL DEFAULT NULL AFTER highest_degree,
  ADD COLUMN major VARCHAR(255) NULL DEFAULT NULL AFTER year_awarded;

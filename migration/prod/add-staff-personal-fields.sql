-- Add staff personal fields: job title, SSN, structured address, emergency contact, education
-- Run after staff table exists.
--
-- If production already has `ssn_encrypted` (e.g. VARCHAR(32)) and `location`, use instead:
--   migrate-staff-prod-to-test-parity.sql
-- which MODIFIES ssn width and ADDS only the missing columns.

ALTER TABLE staff
ADD COLUMN job_title VARCHAR(255) DEFAULT NULL,
ADD COLUMN ssn_encrypted VARCHAR(255) DEFAULT NULL,
ADD COLUMN address_line_1 VARCHAR(255) DEFAULT NULL,
ADD COLUMN address_line_2 VARCHAR(255) DEFAULT NULL,
ADD COLUMN city VARCHAR(100) DEFAULT NULL,
ADD COLUMN state VARCHAR(50) DEFAULT NULL,
ADD COLUMN zipcode VARCHAR(20) DEFAULT NULL,
ADD COLUMN country VARCHAR(100) DEFAULT 'USA',
ADD COLUMN emergency_contact_name VARCHAR(255) DEFAULT NULL,
ADD COLUMN emergency_relationship VARCHAR(100) DEFAULT NULL,
ADD COLUMN emergency_phone VARCHAR(30) DEFAULT NULL,
ADD COLUMN emergency_email VARCHAR(255) DEFAULT NULL,
ADD COLUMN highest_degree VARCHAR(100) DEFAULT NULL,
ADD COLUMN year_awarded VARCHAR(10) DEFAULT NULL,
ADD COLUMN major VARCHAR(255) DEFAULT NULL;

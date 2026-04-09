-- Add insured person details columns to client_insurance table
-- These fields are shown when insured_same_as_client is false

ALTER TABLE client_insurance
ADD COLUMN insured_first_name VARCHAR(100) DEFAULT NULL COMMENT 'Insured first name',
ADD COLUMN insured_last_name VARCHAR(100) DEFAULT NULL COMMENT 'Insured last name',
ADD COLUMN insured_dob DATE DEFAULT NULL COMMENT 'Insured date of birth',
ADD COLUMN insured_gender VARCHAR(20) DEFAULT NULL COMMENT 'Insured gender',
ADD COLUMN insured_relationship VARCHAR(50) DEFAULT NULL COMMENT 'Relationship to client',
ADD COLUMN insured_address VARCHAR(255) DEFAULT NULL COMMENT 'Insured street address',
ADD COLUMN insured_city VARCHAR(100) DEFAULT NULL COMMENT 'Insured city',
ADD COLUMN insured_state VARCHAR(50) DEFAULT NULL COMMENT 'Insured state',
ADD COLUMN insured_zipcode VARCHAR(20) DEFAULT NULL COMMENT 'Insured zipcode',
ADD COLUMN insured_phone VARCHAR(30) DEFAULT NULL COMMENT 'Insured phone number',
ADD COLUMN insured_id_number VARCHAR(100) DEFAULT NULL COMMENT 'Insured ID/member number';

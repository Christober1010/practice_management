-- Add new insurance form fields to client_insurance table
-- Mahaverse backend (production folder)
-- This migration adds all the fields required for the comprehensive insurance form

ALTER TABLE client_insurance 
ADD COLUMN carrier_payer_id VARCHAR(50) DEFAULT NULL COMMENT 'Carrier Payer ID',
ADD COLUMN insurance_company_address TEXT DEFAULT NULL COMMENT 'Insurance company address',
ADD COLUMN insurance_issue_date DATE DEFAULT NULL COMMENT 'Insurance issue date',
ADD COLUMN insurance_plan_name VARCHAR(255) DEFAULT NULL COMMENT 'Insurance plan name',
ADD COLUMN date_of_signature DATE DEFAULT NULL COMMENT 'Date of signature',
ADD COLUMN authorized_payment_box13 VARCHAR(50) DEFAULT 'Signature on File' COMMENT 'Authorized Payment (Box 13)',
ADD COLUMN authorized_release_box12 VARCHAR(50) DEFAULT 'Signature on File' COMMENT 'Authorization Release (Box 12)',
ADD COLUMN authorized_release_box17 VARCHAR(50) DEFAULT 'Signature on File' COMMENT 'Authorized Release (Box 17)',
ADD COLUMN additional_claim_info_box19 TEXT DEFAULT NULL COMMENT 'Additional Claim Information (Box 19)',
ADD COLUMN do_not_accept_assignment_box27 TINYINT(1) DEFAULT 0 COMMENT 'Do Not Accept Assignment (Box 27)',
ADD COLUMN insurance_notes TEXT DEFAULT NULL COMMENT 'General insurance notes',
ADD COLUMN primary_insurance_notes TEXT DEFAULT NULL COMMENT 'Primary insurance specific notes',
ADD COLUMN insured_same_as_client TINYINT(1) DEFAULT 1 COMMENT 'Insured person is the same as client',
ADD COLUMN insurance_inactive TINYINT(1) DEFAULT 0 COMMENT 'Insurance inactive flag',
ADD COLUMN delete_insurance TINYINT(1) DEFAULT 0 COMMENT 'Mark insurance for deletion';

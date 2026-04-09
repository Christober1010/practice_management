-- Add new fields for Client Management enhancements
-- 1. is_active field in clients table (separate from status)
-- 2. primary_diagnosis field in client_insurance table
-- 3. insurance_provider_id field in client_insurance table

-- Add is_active column to clients table
ALTER TABLE clients 
ADD COLUMN is_active TINYINT(1) DEFAULT 1 COMMENT 'Client active status (separate from workflow status)';

-- Add primary_diagnosis column to client_insurance table
ALTER TABLE client_insurance 
ADD COLUMN primary_diagnosis VARCHAR(50) DEFAULT NULL COMMENT 'Primary diagnosis code for this insurance';

-- Add insurance_provider_id column to client_insurance table
ALTER TABLE client_insurance 
ADD COLUMN insurance_provider_id VARCHAR(50) DEFAULT NULL COMMENT 'Reference to master_providers.id';



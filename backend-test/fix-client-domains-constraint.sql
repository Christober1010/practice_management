-- Fix client_domains table - Remove module_id dependency
-- Run these queries ONE AT A TIME in order

-- Step 1: Drop the foreign key constraint
ALTER TABLE `client_domains` DROP FOREIGN KEY `fk_domains_module`;

-- Step 2: Drop the index (this should work now that FK is gone)
ALTER TABLE `client_domains` DROP INDEX `idx_module_id`;

-- Step 3: Drop the column
ALTER TABLE `client_domains` DROP COLUMN `module_id`;

-- Verify it's gone (optional check)
SELECT COLUMN_NAME 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'client_domains'
AND COLUMN_NAME = 'module_id';
-- This should return 0 rows if successful


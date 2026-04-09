-- Migration: Remove module_id dependency from domains
-- Based on actual table structure

-- ============================================
-- FOR master_domains TABLE
-- ============================================
-- First, let's check what foreign keys exist on master_domains
-- Run this to see the actual constraint name:
SELECT CONSTRAINT_NAME 
FROM information_schema.TABLE_CONSTRAINTS 
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'master_domains'
AND CONSTRAINT_TYPE = 'FOREIGN KEY';

-- If the constraint exists, drop it (replace 'CONSTRAINT_NAME' with actual name from above)
-- Example: ALTER TABLE `master_domains` DROP FOREIGN KEY `master_domains_ibfk_1`;

-- Drop the index
ALTER TABLE `master_domains` DROP INDEX `idx_module_id`;

-- Drop the column
ALTER TABLE `master_domains` DROP COLUMN `module_id`;

-- ============================================
-- FOR client_domains TABLE
-- ============================================
-- Step 1: Drop the foreign key constraint (fk_domains_module)
ALTER TABLE `client_domains` DROP FOREIGN KEY `fk_domains_module`;

-- Step 2: Drop the index
ALTER TABLE `client_domains` DROP INDEX `idx_module_id`;

-- Step 3: Drop the column
ALTER TABLE `client_domains` DROP COLUMN `module_id`;


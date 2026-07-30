-- Migration: Remove module_id dependency from domains
-- MANUAL VERSION - Run each step separately and check for errors
-- 
-- IMPORTANT: You must drop foreign keys BEFORE dropping indexes or columns

-- ============================================
-- FOR master_domains TABLE
-- ============================================

-- ============================================
-- FOR master_domains TABLE
-- ============================================
-- No foreign key constraint exists on master_domains for module_id
-- So we can directly drop the index and column

-- Step 1: Drop the index
ALTER TABLE `master_domains` DROP INDEX `idx_module_id`;

-- Step 2: Drop the column
ALTER TABLE `master_domains` DROP COLUMN `module_id`;

-- ============================================
-- FOR client_domains TABLE
-- ============================================
-- Step 5: Drop the foreign key constraint (fk_domains_module)
ALTER TABLE `client_domains` DROP FOREIGN KEY `fk_domains_module`;

-- Step 6: Drop the index
ALTER TABLE `client_domains` DROP INDEX `idx_module_id`;

-- Step 7: Drop the column
ALTER TABLE `client_domains` DROP COLUMN `module_id`;


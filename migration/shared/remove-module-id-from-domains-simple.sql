-- Migration: Remove module_id dependency from domains
-- This makes domains independent entities like modules
-- 
-- NOTE: Run each statement separately. If a constraint/index/column doesn't exist,
-- MySQL will show an error but you can safely ignore it and continue.

-- Step 1: Remove foreign key constraint from master_domains
ALTER TABLE `master_domains` 
DROP FOREIGN KEY `master_domains_ibfk_1`;

-- Step 2: Remove the index on module_id
ALTER TABLE `master_domains` 
DROP INDEX `idx_module_id`;

-- Step 3: Remove module_id column from master_domains
ALTER TABLE `master_domains` 
DROP COLUMN `module_id`;

-- Step 4: Remove foreign key constraint from client_domains
ALTER TABLE `client_domains` 
DROP FOREIGN KEY `client_domains_ibfk_1`;

-- Step 5: Remove the index on module_id in client_domains
ALTER TABLE `client_domains` 
DROP INDEX `idx_module_id`;

-- Step 6: Remove module_id column from client_domains
ALTER TABLE `client_domains` 
DROP COLUMN `module_id`;


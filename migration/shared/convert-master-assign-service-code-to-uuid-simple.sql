-- Migration: Convert master_assign_service_code from auto-increment INT to UUID
-- SIMPLE VERSION - Run each step separately

-- IMPORTANT: Before running this, check if any other tables reference service_id:
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME = 'master_assign_service_code'
AND REFERENCED_COLUMN_NAME = 'service_id'
AND TABLE_SCHEMA = DATABASE();

-- If the above returns any rows, you'll need to update those tables first!

-- Step 1: Add new UUID column
ALTER TABLE `master_assign_service_code` 
ADD COLUMN `id` VARCHAR(36) NULL AFTER `service_id`;

-- Step 2: Generate UUIDs for existing rows (MySQL 8.0+)
UPDATE `master_assign_service_code` 
SET `id` = UUID() 
WHERE `id` IS NULL;

-- Step 3: Make id column NOT NULL
ALTER TABLE `master_assign_service_code` 
MODIFY COLUMN `id` VARCHAR(36) NOT NULL;

-- Step 4: Add unique constraint
ALTER TABLE `master_assign_service_code` 
ADD UNIQUE KEY `uk_id` (`id`);

-- Step 5: Remove AUTO_INCREMENT from service_id (required before dropping primary key)
ALTER TABLE `master_assign_service_code` 
MODIFY COLUMN `service_id` INT NOT NULL;

-- Step 6: Drop old primary key (will fail if foreign keys exist)
ALTER TABLE `master_assign_service_code` 
DROP PRIMARY KEY;

-- Step 7: Set new id as primary key
ALTER TABLE `master_assign_service_code` 
ADD PRIMARY KEY (`id`);

-- Step 8: Drop old service_id column
ALTER TABLE `master_assign_service_code` 
DROP COLUMN `service_id`;

-- Step 9: Verify (should show 'id' as VARCHAR(36) PRIMARY KEY)
DESCRIBE `master_assign_service_code`;


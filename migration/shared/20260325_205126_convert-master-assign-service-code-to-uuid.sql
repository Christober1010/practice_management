-- Migration: Convert master_assign_service_code from auto-increment INT to UUID
-- This script converts the service_id from INT AUTO_INCREMENT to VARCHAR(36) UUID

-- Step 1: Check for any foreign keys that reference this table
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME = 'master_assign_service_code'
AND REFERENCED_COLUMN_NAME = 'service_id'
AND TABLE_SCHEMA = DATABASE();

-- If the above query returns any rows, you'll need to update those tables too
-- For now, we'll proceed with the conversion

-- Step 2: Add a new UUID column (temporary, we'll make it primary later)
ALTER TABLE `master_assign_service_code` 
ADD COLUMN `id` VARCHAR(36) NULL AFTER `service_id`;

-- Step 3: Generate UUIDs for existing rows
-- Try MySQL 8.0+ UUID() function first, fallback to manual generation if needed
-- For MySQL 8.0+:
UPDATE `master_assign_service_code` SET `id` = UUID() WHERE `id` IS NULL;

-- If the above fails (MySQL < 8.0), use this alternative:
-- UPDATE `master_assign_service_code` 
-- SET `id` = CONCAT(
--     LPAD(HEX(FLOOR(RAND() * 4294967296)), 8, '0'),
--     '-',
--     LPAD(HEX(FLOOR(RAND() * 65536)), 4, '0'),
--     '-4',
--     LPAD(HEX(FLOOR(RAND() * 4096)), 3, '0'),
--     '-',
--     LPAD(HEX(FLOOR(RAND() * 16384) + 8192), 4, '0'),
--     '-',
--     LPAD(HEX(FLOOR(RAND() * 281474976710656)), 12, '0')
-- )
-- WHERE `id` IS NULL;

-- Step 4: Make the id column NOT NULL
ALTER TABLE `master_assign_service_code` 
MODIFY COLUMN `id` VARCHAR(36) NOT NULL;

-- Step 5: Add unique constraint to ensure no duplicates
ALTER TABLE `master_assign_service_code` 
ADD UNIQUE KEY `uk_id` (`id`);

-- Step 6: Remove AUTO_INCREMENT from service_id (required before dropping primary key)
ALTER TABLE `master_assign_service_code` 
MODIFY COLUMN `service_id` INT NOT NULL;

-- Step 7: Drop the old primary key (this will fail if there are foreign keys referencing it)
ALTER TABLE `master_assign_service_code` 
DROP PRIMARY KEY;

-- Step 8: Set the new id column as primary key
ALTER TABLE `master_assign_service_code` 
ADD PRIMARY KEY (`id`);

-- Step 9: Drop the old service_id column
ALTER TABLE `master_assign_service_code` 
DROP COLUMN `service_id`;

-- Step 10: Verify the new structure
DESCRIBE `master_assign_service_code`;


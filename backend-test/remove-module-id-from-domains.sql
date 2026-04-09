-- Migration: Remove module_id dependency from domains
-- This makes domains independent entities like modules

-- Step 1: Remove foreign key constraint from master_domains
-- Note: MySQL doesn't support IF EXISTS for DROP FOREIGN KEY, so we check first
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'master_domains'
    AND CONSTRAINT_NAME = 'master_domains_ibfk_1'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE `master_domains` DROP FOREIGN KEY `master_domains_ibfk_1`',
    'SELECT "Foreign key master_domains_ibfk_1 does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Find and drop ALL foreign keys that reference module_id in master_domains
-- We need to drop all foreign keys first before we can drop the index
SET @fk_name = (
    SELECT CONSTRAINT_NAME 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'master_domains'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME LIKE '%module%'
    LIMIT 1
);

-- If we found a foreign key, drop it
SET @sql = IF(@fk_name IS NOT NULL AND @fk_name != '',
    CONCAT('ALTER TABLE `master_domains` DROP FOREIGN KEY `', @fk_name, '`'),
    'SELECT "No foreign key found for module_id" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 3: Remove the index on module_id (after foreign key is dropped)
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'master_domains'
    AND INDEX_NAME = 'idx_module_id'
);

SET @sql = IF(@idx_exists > 0,
    'ALTER TABLE `master_domains` DROP INDEX `idx_module_id`',
    'SELECT "Index idx_module_id does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 4: Remove module_id column from master_domains (if it exists)
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'master_domains'
    AND COLUMN_NAME = 'module_id'
);

SET @sql = IF(@col_exists > 0,
    'ALTER TABLE `master_domains` DROP COLUMN `module_id`',
    'SELECT "Column module_id does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 5: Find and drop ALL foreign keys that reference module_id in client_domains
SET @fk_name = (
    SELECT CONSTRAINT_NAME 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'client_domains'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME LIKE '%module%'
    LIMIT 1
);

-- If we found a foreign key, drop it
SET @sql = IF(@fk_name IS NOT NULL AND @fk_name != '',
    CONCAT('ALTER TABLE `client_domains` DROP FOREIGN KEY `', @fk_name, '`'),
    'SELECT "No foreign key found for module_id" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 6: Remove the index on module_id in client_domains (after foreign key is dropped)
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'client_domains'
    AND INDEX_NAME = 'idx_module_id'
);

SET @sql = IF(@idx_exists > 0,
    'ALTER TABLE `client_domains` DROP INDEX `idx_module_id`',
    'SELECT "Index idx_module_id does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 7: Remove module_id column from client_domains (if it exists)
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'client_domains'
    AND COLUMN_NAME = 'module_id'
);

SET @sql = IF(@col_exists > 0,
    'ALTER TABLE `client_domains` DROP COLUMN `module_id`',
    'SELECT "Column module_id does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ============================================
-- EXPORT CREATE TABLE STATEMENTS FOR MISSING TABLES
-- Run this in your TEST database (dbs14649042) to get CREATE statements
-- Copy the output and run in PRODUCTION database (dbs14484433)
-- ============================================

-- ============================================
-- Method 1: Generate SHOW CREATE TABLE for each missing table
-- ============================================
-- Run these individually or as a batch:

SHOW CREATE TABLE `client_domains`;
SHOW CREATE TABLE `client_modules`;
SHOW CREATE TABLE `client_programs`;
SHOW CREATE TABLE `client_targets`;
SHOW CREATE TABLE `client_targets_old`;
SHOW CREATE TABLE `master_domains`;
SHOW CREATE TABLE `master_modules`;
SHOW CREATE TABLE `master_programs`;
SHOW CREATE TABLE `master_targets`;
SHOW CREATE TABLE `master_prompts`;
SHOW CREATE TABLE `master_target_prompts`;
SHOW CREATE TABLE `master_target_tasks`;
SHOW CREATE TABLE `master_service_code`;
SHOW CREATE TABLE `master_assign_service_code`;
SHOW CREATE TABLE `reports`;
SHOW CREATE TABLE `prompts`;

-- ============================================
-- Method 2: Generate a script that outputs all CREATE statements
-- (Use this if your DBA tool supports stored procedures)
-- ============================================

DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS ExportMissingTables()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE table_name VARCHAR(255);
    DECLARE create_stmt TEXT;
    
    DECLARE cur CURSOR FOR 
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
            'client_domains',
            'client_modules',
            'client_programs',
            'client_targets',
            'client_targets_old',
            'master_domains',
            'master_modules',
            'master_programs',
            'master_targets',
            'master_prompts',
            'master_target_prompts',
            'master_target_tasks',
            'master_service_code',
            'master_assign_service_code',
            'reports',
            'prompts'
        )
        ORDER BY TABLE_NAME;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO table_name;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        SET @sql = CONCAT('SHOW CREATE TABLE `', table_name, '`');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        
    END LOOP;
    
    CLOSE cur;
END$$

DELIMITER ;

-- To use the procedure:
-- CALL ExportMissingTables();

-- ============================================
-- Method 3: Simple SELECT to list all missing tables
-- ============================================
SELECT 
    TABLE_NAME,
    CONCAT('SHOW CREATE TABLE `', TABLE_NAME, '`;') AS export_command
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME IN (
    'client_domains',
    'client_modules',
    'client_programs',
    'client_targets',
    'client_targets_old',
    'master_domains',
    'master_modules',
    'master_programs',
    'master_targets',
    'master_prompts',
    'master_target_prompts',
    'master_target_tasks',
    'master_service_code',
    'master_assign_service_code',
    'reports',
    'prompts'
)
ORDER BY TABLE_NAME;


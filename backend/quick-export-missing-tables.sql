-- ============================================
-- QUICK EXPORT: Copy and paste these commands
-- Run in TEST database (dbs14649042) to get CREATE statements
-- ============================================

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
-- ALTERNATIVE: Get all in one query (if your DBA supports it)
-- ============================================
SELECT 
    CONCAT('SHOW CREATE TABLE `', TABLE_NAME, '`;') AS sql_command
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'dbs14649042'
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


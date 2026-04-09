-- Add archived column to reports table if it doesn't exist
ALTER TABLE `reports` 
ADD COLUMN IF NOT EXISTS `archived` TINYINT(1) DEFAULT 0 NOT NULL AFTER `exclude_from_mileage`,
ADD INDEX IF NOT EXISTS `idx_reports_archived` (`archived`);




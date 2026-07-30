-- Link Staff rows to the User who created them (for "My Entries" filtering)
ALTER TABLE `Staff`
  ADD COLUMN `created_by_user_id` int unsigned NULL AFTER `email`,
  ADD INDEX `idx_staff_created_by_user_id` (`created_by_user_id`),
  ADD CONSTRAINT `fk_staff_created_by_user_id`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `Users` (`id`)
    ON DELETE SET NULL;



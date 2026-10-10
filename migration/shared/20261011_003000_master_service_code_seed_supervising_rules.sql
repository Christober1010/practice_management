-- Seed default supervising rules for common ABA CPT codes.
-- Safe to re-run: only updates rows still on the empty default.

UPDATE `master_service_code`
SET `supervising_provider_rule` = 'provider_as_supervising'
WHERE `code` IN ('97151', '97155', '97156', '97155NB')
  AND TRIM(IFNULL(`supervising_provider_rule`, '')) = '';

UPDATE `master_service_code`
SET `supervising_provider_rule` = 'staff_assigned_supervisor'
WHERE `code` IN ('97153')
  AND TRIM(IFNULL(`supervising_provider_rule`, '')) = '';

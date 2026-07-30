-- Add Billable + Authorization Required to provider ↔ service code mappings
-- Run on both prod and test DBs that use master_provider_service_code.

ALTER TABLE `master_provider_service_code`
  ADD COLUMN `billable` enum('Yes','No') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Yes'
    AFTER `status`,
  ADD COLUMN `authorization_required` enum('Yes','No') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Yes'
    AFTER `billable`;

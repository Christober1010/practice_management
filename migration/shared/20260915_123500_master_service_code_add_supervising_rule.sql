-- Add configurable supervising provider rule per service code (CPT).
-- Values:
--   '' (default)                -> use legacy behavior / no special rule
--   'provider_as_supervising'   -> supervising provider must equal rendering provider
--   'staff_assigned_supervisor' -> supervising provider defaults to staff assigned supervisor

ALTER TABLE `master_service_code`
  ADD COLUMN `supervising_provider_rule` VARCHAR(64) NOT NULL DEFAULT '' AFTER `code_description`;


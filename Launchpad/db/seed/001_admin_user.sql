-- Local seed admin (password: Admin123!)
INSERT INTO `Users` (`username`, `password_hash`, `email`, `role`, `is_active`)
VALUES (
  'admin',
  '$2b$10$Y5/fmT99dOStSYga0UtE6ONCQM5.gvi9FpWRJAKJagNjFMjcNSzZW',
  'admin@launchpad.local',
  'admin',
  1
) ON DUPLICATE KEY UPDATE
  `password_hash` = VALUES(`password_hash`),
  `email` = VALUES(`email`),
  `is_active` = 1;

INSERT INTO `OfferLetterPositions` (`position_code`, `position_name`, `offer_letter_template`, `job_description_template`, `is_active`)
VALUES
  ('RBT', 'Registered Behavior Technician', 'Dear {{first_name}}, we are pleased to offer you the RBT position at {{pay_rate}}.', 'Provide ABA therapy under BCBA supervision.', 1),
  ('BC', 'Behavior Consultant', 'Dear {{first_name}}, we are pleased to offer you the BC position at {{pay_rate}}.', 'Clinical consultation and caregiver training.', 1),
  ('BCBA', 'Board Certified Behavior Analyst', 'Dear {{first_name}}, we are pleased to offer you the BCBA position at {{pay_rate}}.', 'Oversee treatment plans and supervision.', 1)
ON DUPLICATE KEY UPDATE `position_name` = VALUES(`position_name`), `is_active` = 1;

INSERT INTO `rbac_permissions` (`perm_key`, `label`, `perm_group`, `app_scope`, `sort_order`) VALUES
  ('launchpad.dashboard', 'Launchpad: Dashboard', 'launchpad', 'launchpad', 600),
  ('launchpad.offer_letter', 'Launchpad: Offer Letter', 'launchpad', 'launchpad', 610),
  ('launchpad.profile_form', 'Launchpad: Profile / My Profile', 'launchpad', 'launchpad', 620),
  ('launchpad.users', 'Launchpad: User Accounts', 'launchpad', 'launchpad', 630),
  ('launchpad.profile_submit', 'Launchpad: Submit profile forms', 'launchpad', 'launchpad', 640)
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`);

DELETE FROM rbac_role_grants WHERE role_name IN ('admin','hr','staff','viewer');

INSERT INTO rbac_role_grants (role_name, permission_id)
SELECT 'admin', id FROM rbac_permissions WHERE app_scope = 'launchpad';

INSERT INTO rbac_role_grants (role_name, permission_id)
SELECT r.role, p.id FROM (
  SELECT 'hr' AS role UNION SELECT 'staff'
) r
JOIN rbac_permissions p ON p.perm_key IN (
  'launchpad.dashboard','launchpad.offer_letter','launchpad.profile_form','launchpad.profile_submit'
);

INSERT INTO rbac_role_grants (role_name, permission_id)
SELECT 'viewer', id FROM rbac_permissions WHERE perm_key IN (
  'launchpad.dashboard','launchpad.offer_letter'
);

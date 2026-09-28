-- Run on Launchpad DB after rbac_permissions + rbac_role_grants tables exist
-- (same catalog as main app; grants only for Launchpad roles)

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

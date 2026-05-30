-- RBAC permissions for Behavior Reduction master data (safe to re-run)
-- Column names match rbac_permissions: perm_key, perm_group, app_scope (see create_rbac_tables.sql)

INSERT INTO rbac_permissions (perm_key, label, perm_group, app_scope, sort_order) VALUES
('view.behavior_categories', 'Behavior Categories', 'mahaverse_view', 'mahaverse', 245),
('view.behaviors', 'Behaviors', 'mahaverse_view', 'mahaverse', 246),
('master_data.behavior_categories', 'Data collection: Behavior Categories (manage)', 'mahaverse_action', 'mahaverse', 515),
('master_data.behaviors', 'Data collection: Behaviors (manage)', 'mahaverse_action', 'mahaverse', 516)
ON DUPLICATE KEY UPDATE label = VALUES(label), perm_group = VALUES(perm_group), sort_order = VALUES(sort_order);

-- Admin: all mahaverse permissions (includes new rows above if admin grant is rebuilt)
INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
SELECT 'admin', p.id, 'all'
FROM rbac_permissions p
WHERE p.app_scope = 'mahaverse'
  AND p.perm_key IN (
    'view.behavior_categories',
    'view.behaviors',
    'master_data.behavior_categories',
    'master_data.behaviors'
  )
ON DUPLICATE KEY UPDATE access_scope = VALUES(access_scope);

-- BCBA: same pattern as domains/programs/targets (manage behaviors + view screens)
INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
SELECT 'bcba', p.id, 'all'
FROM rbac_permissions p
WHERE p.perm_key IN (
  'view.behavior_categories',
  'view.behaviors',
  'master_data.behavior_categories',
  'master_data.behaviors'
)
ON DUPLICATE KEY UPDATE access_scope = VALUES(access_scope);

-- Manage Data: Mileage Rate screen (org $/mile for mileage claims).
-- Run on prod + test Mahaverse DBs. Idempotent.
-- Also cleans up earlier master_data.mileage_rate key if that draft was applied.

INSERT INTO rbac_permissions (perm_key, label, perm_group, app_scope, sort_order) VALUES
('view.mileage_rate', 'Manage Data: Mileage Rate', 'mahaverse_view', 'mahaverse', 330),
('manage_data.mileage_rate', 'Mileage Rate · Edit', 'mahaverse_action', 'mahaverse', 331)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  perm_group = VALUES(perm_group),
  sort_order = VALUES(sort_order);

-- Drop mistaken Configure-data key if present (no-op when absent).
DELETE rg FROM rbac_role_grants rg
INNER JOIN rbac_permissions p ON p.id = rg.permission_id
WHERE p.app_scope = 'mahaverse' AND p.perm_key = 'master_data.mileage_rate';

DELETE FROM rbac_permissions
WHERE app_scope = 'mahaverse' AND perm_key = 'master_data.mileage_rate';

-- Roles that already have Manage Data get Mileage Rate.
SET @mr_db := DATABASE();
SET @mr_has_scope := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @mr_db AND TABLE_NAME = 'rbac_role_grants' AND COLUMN_NAME = 'access_scope'
);

SET @mr_sql := IF(@mr_has_scope > 0,
  'INSERT INTO rbac_role_grants (role
  _name, permission_id, access_scope)
   SELECT DISTINCT rg.role_name, p_new.id, ''all''
   FROM rbac_role_grants rg
   INNER JOIN rbac_permissions p_old
     ON p_old.id = rg.permission_id
    AND p_old.app_scope = ''mahaverse''
    AND p_old.perm_key IN (
      ''nav.manage_data'',
      ''view.manage_data'',
      ''manage_data.write'',
      ''manage_data.read''
    )
   INNER JOIN rbac_permissions p_new
     ON p_new.app_scope = ''mahaverse''
    AND p_new.perm_key IN (''view.mileage_rate'', ''manage_data.mileage_rate'')
   WHERE NOT EXISTS (
     SELECT 1 FROM rbac_role_grants existing
     WHERE existing.role_name = rg.role_name
       AND existing.permission_id = p_new.id
   )',
  'INSERT INTO rbac_role_grants (role_name, permission_id)
   SELECT DISTINCT rg.role_name, p_new.id
   FROM rbac_role_grants rg
   INNER JOIN rbac_permissions p_old
     ON p_old.id = rg.permission_id
    AND p_old.app_scope = ''mahaverse''
    AND p_old.perm_key IN (
      ''nav.manage_data'',
      ''view.manage_data'',
      ''manage_data.write'',
      ''manage_data.read''
    )
   INNER JOIN rbac_permissions p_new
     ON p_new.app_scope = ''mahaverse''
    AND p_new.perm_key IN (''view.mileage_rate'', ''manage_data.mileage_rate'')
   WHERE NOT EXISTS (
     SELECT 1 FROM rbac_role_grants existing
     WHERE existing.role_name = rg.role_name
       AND existing.permission_id = p_new.id
   )'
);
PREPARE mr_stmt FROM @mr_sql;
EXECUTE mr_stmt;
DEALLOCATE PREPARE mr_stmt;

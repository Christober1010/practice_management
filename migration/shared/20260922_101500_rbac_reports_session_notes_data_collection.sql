-- Reports: Session Notes + Data Collection screen permissions.
-- Run on prod + test Mahaverse DBs. Idempotent.

INSERT INTO rbac_permissions (perm_key, label, perm_group, app_scope, sort_order) VALUES
('view.reports_session_notes', 'Reports: Session Notes', 'mahaverse_view', 'mahaverse', 185),
('view.reports_data_collection', 'Reports: Data Collection', 'mahaverse_view', 'mahaverse', 186)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  perm_group = VALUES(perm_group),
  sort_order = VALUES(sort_order);

-- Roles that already have Reports hub get the new screens.
SET @rsn_db := DATABASE();
SET @rsn_has_scope := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @rsn_db AND TABLE_NAME = 'rbac_role_grants' AND COLUMN_NAME = 'access_scope'
);

SET @rsn_sql := IF(@rsn_has_scope > 0,
  'INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
   SELECT DISTINCT rg.role_name, p_new.id, ''all''
   FROM rbac_role_grants rg
   INNER JOIN rbac_permissions p_old
     ON p_old.id = rg.permission_id
    AND p_old.app_scope = ''mahaverse''
    AND p_old.perm_key IN (''nav.reports'', ''view.reports'')
   INNER JOIN rbac_permissions p_new
     ON p_new.app_scope = ''mahaverse''
    AND p_new.perm_key IN (
      ''view.reports_session_notes'',
      ''view.reports_data_collection''
    )
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
    AND p_old.perm_key IN (''nav.reports'', ''view.reports'')
   INNER JOIN rbac_permissions p_new
     ON p_new.app_scope = ''mahaverse''
    AND p_new.perm_key IN (
      ''view.reports_session_notes'',
      ''view.reports_data_collection''
    )
   WHERE NOT EXISTS (
     SELECT 1 FROM rbac_role_grants existing
     WHERE existing.role_name = rg.role_name
       AND existing.permission_id = p_new.id
   )'
);
PREPARE rsn_stmt FROM @rsn_sql;
EXECUTE rsn_stmt;
DEALLOCATE PREPARE rsn_stmt;

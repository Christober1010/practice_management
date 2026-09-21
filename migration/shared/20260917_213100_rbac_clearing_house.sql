-- Manage Data: Clearing House screen (configurable SFTP for Office Ally).

INSERT INTO rbac_permissions (perm_key, label, perm_group, app_scope, sort_order) VALUES
('view.clearing_house', 'Manage Data: Clearing House', 'mahaverse_view', 'mahaverse', 332),
('manage_data.clearing_house', 'Clearing House · Edit', 'mahaverse_action', 'mahaverse', 333)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  perm_group = VALUES(perm_group),
  sort_order = VALUES(sort_order);

SET @ch_db := DATABASE();
SET @ch_has_scope := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @ch_db AND TABLE_NAME = 'rbac_role_grants' AND COLUMN_NAME = 'access_scope'
);

SET @ch_sql := IF(@ch_has_scope > 0,
  'INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
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
    AND p_new.perm_key IN (''view.clearing_house'', ''manage_data.clearing_house'')
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
    AND p_new.perm_key IN (''view.clearing_house'', ''manage_data.clearing_house'')
   WHERE NOT EXISTS (
     SELECT 1 FROM rbac_role_grants existing
     WHERE existing.role_name = rg.role_name
       AND existing.permission_id = p_new.id
   )'
);
PREPARE ch_stmt FROM @ch_sql;
EXECUTE ch_stmt;
DEALLOCATE PREPARE ch_stmt;

-- Per-report screen permissions (Session Log / Session Import / Insurance Utilization).
-- Run on prod + test Mahaverse DBs. Idempotent.

INSERT INTO rbac_permissions (perm_key, label, perm_group, app_scope, sort_order) VALUES
('view.reports_session_log', 'Reports: Session Log', 'mahaverse_view', 'mahaverse', 181),
('view.reports_session_import', 'Reports: Session Import', 'mahaverse_view', 'mahaverse', 182),
('view.reports_insurance_utilization', 'Reports: Insurance Utilization', 'mahaverse_view', 'mahaverse', 183)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  perm_group = VALUES(perm_group),
  sort_order = VALUES(sort_order);

-- Roles that already have Reports hub (nav.reports or view.reports) get all three screens.
SET @rr_db := DATABASE();
SET @rr_has_scope := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @rr_db AND TABLE_NAME = 'rbac_role_grants' AND COLUMN_NAME = 'access_scope'
);

SET @rr_sql := IF(@rr_has_scope > 0,
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
      ''view.reports_session_log'',
      ''view.reports_session_import'',
      ''view.reports_insurance_utilization''
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
      ''view.reports_session_log'',
      ''view.reports_session_import'',
      ''view.reports_insurance_utilization''
    )
   WHERE NOT EXISTS (
     SELECT 1 FROM rbac_role_grants existing
     WHERE existing.role_name = rg.role_name
       AND existing.permission_id = p_new.id
   )'
);
PREPARE rr_stmt FROM @rr_sql;
EXECUTE rr_stmt;
DEALLOCATE PREPARE rr_stmt;

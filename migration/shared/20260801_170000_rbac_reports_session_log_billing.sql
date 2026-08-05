-- Reports: Session Log-Billing screen (Session Log without Misc hrs / Diff).
-- Run on prod + test Mahaverse DBs. Idempotent.

INSERT INTO rbac_permissions (perm_key, label, perm_group, app_scope, sort_order) VALUES
('view.reports_session_log_billing', 'Reports: Session Log-Billing', 'mahaverse_view', 'mahaverse', 1815)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  perm_group = VALUES(perm_group),
  sort_order = VALUES(sort_order);

-- Roles that already have Session Log (or Reports hub) get Session Log-Billing.
SET @slb_db := DATABASE();
SET @slb_has_scope := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @slb_db AND TABLE_NAME = 'rbac_role_grants' AND COLUMN_NAME = 'access_scope'
);

SET @slb_sql := IF(@slb_has_scope > 0,
  'INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
   SELECT DISTINCT rg.role_name, p_new.id, ''all''
   FROM rbac_role_grants rg
   INNER JOIN rbac_permissions p_old
     ON p_old.id = rg.permission_id
    AND p_old.app_scope = ''mahaverse''
    AND p_old.perm_key IN (
      ''nav.reports'',
      ''view.reports'',
      ''view.reports_session_log''
    )
   INNER JOIN rbac_permissions p_new
     ON p_new.app_scope = ''mahaverse''
    AND p_new.perm_key = ''view.reports_session_log_billing''
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
      ''nav.reports'',
      ''view.reports'',
      ''view.reports_session_log''
    )
   INNER JOIN rbac_permissions p_new
     ON p_new.app_scope = ''mahaverse''
    AND p_new.perm_key = ''view.reports_session_log_billing''
   WHERE NOT EXISTS (
     SELECT 1 FROM rbac_role_grants existing
     WHERE existing.role_name = rg.role_name
       AND existing.permission_id = p_new.id
   )'
);
PREPARE slb_stmt FROM @slb_sql;
EXECUTE slb_stmt;
DEALLOCATE PREPARE slb_stmt;

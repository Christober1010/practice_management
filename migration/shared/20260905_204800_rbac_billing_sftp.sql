-- Office Ally SFTP claim submit: separate from general billing.write.
-- Default: admin + biller. Others must be granted in Admin → Role permissions.
-- Run on prod + test Mahaverse DBs. Idempotent.

INSERT INTO rbac_permissions (perm_key, label, perm_group, app_scope, sort_order) VALUES
('billing.sftp', 'Billing: Submit claims via Office Ally SFTP', 'mahaverse_action', 'mahaverse', 920)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  perm_group = VALUES(perm_group),
  sort_order = VALUES(sort_order);

SET @sftp_db := DATABASE();
SET @sftp_has_scope := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @sftp_db AND TABLE_NAME = 'rbac_role_grants' AND COLUMN_NAME = 'access_scope'
);

SET @sftp_sql := IF(@sftp_has_scope > 0,
  'INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
   SELECT r.role_name, p.id, ''all''
   FROM (
     SELECT ''admin'' AS role_name
     UNION ALL SELECT ''biller''
   ) r
   INNER JOIN rbac_permissions p
     ON p.app_scope = ''mahaverse''
    AND p.perm_key = ''billing.sftp''
   WHERE NOT EXISTS (
     SELECT 1 FROM rbac_role_grants existing
     WHERE existing.role_name = r.role_name
       AND existing.permission_id = p.id
   )',
  'INSERT INTO rbac_role_grants (role_name, permission_id)
   SELECT r.role_name, p.id
   FROM (
     SELECT ''admin'' AS role_name
     UNION ALL SELECT ''biller''
   ) r
   INNER JOIN rbac_permissions p
     ON p.app_scope = ''mahaverse''
    AND p.perm_key = ''billing.sftp''
   WHERE NOT EXISTS (
     SELECT 1 FROM rbac_role_grants existing
     WHERE existing.role_name = r.role_name
       AND existing.permission_id = p.id
   )'
);
PREPARE sftp_stmt FROM @sftp_sql;
EXECUTE sftp_stmt;
DEALLOCATE PREPARE sftp_stmt;

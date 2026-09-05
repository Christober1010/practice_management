-- Allow creating appointments on past calendar days (clinic TZ America/Chicago).
-- Without this grant, roles may only create current/future dates.
-- Default: admin + planner get it; BCBA / RBT do not.
-- Run on prod + test Mahaverse DBs. Idempotent.

INSERT INTO rbac_permissions (perm_key, label, perm_group, app_scope, sort_order) VALUES
('scheduling.session.create_past', 'Appointments: Create past-date sessions', 'mahaverse_action', 'mahaverse', 466)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  perm_group = VALUES(perm_group),
  sort_order = VALUES(sort_order);

SET @cp_db := DATABASE();
SET @cp_has_scope := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @cp_db AND TABLE_NAME = 'rbac_role_grants' AND COLUMN_NAME = 'access_scope'
);

-- Grant to admin (all) and planner (all). Do not grant to bcba/rbt by default.
SET @cp_sql := IF(@cp_has_scope > 0,
  'INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
   SELECT r.role_name, p.id, ''all''
   FROM (
     SELECT ''admin'' AS role_name
     UNION ALL SELECT ''planner''
   ) r
   INNER JOIN rbac_permissions p
     ON p.app_scope = ''mahaverse''
    AND p.perm_key = ''scheduling.session.create_past''
   WHERE NOT EXISTS (
     SELECT 1 FROM rbac_role_grants existing
     WHERE existing.role_name = r.role_name
       AND existing.permission_id = p.id
   )',
  'INSERT INTO rbac_role_grants (role_name, permission_id)
   SELECT r.role_name, p.id
   FROM (
     SELECT ''admin'' AS role_name
     UNION ALL SELECT ''planner''
   ) r
   INNER JOIN rbac_permissions p
     ON p.app_scope = ''mahaverse''
    AND p.perm_key = ''scheduling.session.create_past''
   WHERE NOT EXISTS (
     SELECT 1 FROM rbac_role_grants existing
     WHERE existing.role_name = r.role_name
       AND existing.permission_id = p.id
   )'
);
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

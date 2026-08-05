-- Mileage: non-admin roles default to Self scope (admin stays All).
-- Role Access matrix: Off / Self / All on view.reports_mileage.
-- Idempotent. Run on prod + test after 20260731_203100_rbac_reports_mileage.sql.

SET @rm_db := DATABASE();
SET @rm_has_scope := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @rm_db AND TABLE_NAME = 'rbac_role_grants' AND COLUMN_NAME = 'access_scope'
);

SET @rm_sql := IF(@rm_has_scope > 0,
  'UPDATE rbac_role_grants rg
   INNER JOIN rbac_permissions p ON p.id = rg.permission_id
   SET rg.access_scope = ''self''
   WHERE p.app_scope = ''mahaverse''
     AND p.perm_key = ''view.reports_mileage''
     AND LOWER(rg.role_name) <> ''admin''',
  'SELECT 1'
);
PREPARE rm_stmt FROM @rm_sql;
EXECUTE rm_stmt;
DEALLOCATE PREPARE rm_stmt;

SET @rm_sql_admin := IF(@rm_has_scope > 0,
  'UPDATE rbac_role_grants rg
   INNER JOIN rbac_permissions p ON p.id = rg.permission_id
   SET rg.access_scope = ''all''
   WHERE p.app_scope = ''mahaverse''
     AND p.perm_key = ''view.reports_mileage''
     AND LOWER(rg.role_name) = ''admin''',
  'SELECT 1'
);
PREPARE rm_stmt2 FROM @rm_sql_admin;
EXECUTE rm_stmt2;
DEALLOCATE PREPARE rm_stmt2;

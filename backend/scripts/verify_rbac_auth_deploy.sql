-- verify_rbac_auth_deploy.sql
-- Run against production (or staging) MySQL after deploying PHP and migrations.
-- Usage: mysql -u USER -p DATABASE < backend/scripts/verify_rbac_auth_deploy.sql

SELECT '--- Tables present ---' AS step;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('rbac_permissions', 'rbac_role_grants', 'AuthTokens', 'users')
ORDER BY table_name;

SELECT '--- rbac_permissions counts by scope ---' AS step;
SELECT app_scope, COUNT(*) AS cnt
FROM rbac_permissions
GROUP BY app_scope
ORDER BY app_scope;

SELECT '--- rbac_role_grants sample (roles) ---' AS step;
SELECT DISTINCT LOWER(role_name) AS role_name
FROM rbac_role_grants
ORDER BY role_name;

SELECT '--- AuthTokens: recent rows (no secrets) ---' AS step;
SELECT id, user_id, expires_at, revoked_at IS NOT NULL AS revoked
FROM AuthTokens
ORDER BY id DESC
LIMIT 5;

SELECT '--- users.id type (for AuthTokens.user_id FK) ---' AS step;
SELECT COLUMN_TYPE
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'users'
  AND column_name = 'id';

SELECT '--- Done ---' AS step;

-- RBT client roster: assigned/linked only (access_scope = self).
-- Aligns DB grants with get-clients / rbac_user_may_access_client_row which
-- honor clients.view all|self from Admin → Role permissions.
-- Safe to re-run.

UPDATE rbac_role_grants rg
INNER JOIN rbac_permissions p ON p.id = rg.permission_id
SET rg.access_scope = 'self'
WHERE LOWER(rg.role_name) = 'rbt'
  AND p.app_scope = 'mahaverse'
  AND p.perm_key IN ('clients.view', 'clients.read');

-- RBAC matrix v1: access_scope on grants + fine-grained permissions + optional user links.
-- Run manually on each environment after backup. Safe to re-run: skips ALTERs when columns already exist.

-- 1) access_scope on role grants (one row per role+permission; scope is all|self)
SET @mv_db := DATABASE();
SET @mv_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @mv_db AND TABLE_NAME = 'rbac_role_grants' AND COLUMN_NAME = 'access_scope'
);
SET @mv_sql := IF(@mv_exists = 0,
  'ALTER TABLE rbac_role_grants ADD COLUMN access_scope ENUM(''all'',''self'') NOT NULL DEFAULT ''all'' AFTER permission_id',
  'SELECT ''skip: rbac_role_grants.access_scope already exists'' AS migrate_rbac_matrix_v1_note'
);
PREPARE mv_stmt FROM @mv_sql;
EXECUTE mv_stmt;
DEALLOCATE PREPARE mv_stmt;

-- 2) Optional user linkage for self-scoped checks (email match remains fallback)
SET @mv_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @mv_db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'link_staff_id'
);
SET @mv_sql := IF(@mv_exists = 0,
  'ALTER TABLE users ADD COLUMN link_staff_id VARCHAR(64) NULL DEFAULT NULL COMMENT ''Mahaverse staff.id for this login (self RBAC)''',
  'SELECT ''skip: users.link_staff_id already exists'' AS migrate_rbac_matrix_v1_note'
);
PREPARE mv_stmt FROM @mv_sql;
EXECUTE mv_stmt;
DEALLOCATE PREPARE mv_stmt;

SET @mv_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @mv_db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'link_client_id'
);
SET @mv_sql := IF(@mv_exists = 0,
  'ALTER TABLE users ADD COLUMN link_client_id VARCHAR(64) NULL DEFAULT NULL COMMENT ''Mahaverse clients.client_id for client portal logins''',
  'SELECT ''skip: users.link_client_id already exists'' AS migrate_rbac_matrix_v1_note'
);
PREPARE mv_stmt FROM @mv_sql;
EXECUTE mv_stmt;
DEALLOCATE PREPARE mv_stmt;

-- 3) Fine-grained permissions (idempotent inserts)
INSERT INTO rbac_permissions (perm_key, label, perm_group, app_scope, sort_order) VALUES
('scheduling.session.create', 'Scheduling: Add session', 'mahaverse_action', 'mahaverse', 461),
('scheduling.session.view', 'Scheduling: View session', 'mahaverse_action', 'mahaverse', 462),
('scheduling.session.notes', 'Scheduling: Session notes', 'mahaverse_action', 'mahaverse', 463),
('scheduling.session.update', 'Scheduling: Edit session', 'mahaverse_action', 'mahaverse', 464),
('scheduling.session.delete', 'Scheduling: Delete session', 'mahaverse_action', 'mahaverse', 465),
('clients.create', 'Clients: Add client', 'mahaverse_action', 'mahaverse', 401),
('clients.view', 'Clients: View', 'mahaverse_action', 'mahaverse', 402),
('clients.update', 'Clients: Edit client', 'mahaverse_action', 'mahaverse', 403),
('clients.archive', 'Clients: Archive client', 'mahaverse_action', 'mahaverse', 404),
('staff.archive', 'Staff: Archive staff', 'mahaverse_action', 'mahaverse', 431),
('users.delete', 'Users: Delete user', 'mahaverse_action', 'mahaverse', 451),
('users.deactivate', 'Users: Deactivate user', 'mahaverse_action', 'mahaverse', 452),
('master_data.domains', 'Data collection: Domains (manage)', 'mahaverse_action', 'mahaverse', 511),
('master_data.programs', 'Data collection: Programs (manage)', 'mahaverse_action', 'mahaverse', 512),
('master_data.targets', 'Data collection: Targets (manage)', 'mahaverse_action', 'mahaverse', 513),
('master_data.prompts', 'Data collection: Prompts (manage)', 'mahaverse_action', 'mahaverse', 514),
('manage_data.provider', 'Manage data: Providers', 'mahaverse_action', 'mahaverse', 531),
('manage_data.provider_service', 'Manage data: Provider services', 'mahaverse_action', 'mahaverse', 532),
('manage_data.service_code', 'Manage data: Service codes', 'mahaverse_action', 'mahaverse', 533),
('manage_data.diagnosis', 'Manage data: Diagnosis codes', 'mahaverse_action', 'mahaverse', 534),
('view.reports_session_log', 'Reports: Session Log', 'mahaverse_view', 'mahaverse', 181),
('view.reports_session_import', 'Reports: Session Import', 'mahaverse_view', 'mahaverse', 182),
('view.reports_insurance_utilization', 'Reports: Insurance Utilization', 'mahaverse_view', 'mahaverse', 183)
ON DUPLICATE KEY UPDATE label = VALUES(label), perm_group = VALUES(perm_group), sort_order = VALUES(sort_order);

-- 4) Default matrix-aligned grants (adjust after run via Admin Role Access UI)
-- Remove existing grants for these roles so INSERTs do not hit PRIMARY KEY (role_name, permission_id).
-- Note: after step 1, old admin rows already have access_scope='all'; without this DELETE, the admin INSERT duplicates (admin, id).

DELETE FROM rbac_role_grants WHERE LOWER(role_name) IN (
  'admin','bcba','rbt','biller','parent','planner','client'
);

INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
SELECT 'admin', id, 'all' FROM rbac_permissions WHERE app_scope = 'mahaverse'
ON DUPLICATE KEY UPDATE access_scope = VALUES(access_scope);

-- Planner: full scheduling (all), no clients/staff write by default
INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
SELECT 'planner', p.id, 'all'
FROM rbac_permissions p
WHERE p.perm_key IN (
  'nav.scheduling','view.scheduling',
  'scheduling.session.create','scheduling.session.view','scheduling.session.notes','scheduling.session.update','scheduling.session.delete',
  'scheduling.read','scheduling.write'
)
ON DUPLICATE KEY UPDATE access_scope = VALUES(access_scope);

-- BCBA: scheduling self (no delete); domains/programs/targets manage; prompts view only; legacy coarse keys for compat
INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
SELECT 'bcba', p.id, CASE p.perm_key
  WHEN 'scheduling.session.create' THEN 'self'
  WHEN 'scheduling.session.view' THEN 'self'
  WHEN 'scheduling.session.notes' THEN 'self'
  WHEN 'scheduling.session.update' THEN 'self'
  WHEN 'clients.view' THEN 'self'
  ELSE 'all'
END
FROM rbac_permissions p
WHERE p.perm_key IN (
  'nav.scheduling','nav.clients','nav.launchpad','nav.staff',
  'view.scheduling','view.clients','view.launchpad','view.staff',
  'view.domains','view.programs','view.targets','view.prompts',
  'clients.read','clients.view',
  'staff.read','staff.write',
  'scheduling.read','scheduling.write',
  'scheduling.session.create','scheduling.session.view','scheduling.session.notes','scheduling.session.update',
  'master_data.read','master_data.write','master_data.domains','master_data.programs','master_data.targets',
  'manage_data.read'
)
ON DUPLICATE KEY UPDATE access_scope = VALUES(access_scope);

-- RBT: view + notes self only for sessions; clients assigned-only (self)
INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
SELECT 'rbt', p.id, CASE p.perm_key
  WHEN 'scheduling.session.view' THEN 'self'
  WHEN 'scheduling.session.notes' THEN 'self'
  WHEN 'clients.view' THEN 'self'
  WHEN 'clients.read' THEN 'self'
  ELSE 'all'
END
FROM rbac_permissions p
WHERE p.perm_key IN (
  'nav.scheduling','nav.clients','nav.launchpad','nav.staff',
  'view.scheduling','view.clients','view.launchpad','view.staff',
  'clients.read','clients.view','staff.read',
  'scheduling.read',
  'scheduling.session.view','scheduling.session.notes'
)
ON DUPLICATE KEY UPDATE access_scope = VALUES(access_scope);

-- Biller: clients edit/view all; manage reference data add/edit (no delete keys in default); billing
INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
SELECT 'biller', p.id, 'all'
FROM rbac_permissions p
WHERE p.perm_key IN (
  'nav.dashboard','nav.clients','nav.billing','nav.manage_data',
  'view.dashboard','view.clients','view.billing','view.manage_data',
  'view.provider','view.provider_service_code','view.service_code','view.diagnosis',
  'clients.read','clients.view','clients.update',
  'manage_data.read','manage_data.write','manage_data.provider','manage_data.provider_service','manage_data.service_code','manage_data.diagnosis',
  'billing.read','billing.write'
)
ON DUPLICATE KEY UPDATE access_scope = VALUES(access_scope);

-- Parent / dashboard-only legacy
INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
SELECT 'parent', id, 'all' FROM rbac_permissions WHERE perm_key IN ('nav.dashboard','view.dashboard')
ON DUPLICATE KEY UPDATE access_scope = VALUES(access_scope);

-- Client portal: view + edit own client record only
INSERT INTO rbac_role_grants (role_name, permission_id, access_scope)
SELECT 'client', p.id, 'self'
FROM rbac_permissions p
WHERE p.perm_key IN (
  'nav.dashboard','nav.clients',
  'view.dashboard','view.clients',
  'clients.read','clients.view','clients.update'
)
ON DUPLICATE KEY UPDATE access_scope = VALUES(access_scope);

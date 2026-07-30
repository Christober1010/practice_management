-- Launchpad DB: RBAC catalog + Launchpad-only role grants.
-- Run once on the Launchpad database.

CREATE TABLE IF NOT EXISTS rbac_permissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  perm_key VARCHAR(160) NOT NULL,
  label VARCHAR(255) NOT NULL,
  perm_group VARCHAR(80) NOT NULL DEFAULT 'general',
  app_scope VARCHAR(32) NOT NULL DEFAULT 'mahaverse',
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_perm_key (perm_key),
  KEY idx_group (perm_group),
  KEY idx_scope (app_scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rbac_role_grants (
  role_name VARCHAR(64) NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_name, permission_id),
  CONSTRAINT fk_rbac_perm_lp FOREIGN KEY (permission_id) REFERENCES rbac_permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO rbac_permissions (perm_key, label, perm_group, app_scope, sort_order) VALUES
('nav.dashboard', 'Dashboard (menu)', 'mahaverse_nav', 'mahaverse', 10),
('nav.scheduling', 'Scheduling (menu)', 'mahaverse_nav', 'mahaverse', 20),
('nav.clients', 'Clients (menu)', 'mahaverse_nav', 'mahaverse', 30),
('nav.staff', 'Staff (menu)', 'mahaverse_nav', 'mahaverse', 40),
('nav.users', 'Users (menu)', 'mahaverse_nav', 'mahaverse', 50),
('nav.master_data', 'Data Collection (menu)', 'mahaverse_nav', 'mahaverse', 60),
('nav.manage_data', 'Manage Data (menu)', 'mahaverse_nav', 'mahaverse', 70),
('nav.reports', 'Reports (menu)', 'mahaverse_nav', 'mahaverse', 80),
('nav.launchpad', 'Launchpad (menu)', 'mahaverse_nav', 'mahaverse', 90),
('nav.billing', 'Billing (menu)', 'mahaverse_nav', 'mahaverse', 100),
('view.dashboard', 'Dashboard (screen)', 'mahaverse_view', 'mahaverse', 110),
('view.scheduling', 'Scheduling (screen)', 'mahaverse_view', 'mahaverse', 120),
('view.clients', 'Clients (screen)', 'mahaverse_view', 'mahaverse', 130),
('view.staff', 'Staff (screen)', 'mahaverse_view', 'mahaverse', 140),
('view.users', 'Users (screen)', 'mahaverse_view', 'mahaverse', 150),
('view.master_data', 'Data Collection hub (screen)', 'mahaverse_view', 'mahaverse', 160),
('view.manage_data', 'Manage Data hub (screen)', 'mahaverse_view', 'mahaverse', 170),
('view.reports', 'Reports hub (screen)', 'mahaverse_view', 'mahaverse', 180),
('view.reports_session_log', 'Reports: Session Log', 'mahaverse_view', 'mahaverse', 181),
('view.reports_session_import', 'Reports: Session Import', 'mahaverse_view', 'mahaverse', 182),
('view.reports_insurance_utilization', 'Reports: Insurance Utilization', 'mahaverse_view', 'mahaverse', 183),
('view.launchpad', 'Launchpad (screen)', 'mahaverse_view', 'mahaverse', 190),
('view.billing', 'Billing (screen)', 'mahaverse_view', 'mahaverse', 200),
('view.domains', 'Domains', 'mahaverse_view', 'mahaverse', 210),
('view.programs', 'Programs', 'mahaverse_view', 'mahaverse', 220),
('view.targets', 'Targets', 'mahaverse_view', 'mahaverse', 230),
('view.prompts', 'Prompts', 'mahaverse_view', 'mahaverse', 240),
('view.provider', 'Manage Providers', 'mahaverse_view', 'mahaverse', 250),
('view.provider_service_code', 'Provider Service Code', 'mahaverse_view', 'mahaverse', 260),
('view.service_code', 'Service Code', 'mahaverse_view', 'mahaverse', 270),
('view.diagnosis', 'Diagnosis', 'mahaverse_view', 'mahaverse', 280),
('view.locations', 'Locations', 'mahaverse_view', 'mahaverse', 290),
('view.facility_types', 'Facility Types', 'mahaverse_view', 'mahaverse', 300),
('view.treatment_types', 'Treatment Types', 'mahaverse_view', 'mahaverse', 310),
('view.document_types', 'Document Types', 'mahaverse_view', 'mahaverse', 320),
('clients.read', 'Clients: View', 'mahaverse_action', 'mahaverse', 400),
('clients.write', 'Clients: Create / Edit', 'mahaverse_action', 'mahaverse', 410),
('staff.read', 'Staff: View', 'mahaverse_action', 'mahaverse', 420),
('staff.write', 'Staff: Create / Edit', 'mahaverse_action', 'mahaverse', 430),
('users.read', 'Users: View', 'mahaverse_action', 'mahaverse', 440),
('users.write', 'Users: Create / Edit', 'mahaverse_action', 'mahaverse', 450),
('scheduling.read', 'Scheduling: View', 'mahaverse_action', 'mahaverse', 460),
('scheduling.write', 'Scheduling: Create / Edit', 'mahaverse_action', 'mahaverse', 470),
('reports.read', 'Reports: View', 'mahaverse_action', 'mahaverse', 480),
('reports.write', 'Reports: export/manage', 'mahaverse_action', 'mahaverse', 490),
('master_data.read', 'Data Collection: View', 'mahaverse_action', 'mahaverse', 500),
('master_data.write', 'Data Collection: Edit', 'mahaverse_action', 'mahaverse', 510),
('manage_data.read', 'Manage Data: View', 'mahaverse_action', 'mahaverse', 520),
('manage_data.write', 'Manage Data: Edit', 'mahaverse_action', 'mahaverse', 530),
('billing.read', 'Billing: View', 'mahaverse_action', 'mahaverse', 540),
('billing.write', 'Billing: Edit', 'mahaverse_action', 'mahaverse', 550),
('launchpad.dashboard', 'Launchpad: Dashboard', 'launchpad', 'launchpad', 600),
('launchpad.offer_letter', 'Launchpad: Offer Letter', 'launchpad', 'launchpad', 610),
('launchpad.profile_form', 'Launchpad: Profile / My Profile', 'launchpad', 'launchpad', 620),
('launchpad.users', 'Launchpad: User Accounts', 'launchpad', 'launchpad', 630),
('launchpad.profile_submit', 'Launchpad: Submit profile forms', 'launchpad', 'launchpad', 640)
ON DUPLICATE KEY UPDATE label = VALUES(label), perm_group = VALUES(perm_group), sort_order = VALUES(sort_order);

DELETE FROM rbac_role_grants WHERE role_name IN ('admin','hr','staff','viewer');

INSERT INTO rbac_role_grants (role_name, permission_id)
SELECT 'admin', id FROM rbac_permissions WHERE app_scope = 'launchpad';

INSERT INTO rbac_role_grants (role_name, permission_id)
SELECT r.role, p.id FROM (
  SELECT 'hr' AS role UNION SELECT 'staff'
) r
JOIN rbac_permissions p ON p.perm_key IN (
  'launchpad.dashboard','launchpad.offer_letter','launchpad.profile_form','launchpad.profile_submit'
);

INSERT INTO rbac_role_grants (role_name, permission_id)
SELECT 'viewer', id FROM rbac_permissions WHERE perm_key IN (
  'launchpad.dashboard','launchpad.offer_letter'
);

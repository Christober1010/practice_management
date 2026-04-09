/**
 * Canonical RBAC permission keys (mirror backend/rbac_permissions seed).
 * Used for UI guards and admin matrix labels.
 */

export const PERM = {
  // Mahaverse navigation
  NAV_DASHBOARD: "nav.dashboard",
  NAV_SCHEDULING: "nav.scheduling",
  NAV_CLIENTS: "nav.clients",
  NAV_STAFF: "nav.staff",
  NAV_USERS: "nav.users",
  NAV_MASTER_DATA: "nav.master_data",
  NAV_MANAGE_DATA: "nav.manage_data",
  NAV_REPORTS: "nav.reports",
  NAV_LAUNCHPAD: "nav.launchpad",
  NAV_BILLING: "nav.billing",
  // Views (screen access)
  VIEW_DASHBOARD: "view.dashboard",
  VIEW_SCHEDULING: "view.scheduling",
  VIEW_CLIENTS: "view.clients",
  VIEW_STAFF: "view.staff",
  VIEW_USERS: "view.users",
  VIEW_MASTER_DATA: "view.master_data",
  VIEW_MANAGE_DATA: "view.manage_data",
  VIEW_REPORTS: "view.reports",
  VIEW_LAUNCHPAD: "view.launchpad",
  VIEW_BILLING: "view.billing",
  VIEW_DOMAINS: "view.domains",
  VIEW_PROGRAMS: "view.programs",
  VIEW_TARGETS: "view.targets",
  VIEW_PROMPTS: "view.prompts",
  VIEW_PROVIDER: "view.provider",
  VIEW_PROVIDER_SERVICE_CODE: "view.provider_service_code",
  VIEW_SERVICE_CODE: "view.service_code",
  VIEW_DIAGNOSIS: "view.diagnosis",
  VIEW_LOCATIONS: "view.locations",
  VIEW_FACILITY_TYPES: "view.facility_types",
  VIEW_TREATMENT_TYPES: "view.treatment_types",
  VIEW_DOCUMENT_TYPES: "view.document_types",
  // Actions
  CLIENTS_READ: "clients.read",
  CLIENTS_WRITE: "clients.write",
  STAFF_READ: "staff.read",
  STAFF_WRITE: "staff.write",
  USERS_READ: "users.read",
  USERS_WRITE: "users.write",
  SCHEDULING_READ: "scheduling.read",
  SCHEDULING_WRITE: "scheduling.write",
  REPORTS_READ: "reports.read",
  REPORTS_WRITE: "reports.write",
  MASTER_DATA_READ: "master_data.read",
  MASTER_DATA_WRITE: "master_data.write",
  MANAGE_DATA_READ: "manage_data.read",
  MANAGE_DATA_WRITE: "manage_data.write",
  BILLING_READ: "billing.read",
  BILLING_WRITE: "billing.write",
  // Launchpad (separate DB / roles)
  LP_DASHBOARD: "launchpad.dashboard",
  LP_OFFER_LETTER: "launchpad.offer_letter",
  LP_PROFILE_FORM: "launchpad.profile_form",
  LP_USERS: "launchpad.users",
  LP_PROFILE_SUBMIT: "launchpad.profile_submit",
};

/** currentView id -> minimum permission to render */
export const VIEW_REQUIRED_PERMISSION = {
  dashboard: PERM.VIEW_DASHBOARD,
  scheduling: PERM.VIEW_SCHEDULING,
  clients: PERM.VIEW_CLIENTS,
  staff: PERM.VIEW_STAFF,
  users: PERM.VIEW_USERS,
  masterData: PERM.VIEW_MASTER_DATA,
  manageData: PERM.VIEW_MANAGE_DATA,
  reports: PERM.VIEW_REPORTS,
  billing: PERM.VIEW_BILLING,
  modules: PERM.VIEW_MASTER_DATA,
  domains: PERM.VIEW_DOMAINS,
  programs: PERM.VIEW_PROGRAMS,
  targets: PERM.VIEW_TARGETS,
  prompts: PERM.VIEW_PROMPTS,
  provider: PERM.VIEW_PROVIDER,
  providerServiceCode: PERM.VIEW_PROVIDER_SERVICE_CODE,
  serviceCode: PERM.VIEW_SERVICE_CODE,
  diagnosis: PERM.VIEW_DIAGNOSIS,
  locations: PERM.VIEW_LOCATIONS,
  facilityTypes: PERM.VIEW_FACILITY_TYPES,
  treatmentTypes: PERM.VIEW_TREATMENT_TYPES,
  documentTypes: PERM.VIEW_DOCUMENT_TYPES,
  sessions: PERM.VIEW_SCHEDULING,
  portal: PERM.VIEW_DASHBOARD,
  roleAccess: PERM.USERS_WRITE,
};

/** Maps main menu view ids to screen permission (sidebar uses view.* so menu matches route guards). */
export function buildMenuPermissionMap() {
  return {
    dashboard: PERM.VIEW_DASHBOARD,
    scheduling: PERM.VIEW_SCHEDULING,
    clients: PERM.VIEW_CLIENTS,
    staff: PERM.VIEW_STAFF,
    users: PERM.VIEW_USERS,
    masterData: PERM.VIEW_MASTER_DATA,
    manageData: PERM.VIEW_MANAGE_DATA,
    reports: PERM.VIEW_REPORTS,
    launchpad: PERM.VIEW_LAUNCHPAD,
    billing: PERM.VIEW_BILLING,
  };
}

export function buildSubmenuPermissionMap() {
  return {
    domains: PERM.VIEW_DOMAINS,
    programs: PERM.VIEW_PROGRAMS,
    targets: PERM.VIEW_TARGETS,
    prompts: PERM.VIEW_PROMPTS,
    provider: PERM.VIEW_PROVIDER,
    providerServiceCode: PERM.VIEW_PROVIDER_SERVICE_CODE,
    serviceCode: PERM.VIEW_SERVICE_CODE,
    diagnosis: PERM.VIEW_DIAGNOSIS,
    locations: PERM.VIEW_LOCATIONS,
    facilityTypes: PERM.VIEW_FACILITY_TYPES,
    treatmentTypes: PERM.VIEW_TREATMENT_TYPES,
    documentTypes: PERM.VIEW_DOCUMENT_TYPES,
  };
}

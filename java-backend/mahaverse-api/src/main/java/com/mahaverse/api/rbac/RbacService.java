package com.mahaverse.api.rbac;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * RBAC permission resolution compatible with backend/rbac_helpers.php.
 * Falls back to legacy role defaults when DB grants are empty/missing.
 */
@Service
public class RbacService {

    private final JdbcTemplate jdbc;

    public RbacService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<String> getEffectivePermissions(String roleName, String scope) {
        String role = normalize(roleName);
        String appScope = (scope == null || scope.isBlank()) ? "mahaverse" : scope.trim().toLowerCase(Locale.ROOT);

        if ("0".equalsIgnoreCase(System.getenv().getOrDefault("RBAC_USE_DB", "1"))
                || "false".equalsIgnoreCase(System.getenv().getOrDefault("RBAC_USE_DB", "1"))) {
            return legacyPermissions(role, appScope);
        }

        try {
            if (!rbacTablesExist()) {
                return legacyPermissions(role, appScope);
            }
            List<String> fromDb = fetchGrants(role, appScope);
            if (fromDb.isEmpty()) {
                return legacyPermissions(role, appScope);
            }
            return fromDb;
        } catch (DataAccessException ex) {
            return legacyPermissions(role, appScope);
        }
    }

    public boolean hasPermission(String roleName, String permKey, String scope) {
        List<String> perms = getEffectivePermissions(roleName, scope);
        for (String candidate : expandAliases(permKey)) {
            if (perms.contains(candidate)) {
                return true;
            }
        }
        return false;
    }

    private boolean rbacTablesExist() {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name = 'rbac_permissions'
                """,
                Integer.class
        );
        return count != null && count > 0;
    }

    private List<String> fetchGrants(String roleName, String appScope) {
        return jdbc.query(
                """
                SELECT p.perm_key
                FROM rbac_role_grants rg
                JOIN rbac_permissions p ON p.id = rg.permission_id
                WHERE LOWER(rg.role_name) = ?
                  AND p.app_scope = ?
                ORDER BY p.sort_order, p.perm_key
                """,
                (rs, rowNum) -> rs.getString("perm_key"),
                roleName,
                appScope
        );
    }

    private static String normalize(String role) {
        return role == null ? "" : role.trim().toLowerCase(Locale.ROOT);
    }

    private static List<String> expandAliases(String permKey) {
        if (permKey == null) {
            return List.of();
        }
        return switch (permKey) {
            case "clients.read" -> List.of("clients.read", "clients.view");
            case "clients.write" -> List.of("clients.write", "clients.create", "clients.update", "clients.archive");
            case "staff.write" -> List.of("staff.write", "staff.archive");
            case "scheduling.read" -> List.of("scheduling.read", "scheduling.session.view", "scheduling.session.notes");
            case "scheduling.write" -> List.of(
                    "scheduling.write",
                    "scheduling.session.create",
                    "scheduling.session.update",
                    "scheduling.session.delete"
            );
            case "master_data.write" -> List.of(
                    "master_data.write",
                    "master_data.domains",
                    "master_data.programs",
                    "master_data.targets",
                    "master_data.prompts",
                    "master_data.behavior_categories",
                    "master_data.behaviors"
            );
            case "manage_data.write" -> List.of(
                    "manage_data.write",
                    "manage_data.provider",
                    "manage_data.provider_service",
                    "manage_data.service_code",
                    "manage_data.diagnosis",
                    "manage_data.mileage_rate"
            );
            default -> List.of(permKey);
        };
    }

    private static List<String> legacyPermissions(String role, String scope) {
        if ("launchpad".equals(scope)) {
            return switch (role) {
                case "admin" -> List.of(
                        "launchpad.dashboard",
                        "launchpad.offer_letter",
                        "launchpad.profile_form",
                        "launchpad.users",
                        "launchpad.profile_submit"
                );
                case "hr", "staff" -> List.of(
                        "launchpad.dashboard",
                        "launchpad.offer_letter",
                        "launchpad.profile_form",
                        "launchpad.profile_submit"
                );
                case "viewer", "reader" -> List.of("launchpad.dashboard", "launchpad.offer_letter");
                default -> List.of(
                        "launchpad.dashboard",
                        "launchpad.offer_letter",
                        "launchpad.profile_form",
                        "launchpad.profile_submit"
                );
            };
        }

        Set<String> all = new LinkedHashSet<>(List.of(
                "nav.dashboard", "nav.scheduling", "nav.clients", "nav.staff", "nav.users",
                "nav.master_data", "nav.manage_data", "nav.reports", "nav.launchpad", "nav.billing",
                "view.dashboard", "view.scheduling", "view.clients", "view.staff", "view.users",
                "view.master_data", "view.manage_data", "view.reports", "view.launchpad", "view.billing",
                "view.domains", "view.programs", "view.targets", "view.prompts", "view.behavior_categories",
                "view.behaviors", "view.mileage_rate", "view.provider", "view.provider_service_code",
                "view.service_code", "view.diagnosis", "view.locations", "view.facility_types",
                "view.treatment_types", "view.document_types",
                "view.reports_session_log", "view.reports_session_log_billing", "view.reports_session_import",
                "view.reports_insurance_utilization", "view.reports_mileage",
                "clients.read", "clients.write", "staff.read", "staff.write", "users.read", "users.write",
                "scheduling.read", "scheduling.write", "reports.read", "reports.write",
                "master_data.read", "master_data.write", "manage_data.read", "manage_data.write",
                "billing.read", "billing.write", "billing.sftp",
                "scheduling.session.create", "scheduling.session.create_past", "scheduling.session.view",
                "scheduling.session.notes", "scheduling.session.update", "scheduling.session.delete",
                "clients.create", "clients.view", "clients.update", "clients.archive",
                "staff.archive", "users.delete", "users.deactivate",
                "master_data.domains", "master_data.programs", "master_data.targets", "master_data.prompts",
                "master_data.behavior_categories", "master_data.behaviors",
                "manage_data.provider", "manage_data.provider_service", "manage_data.service_code",
                "manage_data.diagnosis", "manage_data.mileage_rate"
        ));

        return switch (role) {
            case "admin" -> new ArrayList<>(all);
            case "client" -> List.of(
                    "nav.dashboard", "nav.clients", "view.dashboard", "view.clients",
                    "clients.read", "clients.view", "clients.update"
            );
            case "planner" -> List.of(
                    "nav.scheduling", "view.scheduling",
                    "scheduling.read", "scheduling.write",
                    "scheduling.session.create", "scheduling.session.create_past",
                    "scheduling.session.view", "scheduling.session.notes",
                    "scheduling.session.update", "scheduling.session.delete"
            );
            case "parent" -> List.of("nav.dashboard", "view.dashboard");
            case "biller" -> List.of(
                    "nav.dashboard", "nav.clients", "nav.billing", "nav.manage_data",
                    "view.dashboard", "view.clients", "view.billing", "view.manage_data",
                    "view.provider", "view.provider_service_code", "view.service_code", "view.diagnosis",
                    "clients.read", "clients.write", "clients.view", "clients.update",
                    "manage_data.read", "manage_data.write", "manage_data.provider",
                    "manage_data.provider_service", "manage_data.service_code", "manage_data.diagnosis",
                    "billing.read", "billing.write", "billing.sftp"
            );
            case "bcba" -> List.of(
                    "nav.scheduling", "nav.clients", "nav.launchpad", "nav.staff",
                    "view.scheduling", "view.clients", "view.launchpad", "view.staff",
                    "view.domains", "view.programs", "view.targets", "view.prompts",
                    "view.behavior_categories", "view.behaviors",
                    "clients.read", "clients.write", "clients.view",
                    "staff.read", "staff.write",
                    "scheduling.read", "scheduling.write",
                    "scheduling.session.create", "scheduling.session.view",
                    "scheduling.session.notes", "scheduling.session.update",
                    "master_data.read", "master_data.write",
                    "master_data.domains", "master_data.programs", "master_data.targets",
                    "master_data.behavior_categories", "master_data.behaviors",
                    "manage_data.read"
            );
            default -> List.of(
                    "nav.scheduling", "nav.clients", "nav.launchpad", "nav.staff",
                    "view.scheduling", "view.clients", "view.launchpad", "view.staff",
                    "clients.read", "clients.view", "staff.read",
                    "scheduling.read",
                    "scheduling.session.view", "scheduling.session.notes"
            );
        };
    }
}

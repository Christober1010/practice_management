package com.launchpad.api.rbac;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.launchpad.api.common.ApiException;

@Service
public class RbacService {

    private final JdbcTemplate jdbc;

    public RbacService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<String> getEffectivePermissions(String roleName, String scope) {
        String role = normalize(roleName);
        String appScope = (scope == null || scope.isBlank()) ? "launchpad" : scope.trim().toLowerCase(Locale.ROOT);

        if ("admin".equals(role) && "launchpad".equals(appScope)) {
            List<String> fromDb = safeFetchGrants(role, appScope);
            if (!fromDb.isEmpty()) {
                return fromDb;
            }
            return legacyPermissions(role, appScope);
        }

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
        return getEffectivePermissions(roleName, scope).contains(permKey);
    }

    public Map<String, Object> catalog(String scope) {
        String appScope = normalizeScope(scope);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("scope", appScope);
        if (!rbacTablesExist()) {
            response.put("permissions", List.of());
            response.put("message", "RBAC tables not installed; using legacy role defaults.");
            return response;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                """
                SELECT id, perm_key, label, perm_group, app_scope, sort_order
                FROM rbac_permissions
                WHERE app_scope = ?
                ORDER BY sort_order ASC, perm_key ASC
                """,
                appScope
        );
        response.put("permissions", rows);
        return response;
    }

    public Map<String, Object> matrix(String scope) {
        String appScope = normalizeScope(scope);
        if (!rbacTablesExist()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "RBAC tables not installed");
        }
        List<Map<String, Object>> permissions = jdbc.queryForList(
                """
                SELECT id, perm_key, label, perm_group, app_scope, sort_order
                FROM rbac_permissions
                WHERE app_scope = ?
                ORDER BY sort_order ASC, perm_key ASC
                """,
                appScope
        );
        List<String> roles = "launchpad".equals(appScope)
                ? List.of("admin", "hr", "staff", "viewer")
                : List.of("admin", "bcba", "rbt", "parent", "biller");

        Map<String, Set<String>> grants = new LinkedHashMap<>();
        for (String role : roles) {
            grants.put(role, new LinkedHashSet<>());
        }
        List<Map<String, Object>> grantRows = jdbc.queryForList(
                """
                SELECT LOWER(rg.role_name) AS role_name, p.perm_key
                FROM rbac_role_grants rg
                JOIN rbac_permissions p ON p.id = rg.permission_id
                WHERE p.app_scope = ?
                """,
                appScope
        );
        for (Map<String, Object> row : grantRows) {
            String role = String.valueOf(row.get("role_name"));
            String key = String.valueOf(row.get("perm_key"));
            grants.computeIfAbsent(role, r -> new LinkedHashSet<>()).add(key);
        }

        Map<String, Object> grantsOut = new LinkedHashMap<>();
        for (Map.Entry<String, Set<String>> e : grants.entrySet()) {
            grantsOut.put(e.getKey(), new ArrayList<>(e.getValue()));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("scope", appScope);
        response.put("roles", roles);
        response.put("permissions", permissions);
        response.put("grants", grantsOut);
        return response;
    }

    @Transactional
    public Map<String, Object> saveRole(String roleName, List<String> permissionKeys, String scope) {
        String appScope = normalizeScope(scope);
        String role = normalize(roleName);
        if (role.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "role is required");
        }
        List<String> allowedRoles = "launchpad".equals(appScope)
                ? List.of("admin", "hr", "staff", "viewer")
                : List.of("admin", "bcba", "rbt", "parent", "biller");
        if (!allowedRoles.contains(role)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid role for this scope");
        }
        if (!rbacTablesExist()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "RBAC tables not installed");
        }

        List<String> keys = permissionKeys == null ? List.of() : permissionKeys.stream()
                .map(k -> k == null ? "" : k.trim().toLowerCase(Locale.ROOT))
                .filter(k -> !k.isEmpty())
                .distinct()
                .toList();

        if ("launchpad".equals(appScope) && "admin".equals(role) && !keys.contains("launchpad.users")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Launchpad admin must retain launchpad.users.");
        }
        if ("mahaverse".equals(appScope) && "admin".equals(role) && !keys.contains("users.write")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Admin role must retain users.write (prevents lockout).");
        }

        jdbc.update(
                """
                DELETE rg FROM rbac_role_grants rg
                JOIN rbac_permissions p ON p.id = rg.permission_id
                WHERE LOWER(rg.role_name) = ? AND p.app_scope = ?
                """,
                role,
                appScope
        );

        for (String key : keys) {
            Long permId = jdbc.query(
                    "SELECT id FROM rbac_permissions WHERE perm_key = ? AND app_scope = ? LIMIT 1",
                    rs -> rs.next() ? rs.getLong("id") : null,
                    key,
                    appScope
            );
            if (permId == null) {
                continue;
            }
            jdbc.update(
                    "INSERT INTO rbac_role_grants (role_name, permission_id) VALUES (?, ?)",
                    role,
                    permId
            );
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("role", role);
        response.put("scope", appScope);
        response.put("permission_keys", keys);
        return response;
    }

    private List<String> safeFetchGrants(String role, String appScope) {
        try {
            if (!rbacTablesExist()) {
                return List.of();
            }
            return fetchGrants(role, appScope);
        } catch (DataAccessException ex) {
            return List.of();
        }
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

    private static String normalizeScope(String scope) {
        String s = scope == null ? "launchpad" : scope.trim().toLowerCase(Locale.ROOT);
        if (!List.of("mahaverse", "launchpad").contains(s)) {
            return "launchpad";
        }
        return s;
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
        return List.of();
    }
}

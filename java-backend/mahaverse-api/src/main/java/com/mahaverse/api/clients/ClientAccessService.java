package com.mahaverse.api.clients;

import java.util.Locale;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.mahaverse.api.auth.UserRecord;
import com.mahaverse.api.rbac.RbacService;

/**
 * Client roster visibility compatible with backend/rbac_helpers.php.
 */
@Service
public class ClientAccessService {

    private final JdbcTemplate jdbc;
    private final RbacService rbac;

    public ClientAccessService(JdbcTemplate jdbc, RbacService rbac) {
        this.jdbc = jdbc;
        this.rbac = rbac;
    }

    /**
     * @return "all", "self", or null (no roster access)
     */
    public String rosterAccessScope(UserRecord user) {
        if (user == null || user.role() == null) {
            return null;
        }
        String role = user.role().trim().toLowerCase(Locale.ROOT);
        if ("admin".equals(role)) {
            return "all";
        }

        // Prefer DB grants when present; otherwise legacy defaults.
        if (rbac.hasPermission(role, "clients.view", "mahaverse")
                || rbac.hasPermission(role, "clients.read", "mahaverse")) {
            if ("biller".equals(role)) {
                return "all";
            }
            // Without grant-map access_scope column wiring, therapists default to self;
            // admin already returned. For local admin-only seed this is fine.
            if (rbac.hasPermission(role, "clients.write", "mahaverse")
                    && ("biller".equals(role) || "admin".equals(role))) {
                return "all";
            }
            return "self";
        }
        return null;
    }

    public boolean mayAccessClientRow(UserRecord user, String clientId) {
        if (user == null || clientId == null || clientId.isBlank()) {
            return false;
        }
        String role = user.role() == null ? "" : user.role().trim().toLowerCase(Locale.ROOT);
        if ("admin".equals(role)) {
            return true;
        }
        String scope = rosterAccessScope(user);
        if (scope == null) {
            return false;
        }
        if ("all".equals(scope)) {
            return true;
        }
        // self: linked client_id or staff_client_assignments
        if (clientId.equals(user.linkClientId())) {
            return true;
        }
        String staffId = user.linkStaffId();
        if (staffId == null || staffId.isBlank()) {
            return false;
        }
        try {
            Integer count = jdbc.queryForObject(
                    """
                    SELECT COUNT(*) FROM staff_client_assignments
                    WHERE staff_id = ? AND client_id = ?
                    """,
                    Integer.class,
                    staffId,
                    clientId
            );
            return count != null && count > 0;
        } catch (Exception ex) {
            return false;
        }
    }

    public static boolean rowIsActive(java.util.Map<String, Object> client) {
        Object archived = client.get("archived");
        boolean isArchived = archived != null && (
                archived.equals(1) || archived.equals(true) || "1".equals(String.valueOf(archived))
        );
        if (isArchived) {
            return false;
        }
        Object active = client.get("is_active");
        if (active == null) {
            return true;
        }
        return active.equals(1) || active.equals(true) || "1".equals(String.valueOf(active));
    }
}

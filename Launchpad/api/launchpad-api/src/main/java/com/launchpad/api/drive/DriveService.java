package com.launchpad.api.drive;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.launchpad.api.auth.UserRecord;
import com.launchpad.api.common.ApiException;
import com.launchpad.api.security.AuthContext;

@Service
public class DriveService {

    private final JdbcTemplate jdbc;

    public DriveService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> status() {
        requireAdminLike();
        boolean enabled = envTruthy("GOOGLE_DRIVE_ENABLED");
        String authMode = System.getenv().getOrDefault("GOOGLE_DRIVE_AUTH_MODE", "service_account");
        boolean connected = false;
        String connectedBy = null;
        Object updatedAt = null;

        if ("oauth".equalsIgnoreCase(authMode)) {
            try {
                List<Map<String, Object>> rows = jdbc.queryForList(
                        """
                        SELECT refresh_token_encrypted, updated_at
                        FROM GoogleDriveOAuthTokens
                        ORDER BY id ASC LIMIT 1
                        """
                );
                if (!rows.isEmpty() && rows.get(0).get("refresh_token_encrypted") != null
                        && !String.valueOf(rows.get(0).get("refresh_token_encrypted")).isBlank()) {
                    connected = true;
                    updatedAt = rows.get(0).get("updated_at");
                }
            } catch (Exception ignored) {
            }
        } else {
            String saJson = System.getenv("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON");
            connected = saJson != null && !saJson.isBlank();
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("enabled", enabled);
        response.put("auth_mode", authMode);
        response.put("connected", connected);
        response.put("configured", enabled && (hasClientConfig() || connected));
        response.put("connected_by", connectedBy);
        response.put("updated_at", updatedAt);
        if (!enabled) {
            response.put("message", "Google Drive is not enabled. Set GOOGLE_DRIVE_ENABLED=true to configure.");
        }
        return response;
    }

    public Map<String, Object> start() {
        requireAdminLike();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", false);
        response.put("configured", false);
        response.put("message", "Google Drive OAuth is not configured on this server. Configure GOOGLE_DRIVE_CLIENT_ID / CLIENT_SECRET / REDIRECT_URI.");
        return response;
    }

    public Map<String, Object> link() {
        requireAdminLike();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", false);
        response.put("auth_url", null);
        response.put("message", "Google Drive OAuth link is unavailable until Drive credentials are configured.");
        return response;
    }

    public Map<String, Object> disconnect() {
        requireAdminLike();
        try {
            jdbc.update("DELETE FROM GoogleDriveOAuthTokens");
        } catch (Exception ignored) {
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "Google Drive disconnected (local tokens cleared if present).");
        return response;
    }

    public Map<String, Object> callback(Map<String, String> params) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", false);
        response.put("message", "Google Drive OAuth callback received but Drive is not configured.");
        response.put("params", params);
        return response;
    }

    private void requireAdminLike() {
        UserRecord user = AuthContext.require();
        String role = user.role() == null ? "" : user.role().trim().toLowerCase(Locale.ROOT);
        if (!("admin".equals(role) || "hr".equals(role))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }

    private static boolean hasClientConfig() {
        String clientId = System.getenv("GOOGLE_DRIVE_CLIENT_ID");
        return clientId != null && !clientId.isBlank();
    }

    private static boolean envTruthy(String key) {
        String v = System.getenv(key);
        return "1".equals(v) || "true".equalsIgnoreCase(v);
    }
}

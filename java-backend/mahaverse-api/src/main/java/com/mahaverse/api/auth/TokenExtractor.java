package com.mahaverse.api.auth;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import jakarta.servlet.http.HttpServletRequest;

public final class TokenExtractor {

    private static final Pattern BEARER = Pattern.compile("(?i)^Bearer\\s+(.+)$");

    private TokenExtractor() {
    }

    public static String fromRequest(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        if (auth != null) {
            Matcher m = BEARER.matcher(auth.trim());
            if (m.matches()) {
                return m.group(1).trim();
            }
        }
        String xAuth = request.getHeader("X-Auth-Token");
        if (xAuth != null && !xAuth.isBlank()) {
            return xAuth.trim();
        }
        String xCsrf = request.getHeader("X-CSRF-Token");
        if (xCsrf != null && !xCsrf.isBlank()) {
            return xCsrf.trim();
        }
        return null;
    }

    public static String fromHeaders(
            String authorization,
            String xAuthToken,
            String xCsrfToken
    ) {
        if (authorization != null) {
            Matcher m = BEARER.matcher(authorization.trim());
            if (m.matches()) {
                return m.group(1).trim();
            }
        }
        if (xAuthToken != null && !xAuthToken.isBlank()) {
            return xAuthToken.trim();
        }
        if (xCsrfToken != null && !xCsrfToken.isBlank()) {
            return xCsrfToken.trim();
        }
        return null;
    }
}

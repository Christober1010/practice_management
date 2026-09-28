package com.launchpad.api.auth;

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
        String queryToken = request.getParameter("token");
        if (queryToken != null && !queryToken.isBlank()) {
            return queryToken.trim();
        }
        return null;
    }
}

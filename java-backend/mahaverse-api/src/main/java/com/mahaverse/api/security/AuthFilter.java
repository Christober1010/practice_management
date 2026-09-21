package com.mahaverse.api.security;

import java.io.IOException;
import java.util.Set;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mahaverse.api.auth.AuthTokenRepository;
import com.mahaverse.api.auth.TokenExtractor;
import com.mahaverse.api.auth.UserRecord;
import com.mahaverse.api.auth.UserRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class AuthFilter extends OncePerRequestFilter {

    private static final Set<String> PUBLIC_EXACT = Set.of(
            "/version",
            "/login.php",
            "/api/v1/auth/login"
    );

    private final AuthTokenRepository tokens;
    private final UserRepository users;
    private final ObjectMapper objectMapper;

    public AuthFilter(AuthTokenRepository tokens, UserRepository users, ObjectMapper objectMapper) {
        this.tokens = tokens;
        this.users = users;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        String path = normalizedPath(request);
        if (PUBLIC_EXACT.contains(path)) {
            return true;
        }
        return path.startsWith("/actuator/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            String rawToken = TokenExtractor.fromRequest(request);
            if (rawToken == null || rawToken.isBlank()) {
                writeUnauthorized(response);
                return;
            }
            Long userId = tokens.findActiveUserIdByRawToken(rawToken).orElse(null);
            if (userId == null) {
                writeUnauthorized(response);
                return;
            }
            UserRecord user = users.findById(userId).orElse(null);
            if (user == null || !user.active()) {
                writeUnauthorized(response);
                return;
            }
            AuthContext.set(user);
            filterChain.doFilter(request, response);
        } finally {
            AuthContext.clear();
        }
    }

    private void writeUnauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType("application/json");
        objectMapper.writeValue(response.getOutputStream(), java.util.Map.of(
                "success", false,
                "error", "Authentication required",
                "message", "Authentication required"
        ));
    }

    private static String normalizedPath(HttpServletRequest request) {
        String path = request.getRequestURI();
        String context = request.getContextPath();
        if (context != null && !context.isEmpty() && path.startsWith(context)) {
            path = path.substring(context.length());
        }
        if (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        return path;
    }
}

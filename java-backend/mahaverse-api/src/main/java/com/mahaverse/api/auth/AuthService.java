package com.mahaverse.api.auth;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mahaverse.api.common.ApiException;
import com.mahaverse.api.rbac.RbacService;

@Service
public class AuthService {

    private static final int TOKEN_TTL_HOURS = 24;
    private static final DateTimeFormatter EXPIRES_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final UserRepository users;
    private final AuthTokenRepository tokens;
    private final RbacService rbac;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
            UserRepository users,
            AuthTokenRepository tokens,
            RbacService rbac,
            PasswordEncoder passwordEncoder
    ) {
        this.users = users;
        this.tokens = tokens;
        this.rbac = rbac;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Map<String, Object> login(String emailRaw, String password) {
        String email = emailRaw == null ? "" : emailRaw.trim();
        if (email.isEmpty() || password == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Email and password are required");
        }
        if (!looksLikeEmail(email)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid email format");
        }

        UserRecord user = users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!user.active()) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "This account is inactive. Ask an administrator to activate it."
            );
        }

        if (!passwordMatches(password, user.passwordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        // Match PHP: upgrade plaintext passwords to bcrypt after successful login.
        if (!isBcryptHash(user.passwordHash()) && password.equals(user.passwordHash())) {
            users.updatePasswordHash(user.id(), passwordEncoder.encode(password));
        }

        String rawToken = tokens.issueToken(user.id(), TOKEN_TTL_HOURS);
        String expiresAt = LocalDateTime.now().plusHours(TOKEN_TTL_HOURS).format(EXPIRES_FMT);
        List<String> permissions = rbac.getEffectivePermissions(user.role(), "mahaverse");

        Map<String, Object> userPayload = new LinkedHashMap<>();
        userPayload.put("id", user.id());
        userPayload.put("email", user.email());
        userPayload.put("role", user.role());
        userPayload.put("first_name", user.firstName());
        userPayload.put("last_name", user.lastName());
        userPayload.put("permissions", permissions);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("user", userPayload);
        response.put("token", rawToken);
        response.put("expires_at", expiresAt);
        return response;
    }

    public Map<String, Object> verify(String rawToken) {
        UserRecord user = requireUserFromToken(rawToken);
        Map<String, Object> userPayload = new LinkedHashMap<>();
        userPayload.put("id", user.id());
        userPayload.put("username", user.email());
        userPayload.put("role", user.role());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("valid", true);
        response.put("success", true);
        response.put("user", userPayload);
        return response;
    }

    public Map<String, Object> logout(String rawToken) {
        tokens.revokeByRawToken(rawToken);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "Logged out");
        return response;
    }

    public Map<String, Object> mePermissions(String rawToken, String scope) {
        UserRecord user = requireUserFromToken(rawToken);
        String resolvedScope = (scope == null || scope.isBlank()) ? "mahaverse" : scope.trim().toLowerCase();
        if (!List.of("mahaverse", "launchpad").contains(resolvedScope)) {
            resolvedScope = "mahaverse";
        }
        List<String> permissions = rbac.getEffectivePermissions(user.role(), resolvedScope);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("role", user.role());
        response.put("scope", resolvedScope);
        response.put("permissions", permissions);
        return response;
    }

    public UserRecord requireUserFromToken(String rawToken) {
        Long userId = tokens.findActiveUserIdByRawToken(rawToken)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required"));
        return users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required"));
    }

    private static boolean looksLikeEmail(String email) {
        return email.contains("@") && email.indexOf('@') < email.lastIndexOf('.') - 1;
    }

    private boolean passwordMatches(String rawPassword, String stored) {
        if (stored == null) {
            return false;
        }
        if (isBcryptHash(stored)) {
            // PHP password_hash uses $2y$; Spring/BCrypt accepts $2a$/$2b$/$2y$.
            try {
                return BCrypt.checkpw(rawPassword, stored.replaceFirst("^\\$2y\\$", "\\$2a\\$"));
            } catch (IllegalArgumentException ex) {
                return false;
            }
        }
        // Temporary plaintext fallback (matches PHP login.php).
        return rawPassword.equals(stored);
    }

    private static boolean isBcryptHash(String value) {
        return value != null && (value.startsWith("$2y$") || value.startsWith("$2a$") || value.startsWith("$2b$"));
    }
}

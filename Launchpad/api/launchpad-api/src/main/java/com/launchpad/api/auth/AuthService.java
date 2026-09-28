package com.launchpad.api.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.launchpad.api.common.ApiException;
import com.launchpad.api.mail.MailService;
import com.launchpad.api.rbac.RbacService;

@Service
public class AuthService {

    private static final int TOKEN_TTL_HOURS = 24;
    private static final int OTP_TTL_MINUTES = 10;
    private static final DateTimeFormatter EXPIRES_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final UserRepository users;
    private final AuthTokenRepository tokens;
    private final PasswordResetRepository passwordResets;
    private final RbacService rbac;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthService(
            UserRepository users,
            AuthTokenRepository tokens,
            PasswordResetRepository passwordResets,
            RbacService rbac,
            PasswordEncoder passwordEncoder,
            MailService mailService
    ) {
        this.users = users;
        this.tokens = tokens;
        this.passwordResets = passwordResets;
        this.rbac = rbac;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
    }

    @Transactional
    public Map<String, Object> login(String emailRaw, String password) {
        String identifier = emailRaw == null ? "" : emailRaw.trim();
        if (identifier.isEmpty() || password == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Email/username and password are required");
        }

        UserRecord user = users.findByEmailOrUsername(identifier)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email/username or password"));

        if (!user.active()) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "This account is inactive. Ask an administrator to activate it."
            );
        }

        if (!passwordMatches(password, user.passwordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email/username or password");
        }

        if (!isBcryptHash(user.passwordHash()) && password.equals(user.passwordHash())) {
            users.updatePasswordHash(user.id(), passwordEncoder.encode(password));
        }

        users.touchLastLogin(user.id());
        String rawToken = tokens.issueToken(user.id(), TOKEN_TTL_HOURS);
        String expiresAt = LocalDateTime.now().plusHours(TOKEN_TTL_HOURS).format(EXPIRES_FMT);
        List<String> permissions = rbac.getEffectivePermissions(user.role(), "launchpad");

        Map<String, Object> userPayload = new LinkedHashMap<>();
        userPayload.put("id", user.id());
        userPayload.put("email", user.email());
        userPayload.put("role", user.role());
        userPayload.put("username", user.username());
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
        userPayload.put("username", user.username());
        userPayload.put("email", user.email());
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
        String resolvedScope = (scope == null || scope.isBlank()) ? "launchpad" : scope.trim().toLowerCase();
        if (!List.of("mahaverse", "launchpad").contains(resolvedScope)) {
            resolvedScope = "launchpad";
        }
        List<String> permissions = rbac.getEffectivePermissions(user.role(), resolvedScope);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("role", user.role());
        response.put("scope", resolvedScope);
        response.put("permissions", permissions);
        return response;
    }

    @Transactional
    public Map<String, Object> sendOtp(String emailRaw) {
        String email = emailRaw == null ? "" : emailRaw.trim();
        if (email.isEmpty() || !looksLikeEmail(email)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Valid email is required");
        }

        Map<String, Object> ok = new LinkedHashMap<>();
        ok.put("success", true);
        ok.put("message", "If the email exists, a One-Time-Code has been sent.");

        var userOpt = users.findByEmailIgnoreCase(email);
        if (userOpt.isEmpty() || !userOpt.get().active()) {
            return ok;
        }

        String otp = String.format("%06d", secureRandom.nextInt(1_000_000));
        String otpHash = sha256Hex(otp);
        passwordResets.deleteByEmail(email);
        passwordResets.insertOtp(email, otpHash, OTP_TTL_MINUTES);

        String subject = "Password Reset One-Time-Code - Maha Launchpad";
        String html = """
                <html><body>
                <p>Your One-Time-Code is:</p>
                <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">%s</p>
                <p>This code expires in %d minutes.</p>
                </body></html>
                """.formatted(otp, OTP_TTL_MINUTES);

        boolean sent = mailService.sendHtml(email, subject, html);
        if (!sent) {
            mailService.logOtpForLocalDev(email, otp);
            ok.put("message", "One-Time-Code generated. Check your email (if email sending is configured).");
        } else {
            ok.put("message", "One-Time-Code sent to your email. It will expire in 10 minutes.");
        }
        return ok;
    }

    @Transactional
    public Map<String, Object> verifyOtp(String emailRaw, String otpRaw) {
        String email = emailRaw == null ? "" : emailRaw.trim();
        String otp = otpRaw == null ? "" : otpRaw.trim();
        if (!looksLikeEmail(email)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Valid email is required");
        }
        if (!otp.matches("\\d{4,8}")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid One-Time-Code format");
        }

        Map<String, Object> row = passwordResets.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Invalid or expired One-Time-Code"));

        int isVerified = ((Number) row.getOrDefault("is_verified", 0)).intValue();
        if (isVerified == 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "One-Time-Code already verified");
        }

        Object expiresObj = row.get("expires_at");
        if (expiresObj != null) {
            LocalDateTime expires = LocalDateTime.parse(
                    expiresObj.toString().replace(' ', 'T').substring(0, Math.min(19, expiresObj.toString().length()))
            );
            if (!LocalDateTime.now().isBefore(expires)) {
                passwordResets.deleteByEmail(email);
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid or expired One-Time-Code");
            }
        }

        int attempts = ((Number) row.getOrDefault("attempts", 0)).intValue();
        if (attempts >= 5) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Too many attempts. Please request a new One-Time-Code.");
        }

        String storedHash = String.valueOf(row.get("otp_hash"));
        boolean ok = sha256Hex(otp).equalsIgnoreCase(storedHash)
                || passwordMatches(otp, storedHash);
        if (!ok) {
            passwordResets.incrementAttempts(email);
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid One-Time-Code");
        }

        passwordResets.markVerified(email);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "One-Time-Code verified. You can now reset your password.");
        return response;
    }

    @Transactional
    public Map<String, Object> resetPassword(String emailRaw, String newPassword) {
        String email = emailRaw == null ? "" : emailRaw.trim();
        if (!looksLikeEmail(email)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid email format");
        }
        if (newPassword == null || newPassword.length() < 6) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters");
        }

        Map<String, Object> row = passwordResets.findByEmail(email)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "One-Time-Code not verified. Please verify One-Time-Code first."
                ));
        int isVerified = ((Number) row.getOrDefault("is_verified", 0)).intValue();
        if (isVerified != 1) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "One-Time-Code not verified. Please verify One-Time-Code first."
            );
        }

        UserRecord user = users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No user found with this email"));

        users.updatePasswordHash(user.id(), passwordEncoder.encode(newPassword));
        passwordResets.deleteByEmail(email);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "Password updated successfully");
        return response;
    }

    public UserRecord requireUserFromToken(String rawToken) {
        Long userId = tokens.findActiveUserIdByRawToken(rawToken)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required"));
        return users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required"));
    }

    private static boolean looksLikeEmail(String email) {
        return email != null && email.contains("@") && email.indexOf('@') < email.lastIndexOf('.') - 1;
    }

    private boolean passwordMatches(String rawPassword, String stored) {
        if (stored == null) {
            return false;
        }
        if (isBcryptHash(stored)) {
            try {
                return BCrypt.checkpw(rawPassword, stored.replaceFirst("^\\$2y\\$", "\\$2a\\$"));
            } catch (IllegalArgumentException ex) {
                return false;
            }
        }
        return rawPassword.equals(stored);
    }

    private static boolean isBcryptHash(String value) {
        return value != null && (value.startsWith("$2y$") || value.startsWith("$2a$") || value.startsWith("$2b$"));
    }

    static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}

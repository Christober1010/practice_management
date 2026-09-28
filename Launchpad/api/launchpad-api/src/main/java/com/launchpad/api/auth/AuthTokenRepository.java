package com.launchpad.api.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AuthTokenRepository {

    private final JdbcTemplate jdbc;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthTokenRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String issueToken(long userId, int ttlHours) {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String rawToken = HexFormat.of().formatHex(bytes);
        String tokenHash = sha256Hex(rawToken);

        jdbc.update(
                """
                INSERT INTO AuthTokens (user_id, token_hash, expires_at)
                VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))
                """,
                userId,
                tokenHash,
                ttlHours
        );
        return rawToken;
    }

    public Optional<Long> findActiveUserIdByRawToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        String trimmed = rawToken.trim();
        if (trimmed.length() < 32 || trimmed.length() > 256) {
            return Optional.empty();
        }
        String tokenHash = sha256Hex(trimmed);
        Long userId = jdbc.query(
                """
                SELECT user_id
                FROM AuthTokens
                WHERE token_hash = ?
                  AND revoked_at IS NULL
                  AND expires_at > NOW()
                LIMIT 1
                """,
                rs -> rs.next() ? rs.getLong("user_id") : null,
                tokenHash
        );
        if (userId != null) {
            jdbc.update("UPDATE AuthTokens SET last_used_at = NOW() WHERE token_hash = ? LIMIT 1", tokenHash);
            return Optional.of(userId);
        }
        return Optional.empty();
    }

    public void revokeByRawToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        String tokenHash = sha256Hex(rawToken.trim());
        jdbc.update(
                "UPDATE AuthTokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL",
                tokenHash
        );
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

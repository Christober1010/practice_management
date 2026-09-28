package com.launchpad.api.auth;

import java.util.Map;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PasswordResetRepository {

    private final JdbcTemplate jdbc;

    public PasswordResetRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void deleteByEmail(String email) {
        jdbc.update("DELETE FROM password_resets WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))", email);
    }

    public void insertOtp(String email, String otpHash, int ttlMinutes) {
        jdbc.update(
                """
                INSERT INTO password_resets (email, otp_hash, expires_at, attempts, is_verified)
                VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0, 0)
                """,
                email,
                otpHash,
                ttlMinutes
        );
    }

    public Optional<Map<String, Object>> findByEmail(String email) {
        var rows = jdbc.queryForList(
                """
                SELECT id, email, otp_hash, expires_at,
                       COALESCE(attempts, 0) AS attempts,
                       COALESCE(is_verified, 0) AS is_verified
                FROM password_resets
                WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
                ORDER BY id DESC
                LIMIT 1
                """,
                email
        );
        return rows.stream().findFirst();
    }

    public void incrementAttempts(String email) {
        jdbc.update(
                "UPDATE password_resets SET attempts = COALESCE(attempts, 0) + 1 WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))",
                email
        );
    }

    public void markVerified(String email) {
        jdbc.update(
                "UPDATE password_resets SET is_verified = 1, attempts = 0 WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))",
                email
        );
    }
}

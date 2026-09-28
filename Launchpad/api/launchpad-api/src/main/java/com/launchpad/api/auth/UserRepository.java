package com.launchpad.api.auth;

import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    private final JdbcTemplate jdbc;

    private static final RowMapper<UserRecord> USER_MAPPER = (rs, rowNum) -> new UserRecord(
            rs.getLong("id"),
            rs.getString("username"),
            rs.getString("email"),
            rs.getString("password_hash"),
            rs.getString("role"),
            rs.getObject("is_active") != null && rs.getInt("is_active") == 1
    );

    public UserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<UserRecord> findByEmailIgnoreCase(String email) {
        String sql = """
                SELECT id, username, email, password_hash, role, is_active
                FROM `Users`
                WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
                LIMIT 1
                """;
        var rows = jdbc.query(sql, USER_MAPPER, email);
        return rows.stream().findFirst();
    }

    public Optional<UserRecord> findByUsernameIgnoreCase(String username) {
        String sql = """
                SELECT id, username, email, password_hash, role, is_active
                FROM `Users`
                WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))
                LIMIT 1
                """;
        var rows = jdbc.query(sql, USER_MAPPER, username);
        return rows.stream().findFirst();
    }

    public Optional<UserRecord> findByEmailOrUsername(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return Optional.empty();
        }
        String trimmed = identifier.trim();
        if (trimmed.contains("@")) {
            return findByEmailIgnoreCase(trimmed);
        }
        return findByUsernameIgnoreCase(trimmed)
                .or(() -> findByEmailIgnoreCase(trimmed));
    }

    public Optional<UserRecord> findById(long id) {
        String sql = """
                SELECT id, username, email, password_hash, role, is_active
                FROM `Users`
                WHERE id = ?
                LIMIT 1
                """;
        var rows = jdbc.query(sql, USER_MAPPER, id);
        return rows.stream().findFirst();
    }

    public void updatePasswordHash(long userId, String hash) {
        jdbc.update("UPDATE `Users` SET password_hash = ? WHERE id = ?", hash, userId);
    }

    public void updatePasswordHashByEmail(String email, String hash) {
        jdbc.update("UPDATE `Users` SET password_hash = ? WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))", hash, email);
    }

    public void touchLastLogin(long userId) {
        jdbc.update("UPDATE `Users` SET last_login = NOW() WHERE id = ?", userId);
    }

    public boolean existsByUsernameOrEmail(String username, String email) {
        if (email != null && !email.isBlank()) {
            Integer count = jdbc.queryForObject(
                    """
                    SELECT COUNT(*) FROM `Users`
                    WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))
                       OR LOWER(TRIM(email)) = LOWER(TRIM(?))
                    """,
                    Integer.class,
                    username,
                    email
            );
            return count != null && count > 0;
        }
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM `Users` WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))",
                Integer.class,
                username
        );
        return count != null && count > 0;
    }

    public long insertUser(String username, String passwordHash, String email, String role, boolean active, Long createdBy) {
        jdbc.update(
                """
                INSERT INTO `Users` (username, password_hash, email, role, is_active, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                username,
                passwordHash,
                email,
                role,
                active ? 1 : 0,
                createdBy
        );
        Long id = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        return id != null ? id : 0L;
    }
}

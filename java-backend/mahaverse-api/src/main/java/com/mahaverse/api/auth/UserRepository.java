package com.mahaverse.api.auth;

import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    private final JdbcTemplate jdbc;

    private static final RowMapper<UserRecord> USER_MAPPER = (rs, rowNum) -> new UserRecord(
            rs.getLong("id"),
            rs.getString("email"),
            rs.getString("password_hash"),
            rs.getString("role"),
            rs.getString("first_name"),
            rs.getString("last_name"),
            rs.getObject("is_active") != null && rs.getInt("is_active") == 1,
            rs.getString("link_staff_id"),
            rs.getString("link_client_id")
    );

    public UserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<UserRecord> findByEmailIgnoreCase(String email) {
        String sql = """
                SELECT id,
                       email,
                       `PASSWORD` AS password_hash,
                       role,
                       first_name,
                       last_name,
                       is_active,
                       link_staff_id,
                       link_client_id
                FROM users
                WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
                LIMIT 1
                """;
        var rows = jdbc.query(sql, USER_MAPPER, email);
        return rows.stream().findFirst();
    }

    public Optional<UserRecord> findById(long id) {
        String sql = """
                SELECT id,
                       email,
                       `PASSWORD` AS password_hash,
                       role,
                       first_name,
                       last_name,
                       is_active,
                       link_staff_id,
                       link_client_id
                FROM users
                WHERE id = ?
                LIMIT 1
                """;
        var rows = jdbc.query(sql, USER_MAPPER, id);
        return rows.stream().findFirst();
    }

    public void updatePasswordHash(long userId, String hash) {
        jdbc.update("UPDATE users SET `PASSWORD` = ? WHERE id = ?", hash, userId);
    }
}

package com.launchpad.api.auth;

public record UserRecord(
        long id,
        String username,
        String email,
        String passwordHash,
        String role,
        boolean active
) {
}

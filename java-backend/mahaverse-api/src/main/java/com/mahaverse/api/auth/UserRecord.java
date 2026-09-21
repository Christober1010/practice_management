package com.mahaverse.api.auth;

public record UserRecord(
        long id,
        String email,
        String passwordHash,
        String role,
        String firstName,
        String lastName,
        boolean active,
        String linkStaffId,
        String linkClientId
) {
}

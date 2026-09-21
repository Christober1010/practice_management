package com.mahaverse.api.security;

import com.mahaverse.api.auth.UserRecord;

/**
 * Request-scoped authenticated user (set by {@link AuthFilter}).
 */
public final class AuthContext {

    private static final ThreadLocal<UserRecord> CURRENT = new ThreadLocal<>();

    private AuthContext() {
    }

    public static void set(UserRecord user) {
        CURRENT.set(user);
    }

    public static UserRecord get() {
        return CURRENT.get();
    }

    public static UserRecord require() {
        UserRecord user = CURRENT.get();
        if (user == null) {
            throw new com.mahaverse.api.common.ApiException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "Authentication required"
            );
        }
        return user;
    }

    public static void clear() {
        CURRENT.remove();
    }
}

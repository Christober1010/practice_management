package com.launchpad.api.security;

import com.launchpad.api.auth.UserRecord;
import com.launchpad.api.common.ApiException;

import org.springframework.http.HttpStatus;

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
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return user;
    }

    public static void clear() {
        CURRENT.remove();
    }
}

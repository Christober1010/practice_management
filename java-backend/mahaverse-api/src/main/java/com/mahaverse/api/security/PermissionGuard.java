package com.mahaverse.api.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.mahaverse.api.auth.UserRecord;
import com.mahaverse.api.common.ApiException;
import com.mahaverse.api.rbac.RbacService;

@Component
public class PermissionGuard {

    private final RbacService rbac;

    public PermissionGuard(RbacService rbac) {
        this.rbac = rbac;
    }

    public UserRecord requireAny(String... permKeys) {
        UserRecord user = AuthContext.require();
        for (String key : permKeys) {
            if (rbac.hasPermission(user.role(), key, "mahaverse")) {
                return user;
            }
        }
        throw new ApiException(HttpStatus.FORBIDDEN, "Forbidden");
    }

    public UserRecord requireReadClients() {
        return requireAny("clients.read", "clients.view");
    }

    public UserRecord requireWriteClients() {
        return requireAny("clients.write", "clients.update", "clients.create", "clients.archive");
    }

    public UserRecord requireArchiveClients() {
        return requireAny("clients.archive", "clients.write");
    }
}

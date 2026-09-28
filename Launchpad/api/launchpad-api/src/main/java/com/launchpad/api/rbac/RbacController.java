package com.launchpad.api.rbac;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.launchpad.api.auth.UserRecord;
import com.launchpad.api.common.ApiException;
import com.launchpad.api.security.AuthContext;

@RestController
@RequestMapping("/api/v1/rbac")
public class RbacController {

    private final RbacService rbacService;

    public RbacController(RbacService rbacService) {
        this.rbacService = rbacService;
    }

    @GetMapping("/catalog")
    public Map<String, Object> catalog(@RequestParam(value = "scope", required = false, defaultValue = "launchpad") String scope) {
        return rbacService.catalog(scope);
    }

    @GetMapping("/matrix")
    public Map<String, Object> matrix(@RequestParam(value = "scope", required = false, defaultValue = "launchpad") String scope) {
        requireAdmin();
        return rbacService.matrix(scope);
    }

    @PostMapping({"/save-role", "/roles"})
    public Map<String, Object> saveRole(@RequestBody Map<String, Object> body) {
        requireAdmin();
        String role = body.get("role") == null ? "" : String.valueOf(body.get("role"));
        String scope = body.get("scope") == null ? "launchpad" : String.valueOf(body.get("scope"));
        @SuppressWarnings("unchecked")
        List<String> keys = body.get("permission_keys") instanceof List<?> list
                ? list.stream().map(String::valueOf).toList()
                : List.of();
        return rbacService.saveRole(role, keys, scope);
    }

    private static void requireAdmin() {
        UserRecord user = AuthContext.require();
        if (!"admin".equalsIgnoreCase(user.role())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Admin role required");
        }
    }
}

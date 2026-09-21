package com.mahaverse.api.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mahaverse.api.security.PermissionGuard;

/**
 * Minimal staff roster until the Staff module is migrated.
 * Shape matches what Clients UI expects from legacy staff.php.
 */
@RestController
@RequestMapping("/api/v1/staff")
public class StaffController {

    private final PermissionGuard permissions;

    public StaffController(PermissionGuard permissions) {
        this.permissions = permissions;
    }

    @GetMapping
    public Map<String, Object> list() {
        permissions.requireAny("staff.read", "clients.read", "clients.write", "scheduling.read");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("staff_records", List.of());
        body.put("message", "Staff module not migrated yet");
        return body;
    }
}

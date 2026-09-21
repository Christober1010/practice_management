package com.mahaverse.api.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mahaverse.api.security.PermissionGuard;

/**
 * Minimal staff list stub so Clients UI does not hard-fail before Staff module migrates.
 */
@RestController
public class PhpStaffCompatController {

    private final PermissionGuard permissions;

    public PhpStaffCompatController(PermissionGuard permissions) {
        this.permissions = permissions;
    }

    @GetMapping("/staff.php")
    public Map<String, Object> staff() {
        permissions.requireAny("staff.read", "clients.read", "clients.write", "scheduling.read");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("staff_records", List.of());
        body.put("message", "Staff module not migrated yet");
        return body;
    }
}

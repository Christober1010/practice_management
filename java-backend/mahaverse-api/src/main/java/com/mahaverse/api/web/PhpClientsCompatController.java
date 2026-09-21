package com.mahaverse.api.web;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.mahaverse.api.auth.UserRecord;
import com.mahaverse.api.clients.ClientsService;
import com.mahaverse.api.security.PermissionGuard;

/**
 * PHP path aliases for the existing Next.js Clients UI.
 */
@RestController
public class PhpClientsCompatController {

    private final ClientsService clientsService;
    private final PermissionGuard permissions;

    public PhpClientsCompatController(ClientsService clientsService, PermissionGuard permissions) {
        this.clientsService = clientsService;
        this.permissions = permissions;
    }

    @GetMapping("/get-clients.php")
    public Map<String, Object> getClients() {
        UserRecord user = permissions.requireReadClients();
        return clientsService.listClients(user);
    }

    @PostMapping({"/update-clients.php", "/add-clients.php"})
    public Map<String, Object> updateClients(@RequestBody Map<String, Object> body) {
        UserRecord user = permissions.requireWriteClients();
        boolean archiveToggle = body.containsKey("archived");
        if (archiveToggle) {
            permissions.requireArchiveClients();
        }
        return clientsService.upsertClient(user, body, archiveToggle);
    }
}

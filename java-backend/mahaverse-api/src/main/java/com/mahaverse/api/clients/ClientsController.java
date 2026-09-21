package com.mahaverse.api.clients;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mahaverse.api.auth.UserRecord;
import com.mahaverse.api.security.PermissionGuard;

@RestController
@RequestMapping("/api/v1/clients")
public class ClientsController {

    private final ClientsService clientsService;
    private final PermissionGuard permissions;

    public ClientsController(ClientsService clientsService, PermissionGuard permissions) {
        this.clientsService = clientsService;
        this.permissions = permissions;
    }

    @GetMapping
    public Map<String, Object> list() {
        UserRecord user = permissions.requireReadClients();
        return clientsService.listClients(user);
    }

    @GetMapping("/{clientId}")
    public Map<String, Object> get(@PathVariable String clientId) {
        UserRecord user = permissions.requireReadClients();
        return clientsService.getClient(user, clientId);
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        UserRecord user = permissions.requireWriteClients();
        return clientsService.upsertClient(user, body, false);
    }

    @PutMapping("/{clientId}")
    public Map<String, Object> update(@PathVariable String clientId, @RequestBody Map<String, Object> body) {
        UserRecord user = permissions.requireWriteClients();
        body.put("client_id", clientId);
        boolean archiveAction = body.containsKey("archived");
        if (archiveAction) {
            permissions.requireArchiveClients();
        }
        return clientsService.upsertClient(user, body, archiveAction);
    }

    @PostMapping("/{clientId}/archive")
    public Map<String, Object> archive(@PathVariable String clientId, @RequestBody(required = false) Map<String, Object> body) {
        UserRecord user = permissions.requireArchiveClients();
        Map<String, Object> payload = body != null ? body : new java.util.LinkedHashMap<>();
        payload.put("client_id", clientId);
        payload.put("archived", 1);
        payload.put("is_active", 0);
        // Minimal required fields if missing — load existing
        return clientsService.upsertClient(user, mergeExisting(user, clientId, payload), true);
    }

    @PostMapping("/{clientId}/unarchive")
    public Map<String, Object> unarchive(@PathVariable String clientId, @RequestBody(required = false) Map<String, Object> body) {
        UserRecord user = permissions.requireArchiveClients();
        Map<String, Object> payload = body != null ? body : new java.util.LinkedHashMap<>();
        payload.put("client_id", clientId);
        payload.put("archived", 0);
        payload.put("is_active", 1);
        return clientsService.upsertClient(user, mergeExisting(user, clientId, payload), true);
    }

    private Map<String, Object> mergeExisting(UserRecord user, String clientId, Map<String, Object> overlay) {
        Map<String, Object> existing = clientsService.getClient(user, clientId);
        @SuppressWarnings("unchecked")
        Map<String, Object> client = new java.util.LinkedHashMap<>((Map<String, Object>) existing.get("client"));
        client.putAll(overlay);
        return client;
    }
}

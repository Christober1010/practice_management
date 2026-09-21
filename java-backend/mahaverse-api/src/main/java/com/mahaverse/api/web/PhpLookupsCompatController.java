package com.mahaverse.api.web;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mahaverse.api.lookups.LookupsService;
import com.mahaverse.api.security.PermissionGuard;

@RestController
public class PhpLookupsCompatController {

    private final LookupsService lookups;
    private final PermissionGuard permissions;

    public PhpLookupsCompatController(LookupsService lookups, PermissionGuard permissions) {
        this.lookups = lookups;
        this.permissions = permissions;
    }

    private void requireLookupRead() {
        permissions.requireAny(
                "manage_data.read",
                "clients.read",
                "clients.write",
                "scheduling.read",
                "billing.read",
                "staff.read",
                "staff.write"
        );
    }

    @GetMapping("/locations.php")
    public Map<String, Object> locations(
            @RequestParam(value = "showArchived", required = false, defaultValue = "false") boolean showArchived,
            @RequestParam(value = "id", required = false) String id
    ) {
        requireLookupRead();
        return lookups.locations(showArchived, id);
    }

    @GetMapping("/providers.php")
    public Map<String, Object> providers(
            @RequestParam(value = "showArchived", required = false, defaultValue = "false") boolean showArchived
    ) {
        requireLookupRead();
        return lookups.providers(showArchived);
    }

    @GetMapping("/service-codes.php")
    public Map<String, Object> serviceCodes() {
        requireLookupRead();
        return lookups.serviceCodes();
    }

    @GetMapping("/diagnosis-codes.php")
    public Map<String, Object> diagnosisCodes(
            @RequestParam(value = "showArchived", required = false, defaultValue = "false") boolean showArchived
    ) {
        requireLookupRead();
        return lookups.diagnosisCodes(showArchived);
    }

    @GetMapping("/facility-types.php")
    public Map<String, Object> facilityTypes(
            @RequestParam(value = "showArchived", required = false, defaultValue = "false") boolean showArchived,
            @RequestParam(value = "showInactive", required = false, defaultValue = "false") boolean showInactive
    ) {
        requireLookupRead();
        return lookups.facilityTypes(showArchived, showInactive);
    }

    @GetMapping("/treatment-types.php")
    public Map<String, Object> treatmentTypes() {
        requireLookupRead();
        return lookups.treatmentTypes();
    }

    @GetMapping("/document-types.php")
    public Map<String, Object> documentTypes() {
        requireLookupRead();
        return lookups.documentTypes();
    }

    @GetMapping("/provider-service-codes.php")
    public Map<String, Object> providerServiceCodes(
            @RequestParam(value = "provider_id", required = false) String providerId
    ) {
        requireLookupRead();
        return lookups.providerServiceCodes(providerId);
    }
}

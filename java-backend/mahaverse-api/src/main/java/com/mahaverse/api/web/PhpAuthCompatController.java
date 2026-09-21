package com.mahaverse.api.web;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mahaverse.api.auth.AuthService;
import com.mahaverse.api.auth.LoginRequest;
import com.mahaverse.api.auth.TokenExtractor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/**
 * Temporary aliases so the existing Next.js UI (login.php / logout.php /
 * me-permissions.php) can talk to the Java API without path rewrites yet.
 */
@RestController
public class PhpAuthCompatController {

    private final AuthService authService;

    public PhpAuthCompatController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login.php")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request.email(), request.password());
    }

    @PostMapping("/logout.php")
    public Map<String, Object> logout(HttpServletRequest request) {
        return authService.logout(TokenExtractor.fromRequest(request));
    }

    @GetMapping({"/me-permissions.php", "/me_permissions.php"})
    public Map<String, Object> permissions(
            HttpServletRequest request,
            @RequestParam(value = "scope", required = false, defaultValue = "mahaverse") String scope
    ) {
        return authService.mePermissions(TokenExtractor.fromRequest(request), scope);
    }
}

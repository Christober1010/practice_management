package com.mahaverse.api.web;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mahaverse.api.auth.AuthService;
import com.mahaverse.api.auth.TokenExtractor;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/v1/me")
public class MeController {

    private final AuthService authService;

    public MeController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/permissions")
    public Map<String, Object> permissions(
            HttpServletRequest request,
            @RequestParam(value = "scope", required = false, defaultValue = "mahaverse") String scope
    ) {
        return authService.mePermissions(TokenExtractor.fromRequest(request), scope);
    }
}

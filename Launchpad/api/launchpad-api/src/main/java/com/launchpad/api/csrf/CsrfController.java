package com.launchpad.api.csrf;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/csrf")
public class CsrfController {

    private final SecureRandom secureRandom = new SecureRandom();

    @GetMapping
    public Map<String, Object> getCsrf() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("csrf_token", token);
        response.put("token", token);
        return response;
    }
}

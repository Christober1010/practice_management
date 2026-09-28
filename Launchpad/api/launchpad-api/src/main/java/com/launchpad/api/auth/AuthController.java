package com.launchpad.api.auth;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request.email(), request.password());
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest request) {
        return authService.logout(TokenExtractor.fromRequest(request));
    }

    @GetMapping("/verify")
    public Map<String, Object> verify(HttpServletRequest request) {
        return authService.verify(TokenExtractor.fromRequest(request));
    }

    @PostMapping("/send-otp")
    public Map<String, Object> sendOtp(@RequestBody Map<String, Object> body) {
        return authService.sendOtp(str(body, "email"));
    }

    @PostMapping("/verify-otp")
    public Map<String, Object> verifyOtp(@RequestBody Map<String, Object> body) {
        return authService.verifyOtp(str(body, "email"), str(body, "otp"));
    }

    @PostMapping("/reset-password")
    public Map<String, Object> resetPassword(@RequestBody Map<String, Object> body) {
        String newPassword = str(body, "new_password");
        if (newPassword.isEmpty()) {
            newPassword = str(body, "password");
        }
        return authService.resetPassword(str(body, "email"), newPassword);
    }

    private static String str(Map<String, Object> body, String key) {
        if (body == null || body.get(key) == null) {
            return "";
        }
        return String.valueOf(body.get(key)).trim();
    }
}

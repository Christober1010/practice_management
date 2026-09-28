package com.launchpad.api.users;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.launchpad.api.auth.UserRecord;
import com.launchpad.api.auth.UserRepository;
import com.launchpad.api.common.ApiException;
import com.launchpad.api.mail.MailService;
import com.launchpad.api.security.AuthContext;

@RestController
@RequestMapping("/api/v1/users")
public class UsersController {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;

    public UsersController(UserRepository users, PasswordEncoder passwordEncoder, MailService mailService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        UserRecord actor = AuthContext.require();
        if (!"admin".equalsIgnoreCase(actor.role())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Access denied");
        }

        String username = str(body, "username");
        String password = str(body, "password");
        String email = str(body, "email");
        String role = str(body, "role").toLowerCase(Locale.ROOT);
        if (role.isEmpty()) {
            role = "staff";
        }
        boolean active = true;
        Object activeObj = body.get("is_active");
        if (activeObj != null) {
            String s = String.valueOf(activeObj).trim().toLowerCase(Locale.ROOT);
            active = List.of("1", "true", "yes", "on").contains(s);
        }

        if (username.length() < 3 || username.length() > 50) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Username must be between 3 and 50 characters.");
        }
        if (password.length() < 8) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters.");
        }
        if (!List.of("admin", "hr", "staff", "viewer").contains(role)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid role specified.");
        }
        if (!email.isEmpty() && !email.contains("@")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid email address.");
        }
        if (users.existsByUsernameOrEmail(username, email.isEmpty() ? null : email)) {
            throw new ApiException(HttpStatus.CONFLICT, "Username or email already exists.");
        }

        String hash = passwordEncoder.encode(password);
        long id = users.insertUser(username, hash, email.isEmpty() ? null : email, role, active, actor.id());

        if (!email.isEmpty()) {
            String html = """
                    <html><body>
                    <p>Hello %s,</p>
                    <p>Your Maha Launchpad account has been created.</p>
                    <p>Username: <strong>%s</strong></p>
                    <p>Please log in and change your password after first use.</p>
                    </body></html>
                    """.formatted(username, username);
            mailService.sendHtml(email, "Welcome to Maha Launchpad", html);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("user_id", id);
        response.put("username", username);
        response.put("message", "User created successfully");
        return response;
    }

    private static String str(Map<String, Object> body, String key) {
        if (body == null || body.get(key) == null) {
            return "";
        }
        return String.valueOf(body.get(key)).trim();
    }
}

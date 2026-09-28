package com.launchpad.api.web;

import java.util.Map;

import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.launchpad.api.auth.AuthService;
import com.launchpad.api.auth.LoginRequest;
import com.launchpad.api.auth.TokenExtractor;
import com.launchpad.api.auth.UserRecord;
import com.launchpad.api.common.ApiException;
import com.launchpad.api.csrf.CsrfController;
import com.launchpad.api.drive.DriveService;
import com.launchpad.api.intake.IntakeService;
import com.launchpad.api.offers.OffersService;
import com.launchpad.api.rbac.RbacService;
import com.launchpad.api.security.AuthContext;
import com.launchpad.api.staff.StaffService;
import com.launchpad.api.users.UsersController;

import org.springframework.http.HttpStatus;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/**
 * PHP path aliases so the existing Launchpad UI can talk to the Java API
 * without frontend rewrites.
 */
@RestController
public class PhpCompatController {

    private final AuthService authService;
    private final StaffService staffService;
    private final OffersService offersService;
    private final IntakeService intakeService;
    private final DriveService driveService;
    private final RbacService rbacService;
    private final UsersController usersController;
    private final CsrfController csrfController;

    public PhpCompatController(
            AuthService authService,
            StaffService staffService,
            OffersService offersService,
            IntakeService intakeService,
            DriveService driveService,
            RbacService rbacService,
            UsersController usersController,
            CsrfController csrfController
    ) {
        this.authService = authService;
        this.staffService = staffService;
        this.offersService = offersService;
        this.intakeService = intakeService;
        this.driveService = driveService;
        this.rbacService = rbacService;
        this.usersController = usersController;
        this.csrfController = csrfController;
    }

    @PostMapping({"/backend/login.php", "/login.php"})
    public Map<String, Object> login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request.email(), request.password());
    }

    @PostMapping({"/backend/logout.php", "/logout.php"})
    public Map<String, Object> logout(HttpServletRequest request) {
        return authService.logout(TokenExtractor.fromRequest(request));
    }

    @PostMapping({"/backend/send-otp.php", "/send-otp.php"})
    public Map<String, Object> sendOtp(@RequestBody Map<String, Object> body) {
        return authService.sendOtp(str(body, "email"));
    }

    @PostMapping({"/backend/verify-otp.php", "/verify-otp.php"})
    public Map<String, Object> verifyOtp(@RequestBody Map<String, Object> body) {
        return authService.verifyOtp(str(body, "email"), str(body, "otp"));
    }

    @PostMapping({"/backend/reset-password-with-otp.php", "/reset-password-with-otp.php"})
    public Map<String, Object> resetPassword(@RequestBody Map<String, Object> body) {
        String newPassword = str(body, "new_password");
        if (newPassword.isEmpty()) {
            newPassword = str(body, "password");
        }
        return authService.resetPassword(str(body, "email"), newPassword);
    }

    @GetMapping({"/backend/list_staff.php", "/list_staff.php"})
    public Map<String, Object> listStaff(
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "share_key", required = false) String shareKey,
            @RequestParam(value = "user_id", required = false) Integer userId
    ) {
        return staffService.listStaff(name, shareKey, userId);
    }

    @PostMapping(value = {"/backend/submit_form.php", "/submit_form.php"}, consumes = {
            "application/json", "application/*+json"
    })
    public Map<String, Object> submitFormJson(@RequestBody(required = false) Map<String, Object> body) {
        return staffService.submitForm(body == null ? Map.of() : body);
    }

    @PostMapping(value = {"/backend/submit_form.php", "/submit_form.php"}, consumes = {
            "multipart/form-data", "application/x-www-form-urlencoded"
    })
    public Map<String, Object> submitFormMultipart(@RequestParam Map<String, String> form) {
        return staffService.submitForm(new java.util.LinkedHashMap<>(form));
    }

    @PostMapping({"/backend/create_share_key.php", "/create_share_key.php"})
    public Map<String, Object> createShareKey(@RequestBody Map<String, Object> body) {
        return staffService.createShareKey(body);
    }

    @PostMapping({"/backend/send_reminder.php", "/send_reminder.php"})
    public Map<String, Object> sendReminder(@RequestBody Map<String, Object> body) {
        return staffService.sendReminder(body);
    }

    @PostMapping({"/backend/create_user.php", "/create_user.php"})
    public Map<String, Object> createUser(@RequestBody Map<String, Object> body) {
        return usersController.create(body);
    }

    @GetMapping({"/backend/offer_positions_get.php", "/offer_positions_get.php"})
    public Map<String, Object> offerPositions() {
        return offersService.listPositions();
    }

    @GetMapping({"/backend/offer_initiation_get.php", "/offer_initiation_get.php"})
    public Map<String, Object> offerInitiationGet(@RequestParam(value = "staff_id", required = false) Long staffId) {
        return offersService.getInitiation(staffId);
    }

    @PostMapping({"/backend/offer_initiation_submit.php", "/offer_initiation_submit.php"})
    public Map<String, Object> offerInitiationSubmit(@RequestBody Map<String, Object> body) {
        return offersService.submitInitiation(body);
    }

    @GetMapping({"/backend/offer_acceptance_get.php", "/offer_acceptance_get.php"})
    public Map<String, Object> offerAcceptanceGet(@RequestParam(value = "staff_id", required = false) Long staffId) {
        return offersService.getAcceptance(staffId);
    }

    @PostMapping({"/backend/offer_acceptance_submit.php", "/offer_acceptance_submit.php"})
    public Map<String, Object> offerAcceptanceSubmit(@RequestBody Map<String, Object> body) {
        return offersService.submitAcceptance(body);
    }

    @PostMapping({"/backend/offer_acceptance_upload_signed_offer.php", "/offer_acceptance_upload_signed_offer.php"})
    public Map<String, Object> uploadSignedOffer(
            @RequestParam(value = "staff_id", required = false) Long staffId,
            @RequestPart(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "file", required = false) MultipartFile fileParam
    ) throws Exception {
        MultipartFile f = file != null ? file : fileParam;
        return offersService.uploadSignedPdf(staffId, f);
    }

    @PostMapping({"/backend/submit_client_intake.php", "/submit_client_intake.php"})
    public Map<String, Object> submitClientIntake(@RequestBody Map<String, Object> body) {
        return intakeService.submit(body);
    }

    @GetMapping({"/backend/drive_oauth_status.php", "/drive_oauth_status.php"})
    public Map<String, Object> driveStatus() {
        return driveService.status();
    }

    @GetMapping({"/backend/drive_oauth_start.php", "/drive_oauth_start.php"})
    public Map<String, Object> driveStart() {
        return driveService.start();
    }

    @GetMapping({"/backend/drive_oauth_link.php", "/drive_oauth_link.php"})
    public Map<String, Object> driveLink() {
        return driveService.link();
    }

    @PostMapping({"/backend/drive_oauth_disconnect.php", "/drive_oauth_disconnect.php"})
    public Map<String, Object> driveDisconnect() {
        return driveService.disconnect();
    }

    @GetMapping({"/backend/drive_oauth_callback.php", "/drive_oauth_callback.php"})
    public Map<String, Object> driveCallback(@RequestParam Map<String, String> params) {
        return driveService.callback(params);
    }

    @GetMapping({"/backend/download_attachment.php", "/download_attachment.php"})
    public ResponseEntity<Resource> downloadAttachment(@RequestParam("id") long id) {
        return staffService.downloadAttachment(id, false);
    }

    @GetMapping({"/backend/view_attachment.php", "/view_attachment.php"})
    public ResponseEntity<Resource> viewAttachment(@RequestParam("id") long id) {
        return staffService.downloadAttachment(id, true);
    }

    @GetMapping({"/backend/me-permissions.php", "/me-permissions.php", "/me_permissions.php"})
    public Map<String, Object> mePermissions(
            HttpServletRequest request,
            @RequestParam(value = "scope", required = false, defaultValue = "launchpad") String scope
    ) {
        return authService.mePermissions(TokenExtractor.fromRequest(request), scope);
    }

    @GetMapping({"/backend/get_csrf.php", "/get_csrf.php"})
    public Map<String, Object> getCsrf() {
        // AuthFilter already authenticated the caller.
        AuthContext.require();
        return csrfController.getCsrf();
    }

    @GetMapping({"/backend/rbac-catalog.php", "/rbac-catalog.php"})
    public Map<String, Object> rbacCatalog(@RequestParam(value = "scope", required = false, defaultValue = "launchpad") String scope) {
        return rbacService.catalog(scope);
    }

    @GetMapping({"/backend/rbac-matrix.php", "/rbac-matrix.php"})
    public Map<String, Object> rbacMatrix(@RequestParam(value = "scope", required = false, defaultValue = "launchpad") String scope) {
        requireAdmin();
        return rbacService.matrix(scope);
    }

    @PostMapping({"/backend/rbac-save-role.php", "/rbac-save-role.php"})
    public Map<String, Object> rbacSaveRole(@RequestBody Map<String, Object> body) {
        requireAdmin();
        String role = str(body, "role");
        String scope = str(body, "scope");
        if (scope.isEmpty()) {
            scope = "launchpad";
        }
        var keys = body.get("permission_keys") instanceof java.util.List<?> list
                ? list.stream().map(String::valueOf).toList()
                : java.util.List.<String>of();
        return rbacService.saveRole(role, keys, scope);
    }

    private static void requireAdmin() {
        UserRecord user = AuthContext.require();
        if (!"admin".equalsIgnoreCase(user.role())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Admin role required");
        }
    }

    private static String str(Map<String, Object> body, String key) {
        if (body == null || body.get(key) == null) {
            return "";
        }
        return String.valueOf(body.get(key)).trim();
    }
}

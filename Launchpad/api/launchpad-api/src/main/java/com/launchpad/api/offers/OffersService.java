package com.launchpad.api.offers;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.launchpad.api.auth.UserRecord;
import com.launchpad.api.common.ApiException;
import com.launchpad.api.mail.MailService;
import com.launchpad.api.security.AuthContext;
import com.launchpad.api.staff.StaffService;

@Service
public class OffersService {

    private final JdbcTemplate jdbc;
    private final MailService mailService;
    private final StaffService staffService;

    public OffersService(JdbcTemplate jdbc, MailService mailService, StaffService staffService) {
        this.jdbc = jdbc;
        this.mailService = mailService;
        this.staffService = staffService;
    }

    public Map<String, Object> listPositions() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                """
                SELECT position_id AS id,
                       position_code,
                       position_name AS job_title,
                       job_description_template AS job_description,
                       NULL AS default_pay_rate,
                       is_active
                FROM OfferLetterPositions
                WHERE COALESCE(is_active, 1) = 1
                ORDER BY position_name ASC
                """
        );
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("positions", rows);
        return response;
    }

    public Map<String, Object> getInitiation(Long staffIdParam) {
        UserRecord user = AuthContext.require();
        long staffId = resolveStaffId(user, staffIdParam);
        if (staffId <= 0) {
            return Map.of("success", true, "initiated", false, "offer", null);
        }
        enforceOwnership(user, staffId);
        List<Map<String, Object>> rows = jdbc.queryForList(
                """
                SELECT initiation_id, staff_id, initiated_by_user_id, employee_name, job_title, pay_rate,
                       position_code, offer_letter_body, initiated_at, updated_at
                FROM StaffOfferInitiations
                WHERE staff_id = ?
                LIMIT 1
                """,
                staffId
        );
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        if (rows.isEmpty()) {
            response.put("initiated", false);
            response.put("offer", null);
        } else {
            response.put("initiated", true);
            response.put("offer", rows.get(0));
        }
        return response;
    }

    @Transactional
    public Map<String, Object> submitInitiation(Map<String, Object> body) {
        UserRecord user = AuthContext.require();
        String role = roleOf(user);
        if (!("admin".equals(role) || "hr".equals(role))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Access denied");
        }
        long staffId = longVal(body, 0, "staff_id", "staffId");
        if (staffId <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "staff_id is required");
        }
        String employeeName = str(body, "employee_name", "employeeName");
        String jobTitle = str(body, "job_title", "jobTitle");
        String payRate = str(body, "pay_rate", "payRate");
        String positionCode = str(body, "position_code", "positionCode");
        String offerBody = str(body, "offer_letter_body", "offerLetterBody", "offer_body");
        if (employeeName.isEmpty() || jobTitle.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "employee_name and job_title are required");
        }

        Long existing = jdbc.query(
                "SELECT initiation_id FROM StaffOfferInitiations WHERE staff_id = ? LIMIT 1",
                rs -> rs.next() ? rs.getLong("initiation_id") : null,
                staffId
        );
        if (existing != null) {
            jdbc.update(
                    """
                    UPDATE StaffOfferInitiations SET
                      initiated_by_user_id = ?, employee_name = ?, job_title = ?, pay_rate = ?,
                      position_code = ?, offer_letter_body = ?, updated_at = NOW()
                    WHERE staff_id = ?
                    """,
                    user.id(), employeeName, jobTitle, payRate, emptyToNull(positionCode),
                    emptyToNull(offerBody), staffId
            );
        } else {
            jdbc.update(
                    """
                    INSERT INTO StaffOfferInitiations
                      (staff_id, initiated_by_user_id, employee_name, job_title, pay_rate, position_code, offer_letter_body)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    staffId, user.id(), employeeName, jobTitle, payRate,
                    emptyToNull(positionCode), emptyToNull(offerBody)
            );
        }

        // Optionally update staff job title
        if (!jobTitle.isEmpty()) {
            jdbc.update("UPDATE Staff SET job_title = ? WHERE staff_id = ?", jobTitle, staffId);
        }

        String staffEmail = jdbc.query(
                "SELECT email FROM Staff WHERE staff_id = ? LIMIT 1",
                rs -> rs.next() ? rs.getString("email") : null,
                staffId
        );
        if (staffEmail != null && staffEmail.contains("@")) {
            String html = """
                    <html><body>
                    <p>Hello %s,</p>
                    <p>An offer letter has been initiated for the position of <strong>%s</strong> (pay rate: %s).</p>
                    <p>Please log in to Maha Launchpad to review and accept your offer.</p>
                    </body></html>
                    """.formatted(employeeName, jobTitle, payRate);
            mailService.sendHtml(staffEmail, "Job offer - Maha Behavioral Health Services", html);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("staff_id", staffId);
        response.put("message", "Offer initiation saved");
        return response;
    }

    public Map<String, Object> getAcceptance(Long staffIdParam) {
        UserRecord user = AuthContext.require();
        long staffId = resolveStaffId(user, staffIdParam);
        if (staffId <= 0) {
            return Map.of("success", true, "accepted", false, "offer", null);
        }
        enforceOwnership(user, staffId);
        List<Map<String, Object>> rows = jdbc.queryForList(
                """
                SELECT offer_id, staff_id, created_by_user_id, employee_name, job_title, pay_rate,
                       signature_attachment_id, accepted_date,
                       COALESCE(jd_read_ack, 0) AS jd_read_ack,
                       COALESCE(hipaa_ack, 0) AS hipaa_ack,
                       COALESCE(abuse_ack, 0) AS abuse_ack,
                       accepted_at
                FROM StaffOfferAcceptances
                WHERE staff_id = ?
                LIMIT 1
                """,
                staffId
        );
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        if (rows.isEmpty()) {
            response.put("accepted", false);
            response.put("offer", null);
        } else {
            response.put("accepted", true);
            response.put("offer", rows.get(0));
        }
        return response;
    }

    @Transactional
    public Map<String, Object> submitAcceptance(Map<String, Object> body) {
        UserRecord user = AuthContext.require();
        long staffId = longVal(body, 0, "staff_id", "staffId");
        if (staffId <= 0) {
            staffId = resolveStaffId(user, null);
        }
        if (staffId <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "staff_id is required");
        }
        enforceOwnership(user, staffId);

        String employeeName = str(body, "employee_name", "employeeName");
        String jobTitle = str(body, "job_title", "jobTitle");
        String payRate = str(body, "pay_rate", "payRate");
        String acceptedDate = str(body, "accepted_date", "acceptedDate");
        if (acceptedDate.isEmpty()) {
            acceptedDate = java.time.LocalDate.now().toString();
        }
        long signatureAttachmentId = longVal(body, 0, "signature_attachment_id", "signatureAttachmentId");
        boolean jdAck = boolVal(body, false, "jd_read_ack", "ack_job_description", "jdReadAck");
        boolean hipaaAck = boolVal(body, false, "hipaa_ack", "hipaaAck");
        boolean abuseAck = boolVal(body, false, "abuse_ack", "abuseAck");

        if (employeeName.isEmpty()) {
            List<Map<String, Object>> staffRows = jdbc.queryForList(
                    "SELECT first_name, middle_name, last_name, job_title FROM Staff WHERE staff_id = ? LIMIT 1",
                    staffId
            );
            if (!staffRows.isEmpty()) {
                Map<String, Object> s = staffRows.get(0);
                employeeName = (str(s, "first_name") + " " + str(s, "middle_name") + " " + str(s, "last_name")).replaceAll("\\s+", " ").trim();
                if (jobTitle.isEmpty()) {
                    jobTitle = str(s, "job_title");
                }
            }
        }
        if (jobTitle.isEmpty()) {
            jobTitle = "Staff";
        }
        if (payRate.isEmpty()) {
            payRate = "";
        }
        if (signatureAttachmentId <= 0) {
            signatureAttachmentId = 0;
        }

        Long existing = jdbc.query(
                "SELECT offer_id FROM StaffOfferAcceptances WHERE staff_id = ? LIMIT 1",
                rs -> rs.next() ? rs.getLong("offer_id") : null,
                staffId
        );

        if (existing != null) {
            jdbc.update(
                    """
                    UPDATE StaffOfferAcceptances SET
                      employee_name = ?, job_title = ?, pay_rate = ?,
                      signature_attachment_id = CASE WHEN ? > 0 THEN ? ELSE signature_attachment_id END,
                      accepted_date = ?, jd_read_ack = ?, hipaa_ack = ?, abuse_ack = ?,
                      accepted_at = NOW()
                    WHERE staff_id = ?
                    """,
                    employeeName, jobTitle, payRate,
                    signatureAttachmentId, signatureAttachmentId,
                    acceptedDate, jdAck ? 1 : 0, hipaaAck ? 1 : 0, abuseAck ? 1 : 0,
                    staffId
            );
        } else {
            // signature_attachment_id may be NOT NULL in older schemas — use placeholder 0 if needed
            long sigId = signatureAttachmentId > 0 ? signatureAttachmentId : ensurePlaceholderSignature(staffId, user.id());
            jdbc.update(
                    """
                    INSERT INTO StaffOfferAcceptances
                      (staff_id, created_by_user_id, employee_name, job_title, pay_rate,
                       signature_attachment_id, accepted_date, jd_read_ack, hipaa_ack, abuse_ack, accepted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    """,
                    staffId, user.id(), employeeName, jobTitle, payRate,
                    sigId, acceptedDate, jdAck ? 1 : 0, hipaaAck ? 1 : 0, abuseAck ? 1 : 0
            );
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("staff_id", staffId);
        response.put("message", "Offer acceptance saved");
        return response;
    }

    @Transactional
    public Map<String, Object> uploadSignedPdf(Long staffIdParam, MultipartFile file) throws Exception {
        UserRecord user = AuthContext.require();
        long staffId = staffIdParam != null && staffIdParam > 0 ? staffIdParam : resolveStaffId(user, null);
        if (staffId <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "staff_id is required");
        }
        enforceOwnership(user, staffId);
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "signed PDF file is required");
        }
        long attachmentId = staffService.saveUploadedAttachment(staffId, user.id(), "SIGNED_OFFER", file);

        // Best-effort: store on acceptance row if column exists via dynamic check
        try {
            Integer col = jdbc.queryForObject(
                    """
                    SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_schema = DATABASE()
                      AND table_name = 'StaffOfferAcceptances'
                      AND column_name = 'signed_offer_attachment_id'
                    """,
                    Integer.class
            );
            if (col != null && col > 0) {
                jdbc.update(
                        "UPDATE StaffOfferAcceptances SET signed_offer_attachment_id = ? WHERE staff_id = ?",
                        attachmentId, staffId
                );
            }
        } catch (Exception ignored) {
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("attachment_id", attachmentId);
        response.put("staff_id", staffId);
        response.put("message", "Signed offer PDF uploaded");
        return response;
    }

    private long ensurePlaceholderSignature(long staffId, long userId) {
        jdbc.update(
                """
                INSERT INTO StaffAttachments
                  (staff_id, uploaded_by_user_id, attachment_type, original_filename, stored_path,
                   stored_filename, mime_type, size_bytes, sha256)
                VALUES (?, ?, 'OFFER_SIGNATURE', 'placeholder.png', 'placeholder', 'placeholder.png',
                        'image/png', 0, REPEAT('0', 64))
                """,
                staffId, userId
        );
        Long id = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        return id != null ? id : 0L;
    }

    private long resolveStaffId(UserRecord user, Long staffIdParam) {
        String role = roleOf(user);
        boolean isAdminLike = "admin".equals(role) || "hr".equals(role);
        if (isAdminLike && staffIdParam != null && staffIdParam > 0) {
            return staffIdParam;
        }
        Long id = jdbc.query(
                "SELECT staff_id FROM Staff WHERE created_by_user_id = ? ORDER BY staff_id DESC LIMIT 1",
                rs -> rs.next() ? rs.getLong("staff_id") : null,
                user.id()
        );
        return id != null ? id : 0L;
    }

    private void enforceOwnership(UserRecord user, long staffId) {
        String role = roleOf(user);
        if ("admin".equals(role) || "hr".equals(role)) {
            return;
        }
        Long createdBy = jdbc.query(
                "SELECT created_by_user_id FROM Staff WHERE staff_id = ? LIMIT 1",
                rs -> rs.next() ? rs.getLong("created_by_user_id") : null,
                staffId
        );
        if (createdBy == null || createdBy != user.id()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }

    private static String roleOf(UserRecord user) {
        return user.role() == null ? "" : user.role().trim().toLowerCase(Locale.ROOT);
    }

    private static String emptyToNull(String v) {
        return v == null || v.isBlank() ? null : v;
    }

    private static String str(Map<String, Object> body, String... keys) {
        if (body == null) {
            return "";
        }
        for (String key : keys) {
            Object v = body.get(key);
            if (v != null) {
                String s = String.valueOf(v).trim();
                if (!s.isEmpty() && !"null".equalsIgnoreCase(s)) {
                    return s;
                }
            }
        }
        return "";
    }

    private static long longVal(Map<String, Object> body, long def, String... keys) {
        String s = str(body, keys);
        if (s.isEmpty()) {
            return def;
        }
        try {
            return Long.parseLong(s.replaceAll("\\.0$", ""));
        } catch (NumberFormatException ex) {
            return def;
        }
    }

    private static boolean boolVal(Map<String, Object> body, boolean def, String... keys) {
        if (body == null) {
            return def;
        }
        for (String key : keys) {
            Object v = body.get(key);
            if (v == null) {
                continue;
            }
            if (v instanceof Boolean b) {
                return b;
            }
            String s = String.valueOf(v).trim().toLowerCase(Locale.ROOT);
            if (List.of("1", "true", "yes", "on").contains(s)) {
                return true;
            }
            if (List.of("0", "false", "no", "off").contains(s)) {
                return false;
            }
        }
        return def;
    }
}

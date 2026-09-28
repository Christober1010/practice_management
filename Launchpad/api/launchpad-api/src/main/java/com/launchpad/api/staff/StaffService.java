package com.launchpad.api.staff;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.launchpad.api.auth.UserRecord;
import com.launchpad.api.common.ApiException;
import com.launchpad.api.crypto.SsnCrypto;
import com.launchpad.api.mail.MailService;
import com.launchpad.api.security.AuthContext;

@Service
public class StaffService {

    private final JdbcTemplate jdbc;
    private final SsnCrypto ssnCrypto;
    private final MailService mailService;
    private final Path uploadDir;
    private final SecureRandom secureRandom = new SecureRandom();

    public StaffService(
            JdbcTemplate jdbc,
            SsnCrypto ssnCrypto,
            MailService mailService,
            @Value("${launchpad.upload-dir:./data/uploads}") String uploadDir
    ) {
        this.jdbc = jdbc;
        this.ssnCrypto = ssnCrypto;
        this.mailService = mailService;
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    public Map<String, Object> listStaff(String nameQuery, String shareKey, Integer userIdFilter) {
        UserRecord user = AuthContext.require();
        String role = roleOf(user);
        boolean isReader = "viewer".equals(role) || "reader".equals(role);
        boolean isAdminLike = "admin".equals(role) || "hr".equals(role);
        boolean includeSsn = isAdminLike;

        String where = "";
        List<Object> args = new ArrayList<>();

        if (isReader) {
            if (shareKey == null || shareKey.isBlank()) {
                return Map.of("success", true, "staff", List.of(), "message", "Provide a share key to search.");
            }
            String shareHash = sha256Hex(shareKey.trim());
            List<Map<String, Object>> shareRows = jdbc.queryForList(
                    """
                    SELECT staff_id, expires_at, revoked_at
                    FROM StaffShareKeys
                    WHERE token_hash = ?
                    LIMIT 1
                    """,
                    shareHash
            );
            if (shareRows.isEmpty()) {
                return Map.of("success", true, "staff", List.of(), "message", "Share key is invalid or expired.");
            }
            Map<String, Object> share = shareRows.get(0);
            if (share.get("revoked_at") != null) {
                return Map.of("success", true, "staff", List.of(), "message", "Share key is invalid or expired.");
            }
            where = "WHERE s.staff_id = ?";
            args.add(((Number) share.get("staff_id")).longValue());
        } else if (isAdminLike) {
            if (userIdFilter != null && userIdFilter > 0) {
                where = "WHERE s.created_by_user_id = ?";
                args.add(userIdFilter);
            }
        } else {
            where = "WHERE s.created_by_user_id = ?";
            args.add(user.id());
        }

        if (nameQuery != null && !nameQuery.isBlank() && !isReader) {
            String like = "%" + nameQuery.trim() + "%";
            String nameClause = """
                    (CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name) LIKE ?
                     OR s.email LIKE ? OR s.job_title LIKE ?)
                    """;
            where = where.isEmpty() ? "WHERE " + nameClause : where + " AND " + nameClause;
            args.add(like);
            args.add(like);
            args.add(like);
        }

        String ssnSelect = includeSsn ? ", s.ssn_encrypted" : "";
        String sql = """
                SELECT
                    s.staff_id, s.action_type, s.first_name, s.middle_name, s.last_name,
                    s.job_title, s.employment_status, s.ssn_last_4_digits
                    %s,
                    s.date_of_birth, s.full_address, s.cell_phone, s.home_phone, s.work_phone, s.email,
                    s.created_by_user_id,
                    u.username AS created_by_username,
                    u.role AS created_by_role,
                    oi.initiated_at AS offer_initiated_at,
                    oa.accepted_at AS offer_accepted_at,
                    ec.contact_name AS emergency_contact_name,
                    ec.relationship AS emergency_relationship,
                    ec.primary_phone AS emergency_primary_phone,
                    ec.secondary_phone AS emergency_secondary_phone,
                    pd.highest_degree, pd.year_awarded, pd.major, pd.license_status,
                    pd.license_exp_date, pd.npi_number, pd.languages, pd.specialty_areas,
                    bi.bank_name, bi.account_name,
                    bi.account_number_encrypted AS account_number,
                    bi.routing_number_encrypted AS routing_number,
                    bi.account_type, bi.authorization_agreed,
                    ca.hipaa_acknowledged, ca.hipaa_acknowledged_at,
                    ca.abuse_reporting_acknowledged, ca.abuse_reporting_acknowledged_at
                FROM Staff s
                LEFT JOIN `Users` u ON u.id = s.created_by_user_id
                LEFT JOIN StaffOfferInitiations oi ON oi.staff_id = s.staff_id
                LEFT JOIN StaffOfferAcceptances oa ON oa.staff_id = s.staff_id
                LEFT JOIN EmergencyContact ec ON s.staff_id = ec.staff_id
                LEFT JOIN ProfessionalData pd ON s.staff_id = pd.staff_id
                LEFT JOIN BankInfo bi ON s.staff_id = bi.staff_id
                LEFT JOIN ComplianceAgreement ca ON s.staff_id = ca.staff_id
                %s
                ORDER BY s.staff_id DESC
                LIMIT 200
                """.formatted(ssnSelect, where);

        List<Map<String, Object>> rows = jdbc.queryForList(sql, args.toArray());
        List<Map<String, Object>> staffList = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> staff = new LinkedHashMap<>(row);
            long staffId = ((Number) staff.get("staff_id")).longValue();
            if (includeSsn && staff.get("ssn_encrypted") != null) {
                String full = ssnCrypto.decrypt(String.valueOf(staff.get("ssn_encrypted")));
                if (full != null) {
                    staff.put("ssn_full", full);
                }
            }
            staff.remove("ssn_encrypted");

            staff.put("certifications", jdbc.queryForList(
                    "SELECT cert_type, cert_number, exp_date FROM StaffCertification WHERE staff_id = ?",
                    staffId
            ));
            List<Map<String, Object>> attachments = jdbc.queryForList(
                    """
                    SELECT attachment_id, attachment_type, original_filename, mime_type, size_bytes, created_at
                    FROM StaffAttachments WHERE staff_id = ? ORDER BY created_at DESC
                    """,
                    staffId
            );
            if (isReader) {
                attachments = attachments.stream()
                        .filter(a -> !"SIGNATURE".equalsIgnoreCase(String.valueOf(a.get("attachment_type"))))
                        .toList();
            }
            staff.put("attachments", attachments);
            staffList.add(staff);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("staff", staffList);
        return response;
    }

    @Transactional
    public Map<String, Object> submitForm(Map<String, Object> body) {
        UserRecord user = AuthContext.require();
        String role = roleOf(user);

        String actionType = str(body, "formType", "action_type", "actionType");
        if (actionType.isEmpty() || "Profile".equalsIgnoreCase(actionType)) {
            actionType = "New Hire";
        }
        if (!List.of("New Hire", "Update", "Termination").contains(actionType)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid action type: '" + actionType + "'");
        }

        long staffId = longVal(body, 0, "staffId", "staff_id");
        boolean isUpdate = "Update".equals(actionType) && staffId > 0;

        if (isUpdate && ("staff".equals(role) || "employee".equals(role))) {
            Long createdBy = jdbc.query(
                    "SELECT created_by_user_id FROM Staff WHERE staff_id = ? LIMIT 1",
                    rs -> rs.next() ? rs.getLong("created_by_user_id") : null,
                    staffId
            );
            if (createdBy == null || createdBy != user.id()) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Access denied");
            }
        }

        if (!isUpdate && ("staff".equals(role) || "employee".equals(role))) {
            Long existing = jdbc.query(
                    "SELECT staff_id FROM Staff WHERE created_by_user_id = ? ORDER BY staff_id DESC LIMIT 1",
                    rs -> rs.next() ? rs.getLong("staff_id") : null,
                    user.id()
            );
            if (existing != null && existing > 0) {
                throw new ApiException(HttpStatus.CONFLICT,
                        "You already have a profile on file. Please use My Profile to view/update your existing entry.");
            }
        }

        String firstName = str(body, "firstName", "first_name");
        String middleName = str(body, "middleName", "middle_name");
        String lastName = str(body, "lastName", "last_name");
        String jobTitle = str(body, "jobTitle", "job_title");
        String employmentStatus = str(body, "employmentStatus", "employment_status");
        String fullAddress = str(body, "fullAddress", "full_address");
        String cellPhone = str(body, "cellPhone", "cell_phone");
        String homeWorkPhone = str(body, "homeWorkPhone", "home_phone", "work_phone");
        String email = str(body, "email");
        String dob = str(body, "dob", "date_of_birth");
        String fullSsn = str(body, "ssn", "ssn_full").replace("-", "");

        if (firstName.isEmpty() || lastName.isEmpty() || email.isEmpty() || fullSsn.isEmpty()
                || dob.isEmpty() || cellPhone.isEmpty() || fullAddress.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Mandatory personal fields (Name, Email, SSN, DOB, Cell Phone, Address) are missing.");
        }
        if (fullSsn.length() != 9 || !fullSsn.chars().allMatch(Character::isDigit)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid SSN format.");
        }
        if (!email.contains("@")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid email format.");
        }

        String ssnLast4 = fullSsn.substring(fullSsn.length() - 4);
        String ssnEncrypted = ssnCrypto.isConfigured() ? ssnCrypto.encrypt(fullSsn) : null;

        if (isUpdate) {
            jdbc.update(
                    """
                    UPDATE Staff SET
                      action_type = ?, first_name = ?, middle_name = ?, last_name = ?,
                      job_title = ?, employment_status = ?, ssn_last_4_digits = ?, ssn_encrypted = ?,
                      date_of_birth = ?, full_address = ?, cell_phone = ?, home_phone = ?, work_phone = ?, email = ?
                    WHERE staff_id = ?
                    """,
                    actionType, firstName, middleName, lastName, jobTitle, employmentStatus,
                    ssnLast4, ssnEncrypted, emptyToNull(dob), fullAddress, cellPhone,
                    homeWorkPhone, homeWorkPhone, email, staffId
            );
            jdbc.update("DELETE FROM EmergencyContact WHERE staff_id = ?", staffId);
            jdbc.update("DELETE FROM ProfessionalData WHERE staff_id = ?", staffId);
            jdbc.update("DELETE FROM StaffCertification WHERE staff_id = ?", staffId);
            jdbc.update("DELETE FROM BankInfo WHERE staff_id = ?", staffId);
            jdbc.update("DELETE FROM ComplianceAgreement WHERE staff_id = ?", staffId);
        } else {
            jdbc.update(
                    """
                    INSERT INTO Staff
                      (created_by_user_id, action_type, first_name, middle_name, last_name,
                       job_title, employment_status, ssn_last_4_digits, ssn_encrypted,
                       date_of_birth, full_address, cell_phone, home_phone, work_phone, email)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    user.id(), actionType, firstName, middleName, lastName, jobTitle, employmentStatus,
                    ssnLast4, ssnEncrypted, emptyToNull(dob), fullAddress, cellPhone,
                    homeWorkPhone, homeWorkPhone, email
            );
            Long newId = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
            staffId = newId != null ? newId : 0L;
        }

        String contactName = str(body, "emergencyName", "emergency_contact_name", "contact_name");
        String relationship = str(body, "relationship", "emergency_relationship");
        String primaryPhone = str(body, "primaryPhone", "emergency_primary_phone", "primary_phone");
        String secondaryPhone = str(body, "secondaryPhone", "emergency_secondary_phone", "secondary_phone");
        if (contactName.isEmpty() || relationship.isEmpty() || primaryPhone.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Emergency Contact Name, Relationship, and Primary Phone are required.");
        }
        jdbc.update(
                """
                INSERT INTO EmergencyContact (staff_id, contact_name, relationship, primary_phone, secondary_phone)
                VALUES (?, ?, ?, ?, ?)
                """,
                staffId, contactName, relationship, primaryPhone, emptyToNull(secondaryPhone)
        );

        String highestDegree = str(body, "highestDegree", "highest_degree");
        Integer yearAwarded = intOrNull(body, "yearAwarded", "year_awarded");
        String major = str(body, "major");
        String licenseStatus = str(body, "licenseStatus", "license_status");
        String licenseExp = str(body, "licenseExpDate", "license_exp_date");
        String npi = str(body, "npiNumber", "npi_number");
        String languages = str(body, "languages");
        String specialty = str(body, "specialtyAreas", "specialty_areas");
        jdbc.update(
                """
                INSERT INTO ProfessionalData
                  (staff_id, highest_degree, year_awarded, major, license_status, license_exp_date, npi_number, languages, specialty_areas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                staffId, emptyToNull(highestDegree), yearAwarded, emptyToNull(major),
                emptyToNull(licenseStatus), emptyToNull(licenseExp), emptyToNull(npi),
                emptyToNull(languages), emptyToNull(specialty)
        );

        insertCertifications(staffId, body);

        String bankName = str(body, "bankName", "bank_name");
        String accountName = str(body, "accountName", "account_name");
        String accountNumber = str(body, "accountNumber", "account_number");
        String routingNumber = str(body, "routingNumber", "routing_number");
        String accountType = str(body, "accountType", "account_type");
        boolean authAgreed = boolVal(body, false, "authorizationAgreed", "authorization_agreed");
        if (!bankName.isEmpty() && !accountName.isEmpty() && !accountNumber.isEmpty() && !routingNumber.isEmpty()) {
            String acctEnc = ssnCrypto.isConfigured() ? ssnCrypto.encrypt(accountNumber) : accountNumber;
            String routeEnc = ssnCrypto.isConfigured() ? ssnCrypto.encrypt(routingNumber) : routingNumber;
            jdbc.update(
                    """
                    INSERT INTO BankInfo
                      (staff_id, bank_name, account_name, account_number_encrypted, routing_number_encrypted,
                       account_type, authorization_agreed, authorization_timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                    """,
                    staffId, bankName, accountName, acctEnc, routeEnc,
                    accountType.isEmpty() ? "Checking" : accountType, authAgreed ? 1 : 0
            );
        }

        boolean hipaa = boolVal(body, false, "hipaaAcknowledged", "hipaa_acknowledged");
        boolean abuse = boolVal(body, false, "abuseReportingAcknowledged", "abuse_reporting_acknowledged");
        jdbc.update(
                """
                INSERT INTO ComplianceAgreement
                  (staff_id, hipaa_acknowledged, hipaa_acknowledged_at, abuse_reporting_acknowledged, abuse_reporting_acknowledged_at)
                VALUES (?, ?, IF(?=1, NOW(), NULL), ?, IF(?=1, NOW(), NULL))
                """,
                staffId, hipaa ? 1 : 0, hipaa ? 1 : 0, abuse ? 1 : 0, abuse ? 1 : 0
        );

        saveDataUrlAttachments(staffId, user.id(), body);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("staff_id", staffId);
        response.put("message", isUpdate ? "Staff profile updated successfully" : "Staff profile submitted successfully");
        return response;
    }

    @Transactional
    public Map<String, Object> createShareKey(Map<String, Object> body) {
        UserRecord user = AuthContext.require();
        String role = roleOf(user);
        boolean isAdminLike = "admin".equals(role) || "hr".equals(role);
        long staffId = longVal(body, 0, "staff_id", "staffId");
        if (staffId <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "staff_id is required");
        }

        if (!isAdminLike) {
            if (!("staff".equals(role) || "employee".equals(role))) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Access denied");
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

        byte[] raw = new byte[24];
        secureRandom.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        String tokenHash = sha256Hex(token);
        String tokenPrefix = token.substring(0, Math.min(8, token.length()));

        jdbc.update(
                """
                INSERT INTO StaffShareKeys
                  (staff_id, token_hash, token_prefix, created_by_user_id, created_by_username, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 36 HOUR))
                """,
                staffId, tokenHash, tokenPrefix, user.id(), user.username()
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("share_key", token);
        response.put("expires_at", java.time.OffsetDateTime.now().plusHours(36).toString());
        return response;
    }

    public Map<String, Object> sendReminder(Map<String, Object> body) {
        UserRecord user = AuthContext.require();
        if (!"admin".equals(roleOf(user))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only administrators can send reminder emails");
        }
        long staffId = longVal(body, 0, "staff_id", "staffId");
        if (staffId <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Staff ID is required");
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                """
                SELECT s.staff_id, s.first_name, s.middle_name, s.last_name, s.email, s.job_title,
                       oi.initiated_at AS offer_initiated_at, oa.accepted_at AS offer_accepted_at
                FROM Staff s
                LEFT JOIN StaffOfferInitiations oi ON oi.staff_id = s.staff_id
                LEFT JOIN StaffOfferAcceptances oa ON oa.staff_id = s.staff_id
                WHERE s.staff_id = ?
                LIMIT 1
                """,
                staffId
        );
        if (rows.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Staff member not found");
        }
        Map<String, Object> staff = rows.get(0);
        String email = str(staff, "email");
        if (email.isEmpty() || !email.contains("@")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Staff member does not have a valid email address");
        }
        String firstName = str(staff, "first_name");
        String jobTitle = str(staff, "job_title");
        String html = """
                <html><body>
                <p>Hi %s,</p>
                <p>This is a friendly reminder to complete your onboarding profile and offer letter for %s.</p>
                <p>Please log in to Maha Launchpad to continue.</p>
                </body></html>
                """.formatted(firstName.isEmpty() ? "there" : firstName, jobTitle.isEmpty() ? "your position" : jobTitle);
        boolean sent = mailService.sendHtml(email, "Onboarding reminder - Maha Launchpad", html);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", sent ? "Reminder email sent" : "Reminder queued (mail not configured; logged locally)");
        return response;
    }

    public ResponseEntity<Resource> downloadAttachment(long attachmentId, boolean inline) {
        UserRecord user = AuthContext.require();
        List<Map<String, Object>> rows = jdbc.queryForList(
                """
                SELECT a.*, s.created_by_user_id
                FROM StaffAttachments a
                JOIN Staff s ON s.staff_id = a.staff_id
                WHERE a.attachment_id = ?
                LIMIT 1
                """,
                attachmentId
        );
        if (rows.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Attachment not found");
        }
        Map<String, Object> att = rows.get(0);
        String role = roleOf(user);
        boolean isAdminLike = "admin".equals(role) || "hr".equals(role);
        long createdBy = ((Number) att.getOrDefault("created_by_user_id", 0)).longValue();
        if (!isAdminLike && createdBy != user.id()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Access denied");
        }

        Path file = resolveStoredPath(att);
        if (!Files.exists(file)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Attachment file missing on disk");
        }
        FileSystemResource resource = new FileSystemResource(file);
        String filename = String.valueOf(att.getOrDefault("original_filename", "attachment"));
        String mime = String.valueOf(att.getOrDefault("mime_type", "application/octet-stream"));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        (inline ? "inline" : "attachment") + "; filename=\"" + filename.replace("\"", "") + "\"")
                .contentType(MediaType.parseMediaType(mime))
                .body(resource);
    }

    public long saveUploadedAttachment(long staffId, long userId, String attachmentType, MultipartFile file)
            throws IOException {
        ensureUploadDir();
        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.bin";
        String storedName = System.currentTimeMillis() + "_" + sanitizeFilename(original);
        Path dest = uploadDir.resolve(storedName);
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, dest);
        }
        byte[] bytes = Files.readAllBytes(dest);
        String sha = sha256Hex(bytes);
        String mime = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        jdbc.update(
                """
                INSERT INTO StaffAttachments
                  (staff_id, uploaded_by_user_id, attachment_type, original_filename, stored_path,
                   stored_filename, mime_type, size_bytes, sha256)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                staffId, userId, attachmentType, original, dest.toString(), storedName, mime, bytes.length, sha
        );
        Long id = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        return id != null ? id : 0L;
    }

    private void saveDataUrlAttachments(long staffId, long userId, Map<String, Object> body) {
        saveOneDataUrl(staffId, userId, "SIGNATURE", str(body, "signatureDataUrl", "signature_data_url"));
        saveOneDataUrl(staffId, userId, "RESUME", str(body, "resumeDataUrl", "resume_data_url"));
    }

    private void saveOneDataUrl(long staffId, long userId, String type, String dataUrl) {
        if (dataUrl == null || !dataUrl.startsWith("data:")) {
            return;
        }
        try {
            ensureUploadDir();
            int comma = dataUrl.indexOf(',');
            if (comma < 0) {
                return;
            }
            String meta = dataUrl.substring(5, comma);
            String b64 = dataUrl.substring(comma + 1);
            String mime = meta.contains(";") ? meta.substring(0, meta.indexOf(';')) : "application/octet-stream";
            byte[] bytes = Base64.getDecoder().decode(b64);
            String ext = mime.contains("png") ? ".png" : mime.contains("pdf") ? ".pdf" : ".bin";
            String storedName = System.currentTimeMillis() + "_" + type.toLowerCase(Locale.ROOT) + ext;
            Path dest = uploadDir.resolve(storedName);
            Files.write(dest, bytes);
            jdbc.update(
                    """
                    INSERT INTO StaffAttachments
                      (staff_id, uploaded_by_user_id, attachment_type, original_filename, stored_path,
                       stored_filename, mime_type, size_bytes, sha256)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    staffId, userId, type, type.toLowerCase(Locale.ROOT) + ext, dest.toString(),
                    storedName, mime, bytes.length, sha256Hex(bytes)
            );
        } catch (Exception ignored) {
            // best-effort attachment persistence
        }
    }

    @SuppressWarnings("unchecked")
    private void insertCertifications(long staffId, Map<String, Object> body) {
        Object certs = body.get("certifications");
        if (certs instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> m) {
                    insertOneCert(staffId, (Map<String, Object>) m);
                }
            }
            return;
        }
        // Flat form fields: certType / certNumber / certExpDate (single)
        String certType = str(body, "certType", "cert_type");
        if (!certType.isEmpty()) {
            Map<String, Object> one = new LinkedHashMap<>();
            one.put("cert_type", certType);
            one.put("cert_number", str(body, "certNumber", "cert_number"));
            one.put("exp_date", str(body, "certExpDate", "exp_date"));
            insertOneCert(staffId, one);
        }
    }

    private void insertOneCert(long staffId, Map<String, Object> m) {
        String type = str(m, "cert_type", "certType", "type");
        if (type.isEmpty()) {
            return;
        }
        jdbc.update(
                "INSERT INTO StaffCertification (staff_id, cert_type, cert_number, exp_date) VALUES (?, ?, ?, ?)",
                staffId, type, emptyToNull(str(m, "cert_number", "certNumber", "number")),
                emptyToNull(str(m, "exp_date", "expDate", "certExpDate"))
        );
    }

    private Path resolveStoredPath(Map<String, Object> att) {
        String storedPath = String.valueOf(att.getOrDefault("stored_path", ""));
        String storedFilename = String.valueOf(att.getOrDefault("stored_filename", ""));
        Path p = Paths.get(storedPath);
        if (Files.exists(p)) {
            return p;
        }
        Path underUpload = uploadDir.resolve(storedFilename);
        if (Files.exists(underUpload)) {
            return underUpload;
        }
        return p;
    }

    private void ensureUploadDir() throws IOException {
        Files.createDirectories(uploadDir);
    }

    private static String roleOf(UserRecord user) {
        return user.role() == null ? "" : user.role().trim().toLowerCase(Locale.ROOT);
    }

    private static String sanitizeFilename(String name) {
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
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
            if (v != null && !(v instanceof Map) && !(v instanceof List)) {
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

    private static Integer intOrNull(Map<String, Object> body, String... keys) {
        String s = str(body, keys);
        if (s.isEmpty()) {
            return null;
        }
        try {
            return Integer.parseInt(s.replaceAll("\\.0$", ""));
        } catch (NumberFormatException ex) {
            return null;
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

    static String sha256Hex(String value) {
        return sha256Hex(value.getBytes(StandardCharsets.UTF_8));
    }

    static String sha256Hex(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}

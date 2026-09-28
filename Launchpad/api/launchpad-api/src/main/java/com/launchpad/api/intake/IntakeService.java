package com.launchpad.api.intake;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.launchpad.api.auth.UserRecord;
import com.launchpad.api.common.ApiException;
import com.launchpad.api.security.AuthContext;

@Service
public class IntakeService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public IntakeService(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Map<String, Object> submit(Map<String, Object> body) {
        UserRecord user = AuthContext.require();
        String childName = str(body, "child_legal_name", "childLegalName", "child_name");
        String childDob = str(body, "child_dob", "childDob");
        String completedBy = str(body, "completed_by", "completedBy");
        String contactPhone = str(body, "contact_phone", "contactPhone");
        String parentSig = str(body, "parent_guardian_signature_data_url", "parentGuardianSignatureDataUrl", "parent_signature");
        String parentSigDate = str(body, "parent_guardian_signature_date", "parentGuardianSignatureDate");
        String providerSig = str(body, "provider_signature_data_url", "providerSignatureDataUrl");
        String providerSigDate = str(body, "provider_signature_date", "providerSignatureDate");

        if (childName.isEmpty() || childDob.isEmpty() || completedBy.isEmpty() || contactPhone.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Required intake fields are missing");
        }
        if (parentSig.isEmpty() || parentSigDate.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Parent/guardian signature is required");
        }

        String payloadJson;
        try {
            payloadJson = objectMapper.writeValueAsString(body);
        } catch (Exception ex) {
            payloadJson = "{}";
        }

        jdbc.update(
                """
                INSERT INTO ClientIntakePackets
                  (created_by_user_id, child_legal_name, child_dob, completed_by, contact_phone,
                   payload_json, parent_guardian_signature_data_url, parent_guardian_signature_date,
                   provider_signature_data_url, provider_signature_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                user.id(), childName, childDob, completedBy, contactPhone,
                payloadJson, parentSig, parentSigDate,
                emptyToNull(providerSig), emptyToNull(providerSigDate)
        );
        Long id = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("intake_id", id);
        response.put("message", "Client intake submitted successfully");
        return response;
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
}

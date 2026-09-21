package com.mahaverse.api.clients;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mahaverse.api.auth.UserRecord;
import com.mahaverse.api.common.ApiException;

@Service
public class ClientsService {

    private static final String[] WEEKDAYS = {
            "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
    };

    private final JdbcTemplate jdbc;
    private final ClientAccessService access;

    public ClientsService(JdbcTemplate jdbc, ClientAccessService access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    public Map<String, Object> listClients(UserRecord user) {
        List<Map<String, Object>> clients = loadAllClientsNested();
        String role = user.role() == null ? "" : user.role().trim().toLowerCase(Locale.ROOT);
        if (!"admin".equals(role)) {
            String scope = access.rosterAccessScope(user);
            if (scope == null) {
                clients = List.of();
            } else {
                clients = clients.stream()
                        .filter(c -> ClientAccessService.rowIsActive(c))
                        .filter(c -> access.mayAccessClientRow(user, str(c.get("client_id"))))
                        .toList();
            }
        }
        clients = new ArrayList<>(clients);
        clients.sort((a, b) -> {
            String an = (str(a.get("first_name")) + " " + str(a.get("last_name"))).trim();
            String bn = (str(b.get("first_name")) + " " + str(b.get("last_name"))).trim();
            int cmp = an.compareToIgnoreCase(bn);
            if (cmp != 0) {
                return cmp;
            }
            return str(a.get("client_id")).compareTo(str(b.get("client_id")));
        });

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("clients", clients);
        return body;
    }

    public Map<String, Object> getClient(UserRecord user, String clientId) {
        Map<String, Object> list = listClients(user);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> clients = (List<Map<String, Object>>) list.get("clients");
        for (Map<String, Object> c : clients) {
            if (clientId.equals(str(c.get("client_id")))) {
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("success", true);
                body.put("client", c);
                return body;
            }
        }
        throw new ApiException(HttpStatus.NOT_FOUND, "Client not found");
    }

    @Transactional
    public Map<String, Object> upsertClient(UserRecord user, Map<String, Object> input, boolean archiveAction) {
        String clientId = str(input.get("client_id"));
        String firstName = str(input.get("first_name"));
        String lastName = str(input.get("last_name"));
        String dob = str(input.get("date_of_birth"));
        if (clientId.isBlank() || firstName.isBlank() || lastName.isBlank() || dob.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Missing required field: client_id, first_name, last_name, date_of_birth");
        }

        if (!"admin".equalsIgnoreCase(user.role()) && !access.mayAccessClientRow(user, clientId)) {
            // Allow create of brand-new id (row does not exist yet)
            Integer exists = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM clients WHERE client_id = ?",
                    Integer.class,
                    clientId
            );
            if (exists != null && exists > 0) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Forbidden");
            }
        }

        boolean exists = Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT COUNT(*) > 0 FROM clients WHERE client_id = ?",
                Boolean.class,
                clientId
        ));

        String clientStatus = str(input.get("client_status")).trim();
        if (clientStatus.isEmpty()) {
            clientStatus = "New";
        }

        String clientUuid = str(input.get("client_uuid"));
        if (clientUuid.isBlank()) {
            clientUuid = shortUuid();
        } else if (clientUuid.length() > 16) {
            clientUuid = clientUuid.substring(0, 16);
        }

        int archived = truthy(input.get("archived")) ? 1 : 0;
        int isActive = input.containsKey("is_active") ? (truthy(input.get("is_active")) ? 1 : 0) : 1;

        if (exists) {
            jdbc.update(
                    """
                    UPDATE clients SET
                      client_uuid = ?, client_status = ?, wait_list_status = ?,
                      first_name = ?, middle_name = ?, last_name = ?, date_of_birth = ?,
                      gender = ?, preferred_language = ?, phone = ?, email = ?,
                      appointment_reminder = ?, parent_first_name = ?, parent_last_name = ?,
                      relationship_to_insured = ?, relation_other = ?,
                      emergency_contact_name = ?, emg_relationship = ?, emg_phone = ?, emg_email = ?,
                      client_notes = ?, other_information = ?, archived = ?, is_active = ?,
                      updated_at = CURRENT_TIMESTAMP
                    WHERE client_id = ?
                    """,
                    clientUuid,
                    clientStatus,
                    enumOrDefault(input.get("wait_list_status"), "No", "Yes", "No"),
                    firstName,
                    emptyToNull(input.get("middle_name")),
                    lastName,
                    dob,
                    enumOrNull(input.get("gender"), "Male", "Female", "Other", "Prefer not to say"),
                    emptyToNull(input.get("preferred_language")),
                    emptyToNull(input.get("phone")),
                    emptyToNull(input.get("email")),
                    enumOrDefault(input.get("appointment_reminder"), "both", "sms", "email", "phone", "none", "both"),
                    emptyToNull(input.get("parent_first_name")),
                    emptyToNull(input.get("parent_last_name")),
                    enumOrDefault(input.get("relationship_to_insured"), "Self", "Self", "Guardian", "Other", "Spouse", "Parent"),
                    emptyToNull(input.get("relation_other")),
                    emptyToNull(input.get("emergency_contact_name")),
                    emptyToNull(input.get("emg_relationship")),
                    emptyToNull(input.get("emg_phone")),
                    emptyToNull(input.get("emg_email")),
                    emptyToNull(input.get("client_notes")),
                    emptyToNull(input.get("other_information")),
                    archived,
                    isActive,
                    clientId
            );
        } else {
            jdbc.update(
                    """
                    INSERT INTO clients (
                      client_id, client_uuid, client_status, wait_list_status,
                      first_name, middle_name, last_name, date_of_birth, gender,
                      preferred_language, phone, email, appointment_reminder,
                      parent_first_name, parent_last_name, relationship_to_insured, relation_other,
                      emergency_contact_name, emg_relationship, emg_phone, emg_email,
                      client_notes, other_information, archived, is_active
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    clientId,
                    clientUuid,
                    clientStatus,
                    enumOrDefault(input.get("wait_list_status"), "No", "Yes", "No"),
                    firstName,
                    emptyToNull(input.get("middle_name")),
                    lastName,
                    dob,
                    enumOrNull(input.get("gender"), "Male", "Female", "Other", "Prefer not to say"),
                    emptyToNull(input.get("preferred_language")),
                    emptyToNull(input.get("phone")),
                    emptyToNull(input.get("email")),
                    enumOrDefault(input.get("appointment_reminder"), "both", "sms", "email", "phone", "none", "both"),
                    emptyToNull(input.get("parent_first_name")),
                    emptyToNull(input.get("parent_last_name")),
                    enumOrDefault(input.get("relationship_to_insured"), "Self", "Self", "Guardian", "Other", "Spouse", "Parent"),
                    emptyToNull(input.get("relation_other")),
                    emptyToNull(input.get("emergency_contact_name")),
                    emptyToNull(input.get("emg_relationship")),
                    emptyToNull(input.get("emg_phone")),
                    emptyToNull(input.get("emg_email")),
                    emptyToNull(input.get("client_notes")),
                    emptyToNull(input.get("other_information")),
                    archived,
                    isActive
            );
        }

        replaceAddresses(clientId, input);
        List<Long> insuranceIds = replaceInsurances(clientId, input);
        replaceAuthorizations(input, insuranceIds);
        replaceDocuments(clientId, input);
        upsertAvailability(clientId, input);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", exists ? "Client updated successfully" : "Client added successfully");
        return body;
    }

    private List<Map<String, Object>> loadAllClientsNested() {
        List<Map<String, Object>> clients = jdbc.query("SELECT * FROM clients", this::mapRow);
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        for (Map<String, Object> c : clients) {
            c.put("insurances", new ArrayList<>());
            c.put("authorizations", new ArrayList<>());
            c.put("documents", new ArrayList<>());
            c.put("addresses", new ArrayList<>());
            c.put("availability", defaultAvailability());
            byId.put(str(c.get("client_id")), c);
        }

        Map<Long, String> insuranceToClient = new LinkedHashMap<>();
        jdbc.query(
                """
                SELECT ci.*, CONCAT(IFNULL(s.firstName,''), ' ', IFNULL(s.lastName,'')) AS provider_name
                FROM client_insurance ci
                LEFT JOIN staff s ON ci.provider_staff_id = s.id
                """,
                rs -> {
                    while (rs.next()) {
                        Map<String, Object> ins = resultSetToMap(rs);
                        String clientId = str(ins.get("client_id"));
                        Map<String, Object> client = byId.get(clientId);
                        if (client != null) {
                            @SuppressWarnings("unchecked")
                            List<Map<String, Object>> list = (List<Map<String, Object>>) client.get("insurances");
                            list.add(ins);
                        }
                        Object iid = ins.get("insurance_id");
                        if (iid != null) {
                            insuranceToClient.put(((Number) iid).longValue(), clientId);
                        }
                    }
                    return null;
                }
        );

        jdbc.query("SELECT * FROM client_auth", rs -> {
            while (rs.next()) {
                Map<String, Object> auth = resultSetToMap(rs);
                Object iid = auth.get("insurance_id");
                if (iid == null) {
                    continue;
                }
                String clientId = insuranceToClient.get(((Number) iid).longValue());
                if (clientId == null) {
                    continue;
                }
                Map<String, Object> client = byId.get(clientId);
                if (client == null) {
                    continue;
                }
                // Lightweight units enrich (sessions may be empty locally)
                if (!auth.containsKey("units_committed") || auth.get("units_committed") == null) {
                    auth.put("units_committed", auth.get("units_serviced") == null ? "0" : String.valueOf(auth.get("units_serviced")));
                }
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> list = (List<Map<String, Object>>) client.get("authorizations");
                list.add(auth);
            }
            return null;
        });

        try {
            jdbc.query("SELECT * FROM client_documents", rs -> {
                while (rs.next()) {
                    Map<String, Object> doc = resultSetToMap(rs);
                    Map<String, Object> client = byId.get(str(doc.get("client_id")));
                    if (client != null) {
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> list = (List<Map<String, Object>>) client.get("documents");
                        list.add(doc);
                    }
                }
                return null;
            });
        } catch (Exception ignored) {
            // documents optional
        }

        jdbc.query("SELECT * FROM client_addresses", rs -> {
            while (rs.next()) {
                Map<String, Object> addr = resultSetToMap(rs);
                String clientId = str(addr.get("client_id"));
                Map<String, Object> client = byId.get(clientId);
                if (client == null) {
                    continue;
                }
                Map<String, Object> shaped = new LinkedHashMap<>();
                shaped.put("id", addr.get("id"));
                shaped.put("service_location", addr.get("service_location") != null ? addr.get("service_location") : "Home");
                shaped.put("address_line_1", nullToEmpty(addr.get("address_line_1")));
                shaped.put("address_line_2", nullToEmpty(addr.get("address_line_2")));
                shaped.put("city", nullToEmpty(addr.get("city")));
                shaped.put("state", nullToEmpty(addr.get("state")));
                shaped.put("zipcode", nullToEmpty(addr.get("zipcode")));
                shaped.put("country", addr.get("country") != null ? addr.get("country") : "USA");
                shaped.put("countryOther", "");
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> list = (List<Map<String, Object>>) client.get("addresses");
                list.add(shaped);
                if (client.get("location") == null) {
                    client.put("location", addr.get("location"));
                }
            }
            return null;
        });

        for (Map<String, Object> client : byId.values()) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> addresses = (List<Map<String, Object>>) client.get("addresses");
            Map<String, Object> primary = null;
            for (Map<String, Object> addr : addresses) {
                if (!str(addr.get("address_line_1")).isBlank()) {
                    primary = addr;
                    break;
                }
            }
            if (primary == null && !addresses.isEmpty()) {
                primary = addresses.get(0);
            }
            if (primary != null) {
                for (String field : List.of("address_line_1", "address_line_2", "city", "state", "zipcode")) {
                    if (str(client.get(field)).isBlank() && !str(primary.get(field)).isBlank()) {
                        client.put(field, primary.get(field));
                    }
                }
            }
        }

        jdbc.query("SELECT * FROM client_availability", rs -> {
            while (rs.next()) {
                String clientId = rs.getString("client_id");
                Map<String, Object> client = byId.get(clientId);
                if (client == null) {
                    continue;
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> availability = (Map<String, Object>) client.get("availability");
                Map<String, Object> day = new LinkedHashMap<>();
                day.put("available", rs.getInt("available") == 1);
                day.put("start", rs.getString("start_time"));
                day.put("end", rs.getString("end_time"));
                availability.put(rs.getString("day"), day);
            }
            return null;
        });

        return new ArrayList<>(byId.values());
    }

    private void replaceAddresses(String clientId, Map<String, Object> input) {
        jdbc.update("DELETE FROM client_addresses WHERE client_id = ?", clientId);
        Object addressesObj = input.get("addresses");
        if (!(addressesObj instanceof List<?> addresses)) {
            return;
        }
        Object topLocation = input.get("location");
        for (Object item : addresses) {
            if (!(item instanceof Map<?, ?> raw)) {
                continue;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> addr = (Map<String, Object>) raw;
            String country = str(addr.get("country"));
            if ("Other".equalsIgnoreCase(country)) {
                country = str(addr.get("countryOther"));
                if (country.isBlank()) {
                    country = "USA";
                }
            } else if (country.isBlank()) {
                country = "USA";
            }
            jdbc.update(
                    """
                    INSERT INTO client_addresses
                      (client_id, service_location, location, address_line_1, address_line_2, city, state, zipcode, country)
                    VALUES (?,?,?,?,?,?,?,?,?)
                    """,
                    clientId,
                    strOr(addr.get("service_location"), "Home"),
                    topLocation,
                    emptyToNull(addr.get("address_line_1")),
                    emptyToNull(addr.get("address_line_2")),
                    emptyToNull(addr.get("city")),
                    emptyToNull(addr.get("state")),
                    emptyToNull(addr.get("zipcode")),
                    country
            );
        }
    }

    private List<Long> replaceInsurances(String clientId, Map<String, Object> input) {
        jdbc.update(
                "DELETE FROM client_auth WHERE insurance_id IN (SELECT insurance_id FROM client_insurance WHERE client_id = ?)",
                clientId
        );
        jdbc.update("DELETE FROM client_insurance WHERE client_id = ?", clientId);

        List<Long> insuranceIds = new ArrayList<>();
        Object insurancesObj = input.get("insurances");
        if (!(insurancesObj instanceof List<?> insurances)) {
            return insuranceIds;
        }

        for (Object item : insurances) {
            if (!(item instanceof Map<?, ?> raw)) {
                continue;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> ins = (Map<String, Object>) raw;
            if (truthy(ins.get("delete_insurance"))) {
                continue;
            }

            KeyHolder keys = new GeneratedKeyHolder();
            jdbc.update(con -> {
                var ps = con.prepareStatement(
                        """
                        INSERT INTO client_insurance (
                          client_id, description, insurance_type, insurance_provider,
                          insurance_provider_id, primary_diagnosis, treatment_type, provider_staff_id,
                          rendering_provider, start_date, end_date, authorization_number,
                          insurance_id_number, group_number,
                          diagnosis_1, diagnosis_2, diagnosis_3, diagnosis_4, diagnosis_5,
                          coinsurance, deductible, copay_per, copay_rate,
                          carrier_payer_id, insurance_company_address, insurance_issue_date, insurance_plan_name,
                          date_of_signature, authorized_payment_box13, authorized_release_box12, authorized_release_box17,
                          additional_claim_info_box19, do_not_accept_assignment_box27,
                          insurance_notes, primary_insurance_notes, insured_same_as_client,
                          insurance_inactive, delete_insurance,
                          insurance_document_path, insurance_document_filename
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                        """,
                        java.sql.Statement.RETURN_GENERATED_KEYS
                );
                int i = 1;
                ps.setString(i++, clientId);
                ps.setString(i++, str(ins.get("description")));
                ps.setString(i++, enumOrDefault(ins.get("insurance_type"), "Primary", "Primary", "Secondary"));
                ps.setString(i++, emptyToNull(ins.get("insurance_provider")));
                ps.setString(i++, emptyToNull(ins.get("insurance_provider_id")));
                ps.setString(i++, emptyToNull(ins.get("primary_diagnosis")));
                ps.setString(i++, strOr(ins.get("treatment_type"), "Behavioral therapy"));
                String staffId = str(ins.get("provider_staff_id"));
                ps.setString(i++, staffId.isBlank() ? null : staffId);
                ps.setString(i++, emptyToNull(ins.get("rendering_provider")));
                setDateOrNull(ps, i++, ins.get("start_date"));
                setDateOrNull(ps, i++, ins.get("end_date"));
                ps.setString(i++, emptyToNull(ins.get("authorization_number")));
                ps.setString(i++, emptyToNull(ins.get("insurance_id_number")));
                ps.setString(i++, emptyToNull(ins.get("group_number")));
                ps.setString(i++, emptyToNull(ins.get("diagnosis_1")));
                ps.setString(i++, emptyToNull(ins.get("diagnosis_2")));
                ps.setString(i++, emptyToNull(ins.get("diagnosis_3")));
                ps.setString(i++, emptyToNull(ins.get("diagnosis_4")));
                ps.setString(i++, emptyToNull(ins.get("diagnosis_5")));
                ps.setString(i++, emptyToNull(ins.get("coinsurance")));
                ps.setString(i++, emptyToNull(ins.get("deductible")));
                ps.setString(i++, enumOrDefault(ins.get("copay_per"), "hr", "hr", "Day", "Week", "month", "yr"));
                if (str(ins.get("copay_rate")).isBlank()) {
                    ps.setObject(i++, null);
                } else {
                    ps.setObject(i++, ins.get("copay_rate"));
                }
                ps.setString(i++, emptyToNull(ins.get("carrier_payer_id")));
                ps.setString(i++, emptyToNull(ins.get("insurance_company_address")));
                setDateOrNull(ps, i++, ins.get("insurance_issue_date"));
                ps.setString(i++, emptyToNull(ins.get("insurance_plan_name")));
                setDateOrNull(ps, i++, ins.get("date_of_signature"));
                ps.setString(i++, strOr(ins.get("authorized_payment_box13"), "Signature on File"));
                ps.setString(i++, strOr(ins.get("authorized_release_box12"), "Signature on File"));
                ps.setString(i++, strOr(ins.get("authorized_release_box17"), "Signature on File"));
                ps.setString(i++, emptyToNull(ins.get("additional_claim_info_box19")));
                ps.setInt(i++, truthy(ins.get("do_not_accept_assignment_box27")) ? 1 : 0);
                ps.setString(i++, emptyToNull(ins.get("insurance_notes")));
                ps.setString(i++, emptyToNull(ins.get("primary_insurance_notes")));
                ps.setInt(i++, ins.containsKey("insured_same_as_client")
                        ? (truthy(ins.get("insured_same_as_client")) ? 1 : 0) : 1);
                ps.setInt(i++, truthy(ins.get("insurance_inactive")) ? 1 : 0);
                ps.setInt(i++, truthy(ins.get("delete_insurance")) ? 1 : 0);
                ps.setString(i++, emptyToNull(ins.get("insurance_document_path")));
                ps.setString(i++, emptyToNull(ins.get("insurance_document_filename")));
                return ps;
            }, keys);

            Number key = keys.getKey();
            if (key != null) {
                insuranceIds.add(key.longValue());
            }
        }
        return insuranceIds;
    }

    private void replaceAuthorizations(Map<String, Object> input, List<Long> insuranceIds) {
        Object authsObj = input.get("authorizations");
        if (!(authsObj instanceof List<?> auths) || insuranceIds.isEmpty()) {
            return;
        }
        for (Object item : auths) {
            if (!(item instanceof Map<?, ?> raw)) {
                continue;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> auth = (Map<String, Object>) raw;
            Long linked = resolveAuthorizationInsuranceId(auth.get("insurance_id"), insuranceIds);
            if (linked == null) {
                continue;
            }
            String authUuid = str(auth.get("auth_uuid"));
            if (authUuid.isBlank()) {
                authUuid = "auth_" + UUID.randomUUID();
            }
            Integer units = null;
            if (!str(auth.get("units_approved_per_15_min")).isBlank()) {
                try {
                    units = Integer.parseInt(str(auth.get("units_approved_per_15_min")));
                } catch (NumberFormatException ignored) {
                    units = null;
                }
            }
            jdbc.update(
                    """
                    INSERT INTO client_auth (
                      auth_uuid, insurance_id, authorization_number, billing_codes,
                      units_approved_per_15_min, units_serviced, balance_units, start_date, end_date, status
                    ) VALUES (?,?,?,?,?,?,?,?,?,?)
                    """,
                    authUuid,
                    linked,
                    emptyToNull(auth.get("authorization_number")),
                    emptyToNull(auth.get("billing_codes")),
                    units,
                    emptyToNull(auth.get("units_serviced")),
                    emptyToNull(auth.get("balance_units")),
                    emptyDate(auth.get("start_date")),
                    emptyDate(auth.get("end_date")),
                    enumOrDefault(auth.get("status"), "Active", "Active", "Inactive", "Expired")
            );
        }
    }

    private void replaceDocuments(String clientId, Map<String, Object> input) {
        try {
            jdbc.update("DELETE FROM client_documents WHERE client_id = ?", clientId);
        } catch (Exception ignored) {
            // optional
        }
        Object docsObj = input.get("documents");
        if (!(docsObj instanceof List<?> docs)) {
            return;
        }
        for (Object item : docs) {
            if (!(item instanceof Map<?, ?> raw)) {
                continue;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> doc = (Map<String, Object>) raw;
            String docUuid = str(doc.get("doc_uuid"));
            if (docUuid.isBlank()) {
                docUuid = "doc_" + UUID.randomUUID();
            }
            String fileUrl = str(doc.get("file_url"));
            if (fileUrl.isBlank()) {
                fileUrl = str(doc.get("document_path"));
            }
            try {
                jdbc.update(
                        """
                        INSERT INTO client_documents (client_id, doc_uuid, document_type, file_url, document_original_filename)
                        VALUES (?,?,?,?,?)
                        """,
                        clientId,
                        docUuid,
                        strOr(doc.get("document_type"), "misc"),
                        emptyToNull(fileUrl),
                        emptyToNull(doc.get("document_original_filename"))
                );
            } catch (Exception ignored) {
                // skip document persistence failures (Drive deferred)
            }
        }
    }

    private void upsertAvailability(String clientId, Map<String, Object> input) {
        Object availObj = input.get("availability");
        if (!(availObj instanceof Map<?, ?> raw)) {
            return;
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> availability = (Map<String, Object>) raw;
        for (String day : WEEKDAYS) {
            Object dayObj = availability.get(day);
            if (!(dayObj instanceof Map<?, ?> dayRaw)) {
                continue;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> dayMap = (Map<String, Object>) dayRaw;
            int available = truthy(dayMap.get("available")) ? 1 : 0;
            Object start = dayMap.containsKey("start") ? dayMap.get("start") : dayMap.get("start_time");
            Object end = dayMap.containsKey("end") ? dayMap.get("end") : dayMap.get("end_time");
            jdbc.update(
                    """
                    INSERT INTO client_availability (client_id, day, available, start_time, end_time)
                    VALUES (?,?,?,?,?)
                    ON DUPLICATE KEY UPDATE available = VALUES(available), start_time = VALUES(start_time), end_time = VALUES(end_time)
                    """,
                    clientId,
                    day,
                    available,
                    emptyToNull(start),
                    emptyToNull(end)
            );
        }
    }

    private static Long resolveAuthorizationInsuranceId(Object raw, List<Long> insuranceIds) {
        if (insuranceIds.isEmpty()) {
            return null;
        }
        if (raw == null || str(raw).isBlank()) {
            return insuranceIds.get(0);
        }
        if (raw instanceof Number n) {
            int asInt = n.intValue();
            if (asInt >= 0 && asInt < insuranceIds.size()) {
                return insuranceIds.get(asInt);
            }
            for (Long id : insuranceIds) {
                if (id.intValue() == asInt) {
                    return id;
                }
            }
        }
        String s = str(raw);
        try {
            int asInt = Integer.parseInt(s);
            if (asInt >= 0 && asInt < insuranceIds.size()) {
                return insuranceIds.get(asInt);
            }
            for (Long id : insuranceIds) {
                if (id.intValue() == asInt) {
                    return id;
                }
            }
        } catch (NumberFormatException ignored) {
            // fall through
        }
        return insuranceIds.get(0);
    }

    private Map<String, Object> mapRow(ResultSet rs, int rowNum) throws SQLException {
        return resultSetToMap(rs);
    }

    private static Map<String, Object> resultSetToMap(ResultSet rs) throws SQLException {
        ResultSetMetaData meta = rs.getMetaData();
        int cols = meta.getColumnCount();
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 1; i <= cols; i++) {
            String label = meta.getColumnLabel(i);
            Object value = rs.getObject(i);
            if (value instanceof java.sql.Timestamp ts) {
                value = ts.toString();
            } else if (value instanceof java.sql.Date d) {
                value = d.toString();
            } else if (value instanceof java.sql.Time t) {
                value = t.toString();
            }
            map.put(label, value);
        }
        return map;
    }

    private static Map<String, Object> defaultAvailability() {
        Map<String, Object> availability = new LinkedHashMap<>();
        for (String day : WEEKDAYS) {
            Map<String, Object> slot = new LinkedHashMap<>();
            slot.put("available", false);
            slot.put("start", null);
            slot.put("end", null);
            availability.put(day, slot);
        }
        return availability;
    }

    private static void setDateOrNull(java.sql.PreparedStatement ps, int index, Object value) throws SQLException {
        String s = str(value);
        if (s.isBlank()) {
            ps.setObject(index, null);
        } else {
            ps.setString(index, s.length() >= 10 ? s.substring(0, 10) : s);
        }
    }

    private static String emptyDate(Object value) {
        String s = str(value);
        if (s.isBlank()) {
            return null;
        }
        return s.length() >= 10 ? s.substring(0, 10) : s;
    }

    private static String shortUuid() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    private static boolean truthy(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof Boolean b) {
            return b;
        }
        if (value instanceof Number n) {
            return n.intValue() != 0;
        }
        String s = String.valueOf(value).trim().toLowerCase(Locale.ROOT);
        return "1".equals(s) || "true".equals(s) || "yes".equals(s);
    }

    private static String str(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private static String strOr(Object value, String fallback) {
        String s = str(value);
        return s.isBlank() ? fallback : s;
    }

    private static String nullToEmpty(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static String emptyToNull(Object value) {
        String s = str(value);
        return s.isBlank() ? null : s;
    }

    private static String enumOrNull(Object value, String... allowed) {
        String s = str(value);
        if (s.isBlank()) {
            return null;
        }
        for (String a : allowed) {
            if (a.equalsIgnoreCase(s)) {
                return a;
            }
        }
        return null;
    }

    private static String enumOrDefault(Object value, String fallback, String... allowed) {
        String s = str(value);
        if (s.isBlank()) {
            return fallback;
        }
        for (String a : allowed) {
            if (a.equalsIgnoreCase(s)) {
                return a;
            }
        }
        return fallback;
    }
}

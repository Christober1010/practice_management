package com.mahaverse.api.lookups;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class LookupsService {

    private final JdbcTemplate jdbc;

    public LookupsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> locations(boolean showArchived, String id) {
        if (id != null && !id.isBlank()) {
            List<Map<String, Object>> rows = jdbc.query(
                    "SELECT * FROM locations WHERE id = ? LIMIT 1",
                    this::mapRow,
                    id
            );
            return envelope(rows);
        }
        String sql = showArchived
                ? "SELECT * FROM locations ORDER BY location_name"
                : "SELECT * FROM locations WHERE archived = 0 ORDER BY location_name";
        return envelope(jdbc.query(sql, this::mapRow));
    }

    public Map<String, Object> providers(boolean showArchived) {
        String sql = showArchived
                ? "SELECT * FROM master_providers ORDER BY provider_name"
                : "SELECT * FROM master_providers WHERE archived = 0 ORDER BY provider_name";
        return envelope(jdbc.query(sql, this::mapRow));
    }

    public Map<String, Object> serviceCodes() {
        return envelope(jdbc.query(
                "SELECT * FROM master_service_code ORDER BY code",
                this::mapRow
        ));
    }

    public Map<String, Object> diagnosisCodes(boolean showArchived) {
        String sql = showArchived
                ? "SELECT * FROM master_diagnosis ORDER BY diagnosis_code"
                : "SELECT * FROM master_diagnosis WHERE archived = 0 ORDER BY diagnosis_code";
        return envelope(jdbc.query(sql, this::mapRow));
    }

    public Map<String, Object> facilityTypes(boolean showArchived, boolean showInactive) {
        try {
            StringBuilder sql = new StringBuilder("SELECT * FROM master_facility_types WHERE 1=1");
            if (!showArchived) {
                sql.append(" AND (archived = 0 OR archived IS NULL)");
            }
            if (!showInactive) {
                sql.append(" AND (active = 1 OR active IS NULL)");
            }
            sql.append(" ORDER BY facility_name");
            return envelope(jdbc.query(sql.toString(), this::mapRow));
        } catch (Exception ex) {
            return envelope(List.of());
        }
    }

    public Map<String, Object> treatmentTypes() {
        try {
            return envelope(jdbc.query("SELECT * FROM master_treatment_types ORDER BY 1", this::mapRow));
        } catch (Exception ex) {
            return envelope(List.of());
        }
    }

    public Map<String, Object> documentTypes() {
        try {
            return envelope(jdbc.query("SELECT * FROM master_document_types ORDER BY 1", this::mapRow));
        } catch (Exception ex) {
            return envelope(List.of());
        }
    }

    public Map<String, Object> providerServiceCodes(String providerId) {
        try {
            if (providerId != null && !providerId.isBlank()) {
                return envelope(jdbc.query(
                        "SELECT * FROM master_provider_service_code WHERE provider_id = ?",
                        this::mapRow,
                        providerId
                ));
            }
            return envelope(jdbc.query("SELECT * FROM master_provider_service_code", this::mapRow));
        } catch (Exception ex) {
            return envelope(List.of());
        }
    }

    private Map<String, Object> envelope(List<Map<String, Object>> data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("data", new ArrayList<>(data));
        return body;
    }

    private Map<String, Object> mapRow(ResultSet rs, int rowNum) throws SQLException {
        ResultSetMetaData meta = rs.getMetaData();
        int cols = meta.getColumnCount();
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 1; i <= cols; i++) {
            Object value = rs.getObject(i);
            if (value instanceof java.sql.Timestamp ts) {
                value = ts.toString();
            } else if (value instanceof java.sql.Date d) {
                value = d.toString();
            } else if (value instanceof java.sql.Time t) {
                value = t.toString();
            }
            map.put(meta.getColumnLabel(i), value);
        }
        return map;
    }
}

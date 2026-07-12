# E2E test data cleanup (SQL)

Remove Playwright / API E2E rows **without touching real clients**.

**Test DB:** `dbs14649042`  
**Prod DB:** `dbs14484433` — use the same queries only after previewing on prod.

---

## Rules

1. Run every **PREVIEW** (`SELECT`) first.
2. Run **DELETE** blocks in order (children before parents).
3. Do **not** delete `clients` unless Step 0 only shows E2E rows.
4. E2E sessions on **real** clients are removed by `quick_note`, not by deleting the client.

---

## Step 0 — E2E clients (preview)

```sql
SELECT client_id, first_name, last_name, email
FROM clients
WHERE first_name LIKE 'E2E%'
   OR email LIKE '%@mahaverse-test.invalid'
   OR (first_name LIKE 'Schema%' AND last_name = 'Probe');
```

Known E2E client IDs from a test run (optional exact list):

```sql
-- Use IN (...) instead of patterns if you want only these rows:
-- '0bdb193c-5433-4e3f-a23f-4404fcddab42',
-- '3fd21d5b-c028-4637-a6e0-58130d7ad95c',
-- '482100bf-da6e-428b-bb98-ed52aa678163',
-- '4c22a102-6a3a-432e-bd02-a666b773ebd2',
-- '5b592fd0-8f9a-44a1-b1b4-9c36bc0361ed',
-- '6120472e-a823-4980-8413-ab7b1d5c4229',
-- '6aa38a3f-287c-4879-9af4-75817901b70d',
-- 'e2e-cli_1780595989513',
-- 'e2e-cli_1780596013483',
-- 'e2e-cli_1780596291436',
-- 'e2e-cli_1780596321174',
-- 'e4ea75b1-c678-415d-bf48-f5d90e55409b',
-- 'f9f3835f-0adc-44d5-82b3-3ffc88c7ca63'
```

Shared filter (use in child-table deletes below):

```sql
-- Paste into IN (...) or use as subquery:
WHERE client_id IN (
  SELECT client_id FROM clients
  WHERE first_name LIKE 'E2E%'
     OR email LIKE '%@mahaverse-test.invalid'
     OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
)
```

If MySQL rejects `DELETE ... IN (SELECT ... FROM clients)`, run Step 0 `SELECT`, copy IDs, and use `WHERE client_id IN ('id1','id2',...)`.

**`client_auth`:** this table has **`insurance_id`**, not `client_id`. Deleting with `WHERE client_id IN (...)` fails with `#1054 Unknown column 'client_id'`. Delete auth rows via `client_insurance` (see Step 9), **before** deleting `client_insurance`.

---

## Step 1 — Sessions (any client)

### Preview

```sql
SELECT session_id, client_id, quick_note, start_utc, status
FROM sessions
WHERE quick_note LIKE '%E2E%'
   OR quick_note LIKE '%schema-readiness%';
```

### Delete

```sql
DELETE FROM sessions
WHERE quick_note LIKE '%E2E%'
   OR quick_note LIKE '%schema-readiness%';
```

---

## Step 2 — Session notes & behavior data

### Preview

```sql
SELECT id, client_id, session_date, LEFT(payload, 120) AS payload_preview
FROM client_session_note_entries
WHERE payload LIKE '%E2E%';

SELECT id, client_id, target_id, session_date, notes
FROM client_session_notes
WHERE notes LIKE '%E2E%'
   OR target_id LIKE 'tgt_e2e%';

SELECT id, client_id, session_date, behavior_id
FROM client_session_behavior_data
WHERE behavior_id LIKE 'cb_e2e%'
   OR behavior_id LIKE 'cb_flow%';
```

### Delete (pattern-based)

```sql
DELETE FROM client_session_behavior_data
WHERE behavior_id LIKE 'cb_e2e%'
   OR behavior_id LIKE 'cb_flow%';

DELETE FROM client_session_note_entries
WHERE payload LIKE '%E2E%';

DELETE FROM client_session_notes
WHERE notes LIKE '%E2E%'
   OR target_id LIKE 'tgt_e2e%';
```

### Delete (E2E clients only)

```sql
DELETE FROM client_session_note_entries
WHERE client_id IN (
  SELECT client_id FROM clients
  WHERE first_name LIKE 'E2E%'
     OR email LIKE '%@mahaverse-test.invalid'
     OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
);

DELETE FROM client_session_notes
WHERE client_id IN (
  SELECT client_id FROM clients
  WHERE first_name LIKE 'E2E%'
     OR email LIKE '%@mahaverse-test.invalid'
     OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
);
```

---

## Step 3 — Client behaviors (any client)

### Preview

```sql
SELECT id, client_id, name FROM client_behaviors WHERE name LIKE 'E2E%';
```

### Delete

```sql
DELETE FROM client_behaviors WHERE name LIKE 'E2E%';
```

---

## Step 4 — Master behaviors

### Preview

```sql
SELECT id, name FROM master_behavior_categories WHERE name LIKE 'E2E%' OR id LIKE 'bcat_e2e%' OR id LIKE 'bcat_flow%';
SELECT id, name FROM master_behaviors WHERE name LIKE 'E2E%' OR id LIKE 'mb_e2e%' OR id LIKE 'mb_flow%';
```

### Delete

```sql
DELETE FROM master_behaviors
WHERE name LIKE 'E2E%' OR id LIKE 'mb_e2e%' OR id LIKE 'mb_flow%';

DELETE FROM master_behavior_categories
WHERE name LIKE 'E2E%' OR id LIKE 'bcat_e2e%' OR id LIKE 'bcat_flow%';
```

---

## Step 5 — Master curriculum (domains / programs / targets)

### Preview

```sql
SELECT id, name FROM master_domains WHERE name LIKE 'E2E%' OR id LIKE 'dom_e2e%';
SELECT id, name FROM master_programs WHERE name LIKE 'E2E%' OR id LIKE 'prg_e2e%';
SELECT id, name FROM master_targets WHERE name LIKE 'E2E%' OR id LIKE 'tgt_e2e%';
```

### Delete (targets → programs → domains)

```sql
DELETE FROM master_targets WHERE name LIKE 'E2E%' OR id LIKE 'tgt_e2e%';
DELETE FROM master_programs WHERE name LIKE 'E2E%' OR id LIKE 'prg_e2e%';
DELETE FROM master_domains WHERE name LIKE 'E2E%' OR id LIKE 'dom_e2e%';
```

---

## Step 6 — Staff

Table is **`staff`** (API JSON key `staff_records` is not a table).

### Preview

```sql
SELECT id, email, firstName, lastName
FROM staff
WHERE id LIKE 'ST_E2E%'
   OR email LIKE '%@mahaverse-test.invalid';

SELECT * FROM staff_certifications WHERE staff_id LIKE 'ST_E2E%';
SELECT * FROM staff_availability WHERE staff_id LIKE 'ST_E2E%';
SELECT * FROM staff_assignments WHERE staff_id LIKE 'ST_E2E%' OR assigned_staff_id LIKE 'ST_E2E%';
SELECT * FROM staff_client_assignments WHERE staff_id LIKE 'ST_E2E%';
SELECT * FROM staff_documents WHERE staff_id LIKE 'ST_E2E%';
```

### Delete

```sql
DELETE FROM staff_certifications WHERE staff_id LIKE 'ST_E2E%';
DELETE FROM staff_availability WHERE staff_id LIKE 'ST_E2E%';
DELETE FROM staff_assignments WHERE staff_id LIKE 'ST_E2E%' OR assigned_staff_id LIKE 'ST_E2E%';
DELETE FROM staff_client_assignments WHERE staff_id LIKE 'ST_E2E%';
DELETE FROM staff_documents WHERE staff_id LIKE 'ST_E2E%';

DELETE FROM staff
WHERE id LIKE 'ST_E2E%'
   OR email LIKE '%@mahaverse-test.invalid';
```

---

## Step 7 — Users

### Preview

```sql
SELECT id, email, first_name, last_name
FROM users
WHERE email LIKE '%@mahaverse-test.invalid';
```

### Delete

```sql
DELETE FROM users WHERE email LIKE '%@mahaverse-test.invalid';
```

---

## Step 8 — Locations & other master rows

### Preview

```sql
SELECT * FROM locations WHERE location_name LIKE 'E2E%';
SELECT * FROM master_providers WHERE provider_name LIKE 'E2E%';
SELECT * FROM master_service_code WHERE code LIKE 'E2E%';
SELECT * FROM master_facility_types WHERE facility_name LIKE 'E2E%';
```

### Delete

```sql
DELETE FROM locations WHERE location_name LIKE 'E2E%';
DELETE FROM master_providers WHERE provider_name LIKE 'E2E%';
DELETE FROM master_service_code WHERE code LIKE 'E2E%';
DELETE FROM master_facility_types WHERE facility_name LIKE 'E2E%';
```

---

## Step 9 — E2E client child rows, then clients

### Preview (sample — repeat for other `client_*` tables if needed)

```sql
SELECT * FROM client_addresses WHERE client_id IN (
  SELECT client_id FROM clients
  WHERE first_name LIKE 'E2E%' OR email LIKE '%@mahaverse-test.invalid'
     OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
);

SELECT * FROM client_insurance WHERE client_id IN (
  SELECT client_id FROM clients
  WHERE first_name LIKE 'E2E%' OR email LIKE '%@mahaverse-test.invalid'
     OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
);

-- client_auth has insurance_id, not client_id (same as add-clients.php / update-clients.php)
SELECT * FROM client_auth WHERE insurance_id IN (
  SELECT insurance_id FROM client_insurance
  WHERE client_id IN (
    SELECT client_id FROM clients
    WHERE first_name LIKE 'E2E%' OR email LIKE '%@mahaverse-test.invalid'
       OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
  )
);
```

### Delete children (E2E clients)

```sql
DELETE FROM client_addresses WHERE client_id IN (
  SELECT client_id FROM clients
  WHERE first_name LIKE 'E2E%' OR email LIKE '%@mahaverse-test.invalid'
     OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
);

-- client_auth first (via insurance_id), then client_insurance
DELETE FROM client_auth WHERE insurance_id IN (
  SELECT insurance_id FROM client_insurance
  WHERE client_id IN (
    SELECT client_id FROM clients
    WHERE first_name LIKE 'E2E%' OR email LIKE '%@mahaverse-test.invalid'
       OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
  )
);

DELETE FROM client_insurance WHERE client_id IN (
  SELECT client_id FROM clients
  WHERE first_name LIKE 'E2E%' OR email LIKE '%@mahaverse-test.invalid'
     OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
);

DELETE FROM client_availability WHERE client_id IN (
  SELECT client_id FROM clients
  WHERE first_name LIKE 'E2E%' OR email LIKE '%@mahaverse-test.invalid'
     OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
);

DELETE FROM client_documents WHERE client_id IN (
  SELECT client_id FROM clients
  WHERE first_name LIKE 'E2E%' OR email LIKE '%@mahaverse-test.invalid'
     OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
);

DELETE FROM client_domains WHERE client_id IN (
  SELECT client_id FROM clients
  WHERE first_name LIKE 'E2E%' OR email LIKE '%@mahaverse-test.invalid'
     OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
);

DELETE FROM client_programs WHERE client_id IN (
  SELECT client_id FROM clients
  WHERE first_name LIKE 'E2E%' OR email LIKE '%@mahaverse-test.invalid'
     OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
);

DELETE FROM client_targets WHERE client_id IN (
  SELECT client_id FROM clients
  WHERE first_name LIKE 'E2E%' OR email LIKE '%@mahaverse-test.invalid'
     OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
);

DELETE FROM client_behaviors WHERE client_id IN (
  SELECT client_id FROM clients
  WHERE first_name LIKE 'E2E%' OR email LIKE '%@mahaverse-test.invalid'
     OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
);
```

### Delete E2E clients (last)

```sql
DELETE FROM clients
WHERE first_name LIKE 'E2E%'
   OR email LIKE '%@mahaverse-test.invalid'
   OR (first_name LIKE 'Schema%' AND last_name = 'Probe');
```

---

## Whole-DB audit (one query)

Run on **test** (`dbs14649042`) or **prod** (`dbs14484433`). Every `remaining` count should be **0** when cleanup is complete.

phpMyAdmin on IONOS often rejects `WITH` and mixes `utf8mb4_unicode_ci` / `utf8mb4_general_ci` on `client_id` joins — use this **no-CTE** version with explicit `COLLATE`:

```sql
SELECT section, tbl, remaining FROM (
  SELECT 'clients' AS section, 'clients' AS tbl, COUNT(*) AS remaining
    FROM clients
    WHERE first_name LIKE 'E2E%'
       OR email LIKE '%@mahaverse-test.invalid'
       OR client_id LIKE 'e2e-cli_%'
       OR (first_name LIKE 'Schema%' AND last_name = 'Probe')
  UNION ALL SELECT 'sessions', 'sessions (quick_note)',
    (SELECT COUNT(*) FROM sessions
     WHERE quick_note LIKE '%E2E%' OR quick_note LIKE '%schema-readiness%')
  UNION ALL SELECT 'sessions', 'sessions (e2e client)',
    (SELECT COUNT(*) FROM sessions s
     WHERE s.client_id COLLATE utf8mb4_unicode_ci IN (
       SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
       WHERE c.first_name LIKE 'E2E%'
          OR c.email LIKE '%@mahaverse-test.invalid'
          OR c.client_id LIKE 'e2e-cli_%'
          OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
     ))
  UNION ALL SELECT 'notes', 'client_session_note_entries',
    (SELECT COUNT(*) FROM client_session_note_entries e
     WHERE e.payload LIKE '%E2E%'
        OR e.client_id COLLATE utf8mb4_unicode_ci IN (
          SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
          WHERE c.first_name LIKE 'E2E%'
             OR c.email LIKE '%@mahaverse-test.invalid'
             OR c.client_id LIKE 'e2e-cli_%'
             OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
        ))
  UNION ALL SELECT 'notes', 'client_session_notes',
    (SELECT COUNT(*) FROM client_session_notes n
     WHERE n.notes LIKE '%E2E%' OR n.target_id LIKE 'tgt_e2e%'
        OR n.client_id COLLATE utf8mb4_unicode_ci IN (
          SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
          WHERE c.first_name LIKE 'E2E%'
             OR c.email LIKE '%@mahaverse-test.invalid'
             OR c.client_id LIKE 'e2e-cli_%'
             OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
        ))
  UNION ALL SELECT 'notes', 'client_session_behavior_data',
    (SELECT COUNT(*) FROM client_session_behavior_data b
     WHERE b.behavior_id LIKE 'cb_e2e%' OR b.behavior_id LIKE 'cb_flow%'
        OR b.client_id COLLATE utf8mb4_unicode_ci IN (
          SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
          WHERE c.first_name LIKE 'E2E%'
             OR c.email LIKE '%@mahaverse-test.invalid'
             OR c.client_id LIKE 'e2e-cli_%'
             OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
        ))
  UNION ALL SELECT 'behaviors', 'client_behaviors',
    (SELECT COUNT(*) FROM client_behaviors b
     WHERE b.name LIKE 'E2E%' OR b.id LIKE 'cb_e2e%' OR b.id LIKE 'cb_flow%'
        OR b.client_id COLLATE utf8mb4_unicode_ci IN (
          SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
          WHERE c.first_name LIKE 'E2E%'
             OR c.email LIKE '%@mahaverse-test.invalid'
             OR c.client_id LIKE 'e2e-cli_%'
             OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
        ))
  UNION ALL SELECT 'master', 'master_behavior_categories',
    (SELECT COUNT(*) FROM master_behavior_categories
     WHERE name LIKE 'E2E%' OR id LIKE 'bcat_e2e%' OR id LIKE 'bcat_flow%')
  UNION ALL SELECT 'master', 'master_behaviors',
    (SELECT COUNT(*) FROM master_behaviors
     WHERE name LIKE 'E2E%' OR id LIKE 'mb_e2e%' OR id LIKE 'mb_flow%')
  UNION ALL SELECT 'master', 'master_domains',
    (SELECT COUNT(*) FROM master_domains
     WHERE name LIKE 'E2E%' OR id LIKE 'dom_e2e%')
  UNION ALL SELECT 'master', 'master_programs',
    (SELECT COUNT(*) FROM master_programs
     WHERE name LIKE 'E2E%' OR id LIKE 'prg_e2e%')
  UNION ALL SELECT 'master', 'master_targets',
    (SELECT COUNT(*) FROM master_targets
     WHERE name LIKE 'E2E%' OR id LIKE 'tgt_e2e%')
  UNION ALL SELECT 'master', 'locations',
    (SELECT COUNT(*) FROM locations WHERE location_name LIKE 'E2E%')
  UNION ALL SELECT 'master', 'master_providers',
    (SELECT COUNT(*) FROM master_providers WHERE provider_name LIKE 'E2E%')
  UNION ALL SELECT 'master', 'master_service_code',
    (SELECT COUNT(*) FROM master_service_code WHERE code LIKE 'E2E%')
  UNION ALL SELECT 'master', 'master_facility_types',
    (SELECT COUNT(*) FROM master_facility_types WHERE facility_name LIKE 'E2E%')
  UNION ALL SELECT 'staff', 'staff',
    (SELECT COUNT(*) FROM staff
     WHERE id LIKE 'ST_E2E%' OR email LIKE '%@mahaverse-test.invalid')
  UNION ALL SELECT 'staff', 'staff_certifications',
    (SELECT COUNT(*) FROM staff_certifications WHERE staff_id LIKE 'ST_E2E%')
  UNION ALL SELECT 'staff', 'staff_availability',
    (SELECT COUNT(*) FROM staff_availability WHERE staff_id LIKE 'ST_E2E%')
  UNION ALL SELECT 'staff', 'staff_assignments',
    (SELECT COUNT(*) FROM staff_assignments
     WHERE staff_id LIKE 'ST_E2E%' OR assigned_staff_id LIKE 'ST_E2E%')
  UNION ALL SELECT 'staff', 'staff_client_assignments',
    (SELECT COUNT(*) FROM staff_client_assignments WHERE staff_id LIKE 'ST_E2E%')
  UNION ALL SELECT 'staff', 'staff_documents',
    (SELECT COUNT(*) FROM staff_documents WHERE staff_id LIKE 'ST_E2E%')
  UNION ALL SELECT 'users', 'users',
    (SELECT COUNT(*) FROM users WHERE email LIKE '%@mahaverse-test.invalid')
  UNION ALL SELECT 'client_children', 'client_addresses',
    (SELECT COUNT(*) FROM client_addresses a
     WHERE a.client_id COLLATE utf8mb4_unicode_ci IN (
       SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
       WHERE c.first_name LIKE 'E2E%'
          OR c.email LIKE '%@mahaverse-test.invalid'
          OR c.client_id LIKE 'e2e-cli_%'
          OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
     ))
  UNION ALL SELECT 'client_children', 'client_auth',
    (SELECT COUNT(*) FROM client_auth ca
     WHERE ca.insurance_id IN (
       SELECT ci.insurance_id FROM client_insurance ci
       WHERE ci.client_id COLLATE utf8mb4_unicode_ci IN (
         SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
         WHERE c.first_name LIKE 'E2E%'
            OR c.email LIKE '%@mahaverse-test.invalid'
            OR c.client_id LIKE 'e2e-cli_%'
            OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
       )
     ))
  UNION ALL SELECT 'client_children', 'client_insurance',
    (SELECT COUNT(*) FROM client_insurance ci
     WHERE ci.client_id COLLATE utf8mb4_unicode_ci IN (
       SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
       WHERE c.first_name LIKE 'E2E%'
          OR c.email LIKE '%@mahaverse-test.invalid'
          OR c.client_id LIKE 'e2e-cli_%'
          OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
     ))
  UNION ALL SELECT 'client_children', 'client_availability',
    (SELECT COUNT(*) FROM client_availability a
     WHERE a.client_id COLLATE utf8mb4_unicode_ci IN (
       SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
       WHERE c.first_name LIKE 'E2E%'
          OR c.email LIKE '%@mahaverse-test.invalid'
          OR c.client_id LIKE 'e2e-cli_%'
          OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
     ))
  UNION ALL SELECT 'client_children', 'client_documents',
    (SELECT COUNT(*) FROM client_documents d
     WHERE d.client_id COLLATE utf8mb4_unicode_ci IN (
       SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
       WHERE c.first_name LIKE 'E2E%'
          OR c.email LIKE '%@mahaverse-test.invalid'
          OR c.client_id LIKE 'e2e-cli_%'
          OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
     ))
  UNION ALL SELECT 'client_children', 'client_domains',
    (SELECT COUNT(*) FROM client_domains d
     WHERE d.client_id COLLATE utf8mb4_unicode_ci IN (
       SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
       WHERE c.first_name LIKE 'E2E%'
          OR c.email LIKE '%@mahaverse-test.invalid'
          OR c.client_id LIKE 'e2e-cli_%'
          OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
     ))
  UNION ALL SELECT 'client_children', 'client_programs',
    (SELECT COUNT(*) FROM client_programs p
     WHERE p.client_id COLLATE utf8mb4_unicode_ci IN (
       SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
       WHERE c.first_name LIKE 'E2E%'
          OR c.email LIKE '%@mahaverse-test.invalid'
          OR c.client_id LIKE 'e2e-cli_%'
          OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
     ))
  UNION ALL SELECT 'client_children', 'client_targets',
    (SELECT COUNT(*) FROM client_targets t
     WHERE t.client_id COLLATE utf8mb4_unicode_ci IN (
       SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
       WHERE c.first_name LIKE 'E2E%'
          OR c.email LIKE '%@mahaverse-test.invalid'
          OR c.client_id LIKE 'e2e-cli_%'
          OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
     ))
  UNION ALL SELECT 'client_children', 'client_modules',
    (SELECT COUNT(*) FROM client_modules m
     WHERE m.client_id COLLATE utf8mb4_unicode_ci IN (
       SELECT c.client_id COLLATE utf8mb4_unicode_ci FROM clients c
       WHERE c.first_name LIKE 'E2E%'
          OR c.email LIKE '%@mahaverse-test.invalid'
          OR c.client_id LIKE 'e2e-cli_%'
          OR (c.first_name LIKE 'Schema%' AND c.last_name = 'Probe')
     ))
) audit
ORDER BY remaining DESC, section, tbl;
```

**Only leftovers** — add `WHERE remaining > 0` before `ORDER BY`:

```sql
) audit
WHERE remaining > 0
ORDER BY remaining DESC, section, tbl;
```

If phpMyAdmin still warns on static analysis, click **Go** anyway (the warning is often a parser limitation, not MySQL).

---

## Step 10 — Verify

```sql
SELECT client_id, first_name, last_name, email
FROM clients
WHERE first_name LIKE 'E2E%'
   OR email LIKE '%@mahaverse-test.invalid'
   OR (first_name LIKE 'Schema%' AND last_name = 'Probe');
-- Expect 0 rows

SELECT session_id, quick_note FROM sessions
WHERE quick_note LIKE '%E2E%' OR quick_note LIKE '%schema-readiness%';
-- Expect 0 rows

SELECT id, email FROM users WHERE email LIKE '%@mahaverse-test.invalid';
-- Expect 0 rows

SELECT id, email FROM staff
WHERE id LIKE 'ST_E2E%' OR email LIKE '%@mahaverse-test.invalid';
-- Expect 0 rows
```

---

## Do not delete

- `clients` not matching Step 0 patterns (real clients)
- `sessions` without `E2E` / `schema-readiness` in `quick_note`
- `rbac_permissions`, `rbac_role_grants`, `AuthTokens`, `reports`, `payer_payment_entries` (E2E does not create these)

---

## Related docs

- [E2E-PLAYWRIGHT.md](./E2E-PLAYWRIGHT.md) — what tests create
- [MIGRATIONS-CHECKLIST.md](./MIGRATIONS-CHECKLIST.md) — schema migrations

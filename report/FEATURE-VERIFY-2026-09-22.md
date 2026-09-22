# Feature verification — Session Notes / Data Collection reports — 2026-09-22

**Constraint:** No Office Ally / Availity claim submit calls were made.

## Targets

| Env | API base | UI |
|-----|----------|-----|
| Test | `https://www.mahabehavioralhealth.com/mahaverse-backend-test` | `http://localhost:3000` (`dev:test`) |
| Prod | `https://www.mahabehavioralhealth.com/mahaverse-backend-logics` | API-only for authoritative prod checks |

Note: local `dev:prod` (:3001) still loads `.env.local`, which points the **browser** at backend-test. Prod conclusions below are from **direct API** calls to `mahaverse-backend-logics`.

## Results

### RBAC (Role Access)

| Check | Test | Prod |
|-------|------|------|
| `view.reports_session_notes` in me-permissions | PASS | PASS |
| `view.reports_data_collection` in me-permissions | PASS | PASS |
| Keys present in `rbac-matrix.php` | PASS | PASS |
| Role Access UI shows Session Notes + Data Collection Report (admin) | PASS (localhost:3000) | PASS (matrix via API; UI on :3001 also showed switches while logged against test due to `.env.local`) |

### Session Notes report API (30-day window)

| Check | Test | Prod |
|-------|------|------|
| `reports-session-notes.php` success | PASS (8 rows) | PASS (38 rows; 1 Scheduled / 37 Rendered) |
| Scheduled / Rendered `tab` field | PASS | PASS |
| Load notes via `session-notes.php` | PASS | PASS |
| Load appointment via `add-session.php?id=` | PASS | PASS for live sessions; orphaned note `session_id=3164` → 404 (session deleted; notes still load) |

### Data Collection report API

| Check | Test | Prod |
|-------|------|------|
| `reports-data-collection.php` | PASS | PASS (0–3 rows depending on window; endpoint healthy) |

### UI (localhost:3000 → test API)

| Check | Result |
|-------|--------|
| Sidebar: Session Notes + Data Collection Report | PASS |
| Tabs Scheduled / Rendered | PASS (0 / 8) |
| View notes → “View Session Notes” + CLOSE only | PASS |
| View appointment → Session Details | PASS |
| Note Preview column removed | PASS |
| OA submit endpoints called | SKIP / none |

## Issues found (non-OA)

1. **Prod wide date ranges blank:** `reports-session-notes.php` on prod returns HTTP 200 with **empty body** for windows ≥ ~90 days (30d OK). Likely PHP memory/time limit when decoding large payloads. Default UI window is 30 days — OK for normal use.
2. **Orphan session_id:** Notes can reference a deleted session; View Appointment correctly fails; View/Edit notes still work.
3. **Local prod UI override:** `.env.local` forces backend-test even for `dev:prod` on :3001.

## OA safety

Explicitly **not** called: `officeally-submit-claims.php`, `availity-submit-claims.php`.

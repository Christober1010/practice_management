# API status report — production backend

**Generated:** 2026-06-04 16:55 UTC  
**Base URL:** `https://www.mahabehavioralhealth.com/mahaverse-backend-logics`  
**CORS origin simulated:** `http://localhost:3000`  
**Auth user:** [christoberedward@gmail.com](mailto:christoberedward@gmail.com) (admin)  

## Summary


| Metric                                                                      | Count |
| --------------------------------------------------------------------------- | ----- |
| Endpoints tested                                                            | 53    |
| **GET pass with token (OK / OK_NEEDS_PARAMS / OK_POST_ONLY / OK_REDIRECT)** | 53    |
| GET fail with token                                                         | 0     |
| Unauthenticated GET open (200 on protected route)                           | 1     |


**Verdict: PASS (with one legacy exception)** — 52/52 current endpoints OK. `**get-clients-old.php`** returns 200 without token (legacy; not in `backend-test`; recommend removing from prod server).

## Legend


| With-token GET  | Meaning                           |
| --------------- | --------------------------------- |
| OK              | 200 JSON response                 |
| OK_NEEDS_PARAMS | 400 — missing query/body (normal) |
| OK_POST_ONLY    | 405 — POST-only endpoint          |
| FAIL_AUTH       | 401 with valid token              |
| FAIL_SERVER     | 500 — PHP/SQL error               |



| No-token GET     | Meaning                             |
| ---------------- | ----------------------------------- |
| OK_AUTH_REQUIRED | 401 — protected (expected)          |
| OK               | 200 — public endpoint               |
| OK               | 200 on protected — **security gap** |


## Per-endpoint results


| Endpoint                        | OPTIONS | GET no token           | GET + token | Token status    | Preview                                                                                                                |
| ------------------------------- | ------- | ---------------------- | ----------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `add-clients.php`               | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"Missing required field: id"}                                                               |
| `add-session-with-invite.php`   | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | [{"session_id":40,"client_id":"4434aa45-76f8-461b-a1b4-1a67058a9329","provider_i                                       |
| `add-session.php`               | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | [{"session_id":40,"client_id":"4434aa45-76f8-461b-a1b4-1a67058a9329","provider_i                                       |
| `behaviors.php`                 | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"data":{"categories":[],"behaviors":[]}}                                                               |
| `check-drive-status-simple.php` | 204     | 200 (OK)               | 200         | OK              | { "success": true, "timestamp": "2026-06-04 12:52:51", "environment"                                                   |
| `check-drive-status.php`        | 204     | 200 (OK)               | 200         | OK              | { "success": true, "timestamp": "2026-06-04 12:52:55", "environment"                                                   |
| `claims-cms1500-preview.php`    | 200     | 405 (OK_POST_ONLY)     | 405         | OK_POST_ONLY    | {"success":false,"message":"Method not allowed"}                                                                       |
| `client-behaviors.php`          | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"client_id is required"}                                                                    |
| `client-domain.php`             | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"Domain ID is required"}                                                                    |
| `client-modules.php`            | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"Client ID is required"}                                                                    |
| `client-program-detail.php`     | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"Program ID is required"}                                                                   |
| `client-programs.php`           | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"Client ID is required"}                                                                    |
| `client-target-detail.php`      | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"Target ID is required"}                                                                    |
| `client-target.php`             | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"Client ID is required"}                                                                    |
| `dashboard-stats.php`           | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"data":{"activeClients":18,"activeStaff":14,"sessionsToday":0,"p                                       |
| `diagnosis-codes.php`           | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"data":[{"id":"7688cc03-74d3-4721-a64b-1f48ee1bc7cd","diagnosis_                                       |
| `document-types.php`            | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"data":[{"id":"93515b4a-2861-11f1-9593-001a4a3501a4","type_name"                                       |
| `download-client-document.php`  | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"File ID is required"}                                                                      |
| `download-client-upload.php`    | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"path is required"}                                                                         |
| `drive_oauth_callback.php`      | 204     | 400 (OK_NEEDS_PARAMS)  | 400         | OK_NEEDS_PARAMS | Google Drive Connect Fai                                                                                               |
| `drive_oauth_start.php`         | 204     | 302 (OK_REDIRECT)      | 302         | OK_REDIRECT     | <meta http-equiv="refresh" cont                                                                                        |
| `facility-types.php`            | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"data":[{"id":"6a840b02-2861-11f1-9593-001a4a3501a4","pos_code":                                       |
| `get-all.php`                   | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"modules":[{"id":"skill-acquisition","client_id":"11082b15-ac5d-                                       |
| `get-clients-old.php`           | 200     | 200 (OK)               | 200         | OK              | {"success":true,"clients":[{"client_id":"11082b15-ac5d-4e7f-99f6-0f3bc08ba82b","                                       |
| `get-clients.php`               | 204     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"clients":[{"client_id":"11082b15-ac5d-4e7f-99f6-0f3bc08ba82b","                                       |
| `get-sessions.php`              | 204     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"sessions":[{"session_id":"48","client_id":"4434aa45-76f8-461b-a                                       |
| `get-users.php`                 | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"users":[{"id":58,"email":"[kittychristoflora@gmail.com](mailto:kittychristoflora@gmail.com)","role":" |
| `locations.php`                 | 204     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"data":[]}                                                                                             |
| `login.php`                     | 200     | 405 (OK_POST_ONLY)     | 405         | OK_POST_ONLY    | {"error":"Method not allowed"}                                                                                         |
| `logout.php`                    | 204     | 405 (OK_POST_ONLY)     | 405         | OK_POST_ONLY    | {"success":false,"message":"Method not allowed"}                                                                       |
| `me-permissions.php`            | 204     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"role":"admin","scope":"mahaverse","permissions":["nav.dashboard                                       |
| `payer-payment-entries.php`     | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"data":[{"id":7,"report_id":27,"client_id":"196dec13-9487-4880-8                                       |
| `programs.php`                  | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"data":{"modules":[],"domains":[{"id":"domain_1771168876785_h0mn                                       |
| `provider-service-codes.php`    | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"data":[{"id":"121e5d66-916c-49e7-8aa2-b62be0c1fa83","provider_i                                       |
| `providers.php`                 | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"data":[{"id":"2823dc1c-3847-453a-a511-39a646c0ec97","provider_n                                       |
| `rbac-catalog.php`              | 204     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"permissions":[{"id":1,"perm_key":"nav.dashboard","label":"Dashb                                       |
| `rbac-matrix.php`               | 204     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"scope":"mahaverse","permissions":[{"id":1,"perm_key":"nav.dashb                                       |
| `rbac-save-role.php`            | 204     | 405 (OK_POST_ONLY)     | 405         | OK_POST_ONLY    | {"success":false,"message":"Method not allowed"}                                                                       |
| `reports.php`                   | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"data":[{"id":132,"client_id":"196dec13-9487-4880-8950-b7aa24a83                                       |
| `reset-password-with-otp.php`   | 204     | 400 (OK_NEEDS_PARAMS)  | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"Invalid JSON"}                                                                             |
| `send-otp.php`                  | 204     | 400 (OK_NEEDS_PARAMS)  | 400         | OK_NEEDS_PARAMS | {"success":false,"error":"Valid email is required"}                                                                    |
| `service-codes.php`             | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"data":[{"code_id":5,"code":"97151","code_description":"Behavior                                       |
| `session-notes.php`             | 204     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"client_id is required"}                                                                    |
| `staff.php`                     | 204     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"staff_records":[{"id":"ST1776101508407cvkmd","firstName":"Chris                                       |
| `treatment-types.php`           | 200     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"success":true,"data":[{"id":"829be0f4-2861-11f1-9593-001a4a3501a4","treatment_                                       |
| `update-clients.php`            | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"Missing required field: client_id"}                                                        |
| `update-users.php`              | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"Missing required field: email"}                                                            |
| `upload-client-document.php`    | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"No file uploaded or upload error"}                                                         |
| `upload-staff-document.php`     | 204     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"No file uploaded or upload error"}                                                         |
| `verify-otp.php`                | 204     | 400 (OK_NEEDS_PARAMS)  | 400         | OK_NEEDS_PARAMS | {"success":false,"error":"Invalid JSON"}                                                                               |
| `verify.php`                    | 204     | 401 (OK_AUTH_REQUIRED) | 200         | OK              | {"valid":true,"success":true,"user":{"id":9,"username":"[christoberedward@gmail.c](mailto:christoberedward@gmail.c)    |
| `view-client-document.php`      | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"File ID is required"}                                                                      |
| `view-client-upload.php`        | 200     | 401 (OK_AUTH_REQUIRED) | 400         | OK_NEEDS_PARAMS | {"success":false,"message":"path is required"}                                                                         |


## Action required

- **get-clients-old.php** — returns **200 without token** (should be 401)

## Excluded

Helpers (`config.php`, `db.php`, `*_helpers.php`), dev/backup scripts, `health-auth.php`.

## Raw data

`[.api-status-prod-latest.tsv](.api-status-prod-latest.tsv)`

## Regenerate

```bash
TOKEN=$(curl -sS -X POST "https://www.mahabehavioralhealth.com/mahaverse-backend-logics/login.php" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' | jq -r .token)
MAHAVERSE_API_BASE_TEST=https://www.mahabehavioralhealth.com/mahaverse-backend-logics \
TOKEN=$TOKEN bash scripts/generate-api-status-report.sh
```


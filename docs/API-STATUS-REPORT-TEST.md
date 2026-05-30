# API status report — test backend

**Generated:** 2026-05-30 17:47 UTC (batch) · add-clients re-verified 17:48 UTC  
**Base URL:** `https://www.mahabehavioralhealth.com/mahaverse-backend-test`  
**CORS origin simulated:** `http://localhost:3000`  
**Token provided:** yes

## Summary

| Metric | Count |
|--------|------:|
| Endpoints tested | 52 |
| GET pass (OK / OK_NEEDS_PARAMS / OK_POST_ONLY) | 52 |
| GET fail | 0 |
| GET warn / other | 0 |
| CORS issues | 0 |

**Deploy UI when:** CORS issues = 0 and GET fail = 0 (OK_NEEDS_PARAMS is fine).

**Verdict: Ready for UI deploy** (all 52 endpoints pass; `add-clients.php` re-verified after transient batch timeout).

## Legend

| GET status | Meaning |
|------------|---------|
| OK | 200 with response body |
| OK_NEEDS_PARAMS | 400 — needs query/body on GET (normal) |
| OK_POST_ONLY | 405 — POST-only endpoint |
| FAIL_AUTH | 401 with token |
| FAIL_SERVER | 500 — PHP/SQL error |
| FAIL_NOT_FOUND | 404 — not on server |

| CORS status | Meaning |
|-------------|---------|
| OK | Preflight allows Origin + X-Auth-Token |
| FAIL_MISSING_X_AUTH_TOKEN | localhost browser will block |
| FAIL_PREFLIGHT_401 | OPTIONS blocked by auth |
| FAIL_NO_CORS | No Allow-Origin on OPTIONS |

## Per-endpoint results

| Endpoint | OPTIONS | CORS | GET | GET status | Preview |
|----------|---------|------|-----|------------|---------|
| `add-clients.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"Missing required field: id"}  |
| `add-session.php` | 200 | OK | 200 | OK | [{"session_id":248,"client_id":"ae97aa29-b87b-49fe-926e-740c192fdb69","provider_id":"ST68d811174a019","provider_name":"C |
| `add-session-with-invite.php` | 200 | OK | 200 | OK | [{"session_id":248,"client_id":"ae97aa29-b87b-49fe-926e-740c192fdb69","provider_id":"ST68d811174a019","provider_name":"C |
| `behaviors.php` | 200 | OK | 200 | OK | {"success":true,"data":{"categories":[{"id":"bcat_1779634022735_fu93y1w","name":"ANTECEDENTS","description":"ANTECEDENTS |
| `check-drive-status.php` | 204 | OK | 200 | OK | {     "success": true,     "timestamp": "2026-05-30 13:47:48",     "environment": "test",     "environment_vars": {      |
| `check-drive-status-simple.php` | 204 | OK | 200 | OK | {     "success": true,     "timestamp": "2026-05-30 13:47:51",     "environment": "test",     "server_info": {         " |
| `claims-cms1500-preview.php` | 200 | OK | 405 | OK_POST_ONLY | {"success":false,"message":"Method not allowed"}  |
| `client-behaviors.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"client_id is required"}  |
| `client-domain.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"Domain ID is required"}  |
| `client-modules.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"Client ID is required"}  |
| `client-program-detail.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"Program ID is required"}  |
| `client-programs.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"Client ID is required"}  |
| `client-target-detail.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"Target ID is required"}  |
| `client-target.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"Client ID is required"}  |
| `dashboard-stats.php` | 200 | OK | 200 | OK | {"success":true,"data":{"activeClients":31,"activeStaff":29,"sessionsToday":1,"pendingSessions":0,"upcomingSessions":10, |
| `diagnosis-codes.php` | 200 | OK | 200 | OK | {"success":true,"data":[{"id":"b5e15eaf-21f4-4aa6-92b3-eaa5645736e8","diagnosis_code":"F152","diagnosis_description":"Do |
| `document-types.php` | 200 | OK | 200 | OK | {"success":true,"data":[{"id":"7ba64847-22e1-11f1-b81e-001a4a35005f","type_name":"Assessment Report","description":"Asse |
| `download-client-document.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"File ID is required"}  |
| `download-client-upload.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"path is required"}  |
| `drive_oauth_callback.php` | 204 | OK | 400 | OK_NEEDS_PARAMS | <!doctype html><html><head><meta charset="utf-8"><title>Google Drive Connect Failed</title></head><body style="font-fami |
| `drive_oauth_start.php` | 204 | OK | 302 | OK_REDIRECT | <!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=https://accounts.google.com/o |
| `facility-types.php` | 200 | OK | 200 | OK | {"success":true,"data":[{"id":"1ffa19e3-204d-11f1-b81e-001a4a35005f","pos_code":"01","facility_name":"Pharmacy","descrip |
| `get-all.php` | 200 | OK | 200 | OK | {"success":true,"modules":[{"id":"module_1765497774432","client_id":"d71c12a8-dce8-4e56-82cf-25d404f74375","name":"Clien |
| `get-clients.php` | 204 | OK | 200 | OK | {"success":true,"clients":[{"client_id":"83179664-2462-4e7f-ac56-083ea1389051","client_uuid":"2478721830938704","client_ |
| `get-sessions.php` | 204 | OK | 200 | OK | {"success":true,"sessions":[{"session_id":"363","client_id":"07eb3ea1-dc1e-4a3f-8002-db53fb438c45","provider_id":"ST69b8 |
| `get-users.php` | 200 | OK | 200 | OK | {"success":true,"users":[{"id":60,"email":"biller@maha.com","role":"biller","first_name":"Biller","last_name":"Test","is |
| `locations.php` | 204 | OK | 200 | OK | {"success":true,"data":[{"id":"257b44e9-3824-4534-ba84-6e309dac0f34","tax_id_professional":"Aspernatur non sunt","office |
| `login.php` | 200 | OK | 405 | OK_POST_ONLY | {"error":"Method not allowed"}  |
| `logout.php` | 204 | OK | 405 | OK_POST_ONLY | {"success":false,"message":"Method not allowed"}  |
| `me-permissions.php` | 204 | OK | 200 | OK | {"success":true,"role":"admin","scope":"mahaverse","permissions":["nav.dashboard","nav.scheduling","nav.clients","nav.st |
| `payer-payment-entries.php` | 200 | OK | 200 | OK | {"success":true,"data":[{"id":2,"report_id":47,"client_id":"ae97aa29-b87b-49fe-926e-740c192fdb69","insurance_id":417,"do |
| `programs.php` | 200 | OK | 200 | OK | {"success":true,"data":{"modules":[{"id":"1fee343d-0190-4228-934f-a2bc34cd14f0","NAME":"Test Module","description":"","S |
| `provider-service-codes.php` | 200 | OK | 200 | OK | {"success":true,"data":[{"id":"d92d34f6-f0de-4574-9cb2-f87c9bc09d46","provider_id":"e7c15923-dcf1-4c1f-93b3-58dc322779e5 |
| `providers.php` | 200 | OK | 200 | OK | {"success":true,"data":[{"id":"190035e4-8023-4631-aab9-2db562ae02cc","provider_name":"Meridian","provider_code":"12MN"," |
| `rbac-catalog.php` | 204 | OK | 200 | OK | {"success":true,"permissions":[{"id":1,"perm_key":"nav.dashboard","label":"Dashboard (menu)","perm_group":"mahaverse_nav |
| `rbac-matrix.php` | 204 | OK | 200 | OK | {"success":true,"scope":"mahaverse","permissions":[{"id":1,"perm_key":"nav.dashboard","label":"Dashboard (menu)","perm_g |
| `rbac-save-role.php` | 204 | OK | 405 | OK_POST_ONLY | {"success":false,"message":"Method not allowed"}  |
| `reports.php` | 200 | OK | 200 | OK | {"success":true,"data":[{"id":49,"client_id":null,"provider_id":null,"client_first_name":null,"client_last_name":" ","cl |
| `reset-password-with-otp.php` | 200 | OK | 200 | OK | {"success":false,"message":"Email and new password required"}  |
| `send-otp.php` | 204 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"error":"Valid email is required"}  |
| `service-codes.php` | 200 | OK | 200 | OK | {"success":true,"data":[{"code_id":1,"code":"97151","code_description":"Behavior Identification Assessment","created_at" |
| `session-notes.php` | 204 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"client_id is required"}  |
| `staff.php` | 204 | OK | 200 | OK | {"success":true,"staff_records":[{"id":"ST17741457376007vuud","firstName":"Mani","lastName":"rbt","fullName":"Mani rbt", |
| `treatment-types.php` | 200 | OK | 200 | OK | {"success":true,"data":[{"id":"7472349e-22e1-11f1-b81e-001a4a35005f","treatment_name":"ABA Therapy","description":"Appli |
| `update-clients.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"Missing required field: client_id"}  |
| `update-users.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"Missing required field: email"}  |
| `upload-client-document.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"No file uploaded or upload error"}  |
| `upload-staff-document.php` | 204 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"No file uploaded or upload error"}  |
| `verify-otp.php` | 204 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"error":"Invalid JSON"}  |
| `verify.php` | 204 | OK | 200 | OK | {"valid":true,"success":true,"user":{"id":9,"username":"christoberedward@gmail.com","role":"admin"}}  |
| `view-client-document.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"File ID is required"}  |
| `view-client-upload.php` | 200 | OK | 400 | OK_NEEDS_PARAMS | {"success":false,"message":"path is required"}  |

## Action required (failures only)

None — all endpoints pass.

## Excluded

Includes/helpers (`config.php`, `db.php`, `*_helpers.php`) and dev/backup scripts.

## Regenerate

```bash
TOKEN=<aba_token> bash scripts/generate-api-status-report.sh
```

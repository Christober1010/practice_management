# Production API audit

**Base URL:** `https://www.mahabehavioralhealth.com/mahaverse-backend-logics/`  
**Last run:** 2026-05-30 (unauthenticated smoke test: `OPTIONS` + bare `GET`)

Update **OPTIONS** / **GET** after each deploy. `GET` without auth/body often returns **400** when the route is fine but expects POST/JSON.

---

## All endpoints

| Endpoint | OPTIONS | GET | Notes |
|----------|---------|-----|-------|
| `add-clients.php` | 200 | 400 | Needs POST/body |
| `add-session.php` | 200 | 200 | |
| `add-session-with-invite.php` | 200 | 200 | |
| `behavior_helpers.php` | 200 | 200 | Include only — block public access |
| `behaviors.php` | 200 | 200 | |
| `check-drive-status.php` | 200 | 200 | |
| `check-drive-status-simple.php` | 200 | 200 | |
| `claims-cms1500-preview.php` | 200 | 405 | POST expected |
| `client_auth_units_helpers.php` | 200 | 200 | Include only — block public access |
| `client-behaviors.php` | 200 | 400 | Needs params |
| `client-domain.php` | 200 | 400 | Needs params |
| `client-modules.php` | 200 | 400 | Needs params |
| `client-program-detail.php` | 200 | 400 | Needs params |
| `client-programs.php` | 200 | 400 | Needs params |
| `clients-modules-backup.php` | 200 | 400 | Needs params |
| `client-target.php` | 200 | 400 | Needs params |
| `client-target-detail.php` | 200 | 400 | Needs params |
| `create-wrapper.php` | 404 | 404 | Not deployed |
| `dashboard-stats.php` | 200 | 200 | |
| `diagnosis-codes.php` | 200 | 200 | |
| `document-types.php` | 200 | 200 | |
| `download-client-document.php` | 200 | 400 | Needs params |
| `download-client-upload.php` | 200 | 400 | Needs params |
| `drive_oauth_callback.php` | 405 | 400 | OAuth callback |
| `drive_oauth_start.php` | 405 | 302 | Redirect to Google |
| `facility-types.php` | 200 | 200 | |
| `get-all.php` | 200 | 200 | |
| `get-clients.php` | 204 | 200 | |
| `get-clients-old.php` | 200 | 200 | Legacy |
| `get-sessions.php` | 200 | **500** | Wrong DB in file — fix deploy |
| `get-users.php` | 200 | 200 | |
| `locations.php` | 200 | 200 | |
| `login.php` | 200 | 405 | POST expected |
| `me-permissions.php` | 200 | 401 | Auth required |
| `oauth-debug.php` | 404 | 404 | Not deployed |
| `payer-payment-entries.php` | 200 | 200 | |
| `programs.php` | 200 | 200 | |
| `programs-dev.php` | 200 | 200 | Dev script on prod |
| `provider-service-codes.php` | 200 | 200 | |
| `providers.php` | 200 | 200 | |
| `rbac-catalog.php` | 200 | 200 | |
| `rbac-matrix.php` | 200 | 401 | Auth required |
| `rbac-save-role.php` | 200 | 405 | POST expected |
| `reports.php` | 200 | 200 | |
| `reports-old.php` | 200 | 200 | Legacy |
| `reset-password-with-otp.php` | 200 | 200 | |
| `send-otp.php` | 204 | 400 | Needs POST/body |
| `service-codes.php` | 200 | 200 | |
| `session-notes.php` | 200 | 400 | Needs params |
| `sso_login.php` | 404 | 404 | Not deployed |
| `staff.php` | 204 | 200 | |
| `staff-backup.php` | 200 | 200 | Legacy |
| `test.php` | 404 | 404 | Not deployed |
| `test-simple.php` | 404 | 404 | Not deployed |
| `treatment-types.php` | 200 | 200 | |
| `update-clients.php` | 200 | 400 | Needs POST/body |
| `update-users.php` | 200 | 400 | Needs POST/body |
| `upload-client-document.php` | 200 | 400 | Needs POST/multipart |
| `upload-staff-document.php` | 204 | 400 | Needs POST/multipart |
| `verify.php` | 200 | 401 | Auth required |
| `verify-otp.php` | 204 | 400 | Needs POST/body |
| `view-client-document.php` | 200 | 400 | Needs params |
| `view-client-upload.php` | 200 | 400 | Needs params |

**Excluded from ping** (not HTTP entrypoints): `config.php`, `db.php`, `rbac_helpers.php`, `drive_helper.php`

---

## Summary (GET)

| GET status | Count | Meaning |
|------------|-------|---------|
| 200 | 27 | OK without params (or dev/legacy) |
| 400 | 22 | Route OK — needs body/params |
| 401 | 3 | Auth required |
| 405 | 3 | Wrong method for GET |
| 404 | 5 | Not on server |
| 500 | 1 | **Broken** — `get-sessions.php` |
| 302 | 1 | Redirect — `drive_oauth_start.php` |

---

## Action items

| Priority | Endpoint | Action |
|----------|----------|--------|
| High | `get-sessions.php` | Point at prod Mahaverse DB + current `sessions` schema (or remove from UI) |
| Medium | `behavior_helpers.php`, `client_auth_units_helpers.php` | Deny web access (includes) |
| Low | `create-wrapper.php`, `oauth-debug.php`, `sso_login.php`, `test*.php` | Deploy or drop references |

---

## Re-run ping

```bash
bash .cursor/skills/mahaverse-api-db-audit/scripts/ping-endpoints.sh \
  --prod-base "https://www.mahabehavioralhealth.com/mahaverse-backend-logics" \
  --test-base "https://www.mahabehavioralhealth.com/mahaverse-backend-test" \
  --get
```

Paste results into the table above after each run.

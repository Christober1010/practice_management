# API audit — test

**Environment:** test — backend-test/ tree vs test base URL

**Base URL:** `https://www.mahabehavioralhealth.com/mahaverse-backend-test`

**Generated:** 2026-04-20 16:59:35 UTC

## Summary

| Check | OK-ish | Other |
|-------|--------|-------|
| OPTIONS (2xx = 200, 204) | 45 | 11 |
| GET (non-fatal: 400, 401, 403, 405, 2xx) | 46 | 10 |

*`000` = timeout or network failure; `404` = missing path or deploy.*

## HTTP smoke (OPTIONS / GET)

| Script | OPTIONS | GET |
|--------|---------|-----|
| `add-clients.php` | 200 | 400 |
| `add-session.php` | 200 | 200 |
| `add-session-with-invite.php` | 404 | 404 |
| `check-drive-status.php` | 200 | 200 |
| `check-drive-status-simple.php` | 200 | 200 |
| `client-domain.php` | 200 | 400 |
| `client-modules.php` | 200 | 400 |
| `client-program-detail.php` | 404 | 404 |
| `client-programs.php` | 200 | 400 |
| `clients-modules-backup.php` | 404 | 404 |
| `client-target-detail.php` | 200 | 400 |
| `client-target.php` | 200 | 400 |
| `create-wrapper.php` | 200 | 200 |
| `dashboard-stats.php` | 200 | 200 |
| `diagnosis-codes.php` | 200 | 200 |
| `document-types.php` | 200 | 200 |
| `download-client-document.php` | 200 | 400 |
| `download-client-upload.php` | 200 | 400 |
| `drive_oauth_callback.php` | 405 | 400 |
| `drive_oauth_start.php` | 405 | 302 |
| `facility-types.php` | 200 | 200 |
| `get-all.php` | 200 | 200 |
| `get-clients.php` | 204 | 200 |
| `get-sessions.php` | 404 | 404 |
| `get-users.php` | 200 | 200 |
| `locations.php` | 200 | 200 |
| `login.php` | 200 | 405 |
| `me-permissions.php` | 200 | 401 |
| `oauth-debug.php` | 404 | 404 |
| `programs-dev.php` | 404 | 404 |
| `programs.php` | 200 | 200 |
| `provider-service-codes.php` | 200 | 200 |
| `providers.php` | 200 | 200 |
| `rbac-catalog.php` | 200 | 200 |
| `rbac-matrix.php` | 200 | 401 |
| `rbac-save-role.php` | 200 | 405 |
| `reports-old.php` | 404 | 404 |
| `reports.php` | 200 | 200 |
| `reset-password-with-otp.php` | 200 | 200 |
| `send-otp.php` | 204 | 400 |
| `service-codes.php` | 200 | 200 |
| `session-notes.php` | 200 | 400 |
| `sso_login.php` | 404 | 404 |
| `staff-backup.php` | 404 | 404 |
| `staff.php` | 200 | 200 |
| `test.php` | 200 | 200 |
| `test-simple.php` | 200 | 200 |
| `treatment-types.php` | 200 | 200 |
| `update-clients.php` | 200 | 400 |
| `update-users.php` | 200 | 400 |
| `upload-client-document.php` | 200 | 400 |
| `upload-staff-document.php` | 200 | 400 |
| `verify-otp.php` | 204 | 400 |
| `verify.php` | 200 | 401 |
| `view-client-document.php` | 200 | 400 |
| `view-client-upload.php` | 200 | 400 |

## Database wiring — `backend-test/` only (test DB)

Static scan of repo entrypoints for **this environment’s tree only** — no cross-environment rows.

Host / `dbname` literals (see `note` for includes / `getDBConnection`).

| Area | File | Host | Database | Note |
|------|------|------|----------|------|
| backend-test | `add-clients.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `add-session.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `add-session-with-invite.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `check-drive-status.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `check-drive-status-simple.php` | — | — | uses_getDBConnection |
| backend-test | `client-domain.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `client-modules.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `client-program-detail.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `client-programs.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `clients-modules-backup.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `client-target-detail.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `client-target.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `create-wrapper.php` | — | — | unknown |
| backend-test | `dashboard-stats.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `diagnosis-codes.php` | — | — | unknown |
| backend-test | `document-types.php` | — | — | unknown |
| backend-test | `download-client-document.php` | — | — | includes_config |
| backend-test | `download-client-upload.php` | — | — | unknown |
| backend-test | `drive_oauth_callback.php` | — | — | uses_getDBConnection |
| backend-test | `drive_oauth_start.php` | — | — | includes_config |
| backend-test | `facility-types.php` | — | — | unknown |
| backend-test | `get-all.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `get-clients.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `get-sessions.php` | db5018419668.hosting-data.io | — | — |
| backend-test | `get-users.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `locations.php` | — | — | unknown |
| backend-test | `login.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `me-permissions.php` | — | — | includes_config |
| backend-test | `oauth-debug.php` | — | — | includes_config |
| backend-test | `programs-dev.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `programs.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `provider-service-codes.php` | — | — | unknown |
| backend-test | `providers.php` | — | — | unknown |
| backend-test | `rbac-catalog.php` | — | — | uses_getDBConnection |
| backend-test | `rbac-matrix.php` | — | — | uses_getDBConnection |
| backend-test | `rbac-save-role.php` | — | — | uses_getDBConnection |
| backend-test | `reports-old.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `reports.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `reset-password-with-otp.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `send-otp.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `service-codes.php` | — | — | unknown |
| backend-test | `session-notes.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `sso_login.php` | {$host} | {$dbname} | env |
| backend-test | `staff-backup.php` | — | — | unknown |
| backend-test | `staff.php` | — | — | includes_config |
| backend-test | `test.php` | — | — | unknown |
| backend-test | `test-simple.php` | — | — | unknown |
| backend-test | `treatment-types.php` | — | — | unknown |
| backend-test | `update-clients.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `update-users.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `upload-client-document.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `upload-staff-document.php` | — | — | includes_config |
| backend-test | `verify-otp.php` | db5018419668.hosting-data.io | dbs14649042 | — |
| backend-test | `verify.php` | $host | $dbname | — |
| backend-test | `view-client-document.php` | — | — | includes_config |
| backend-test | `view-client-upload.php` | — | — | unknown |

---

Regenerate: `npm run test:test` or `npm run test`

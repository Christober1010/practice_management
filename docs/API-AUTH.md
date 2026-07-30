# Backend-test API authentication

Mandatory Bearer token auth on all business endpoints. Login issues tokens stored in `AuthTokens` ([`migration/shared/20260405_113210_create_auth_tokens_table.sql`](../migration/shared/20260405_113210_create_auth_tokens_table.sql)).

**Prerequisite:** Run migration on test DB — see [AUTH-PREREQ-TEST.md](AUTH-PREREQ-TEST.md).

## Headers (send both)

| Header | Value |
|--------|--------|
| `Authorization` | `Bearer <token>` |
| `X-Auth-Token` | `<token>` (fallback when host strips Authorization) |

Token from `login.php` response → stored in browser as `localStorage.aba_token`.

Frontend: use [`lib/mahaverse-api.js`](../lib/mahaverse-api.js) (`mahaverseFetch`) — attaches headers and redirects to login on 401.

## Public endpoints (no token)

| File | Purpose |
|------|---------|
| `login.php` | Issue token |
| `send-otp.php`, `verify-otp.php`, `reset-password-with-otp.php` | Password reset |
| `drive_oauth_start.php`, `drive_oauth_callback.php` | Google Drive OAuth |
| `check-drive-status.php`, `check-drive-status-simple.php` | Ops diagnostics |
| `sso_login.php` | Legacy / unused |

## Auth helpers ([`backend-test/config.php`](../backend-test/config.php))

- `requireUser()` — 401 if missing/invalid/expired token
- `requireAuth($permissionKey)` — requireUser + 403 if RBAC denies
- `requireAuthReadWrite($read, $write)` — method-aware permission
- `requireAuthAny([...])` — any one permission suffices

## Helper includes (`*_helpers.php`)

`config.php` already loads `rbac_helpers.php`. For other helpers, **always auth first**, then lazy-load:

```php
require_once __DIR__ . '/config.php';
$authUser = requireAuth('clients.read', 'mahaverse');
mahaverse_require_helper('client_auth_units_helpers'); // or behavior_helpers, drive_helper
```

Never call helper functions (e.g. `client_auth_enrich_authorizations_pdo`) without `mahaverse_require_helper()` — undefined-function fatals produce empty 500 responses.

Files using optional helpers today: `get-clients.php`, `session-notes.php`, `behaviors.php`, `client-behaviors.php`.

## Permission map (backend-test)

| Area | Files | Permission |
|------|-------|------------|
| Clients | `get-clients.php` | `clients.read` |
| Clients | `add-clients.php` | `clients.create` OR `clients.write` |
| Clients | `update-clients.php` | `clients.update` OR `clients.write` |
| Clients | `client-*.php`, uploads/downloads/views | `clients.read` / `clients.update` / `master_data.*` |
| Users | `get-users.php`, `update-users.php` | `users.read`, `users.write` |
| Staff | `staff.php`, `upload-staff-document.php` | `staff.read` / `staff.write` |
| Scheduling | `add-session.php`, `add-session-with-invite.php`, `get-sessions.php` | `scheduling.read` / `scheduling.write` |
| Session notes | `session-notes.php` | `scheduling.session.notes` |
| Master data | `programs.php`, `behaviors.php`, `client-modules.php`, … | `master_data.read` / `master_data.write` |
| Manage data | `locations.php`, `providers.php`, `service-codes.php`, … | `manage_data.read` / `manage_data.write` |
| Reports | `reports.php`, `dashboard-stats.php` | `reports.read` |
| Billing | `claims-cms1500-preview.php` | `billing.read` |
| RBAC admin | `rbac-matrix.php`, `rbac-save-role.php` | `requireUser()` + admin role |
| RBAC | `me-permissions.php`, `rbac-catalog.php`, `verify.php` | `requireUser()` |
| Logout | `logout.php` | `requireUser()` (POST) |

Keys align with [`lib/rbac-permission-keys.js`](../lib/rbac-permission-keys.js).

## Blocked from direct web access

Via [`backend-test/.htaccess`](../backend-test/.htaccess): `config.php`, `db.php`, `*_helpers.php`.

## Smoke test

```bash
bash scripts/auth-smoke-test.sh
TOKEN=<aba_token> bash scripts/auth-smoke-test.sh
```

## Deploy checklist (test)

1. Apply `AuthTokens` migration if missing
2. Deploy `backend-test/` PHP
3. Deploy frontend build with `mahaverseFetch` changes
4. Run auth smoke script
5. Manual: login → clients → scheduling → reports

Prod (`backend/`) — mirror after test validation (out of scope for this pass).

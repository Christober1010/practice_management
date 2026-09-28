# Launchpad Java API parity checklist

Production PHP endpoints → Java (`/api/v1/...` and `/backend/*.php` aliases).

| Domain | PHP | Java | Status |
|--------|-----|------|--------|
| Auth | `login.php` | `POST /api/v1/auth/login` | Done |
| Auth | `logout.php` | `POST /api/v1/auth/logout` | Done |
| Auth | `send-otp.php` | `POST /api/v1/auth/send-otp` | Done |
| Auth | `verify-otp.php` | `POST /api/v1/auth/verify-otp` | Done |
| Auth | `reset-password-with-otp.php` | `POST /api/v1/auth/reset-password` | Done |
| Auth | `create_user.php` | `POST /api/v1/users` | Done |
| Auth | `get_csrf.php` | `GET /api/v1/csrf` | Done |
| Me | `me-permissions.php` | `GET /api/v1/me/permissions` | Done |
| RBAC | `rbac-catalog.php` | `GET /api/v1/rbac/catalog` | Done |
| RBAC | `rbac-matrix.php` | `GET /api/v1/rbac/matrix` | Done |
| RBAC | `rbac-save-role.php` | `POST /api/v1/rbac/roles` | Done |
| Staff | `list_staff.php` | `GET /api/v1/staff` | Done |
| Staff | `submit_form.php` | `POST /api/v1/staff/submissions` | Done |
| Staff | `create_share_key.php` | `POST /api/v1/staff/share-keys` | Done |
| Staff | `send_reminder.php` | `POST /api/v1/staff/reminders` | Done |
| Staff | `download_attachment.php` | `GET /api/v1/staff/attachments/{id}/download` | Done |
| Staff | `view_attachment.php` | `GET /api/v1/staff/attachments/{id}/view` | Done |
| Offers | `offer_positions_get.php` | `GET /api/v1/offers/positions` | Done |
| Offers | `offer_initiation_get.php` | `GET /api/v1/offers/initiations` | Done |
| Offers | `offer_initiation_submit.php` | `POST /api/v1/offers/initiations` | Done |
| Offers | `offer_acceptance_get.php` | `GET /api/v1/offers/acceptances` | Done |
| Offers | `offer_acceptance_submit.php` | `POST /api/v1/offers/acceptances` | Done |
| Offers | `offer_acceptance_upload_signed_offer.php` | `POST /api/v1/offers/acceptances/signed-pdf` | Done |
| Intake | `submit_client_intake.php` | `POST /api/v1/client-intake` | Done |
| Drive | `drive_oauth_start.php` | `GET /api/v1/drive/oauth/start` | Done (stub without credentials) |
| Drive | `drive_oauth_link.php` | `GET /api/v1/drive/oauth/link` | Done (stub) |
| Drive | `drive_oauth_status.php` | `GET /api/v1/drive/oauth/status` | Done (stub) |
| Drive | `drive_oauth_disconnect.php` | `POST /api/v1/drive/oauth/disconnect` | Done (stub) |
| Drive | `drive_oauth_callback.php` | `GET /api/v1/drive/callback` | Done (stub) |
| Health | n/a | `GET /actuator/health`, `GET /version` | Done |

## Out of scope

Debug/test/ops PHP: `debug_*`, `test_*`, `check_*`, `diagnose_*`, `migrate_*`, `recover_*`, `verify_offer_signatures`, `sso_login` (deferred).

## SSO

Deferred until Mahaverse Java migration. Standalone login only.

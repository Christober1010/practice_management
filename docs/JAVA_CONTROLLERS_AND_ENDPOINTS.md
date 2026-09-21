## Purpose

This document lists the **planned Spring Boot controllers** and their **REST endpoints** for the Java rewrite.

- Mahaverse API base: `/api/v1`
- Launchpad API base: `/launchpad/api/v1` (**Future**, not part of Phase 1)

Notes:
- Endpoints are grouped by domain to keep code stable and testable.
- A few items are marked **(Later)** because they depend on heavier integrations (Drive/SFTP/EDI).

---

## Cross-cutting (shared)

### `HealthController`
- `GET /version`
- `GET /actuator/health` (via Spring Actuator)

---

## Mahaverse controllers (`/api/v1`)

### Auth & identity

#### `AuthController`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/verify`

#### `MeController`
- `GET /api/v1/me`
- `GET /api/v1/me/permissions`

### Lookups (read-only first)

#### `LookupsController`
- `GET /api/v1/lookups/service-codes`
- `GET /api/v1/lookups/service-code-rules`
- `GET /api/v1/lookups/diagnosis-codes`
- `GET /api/v1/lookups/providers`
- `GET /api/v1/lookups/provider-service-codes`
- `GET /api/v1/lookups/locations`
- `GET /api/v1/lookups/facility-types`
- `GET /api/v1/lookups/treatment-types`
- `GET /api/v1/lookups/document-types`

### Clients

#### `ClientsController`
- `GET /api/v1/clients` (supports RBAC scope filtering)
- `POST /api/v1/clients`
- `GET /api/v1/clients/{clientId}`
- `PATCH /api/v1/clients/{clientId}`
- `POST /api/v1/clients/{clientId}/archive` (or `PATCH` with state)
- `POST /api/v1/clients/{clientId}/unarchive` (or `PATCH` with state)

#### `ClientInsurancesController`
- `GET /api/v1/clients/{clientId}/insurances`
- `POST /api/v1/clients/{clientId}/insurances`
- `PATCH /api/v1/clients/{clientId}/insurances/{insuranceId}`
- `DELETE /api/v1/clients/{clientId}/insurances/{insuranceId}`

#### `ClientAuthorizationsController`
- `GET /api/v1/clients/{clientId}/authorizations`
- `POST /api/v1/clients/{clientId}/authorizations`
- `PATCH /api/v1/clients/{clientId}/authorizations/{authorizationId}`
- `DELETE /api/v1/clients/{clientId}/authorizations/{authorizationId}`

#### `ClientDocumentsController` (Later if Drive/storage needs time)
- `GET /api/v1/clients/{clientId}/documents`
- `POST /api/v1/clients/{clientId}/documents` (multipart upload)
- `GET /api/v1/clients/{clientId}/documents/{documentId}`
- `DELETE /api/v1/clients/{clientId}/documents/{documentId}`

#### `ClientAvailabilityController`
- `GET /api/v1/clients/{clientId}/availability`
- `PUT /api/v1/clients/{clientId}/availability`

### Scheduling (high value)

#### `SessionsController`
- `GET /api/v1/sessions` (filters: `clientId`, `providerId`, `date`, range)
- `POST /api/v1/sessions` (create + recurring)
- `GET /api/v1/sessions/{sessionId}`
- `PATCH /api/v1/sessions/{sessionId}` (respects “completed session lock” rules)
- `POST /api/v1/sessions/import` (Excel import)

#### `SessionNotesController`
- `GET /api/v1/sessions/{sessionId}/notes`
- `POST /api/v1/sessions/{sessionId}/notes`
- `PATCH /api/v1/sessions/{sessionId}/notes/{noteId}`
- `DELETE /api/v1/sessions/{sessionId}/notes/{noteId}`

#### `SessionLogController`
- `GET /api/v1/session-log`

### Staff

#### `StaffController`
- `GET /api/v1/staff` (supports `scope=assigned` style filters)
- `POST /api/v1/staff`
- `GET /api/v1/staff/{staffId}`
- `PATCH /api/v1/staff/{staffId}`

#### `StaffDocumentsController` (Later if Drive/storage needs time)
- `GET /api/v1/staff/{staffId}/documents`
- `POST /api/v1/staff/{staffId}/documents` (multipart upload)
- `DELETE /api/v1/staff/{staffId}/documents/{documentId}`

### Users / RBAC admin

#### `UsersController`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `GET /api/v1/users/{userId}`
- `PATCH /api/v1/users/{userId}`
- `DELETE /api/v1/users/{userId}`

#### `PasswordResetController`
- `POST /api/v1/auth/send-otp`
- `POST /api/v1/auth/verify-otp`
- `POST /api/v1/auth/reset-password`

#### `RbacController`
- `GET /api/v1/rbac/catalog`
- `GET /api/v1/rbac/matrix`
- `POST /api/v1/rbac/roles/{roleName}` (save role grants)

### Reports

#### `ReportsController`
- `GET /api/v1/reports/dashboard-stats`
- `GET /api/v1/reports/session-log`
- `GET /api/v1/reports/insurance-utilization`
- `GET /api/v1/reports/mileage`

#### `PayerPaymentsController`
- `GET /api/v1/payer-payments/entries`
- `POST /api/v1/payer-payments/entries`
- `PATCH /api/v1/payer-payments/entries/{entryId}`
- `DELETE /api/v1/payer-payments/entries/{entryId}`

### Billing / claims (Later)

#### `BillingClaimsController`
- `POST /api/v1/billing/cms1500/preview`
- `POST /api/v1/billing/officeally/test-connection`
- `POST /api/v1/billing/officeally/submit`
- `POST /api/v1/billing/availity/submit` (optional if you keep Availity)

#### `ClearingHouseController`
- `GET /api/v1/billing/clearing-house/settings`
- `PUT /api/v1/billing/clearing-house/settings`

### Files (download gateway) (Later)

#### `FilesController`
- `GET /api/v1/files/{fileId}` (Drive/local resolution)

---

## Future (Phase 2+) — Launchpad controllers (`/launchpad/api/v1`)

Launchpad is intentionally **out of scope for the initial Mahaverse stabilization rewrite**.
When we bring it in, we can either:
- add a **second datasource** (keep Launchpad DB separate), or
- migrate Launchpad tables into the Mahaverse DB (more invasive; do later).

### Auth & identity

#### `LaunchpadAuthController`
- `POST /launchpad/api/v1/auth/login`
- `POST /launchpad/api/v1/auth/logout`
- `POST /launchpad/api/v1/auth/sso-login`
- `GET /launchpad/api/v1/auth/verify`

#### `LaunchpadMeController`
- `GET /launchpad/api/v1/me`
- `GET /launchpad/api/v1/me/permissions`

### Staff profile form / HR workflows

#### `LaunchpadStaffController`
- `GET /launchpad/api/v1/staff` (list/search)
- `GET /launchpad/api/v1/staff/{staffId}`
- `POST /launchpad/api/v1/staff/{staffId}/share-key`
- `POST /launchpad/api/v1/staff/{staffId}/send-reminder`

#### `LaunchpadFormController`
- `POST /launchpad/api/v1/forms/staff` (multipart, replaces `submit_form.php`)
- `POST /launchpad/api/v1/intake/client` (JSON, replaces `submit_client_intake.php`)

### Offer letter flows

#### `LaunchpadOffersController`
- `GET /launchpad/api/v1/offers/positions`
- `GET /launchpad/api/v1/offers/initiation` (my initiation)
- `POST /launchpad/api/v1/offers/initiation`
- `GET /launchpad/api/v1/offers/acceptance` (my acceptance)
- `POST /launchpad/api/v1/offers/acceptance`
- `POST /launchpad/api/v1/offers/acceptance/signed-offer` (upload PDF)

### Attachments (Drive/local)

#### `LaunchpadAttachmentsController` (Later if Drive/storage needs time)
- `GET /launchpad/api/v1/attachments/{attachmentId}` (download)
- `GET /launchpad/api/v1/attachments/{attachmentId}/view` (inline view)

### Drive integration (Later)

#### `LaunchpadDriveController`
- `GET /launchpad/api/v1/drive/status`
- `POST /launchpad/api/v1/drive/disconnect`
- `GET /launchpad/api/v1/drive/oauth/link` (returns auth_url)


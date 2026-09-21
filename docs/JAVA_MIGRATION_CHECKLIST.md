# Java migration checklist

Every planned endpoint from [`JAVA_CONTROLLERS_AND_ENDPOINTS.md`](./JAVA_CONTROLLERS_AND_ENDPOINTS.md), grouped by module / controller.

**UI local mode:** `pnpm run dev:java` → `NEXT_PUBLIC_BASE_URL=http://localhost:8080` + `NEXT_PUBLIC_API_MODE=java`

**Legend**

| Mark | Meaning |
|------|---------|
| `[x]` | Done on Spring Boot |
| `[~]` | Partial / stub (exists but not full PHP parity) |
| `[ ]` | Pending |

---

## Foundations (not endpoints)

- [x] Spring Boot app scaffold (`java-backend/mahaverse-api`)
- [x] Local MySQL + IONOS schema import
- [x] CORS
- [x] Global error envelope
- [x] Auth token store (`AuthTokens`, SHA-256, TTL)
- [x] Bearer / `X-Auth-Token` auth filter
- [x] RBAC permission resolution (legacy + DB grants fallback)
- [x] UI calls `/api/v1` in Java mode (`lib/mahaverse-api.js`)
- [ ] OpenAPI / Swagger
- [ ] Integration tests (Testcontainers)
- [ ] AWS deploy (ECS + RDS)

---

## Cross-cutting

### `HealthController` / Actuator

- [x] `GET /version`
- [x] `GET /actuator/health`

---

## Auth & identity

### `AuthController`

- [x] `POST /api/v1/auth/login`
- [x] `POST /api/v1/auth/logout`
- [x] `GET /api/v1/auth/verify`

### `MeController`

- [ ] `GET /api/v1/me`
- [x] `GET /api/v1/me/permissions`

### `PasswordResetController`

- [ ] `POST /api/v1/auth/send-otp`
- [ ] `POST /api/v1/auth/verify-otp`
- [ ] `POST /api/v1/auth/reset-password`

---

## Lookups

### `LookupsController`

- [x] `GET /api/v1/lookups/service-codes`
- [ ] `GET /api/v1/lookups/service-code-rules`
- [x] `GET /api/v1/lookups/diagnosis-codes`
- [x] `GET /api/v1/lookups/providers`
- [x] `GET /api/v1/lookups/provider-service-codes`
- [x] `GET /api/v1/lookups/locations`
- [x] `GET /api/v1/lookups/facility-types`
- [x] `GET /api/v1/lookups/treatment-types`
- [x] `GET /api/v1/lookups/document-types`

> Manage Data **write** APIs for these masters are not in the endpoints plan as separate controllers yet — still pending as PHP `*.php` POST/PUT/DELETE.

---

## Clients

### `ClientsController`

- [x] `GET /api/v1/clients` (RBAC roster scoping — basic)
- [x] `POST /api/v1/clients` (upsert; UI save path)
- [x] `GET /api/v1/clients/{clientId}`
- [~] `PATCH /api/v1/clients/{clientId}` — implemented as `PUT` today; PATCH alias still pending
- [x] `POST /api/v1/clients/{clientId}/archive`
- [x] `POST /api/v1/clients/{clientId}/unarchive`

### `ClientInsurancesController`

> Nested via monolithic client save today; dedicated resource APIs pending.

- [ ] `GET /api/v1/clients/{clientId}/insurances`
- [ ] `POST /api/v1/clients/{clientId}/insurances`
- [ ] `PATCH /api/v1/clients/{clientId}/insurances/{insuranceId}`
- [ ] `DELETE /api/v1/clients/{clientId}/insurances/{insuranceId}`
- [~] Insurance data round-trip via `POST/PUT /api/v1/clients` (nested payload)

### `ClientAuthorizationsController`

- [ ] `GET /api/v1/clients/{clientId}/authorizations`
- [ ] `POST /api/v1/clients/{clientId}/authorizations`
- [ ] `PATCH /api/v1/clients/{clientId}/authorizations/{authorizationId}`
- [ ] `DELETE /api/v1/clients/{clientId}/authorizations/{authorizationId}`
- [~] Authorization data round-trip via `POST/PUT /api/v1/clients` (nested payload)
- [ ] Units enrich from Ready-to-Bill sessions (full PHP parity)

### `ClientDocumentsController` (Later — Drive)

- [ ] `GET /api/v1/clients/{clientId}/documents`
- [ ] `POST /api/v1/clients/{clientId}/documents` (multipart)
- [ ] `GET /api/v1/clients/{clientId}/documents/{documentId}`
- [ ] `DELETE /api/v1/clients/{clientId}/documents/{documentId}`

### `ClientAvailabilityController`

- [ ] `GET /api/v1/clients/{clientId}/availability`
- [ ] `PUT /api/v1/clients/{clientId}/availability`
- [~] Availability round-trip via `POST/PUT /api/v1/clients` (nested payload)

---

## Scheduling

### `SessionsController`

- [ ] `GET /api/v1/sessions` (filters: `clientId`, `providerId`, `date`, range)
- [ ] `POST /api/v1/sessions` (create + recurring)
- [ ] `GET /api/v1/sessions/{sessionId}`
- [ ] `PATCH /api/v1/sessions/{sessionId}` (completed-session lock rules)
- [ ] `POST /api/v1/sessions/import` (Excel import)

### `SessionNotesController`

- [ ] `GET /api/v1/sessions/{sessionId}/notes`
- [ ] `POST /api/v1/sessions/{sessionId}/notes`
- [ ] `PATCH /api/v1/sessions/{sessionId}/notes/{noteId}`
- [ ] `DELETE /api/v1/sessions/{sessionId}/notes/{noteId}`

### `SessionLogController`

- [ ] `GET /api/v1/session-log`

---

## Staff

### `StaffController`

- [~] `GET /api/v1/staff` — empty stub (`staff_records: []`); no `scope=assigned` yet
- [ ] `POST /api/v1/staff`
- [ ] `GET /api/v1/staff/{staffId}`
- [ ] `PATCH /api/v1/staff/{staffId}`

### `StaffDocumentsController` (Later — Drive)

- [ ] `GET /api/v1/staff/{staffId}/documents`
- [ ] `POST /api/v1/staff/{staffId}/documents` (multipart)
- [ ] `DELETE /api/v1/staff/{staffId}/documents/{documentId}`

---

## Users / RBAC admin

### `UsersController`

- [ ] `GET /api/v1/users`
- [ ] `POST /api/v1/users`
- [ ] `GET /api/v1/users/{userId}`
- [ ] `PATCH /api/v1/users/{userId}`
- [ ] `DELETE /api/v1/users/{userId}`

### `RbacController`

- [ ] `GET /api/v1/rbac/catalog`
- [ ] `GET /api/v1/rbac/matrix`
- [ ] `POST /api/v1/rbac/roles/{roleName}` (save role grants)

---

## Reports

### `ReportsController`

- [ ] `GET /api/v1/reports/dashboard-stats` *(UI still hits legacy `dashboard-stats.php` → 500 on Java)*
- [ ] `GET /api/v1/reports/session-log`
- [ ] `GET /api/v1/reports/insurance-utilization`
- [ ] `GET /api/v1/reports/mileage`

### `PayerPaymentsController`

- [ ] `GET /api/v1/payer-payments/entries`
- [ ] `POST /api/v1/payer-payments/entries`
- [ ] `PATCH /api/v1/payer-payments/entries/{entryId}`
- [ ] `DELETE /api/v1/payer-payments/entries/{entryId}`

---

## Billing / claims (Later)

### `BillingClaimsController`

- [ ] `POST /api/v1/billing/cms1500/preview`
- [ ] `POST /api/v1/billing/officeally/test-connection`
- [ ] `POST /api/v1/billing/officeally/submit`
- [ ] `POST /api/v1/billing/availity/submit`

### `ClearingHouseController`

- [ ] `GET /api/v1/billing/clearing-house/settings`
- [ ] `PUT /api/v1/billing/clearing-house/settings`

---

## Files (Later)

### `FilesController`

- [ ] `GET /api/v1/files/{fileId}` (Drive/local resolution)

---

## Future (Phase 2+) — Launchpad (`/launchpad/api/v1`)

All Launchpad endpoints are **pending** (out of Phase 1 scope).

### `LaunchpadAuthController`

- [ ] `POST /launchpad/api/v1/auth/login`
- [ ] `POST /launchpad/api/v1/auth/logout`
- [ ] `POST /launchpad/api/v1/auth/sso-login`
- [ ] `GET /launchpad/api/v1/auth/verify`

### `LaunchpadMeController`

- [ ] `GET /launchpad/api/v1/me`
- [ ] `GET /launchpad/api/v1/me/permissions`

### `LaunchpadStaffController`

- [ ] `GET /launchpad/api/v1/staff`
- [ ] `GET /launchpad/api/v1/staff/{staffId}`
- [ ] `POST /launchpad/api/v1/staff/{staffId}/share-key`
- [ ] `POST /launchpad/api/v1/staff/{staffId}/send-reminder`

### `LaunchpadFormController`

- [ ] `POST /launchpad/api/v1/forms/staff` (multipart)
- [ ] `POST /launchpad/api/v1/intake/client`

### `LaunchpadOffersController`

- [ ] `GET /launchpad/api/v1/offers/positions`
- [ ] `GET /launchpad/api/v1/offers/initiation`
- [ ] `POST /launchpad/api/v1/offers/initiation`
- [ ] `GET /launchpad/api/v1/offers/acceptance`
- [ ] `POST /launchpad/api/v1/offers/acceptance`
- [ ] `POST /launchpad/api/v1/offers/acceptance/signed-offer`

### `LaunchpadAttachmentsController` (Later)

- [ ] `GET /launchpad/api/v1/attachments/{attachmentId}`
- [ ] `GET /launchpad/api/v1/attachments/{attachmentId}/view`

### `LaunchpadDriveController` (Later)

- [ ] `GET /launchpad/api/v1/drive/status`
- [ ] `POST /launchpad/api/v1/drive/disconnect`
- [ ] `GET /launchpad/api/v1/drive/oauth/link`

---

## Suggested next (by module)

1. **`ReportsController`** — `dashboard-stats` (clears home 500)
2. **`StaffController`** — full CRUD (unblocks scheduling)
3. **`SessionsController`** + notes / session-log
4. Manage Data writes (lookups POST/PUT) or Master Data
5. **`BillingClaimsController`** / clearing house

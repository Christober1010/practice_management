## Goal

- **Stabilize the backend** by rewriting the PHP implementation into a **clean, testable Java Spring Boot** architecture with a **new REST API**.
- **Keep the existing MySQL schema as-is initially** (no/low DB changes) to minimize risk.
- Keep PHP running while Java is built; migrate the Next.js UI gradually to the new REST API.

## Deployments (prod vs test)

- Build **one JAR** and deploy it twice:
  - **Prod**: replaces what `backend/` serves today
  - **Test**: replaces what `backend-test/` serves today
- Differences are only config:
  - `SPRING_PROFILES_ACTIVE=prod|test`
  - env vars for database credentials + external integrations

## Recommended Java architecture (what makes it “stable”)

### Single Spring Boot app, modular internals

- **Deployable**: `java-backend/maha-platform-api`
- **Modules (packages)**:
  - `common`: auth/token, RBAC engine, error handling, DTOs, validation, observability
  - `mahaverse`: clients, scheduling, notes/logs, master/manage data, billing/claims
  - `launchpad`: offer/intake/attachments/drive flows

### Two datasources (because Launchpad DB differs)

- `mahaverseDataSource` → the DB currently used by `backend/` (prod) or `backend-test/` (test)
- `launchpadDataSource` → the DB currently used by `app/launchpad/backend/` (prod/test equivalents)

### Layering (to prevent “fix one thing, break another”)

- **Web layer**: REST controllers only (request parsing + response shaping)
- **Application layer**: use-case services (transaction boundaries, orchestration)
- **Domain layer**: rules/policies (RBAC scope, scheduling conflicts, claim grouping)
- **Infrastructure layer**: repositories (SQL), Drive/email/SFTP integrations

## API strategy (you chose: new REST)

### Versioned REST bases

- Mahaverse REST: `/api/v1/*`
- Launchpad REST: `/launchpad/api/v1/*`

### Error contract (one consistent envelope)

- Standardize errors returned to UI, e.g.
  - `400` validation: `{ code, message, fieldErrors? }`
  - `401` auth required
  - `403` permission denied
  - `409` conflict (scheduling double-book)
  - `500` unexpected

## Phase plan (thin-slice build + UI migration)

### Phase 0 — Inventory current behavior → design REST model

- Extract the **behavioral requirements** from PHP (not the PHP routes):
  - Auth & token persistence (`AuthTokens` hash + expiry + last_used_at)
  - RBAC keys + `access_scope=all|self` behavior
  - Scheduling rules: conflicts, recurring, service_type, exclude_session, “completed session lock”
  - Drive/local upload semantics (`drive://<fileId>`)
  - OfficeAlly constraints (2-week DOS window) and claim grouping rules
- Write an **OpenAPI spec** for `/api/v1` and `/launchpad/api/v1`.

### Phase 1 — Foundations

- Scaffold Spring Boot 3.x (Java 21) with:
  - `spring-boot-starter-web`, `validation`, `jdbc` (JdbcTemplate), `security` (filters), `actuator`
  - MySQL driver
  - Testcontainers MySQL for integration tests
- Implement cross-cutting building blocks:
  - Auth filter: Bearer + `X-Auth-Token` / `X-CSRF-Token`
  - Token storage compatible with `AuthTokens`
  - RBAC engine compatible with current permission keys + access scopes
  - Global exception handler → consistent error envelope
  - Request logging + correlation id

### Phase 2 — REST endpoints in priority order

Start with endpoints that unblock UI migration and prove architecture.

#### 2A) Auth first

- Mahaverse:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/verify`
  - `GET /api/v1/me/permissions`
- Launchpad:
  - `POST /launchpad/api/v1/auth/login`
  - `POST /launchpad/api/v1/auth/logout`
  - `POST /launchpad/api/v1/auth/sso-login`
  - `GET /launchpad/api/v1/me/permissions`

#### 2B) Read-only next (low risk)

- Lookups: `/api/v1/lookups/*` (service codes, diagnosis, locations, providers, facility/treatment/document types)
- Master data: `/api/v1/master-data/*` (programs/modules/behaviors/targets/domains/prompts)
- Optional “bootstrap”: `GET /api/v1/bootstrap` to reduce UI round-trips during migration

#### 2C) Core writes (high value + higher risk)

- Clients:
  - `GET /api/v1/clients` (RBAC roster scoping)
  - `POST /api/v1/clients`
  - `PATCH /api/v1/clients/{clientId}`
  - nested: insurances, authorizations, documents, availability
- Scheduling:
  - `GET /api/v1/sessions` (filters: client/provider/date)
  - `POST /api/v1/sessions` (recurring + conflict detection)
  - `PATCH /api/v1/sessions/{sessionId}` (completed-session lock rules)
  - `POST /api/v1/sessions/import`
- Notes/logs:
  - `/api/v1/sessions/{sessionId}/notes`
  - `/api/v1/session-log`

#### 2D) Files + Drive

- Storage abstraction:
  - `LocalStorageService`
  - `GoogleDriveStorageService`
- REST:
  - `POST /api/v1/clients/{clientId}/documents`
  - `POST /api/v1/staff/{staffId}/documents`
  - `GET /api/v1/files/{fileId}` (download; supports Drive + local)
  - Launchpad attachments under `/launchpad/api/v1/*`

#### 2E) Billing/claims last

- `POST /api/v1/billing/cms1500/preview`
- `POST /api/v1/billing/officeally/test-connection`
- `POST /api/v1/billing/officeally/submit`
- `GET/PUT /api/v1/billing/clearing-house/settings`

### Phase 3 — UI migration strategy (keep PHP stable)

- Add a new API client in Next.js for Java REST (separate from `mahaverseFetch`).
- Migrate screen-by-screen:
  - Login → permissions → lookups/master-data → clients list → scheduling → notes → billing
- Keep the PHP base URL available as fallback until the Java coverage is complete.

## Testing strategy (stability-first)

- **Domain tests**: RBAC scope, scheduling conflict detection, claim grouping, completed-session lock rules.
- **Integration tests**: MySQL Testcontainers; validate critical queries against schema as-is.
- **E2E**: reuse Playwright; gradually switch `E2E_API_BASE` to the Java service as pages migrate.

## “Done” criteria

- Java REST backend runs in **prod + test** (same JAR, different profiles/env).
- UI uses the REST API for all major workflows.
- A change in one area (e.g. billing) no longer breaks unrelated areas (enforced by tests + layering).
- PHP remains deployed but is no longer required for core app functionality (retire later if desired).


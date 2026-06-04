# Mahaverse

Next.js static-export frontend with PHP APIs on IONOS (test and production).

| Environment | PHP API (hosted) | DB | Repo backend folder | Local dev |
|-------------|------------------|-----|---------------------|-----------|
| **Test** | `mahaverse-backend-test` | `dbs14649042` | `backend-test/` | http://localhost:3000 |
| **Prod** | `mahaverse-backend-logics` | `dbs14484433` | `backend/` | http://localhost:3001 |

Upload `backend-test/` or `backend/` to the matching path on the server after changes.

---

## Prerequisites

```bash
pnpm install
npx playwright install chromium   # only for E2E
cp e2e/.env.example e2e/.env      # only for E2E — set E2E_EMAIL / E2E_PASSWORD
```

- Node.js 18+ and **pnpm**
- Root env files (gitignored): `.env.test`, `.env.prod` (templates committed)
- `e2e/.env` — admin login for Playwright (see `e2e/.env.example`)

---

## 1. Run the application (development)

Pick **test** or **prod** API. Each mode uses its own port so you can run both at once.

### Test (recommended for daily dev)

```bash
pnpm run dev:test
```

- Loads `.env.test` → `NEXT_PUBLIC_BASE_URL=.../mahaverse-backend-test`
- Open **http://localhost:3000**

### Prod (verify against live API / DB)

```bash
pnpm run dev:prod
```

- Loads `.env.prod` → `NEXT_PUBLIC_BASE_URL=.../mahaverse-backend-logics`
- Open **http://localhost:3001**

### Generic dev (optional)

```bash
pnpm run dev
```

Uses a local `.env` if you have one; prefer `dev:test` or `dev:prod` for clarity.

---

## 2. Build (static export for deploy)

Builds produce static HTML under `out/` or `out-test/` and zip them for upload. See [artifacts/README.md](artifacts/README.md).

### Test build

```bash
pnpm run build:test
```

- Uses `.env.test` (test API baked into the export)
- Output: `out-test/` + `artifacts/test/out-test.zip`

### Prod build

```bash
pnpm run build
```

- Uses prod API configuration
- Output: `out/` + `artifacts/prod/out.zip`

Upload the matching zip to IONOS static hosting for that environment.

### Preview a production build locally (optional)

```bash
pnpm run build:test
pnpm run start
```

---

## 3. Tests

### API smoke (read-only, no browser)

Hits live test or prod APIs and writes reports under `report/`.

```bash
pnpm run test:test    # test API audit
pnpm run test         # prod API audit
```

Script: `scripts/generate-api-audit-report.sh`

### Playwright E2E (UI + full API flows)

Same test suite runs against **test** and **prod**. Deep dive: [docs/E2E-PLAYWRIGHT.md](docs/E2E-PLAYWRIGHT.md).

**One-time:** `e2e/.env` with credentials that can log in to the target environment(s).

#### Main commands

```bash
pnpm run test:e2e              # test, then prod
pnpm run test:e2e:test           # test only (UI + API)
pnpm run test:e2e:prod           # prod only (UI + API)
pnpm run test:e2e:api:prod       # prod API flows only
```

#### API-only

```bash
pnpm run test:e2e:api            # API flows: test, then prod
pnpm run test:e2e:api:test         # test API flows only
```

#### Debugging / reports

```bash
pnpm run test:e2e:ui               # interactive Playwright UI
pnpm run test:e2e:headed           # visible browser
pnpm run test:e2e:report:test      # HTML report (test)
pnpm run test:e2e:report:prod      # HTML report (prod)
```

Playwright can start `dev:test` or `dev:prod` automatically. If the dev server is **already running**:

**Terminal 1**

```bash
pnpm run dev:test    # port 3000 — for test E2E
# or
pnpm run dev:prod    # port 3001 — for prod E2E
```

**Terminal 2**

```bash
E2E_TARGET=test PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test
# or
E2E_TARGET=prod PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test
```

| Target | Report folder | Auth state |
|--------|---------------|------------|
| test | `playwright-report-test/` | `e2e/.auth/user-test.json` |
| prod | `playwright-report-prod/` | `e2e/.auth/user-prod.json` |

**Prod E2E warning:** specs **write** to the live prod DB (E2E clients, users, staff, etc.). Only run when intentional. If prod DB is missing session migrations (e.g. `recurring_id`), add-session / session-notes API tests skip — see [docs/MIGRATIONS-CHECKLIST.md](docs/MIGRATIONS-CHECKLIST.md).

---

## Typical workflows

### Develop against test

```bash
pnpm run dev:test
# … edit UI …
pnpm run test:e2e:test
pnpm run build:test
# upload artifacts/test/out-test.zip
```

### Verify prod locally before deploy

```bash
pnpm run dev:prod
pnpm run test:e2e:prod          # or test:e2e:api:prod for API only
pnpm run build
# upload artifacts/prod/out.zip
# ensure backend/ is synced to mahaverse-backend-logics
```

### Full regression (test + prod)

```bash
pnpm run test:e2e              # all Playwright projects, both targets
```

---

## Quick reference — all npm scripts

| Script | What it does |
|--------|----------------|
| **Dev** | |
| `dev` | Next dev (default env) |
| `dev:test` | Dev → **test** API, port **3000** |
| `dev:prod` | Dev → **prod** API, port **3001** |
| **Build** | |
| `build:test` | Static export + zip for **test** |
| `build` | Static export + zip for **prod** |
| `start` | Serve production build |
| **Lint** | |
| `lint` | ESLint |
| **API smoke (read-only)** | |
| `test:test` | API audit report → **test** |
| `test` | API audit report → **prod** |
| **Playwright E2E** | |
| `test:e2e` | E2E: **test**, then **prod** |
| `test:e2e:test` | E2E: **test** only (UI + API) |
| `test:e2e:prod` | E2E: **prod** only (UI + API) |
| `test:e2e:api` | API E2E: test, then prod |
| `test:e2e:api:test` | API E2E: test only |
| `test:e2e:api:prod` | API E2E: prod only |
| `test:e2e:ui` | Playwright interactive UI |
| `test:e2e:headed` | Playwright headed browser |
| `test:e2e:report:test` | Open HTML report (test) |
| `test:e2e:report:prod` | Open HTML report (prod) |

---

## More documentation

- [docs/E2E-PLAYWRIGHT.md](docs/E2E-PLAYWRIGHT.md) — Playwright projects, env vars, spec list
- [docs/MIGRATIONS-CHECKLIST.md](docs/MIGRATIONS-CHECKLIST.md) — SQL migrations for test/prod DBs
- [docs/API-AUTH.md](docs/API-AUTH.md) — Auth tokens and headers
- [docs/BACKEND-ALIGNMENT-PROD-TEST.md](docs/BACKEND-ALIGNMENT-PROD-TEST.md) — Sync `backend-test/` ↔ `backend/`
- [report/](report/) — API audit and E2E reports

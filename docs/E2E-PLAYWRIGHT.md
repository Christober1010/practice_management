# Playwright E2E tests

End-to-end tests against **test** and **prod** PHP APIs, with matching local dev servers.

See also the main [README.md](../README.md) for dev, build, and all npm scripts.

| Target | API base | DB | Local app |
|--------|----------|-----|-----------|
| **test** | `mahaverse-backend-test` | `dbs14649042` | `http://localhost:3000` (`pnpm run dev:test`) |
| **prod** | `mahaverse-backend-logics` | `dbs14484433` | `http://localhost:3001` (`pnpm run dev:prod`) |

---

## Setup (once)

```bash
pnpm install
npx playwright install chromium
cp e2e/.env.example e2e/.env
# Admin credentials that work on test (and prod if you run prod E2E)
```

Root env files (gitignored): `.env.test`, `.env.prod`.

---

## Run the app before UI tests (optional)

Playwright can start the dev server automatically. To run it yourself:

```bash
pnpm run dev:test    # test → port 3000
pnpm run dev:prod    # prod → port 3001
```

---

## Run Playwright tests

Start the matching dev server first if you use `PLAYWRIGHT_SKIP_WEBSERVER=1` (see [README.md](../README.md)).

```bash
pnpm run test:e2e              # test, then prod
pnpm run test:e2e:test           # test only (UI + API)
pnpm run test:e2e:prod           # prod only (UI + API)
pnpm run test:e2e:api:prod       # prod API flows only
```

```bash
pnpm run test:e2e:api            # API flows: test, then prod
pnpm run test:e2e:api:test         # test API flows only
pnpm run test:e2e:ui               # interactive UI mode
pnpm run test:e2e:headed           # visible browser
pnpm run test:e2e:report:test      # HTML report (test)
pnpm run test:e2e:report:prod      # HTML report (prod)
```

### Dev server already running

```bash
# Terminal 1
pnpm run dev:test   # or dev:prod

# Terminal 2
E2E_TARGET=test PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test
E2E_TARGET=prod PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test
```

Reports: `playwright-report-test/`, `playwright-report-prod/`.

Auth state: `e2e/.auth/user-test.json`, `e2e/.auth/user-prod.json`.

---

## Projects (per target)

| Project | Purpose |
|---------|---------|
| `setup-test` / `setup-prod` | Login → save storage state |
| `test-chromium` / `prod-chromium` | Browser UI specs |
| `api-test` / `api-prod` | Schema probes then serial API (`00-schema-readiness.spec.ts`, `api-endpoints.spec.ts`) |

---

## What is tested

| Spec | Coverage |
|------|----------|
| `e2e/auth.setup.ts` | Login → storage state |
| `e2e/login-guard.spec.ts` | Unauthenticated login screen |
| `e2e/dashboard.spec.ts` | Admin dashboard |
| `e2e/clients.spec.ts` | List, add client, edit modal |
| `e2e/scheduling.spec.ts` | Calendar smoke, add-session modal open/cancel |
| `e2e/scheduling-flows.spec.ts` | **Full flows:** create session UI, notes, behaviors, SOAP save |

```bash
pnpm run dev:test   # terminal 1
pnpm run test:e2e:scheduling   # terminal 2 — needs admin E2E_EMAIL in e2e/.env
```
| `e2e/staff.spec.ts` / `e2e/users.spec.ts` | Lists + add modals |
| `e2e/master-data.spec.ts` / `e2e/manage-data.spec.ts` | Configure / manage data |
| `e2e/reports.spec.ts` | Reports list |
| `e2e/users-full.spec.ts` | Create user (full flow) |
| `e2e/master-data-crud.spec.ts` | Add behavior category |
| `e2e/data-collection-ui.spec.ts` | (skipped — covered by `scheduling-flows`) |
| `e2e/00-schema-readiness.spec.ts` | Migration/schema probes (fail on `Unknown column`) |
| `e2e/api-endpoints.spec.ts` | All major PHP endpoints (serial) |

Helpers: `e2e/helpers/` (`navigation`, `api`, `api-client`, `client-form`, etc.).

API suite **creates** data on the target DB. Only run prod when you accept writes to production.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `E2E_TARGET` | `test` or `prod` (set by npm scripts) |
| `E2E_EMAIL` / `E2E_PASSWORD` | Admin login (`e2e/.env`) |
| `E2E_API_BASE` | Override API URL (optional) |
| `PLAYWRIGHT_SKIP_WEBSERVER` | `1` if dev server already up |
| `PLAYWRIGHT_BASE_URL` | Override app URL |

---

## Prod notes

- Same write-heavy flows as test on the **live** database.
- If prod MySQL is behind test migrations (e.g. missing `sessions.recurring_id`), **`00-schema-readiness`** and **`api-endpoints`** **fail** with a schema-drift message — they do not skip. Apply SQL from [MIGRATIONS-CHECKLIST.md](MIGRATIONS-CHECKLIST.md).
- Read-only prod API smoke (no Playwright): `pnpm run test` → `scripts/generate-api-audit-report.sh prod`.

### Why UI tests did not catch `recurring_id` on prod

| Gap | What happened |
|-----|----------------|
| **UI scheduling spec** | Only opens the Add Session modal and cancels — it never submits `POST add-session.php`. |
| **API suite (before fix)** | On `Unknown column`, tests called `test.skip()`, so prod runs looked **passed with skips** while session create was broken in the real app. |
| **Test vs prod DB** | Test DB already had `recurring_id`; only prod was missing it, so `test:e2e:test` stayed green. |

Run `pnpm run test:e2e:api:prod` after every prod migration batch.

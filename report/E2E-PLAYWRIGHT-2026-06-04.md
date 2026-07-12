# Playwright E2E — first run (test API)

**Date:** 2026-06-04  
**Command:** `PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test`  
**App:** `dev:test` → `mahaverse-backend-test`

## Result (full suite)

| Project | Tests | Notes |
|---------|-------|--------|
| `api` | **18 passed** (~18s) | All major PHP endpoints, serial flows |
| `chromium` | **19 passed**, 1 skipped | UI smoke + create flows; session notes UI skips if no calendar sessions |

Run all: `pnpm run test:e2e` (both projects).

| Area | Specs |
|------|--------|
| Clients | List, **add client**, edit modal |
| Dashboard | Admin dashboard |
| Scheduling | Sessions API, add-session modal |
| Staff / Users | List + add modals |
| Configure data | Domains, Behaviors |
| Manage data | Behavior categories, Payer payments |
| Reports | Reports list |
| Auth | Login guard |

## Notes

- Login UI uses `CardTitle` for “Welcome Back” (not a heading role); specs assert `textbox` “Email Address” instead.
- If port 3000 has a hung `next dev`, restart before E2E (`curl -m 5 http://localhost:3000/` should return 200 quickly).
- Setup/docs: `docs/E2E-PLAYWRIGHT.md`

## Schema parity (2026-06-04 update)

Prod `recurring_id` gap was missed because API tests **skipped** on `Unknown column` and UI scheduling never **submits** add-session. Added `e2e/00-schema-readiness.spec.ts` + `assertNoSchemaDrift` — prod API now **fails** on migration drift. After `sessions_add_recurring_id.sql`: `pnpm run test:e2e:api:prod` → 24 passed, 1 skipped (no client activities for trial POST).

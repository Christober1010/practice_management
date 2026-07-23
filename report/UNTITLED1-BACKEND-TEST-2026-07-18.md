# Untitled-1 verification (backend-test) — 2026-07-18

**Target:** `https://www.mahabehavioralhealth.com/mahaverse-backend-test`  
**UI:** `http://localhost:3000` (`dev:test`)

## Results

| # | Requirement | Result | How verified |
|---|-------------|--------|--------------|
| 1 | Scheduling location filter from Location table; filter clients by location | **PASS** | API: `locations.php` + client.location update/filter. UI: Appointments location dropdown shows master names (Maha, E2E, etc.) |
| 2 | Staff Personal tab location dropdown | **PASS** | API: staff create/read with `location` = location UUID. UI: Add Staff → Personal → Location (no free-text “Primary location / office”) |
| 3 | Only Admin sees all clients & staff | **PASS** | Admin `get-clients` / `staff.php` full counts; RBT sees far fewer |
| 4 | Staff/Client dropdowns by assignment | **PASS** | RBT with 2 assigned clients: `get-clients` returns only those two; `staff.php?scope=assigned` restricted to self/related |
| 5 | Active assigned clients only | **PASS** | Inactive assigned client excluded from RBT `get-clients` |
| 6 | Role BCBA → Biller updates | **PASS** | `update-users` → list shows `biller`; login + `me-permissions.php` returns `role: biller` |

## Commands run

```bash
E2E_TARGET=test PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test \
  e2e/assignment-location-role.spec.ts --project=api-test

E2E_TARGET=test PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  pnpm exec playwright test e2e/untitled1-ui-smoke.spec.ts --project=test-chromium
```

**API suite:** 6/6 passed  
**UI smoke:** 2/2 passed (+ auth setup)

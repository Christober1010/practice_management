# Backend alignment: `backend/` (prod) vs `backend-test/` (dev)

**Generated:** 2026-06-02  
**Prod deploy path:** `mahaverse-backend-logics/` ← `backend/`  
**Test deploy path:** `mahaverse-backend-test/` ← `backend-test/`

---

## Executive summary

| | `backend/` (prod) | `backend-test/` (dev) |
|--|-------------------|------------------------|
| PHP entrypoints | 67 | 69 |
| Identical files | 9 | 9 |
| Differs (logic + creds) | **55** | **55** |
| Creds/comments only | 2 | 2 |
| Only in prod | `get-clients-old.php` | — |
| Only in test | — | `bootstrap.php`, `logout.php`, `health-auth.php` |

**They are not aligned today.** Dev (`backend-test`) is ahead on auth, RBAC, CORS, and several bug fixes. Prod (`backend`) is mostly **open APIs** (no `requireAuth` on business endpoints).

### If you “push prod to dev” (copy `backend/` → `backend-test/`)

You will **regress** dev unless prod was updated first:

| Lost on dev | Impact |
|-------------|--------|
| Mandatory auth on ~45 endpoints | UI gets **401** everywhere that uses `mahaverseFetch` |
| `requireAuthAny` on `get-all.php`, `client-modules.php` GET | Master data + session notes data collection **403/401** |
| `session-notes.php` auth + `getAuthenticatedUser()` fix | Broken notes / behavior persistence |
| `get-clients.php` + `client_auth_units_helpers` | Possible **500** on clients list |
| `get-sessions.php` session_id fix | Scheduling **500** |
| `.htaccess` helper blocking | Helpers callable over HTTP |
| `logout.php`, richer `verify.php` | Token verify / logout behavior changes |
| `X-Auth-Token` on many CORS headers | Localhost / static export CORS failures |

### Recommended alignment (before any deploy)

**Promote test → prod** (same code, different DB credentials):

```bash
# From repo root — copies logic from backend-test → backend, rewrites prod DB host/db/user
bash scripts/sync-backend-test-to-prod.sh
```

Then deploy **`backend/`** to `mahaverse-backend-logics/` and **`backend-test/`** to `mahaverse-backend-test/` (each folder keeps its own DB via `config.php` + inline creds in endpoints that duplicate them).

Only use **prod → test** if you intentionally want dev to match old prod behavior:

```bash
bash scripts/sync-backend-prod-to-test.sh
```

---

## Database credentials (must stay different)

| | Prod `backend/` | Test `backend-test/` |
|--|-----------------|----------------------|
| Host | `db5018266079.hosting-data.io` | `db5018419668.hosting-data.io` |
| Database | `dbs14484433` | `dbs14649042` |
| User | `dbu3321929` | `dbu1183438` |

Many endpoints **inline** the same host/db/user (not only `config.php`). Any sync script must rewrite all three values in every copied file.

---

## Auth & security gap

| Feature | Prod | Test |
|---------|------|------|
| `requireAuth()` on business APIs | ~0 files | ~45 files |
| `requireAuthAny()` | 0 | 6 (`get-all.php`, `client-modules.php`, …) |
| `mahaverse_require_helper()` | 0 | 7 |
| `verify.php` uses `AuthTokens` + `requireUser()` | No (legacy Bearer + inline prod DB) | Yes |
| `logout.php` | Missing | Present |
| `.htaccess` blocks `*_helpers.php` | No | Yes |
| `health-auth.php` (diagnostic) | Missing | Present (remove after stable) |

See [API-AUTH.md](API-AUTH.md) for the full permission map (test).

---

## Notable logic differences (non-credential)

These are why “same app” behaves differently on prod vs test today:

| Area | Test (`backend-test`) | Prod (`backend`) |
|------|----------------------|-------------------|
| **Auth** | `requireUser` / `requireAuth` / `requireAuthReadWrite` / `requireAuthAny` in `config.php` | Basic session + token helpers; almost no endpoint enforcement |
| **verify.php** | `config.php` + `requireUser()` | Standalone prod DB + manual Bearer parse |
| **get-all.php** | Auth + `master_data.read` OR `clients.read` | No auth |
| **client-modules.php** | GET allows session notes / scheduling / clients read | `master_data.read` only (or no auth) |
| **session-notes.php** | Auth, helpers via `mahaverse_require_helper`, scope fixes | Weaker / older pattern |
| **get-clients.php** | Auth + `client_auth_units_helpers` include | Missing helper / auth differences |
| **get-sessions.php** | `session_id` column fix | Wrong column risk |
| **reset-password-with-otp.php** | `new_password` + `newPassword`, `users.password` | May still be mismatched on prod |
| **OTP trio CORS** | `*` / full allow-headers | May differ |
| **payer-payment-entries.php** | Auth + report upsert | Likely no auth |
| **behaviors / client-behaviors** | Auth + helpers | Likely no auth |

---

## Files only in one tree

| File | Location | Note |
|------|----------|------|
| `get-clients-old.php` | prod only | Legacy; do not deploy to test |
| `bootstrap.php` | test only | Optional shared bootstrap; not required if each endpoint uses `config.php` |
| `logout.php` | test only | Keep on test; add to prod when promoting test → prod |
| `health-auth.php` | test only | Temporary diagnostic; do not copy to prod long-term |

---

## Deploy checklist (aligned release)

### Test (dev)

1. Prefer source: **`backend-test/`** (do not overwrite with prod copy).
2. Run pending migrations on **test DB** — [MIGRATIONS-CHECKLIST.md](MIGRATIONS-CHECKLIST.md).
3. Confirm `AuthTokens` exists — [AUTH-PREREQ-TEST.md](AUTH-PREREQ-TEST.md) if present.
4. Upload full `backend-test/*.php` + `.htaccess`.
5. `TOKEN=… bash scripts/auth-smoke-test.sh`
6. Deploy UI built with `NEXT_PUBLIC_BASE_URL=…/mahaverse-backend-test`.

### Prod

1. Run `bash scripts/sync-backend-test-to-prod.sh` (or manual merge of the 55 logic files).
2. Run same **shared** migrations on **prod DB** `dbs14484433`.
3. Upload full `backend/*.php` + `.htaccess`.
4. Smoke-test login, clients, scheduling, session notes, payer payments.
5. Deploy UI with prod API base URL.

---

## Quick diff commands

```bash
# All differing PHP files
diff -rq backend backend-test --exclude='*.sql' --exclude='scripts' --exclude='.env'

# One file (example)
diff -u backend/config.php backend-test/config.php

# Auth usage count
grep -l requireAuth backend-test/*.php | wc -l
grep -l requireAuth backend/*.php | wc -l
```

---

## Scripts in this repo

| Script | Direction | Use when |
|--------|-----------|----------|
| [`scripts/sync-backend-test-to-prod.sh`](../scripts/sync-backend-test-to-prod.sh) | test → prod | **Recommended** — align prod codebase with dev |
| [`scripts/sync-backend-prod-to-test.sh`](../scripts/sync-backend-prod-to-test.sh) | prod → test | You explicitly want dev PHP to match current prod |

Both scripts:

- Copy all root `*.php` and `.htaccess` from source to target
- Rewrite DB host / database / user for the **target** environment
- Rewrite comment paths `backend-test/` ↔ `backend/`
- Do **not** copy `.env` (keep per-environment secrets local)
- Preserve test-only extras when copying prod → test (`logout.php`, etc. are not deleted)

**Always review `git diff` before commit.**

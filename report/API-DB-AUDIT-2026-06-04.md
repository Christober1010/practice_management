# Mahaverse API & database audit

**Generated:** 2026-06-04 16:25 UTC  
**Prod base:** `https://www.mahabehavioralhealth.com/mahaverse-backend-logics`  
**Test base:** `https://www.mahabehavioralhealth.com/mahaverse-backend-test`  
**Method:** `mahaverse-api-db-audit` skill (OPTIONS + GET per endpoint, no token)

**Raw data:**

- [`.db-map-latest.tsv`](.db-map-latest.tsv) — per-file host/database map (repo scan)
- [`.ping-latest.tsv`](.ping-latest.tsv) — live HTTP status matrix

---

## Executive summary

| Check | Repo (`backend/` / `backend-test/`) | Live prod | Live test |
|-------|--------------------------------------|-----------|-----------|
| Correct env DB in PHP | Yes — prod `dbs14484433`, test `dbs14649042` | Mostly | Yes |
| Auth synced test → prod (local) | Yes (after `sync-backend-test-to-prod.sh`) | **Partial** | Yes |
| Protected APIs → 401 without token | Yes in repo | **No** on 9+ endpoints | **45/65** GETs → 401 |
| Hard failures (500 / 000) | — | **`get-sessions.php` 500** | None |

**Verdict:** Test environment matches expected auth behavior. **Live prod needs full deploy** of synced `backend/` + `.htaccess` + `AuthTokens` migration. Fix **`get-sessions.php`** on prod after deploy.

---

## 1. Database map

### Canonical targets

| Environment | Folder | Host | Database |
|-------------|--------|------|----------|
| Production | `backend/` | `db5018266079.hosting-data.io` | `dbs14484433` |
| Test | `backend-test/` | `db5018419668.hosting-data.io` | `dbs14649042` |

`config.php` → `getDBConnection()` uses these values. Many endpoints **duplicate** inline `$host` / `$database` (historical); the map script lists each file.

### Connection styles (repo)

| Style | Prod files | Test files |
|-------|------------|------------|
| Inline host + database | ~35 | ~35 |
| `includes_config` / `getDBConnection()` | ~25 | ~26 |
| `uses_getDBConnection` only | rbac, logout, drive callback, etc. | + `health-auth.php` |

### Parity checks (scheduling / clients)

| File | Prod DB | Test DB | OK |
|------|---------|---------|-----|
| `add-session.php` | `dbs14484433` | `dbs14649042` | Yes |
| `get-clients.php` | `dbs14484433` | `dbs14649042` | Yes |
| `update-clients.php` | `dbs14484433` | `dbs14649042` | Yes |
| `get-sessions.php` | via inline prod creds | via inline test creds | Yes (repo) |

**Note:** `payer-payment-entries.php` map row shows host without parsed db name; file still targets correct env host.

### Files only in one tree

| File | Location |
|------|----------|
| `get-clients-old.php` | prod repo only |
| `health-auth.php` | test repo only (diagnostic) |
| `bootstrap.php` | test repo only |
| `logout.php` | both repo; **404 on live prod** (not deployed) |

---

## 2. HTTP reachability

### Status code policy

| Code | Meaning |
|------|---------|
| `204` / `200` OPTIONS | CORS preflight OK |
| `401` / `403` GET (protected) | Route exists; auth required |
| `400` / `405` GET | Route exists; wrong method or missing params |
| `404` | Missing deploy or dev-only script |
| `500` | PHP/SQL error — **fail** |
| `000` | Network/TLS — **fail** |

### Test — pass (auth enforced)

- **45 of 65** GET requests return **401** without token (expected after auth rollout).
- Helpers blocked: `behavior_helpers.php`, `client_auth_units_helpers.php` → **403**.
- Public/diagnostic OK: `login.php` (405 GET), OTP trio, drive status, `test.php`, `health-auth.php`.

### Prod — issues

#### Failures

| Endpoint | Method | Code | Action |
|----------|--------|------|--------|
| `get-sessions.php` | GET | **500** | Deploy synced file; verify `sessions` schema (`start_utc`, joins); retest with token |

#### Auth not deployed (GET returns 200 without token)

These should return **401** after full prod deploy:

- `get-all.php`
- `get-clients.php`
- `behaviors.php`
- `reports.php`
- `programs.php`
- `get-users.php`
- `locations.php`
- `payer-payment-entries.php`
- `dashboard-stats.php`

#### Other prod notes

| Endpoint | Code | Note |
|----------|------|------|
| `logout.php` | 404 | Add on deploy (in repo after sync) |
| `verify.php` | 401 GET | Auth path working |
| `me-permissions.php`, `rbac-matrix.php` | 401 GET | OK |
| `behavior_helpers.php` | 200 GET | `.htaccess` deny rule may not be on server |
| `get-clients-old.php` | 200 GET | Legacy endpoint still live |

### Prod vs test (selected endpoints)

| Script | Prod GET | Test GET |
|--------|----------|----------|
| `get-all.php` | 200 | 401 |
| `get-clients.php` | 200 | 401 |
| `get-sessions.php` | 500 | 401 |
| `session-notes.php` | 400 | 401 |
| `client-modules.php` | 400 | 401 |
| `verify.php` | 401 | 401 |

---

## 3. Recommended actions

### Before prod UI + API cutover

1. Run on prod DB: `migration/shared/20260405_113210_create_auth_tokens_table.sql` (if missing).
2. Deploy **entire** `backend/` + `.htaccess` to `mahaverse-backend-logics/`.
3. Re-run ping; expect protected GETs → **401** without token.
4. Fix `get-sessions.php` if still **500** with valid token:

```bash
TOKEN=$(curl -sS -X POST "https://www.mahabehavioralhealth.com/mahaverse-backend-logics/login.php" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' | jq -r .token)

curl -sS -w "\nHTTP:%{http_code}\n" \
  -H "X-Auth-Token: $TOKEN" \
  "https://www.mahabehavioralhealth.com/mahaverse-backend-logics/get-sessions.php"
```

5. Deploy prod frontend build using `mahaverseFetch` and prod `NEXT_PUBLIC_BASE_URL`.

### Re-run this audit

```bash
bash .cursor/skills/mahaverse-api-db-audit/scripts/map-php-databases.sh \
  | tee report/.db-map-latest.tsv

bash .cursor/skills/mahaverse-api-db-audit/scripts/ping-endpoints.sh \
  --prod-base "https://www.mahabehavioralhealth.com/mahaverse-backend-logics" \
  --test-base "https://www.mahabehavioralhealth.com/mahaverse-backend-test" \
  --get | tee report/.ping-latest.tsv
```

Copy this template to `report/API-DB-AUDIT-YYYY-MM-DD.md` after each run.

---

## 4. Related docs

- [docs/API-AUTH.md](../docs/API-AUTH.md) — auth headers and permission map
- [docs/BACKEND-ALIGNMENT-PROD-TEST.md](../docs/BACKEND-ALIGNMENT-PROD-TEST.md) — prod/test code sync
- [docs/API-STATUS-REPORT-TEST.md](../docs/API-STATUS-REPORT-TEST.md) — prior test status report (with token)

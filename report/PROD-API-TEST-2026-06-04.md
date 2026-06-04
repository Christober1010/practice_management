# Prod API test — `update-clients.php` & smoke

**Generated:** 2026-06-04 16:30 UTC  
**Base URL:** `https://www.mahabehavioralhealth.com/mahaverse-backend-logics`  
**Auth user:** `christoberedward@gmail.com` (admin, id 9)

---

## `update-clients.php` — direct tests

URL: https://www.mahabehavioralhealth.com/mahaverse-backend-logics/update-clients.php

| Test | Method | Auth | HTTP | Response |
|------|--------|------|------|----------|
| CORS preflight | OPTIONS | — | **200** | `Access-Control-Allow-Origin: *`, allows `X-Auth-Token` |
| No token | GET | No | **401** | `{"success":false,"message":"Authentication required"}` |
| No token | POST `{}` | No | **401** | Same |
| With token | GET | Yes | **400** | `Missing required field: client_id` (POST-only validation path) |
| With token | POST minimal | Yes | **400** | `Missing required field: first_name` |
| With token | POST full update | Yes | **200** | `{"success":true,"message":"Client updated successfully"}` |

**Verdict:** Auth is **live on prod** for this endpoint. Unauthenticated calls are rejected; authenticated POST with required fields succeeds.

---

## Broader prod smoke (with admin token)

| Endpoint | No token | With token | Expected |
|----------|----------|------------|----------|
| `update-clients.php` | 401 | 400* | OK |
| `get-clients.php` | 401 | **200** | OK |
| `get-all.php` | 401 | **200** | OK |
| `get-sessions.php` | 401 | **200** | OK (was 500 in prior audit — fixed or deploy updated) |
| `client-modules.php` | 401 | 400* | OK (needs `client_id`) |
| `session-notes.php` | 401 | 400* | OK (needs params) |
| `verify.php` | 401 | **200** | OK |
| `me-permissions.php` | 401 | **200** | OK |
| `locations.php` | 401 | **200** | OK |
| `reports.php` | 401 | **200** | OK |
| `behaviors.php` | 401 | **200** | OK |

\*400 = reached PHP validation after auth (not an auth failure).

---

## `get-clients.php` sample

- `success: true`
- **27** clients returned
- Example client: `11082b15-ac5d-4e7f-99f6-0f3bc08ba82b` — Test Client

---

## End-to-end update test

1. `GET get-clients.php` → picked client `11082b15-ac5d-4e7f-99f6-0f3bc08ba82b`
2. `POST update-clients.php` with `client_id`, `first_name`, `last_name`, `date_of_birth` → **200** success
3. **Reverted** name back to `Test` / `Client` immediately after test

---

## Comparison to prior audit ([API-DB-AUDIT-2026-06-04.md](API-DB-AUDIT-2026-06-04.md))

| Item | Prior audit | This test |
|------|-------------|-----------|
| Prod auth on `get-clients.php`, `get-all.php` | GET **200** without token | GET **401** without token |
| `get-sessions.php` | GET **500** with token | GET **200** with token |
| `update-clients.php` | Not individually tested | **401** / **200** as expected |

Prod appears **fully deployed** with auth since the earlier audit.

---

## Quick re-test commands

```bash
BASE="https://www.mahabehavioralhealth.com/mahaverse-backend-logics"
TOKEN=$(curl -sS -X POST "$BASE/login.php" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' | jq -r .token)

# Should 401
curl -sS -w "\nHTTP:%{http_code}\n" "$BASE/update-clients.php"

# Should 400 (missing body fields) or 200 (valid update)
curl -sS -w "\nHTTP:%{http_code}\n" -X POST "$BASE/update-clients.php" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{"client_id":"...","first_name":"...","last_name":"...","date_of_birth":"YYYY-MM-DD"}'
```

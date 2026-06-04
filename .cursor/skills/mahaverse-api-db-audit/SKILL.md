---
name: mahaverse-api-db-audit
description: Audits Mahaverse PHP API endpoints for HTTP reachability (prod vs test base URLs) and maps which MySQL host/database each backend file connects to. Use when verifying deployments, debugging auth_id or DB mismatches, comparing backend vs backend-test, or when the user asks to health-check APIs or audit database wiring.
---

# Mahaverse API & database audit

## Goals

1. **HTTP**: Confirm each web-facing PHP entrypoint responds for **production** and **test** base URLs (not necessarily `200` for every call — see expectations below).
2. **Database**: Produce a **per-file map** of MySQL **host** and **database name** used by `backend/` and `backend-test/` scripts.

## Quick commands (from repo root)

```bash
bash .cursor/skills/mahaverse-api-db-audit/scripts/map-php-databases.sh
bash .cursor/skills/mahaverse-api-db-audit/scripts/ping-endpoints.sh \
  --prod-base "https://www.example.com/mahaverse-backend" \
  --test-base "https://www.example.com/mahaverse-backend-test"
```

Set real URLs for your hosting. Override timeout: `CURL_TIMEOUT=15`.

## HTTP status expectations

Rigid “only 200” is misleading for this codebase:

| Pattern | Typical codes | Meaning |
|--------|-----------------|--------|
| Preflight | `204` | `OPTIONS` CORS |
| Readable without auth | `200` / JSON | `login.php`, `verify.php`, some lookups |
| Protected | `401` / `403` | Valid route, needs token/session |
| Wrong method | `405` | Route exists; try `OPTIONS` or correct verb |
| Missing params | `400` | Endpoint reached PHP validation |

Treat **`000`** (connection/TLS failure), **`404`** (wrong path/deploy), and **`500`** + body errors as **failures** for smoke tests.

**Recommended checks**

- `OPTIONS` each script → expect **204** or **200** with CORS.
- Optionally `GET` where safe → expect **200**, **401/403**, or **400** (not 404/500/000).

The ping script prints each status; you classify pass/fail per policy.

## Database map expectations

- Many files **inline** `$host`, `$dbname` / `$database`.
- **`config.php` `getDBConnection()`** is canonical for files that call it; some scripts **duplicate** credentials (historical) — the map script flags **per-file** literals.
- **`getenv('DB_*')`** or **`db.php`** cannot be resolved statically; the script notes **unknown** for those rows.

After changes, grep that **`backend-test`** schedulers (`add-session.php`) and **clients** APIs (`get-clients.php`, `update-clients.php`) target the **same** host/db as intended (see project history on test DB parity).

## Exclusions

Scripts skip obvious **includes** (not direct HTTP targets): `rbac_helpers.php`, `drive_helper.php`, `config.php`, `db.php`. Adjust `EXCLUDE` in `map-php-databases.sh` / `ping-endpoints.sh` if needed.

## Report output (required)

After running the scripts, **always** write a human-readable summary to the repo **`report/`** folder:

- Filename: `report/API-DB-AUDIT-YYYY-MM-DD.md` (use audit date in UTC)
- Save raw script output alongside when useful:
  - `report/.db-map-latest.tsv`
  - `report/.ping-latest.tsv`
- Include: DB targets (prod vs test), HTTP pass/fail table, prod vs test auth comparison, and concrete next steps (deploy, migrations, failing endpoints).

Use [report/API-DB-AUDIT-2026-06-04.md](../../../report/API-DB-AUDIT-2026-06-04.md) as a template.

## Additional reference

- For sample output interpretation and CI integration ideas, see [reference.md](reference.md).

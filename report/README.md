# Reports

Audit and status outputs from automated checks (API/DB audits, E2E runs, etc.).

| File | Description |
|------|-------------|
| `API-DB-AUDIT-YYYY-MM-DD.md` | Prod vs test HTTP + database wiring audit |
| `API-STATUS-REPORT-PROD-YYYY-MM-DD.md` | Full prod endpoint matrix (no token + with token) |
| `.db-map-latest.tsv` | Latest per-PHP host/database map (generated) |
| `.ping-latest.tsv` | Latest endpoint OPTIONS/GET status matrix (generated) |

New audits: run the [mahaverse-api-db-audit](../.cursor/skills/mahaverse-api-db-audit/SKILL.md) skill and save dated `.md` here.

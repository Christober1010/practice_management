---
name: start-application
description: >-
  Starts the Mahaverse local Java development stack (MySQL, Spring Boot API on
  :8080, Next.js UI on :3000 via pnpm run dev:java). Use when the user says
  "start application", "start the app", "start java setup", "start backend ui
  and db", "run java stack", or asks to boot local MySQL + Java API + UI.
---

# Start application (Java stack)

When this skill is invoked, **start the full local Java setup**: DB + Spring Boot backend + Next.js UI. Do not start the PHP backends (`dev:test` / `dev:prod`) unless the user explicitly asks for PHP.

## Do this immediately

From the **Mahaverse repo root**, run:

```bash
bash .cursor/skills/start-application/scripts/start-java-stack.sh
```

The script:

1. Ensures `.env.java` exists (`NEXT_PUBLIC_API_MODE=java`, `NEXT_PUBLIC_BASE_URL=http://localhost:8080`)
2. Starts MySQL via `scripts/db/local_mysql_start.sh` (container `mahaverse-mysql`)
3. Imports `db/ionos-schema.sql` if the `clients` table is missing
4. Seeds `admin@mahaverse.local` / `Admin123!` if `users` is empty
5. Starts Spring Boot in Docker (`mahaverse-api`, host network, port **8080**)
6. Starts `pnpm run dev:java` on port **3000**
7. Waits until health checks pass

## Verify

After the script succeeds, confirm:

```bash
curl -sf http://127.0.0.1:8080/actuator/health
curl -sf -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
```

Optional login smoke test:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@mahaverse.local","password":"Admin123!"}'
```

## Report to the user

Keep it short:

- UI: `http://localhost:3000`
- API: `http://localhost:8080`
- Login: `admin@mahaverse.local` / `Admin123!`

## If something fails

| Symptom | Action |
|---------|--------|
| Port 8080 / name conflict | `docker rm -f mahaverse-api` then re-run the script |
| MySQL not ready | Re-run `./scripts/db/local_mysql_start.sh`; check `docker logs mahaverse-mysql` |
| Schema missing | Need `db/ionos-schema.sql` then `./scripts/db/local_mysql_import_schema.sh` |
| UI won’t start | Check log under `$TMPDIR/mahaverse-start/next-dev-java.log`; ensure `pnpm install` once |
| API container dies | `docker logs mahaverse-api` |

Do **not** switch the UI to PHP `.env.test` / `.env.prod` while running this skill.

## Related

- Migration status: `docs/JAVA_MIGRATION_CHECKLIST.md`
- Java backend notes: `java-backend/README.md`

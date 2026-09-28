# Launchpad (Java standalone)

Standalone **Maha Launchpad** stack: Next.js UI + Spring Boot API + MySQL.

Runs in parallel with the integrated Mahaverse Launchpad (`app/launchpad` + PHP). Do not break the IONOS deploy when working here.

## Layout

```
Launchpad/
  ui/                 # Next.js static-export UI (port 3001)
  api/launchpad-api/  # Spring Boot 3.5 / Java 21 (port 8081)
  db/                 # schema, migrations, seed, docker init
  deploy/             # Dockerfiles + ECS task skeleton
  docker-compose.yml
```

## Quick start (Docker)

If you have the Compose plugin:

```bash
cd Launchpad
docker compose up -d --build mysql api
```

If `docker compose` is unavailable, use the helper script:

```bash
cd Launchpad
bash scripts/start-local.sh
```

- API: http://localhost:8081
- Health: http://localhost:8081/actuator/health
- MySQL: localhost:3307 / db `launchpad` / user `launchpad` / pass `launchpad`

Seed login:

- email: `admin@launchpad.local`
- password: `Admin123!`

UI (local Node):

```bash
cd ui
npm install
npm run dev
```

Open http://localhost:3001 — set `NEXT_PUBLIC_LAUNCHPAD_API_URL=http://localhost:8081`.

Full stack including nginx UI image:

```bash
docker compose --profile full up -d --build
```

## Environment (API / RDS)

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default `8081`) |
| `LAUNCHPAD_DB_HOST` | MySQL/RDS host |
| `LAUNCHPAD_DB_PORT` | MySQL port (default `3306`, local compose maps host `3307`) |
| `LAUNCHPAD_DB_NAME` | Database name |
| `LAUNCHPAD_DB_USER` / `LAUNCHPAD_DB_PASS` | Credentials |
| `LAUNCHPAD_CORS_ORIGINS` | Comma-separated origins or `*` |
| `LAUNCHPAD_UPLOAD_DIR` | Attachment storage path |
| `SSN_ENCRYPTION_KEY` | Base64 32-byte AES-GCM key |
| `LAUNCHPAD_SMTP_FROM` / Spring mail props | Reminder / OTP email |

No DB passwords are hardcoded in application source.

## Auth

Standalone email/password only. Mahaverse SSO (`sso_login`) is **deferred** until Mahaverse migrates to Java.

## API surface

REST under `/api/v1/...` plus PHP-compat aliases under `/backend/*.php` for the existing UI client.

See [PARITY.md](PARITY.md).

## AWS

Artifacts under `deploy/`:

- `Dockerfile.api` — multi-stage Temurin 21 JAR
- `Dockerfile.ui` — Next static export + nginx
- `ecs-task-definition.json` — Fargate skeleton (API + SSM secrets for RDS)

Typical target: **ECS Fargate (API) + RDS MySQL + S3/CloudFront (UI)** or UI container behind ALB.

## Future work

- Wire real Google Drive OAuth credentials in production
- Re-enable Mahaverse → Launchpad SSO after Mahaverse Java cutover
- Prefer a live export of Launchpad `Staff` schema if column drift appears vs PHP

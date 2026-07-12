# Launchpad → Mahaverse Integration

Launchpad is now **fully integrated** into the Mahaverse app as a unified single application.

## Architecture

- Launchpad routes are available at `/launchpad/*` within the main Mahaverse app
- Single authentication system: All users log in through the unified Mahaverse login at `/`
- Launchpad backend API endpoints are accessed via environment configuration

## Build

From repo root:

```bash
pnpm build
```

This produces a single deployable folder:

- `out/` (Mahaverse with integrated Launchpad)

## Deploy (shared hosting)

Upload the **contents** of `out/` to your web root (example: `htdocs/`).

Then deploy Launchpad PHP backend **into the `/launchpad/` folder**:

```
htdocs/
  index.html                (Mahaverse)
  _next/...
  launchpad/
    index.html              (Launchpad routes)
    _next/...
    backend/                <-- Launchpad PHP backend files
    vendor/                 <-- Composer dependencies
    .env                    <-- Launchpad backend .env file
```

### Important

- Launchpad backend expects Composer at: `launchpad/vendor/autoload.php`
- Launchpad backend env file should live at: `launchpad/backend/.env`
- Backend files should be deployed separately (they are PHP files, not part of the Next.js build)

## Authentication

- **Single Login**: All users authenticate through `/` (Mahaverse login)
- **Automatic Bridge**: On login, the system authenticates both Mahaverse and Launchpad backends
- **SSO**: If accessing Launchpad routes with a Mahaverse session, Launchpad tokens are automatically created via SSO

## Environment Variables

Configure Launchpad backend URL:

- `NEXT_PUBLIC_LAUNCHPAD_API_URL`: Explicit Launchpad backend URL (e.g., `https://launchpad.mahabehavioralhealth.com`)
- `NEXT_PUBLIC_LAUNCHPAD_USE_SAME_ORIGIN=true`: Use same-origin backend (defaults to `/launchpad/backend/`)
- `NEXT_PUBLIC_LAUNCHPAD_BASE_PATH`: Base path for Launchpad routes (default: `/launchpad`)
- `NEXT_PUBLIC_LAUNCHPAD_SSO_SECRET`: Optional shared secret sent as `X-SSO-Secret` to `sso_login.php` (must match `LAUNCHPAD_SSO_SECRET` in Launchpad `backend/.env`)

## CORS (Mahaverse → Launchpad backend)

When Mahaverse is served from one host (e.g. `http://mahaverse.mahabehavioralhealth.com`) and Launchpad PHP lives at `https://launchpad.mahabehavioralhealth.com/backend/`, the browser sends a cross-origin `POST` to `sso_login.php`. Launchpad `config.php` must allow that **exact** origin (including **http** vs **https**).

After changing Launchpad backend PHP, upload **`app/launchpad/backend/` in full** (or at minimum the files below) to `launchpad.mahabehavioralhealth.com/backend/`:

| File | Required |
|------|----------|
| `config.php` | Yes |
| `cors_helpers.php` | Yes |
| `rbac_helpers.php` | Yes (for DB-backed Role Access; config has a legacy fallback if missing) |
| `sso_login.php` | Yes, for Mahaverse → Launchpad switch |
| `login.php`, `logout.php` | Yes |
| `rbac-matrix.php`, `rbac-save-role.php`, `me-permissions.php` | If using Role Access admin |

**Do not upload files one at a time** — partial deploys cause 500s when `config.php` references missing includes.

**SSO env (optional):** `LAUNCHPAD_SSO_SECRET` in `backend/.env` is **not required**. When unset, `sso_login.php` accepts requests without `X-SSO-Secret`. Set it only if you also bake `NEXT_PUBLIC_LAUNCHPAD_SSO_SECRET` into the Mahaverse frontend build.

**Launchpad user must exist:** SSO looks up `Users.email` in the **Launchpad** database (`dbs15042247`), not Mahaverse `users`. The Mahaverse login email must match an active Launchpad `Users` row or SSO returns **401**.

**Quick workaround:** open Mahaverse over **HTTPS** (`https://mahaverse.mahabehavioralhealth.com`) — that origin is already on the live allowlist.

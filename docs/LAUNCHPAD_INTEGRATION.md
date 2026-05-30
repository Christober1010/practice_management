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

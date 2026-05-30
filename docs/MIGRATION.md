# Database migrations

SQL scripts live under `migration/` — not beside PHP in `backend/`, `backend-test/`, or `app/launchpad/backend/`.

## Mahaverse (main app)

| Folder | Use |
|--------|-----|
| `migration/shared/` | Same migration for **test and prod** |
| `migration/test/` | Test-only or test-specific variants |
| `migration/prod/` | Prod-only scripts and prod-specific variants |

Launchpad SQL: [`docs/MIGRATION-LAUNCHPAD.md`](MIGRATION-LAUNCHPAD.md) → `migration/launchpad/`.

Track what has been applied in [`MIGRATION-TEST-APPLIED.md`](MIGRATION-TEST-APPLIED.md) and [`MIGRATION-PROD-APPLIED.md`](MIGRATION-PROD-APPLIED.md).

## Workflow

1. **New feature on test** — add SQL to `migration/shared/` (or `migration/test/` if test-only). Run against test DB. Mark in `MIGRATION-TEST-APPLIED.md`.
2. **Promote to prod** — deploy PHP (`backend-test/` logic → `backend/`), then run any new `shared/` files (and `prod/` if listed) against prod DB. Mark in `MIGRATION-PROD-APPLIED.md`.
3. **Do not** add new `.sql` files under `backend/`, `backend-test/`, or `app/launchpad/backend/`.

## Run (Ionos phpMyAdmin or mysql CLI)

```bash
# Shared migration on test DB
mysql -h HOST -u USER -p DATABASE < migration/shared/sessions_add_auth_id.sql

# Test-only
mysql -h HOST -u USER -p DATABASE < migration/test/migrate-staff-prod-to-test-parity.sql
```

## Files that differ between test and prod

These exist in both `test/` and `prod/` with different content — use the folder that matches the target database:

- `add-insurance-document-columns.sql`
- `add-insurance-form-fields.sql`
- `add-staff-personal-fields.sql`
- `migrate_behavior_reduction_rbac.sql`
- `migrate_reports_client_provider_payer_payment_v2.sql`

## Active release checklist

See `docs/MIGRATIONS-CHECKLIST.md` for the current promotion queue.

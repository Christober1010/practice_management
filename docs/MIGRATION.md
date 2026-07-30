# Database migrations

SQL scripts live under `migration/` — not beside PHP in `backend/`, `backend-test/`, or `app/launchpad/backend/`.

Filenames are ordered by creation time: `YYYYMMDD_HHMMSS_<name>.sql`.

## Mahaverse (main app)

| Folder | Use |
|--------|-----|
| `migration/shared/` | Same migration for **test and prod** |
| `migration/test/` | Test-only or test-specific variants |
| `migration/prod/` | Prod-only scripts and prod-specific variants |

Launchpad SQL: [`docs/MIGRATION-LAUNCHPAD.md`](MIGRATION-LAUNCHPAD.md) → `migration/launchpad/`.

Track what has been applied and what code has been pushed in [`MIGRATION-FOLLOWUP.md`](MIGRATION-FOLLOWUP.md).

## Workflow

1. **New feature on test** — add SQL to `migration/shared/` (or `migration/test/` if test-only). Run against test DB. Update [`MIGRATION-FOLLOWUP.md`](MIGRATION-FOLLOWUP.md).
2. **Promote to prod** — deploy PHP (`backend-test/` logic → `backend/`), then run any new `shared/` files (and `prod/` if listed) against prod DB. Update the follow-up sheet.
3. **Do not** add new `.sql` files under `backend/`, `backend-test/`, or `app/launchpad/backend/`.

## Run (Ionos phpMyAdmin or mysql CLI)

```bash
# Shared migration on test DB
mysql -h HOST -u USER -p DATABASE < migration/shared/20260530_204937_sessions_add_auth_id.sql

# Test-only
mysql -h HOST -u USER -p DATABASE < migration/test/20260412_215308_migrate-staff-prod-to-test-parity.sql
```

## Files that differ between test and prod

These exist in both `test/` and `prod/` with different content — use the folder that matches the target database:

- `add-insurance-document-columns.sql`
- `add-insurance-form-fields.sql`
- `add-staff-personal-fields.sql`
- `migrate_behavior_reduction_rbac.sql`
- `migrate_reports_client_provider_payer_payment_v2.sql`

## Active follow-up sheet

See [`MIGRATION-FOLLOWUP.md`](MIGRATION-FOLLOWUP.md) for watermarks, deploy log, and the full applied/not-applied registry.

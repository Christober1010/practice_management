# Launchpad database migrations

SQL for the Launchpad app (`app/launchpad/backend/` PHP only — no `.sql` beside PHP).

Track applied migrations and deploys in [`MIGRATION-FOLLOWUP.md`](MIGRATION-FOLLOWUP.md) (Launchpad sections).

## Layout

| Folder | Use |
|--------|-----|
| `migration/launchpad/shared/` | Schema and seeds for both Launchpad environments |
| `migration/launchpad/test/` | Test-only (e.g. `20260124_220117_create_test_users.sql`) |
| `migration/launchpad/prod/` | Prod-only one-offs (e.g. `20251221_193056_fix_admin_password.sql`) |

## Bootstrap order (typical fresh install)

1. `shared/20251221_193056_create_users_table.sql`
2. `shared/20260729_222608_create_rbac_tables.sql`
3. `shared/20260113_202900_create_auth_tokens_table.sql`
4. `shared/20251221_203822_create_password_resets_table.sql`
5. Remaining `shared/*.sql` as needed for features in use
6. `shared/20260331_220701_seed_rbac_launchpad_grants.sql` — RBAC grants for Launchpad scope

Test: optionally run `test/20260124_220117_create_test_users.sql` after users table exists.

## Run

```bash
mysql -h HOST -u USER -p LAUNCHPAD_DB < migration/launchpad/shared/20251221_193056_create_users_table.sql
```

Mahaverse main app migrations stay under `migration/shared/`, `migration/test/`, and `migration/prod/` — see [`MIGRATION.md`](MIGRATION.md).

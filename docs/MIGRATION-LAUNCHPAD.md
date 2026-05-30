# Launchpad database migrations

SQL for the Launchpad app (`app/launchpad/backend/` PHP only — no `.sql` beside PHP).

## Layout

| Folder | Use |
|--------|-----|
| `migration/launchpad/shared/` | Schema and seeds for both Launchpad environments |
| `migration/launchpad/test/` | Test-only (e.g. `create_test_users.sql`) |
| `migration/launchpad/prod/` | Prod-only one-offs (e.g. `fix_admin_password.sql`) |

## Bootstrap order (typical fresh install)

1. `shared/create_users_table.sql`
2. `shared/create_rbac_tables.sql`
3. `shared/create_auth_tokens_table.sql`
4. `shared/create_password_resets_table.sql`
5. Remaining `shared/*.sql` as needed for features in use
6. `shared/seed_rbac_launchpad_grants.sql` — RBAC grants for Launchpad scope

Test: optionally run `test/create_test_users.sql` after users table exists.

## Run

```bash
mysql -h HOST -u USER -p LAUNCHPAD_DB < migration/launchpad/shared/create_users_table.sql
```

Mahaverse main app migrations stay under `migration/shared/`, `migration/test/`, and `migration/prod/` — see [`MIGRATION.md`](MIGRATION.md).

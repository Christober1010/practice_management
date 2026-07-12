# Migrations checklist

Paths are under `migration/`. See [`MIGRATION.md`](MIGRATION.md) for layout.

| #   | SQL file                                                       | Prod | Test |
| --- | -------------------------------------------------------------- | ---- | ---- |
| 1   | `migration/shared/create_auth_tokens_table.sql`                | ⬜    | ⬜    |
| 2   | `migration/shared/create_rbac_tables.sql`                      | ⬜    | ⬜    |
| 3   | `migration/shared/migrate_rbac_matrix_v1.sql`                  | ⬜    | ⬜    |
| 4   | `migration/prod/alter-clients-client-status-varchar.sql`       | ⬜    | n/a  |
| 5   | `migration/test/migrate-staff-prod-to-test-parity.sql`         | n/a  | ⬜    |
| 6   | `migration/shared/sessions_add_authorized_hours.sql`           | ⬜    | ⬜    |
| 6b  | `migration/shared/sessions_add_auth_id.sql`                    | ⬜    | ⬜    |
| 6c  | `migration/shared/sessions_add_recurring_id.sql`             | ⬜    | ⬜    |
| 7   | `migration/shared/sessions_add_claim_columns.sql`              | ⬜    | ⬜    |
| 8   | `migration/shared/migrate_schedule_tracker_payer_payments_v1.sql` | ⬜ | ⬜    |
| 8b  | `migration/shared/migrate_schedule_tracker_status_v1.sql`       | ⬜ | ⬜    |
| 9   | `migration/prod/migrate_reports_client_provider_payer_payment_v2.sql` / `migration/test/…` | ⬜ | ⬜ |
| 10  | `migration/shared/add-domain-module_id.sql`                    | ⬜    | ⬜    |
| 11  | `migration/shared/create-behavior-reduction-tables.sql`        | ⬜    | ⬜    |
| 12  | `migration/prod/migrate_behavior_reduction_rbac.sql` / `migration/test/…` | ⬜ | ⬜ |

Mark applied runs in [`MIGRATION-PROD-APPLIED.md`](MIGRATION-PROD-APPLIED.md) and [`MIGRATION-TEST-APPLIED.md`](MIGRATION-TEST-APPLIED.md).

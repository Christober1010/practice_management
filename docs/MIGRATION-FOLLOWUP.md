# Migration & deploy follow-up

Living tracker for **what SQL has been run** and **what code has been pushed** on test (dev) vs prod.
Update this file every time you apply a migration or deploy.

Related: [`MIGRATION.md`](MIGRATION.md) · [`MIGRATION-LAUNCHPAD.md`](MIGRATION-LAUNCHPAD.md)

---

## At a glance

Fill these first — this is the quick answer to “how far are we?”

| Env | DB | Last migration applied (filename) | Applied on | Code last pushed (date) | Commit / note |
|-----|-----|-----------------------------------|------------|-------------------------|---------------|
| **Test (dev)** | `dbs14649042` | `20260729_222622_rbac_report_view_permissions.sql` | 2026-07-30 | 2026-07-30 | In sync — all migrations through watermark applied |
| **Prod** | `dbs14484433` | `20260729_222622_rbac_report_view_permissions.sql` | 2026-07-30 | 2026-07-30 | In sync with test |

**Gap check:** none — test and prod are at the same watermark.

| Env | Launchpad last migration | Applied on | Code last pushed | Commit / note |
|-----|--------------------------|------------|------------------|---------------|
| Launchpad test | `20260729_222608_create_rbac_tables.sql` | 2026-07-30 | 2026-07-30 | In sync |
| Launchpad prod | `20260729_222608_create_rbac_tables.sql` | 2026-07-30 | 2026-07-30 | In sync |

---

## How to use

1. After running SQL on test or prod → mark ✅ in the registry below, set the date, then update **At a glance**.
2. After deploying PHP/frontend → add a row to the **Deploy / change log** and refresh **Code last pushed**.
3. Prefer one watermark filename per env (latest applied). Older rows stay ✅ for history.
4. New migration files: append a row to the matching registry section (keep timestamp order).

Status: ⬜ not run · ✅ applied · n/a not for that env · ⏭️ skipped (note why)

---

## Deploy / change log

Newest first. One row per push or migration batch.

| Date | Env | Type | What changed | Migrations run | Notes |
|------|-----|------|--------------|----------------|-------|
| 2026-07-30 | test + prod | both | Baseline: environments confirmed up to date | Through `20260729_222622_rbac_report_view_permissions.sql` (Mahaverse) and `20260729_222608_create_rbac_tables.sql` (Launchpad) | Starting point for this follow-up sheet — no open gap |
| | | code / SQL / both | | | |

Examples of **Type**: `code` (backend/frontend only), `SQL` (DB only), `both`.

---

## Mahaverse — migration registry

Paths are under `migration/`. Filenames are `YYYYMMDD_HHMMSS_<name>.sql`.

### Shared (run on **both** test and prod)

#### Baseline batch (`20260325_205126_*` — early schema / one-off fixes)

Confirmed applied on both DBs as of 2026-07-30.

| # | File | Test | Prod | Test date | Prod date | Notes |
|---|------|:----:|:----:|-----------|-----------|-------|
| 1 | `migration/shared/20260325_205126_add-archived-to-reports.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 2 | `migration/shared/20260325_205126_add-client-documents-original-filename.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 3 | `migration/shared/20260325_205126_add-client-management-fields.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 4 | `migration/shared/20260325_205126_add-insured-person-fields.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 5 | `migration/shared/20260325_205126_add-staff-document-types.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 6 | `migration/shared/20260325_205126_convert-master-assign-service-code-to-uuid-simple.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 7 | `migration/shared/20260325_205126_convert-master-assign-service-code-to-uuid.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 8 | `migration/shared/20260325_205126_create-client-target-prompts-table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 9 | `migration/shared/20260325_205126_create-client-target-tasks-table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 10 | `migration/shared/20260325_205126_create-document-types-table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 11 | `migration/shared/20260325_205126_create-facility-types-table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 12 | `migration/shared/20260325_205126_create-locations-table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 13 | `migration/shared/20260325_205126_create-session-notes-table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 14 | `migration/shared/20260325_205126_create-treatment-types-table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 15 | `migration/shared/20260325_205126_create_google_drive_oauth_tokens_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 16 | `migration/shared/20260325_205126_create_staff_documents_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 17 | `migration/shared/20260325_205126_fix-client-documents-paths.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 18 | `migration/shared/20260325_205126_fix-client-domains-constraint.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 19 | `migration/shared/20260325_205126_remove-module-id-from-domains-correct.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 20 | `migration/shared/20260325_205126_remove-module-id-from-domains-manual.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 21 | `migration/shared/20260325_205126_remove-module-id-from-domains-simple.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 22 | `migration/shared/20260325_205126_remove-module-id-from-domains.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |

#### Active / later shared migrations

| # | File | Test | Prod | Test date | Prod date | Notes |
|---|------|:----:|:----:|-----------|-----------|-------|
| 1 | `migration/shared/20260405_113210_create_auth_tokens_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 2 | `migration/shared/20260419_230346_sessions_add_authorized_hours.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 3 | `migration/shared/20260428_205800_migrate_schedule_tracker_payer_payments_v1.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 4 | `migration/shared/20260522_212413_add-domain-module_id.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 5 | `migration/shared/20260524_193000_create-behavior-reduction-tables.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 6 | `migration/shared/20260530_203018_sessions_add_claim_columns.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 7 | `migration/shared/20260530_204937_sessions_add_auth_id.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 8 | `migration/shared/20260530_205506_sessions_add_scheduled_rendered_hours.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 9 | `migration/shared/20260606_130846_sessions_add_recurring_id.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 10 | `migration/shared/20260610_205511_sessions_add_diagnosis_pointer.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 11 | `migration/shared/20260610_214852_sessions_add_rendering_id_qualifier.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 12 | `migration/shared/20260610_215523_sessions_add_service_rates.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 13 | `migration/shared/20260610_220408_staff_add_taxonomy_code.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 14 | `migration/shared/20260610_220713_sessions_add_taxonomy_code.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 15 | `migration/shared/20260610_220714_master_providers_add_edi_flags.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 16 | `migration/shared/20260614_191654_sessions_add_auth_service_code.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 17 | `migration/shared/20260624_215133_migrate_schedule_tracker_status_v1.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 18 | `migration/shared/20260628_182024_migrate_schedule_tracker_ap_v1.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 19 | `migration/shared/20260703_214946_migrate_schedule_tracker_payer_payments_v3_drop_legacy_unique.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 20 | `migration/shared/20260716_212820_migrate_session_log_v1.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 21 | `migration/shared/20260718_221811_migrate_session_log_payments_v1.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 22 | `migration/shared/20260720_220536_provider_service_code_add_billable_auth.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 23 | `migration/shared/20260720_220542_create-manage-data-tables.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 24 | `migration/shared/20260720_222819_sessions_add_exclude_session.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 25 | `migration/shared/20260722_230003_migrate_users_role_varchar_v1.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 26 | `migration/shared/20260723_215313_sessions_add_service_type.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 27 | `migration/shared/20260725_211107_rbac_rbt_clients_view_self.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 28 | `migration/shared/20260729_222552_create_rbac_tables.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 29 | `migration/shared/20260729_222552_migrate_rbac_matrix_v1.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 30 | `migration/shared/20260729_222622_rbac_report_view_permissions.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |

### Test-only (`migration/test/`)

| # | File | Test | Date | Notes |
|---|------|:----:|------|-------|
| 1 | `migration/test/20260222_141529_add-insurance-document-columns.sql` | ✅ | 2026-07-30 | Confirmed current |
| 2 | `migration/test/20260314_185226_add-insurance-form-fields.sql` | ✅ | 2026-07-30 | Confirmed current |
| 3 | `migration/test/20260321_112645_add-staff-personal-fields.sql` | ✅ | 2026-07-30 | Confirmed current |
| 4 | `migration/test/20260412_215308_migrate-staff-prod-to-test-parity.sql` | ✅ | 2026-07-30 | Confirmed current |
| 5 | `migration/test/20260504_214645_migrate_reports_client_provider_payer_payment_v2.sql` | ✅ | 2026-07-30 | Confirmed current |
| 6 | `migration/test/20260524_195718_migrate_behavior_reduction_rbac.sql` | ✅ | 2026-07-30 | Confirmed current |

### Prod-only (`migration/prod/`)

| # | File | Prod | Date | Notes |
|---|------|:----:|------|-------|
| 1 | `migration/prod/20260212_225536_export-missing-tables-schema.sql` | ✅ | 2026-07-30 | Confirmed current (helper / verify) |
| 2 | `migration/prod/20260212_225536_quick-export-missing-tables.sql` | ✅ | 2026-07-30 | Confirmed current (helper / verify) |
| 3 | `migration/prod/20260228_105537_prod-client-management-migration.sql` | ✅ | 2026-07-30 | Confirmed current |
| 4 | `migration/prod/20260228_110133_prod-client-management-migration-simple.sql` | ✅ | 2026-07-30 | Confirmed current |
| 5 | `migration/prod/20260325_205313_add-insurance-document-columns.sql` | ✅ | 2026-07-30 | Confirmed current |
| 6 | `migration/prod/20260325_205313_add-insurance-form-fields.sql` | ✅ | 2026-07-30 | Confirmed current |
| 7 | `migration/prod/20260409_200246_verify_rbac_auth_deploy.sql` | ✅ | 2026-07-30 | Confirmed current (helper / verify) |
| 8 | `migration/prod/20260412_201107_alter-clients-client-status-varchar.sql` | ✅ | 2026-07-30 | Confirmed current |
| 9 | `migration/prod/20260412_215312_add-staff-personal-fields.sql` | ✅ | 2026-07-30 | Confirmed current |
| 10 | `migration/prod/20260524_195718_migrate_behavior_reduction_rbac.sql` | ✅ | 2026-07-30 | Confirmed current |
| 11 | `migration/prod/20260530_204206_migrate_reports_client_provider_payer_payment_v2.sql` | ✅ | 2026-07-30 | Confirmed current |
| 12 | `migration/prod/20260530_214134_apply_rbac_and_token_auth.sql` | ✅ | 2026-07-30 | Confirmed current (helper / verify) |
| 13 | `migration/prod/20260720_220718_create-all-missing-tables-complete.sql` | ✅ | 2026-07-30 | Confirmed current |

---

## Launchpad — migration registry

See also [`MIGRATION-LAUNCHPAD.md`](MIGRATION-LAUNCHPAD.md). Paths under `migration/launchpad/`.

| # | File | Test | Prod | Test date | Prod date | Notes |
|---|------|:----:|:----:|-----------|-----------|-------|
| 1 | `migration/launchpad/prod/20251221_193056_fix_admin_password.sql` | n/a | ✅ | | 2026-07-30 | Confirmed current |
| 2 | `migration/launchpad/shared/20251221_193056_create_users_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 3 | `migration/launchpad/shared/20251221_203822_create_password_resets_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 4 | `migration/launchpad/shared/20260113_201606_add_staff_created_by_user_id.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 5 | `migration/launchpad/shared/20260113_202900_create_auth_tokens_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 6 | `migration/launchpad/shared/20260118_194410_create_staff_attachments_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 7 | `migration/launchpad/shared/20260124_122600_add_staff_job_title_status.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 8 | `migration/launchpad/shared/20260125_192624_add_staff_ssn_encrypted.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 9 | `migration/launchpad/shared/20260125_201151_create_staff_share_keys_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 10 | `migration/launchpad/shared/20260126_185436_create_google_drive_oauth_tokens_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 11 | `migration/launchpad/shared/20260205_123417_create_staff_offer_acceptances_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 12 | `migration/launchpad/shared/20260207_181051_create_staff_offer_initiations_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 13 | `migration/launchpad/shared/20260331_220701_seed_rbac_launchpad_grants.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 14 | `migration/launchpad/shared/20260629_214125_create_client_intake_packets_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 15 | `migration/launchpad/shared/20260630_202520_create_client_intake_attachments_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 16 | `migration/launchpad/shared/20260709_225019_create_offer_letter_positions_table.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 17 | `migration/launchpad/shared/20260709_225956_alter_staff_offer_initiations_add_offer_body.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 18 | `migration/launchpad/shared/20260710_094114_seed_offer_letter_positions.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 19 | `migration/launchpad/shared/20260710_095911_alter_staff_offer_acceptances_add_ack_columns.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 20 | `migration/launchpad/shared/20260710_103024_update_bc_job_description.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 21 | `migration/launchpad/shared/20260729_222608_create_rbac_tables.sql` | ✅ | ✅ | 2026-07-30 | 2026-07-30 | Confirmed current |
| 22 | `migration/launchpad/test/20260124_220117_create_test_users.sql` | ✅ | n/a | 2026-07-30 | | Confirmed current |

---

## Quick promote checklist

When promoting a feature from test → prod:

1. [ ] Code deployed to prod (`backend/` + frontend as needed)
2. [ ] Every new `migration/shared/*.sql` since Prod’s watermark run on prod
3. [ ] Matching `migration/prod/*.sql` run if the feature has a prod-specific file
4. [ ] **At a glance** + **Deploy / change log** updated
5. [ ] Smoke-check the feature on prod

---

## Notes / known gaps

- 2026-07-30: Test and prod confirmed in sync through `20260729_222622_rbac_report_view_permissions.sql`. No open gaps.
-

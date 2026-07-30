-- 20260530_214134_apply_rbac_and_token_auth.sql
-- RBAC + AuthTokens live in migration/shared/.
--
--   mysql -u USER -p DATABASE < migration/shared/20260729_222552_create_rbac_tables.sql
--   mysql -u USER -p DATABASE < migration/shared/20260405_113210_create_auth_tokens_table.sql
--
-- Or use:  backend/scripts/apply_rbac_and_token_auth.sh

SELECT 'Run 20260729_222552_create_rbac_tables.sql and 20260405_113210_create_auth_tokens_table.sql from migration/shared/' AS instruction;

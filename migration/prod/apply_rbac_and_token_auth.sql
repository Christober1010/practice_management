-- apply_rbac_and_token_auth.sql
-- RBAC + AuthTokens live in migration/shared/.
--
--   mysql -u USER -p DATABASE < migration/shared/create_rbac_tables.sql
--   mysql -u USER -p DATABASE < migration/shared/create_auth_tokens_table.sql
--
-- Or use:  backend/scripts/apply_rbac_and_token_auth.sh

SELECT 'Run create_rbac_tables.sql and create_auth_tokens_table.sql from migration/shared/' AS instruction;

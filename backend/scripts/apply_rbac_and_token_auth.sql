-- apply_rbac_and_token_auth.sql
-- RBAC + AuthTokens are defined in two canonical files in backend/ (parent of scripts/).
--
-- Do NOT use SOURCE here unless your mysql client cwd is backend/; instead run:
--
--   mysql -u USER -p DATABASE < backend/create_rbac_tables.sql
--   mysql -u USER -p DATABASE < backend/create_auth_tokens_table.sql
--
-- Or use:  backend/scripts/apply_rbac_and_token_auth.sh
--

SELECT 'Run create_rbac_tables.sql and create_auth_tokens_table.sql from backend/' AS instruction;

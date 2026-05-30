# AuthTokens prerequisite (test DB)

Before deploying mandatory API auth on **backend-test**, ensure the test database has the token table:

```bash
mysql -h HOST -u USER -p dbs14649042 < migration/shared/create_auth_tokens_table.sql
```

Without `AuthTokens`, login still returns a token string but `getAuthenticatedUserFromToken()` cannot validate it — every protected endpoint will return **401**.

Verify in phpMyAdmin: `SHOW TABLES LIKE 'AuthTokens';`

Mark applied in [MIGRATION-TEST-APPLIED.md](MIGRATION-TEST-APPLIED.md) when run on test.

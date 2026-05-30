#!/usr/bin/env bash
# Apply RBAC + AuthTokens migrations to the database given on the command line.
# Usage (from repo root):
#   ./backend/scripts/apply_rbac_and_token_auth.sh -u MYUSER -p MYDB
#   ./backend/scripts/apply_rbac_and_token_auth.sh -u MYUSER -pPASS MYDB
#
# Arguments after the script name are passed straight to mysql (same as mysql CLI).

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SHARED="$REPO_ROOT/migration/shared"
mysql "$@" < "$SHARED/create_rbac_tables.sql"
mysql "$@" < "$SHARED/create_auth_tokens_table.sql"
echo "Applied: create_rbac_tables.sql, create_auth_tokens_table.sql"

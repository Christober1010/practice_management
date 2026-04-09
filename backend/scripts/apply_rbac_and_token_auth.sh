#!/usr/bin/env bash
# Apply RBAC + AuthTokens migrations to the database given on the command line.
# Usage (from anywhere):
#   ./backend/scripts/apply_rbac_and_token_auth.sh -u MYUSER -p MYDB
#   ./backend/scripts/apply_rbac_and_token_auth.sh -u MYUSER -pPASS MYDB
#
# Arguments after the script name are passed straight to mysql (same as mysql CLI).

set -euo pipefail
BACKEND="$(cd "$(dirname "$0")/.." && pwd)"
mysql "$@" < "$BACKEND/create_rbac_tables.sql"
mysql "$@" < "$BACKEND/create_auth_tokens_table.sql"
echo "Applied: create_rbac_tables.sql, create_auth_tokens_table.sql"

#!/usr/bin/env bash
set -euo pipefail

# Dump MySQL schema (no data) from the IONOS database using a disposable Docker container.
#
# IMPORTANT (IONOS shared hosting):
# Many IONOS Web Hosting / shared MySQL setups do NOT allow external access from your local machine.
# If this script fails with DNS (NXDOMAIN) or connection errors, export via IONOS phpMyAdmin instead:
# - IONOS → Hosting → Databases → phpMyAdmin → Export → Custom → "Structure" only → SQL
# Then save the file locally as `db/ionos-schema.sql` and run:
#   ./scripts/db/local_mysql_start.sh
#   ./scripts/db/local_mysql_import_schema.sh
#
# Required env vars (unless auto-detected from PHP config; see below):
#   IONOS_DB_HOST, IONOS_DB_NAME, IONOS_DB_USER, IONOS_DB_PASS
#
# Optional:
#   IONOS_DB_PORT (default: 3306)
#   IONOS_DB_SSL_MODE (default: PREFERRED)  # one of: DISABLED|PREFERRED|REQUIRED|VERIFY_CA|VERIFY_IDENTITY
#   OUT (default: db/ionos-schema.sql)
#   SOURCE_PHP_CONFIG (default: backend/config.php)  # used when IONOS_* env vars are missing
#
# Example:
#   export IONOS_DB_HOST="db....hosting-data.io"
#   export IONOS_DB_NAME="dbs123"
#   export IONOS_DB_USER="dbu123"
#   export IONOS_DB_PASS="***"
#   ./scripts/db/ionos_dump_schema.sh

IONOS_DB_PORT="${IONOS_DB_PORT:-3306}"
IONOS_DB_SSL_MODE="${IONOS_DB_SSL_MODE:-PREFERRED}"
OUT="${OUT:-db/ionos-schema.sql}"
SOURCE_PHP_CONFIG="${SOURCE_PHP_CONFIG:-backend/config.php}"

extract_php_var() {
  # Extract a PHP string assignment: $var = "value";
  # Usage: extract_php_var <file> <varname>
  local file="$1"
  local var="$2"
  python3 - "$file" "$var" <<'PY'
import re, sys
path = sys.argv[1]
var = sys.argv[2]
data = open(path, "r", encoding="utf-8", errors="ignore").read()
m = re.search(r'\$%s\s*=\s*"([^"]*)"\s*;' % re.escape(var), data)
if not m:
    m = re.search(r"\$%s\s*=\s*'([^']*)'\s*;" % re.escape(var), data)
if not m:
    sys.exit(2)
print(m.group(1))
PY
}

maybe_autodetect_from_php() {
  if [[ -n "${IONOS_DB_HOST:-}" && -n "${IONOS_DB_NAME:-}" && -n "${IONOS_DB_USER:-}" && -n "${IONOS_DB_PASS:-}" ]]; then
    return 0
  fi
  if [[ ! -f "$SOURCE_PHP_CONFIG" ]]; then
    return 0
  fi
  # Only fill missing values; do not overwrite explicit env vars.
  if [[ -z "${IONOS_DB_HOST:-}" ]]; then IONOS_DB_HOST="$(extract_php_var "$SOURCE_PHP_CONFIG" host 2>/dev/null || true)"; fi
  if [[ -z "${IONOS_DB_NAME:-}" ]]; then IONOS_DB_NAME="$(extract_php_var "$SOURCE_PHP_CONFIG" dbname 2>/dev/null || true)"; fi
  if [[ -z "${IONOS_DB_USER:-}" ]]; then IONOS_DB_USER="$(extract_php_var "$SOURCE_PHP_CONFIG" user 2>/dev/null || true)"; fi
  if [[ -z "${IONOS_DB_PASS:-}" ]]; then IONOS_DB_PASS="$(extract_php_var "$SOURCE_PHP_CONFIG" pass 2>/dev/null || true)"; fi
}

maybe_autodetect_from_php

: "${IONOS_DB_HOST:?Missing IONOS_DB_HOST (or unable to parse from $SOURCE_PHP_CONFIG)}"
: "${IONOS_DB_NAME:?Missing IONOS_DB_NAME (or unable to parse from $SOURCE_PHP_CONFIG)}"
: "${IONOS_DB_USER:?Missing IONOS_DB_USER (or unable to parse from $SOURCE_PHP_CONFIG)}"
: "${IONOS_DB_PASS:?Missing IONOS_DB_PASS (or unable to parse from $SOURCE_PHP_CONFIG)}"

mkdir -p "$(dirname "$OUT")"

echo "Dumping schema from ${IONOS_DB_HOST}:${IONOS_DB_PORT}/${IONOS_DB_NAME} -> ${OUT}"
echo "Using ssl-mode=${IONOS_DB_SSL_MODE}"

# NOTE: use MYSQL_PWD to avoid putting the password on the command line.
set +e
docker run --rm \
  -e MYSQL_PWD="$IONOS_DB_PASS" \
  mysql:8.0 \
  mysqldump \
    --host="$IONOS_DB_HOST" \
    --port="$IONOS_DB_PORT" \
    --user="$IONOS_DB_USER" \
    --ssl-mode="$IONOS_DB_SSL_MODE" \
    --no-data \
    --routines \
    --events \
    --triggers \
    --set-gtid-purged=OFF \
    "$IONOS_DB_NAME" \
  > "$OUT"
code=$?
set -e

if [[ $code -ne 0 ]]; then
  rm -f "$OUT" || true
  echo
  echo "Schema dump FAILED (exit=$code)."
  echo "If you're on IONOS Web Hosting/shared MySQL, external access may be blocked."
  echo "Use IONOS phpMyAdmin Export (structure only), then import locally with:"
  echo "  ./scripts/db/local_mysql_start.sh"
  echo "  ./scripts/db/local_mysql_import_schema.sh"
  exit "$code"
fi

echo "Schema dump complete: ${OUT}"


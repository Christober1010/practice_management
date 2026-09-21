#!/usr/bin/env bash
set -euo pipefail

# Import a schema SQL dump into the local MySQL container started by local_mysql_start.sh.
#
# Required:
#   IN (default: db/ionos-schema.sql)
#
# Optional env vars:
#   LOCAL_MYSQL_CONTAINER (default: mahaverse-mysql)
#   LOCAL_DB_ROOT_PASS (default: root)
#   LOCAL_DB_NAME (default: mahaverse)
#
# Example:
#   ./scripts/db/ionos_dump_schema.sh
#   ./scripts/db/local_mysql_start.sh
#   ./scripts/db/local_mysql_import_schema.sh

IN="${IN:-db/ionos-schema.sql}"
LOCAL_MYSQL_CONTAINER="${LOCAL_MYSQL_CONTAINER:-mahaverse-mysql}"
LOCAL_DB_ROOT_PASS="${LOCAL_DB_ROOT_PASS:-root}"
LOCAL_DB_NAME="${LOCAL_DB_NAME:-mahaverse}"

if [[ ! -f "$IN" ]]; then
  echo "Schema file not found: $IN"
  echo "Run: ./scripts/db/ionos_dump_schema.sh"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$LOCAL_MYSQL_CONTAINER"; then
  echo "MySQL container is not running: $LOCAL_MYSQL_CONTAINER"
  echo "Run: ./scripts/db/local_mysql_start.sh"
  exit 1
fi

echo "Importing schema $IN into ${LOCAL_MYSQL_CONTAINER}:${LOCAL_DB_NAME} ..."

# Stream the file into the container (no mysql client needed on host).
cat "$IN" | docker exec -i "$LOCAL_MYSQL_CONTAINER" \
  mysql -uroot -p"$LOCAL_DB_ROOT_PASS" "$LOCAL_DB_NAME"

echo "Schema import complete."


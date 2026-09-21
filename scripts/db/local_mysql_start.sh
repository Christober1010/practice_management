#!/usr/bin/env bash
set -euo pipefail

# Start a local MySQL 8 container for Mahaverse development.
#
# Optional env vars:
#   LOCAL_MYSQL_CONTAINER (default: mahaverse-mysql)
#   LOCAL_DB_PORT (default: 3306)
#   LOCAL_DB_NAME (default: mahaverse)
#   LOCAL_DB_USER (default: mahaverse)
#   LOCAL_DB_PASS (default: mahaverse)
#   LOCAL_DB_ROOT_PASS (default: root)
#
# Example:
#   ./scripts/db/local_mysql_start.sh

LOCAL_MYSQL_CONTAINER="${LOCAL_MYSQL_CONTAINER:-mahaverse-mysql}"
LOCAL_DB_PORT="${LOCAL_DB_PORT:-3306}"
LOCAL_DB_NAME="${LOCAL_DB_NAME:-mahaverse}"
LOCAL_DB_USER="${LOCAL_DB_USER:-mahaverse}"
LOCAL_DB_PASS="${LOCAL_DB_PASS:-mahaverse}"
LOCAL_DB_ROOT_PASS="${LOCAL_DB_ROOT_PASS:-root}"

if docker ps -a --format '{{.Names}}' | grep -qx "$LOCAL_MYSQL_CONTAINER"; then
  echo "Container already exists: $LOCAL_MYSQL_CONTAINER"
  if docker ps --format '{{.Names}}' | grep -qx "$LOCAL_MYSQL_CONTAINER"; then
    echo "Container already running."
    exit 0
  fi
  echo "Starting existing container..."
  docker start "$LOCAL_MYSQL_CONTAINER" >/dev/null
else
  echo "Starting MySQL container '$LOCAL_MYSQL_CONTAINER' on localhost:${LOCAL_DB_PORT}..."

  docker run -d \
    --name "$LOCAL_MYSQL_CONTAINER" \
    -p "${LOCAL_DB_PORT}:3306" \
    -e MYSQL_ROOT_PASSWORD="$LOCAL_DB_ROOT_PASS" \
    -e MYSQL_DATABASE="$LOCAL_DB_NAME" \
    -e MYSQL_USER="$LOCAL_DB_USER" \
    -e MYSQL_PASSWORD="$LOCAL_DB_PASS" \
    -v "${LOCAL_MYSQL_CONTAINER}-data:/var/lib/mysql" \
    mysql:8.0 \
    --default-authentication-plugin=mysql_native_password \
    --character-set-server=utf8mb4 \
    --collation-server=utf8mb4_unicode_ci \
    --sql-mode=""
fi

echo "Waiting for MySQL readiness..."
for i in {1..60}; do
  if docker exec "$LOCAL_MYSQL_CONTAINER" mysqladmin ping -uroot -p"$LOCAL_DB_ROOT_PASS" --silent >/dev/null 2>&1; then
    echo "MySQL is ready."
    echo "DB: mysql://localhost:${LOCAL_DB_PORT}/${LOCAL_DB_NAME} (user: ${LOCAL_DB_USER})"
    exit 0
  fi
  sleep 1
done

echo "MySQL did not become ready in time."
exit 1


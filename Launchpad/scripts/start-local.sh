#!/usr/bin/env bash
# Start Launchpad MySQL + API without docker compose plugin.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

if ! docker ps --format '{{.Names}}' | grep -qx launchpad-mysql; then
  if docker ps -a --format '{{.Names}}' | grep -qx launchpad-mysql; then
    docker start launchpad-mysql
  else
    docker run -d --name launchpad-mysql \
      -p 3307:3306 \
      -e MYSQL_ROOT_PASSWORD=root \
      -e MYSQL_DATABASE=launchpad \
      -e MYSQL_USER=launchpad \
      -e MYSQL_PASSWORD=launchpad \
      -v launchpad-mysql-data:/var/lib/mysql \
      -v "$ROOT/db/init:/docker-entrypoint-initdb.d:ro" \
      mysql:8.0 \
      --default-authentication-plugin=mysql_native_password \
      --character-set-server=utf8mb4 \
      --collation-server=utf8mb4_unicode_ci \
      --sql-mode=
  fi
fi

echo "Waiting for MySQL..."
for i in $(seq 1 60); do
  if docker exec launchpad-mysql mysqladmin ping -uroot -proot --silent >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker build -f "$ROOT/deploy/Dockerfile.api" -t launchpad-api:local "$ROOT"
docker rm -f launchpad-api >/dev/null 2>&1 || true
docker run -d --name launchpad-api --network host \
  -e PORT=8081 \
  -e LAUNCHPAD_DB_HOST=127.0.0.1 \
  -e LAUNCHPAD_DB_PORT=3307 \
  -e LAUNCHPAD_DB_NAME=launchpad \
  -e LAUNCHPAD_DB_USER=launchpad \
  -e LAUNCHPAD_DB_PASS=launchpad \
  -e LAUNCHPAD_CORS_ORIGINS='*' \
  -e LAUNCHPAD_UPLOAD_DIR=/data/uploads \
  -v launchpad-uploads:/data/uploads \
  launchpad-api:local

echo "Waiting for API..."
for i in $(seq 1 40); do
  if curl -sf http://127.0.0.1:8081/actuator/health >/dev/null; then
    echo "API up: http://localhost:8081"
    echo "UI:     cd ui && npm install && npm run dev  → http://localhost:3001"
    echo "Login:  admin@launchpad.local / Admin123!"
    exit 0
  fi
  sleep 2
done
echo "API failed to become healthy" >&2
docker logs launchpad-api >&2 || true
exit 1

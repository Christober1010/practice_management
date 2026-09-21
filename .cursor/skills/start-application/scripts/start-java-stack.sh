#!/usr/bin/env bash
# Start local Mahaverse Java stack: MySQL + Spring Boot API + Next.js UI.
# Usage (from repo root):
#   bash .cursor/skills/start-application/scripts/start-java-stack.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT"

API_NAME="${MAHAVERSE_API_CONTAINER:-mahaverse-api}"
DB_SCRIPT="$ROOT/scripts/db/local_mysql_start.sh"
ENV_JAVA="$ROOT/.env.java"

echo "==> Repo: $ROOT"

# --- .env.java ---
if [[ ! -f "$ENV_JAVA" ]]; then
  echo "==> Creating .env.java"
  cat > "$ENV_JAVA" <<'EOF'
NEXT_PUBLIC_API_MODE=java
NEXT_PUBLIC_BASE_URL=http://localhost:8080
EOF
  # Copy Maps key from another env file if present
  for f in .env.local .env.test .env.prod; do
    if [[ -f "$f" ]] && grep -q '^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=' "$f"; then
      grep '^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=' "$f" >> "$ENV_JAVA"
      break
    fi
  done
else
  if ! grep -q '^NEXT_PUBLIC_API_MODE=' "$ENV_JAVA"; then
    echo 'NEXT_PUBLIC_API_MODE=java' | cat - "$ENV_JAVA" > "$ENV_JAVA.tmp" && mv "$ENV_JAVA.tmp" "$ENV_JAVA"
  fi
fi

# --- MySQL ---
echo "==> Starting local MySQL"
bash "$DB_SCRIPT"

# Wait until mysql accepts queries
for i in {1..30}; do
  if docker exec mahaverse-mysql mysqladmin ping -uroot -proot --silent >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Import schema if clients table missing
TABLE_OK="$(docker exec mahaverse-mysql mysql -uroot -proot -N mahaverse -e "SHOW TABLES LIKE 'clients';" 2>/dev/null || true)"
if [[ -z "$TABLE_OK" ]]; then
  if [[ -f "$ROOT/db/ionos-schema.sql" ]]; then
    echo "==> Importing db/ionos-schema.sql"
    bash "$ROOT/scripts/db/local_mysql_import_schema.sh"
  else
    echo "WARNING: No schema and db/ionos-schema.sql missing. API may fail until schema is imported."
  fi
fi

# Seed admin if users empty
USER_COUNT="$(docker exec mahaverse-mysql mysql -uroot -proot -N mahaverse -e "SELECT COUNT(*) FROM users;" 2>/dev/null || echo 0)"
if [[ "${USER_COUNT:-0}" == "0" ]]; then
  echo "==> Seeding local admin user"
  docker exec -i mahaverse-mysql mysql -uroot -proot mahaverse <<'SQL' || true
INSERT INTO users (email, `PASSWORD`, role, first_name, last_name, is_active)
VALUES ('admin@mahaverse.local', 'Admin123!', 'admin', 'Local', 'Admin', 1)
ON DUPLICATE KEY UPDATE is_active=1;
SQL
fi

# --- Spring Boot API ---
echo "==> Starting Java API (Docker: $API_NAME)"
if docker ps -a --format '{{.Names}}' | grep -qx "$API_NAME"; then
  docker rm -f "$API_NAME" >/dev/null 2>&1 || true
fi

docker run -d --name "$API_NAME" --network host \
  -v "$ROOT":/workspace -w /workspace/java-backend/mahaverse-api \
  -e MAHAVERSE_DB_HOST=127.0.0.1 \
  -e MAHAVERSE_DB_PORT=3306 \
  -e MAHAVERSE_DB_NAME=mahaverse \
  -e MAHAVERSE_DB_USER=mahaverse \
  -e MAHAVERSE_DB_PASS=mahaverse \
  maven:3.9-eclipse-temurin-21 \
  mvn -q -DskipTests spring-boot:run >/dev/null

echo "==> Waiting for API on :8080"
API_OK=0
for i in {1..90}; do
  if curl -sf "http://127.0.0.1:8080/actuator/health" >/dev/null 2>&1; then
    API_OK=1
    break
  fi
  # surface early container death
  if ! docker ps --format '{{.Names}}' | grep -qx "$API_NAME"; then
    echo "ERROR: API container exited. Logs:"
    docker logs "$API_NAME" 2>&1 | tail -40 || true
    exit 1
  fi
  sleep 2
done
if [[ "$API_OK" != "1" ]]; then
  echo "ERROR: API did not become healthy in time. Logs:"
  docker logs "$API_NAME" 2>&1 | tail -60 || true
  exit 1
fi
echo "API healthy."

# --- Next.js UI ---
echo "==> Starting Next.js (pnpm run dev:java)"
# Kill prior next on 3000 if ours
if command -v lsof >/dev/null 2>&1; then
  OLD_PID="$(lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${OLD_PID:-}" ]]; then
    echo "Stopping process on :3000 (pid $OLD_PID)"
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
fi

LOG_DIR="${TMPDIR:-/tmp}/mahaverse-start"
mkdir -p "$LOG_DIR"
UI_LOG="$LOG_DIR/next-dev-java.log"
nohup pnpm run dev:java >"$UI_LOG" 2>&1 &
UI_PID=$!
echo "UI pid=$UI_PID log=$UI_LOG"

UI_OK=0
for i in {1..60}; do
  if curl -sf "http://127.0.0.1:3000/" >/dev/null 2>&1; then
    UI_OK=1
    break
  fi
  if ! kill -0 "$UI_PID" 2>/dev/null; then
    echo "ERROR: Next.js exited. Log:"
    tail -40 "$UI_LOG" || true
    exit 1
  fi
  sleep 1
done
if [[ "$UI_OK" != "1" ]]; then
  echo "ERROR: UI did not become ready. Log:"
  tail -40 "$UI_LOG" || true
  exit 1
fi

echo ""
echo "========================================"
echo " Mahaverse Java stack is up"
echo "----------------------------------------"
echo " UI:     http://localhost:3000"
echo " API:    http://localhost:8080"
echo " Health: http://localhost:8080/actuator/health"
echo " Login:  admin@mahaverse.local / Admin123!"
echo "========================================"

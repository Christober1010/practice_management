## Java backend (Mahaverse)

This folder contains the new **Spring Boot** backend for Mahaverse.

### Local prerequisites

- Docker

You do **not** need Java/Maven installed locally — builds can run in Docker.

### Clone the schema from IONOS into a local MySQL container

#### Note on IONOS connectivity

On many IONOS **Web Hosting/shared MySQL** plans, the MySQL host is **not reachable externally** from your laptop/PC.
If `ionos_dump_schema.sh` fails, use **IONOS phpMyAdmin** to export the schema (structure-only) and then import locally.

1) Export schema (no data) from IONOS:

```bash
export IONOS_DB_HOST="..."
export IONOS_DB_NAME="..."
export IONOS_DB_USER="..."
export IONOS_DB_PASS="..."
./scripts/db/ionos_dump_schema.sh
```

Alternative (recommended if external MySQL is blocked):

- IONOS → Hosting → Databases → open **phpMyAdmin**
- Select your DB → **Export**
- Choose **Custom**
- Select **Structure** (no data)
- Format **SQL**, then download and save it as `db/ionos-schema.sql`

2) Start local MySQL:

```bash
./scripts/db/local_mysql_start.sh
```

3) Import schema:

```bash
./scripts/db/local_mysql_import_schema.sh
```

### Build the Spring Boot app in Docker

```bash
docker run --rm -v "$PWD":/workspace -w /workspace/java-backend/mahaverse-api \
  maven:3.9-eclipse-temurin-21 mvn -q -DskipTests package
```

### Run the API locally (Docker)

```bash
./scripts/db/local_mysql_start.sh

docker run --rm --name mahaverse-api --network host \
  -v "$PWD":/workspace -w /workspace/java-backend/mahaverse-api \
  -e MAHAVERSE_DB_HOST=127.0.0.1 \
  -e MAHAVERSE_DB_PORT=3306 \
  -e MAHAVERSE_DB_NAME=mahaverse \
  -e MAHAVERSE_DB_USER=mahaverse \
  -e MAHAVERSE_DB_PASS=mahaverse \
  maven:3.9-eclipse-temurin-21 mvn -q -DskipTests spring-boot:run
```

API base: `http://localhost:8080`

### Auth endpoints (implemented)

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/verify`
- `GET /api/v1/me/permissions?scope=mahaverse`

Local seed user (structure-only DB):

- email: `admin@mahaverse.local`
- password: `Admin123!`
- role: `admin`

Example:

```bash
curl -sS -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@mahaverse.local","password":"Admin123!"}'
```

### Clients module (implemented)

REST:
- `GET /api/v1/clients`
- `GET /api/v1/clients/{clientId}`
- `POST /api/v1/clients`
- `PUT /api/v1/clients/{clientId}`
- `POST /api/v1/clients/{clientId}/archive|unarchive`

PHP aliases for UI: `get-clients.php`, `update-clients.php`, `add-clients.php`

Lookups (GET): `/api/v1/lookups/*` and `locations.php`, `providers.php`, `service-codes.php`, `diagnosis-codes.php`, …

Local seed includes two demo clients (`Alex Demo`, `Jordan Sample`) plus sample lookups.


#!/usr/bin/env bash
# Scan backend/ and backend-test/ PHP files for hardcoded MySQL host and database names.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

EXCLUDE_PATTERN='^(rbac_helpers|drive_helper|config|db)\.php$'

echo "area,file,host,database,note"

for AREA in backend backend-test; do
  DIR="$REPO_ROOT/$AREA"
  [[ -d "$DIR" ]] || continue
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    if [[ "$base" =~ $EXCLUDE_PATTERN ]]; then
      continue
    fi
    NOTE=""
    HOST=""
    DBNAME=""

    if grep -q "getenv\s*(\s*['\"]DB_" "$f" 2>/dev/null; then
      NOTE="env"
    fi

    # mysqli style: $host = "..."; $database = "..."; $dbname = "..."
    H_LINE="$(grep -E '^\s*\$host\s*=' "$f" | head -1 || true)"
    D_LINE="$(grep -E '^\s*\$(dbname|database)\s*=' "$f" | head -1 || true)"

    if [[ -n "$H_LINE" ]]; then
      HOST="$(echo "$H_LINE" | sed -n 's/.*"\([^"]*\)".*/\1/p')"
    fi
    if [[ -n "$D_LINE" ]]; then
      DBNAME="$(echo "$D_LINE" | sed -n 's/.*"\([^"]*\)".*/\1/p')"
    fi

    # PDO mysql:dbname=...
    if [[ -z "$HOST" || -z "$DBNAME" ]]; then
      PDO_LINE="$(grep -oE "mysql:host=[^;]+;dbname=[^;'\"]+" "$f" | head -1 || true)"
      if [[ -n "$PDO_LINE" ]]; then
        [[ -z "$HOST" ]] && HOST="$(echo "$PDO_LINE" | sed -n 's/.*host=\([^;]*\).*/\1/p')"
        [[ -z "$DBNAME" ]] && DBNAME="$(echo "$PDO_LINE" | sed -n 's/.*dbname=\(.*\)/\1/p')"
      fi
    fi

    if [[ -z "$HOST" && -z "$DBNAME" && -z "$NOTE" ]]; then
      if grep -q "getDBConnection\s*(" "$f" 2>/dev/null; then
        NOTE="uses_getDBConnection"
      elif grep -q "require.*config\.php" "$f" 2>/dev/null; then
        NOTE="includes_config"
      else
        NOTE="unknown"
      fi
    fi

    printf '%s,%s,%s,%s,%s\n' "$AREA" "$base" "${HOST:-}" "${DBNAME:-}" "$NOTE"
  done < <(find "$DIR" -maxdepth 1 -name '*.php' -print0)
done | sort -t, -k1,1 -k2,2

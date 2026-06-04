#!/usr/bin/env bash
# Copy backend-test (dev) PHP → backend (prod), rewriting prod DB credentials in file bodies.
# Recommended way to align prod with test before deploying to mahaverse-backend-logics.
#
# Usage (repo root):
#   bash scripts/sync-backend-test-to-prod.sh
#   bash scripts/sync-backend-test-to-prod.sh --dry-run
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/backend-test"
DST="$ROOT/backend"
DRY=false
[[ "${1:-}" == "--dry-run" ]] && DRY=true

# prod ← test credential mapping (inline strings in PHP)
PROD_HOST='db5018266079.hosting-data.io'
PROD_DB='dbs14484433'
PROD_USER='dbu3321929'
TEST_HOST='db5018419668.hosting-data.io'
TEST_DB='dbs14649042'
TEST_USER='dbu1183438'

if [[ ! -d "$SRC" || ! -d "$DST" ]]; then
  echo "Missing $SRC or $DST" >&2
  exit 1
fi

rewrite() {
  local f="$1"
  if $DRY; then
    echo "  rewrite: $(basename "$f")"
    return
  fi
  sed -i \
    -e "s|$TEST_HOST|$PROD_HOST|g" \
    -e "s|$TEST_DB|$PROD_DB|g" \
    -e "s|$TEST_USER|$PROD_USER|g" \
    -e 's|backend-test/|backend/|g' \
    -e 's|(TEST ENVIRONMENT)|(PRODUCTION)|g' \
    -e 's|backend-test|backend|g' \
    "$f"
}

echo "Sync: $SRC → $DST (prod credentials)"
$DRY && echo "(dry-run — no writes)"

count=0
for f in "$SRC"/*.php "$SRC"/.htaccess; do
  [[ -e "$f" ]] || continue
  base="$(basename "$f")"
  case "$base" in
    health-auth.php)
      echo "  skip: $base (test diagnostic only)"
      continue
      ;;
  esac
  if $DRY; then
    echo "  copy: $base"
  else
    cp "$f" "$DST/$base"
    rewrite "$DST/$base"
  fi
  count=$((count + 1))
done

# Prod-only legacy — do not remove automatically
if [[ -f "$DST/get-clients-old.php" ]]; then
  echo "  note: get-clients-old.php left in prod (not in test)"
fi

echo "Done. $count file(s) from test → prod."
echo "Next: git diff backend/ && deploy backend/ to mahaverse-backend-logics"

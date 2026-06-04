#!/usr/bin/env bash
# Copy backend (prod) PHP → backend-test (dev), rewriting test DB credentials.
# WARNING: Overwrites dev with prod logic — drops mandatory auth, session-notes fixes, etc.
# Only use if you intentionally want dev to match current prod PHP.
#
# Usage (repo root):
#   bash scripts/sync-backend-prod-to-test.sh
#   bash scripts/sync-backend-prod-to-test.sh --dry-run
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/backend"
DST="$ROOT/backend-test"
DRY=false
[[ "${1:-}" == "--dry-run" ]] && DRY=true

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
    -e "s|$PROD_HOST|$TEST_HOST|g" \
    -e "s|$PROD_DB|$TEST_DB|g" \
    -e "s|$PROD_USER|$TEST_USER|g" \
    -e 's|backend/|backend-test/|g' \
    -e 's|(PRODUCTION)|(TEST ENVIRONMENT)|g' \
    "$f"
}

echo "WARNING: prod → test overwrites dev PHP with older prod behavior."
echo "Sync: $SRC → $DST (test credentials)"
$DRY && echo "(dry-run — no writes)"

count=0
for f in "$SRC"/*.php "$SRC"/.htaccess; do
  [[ -e "$f" ]] || continue
  base="$(basename "$f")"
  case "$base" in
    get-clients-old.php)
      echo "  skip: $base (prod legacy)"
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

for extra in logout.php bootstrap.php health-auth.php; do
  if [[ -f "$DST/$extra" ]]; then
    echo "  kept (not from prod): $extra"
  fi
done

echo "Done. $count file(s) from prod → test."
echo "Test-only files (logout, bootstrap, health-auth) were NOT removed."
echo "Next: git diff backend-test/ — expect loss of requireAuth on most endpoints."

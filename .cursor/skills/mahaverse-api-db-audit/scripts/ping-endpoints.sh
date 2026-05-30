#!/usr/bin/env bash
# OPTIONS (and optional GET) each PHP entrypoint under prod and test base URLs.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
CURL_TIMEOUT="${CURL_TIMEOUT:-25}"

PROD_BASE=""
TEST_BASE=""
DO_GET=false

usage() {
  echo "Usage: $0 --prod-base URL --test-base URL [--get]"
  echo "  --get   Also send GET (may return 400/401; still proves route exists)"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod-base) PROD_BASE="${2:-}"; shift 2 ;;
    --test-base) TEST_BASE="${2:-}"; shift 2 ;;
    --get) DO_GET=true; shift ;;
    -h|--help) usage ;;
    *) usage ;;
  esac
done

[[ -n "$PROD_BASE" && -n "$TEST_BASE" ]] || usage

PROD_BASE="${PROD_BASE%/}"
TEST_BASE="${TEST_BASE%/}"

EXCLUDE_PATTERN='^(rbac_helpers|drive_helper|config|db)\.php$'

ping_one() {
  local label="$1"
  local base="$2"
  local script="$3"
  local url="${base}/${script}"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' -m "$CURL_TIMEOUT" -X OPTIONS "$url" || echo "000")"
  printf '%s\tOPTIONS\t%s\t%s\n' "$label" "$script" "$code"
  if [[ "$DO_GET" == true ]]; then
    code="$(curl -sS -o /dev/null -w '%{http_code}' -m "$CURL_TIMEOUT" -X GET "$url" || echo "000")"
    printf '%s\tGET\t%s\t%s\n' "$label" "$script" "$code"
  fi
}

collect_scripts() {
  local dir="$1"
  find "$dir" -maxdepth 1 -name '*.php' -printf '%f\n' | sort
}

echo "# Mahaverse endpoint ping — $(date -Iseconds)"
echo "# prod=$PROD_BASE test=$TEST_BASE timeout=${CURL_TIMEOUT}s get=$DO_GET"
echo ""

for AREA in backend backend-test; do
  DIR="$REPO_ROOT/$AREA"
  [[ -d "$DIR" ]] || continue
  BASE="$PROD_BASE"
  LABEL="prod"
  if [[ "$AREA" == "backend-test" ]]; then
    BASE="$TEST_BASE"
    LABEL="test"
  fi

  while IFS= read -r basefile; do
    [[ "$basefile" =~ $EXCLUDE_PATTERN ]] && continue
    ping_one "$LABEL" "$BASE" "$basefile"
  done < <(collect_scripts "$DIR")
done

echo ""
echo "# Done. Review: 000 = network/TLS failure; 404 = wrong path or missing deploy."

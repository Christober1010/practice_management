#!/usr/bin/env bash
# Build docs/api-audit-report-test.md or docs/api-audit-report-prod.md
# Usage: ./scripts/generate-api-audit-report.sh test|prod
set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" != "test" && "$MODE" != "prod" ]]; then
  echo "Usage: $0 test|prod"
  echo "Env: MAHAVERSE_API_BASE_TEST, MAHAVERSE_API_BASE_PROD (optional overrides)"
  echo "     CURL_TIMEOUT (default 12)  PARALLEL (default 16)"
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$REPO_ROOT" ]]; then
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi
cd "$REPO_ROOT"

BASE_TEST="${MAHAVERSE_API_BASE_TEST:-https://www.mahabehavioralhealth.com/mahaverse-backend-test}"
BASE_PROD="${MAHAVERSE_API_BASE_PROD:-https://www.mahabehavioralhealth.com/mahaverse-backend}"
CURL_TIMEOUT="${CURL_TIMEOUT:-12}"
PARALLEL="${PARALLEL:-16}"

MAP_SCRIPT="$REPO_ROOT/.cursor/skills/mahaverse-api-db-audit/scripts/map-php-databases.sh"

EXCLUDE_PATTERN='^(rbac_helpers|drive_helper|config|db)\.php$'

if [[ "$MODE" == "test" ]]; then
  BASE="${BASE_TEST%/}"
  HTTP_DIR="$REPO_ROOT/backend-test"
  OUT="$REPO_ROOT/docs/api-audit-report-test.md"
  LABEL='test — backend-test/ tree vs test base URL'
else
  BASE="${BASE_PROD%/}"
  HTTP_DIR="$REPO_ROOT/backend"
  OUT="$REPO_ROOT/docs/api-audit-report-prod.md"
  LABEL='production — backend/ tree vs prod base URL'
fi

mkdir -p "$REPO_ROOT/docs"

TMP_HTTP="$(mktemp)"
TMP_PARTS="$(mktemp -d)"
trap 'rm -f "$TMP_HTTP"; rm -rf "$TMP_PARTS"' EXIT

ping_script() {
  local script="$1"
  local url="${BASE}/${script}"
  local opt get
  opt="$(curl -sS -o /dev/null -w '%{http_code}' -m "$CURL_TIMEOUT" -X OPTIONS "$url" 2>/dev/null || echo "000")"
  get="$(curl -sS -o /dev/null -w '%{http_code}' -m "$CURL_TIMEOUT" -X GET "$url" 2>/dev/null || echo "000")"
  printf '%s\t%s\t%s\n' "$script" "$opt" "$get"
}

export BASE CURL_TIMEOUT
OK_OPTIONS=0
BAD_OPTIONS=0
OK_GET=0
BAD_GET=0

running=0
while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  [[ "$base" =~ $EXCLUDE_PATTERN ]] && continue
  while (( running >= PARALLEL )); do
    wait -n 2>/dev/null || wait
    ((running--)) || true
  done
  safe="${base//[^a-zA-Z0-9._-]/_}"
  (
    ping_script "$base" >"$TMP_PARTS/$safe.$$.$RANDOM.out"
  ) &
  ((running++)) || true
done < <(find "$HTTP_DIR" -maxdepth 1 -name '*.php' -print0 2>/dev/null || true)
wait

shopt -s nullglob
parts=( "$TMP_PARTS"/*.out )
if (( ${#parts[@]} > 0 )); then
  cat "${parts[@]}" | sort -t $'\t' -k1,1 >"$TMP_HTTP"
else
  : >"$TMP_HTTP"
fi
shopt -u nullglob

while IFS=$'\t' read -r _fn oc gc; do
  [[ -z "${oc:-}" ]] && continue
  case "$oc" in
    200|204) ((OK_OPTIONS++)) || true ;;
    *) ((BAD_OPTIONS++)) || true ;;
  esac
  case "$gc" in
    200|204|400|401|403|405) ((OK_GET++)) || true ;;
    *) ((BAD_GET++)) || true ;;
  esac
done <"$TMP_HTTP"

{
  echo "# API audit — ${MODE}"
  echo ""
  echo "**Environment:** ${LABEL}"
  echo ""
  echo "**Base URL:** \`${BASE}\`"
  echo ""
  echo "**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
  echo ""
  echo "## Summary"
  echo ""
  echo "| Check | OK-ish | Other |"
  echo "|-------|--------|-------|"
  echo "| OPTIONS (2xx = 200, 204) | ${OK_OPTIONS} | ${BAD_OPTIONS} |"
  echo "| GET (non-fatal: 400, 401, 403, 405, 2xx) | ${OK_GET} | ${BAD_GET} |"
  echo ""
  echo "*\`000\` = timeout or network failure; \`404\` = missing path or deploy.*"
  echo ""
  echo "## HTTP smoke (OPTIONS / GET)"
  echo ""
  echo "| Script | OPTIONS | GET |"
  echo "|--------|---------|-----|"
  if [[ -s "$TMP_HTTP" ]]; then
    sort -u "$TMP_HTTP" | while IFS=$'\t' read -r fn o g; do
      echo "| \`$fn\` | $o | $g |"
    done
  else
    echo "| *(no php files found in $HTTP_DIR)* | | |"
  fi
  echo ""
  if [[ "$MODE" == "test" ]]; then
    MAP_GREP=(grep '^backend-test,')
  else
    MAP_GREP=(grep '^backend,')
  fi

  if [[ "$MODE" == "test" ]]; then
    echo "## Database wiring — \`backend-test/\` only (test DB)"
  else
    echo "## Database wiring — \`backend/\` only (production)"
  fi
  echo ""
  echo "Static scan of repo entrypoints for **this environment’s tree only** — no cross-environment rows."
  echo ""
  echo "Host / \`dbname\` literals (see \`note\` for includes / \`getDBConnection\`)."
  echo ""
  echo "| Area | File | Host | Database | Note |"
  echo "|------|------|------|----------|------|"
  if [[ -f "$MAP_SCRIPT" ]]; then
    bash "$MAP_SCRIPT" | tail -n +2 | "${MAP_GREP[@]}" | while IFS= read -r line; do
      IFS=',' read -r area file host db note <<<"$line"
      echo "| $area | \`$file\` | ${host:-—} | ${db:-—} | ${note:-—} |"
    done
  else
    echo "| *map script missing* | | | | |"
  fi
  echo ""
  echo "---"
  echo ""
  echo "Regenerate: \`npm run test:test\` or \`npm run test\`"
} >"$OUT"

echo "Wrote $OUT"

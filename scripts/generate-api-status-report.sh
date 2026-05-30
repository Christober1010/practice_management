#!/usr/bin/env bash
# Generate per-endpoint API status report (CORS preflight + authenticated GET).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${MAHAVERSE_API_BASE_TEST:-https://www.mahabehavioralhealth.com/mahaverse-backend-test}"
BASE="${BASE%/}"
TOKEN="${TOKEN:-}"
ORIGIN="${CORS_ORIGIN:-http://localhost:3000}"
TIMEOUT="${CURL_TIMEOUT:-12}"
OUT="${API_STATUS_REPORT:-$REPO_ROOT/docs/API-STATUS-REPORT-TEST.md}"
TSV="/tmp/mahaverse-api-status-$$.tsv"
DATE="$(date -u +"%Y-%m-%d %H:%M UTC")"

SKIP='^(config|db|rbac_helpers|behavior_helpers|client_auth_units_helpers|drive_helper|bootstrap|create-wrapper)\.php$'
DEV_SKIP='test\.php|test-simple\.php|oauth-debug\.php|health-auth\.php|reports-old\.php|staff-backup\.php|clients-modules-backup\.php|programs-dev\.php|sso_login\.php'

POST_ONLY=" login.php logout.php send-otp.php verify-otp.php reset-password-with-otp.php rbac-save-role.php claims-cms1500-preview.php upload-client-document.php upload-staff-document.php "

is_post_only() { [[ "$POST_ONLY" == *" $1 "* ]]; }

classify_get() {
  local ep="$1" code="$2" body="$3"
  if is_post_only "$ep" && [[ "$code" == "405" ]]; then echo "OK_POST_ONLY"; return; fi
  if [[ "$code" == "200" ]]; then echo "OK"; return; fi
  if [[ "$code" == "400" ]]; then echo "OK_NEEDS_PARAMS"; return; fi
  if [[ "$code" == "401" ]]; then echo "FAIL_AUTH"; return; fi
  if [[ "$code" == "403" ]]; then echo "FAIL_FORBIDDEN"; return; fi
  if [[ "$code" == "404" ]]; then echo "FAIL_NOT_FOUND"; return; fi
  if [[ "$code" == "500" ]]; then echo "FAIL_SERVER"; return; fi
  if [[ "$code" == "302" && "$ep" == "drive_oauth_start.php" ]]; then echo "OK_REDIRECT"; return; fi
  if [[ "$code" == "000" ]]; then echo "FAIL_NETWORK"; return; fi
  echo "WARN_${code}"
}

classify_cors() {
  local opt_code="$1" has_cors="$2" allow_headers="$3"
  if [[ "$has_cors" -eq 0 ]]; then echo "FAIL_NO_CORS"; return; fi
  if [[ "$opt_code" == "401" ]]; then echo "FAIL_PREFLIGHT_401"; return; fi
  if ! echo "$allow_headers" | grep -qi 'x-auth-token'; then echo "FAIL_MISSING_X_AUTH_TOKEN"; return; fi
  echo "OK"
}

: > "$TSV"
total=0 ok=0 fail=0 warn=0 cors_fail=0

while IFS= read -r ep; do
  [[ "$ep" =~ $SKIP ]] && continue
  [[ "$ep" =~ $DEV_SKIP ]] && continue
  total=$((total + 1))

  opt_headers="$(curl -sS -D - -o /dev/null --max-time "$TIMEOUT" -X OPTIONS "$BASE/$ep" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: authorization,x-auth-token,content-type" 2>/dev/null || printf 'HTTP/0 000\r\n')"
  opt_code="$(echo "$opt_headers" | grep -m1 '^HTTP' | awk '{print $2}')"
  [[ -z "$opt_code" ]] && opt_code="000"
  has_cors="$(echo "$opt_headers" | grep -ci '^access-control-allow-origin:' || true)"
  allow_headers="$(echo "$opt_headers" | grep -i '^access-control-allow-headers:' | head -1 | cut -d: -f2- | sed 's/^[[:space:]]*//' || true)"

  auth_args=()
  [[ -n "$TOKEN" ]] && auth_args=(-H "Authorization: Bearer $TOKEN" -H "X-Auth-Token: $TOKEN")
  get_out="$(curl -sS -w $'\n__CODE__%{http_code}' --max-time "$TIMEOUT" \
    -H "Origin: $ORIGIN" "${auth_args[@]}" "$BASE/$ep" 2>/dev/null || printf '\n__CODE__000')"
  get_code="$(echo "$get_out" | grep -o '__CODE__[0-9]*' | tail -1 | sed 's/__CODE__//')"
  get_body="$(echo "$get_out" | sed '/__CODE__/d' | head -c 120 | tr '\n' ' ' | sed 's/|/ /g')"

  get_class="$(classify_get "$ep" "$get_code" "$get_out")"
  cors_class="$(classify_cors "$opt_code" "$has_cors" "$allow_headers")"

  case "$get_class" in OK|OK_* ) ok=$((ok + 1)) ;; FAIL_* ) fail=$((fail + 1)) ;; * ) warn=$((warn + 1)) ;; esac
  [[ "$cors_class" != OK ]] && cors_fail=$((cors_fail + 1))

  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$ep" "$opt_code" "$cors_class" "$get_code" "$get_class" "$get_body" >> "$TSV"
  printf '.'
done < <(find "$REPO_ROOT/backend-test" -maxdepth 1 -name '*.php' -printf '%f\n' | sort)

echo ""
mkdir -p "$(dirname "$OUT")"

{
  cat <<EOF
# API status report — test backend

**Generated:** $DATE  
**Base URL:** \`$BASE\`  
**CORS origin simulated:** \`$ORIGIN\`  
**Token provided:** $([[ -n "$TOKEN" ]] && echo yes || echo no)

## Summary

| Metric | Count |
|--------|------:|
| Endpoints tested | $total |
| GET pass (OK / OK_NEEDS_PARAMS / OK_POST_ONLY) | $ok |
| GET fail | $fail |
| GET warn / other | $warn |
| CORS issues | $cors_fail |

**Deploy UI when:** CORS issues = 0 and GET fail = 0 (OK_NEEDS_PARAMS is fine).

## Legend

| GET status | Meaning |
|------------|---------|
| OK | 200 with response body |
| OK_NEEDS_PARAMS | 400 — needs query/body on GET (normal) |
| OK_POST_ONLY | 405 — POST-only endpoint |
| FAIL_AUTH | 401 with token |
| FAIL_SERVER | 500 — PHP/SQL error |
| FAIL_NOT_FOUND | 404 — not on server |

| CORS status | Meaning |
|-------------|---------|
| OK | Preflight allows Origin + X-Auth-Token |
| FAIL_MISSING_X_AUTH_TOKEN | localhost browser will block |
| FAIL_PREFLIGHT_401 | OPTIONS blocked by auth |
| FAIL_NO_CORS | No Allow-Origin on OPTIONS |

## Per-endpoint results

| Endpoint | OPTIONS | CORS | GET | GET status | Preview |
|----------|---------|------|-----|------------|---------|
EOF

  while IFS=$'\t' read -r ep opt_code cors_class get_code get_class get_body; do
    printf '| `%s` | %s | %s | %s | %s | %s |\n' "$ep" "$opt_code" "$cors_class" "$get_code" "$get_class" "$get_body"
  done < "$TSV"

  cat <<'EOF'

## Action required (failures only)

EOF

  while IFS=$'\t' read -r ep opt_code cors_class get_code get_class get_body; do
    if [[ "$cors_class" != OK || "$get_class" == FAIL_* ]]; then
      printf -- '- **%s** — CORS: %s, GET: %s (%s)\n' "$ep" "$cors_class" "$get_class" "$get_code"
    fi
  done < "$TSV"

  cat <<EOF

## Excluded

Includes/helpers (\`config.php\`, \`db.php\`, \`*_helpers.php\`) and dev/backup scripts.

## Regenerate

\`\`\`bash
TOKEN=<aba_token> bash scripts/generate-api-status-report.sh
\`\`\`
EOF
} > "$OUT"

rm -f "$TSV"
echo "Wrote $OUT (total=$total ok=$ok fail=$fail cors_fail=$cors_fail)"

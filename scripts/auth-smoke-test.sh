#!/usr/bin/env bash
# Smoke-test backend-test auth: unauthenticated requests should get 401 on protected routes.
# Usage:
#   bash scripts/auth-smoke-test.sh
#   MAHAVERSE_API_BASE_TEST=https://... TOKEN=hex... bash scripts/auth-smoke-test.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${MAHAVERSE_API_BASE_TEST:-https://www.mahabehavioralhealth.com/mahaverse-backend-test}"
BASE="${BASE%/}"
CURL_TIMEOUT="${CURL_TIMEOUT:-12}"
TOKEN="${TOKEN:-}"

PUBLIC=(
  login.php
  send-otp.php
  verify-otp.php
  reset-password-with-otp.php
  drive_oauth_start.php
  drive_oauth_callback.php
  check-drive-status.php
  check-drive-status-simple.php
)

PROTECTED=(
  get-clients.php
  get-users.php
  programs.php
  locations.php
  staff.php
  reports.php
  add-session.php
  session-notes.php
  me-permissions.php
)

echo "Auth smoke test — $BASE"
echo ""

fail=0

for ep in "${PUBLIC[@]}"; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time "$CURL_TIMEOUT" -X OPTIONS "$BASE/$ep" || echo 000)"
  echo "PUBLIC  OPTIONS $ep -> $code"
done

echo ""
for ep in "${PROTECTED[@]}"; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time "$CURL_TIMEOUT" "$BASE/$ep" || echo 000)"
  if [[ "$code" == "401" ]]; then
    echo "OK      GET $ep -> 401 (auth required)"
  else
    echo "FAIL    GET $ep -> $code (expected 401 without token)"
    fail=$((fail + 1))
  fi
done

if [[ -n "$TOKEN" ]]; then
  echo ""
  echo "Authenticated sample (get-clients.php):"
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time "$CURL_TIMEOUT" \
    -H "Authorization: Bearer $TOKEN" -H "X-Auth-Token: $TOKEN" \
    "$BASE/get-clients.php" || echo 000)"
  echo "TOKEN   GET get-clients.php -> $code (expect 200 or 403)"
fi

echo ""
if (( fail > 0 )); then
  echo "$fail protected endpoint(s) did not return 401 without token."
  exit 1
fi
echo "All sampled protected endpoints returned 401 without token."

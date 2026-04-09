#!/usr/bin/env bash
# Compare backend/ vs backend-test/ from repository root.
# Shows files only in one tree and a summary of differing files.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
cd "$REPO"

echo "=== Files only in backend/ (not in backend-test/) ==="
comm -13 <(find backend-test -maxdepth 1 -type f -printf '%f\n' | sort -u) \
         <(find backend -maxdepth 1 -type f -printf '%f\n' | sort -u) || true

echo ""
echo "=== Files only in backend-test/ (not in backend/) ==="
comm -23 <(find backend-test -maxdepth 1 -type f -printf '%f\n' | sort -u) \
         <(find backend -maxdepth 1 -type f -printf '%f\n' | sort -u) || true

echo ""
echo "=== Same name, different content (first 50 lines) ==="
diff -rq backend backend-test 2>/dev/null | grep '^Files .* differ$' | head -50 || true

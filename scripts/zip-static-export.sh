#!/usr/bin/env bash
# After `next build` with output: export, zip the `out/` directory for deployment.
# Archives live under artifacts/{prod|test}/. Previous zip is rotated to
# ${OLD_PREFIX}-YYYYMMDD-HHMMSS.zip; only MAX_OLD_ARTIFACTS old copies are kept (default 5).
#
# Usage: scripts/zip-static-export.sh prod | test
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${1:?Usage: $0 prod|test}"
OUT_DIR="out"
ARTIFACTS_DIR="${ARTIFACTS_DIR:-artifacts}"
MAX_OLD_ARTIFACTS="${MAX_OLD_ARTIFACTS:-5}"

if [[ ! -d "$OUT_DIR" ]]; then
  echo "Missing ${OUT_DIR}/ — run next build first." >&2
  exit 1
fi

case "$MODE" in
  test)
    ARTIFACT_SUBDIR="test"
    ZIP_NAME="out-test.zip"
    OLD_PREFIX="out-test-old"
    ;;
  prod)
    ARTIFACT_SUBDIR="prod"
    ZIP_NAME="out.zip"
    OLD_PREFIX="out-old"
    ;;
  *)
    echo "Usage: $0 prod|test" >&2
    exit 1
    ;;
esac

DEST="${ARTIFACTS_DIR}/${ARTIFACT_SUBDIR}"
ZIP="${DEST}/${ZIP_NAME}"
OLD_GLOB="${DEST}/${OLD_PREFIX}"-*.zip

mkdir -p "$DEST"

if ! command -v zip >/dev/null 2>&1; then
  echo "zip is not installed; install zip to create archives." >&2
  exit 1
fi

prune_old_archives() {
  local keep="$1"
  local -a archives=()
  local f removed=0

  shopt -s nullglob
  archives=( ${OLD_GLOB} )
  shopt -u nullglob

  if (( ${#archives[@]} <= keep )); then
    return 0
  fi

  mapfile -t archives < <(ls -1t ${OLD_GLOB} 2>/dev/null || ls -1 ${OLD_GLOB} | sort -r)

  for f in "${archives[@]:keep}"; do
    rm -f "$f"
    echo "Pruned old archive ${f}"
    removed=$((removed + 1))
  done

  if (( removed > 0 )); then
    echo "Keeping ${keep} newest ${OLD_PREFIX}-*.zip archive(s) in ${DEST}/"
  fi
}

TS="$(date +%Y%m%d-%H%M%S)"

if [[ -f "$ZIP" ]]; then
  rotated="${DEST}/${OLD_PREFIX}-${TS}.zip"
  mv "$ZIP" "$rotated"
  echo "Renamed existing ${ZIP} → ${rotated}"
fi

( cd "$OUT_DIR" && zip -rq "${ROOT}/${ZIP}" . )
echo "Wrote ${ZIP} from ${OUT_DIR}/"

prune_old_archives "$MAX_OLD_ARTIFACTS"

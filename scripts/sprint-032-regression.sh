#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  if "$@"; then
    PASS=$((PASS + 1))
    printf 'PASS %s\n' "$label"
  else
    FAIL=$((FAIL + 1))
    printf 'FAIL %s\n' "$label" >&2
  fi
}

check "未配布段階の0.8.0新規導入・停止境界・旧blocker保持" node "$ROOT/scripts/sprint-032-update-gate-test.mjs"
check "candidate release integrity" python3 "$ROOT/scripts/check-release-integrity.py" --root "$ROOT"
check "canonical/legacy CHANGELOG byte一致" cmp "$ROOT/plugins/secretary/CHANGELOG.md" "$ROOT/plugins/yasashii-secretary/CHANGELOG.md"
check "0.7.0→0.8.0 migration JSON" node -e 'const x=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(x.fromVersion!=="0.7.0"||x.toVersion!=="0.8.0"||!Array.isArray(x.operations))process.exit(1)' "$ROOT/plugins/secretary/migrations/0.7.0-to-0.8.0.json"
check "same-version bridge実装なし" bash -c '! rg -n "same-version.*(?:bridge|bootstrap)|0\\.7\\.0-to-0\\.7\\.0" "$1/plugins/secretary/scripts" "$1/plugins/secretary/migrations"' _ "$ROOT"

printf 'SPRINT032_PASS=%s SPRINT032_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

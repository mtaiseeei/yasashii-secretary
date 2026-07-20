#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0
check() {
  local label="$1"
  shift
  if "$@"; then PASS=$((PASS + 1)); printf 'PASS %s\n' "$label"
  else FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$label" >&2
  fi
}

check "6状態×4入口・byte不変・config・bot identity" node "$ROOT/scripts/sprint-030-edition-guard-test.mjs"
check "EditionConfig駆動のstart/retry/resume/rollback/ledger" node "$ROOT/scripts/sprint-030-update-config-test.mjs"
check "Sprint 029 rule/copy/wizard境界" bash "$ROOT/scripts/sprint-029-regression.sh"
check "edition runtime構文" node --check "$ROOT/plugins/secretary/scripts/lib/edition-guard.mjs"
check "edition CLI構文" node --check "$ROOT/plugins/secretary/scripts/edition-guard.mjs"
check "更新3入口構文" node --check "$ROOT/plugins/secretary/scripts/update-diagnose.mjs"
check "migration入口構文" node --check "$ROOT/plugins/secretary/scripts/update-apply.mjs"

printf 'SPRINT030_PASS=%s SPRINT030_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

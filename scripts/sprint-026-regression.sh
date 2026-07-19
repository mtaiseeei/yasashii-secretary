#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0
check() {
  local label="$1"
  shift
  if "$@"; then PASS=$((PASS + 1)); printf 'PASS %s\n' "$label";
  else FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$label" >&2; fi
}

check "master release gateのNode構文" node --check "$ROOT/scripts/master-release-gate.mjs"
check "archive release gateのNode構文" node --check "$ROOT/scripts/archive-release-gate.mjs"
check "master release gateの専用fixture（失敗・signal・未実行・timeout集約）" node "$ROOT/scripts/sprint-026-release-gate-test.mjs"

printf 'SPRINT026_PASS=%s SPRINT026_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

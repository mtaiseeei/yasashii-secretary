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

check "Chatwork wizard共通focusの構文" node --check "$ROOT/plugins/secretary/skills/chatwork/assets/wizard/common.js"
check "Chatwork wizard UIの構文" node --check "$ROOT/plugins/secretary/skills/chatwork/assets/wizard/app.js"
check "Google Chat wizard UIの構文" node --check "$ROOT/plugins/secretary/skills/google-chat/assets/wizard/app.js"
check ".mcp.jsonと公開面のcopy inventory" node "$ROOT/scripts/sprint-027-copy-test.mjs"
check "実browser DOM式の構文と不可視hit area除外" node "$ROOT/scripts/sprint-027-browser-expression-test.mjs"

printf 'SPRINT027_PASS=%s SPRINT027_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

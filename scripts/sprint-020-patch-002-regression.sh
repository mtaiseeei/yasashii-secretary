#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  if "$@"; then PASS=$((PASS+1)); printf '  PASS %s\n' "$label"
  else FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$label" >&2
  fi
}

check "Cloud準備moduleの構文" node --check "$ROOT/plugins/secretary/skills/google-chat/scripts/cloud-setup.mjs"
check "Google Chat wizardの構文" node --check "$ROOT/plugins/secretary/skills/google-chat/assets/wizard/app.js"
check "Google Chat wizard serverの構文" node --check "$ROOT/plugins/secretary/skills/google-chat/scripts/wizard-server.mjs"
check "Patch 002 Cloud準備・責務分離" node "$ROOT/scripts/sprint-020-patch-002-cloud-setup-test.mjs"
check "Patch 001 copy・一体型設定の回帰" node "$ROOT/scripts/sprint-020-patch-001-copy-test.mjs"
check "Google Chat接続・OAuth回帰" node "$ROOT/scripts/sprint-019-google-chat-test.mjs"
check "Google Chat運用回帰" node "$ROOT/scripts/sprint-020-google-chat-test.mjs"
check "Chatwork結果表示回帰" node "$ROOT/scripts/sprint-020-patch-001-chatwork-result-test.mjs"

printf 'SPRINT020_PATCH002_WRAPPER_PASS=%s FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

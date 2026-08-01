#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0
INFRA=0

check() {
  local label="$1"
  shift
  if "$@"; then PASS=$((PASS+1)); printf '  PASS %s\n' "$label"
  else FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$label" >&2
  fi
}

check_loopback_infra() {
  local label="$1" output rc
  shift
  output="$("$@" 2>&1)"; rc=$?
  printf '%s\n' "$output"
  if [ "$rc" -eq 0 ]; then
    PASS=$((PASS+1)); printf '  PASS %s\n' "$label"
  elif printf '%s' "$output" | grep -q 'listen EPERM: operation not permitted 127.0.0.1'; then
    INFRA=$((INFRA+1)); printf '  INFRA %s (sandbox loopback listen EPERM; product assertions not reclassified)\n' "$label"
  else
    FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$label" >&2
  fi
}

check "Cloud準備moduleの構文" node --check "$ROOT/plugins/secretary/skills/google-chat/scripts/cloud-setup.mjs"
check "Google Chat wizardの構文" node --check "$ROOT/plugins/secretary/skills/google-chat/assets/wizard/app.js"
check "Google Chat wizard serverの構文" node --check "$ROOT/plugins/secretary/skills/google-chat/scripts/wizard-server.mjs"
check "Patch 002 Cloud準備・責務分離" node "$ROOT/scripts/sprint-020-patch-002-cloud-setup-test.mjs"
check "Patch 001 copy・一体型設定の回帰" node "$ROOT/scripts/sprint-020-patch-001-copy-test.mjs"
check_loopback_infra "Google Chat接続・OAuth回帰" node "$ROOT/scripts/sprint-019-google-chat-test.mjs"
check "Google Chat運用回帰" node "$ROOT/scripts/sprint-020-google-chat-test.mjs"
check "Chatwork結果表示回帰" node "$ROOT/scripts/sprint-020-patch-001-chatwork-result-test.mjs"

printf 'SPRINT020_PATCH002_WRAPPER_INFRA=%s\n' "$INFRA"
printf 'SPRINT020_PATCH002_WRAPPER_PASS=%s SPRINT020_PATCH002_WRAPPER_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

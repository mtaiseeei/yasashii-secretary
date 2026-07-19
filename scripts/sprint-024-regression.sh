#!/usr/bin/env bash

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  if "$@"; then PASS=$((PASS + 1)); printf '  PASS %s\n' "$label"
  else FAIL=$((FAIL + 1)); printf '  FAIL %s\n' "$label" >&2
  fi
}

check "Actions run相関moduleの構文" node --check "$ROOT/plugins/yasashii-secretary/scripts/lib/actions-run.mjs"
check "Google Chat履歴moduleの構文" node --check "$ROOT/plugins/yasashii-secretary/skills/google-chat/scripts/history.mjs"
check "Google Chat再取得flowの構文" node --check "$ROOT/plugins/yasashii-secretary/skills/google-chat/scripts/search-flow.mjs"
check "Chatwork再取得flowの構文" node --check "$ROOT/plugins/yasashii-secretary/skills/chatwork/scripts/search-flow.mjs"
check "Chatwork wizardの構文" node --check "$ROOT/plugins/yasashii-secretary/skills/chatwork/scripts/wizard-server.mjs"
check "Sprint 024専用fixtureの構文" node --check "$ROOT/scripts/sprint-024-data-causality-test.mjs"
check "Sprint 024履歴marker・run因果相関" node "$ROOT/scripts/sprint-024-data-causality-test.mjs"
check "Chatwork接続・初回回帰" bash "$ROOT/scripts/sprint-013-regression.sh"
check "Chatwork運用・手動再取得回帰" bash "$ROOT/scripts/sprint-014-regression.sh"
check "Google Chat接続・初回回帰" bash "$ROOT/scripts/sprint-019-regression.sh"
check "Google Chat運用・手動再取得回帰" bash "$ROOT/scripts/sprint-020-regression.sh"
check "共通wizard一体型設定回帰" bash "$ROOT/scripts/sprint-020-patch-001-regression.sh"
check "Google Cloud準備・OAuth導線回帰" bash "$ROOT/scripts/sprint-020-patch-002-regression.sh"
check "OAuth callback・session保護回帰" node "$ROOT/scripts/sprint-023-security-test.mjs"
check "変更差分の空白・競合marker検査" git -C "$ROOT" diff --check -- plugins scripts

printf 'SPRINT024_WRAPPER_PASS=%s SPRINT024_WRAPPER_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

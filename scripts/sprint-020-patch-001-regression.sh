#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  if "$@"; then
    PASS=$((PASS + 1))
    printf '  PASS %s\n' "$label"
  else
    FAIL=$((FAIL + 1))
    printf '  FAIL %s\n' "$label"
  fi
}

check "copy inventory・意味要素・禁止語・DOM状態・壊したfixture" node "$ROOT/scripts/sprint-020-patch-001-copy-test.mjs"
check "初回設定fixtureの構文" node --check "$ROOT/scripts/start-sprint-020-patch-001-google-chat-fixture.mjs"
check "Google Chat初見評価用file生成helperの構文" node --check "$ROOT/scripts/create-sprint-020-patch-001-google-chat-test-client.mjs"
check "Chatwork選択room結果の敵対fixture" node "$ROOT/scripts/sprint-020-patch-001-chatwork-result-test.mjs"
check "Chatworkの機能回帰" node "$ROOT/scripts/sprint-014-chatwork-test.mjs"
check "Google Chatの接続回帰" node "$ROOT/scripts/sprint-019-google-chat-test.mjs"
check "Google Chatの運用回帰" node "$ROOT/scripts/sprint-020-google-chat-test.mjs"

printf 'SPRINT020_PATCH001_WRAPPER_PASS=%s SPRINT020_PATCH001_WRAPPER_FAIL=%s\n' "$PASS" "$FAIL"
test "$FAIL" -eq 0

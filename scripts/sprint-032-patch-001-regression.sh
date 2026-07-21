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

check "会話surface inventory・圧縮禁止負例・edition構造・Chatwork Secret安全" node "$ROOT/scripts/sprint-032-patch-001-readability-test.mjs"
check "通常報告schemaの唯一owner" python3 "$ROOT/scripts/check-report-schema.py" --plugin-root "$ROOT/plugins/secretary"
check "Chatwork/Google Chat wizard copy・flow・focus静的回帰" node "$ROOT/scripts/sprint-027-copy-test.mjs"
check "Chatwork Secret画面browser回帰scriptの構文" node --check "$ROOT/scripts/sprint-032-patch-001-chatwork-browser.mjs"
check "専用testの構文" node --check "$ROOT/scripts/sprint-032-patch-001-readability-test.mjs"
check "会話契約libの構文" node --check "$ROOT/scripts/lib/sprint-032-patch-001-conversation.mjs"
check "実pluginセッションsmoke scriptの構文" node --check "$ROOT/scripts/sprint-032-patch-001-conversation-smoke.mjs"

printf 'SPRINT032_PATCH001_PASS=%s SPRINT032_PATCH001_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

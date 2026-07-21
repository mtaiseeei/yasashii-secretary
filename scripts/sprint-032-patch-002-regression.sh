#!/usr/bin/env bash

# 注意: このスイートはoffline回帰と構文チェックだけを検査する。
# 実会話出力の回帰確認は分離された live conversation gate
# （bash scripts/sprint-032-patch-002-live-gate.sh）の三値集計だけを根拠にし、
# ここでの構文チェック・offline PASSを実会話回帰の保証として数えない。

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

check "runner安全・wizard進捗・serializer正本・room表記・ホスト集計・live gate集計" node "$ROOT/scripts/sprint-032-patch-002-test.mjs"
check "会話可読性回帰（完了報告negative含む）" node "$ROOT/scripts/sprint-032-patch-001-readability-test.mjs"
check "通常報告schemaの唯一owner" python3 "$ROOT/scripts/check-report-schema.py" --plugin-root "$ROOT/plugins/secretary"
check "wizard screen inventory静的回帰" node "$ROOT/scripts/sprint-027-copy-test.mjs"
check "ホスト集計libの構文" node --check "$ROOT/scripts/lib/sprint-032-patch-002-hosts.mjs"
check "実会話runnerの構文のみ（実会話回帰の保証ではない。実会話はlive gateで別集計）" node --check "$ROOT/scripts/sprint-032-patch-001-conversation-smoke.mjs"
check "live gate wrapperの構文のみ（実会話回帰の保証ではない）" bash -n "$ROOT/scripts/sprint-032-patch-002-live-gate.sh"
check "専用testの構文" node --check "$ROOT/scripts/sprint-032-patch-002-test.mjs"

printf 'LIVE_CONVERSATION_GATE separate=true note=実会話回帰は scripts/sprint-032-patch-002-live-gate.sh の三値集計（pass/fail/incomplete）だけを根拠にする。未実行はincomplete（未完了）のまま保持する\n'
printf 'SPRINT032_PATCH002_REGRESSION_PASS=%s SPRINT032_PATCH002_REGRESSION_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

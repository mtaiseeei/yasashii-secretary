#!/usr/bin/env bash

# Sprint 032 Patch 002: live conversation gate（実plugin sessionの会話出力の回帰確認）。
#
# このgateはoffline回帰・構文チェック・master release gateから分離されており、
# scenarioごとの実行結果を三値（pass / fail / incomplete）で集計する。
# 未実行・未認証・隔離未実証は incomplete（未完了）であり、実会話回帰の保証として数えない。
# offline回帰のPASS・runnerの構文チェック・master gateの合格は、このgateの代わりにならない。

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_BASE="${TMPDIR:-/private/tmp}"
case "$TMP_BASE" in
  /private/tmp*) : ;;
  *) TMP_BASE="/private/tmp" ;;
esac
STATUS_FILE="$TMP_BASE/sprint-032-patch-002-live-gate-latest.json"

printf 'LIVE_CONVERSATION_GATE start 実plugin sessionの会話出力を三値（pass/fail/incomplete）で集計する分離gate\n'
printf 'LIVE_GATE_NOTE offline回帰・構文チェック・master gateのPASSは実会話回帰の保証として数えない\n'

node "$ROOT/scripts/sprint-032-patch-001-conversation-smoke.mjs"
code=$?

case "$code" in
  0) status=pass ;;
  2) status=incomplete ;;
  *) status=fail ;;
esac

printf '{"gate":"sprint-032-patch-002-live-conversation","status":"%s","exitCode":%d,"recordedAt":"%s"}\n' \
  "$status" "$code" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATUS_FILE"

printf 'LIVE_GATE_RESULT status=%s exit=%d statusFile=%s\n' "$status" "$code" "$STATUS_FILE"
if [ "$status" = incomplete ]; then
  printf 'LIVE_GATE_INCOMPLETE 実会話検証は未完了（incomplete）。元指摘（実plugin sessionの会話出力の回帰確認）は未解消のまま保持し、完了はSprint 033の4環境検証へ引き継ぐ\n'
fi

exit "$code"

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

check "runner安全・wizard進捗・serializer正本・room表記・ホスト集計" node "$ROOT/scripts/sprint-032-patch-002-test.mjs"
check "会話可読性回帰（完了報告negative含む）" node "$ROOT/scripts/sprint-032-patch-001-readability-test.mjs"
check "通常報告schemaの唯一owner" python3 "$ROOT/scripts/check-report-schema.py" --plugin-root "$ROOT/plugins/secretary"
check "wizard screen inventory静的回帰" node "$ROOT/scripts/sprint-027-copy-test.mjs"
check "ホスト集計libの構文" node --check "$ROOT/scripts/lib/sprint-032-patch-002-hosts.mjs"
check "実会話runner（Claude Code CLI adapter）の構文" node --check "$ROOT/scripts/sprint-032-patch-001-conversation-smoke.mjs"
check "専用testの構文" node --check "$ROOT/scripts/sprint-032-patch-002-test.mjs"

printf 'SPRINT032_PATCH002_REGRESSION_PASS=%s SPRINT032_PATCH002_REGRESSION_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

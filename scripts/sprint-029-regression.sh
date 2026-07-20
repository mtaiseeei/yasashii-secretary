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

check "rule graph・4面copy・安全override負fixture・wizard digest" node "$ROOT/scripts/sprint-029-rule-boundary-test.mjs"
check "通常報告schemaの唯一owner" python3 "$ROOT/scripts/check-report-schema.py" --plugin-root "$ROOT/plugins/secretary"
if [ -f "$ROOT/docs/progress/sprint-020-patch-001-copy-inventory.md" ]; then
  check "既存wizard copy inventory・主要DOM・壊したfixture" node "$ROOT/scripts/sprint-020-patch-001-copy-test.mjs"
else
  # 配布archiveは開発用docs/progressを含まない。上の専用検査が、着手前に固定した
  # wizard asset全体のSHA-256を照合するため、copyとDOMの不変性は維持できる。
  printf 'ARCHIVE wizard copy・DOMは固定digestで検証済み（開発用inventoryは非同梱）\n'
fi
check "rule／copy／testの構文" node --check "$ROOT/scripts/sprint-029-rule-boundary-test.mjs"

printf 'SPRINT029_PASS=%s SPRINT029_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

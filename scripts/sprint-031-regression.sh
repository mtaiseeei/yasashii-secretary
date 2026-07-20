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

check "neutral path・legacy CHANGELOG・旧URL・負fixture" node "$ROOT/scripts/sprint-031-plugin-path-test.mjs"
check "release integrity validator" python3 "$ROOT/scripts/check-release-integrity.py" --root "$ROOT"
check "marketplace manifest JSON" node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$ROOT/.claude-plugin/marketplace.json"
check "plugin manifest JSON" node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$ROOT/plugins/secretary/.claude-plugin/plugin.json"
check "edition config JSON" node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$ROOT/plugins/secretary/edition.json"
check "legacy path has one file" bash -c '[ "$(find "$1" -type f | wc -l | tr -d " ")" = 1 ] && [ -f "$1/CHANGELOG.md" ]' _ "$ROOT/plugins/yasashii-secretary"
check "Google Chat file input browser回帰の構文" node --check "$ROOT/scripts/sprint-031-google-chat-file-input-browser.mjs"

printf 'SPRINT031_PASS=%s SPRINT031_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

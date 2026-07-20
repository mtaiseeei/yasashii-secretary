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

check "wizard session guardの構文" node --check "$ROOT/plugins/secretary/scripts/lib/wizard-session.mjs"
check "Google Chat OAuth moduleの構文" node --check "$ROOT/plugins/secretary/skills/google-chat/scripts/oauth-session.mjs"
check "Google Chat wizard serverの構文" node --check "$ROOT/plugins/secretary/skills/google-chat/scripts/wizard-server.mjs"
check "Google Chat wizard UIの構文" node --check "$ROOT/plugins/secretary/skills/google-chat/assets/wizard/app.js"
check "Chatwork wizard serverの構文" node --check "$ROOT/plugins/secretary/skills/chatwork/scripts/wizard-server.mjs"
check "Chatwork wizard UIの構文" node --check "$ROOT/plugins/secretary/skills/chatwork/assets/wizard/app.js"
check "Sprint 023 browser確認scriptの構文" node --check "$ROOT/scripts/sprint-023-browser-check.mjs"
check "Google Chat browser fixtureの構文" node --check "$ROOT/scripts/start-sprint-020-patch-001-google-chat-fixture.mjs"
check "Sprint 023 Origin・session・OAuth再入の専用回帰" node "$ROOT/scripts/sprint-023-security-test.mjs"
check "Sprint 019 OAuth・初回取得回帰" bash "$ROOT/scripts/sprint-019-regression.sh"
check "Sprint 020 Google Chat運用回帰" bash "$ROOT/scripts/sprint-020-regression.sh"
check "Sprint 020 Patch 001 共通wizard回帰" bash "$ROOT/scripts/sprint-020-patch-001-regression.sh"
check "Sprint 020 Patch 002 Cloud準備・OAuth導線回帰" bash "$ROOT/scripts/sprint-020-patch-002-regression.sh"
check "Sprint 022 filesystem・timeout境界回帰" bash "$ROOT/scripts/sprint-022-regression.sh"
check "変更差分の空白・競合marker検査" git -C "$ROOT" diff --check -- plugins scripts

printf 'SPRINT023_WRAPPER_PASS=%s SPRINT023_WRAPPER_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

#!/usr/bin/env bash

set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

ok(){ PASS=$((PASS + 1)); printf 'PASS %s\n' "$1"; }
ng(){ FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else ng "$1"; fi; }

check "Sprint 022専用fixtureのNode構文" "node --check '$REPO/scripts/sprint-022-safety-test.mjs'"
check "共有filesystem guardのNode構文" "node --check '$REPO/plugins/yasashii-secretary/scripts/lib/safe-fs.mjs'"
check "共有timeout処理のNode構文" "node --check '$REPO/plugins/yasashii-secretary/scripts/lib/external-ops.mjs'"
check "配布後Chatwork runtime safetyのNode構文" "node --check '$REPO/plugins/yasashii-secretary/workspace-templates/chatwork/scripts/runtime-safety.mjs'"
check "配布後Google Chat runtime safetyのNode構文" "node --check '$REPO/plugins/yasashii-secretary/skills/google-chat/scripts/runtime-safety.mjs'"
check "shell path guardとmemory削除の構文" "bash -n '$REPO/plugins/yasashii-secretary/scripts/lib/path-guard.sh' '$REPO/plugins/yasashii-secretary/skills/memory-care/scripts/memory-tools.sh'"

if node "$REPO/scripts/sprint-022-safety-test.mjs"; then
  ok "symlink境界・link削除・外部repo正常系・CLI／HTTP timeoutの動的回帰"
else
  ng "symlink境界・link削除・外部repo正常系・CLI／HTTP timeoutの動的回帰"
fi

check "Git差分の空白・競合marker検査" "git -C '$REPO' diff --check"

printf 'SPRINT022_WRAPPER_PASS=%s SPRINT022_WRAPPER_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

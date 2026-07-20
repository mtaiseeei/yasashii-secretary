#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  if "$@"; then printf 'PASS %s\n' "$label"; PASS=$((PASS + 1));
  else printf 'FAIL %s\n' "$label"; FAIL=$((FAIL + 1)); fi
}

check "safe Git共通moduleの構文" node --check "$ROOT/plugins/secretary/scripts/lib/safe-git.mjs"
check "safe Git CLIの構文" node --check "$ROOT/plugins/secretary/scripts/safe-git-commit.mjs"
check "初回publishの構文" node --check "$ROOT/plugins/secretary/scripts/workspace-repo.mjs"
check "Chatwork設定transactionの構文" node --check "$ROOT/plugins/secretary/skills/chatwork/scripts/config-transaction.mjs"
check "Google Chat設定transactionの構文" node --check "$ROOT/plugins/secretary/skills/google-chat/scripts/config-transaction.mjs"
check "memory commitのshell構文" bash -n "$ROOT/plugins/secretary/skills/memory-care/scripts/memory-tools.sh"
check "secret検査・所有path・失敗保護の動的回帰" node "$ROOT/scripts/sprint-021-git-safety-test.mjs"
check "Git差分の空白・競合marker検査" git -C "$ROOT" diff --check

printf 'SPRINT021_PASS=%s SPRINT021_FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

#!/usr/bin/env bash
set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0
check() { if "$@"; then PASS=$((PASS+1)); printf '  PASS %s\n' "$*"; else FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$*"; fi; }

for source in \
  "$REPO/plugins/secretary/skills/google-chat/scripts/oauth-session.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/scripts/client.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/scripts/history.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/scripts/sync.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/scripts/search.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/scripts/wizard-server.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/assets/wizard/cleanup.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/assets/wizard/app.js" \
  "$REPO/plugins/secretary/skills/chatwork/assets/wizard/common.js"; do
  check node --check "$source"
done

if node "$REPO/scripts/sprint-019-google-chat-test.mjs"; then
  PASS=$((PASS+1)); printf '  PASS Google Chat専用実動作回帰\n'
else
  FAIL=$((FAIL+1)); printf '  FAIL Google Chat専用実動作回帰\n'
fi

if grep -RniE "(client_secret|access_token|refresh_token|authorization_code)[[:space:]]*[:=][[:space:]]*['\"][A-Za-z0-9._-]{12,}" \
  "$REPO/plugins/secretary/skills/google-chat" "$REPO/scripts/fixtures/google-chat-wizard"; then
  FAIL=$((FAIL+1)); printf '  FAIL 厳格secret形式の永続物0\n'
else
  PASS=$((PASS+1)); printf '  PASS 厳格secret形式の永続物0\n'
fi

if git -C "$REPO" diff --check; then PASS=$((PASS+1)); printf '  PASS git diff --check\n'; else FAIL=$((FAIL+1)); printf '  FAIL git diff --check\n'; fi
printf 'SPRINT019_WRAPPER_PASS=%d SPRINT019_WRAPPER_FAIL=%d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

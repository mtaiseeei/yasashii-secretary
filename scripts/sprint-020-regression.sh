#!/usr/bin/env bash
set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0
check() { if "$@"; then PASS=$((PASS+1)); printf '  PASS %s\n' "$*"; else FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$*"; fi; }

for source in \
  "$REPO/plugins/secretary/skills/google-chat/scripts/client.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/scripts/history.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/scripts/refresh-token.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/scripts/continuous-sync.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/scripts/schedule.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/scripts/config-transaction.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/scripts/search-flow.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/scripts/wizard-server.mjs" \
  "$REPO/plugins/secretary/skills/google-chat/assets/wizard/app.js"; do
  check node --check "$source"
done

if node "$REPO/scripts/sprint-020-google-chat-test.mjs"; then
  PASS=$((PASS+1)); printf '  PASS Google Chat定期運用の専用実動作回帰\n'
else
  FAIL=$((FAIL+1)); printf '  FAIL Google Chat定期運用の専用実動作回帰\n'
fi

if node "$REPO/scripts/sprint-020-adversarial-test.mjs"; then
  PASS=$((PASS+1)); printf '  PASS Google Chat独立評価3件の敵対的回帰\n'
else
  FAIL=$((FAIL+1)); printf '  FAIL Google Chat独立評価3件の敵対的回帰\n'
fi

if [ -e "$REPO/.github/workflows/google-chat-sync.yml" ] || [ -e "$REPO/google-chat" ]; then
  FAIL=$((FAIL+1)); printf '  FAIL public配布repoの利用者用Google Chat資産0\n'
else
  PASS=$((PASS+1)); printf '  PASS public配布repoの利用者用Google Chat資産0\n'
fi

if grep -RniE "(client_secret|access_token|refresh_token|authorization_code)[[:space:]]*[:=][[:space:]]*['\"][A-Za-z0-9._-]{12,}" \
  "$REPO/plugins/secretary/skills/google-chat" "$REPO/scripts/fixtures/google-chat-wizard"; then
  FAIL=$((FAIL+1)); printf '  FAIL 厳格secret形式の永続物0\n'
else
  PASS=$((PASS+1)); printf '  PASS 厳格secret形式の永続物0\n'
fi

check grep -q '3時間ごと（おすすめ・初期値）' "$REPO/plugins/secretary/skills/google-chat/assets/wizard/app.js"
check grep -q '3時間ごと（おすすめ・初期値）' "$REPO/plugins/secretary/skills/chatwork/assets/wizard/app.js"
check git -C "$REPO" diff --check

printf 'SPRINT020_WRAPPER_PASS=%d SPRINT020_WRAPPER_FAIL=%d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

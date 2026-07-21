#!/usr/bin/env bash
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$REPO/plugins/secretary"
WORK_PARENT="$(cd "${TMPDIR:-/tmp}" && pwd -P)"
WORK="$(mktemp -d "$WORK_PARENT/yasashii-s013-regression.XXXXXX")"
PASS=0; FAIL=0
trap 'rm -rf "$WORK"' EXIT
check(){ local label="$1"; shift; if "$@"; then printf 'PASS %s\n' "$label"; PASS=$((PASS+1)); else printf 'FAIL %s\n' "$label"; FAIL=$((FAIL+1)); fi; }
check_eval(){ local label="$1" expression="$2"; if eval "$expression"; then printf 'PASS %s\n' "$label"; PASS=$((PASS+1)); else printf 'FAIL %s\n' "$label"; FAIL=$((FAIL+1)); fi; }
CHATWORK="$PLUGIN/skills/chatwork"
TEMPLATES="$PLUGIN/workspace-templates"
PUBLISH="$PLUGIN/scripts/workspace-repo.mjs"

check "chatwork skillが存在" test -f "$CHATWORK/SKILL.md"
check_eval "chatwork skillのnameとdescriptionだけがfrontmatter" "awk '/^---$/{n++; next} n==1 && /^[A-Za-z_-]+:/{print \$1}' '$CHATWORK/SKILL.md' | tr -d ':' | paste -sd, - | grep -qx 'name,description'"
check_eval "chatwork skillは安全な保管場所へのSecret登録を案内し値を受けない" "grep -q 'GitHub上の安全な保管場所' '$CHATWORK/SKILL.md' && grep -q 'CHATWORK_API_TOKEN' '$CHATWORK/SKILL.md' && grep -q 'Tokenの値を尋ねず' '$CHATWORK/SKILL.md'"
check_eval "routerがchatworkを段階ロード" "grep -q 'skills/chatwork/SKILL.md' '$PLUGIN/skills/secretary/SKILL.md' && ! grep -q 'Chatwork / LINE 等.*対応していない' '$PLUGIN/skills/secretary/SKILL.md'"
check "marketplace JSONは有効" node -e "JSON.parse(require('fs').readFileSync(process.argv[1]))" "$REPO/.claude-plugin/marketplace.json"
check "plugin JSONは有効" node -e "JSON.parse(require('fs').readFileSync(process.argv[1]))" "$PLUGIN/.claude-plugin/plugin.json"
check_eval "skill frontmatter構文を依存なしで検証" \
  "node -e \"const s=require('fs').readFileSync(process.argv[1],'utf8'); const m=s.match(/^---\\nname: ([a-z0-9-]+)\\ndescription: (.+)\\n---\\n/); if(!m||m[1]!=='chatwork'||!m[2].trim()||s.includes('[TODO:')) process.exit(1)\" '$CHATWORK/SKILL.md'"
check "workspace templateにworkflow・設定・同期script" test -f "$TEMPLATES/.github/workflows/chatwork-sync.yml"
check_eval "workflowはprivate gate・手動dispatch・scheduleなし" "grep -q 'workflow_dispatch:' '$TEMPLATES/.github/workflows/chatwork-sync.yml' && grep -q 'repository.private == true' '$TEMPLATES/.github/workflows/chatwork-sync.yml' && ! grep -qE '^  schedule:|^    - cron:' '$TEMPLATES/.github/workflows/chatwork-sync.yml'"
check_eval "workflowは結果を同じrepoへpush" "grep -q 'chatwork/scripts/chatwork-sync.mjs' '$TEMPLATES/.github/workflows/chatwork-sync.yml' && grep -q 'git add chatwork/' '$TEMPLATES/.github/workflows/chatwork-sync.yml' && grep -q 'git push' '$TEMPLATES/.github/workflows/chatwork-sync.yml'"

# fake-ghはPOSIX標準のheredocで生成する（特定ホスト付属のapply_patchコマンドへ依存しない）。
FAKE_GH="$WORK/fake-gh"
cat > "$FAKE_GH" <<'FAKEGH'
#!/usr/bin/env bash
set -eu
if [ "${1:-}" = repo ] && [ "${2:-}" = create ]; then
  shift 2; name="$1"; shift; source=""
  while [ "$#" -gt 0 ]; do case "$1" in --source) source="$2"; shift 2;; *) shift;; esac; done
  git init -q --bare "$FAKE_REMOTE"
  git -C "$source" remote add origin "$FAKE_REMOTE"
  git -C "$source" push -q -u origin HEAD
  printf 'https://example.invalid/%s\n' "$name"
elif [ "${1:-}" = repo ] && [ "${2:-}" = view ]; then
  printf '{"visibility":"%s","url":"https://example.invalid/existing"}\n' "${FAKE_VISIBILITY:-PRIVATE}"
else exit 2; fi
FAKEGH
chmod +x "$FAKE_GH"
make_workspace(){ local target="$1"; mkdir -p "$target/secretary/memory" "$target/project"; printf '# workspace\n' > "$target/README.md"; printf '# memory\n' > "$target/secretary/memory/MEMORY.md"; printf 'export const ready = true;\n' > "$target/project/app.js"; }

CANCEL="$WORK/cancel"; make_workspace "$CANCEL"
node "$PUBLISH" publish --root "$CANCEL" --repo cancel --visibility private >/dev/null 2>&1; CANCEL_RC=$?
check_eval "確認なしpublishはexit 3・副作用0" "[ '$CANCEL_RC' -eq 3 ] && [ ! -e '$CANCEL/.git' ]"
PUBLIC="$WORK/public"; make_workspace "$PUBLIC"
node "$PUBLISH" publish --root "$PUBLIC" --repo public --visibility public --confirm >/dev/null 2>&1; PUBLIC_RC=$?
check_eval "public指定を拒否し副作用0" "[ '$PUBLIC_RC' -eq 3 ] && [ ! -e '$PUBLIC/.git' ]"
EXISTING="$WORK/existing"; make_workspace "$EXISTING"
git -C "$EXISTING" init -q -b main; git -C "$EXISTING" config user.name regression; git -C "$EXISTING" config user.email regression@example.invalid
git -C "$EXISTING" add -A; git -C "$EXISTING" commit -q -m 初回; git -C "$EXISTING" remote add origin https://example.invalid/existing.git
EXISTING_HEAD="$(git -C "$EXISTING" rev-parse HEAD)"
YASASHII_GH_BIN="$FAKE_GH" node "$PUBLISH" publish --root "$EXISTING" --repo ignored --visibility private --confirm >/dev/null 2>&1; EXISTING_RC=$?
check_eval "既存remoteは再確認前に変更・push 0" "[ '$EXISTING_RC' -eq 3 ] && [ \"\$(git -C '$EXISTING' rev-parse HEAD)\" = '$EXISTING_HEAD' ] && [ \"\$(git -C '$EXISTING' remote get-url origin)\" = 'https://example.invalid/existing.git' ]"
printf '未commitの変更\n' > "$EXISTING/pending.md"
FAKE_VISIBILITY=PUBLIC YASASHII_GH_BIN="$FAKE_GH" node "$PUBLISH" publish --root "$EXISTING" --visibility private --confirm --use-existing-remote >/dev/null 2>&1; EXISTING_PUBLIC_RC=$?
check_eval "既存public remoteはcommit・push前に拒否" "[ '$EXISTING_PUBLIC_RC' -eq 3 ] && [ \"\$(git -C '$EXISTING' rev-parse HEAD)\" = '$EXISTING_HEAD' ] && git -C '$EXISTING' status --porcelain | grep -q 'pending.md'"

SUCCESS="$WORK/success"; make_workspace "$SUCCESS"
node "$PUBLISH" prepare --root "$SUCCESS" --templates "$TEMPLATES" >/dev/null
FAKE_REMOTE="$WORK/success.git" YASASHII_GH_BIN="$FAKE_GH" GIT_AUTHOR_NAME=regression GIT_AUTHOR_EMAIL=regression@example.invalid GIT_COMMITTER_NAME=regression GIT_COMMITTER_EMAIL=regression@example.invalid node "$PUBLISH" publish --root "$SUCCESS" --repo all-in-one --visibility private --confirm > "$WORK/publish.json"
check_eval "private repo初期commit・初回pushが成功" "[ \"\$(node -p \"JSON.parse(require('fs').readFileSync('$WORK/publish.json')).visibility\")\" = PRIVATE ] && git -C '$SUCCESS' rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1"
check_eval "secretary・project・Chatworkが同じrepo root" "[ -d '$SUCCESS/secretary' ] && [ -d '$SUCCESS/project' ] && [ -d '$SUCCESS/chatwork' ] && [ -f '$SUCCESS/.github/workflows/chatwork-sync.yml' ] && [ ! -e '$SUCCESS/secretary/.git' ]"
check_eval "初回commitは明示inventoryだけを含む" "git -C '$SUCCESS' ls-tree -r --name-only HEAD | grep -q '^secretary/' && git -C '$SUCCESS' ls-tree -r --name-only HEAD | grep -q '^chatwork/' && ! git -C '$SUCCESS' ls-tree -r --name-only HEAD | grep -q '^project/'"

SECRET="$WORK/secret"; make_workspace "$SECRET"; TOKEN_MARKER="runtime-chatwork-${RANDOM}-$$"; printf 'CHATWORK_API_TOKEN=%s\n' "$TOKEN_MARKER" > "$SECRET/secretary/.env"
FAKE_REMOTE="$WORK/secret.git" YASASHII_GH_BIN="$FAKE_GH" GIT_AUTHOR_NAME=regression GIT_AUTHOR_EMAIL=regression@example.invalid GIT_COMMITTER_NAME=regression GIT_COMMITTER_EMAIL=regression@example.invalid node "$PUBLISH" publish --root "$SECRET" --repo secret --visibility private --confirm >/dev/null 2>&1; SECRET_RC=$?
check_eval "資格情報候補を検出するとcommit・pushしない" "[ '$SECRET_RC' -eq 3 ] && [ ! -e '$SECRET/.git' ] && [ ! -e '$WORK/secret.git' ]"
check "Chatwork API・search・wizard挙動回帰" node "$REPO/scripts/sprint-013-chatwork-test.mjs"

CSS="$CHATWORK/assets/wizard/style.css"; HTML="$CHATWORK/assets/wizard/index.html"; JS="$CHATWORK/assets/wizard/app.js"
check_eval "wizardはChatwork指定色・4px・0.33s・system font" "grep -qi '#F03747' '$CSS' && grep -q '#171a20' '$CSS' && grep -q 'border-radius: 4px' '$CSS' && grep -q '\.33s' '$CSS' && grep -q -- '-apple-system' '$CSS'"
check_eval "primary CTAはservice色と黒前景" "grep -q 'var(--service-accent)' '$CSS' && grep -q 'color: #000000' '$CSS' && ! grep -qi '#3e6ae1' '$CSS'"
check_eval "wizardはgradient・shadow・画像・Tesla商標を使わない" "! grep -RqiE 'gradient|box-shadow:|text-shadow:|<img|tesla|Universal Sans' '$HTML' '$CSS' '$JS'"
check_eval "mobile 1 column・CTAはDOM順で縦積み・reduced motion" "grep -q 'max-width: 767px' '$CSS' && grep -q 'grid-template-columns: 1fr' '$CSS' && grep -q 'flex-direction: column;' '$CSS' && ! grep -q 'flex-direction: column-reverse' '$CSS' && grep -q 'prefers-reduced-motion' '$CSS'"
check_eval "Token入力欄・token値surfaceが無い" "! grep -RqiE 'type=\"password\"|name=\"token\"|CHATWORK_API_TOKEN=' '$HTML' '$CSS' '$JS' '$CHATWORK/SKILL.md'"
check_eval "6頻度・既定3時間・run数を挙動データで定義" "node -e \"const s=require('fs').readFileSync(process.argv[1],'utf8'); for(const v of ['30m','1h','3h','6h','12h','manual','1440','720','240','120','60']) if(!s.includes(v)) process.exit(1)\" '$JS' && grep -q 'interval: \"3h\"' '$JS'"
check_eval "wizardはprivate repoを検証し確定後だけ設定commit・push" "grep -q 'verifyPrivateRepo' '$CHATWORK/scripts/wizard-server.mjs' && grep -q 'applyChatworkConfig' '$CHATWORK/scripts/wizard-server.mjs' && grep -q 'commitOwnedChanges' '$CHATWORK/scripts/config-transaction.mjs' && grep -q 'pushOwnedCommit' '$CHATWORK/scripts/config-transaction.mjs'"

cp "$TEMPLATES/.github/workflows/chatwork-sync.yml" "$WORK/workflow-invalid.yml"
# schedule混入の負fixtureもPOSIX標準のawkで生成する（apply_patchコマンドへ依存しない）。
awk '{
  if ($0 == "  workflow_dispatch:" && !inserted) {
    print "  schedule:"
    print "    - cron: '\''17 * * * *'\''"
    inserted = 1
  }
  print
}' "$WORK/workflow-invalid.yml" > "$WORK/workflow-invalid.yml.tmp" && mv "$WORK/workflow-invalid.yml.tmp" "$WORK/workflow-invalid.yml"
check_eval "意図的失敗fixture: Sprint 013のschedule混入を検出" "grep -q 'schedule:' '$WORK/workflow-invalid.yml' && ! grep -q 'schedule:' '$TEMPLATES/.github/workflows/chatwork-sync.yml'"
for script in "$PUBLISH" "$TEMPLATES/chatwork/scripts/chatwork-sync.mjs" "$CHATWORK/scripts/search.mjs" "$CHATWORK/scripts/wizard-server.mjs" "$REPO/scripts/sprint-013-chatwork-test.mjs"; do check "Node構文: $(basename "$script")" node --check "$script"; done
check_eval "合成wizard fixtureに実token・credentialが無い" "! grep -RqiE '(token|password|credential)[[:space:]]*[:=][[:space:]]*[A-Za-z0-9_-]{8,}' '$REPO/scripts/fixtures/chatwork-wizard'"
printf 'PASS=%s FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

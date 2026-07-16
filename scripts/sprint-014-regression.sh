#!/usr/bin/env bash
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$REPO/plugins/yasashii-secretary"
CHATWORK="$PLUGIN/skills/chatwork"
TEMPLATES="$PLUGIN/workspace-templates"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/yasashii-s014-regression.XXXXXX")"
PASS=0; FAIL=0
trap 'rm -rf "$WORK"' EXIT
check(){ local label="$1"; shift; if "$@"; then printf 'PASS %s\n' "$label"; PASS=$((PASS+1)); else printf 'FAIL %s\n' "$label"; FAIL=$((FAIL+1)); fi; }
check_eval(){ local label="$1" expression="$2"; if eval "$expression"; then printf 'PASS %s\n' "$label"; PASS=$((PASS+1)); else printf 'FAIL %s\n' "$label"; FAIL=$((FAIL+1)); fi; }

check "Sprint 014 synthetic fixture回帰" node "$REPO/scripts/sprint-014-chatwork-test.mjs"
check_eval "schedule定義は全6選択" "node -e \"import(process.argv[1]).then(({INTERVALS})=>{const keys=Object.keys(INTERVALS);if(keys.join()!=='30m,1h,3h,6h,12h,manual')process.exit(1)})\" '$CHATWORK/scripts/schedule.mjs'"
check_eval "17分起点のcronが正確" "grep -q '17,47 \* \* \* \*' '$CHATWORK/scripts/schedule.mjs' && grep -q '17 \*/3 \* \* \*' '$CHATWORK/scripts/schedule.mjs' && grep -q '17 \*/12 \* \* \*' '$CHATWORK/scripts/schedule.mjs'"
check_eval "manualはscheduleなしを生成" "node -e \"import(process.argv[1]).then(({renderWorkflow})=>{if(renderWorkflow('manual',false).includes('  schedule:'))process.exit(1)})\" '$CHATWORK/scripts/schedule.mjs'"
check_eval "設定transactionはroom・workflowだけを同一commitへ入れる" "grep -q 'chatwork/config.json' '$CHATWORK/scripts/config-transaction.mjs' && grep -q '.github/workflows/chatwork-sync.yml' '$CHATWORK/scripts/config-transaction.mjs' && grep -q '\[\"add\", \"--\", ...relativePaths\]' '$CHATWORK/scripts/config-transaction.mjs'"
check_eval "同意・private・Secret・room gateがある" "grep -q 'consent-required' '$CHATWORK/scripts/config-transaction.mjs' && grep -q 'private-required' '$CHATWORK/scripts/config-transaction.mjs' && grep -q 'secret-missing' '$CHATWORK/scripts/config-transaction.mjs' && grep -q 'room-required' '$CHATWORK/scripts/config-transaction.mjs'"
check_eval "push競合はupdate-refとpath限定restoreでrollback" "grep -q 'git-conflict' '$CHATWORK/scripts/config-transaction.mjs' && grep -q 'update-ref' '$CHATWORK/scripts/config-transaction.mjs' && grep -q '\"--staged\", \"--worktree\"' '$CHATWORK/scripts/config-transaction.mjs'"
check_eval "force push禁止" "! grep -RqiE 'git push[[:space:]]+(-f|--force)|push[[:space:]]+--force' '$CHATWORK' '$TEMPLATES'"
check_eval "workflow concurrencyは重複実行を直列化" "grep -q 'group: chatwork-sync-.*github.repository' '$TEMPLATES/.github/workflows/chatwork-sync.yml' && grep -q 'cancel-in-progress: false' '$TEMPLATES/.github/workflows/chatwork-sync.yml'"
check_eval "同期失敗時は履歴更新stepを実行しない" "grep -q \"if: steps.chatwork.outcome == 'success'\" '$TEMPLATES/.github/workflows/chatwork-sync.yml'"
check_eval "同期scriptはlastSuccess・cursor保持を実装" "grep -q 'previousState.lastSuccessAt' '$TEMPLATES/chatwork/scripts/chatwork-sync.mjs' && grep -q 'previousState.cursors' '$TEMPLATES/chatwork/scripts/chatwork-sync.mjs'"
check_eval "search flowは構造化3択を返す" "grep -q 'needs-choice' '$CHATWORK/scripts/search-flow.mjs' && grep -q '同期して再検索（推奨）' '$CHATWORK/scripts/search-flow.mjs' && grep -q 'room-review-needed' '$CHATWORK/scripts/search-flow.mjs'"
check_eval "dispatch→wait→success→pull→retry順をscriptで固定" "node -e \"const s=require('fs').readFileSync(process.argv[1],'utf8');const keys=['events.push(\\\"dispatch\\\")','events.push(\\\"wait\\\")','events.push(\\\"success-confirmed\\\")','pull(\\\"pull-after-sync\\\")','search(\\\"retry-same-query\\\")'];let at=-1;for(const k of keys){const n=s.indexOf(k);if(n<=at)process.exit(1);at=n}\" '$CHATWORK/scripts/search-flow.mjs'"
check_eval "failure分類はauth・rate・network・GitHub権限・workflow・timeout・git競合・部分room" "for code in auth rate-limit network github-permission workflow-failure timeout git-conflict partial-room; do grep -q \"\$code\" '$CHATWORK/scripts/search-flow.mjs' || exit 1; done"
check_eval "wizardは自動push同意checkboxとerror roleを持つ" "grep -q 'automatic-consent' '$CHATWORK/assets/wizard/app.js' && grep -q 'role=\"alert\"' '$CHATWORK/assets/wizard/app.js'"
check_eval "wizardは解除済みroom履歴を削除しない説明" "grep -q '保存済み履歴は削除しません' '$CHATWORK/assets/wizard/app.js'"
check_eval "wizardは初回設定と設定変更の結果を分離" "grep -q 'configuration-change' '$CHATWORK/scripts/wizard-server.mjs' && grep -q '設定変更が完了しました' '$CHATWORK/assets/wizard/app.js' && grep -q '現在の対象room' '$CHATWORK/assets/wizard/app.js' && grep -q 'schedule' '$CHATWORK/assets/wizard/app.js'"
check_eval "wizard design・responsive・accessibilityを維持" "grep -q '#3e6ae1' '$CHATWORK/assets/wizard/style.css' && grep -q 'max-width: 767px' '$CHATWORK/assets/wizard/style.css' && grep -q 'focus-visible' '$CHATWORK/assets/wizard/style.css' && grep -q 'min-height: 48px' '$CHATWORK/assets/wizard/style.css'"
check_eval "READMEと公開guideがChatwork導入を一続きで案内" "grep -q 'Chatworkをつなぐ' '$REPO/README.md' && grep -q 'gh secret set CHATWORK_API_TOKEN' '$REPO/README.md' && grep -q '同期して再検索' '$REPO/README.md' && grep -q 'Chatworkをつなぐ・探す' '$REPO/docs/guide/features.md'"
check_eval "配布SKILLは開発docs・絶対path非依存" "! grep -RqiE 'docs/(spec|sprints|progress|feedback)|/Users/' '$CHATWORK'"
check_eval "Skill frontmatterはname・descriptionのみ" "awk '/^---$/{n++;next} n==1&&/^[A-Za-z_-]+:/{print \$1}' '$CHATWORK/SKILL.md' | tr -d ':' | paste -sd, - | grep -qx 'name,description'"
check_eval "Token入力欄と値surfaceなし" "! grep -RqiE 'type=\"password\"|name=\"token\"|CHATWORK_API_TOKEN=' '$CHATWORK/assets' '$CHATWORK/SKILL.md'"

cp "$TEMPLATES/.github/workflows/chatwork-sync.yml" "$WORK/workflow-mismatch.yml"
sed 's/default: discover/default: wrong/' "$WORK/workflow-mismatch.yml" > "$WORK/workflow-mismatch.changed.yml"
check_eval "意図的workflow不一致fixtureを検出" "! cmp -s '$WORK/workflow-mismatch.yml' '$WORK/workflow-mismatch.changed.yml'"
for script in "$CHATWORK/scripts/schedule.mjs" "$CHATWORK/scripts/config-transaction.mjs" "$CHATWORK/scripts/search.mjs" "$CHATWORK/scripts/search-flow.mjs" "$CHATWORK/scripts/wizard-server.mjs" "$TEMPLATES/chatwork/scripts/chatwork-sync.mjs" "$REPO/scripts/sprint-014-chatwork-test.mjs"; do
  check "Node構文: $(basename "$script")" node --check "$script"
done
check "template config JSON構文" node -e "JSON.parse(require('fs').readFileSync(process.argv[1]))" "$TEMPLATES/chatwork/config.json"
check "template rooms JSON構文" node -e "JSON.parse(require('fs').readFileSync(process.argv[1]))" "$TEMPLATES/chatwork/rooms.json"
check "workflow YAML構文" ruby -e "require 'yaml'; YAML.load_file(ARGV[0])" "$TEMPLATES/.github/workflows/chatwork-sync.yml"
check_eval "配布・fixtureにcredential形式の値なし" "! grep -RqiE '(token|password|credential)[[:space:]]*[:=][[:space:]]*[A-Za-z0-9_-]{12,}' '$CHATWORK' '$TEMPLATES' '$REPO/scripts/fixtures/chatwork-wizard'"

printf 'PASS=%s FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

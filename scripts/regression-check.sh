#!/usr/bin/env bash
#
# cc-secretary 回帰チェック（sprint-001）
#
# 受入基準1〜7を対話 Claude に依存せず検証する。
#   1. マニフェスト有効性（marketplace.json / plugin.json）
#   2. スキル構文（frontmatter・name 一意・段階ロードの参照先実在）
#   3. オンボーディング生成物（テンプレ実体化のドライラン → 構造・6規律・CLAUDE.md ポインタ・MEMORY.md 索引）
#   4. git 初期化（init 済み・日本語の初回コミット1件・push されていない）
#   5. 非エンジニア体験（plain-language.md が SKILL/onboarding から参照・報告3行型の骨子）
#   6. 安全・規律（agentic-harness に書き込まない・同期層なし・資格情報を書かない）
#
# 使い方: bash scripts/regression-check.sh
# 生成物は mktemp の一時ディレクトリだけに作り、終了時に削除する。

set -u

# リポジトリ直下を基準にする
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN="$REPO/plugins/cc-secretary"
# 雛形は配布プラグイン配下（plugins/cc-secretary/templates/）。
# SKILL と同じく ${CLAUDE_PLUGIN_ROOT} 相対で解決し、未設定時はプラグイン配下にフォールバックする。
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$PLUGIN}"
TEMPLATES="$PLUGIN_ROOT/templates"

PASS=0
FAIL=0
ok()   { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
ng()   { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else ng "$1"; fi; }

section(){ printf '\n== %s ==\n' "$1"; }

# 一時ディレクトリ（生成物のドライラン用）。agentic-harness には一切触れない。
WORK="$(mktemp -d "${TMPDIR:-/tmp}/cc-secretary-regression.XXXXXX")"
cleanup(){ rm -rf "$WORK"; }
trap cleanup EXIT

# ---------------------------------------------------------------------------
section "1. マニフェスト有効性"
# ---------------------------------------------------------------------------
MARKET="$REPO/.claude-plugin/marketplace.json"
PLUGINJSON="$PLUGIN/.claude-plugin/plugin.json"

check "marketplace.json が有効な JSON" "python3 -m json.tool '$MARKET' >/dev/null 2>&1"
check "plugin.json が有効な JSON" "python3 -m json.tool '$PLUGINJSON' >/dev/null 2>&1"

# 必須フィールドと source 実在、単段クレジット方針を Python で検証
# クレジット方針（constraints.md L40-43 / sprint-001 受入基準1）:
#   - forkedFrom は元作者 Shin-sibainu/cc-company（単段）
#   - 中間フォーク inoshinichi/bootcamp-company を必須クレジットに掲げない
python3 - "$MARKET" "$PLUGINJSON" "$REPO" <<'PY'
import json, os, sys
market_path, plugin_path, repo = sys.argv[1], sys.argv[2], sys.argv[3]
errs = []
with open(market_path) as f: m = json.load(f)
for k in ("name", "owner", "plugins"):
    if k not in m: errs.append(f"marketplace.json に {k} が無い")
plugins = m.get("plugins", [])
if not plugins: errs.append("marketplace.json の plugins が空")
else:
    p = plugins[0]
    for k in ("name", "source", "version"):
        if k not in p: errs.append(f"plugins[0] に {k} が無い")
    src = os.path.join(repo, p.get("source", ""))
    if not os.path.isdir(src): errs.append(f"source ディレクトリが無い: {p.get('source')}")
    # forkedFrom は Shin-sibainu/cc-company（元作者）を指す（単段クレジットの正）
    ff = p.get("forkedFrom")
    if ff is None:
        errs.append("forkedFrom フィールドが無い")
    elif "Shin-sibainu/cc-company" not in str(ff):
        errs.append(f"forkedFrom が Shin-sibainu/cc-company でない: {ff!r}")
    # marketplace.json 全体に元作者クレジットが存在
    blob = json.dumps(m, ensure_ascii=False)
    if "Shin-sibainu/cc-company" not in blob:
        errs.append("marketplace.json に Shin-sibainu/cc-company のクレジットが無い")
    # 単段方針: marketplace.json に中間フォークを必須クレジットとして掲げない
    if "bootcamp-company" in blob or "inoshinichi" in blob:
        errs.append("marketplace.json に inoshinichi/bootcamp-company が含まれる（単段方針違反）")
with open(plugin_path) as f: pj = json.load(f)
for k in ("name", "version"):
    if k not in pj: errs.append(f"plugin.json に {k} が無い")
if errs:
    print("MANIFEST_ERRORS:" + "|".join(errs)); sys.exit(1)
sys.exit(0)
PY
check "必須フィールド・forkedFrom=cc-company・source 実在" "[ $? -eq 0 ]"

# クレジット方針を配布物レベルで明示検査（骨抜き防止・単段方針の実検査）
# 対象: marketplace.json / plugin.json / LICENSE / plugins/ 配下（docs/ の分析メモは対象外）
check "LICENSE に MIT の明記" "grep -q 'MIT' '$REPO/LICENSE'"
check "LICENSE に Shin-sibainu/cc-company のクレジット" "grep -q 'Shin-sibainu/cc-company' '$REPO/LICENSE'"
# 配布物に中間フォーク（inoshinichi / bootcamp-company）を必須クレジットとして掲げていない
dist_credit_leak=0
for target in "$MARKET" "$PLUGINJSON" "$REPO/LICENSE"; do
  if grep -qiE 'bootcamp-company|inoshinichi' "$target"; then
    echo "  単段違反: $target に inoshinichi/bootcamp-company の記載"; dist_credit_leak=$((dist_credit_leak+1))
  fi
done
if grep -rqiE 'bootcamp-company|inoshinichi' "$PLUGIN" 2>/dev/null; then
  echo "  単段違反: plugins/ 配下に inoshinichi/bootcamp-company の記載"; dist_credit_leak=$((dist_credit_leak+1))
fi
check "配布物に中間フォークの必須クレジットが無い（単段方針）" "[ $dist_credit_leak -eq 0 ]"

# .mcp.json は有効かつ最小（同期層を持ち込まない = mcpServers が空）
check ".mcp.json が有効な JSON" "python3 -m json.tool '$PLUGIN/.mcp.json' >/dev/null 2>&1"
check ".mcp.json が最小（mcpServers 空 = 同期層なし）" \
  "python3 -c \"import json;d=json.load(open('$PLUGIN/.mcp.json'));exit(0 if d.get('mcpServers')=={} else 1)\""

# ---------------------------------------------------------------------------
section "2. スキル構文・段階ロードの参照整合"
# ---------------------------------------------------------------------------
SECRETARY_SKILL="$PLUGIN/skills/secretary/SKILL.md"
ONBOARD_SKILL="$PLUGIN/skills/onboarding/SKILL.md"
MEMCARE_SKILL="$PLUGIN/skills/memory-care/SKILL.md"
SETUP_GOOGLE_SKILL="$PLUGIN/skills/setup-google/SKILL.md"
DAILY_SKILL="$PLUGIN/skills/daily/SKILL.md"
SETUP_MS_SKILL="$PLUGIN/skills/setup-microsoft/SKILL.md"
SETUP_NOTION_SKILL="$PLUGIN/skills/setup-notion/SKILL.md"
CONNECTIONS_SKILL="$PLUGIN/skills/connections/SKILL.md"
BUILD_SKILL="$PLUGIN/skills/build/SKILL.md"
RULES="$PLUGIN/rules/plain-language.md"
# ユーザー向け SKILL 群の参照スキャン対象（同梱ファイル参照の検査に使う）。
# ハーネス内部契約（agents/・harness/）は別カテゴリ（AI 向け・技術維持）で section 12 が扱う。
SKILLS=("$SECRETARY_SKILL" "$ONBOARD_SKILL" "$MEMCARE_SKILL" "$SETUP_GOOGLE_SKILL" "$DAILY_SKILL" \
        "$SETUP_MS_SKILL" "$SETUP_NOTION_SKILL" "$CONNECTIONS_SKILL" "$BUILD_SKILL")

check "secretary/SKILL.md が存在" "[ -f '$SECRETARY_SKILL' ]"
check "onboarding/SKILL.md が存在" "[ -f '$ONBOARD_SKILL' ]"
check "memory-care/SKILL.md が存在" "[ -f '$MEMCARE_SKILL' ]"
check "setup-google/SKILL.md が存在" "[ -f '$SETUP_GOOGLE_SKILL' ]"
check "daily/SKILL.md が存在" "[ -f '$DAILY_SKILL' ]"
check "setup-microsoft/SKILL.md が存在" "[ -f '$SETUP_MS_SKILL' ]"
check "setup-notion/SKILL.md が存在" "[ -f '$SETUP_NOTION_SKILL' ]"
check "connections/SKILL.md が存在" "[ -f '$CONNECTIONS_SKILL' ]"
check "build/SKILL.md が存在" "[ -f '$BUILD_SKILL' ]"
check "rules/plain-language.md が存在" "[ -f '$RULES' ]"

# frontmatter の name を取り出す（1行目 --- 以降）
name_of(){ awk '/^---$/{n++;next} n==1 && /^name:/{print $2; exit}' "$1"; }
SNAME="$(name_of "$SECRETARY_SKILL")"
ONAME="$(name_of "$ONBOARD_SKILL")"
MNAME="$(name_of "$MEMCARE_SKILL")"
GNAME="$(name_of "$SETUP_GOOGLE_SKILL")"
DNAME="$(name_of "$DAILY_SKILL")"
MSNAME="$(name_of "$SETUP_MS_SKILL")"
NNAME="$(name_of "$SETUP_NOTION_SKILL")"
CNAME="$(name_of "$CONNECTIONS_SKILL")"
BNAME="$(name_of "$BUILD_SKILL")"
check "secretary の name が 'secretary'" "[ '$SNAME' = 'secretary' ]"
check "onboarding の name が 'onboarding'" "[ '$ONAME' = 'onboarding' ]"
check "memory-care の name が 'memory-care'" "[ '$MNAME' = 'memory-care' ]"
check "setup-google の name が 'setup-google'" "[ '$GNAME' = 'setup-google' ]"
check "daily の name が 'daily'" "[ '$DNAME' = 'daily' ]"
check "setup-microsoft の name が 'setup-microsoft'" "[ '$MSNAME' = 'setup-microsoft' ]"
check "setup-notion の name が 'setup-notion'" "[ '$NNAME' = 'setup-notion' ]"
check "connections の name が 'connections'" "[ '$CNAME' = 'connections' ]"
check "build の name が 'build'" "[ '$BNAME' = 'build' ]"
check "name が一意（重複なし）" \
  "[ \"\$(printf '%s\n' '$SNAME' '$ONAME' '$MNAME' '$GNAME' '$DNAME' '$MSNAME' '$NNAME' '$CNAME' '$BNAME' | sort -u | wc -l | tr -d ' ')\" = '9' ]"

# 同梱ファイル参照は ${CLAUDE_PLUGIN_ROOT} 相対に統一されている（constraints.md L40 / domain.md）。
# (a) ${CLAUDE_PLUGIN_ROOT}/... の参照先が全て実在（プラグイン配下で解決）
deadlinks=0
while IFS= read -r ref; do
  ref="${ref%/}"   # 末尾スラッシュ（ディレクトリ参照）を正規化
  [ -e "$PLUGIN_ROOT/$ref" ] || { echo "  デッドリンク: \${CLAUDE_PLUGIN_ROOT}/$ref"; deadlinks=$((deadlinks+1)); }
done < <(grep -rhoE '\$\{CLAUDE_PLUGIN_ROOT\}/[A-Za-z0-9_./-]+(\.md|\.sh|/)?' "${SKILLS[@]}" \
          | sed -E 's#^\$\{CLAUDE_PLUGIN_ROOT\}/##' | sort -u)
check "SKILL の \${CLAUDE_PLUGIN_ROOT} 参照先が全て実在" "[ $deadlinks -eq 0 ]"

# (b) 雛形が新配置（plugins/cc-secretary/templates/）に存在する
check "雛形が plugins/cc-secretary/templates/ に存在" "[ -f '$PLUGIN/templates/AGENTS.md' ] && [ -f '$PLUGIN/templates/CLAUDE.md' ]"

# (c) 同梱ファイルへのリポジトリ直下相対参照（plugins/cc-secretary/... や bare templates/）が残っていない
check "SKILL に plugins/cc-secretary/ 直下相対の同梱参照が無い" \
  "! grep -rqE 'plugins/cc-secretary/' \"\${SKILLS[@]}\""
check "SKILL に \${CLAUDE_PLUGIN_ROOT} を伴わない bare templates/ 参照が無い" \
  "! grep -rhoE '[^./{]templates/' \"\${SKILLS[@]}\" | grep -q ."
# (d) 絶対パス直書き（先頭スラッシュのコード参照）が無い
check "SKILL に絶対パス直書きが無い" \
  "! grep -rhoE '\`/[A-Za-z]' \"\${SKILLS[@]}\" | grep -q ."

# ---------------------------------------------------------------------------
section "3. オンボーディング生成物（テンプレ実体化ドライラン）"
# ---------------------------------------------------------------------------
# 固定の回答で決定的に実体化する（同じ回答 → 同じ構造）
OWNER_NAME="村山さん"
PRIMARY_SERVICE="Google"
PRIMARY_SERVICE_DETAIL="Gmail / Googleカレンダー / Googleドライブ"
TASKS="今日やることの整理、調べもの・下書き"
CREATED_DATE="2026-07-08"
CREATED_AT="2026-07-08 10:00"

DEST="$WORK/secretary"
mkdir -p "$DEST"
# 雛形をコピー（.gitkeep 含む）
cp -R "$TEMPLATES/." "$DEST/"
# 決定ログの雛形を日付名にリネーム
mv "$DEST/memory/decisions/_first-decision.md" "$DEST/memory/decisions/${CREATED_DATE}-decisions.md"
# {{...}} をすべて置換
export OWNER_NAME PRIMARY_SERVICE PRIMARY_SERVICE_DETAIL TASKS CREATED_DATE CREATED_AT
find "$DEST" -type f -name '*.md' -print0 | while IFS= read -r -d '' f; do
  perl -pi -e '
    s/\{\{OWNER_NAME\}\}/$ENV{OWNER_NAME}/g;
    s/\{\{PRIMARY_SERVICE_DETAIL\}\}/$ENV{PRIMARY_SERVICE_DETAIL}/g;
    s/\{\{PRIMARY_SERVICE\}\}/$ENV{PRIMARY_SERVICE}/g;
    s/\{\{TASKS\}\}/$ENV{TASKS}/g;
    s/\{\{CREATED_DATE\}\}/$ENV{CREATED_DATE}/g;
    s/\{\{CREATED_AT\}\}/$ENV{CREATED_AT}/g;
  ' "$f"
done

# 構造の assert（domain.md 準拠）
check "secretary/AGENTS.md がある" "[ -f '$DEST/AGENTS.md' ]"
check "secretary/CLAUDE.md がある" "[ -f '$DEST/CLAUDE.md' ]"
check "secretary/inbox/ がある" "[ -d '$DEST/inbox' ]"
check "secretary/docs/ がある" "[ -d '$DEST/docs' ]"
check "secretary/projects/ がある" "[ -d '$DEST/projects' ]"
check "secretary/memory/MEMORY.md がある" "[ -f '$DEST/memory/MEMORY.md' ]"
check "secretary/memory/decisions/ がある" "[ -d '$DEST/memory/decisions' ]"
check "初回決定ログが日付名で1件ある" "[ -f '$DEST/memory/decisions/${CREATED_DATE}-decisions.md' ]"
check "secretary/memory/preferences.md がある" "[ -f '$DEST/memory/preferences.md' ]"

# 置換漏れがない（{{ }} が残っていない）
leftover="$(grep -rl '{{' "$DEST" || true)"
check "テンプレ変数の置換漏れがない" "[ -z '$leftover' ]"

# AGENTS.md に6規律すべて（見出しマーカー＋キーワード）
A="$DEST/AGENTS.md"
check "規律1 スコープ" "grep -q '規律1' '$A' && grep -q 'スコープ' '$A'"
check "規律2 根拠" "grep -q '規律2' '$A' && grep -q '根拠' '$A'"
check "規律3 出力規約" "grep -q '規律3' '$A' && grep -q '出力規約' '$A'"
check "規律4 記憶保護" "grep -q '規律4' '$A' && grep -q '記憶保護' '$A'"
check "規律5 自動コミット" "grep -q '規律5' '$A' && grep -q '自動コミット' '$A'"
check "規律6 報告の型" "grep -q '規律6' '$A' && grep -q '報告の型' '$A'"
check "資格情報を書かない旨の明記" "grep -q '資格情報' '$A'"
check "push しない旨の明記" "grep -q 'push' '$A'"

# CLAUDE.md は AGENTS.md へのポインタのみ（規律本文を持たない）
check "CLAUDE.md が AGENTS.md を案内" "grep -q 'AGENTS.md' '$DEST/CLAUDE.md'"
check "CLAUDE.md に規律本文が無い（ポインタのみ）" "! grep -q '規律1' '$DEST/CLAUDE.md'"

# MEMORY.md が索引の初期形（1行索引の見出しと初回記録）
M="$DEST/memory/MEMORY.md"
check "MEMORY.md が目次であると明記" "grep -q '目次' '$M'"
check "MEMORY.md に初回セットアップの索引行" "grep -q 'decisions/${CREATED_DATE}-decisions.md' '$M'"
check "MEMORY.md に呼び方が反映" "grep -q '$OWNER_NAME' '$M'"

# ---------------------------------------------------------------------------
section "4. git 初期化（init・日本語初回コミット・push なし）"
# ---------------------------------------------------------------------------
(
  cd "$DEST" || exit 1
  git init -q
  git config user.email "regression@example.com"
  git config user.name "regression"
  git add -A
  git commit -q -m "秘書ディレクトリを作成（初回セットアップ）"
) >/dev/null 2>&1

check "secretary/ が git 初期化済み" "[ -d '$DEST/.git' ]"
check "コミットが1件だけ" "[ \"\$(git -C '$DEST' rev-list --count HEAD 2>/dev/null)\" = '1' ]"
# コミットメッセージが日本語（ASCII 以外を含む）
MSG="$(git -C "$DEST" log -1 --pretty=%s 2>/dev/null)"
check "初回コミットが日本語メッセージ" "printf '%s' \"$MSG\" | LC_ALL=C grep -q '[^ -~]'"
check "リモートが未設定（push されていない）" "[ -z \"\$(git -C '$DEST' remote 2>/dev/null)\" ]"
check "upstream 追跡ブランチが無い（未 push）" "! git -C '$DEST' rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1"

# ---------------------------------------------------------------------------
section "5. 非エンジニア体験（plain-language 参照・3行型骨子）"
# ---------------------------------------------------------------------------
check "secretary/SKILL が plain-language を参照" "grep -q 'plain-language.md' '$SECRETARY_SKILL'"
check "onboarding/SKILL が plain-language を参照" "grep -q 'plain-language.md' '$ONBOARD_SKILL'"
check "memory-care/SKILL が plain-language を参照" "grep -q 'plain-language.md' '$MEMCARE_SKILL'"
check "memory-care に削除前の日常語警告がある" "grep -q '消すと' '$MEMCARE_SKILL' && grep -q '本当に消して' '$MEMCARE_SKILL'"
check "memory-care にしおり『前回の続き』提案がある" "grep -q '前回の続き' '$MEMCARE_SKILL'"
check "plain-language に報告3行型の骨子" "grep -q '3行' '$RULES'"
check "plain-language に進行語彙（計画→道具→確認→結果）" "grep -q '計画' '$RULES' && grep -q '道具' '$RULES' && grep -q '確認' '$RULES' && grep -q '結果' '$RULES'"
check "plain-language に英語エラー翻訳の方針" "grep -q '英語' '$RULES'"
check "onboarding の完了報告に『次』の一言" "grep -q '次は' '$ONBOARD_SKILL'"

# ---------------------------------------------------------------------------
section "6. 安全・規律（不変条件）"
# ---------------------------------------------------------------------------
# agentic-harness に触れていない（このスクリプトは WORK 一時ディレクトリのみに書く）
check "生成物が一時ディレクトリ配下（harness 非書込）" "case '$WORK' in *agentic-harness*) false;; *) true;; esac"
# 外部データ同期層（10_sources 型）を作っていない
check "同期層 10_sources を作らない" "! find '$REPO' -path '*/.git' -prune -o -name '10_sources' -print | grep -q ."
check "生成物に 10_sources 型フォルダが無い" "! find '$DEST' -type d -name '10_sources' | grep -q ."
# 資格情報の実値をコミットしていない（生成物に token=/password= 等の代入が無い）
check "生成物に資格情報の実値が無い" "! grep -rnEi '(password|api[_-]?key|secret|token)\\s*[:=]\\s*[A-Za-z0-9]' '$DEST'"

# ---------------------------------------------------------------------------
section "7. 記憶ケア（保護規則・索引追従・しおり・節目コミット）"
# ---------------------------------------------------------------------------
# 決定的シーム memory-tools.sh を、section 3/4 で作った $DEST（git init + 初回コミット済み）に対して実行する。
TOOLS="$PLUGIN/skills/memory-care/scripts/memory-tools.sh"
check "memory-tools.sh が存在" "[ -f '$TOOLS' ]"
# ヘルパーが push / remote add を一切含まない（push 禁止を静的に担保）
check "memory-tools.sh に git push が無い" "! grep -qE 'git .*push' '$TOOLS'"
check "memory-tools.sh に git remote add が無い" "! grep -qE 'git .*remote +add' '$TOOLS'"

# 索引の追従: ベースライン行数 → 新決定で +1 → 削除で元に戻る
idx_lines(){ grep -c '^- \[' "$DEST/memory/MEMORY.md"; }
bash "$TOOLS" reindex "$DEST" >/dev/null 2>&1
BASE_IDX="$(idx_lines)"
check "MEMORY.md 索引が1行1記憶（ベースライン≥2）" "[ '$BASE_IDX' -ge 2 ]"

bash "$TOOLS" remember-decision "$DEST" 2026-07-09 "検証用の決定を記録" >/dev/null 2>&1
check "新決定ログが作られた" "[ -f '$DEST/memory/decisions/2026-07-09-decisions.md' ]"
check "決定追加で索引が+1追従" "[ \"\$(idx_lines)\" = \"\$(( BASE_IDX + 1 ))\" ]"
check "相対日付でなく絶対日付で記録" "grep -q '2026-07-09' '$DEST/memory/decisions/2026-07-09-decisions.md'"

# 空上書き拒否: preferences.md を空で上書きしようとしても拒否され、既存が保持される
PREF="$DEST/memory/preferences.md"
PREF_BEFORE="$(cksum "$PREF")"
printf '   \n\t ' | bash "$TOOLS" guarded-write "$DEST" preferences.md >/dev/null 2>&1
EMPTY_RC=$?
check "空・空白のみの上書きは拒否（exit 3）" "[ '$EMPTY_RC' -eq 3 ]"
check "拒否時に既存の記憶が保持される（内容不変）" "[ \"\$(cksum '$PREF')\" = '$PREF_BEFORE' ]"
# 非空の上書きは通る
printf '# 好み・環境\n呼び方: テスト\n' | bash "$TOOLS" guarded-write "$DEST" preferences.md >/dev/null 2>&1
check "非空の上書きは成功する" "[ $? -eq 0 ] && grep -q '呼び方: テスト' '$PREF'"
# 親フォルダが無いパスへの書き込みは、偽装成功せず失敗として返す（exit≠0・ファイル未作成）
printf '中身\n' | bash "$TOOLS" guarded-write "$DEST" no_such_dir/x.md >/dev/null 2>&1
check "親フォルダ無しの書き込みは失敗として返る（exit≠0）" "[ $? -ne 0 ]"
check "親フォルダ無しの書き込みでファイルが作られない" "[ ! -e '$DEST/memory/no_such_dir/x.md' ]"

# 削除前警告: --confirm なしでは消えず、警告して中断（exit 3）
bash "$TOOLS" delete "$DEST" decisions/2026-07-09-decisions.md >/tmp/cc_del_warn.$$  2>&1
DEL_RC=$?
check "未確認の削除は実行されない（exit 3）" "[ '$DEL_RC' -eq 3 ]"
check "未確認削除でファイルが残る" "[ -f '$DEST/memory/decisions/2026-07-09-decisions.md' ]"
check "削除警告に『何を消すか』が出る" "grep -q '消そうとしている' /tmp/cc_del_warn.$$"
rm -f /tmp/cc_del_warn.$$
# --confirm ありで削除 → 索引がベースラインに戻る
bash "$TOOLS" delete "$DEST" decisions/2026-07-09-decisions.md --confirm >/dev/null 2>&1
check "確認つき削除は実行される" "[ ! -f '$DEST/memory/decisions/2026-07-09-decisions.md' ]"
check "削除で索引がベースラインに戻る" "[ \"\$(idx_lines)\" = '$BASE_IDX' ]"

# スコープ封じ込め（secretary/ の外を破壊的操作・書き込みで触らせない）
SENTINEL="$WORK/OUTSIDE_SENTINEL.txt"
echo "消してはいけない外部ファイル" > "$SENTINEL"
# (a) delete のパストラバーサルは拒否され、外部ファイルが rm されない
bash "$TOOLS" delete "$DEST" "../../OUTSIDE_SENTINEL.txt" --confirm >/dev/null 2>&1
check "delete のトラバーサルは拒否（exit≠0）" "[ $? -ne 0 ]"
check "delete で secretary/ 外のファイルが消えない" "[ -f '$SENTINEL' ]"
# (b) remember-decision の date トラバーサルは拒否され、外部に書かれない
bash "$TOOLS" remember-decision "$DEST" "../../../ESCAPE" "外に書く" >/dev/null 2>&1
check "remember-decision の不正な日付は拒否（exit≠0）" "[ $? -ne 0 ]"
check "remember-decision で secretary/ 外に書かれない" "[ ! -e '$WORK/ESCAPE-decisions.md' ] && [ ! -e \"\$(dirname '$WORK')/ESCAPE-decisions.md\" ]"
# (c) guarded-write のパストラバーサルは拒否され、外部に書かれない
printf '外部書き込み\n' | bash "$TOOLS" guarded-write "$DEST" "../../OUTSIDE_W.txt" >/dev/null 2>&1
check "guarded-write のトラバーサルは拒否（exit≠0）" "[ $? -ne 0 ]"
check "guarded-write で secretary/ 外に書かれない" "[ ! -e '$WORK/OUTSIDE_W.txt' ]"
check "封じ込め後も外部センチネルが無事" "[ \"\$(cat '$SENTINEL')\" = '消してはいけない外部ファイル' ]"
rm -f "$SENTINEL"

# 封じ込めハードニング: symlink 越え（対象自身・中間ディレクトリ）を実解決して拒否する
mkdir -p "$WORK/outside"
echo "EXTERNAL-ORIGINAL" > "$WORK/outside/real.txt"
# (d) 最終要素が外向き symlink → 書き込みが外へ届かない
ln -s "$WORK/outside/real.txt" "$DEST/memory/evil_link.md"
printf 'HACKED\n' | bash "$TOOLS" guarded-write "$DEST" "evil_link.md" >/dev/null 2>&1
check "symlink（最終要素）越えの書き込みは拒否（exit 3）" "[ $? -eq 3 ]"
check "symlink 越え後も外部の実ファイルが不変" "[ \"\$(cat '$WORK/outside/real.txt')\" = 'EXTERNAL-ORIGINAL' ]"
# (e) 最終要素 symlink への削除も拒否（外部の実体を消さない）
bash "$TOOLS" delete "$DEST" "evil_link.md" --confirm >/dev/null 2>&1
check "symlink（最終要素）越えの削除は拒否（exit 3）" "[ $? -eq 3 ]"
check "symlink 越え削除後も外部の実ファイルが残る" "[ -f '$WORK/outside/real.txt' ]"
# (f) 中間ディレクトリが外向き symlink → 書き込みが外へ届かない
ln -s "$WORK/outside" "$DEST/memory/evil_dir"
printf 'HACKED\n' | bash "$TOOLS" guarded-write "$DEST" "evil_dir/real.txt" >/dev/null 2>&1
check "symlink（中間ディレクトリ）越えの書き込みは拒否（exit 3）" "[ $? -eq 3 ]"
check "中間 symlink 越え後も外部の実ファイルが不変" "[ \"\$(cat '$WORK/outside/real.txt')\" = 'EXTERNAL-ORIGINAL' ]"
rm -f "$DEST/memory/evil_link.md" "$DEST/memory/evil_dir"

# エッジ rel（'.' / 空 / 親方向）は偽装成功させず非ゼロで拒否する（exit 0 を返さない）
for badrel in "." "" ".." "../x"; do
  bash "$TOOLS" delete "$DEST" "$badrel" --confirm >/dev/null 2>&1
  check "delete rel='$badrel' は非ゼロで拒否（偽装成功なし）" "[ $? -ne 0 ]"
done
printf 'x\n' | bash "$TOOLS" guarded-write "$DEST" "." >/dev/null 2>&1
check "guarded-write rel='.' は非ゼロで拒否" "[ $? -ne 0 ]"
printf 'x\n' | bash "$TOOLS" guarded-write "$DEST" "" >/dev/null 2>&1
check "guarded-write rel='' は非ゼロで拒否" "[ $? -ne 0 ]"
# エッジ rel 後も境界内の既存記憶（preferences.md）に副作用がない
check "エッジ rel 後も preferences.md が健在" "[ -f '$DEST/memory/preferences.md' ] && grep -q '呼び方' '$DEST/memory/preferences.md'"
rm -rf "$WORK/outside"

# 再起動しおり: 無→書く→有→読める→閉じる→無
bash "$TOOLS" resume-check "$DEST" >/dev/null 2>&1
check "しおりは初期状態で無い（check exit≠0）" "[ $? -ne 0 ]"
bash "$TOOLS" resume-write "$DEST" "企画書づくり" "見出しを決める" "公開範囲" >/dev/null 2>&1
bash "$TOOLS" resume-check "$DEST" >/dev/null 2>&1
check "しおりを書くと検知される（check exit 0）" "[ $? -eq 0 ]"
RESUME_OUT="$(bash "$TOOLS" resume-read "$DEST" 2>/dev/null)"
check "しおりに進行中の作業が復元できる" "printf '%s' \"\$RESUME_OUT\" | grep -q '企画書づくり'"
check "しおりに次アクションが復元できる" "printf '%s' \"\$RESUME_OUT\" | grep -q '見出しを決める'"
check "しおりに未確定事項が復元できる" "printf '%s' \"\$RESUME_OUT\" | grep -q '公開範囲'"
bash "$TOOLS" resume-clear "$DEST" >/dev/null 2>&1
bash "$TOOLS" resume-check "$DEST" >/dev/null 2>&1
check "しおりを閉じると無くなる（check exit≠0）" "[ $? -ne 0 ]"
# ルーターが起動時しおりチェックを持つ
check "ルーターに起動時しおりチェックがある" "grep -q 'resume-check' '$SECRETARY_SKILL' && grep -q '_resume.md' '$SECRETARY_SKILL'"

# 節目コミット: 日本語メッセージのコミットが増え、push/remote は無い
COMMITS_BEFORE="$(git -C "$DEST" rev-list --count HEAD 2>/dev/null)"
bash "$TOOLS" commit "$DEST" "記憶を更新（検証：決定と好みの記録）" >/dev/null 2>&1
COMMITS_AFTER="$(git -C "$DEST" rev-list --count HEAD 2>/dev/null)"
check "節目コミットで履歴が1件以上増える" "[ '$COMMITS_AFTER' -gt '$COMMITS_BEFORE' ]"
CMSG="$(git -C "$DEST" log -1 --pretty=%s 2>/dev/null)"
check "節目コミットが日本語メッセージ" "printf '%s' \"$CMSG\" | LC_ALL=C grep -q '[^ -~]'"
check "記憶更新後もリモート未設定（push なし）" "[ -z \"\$(git -C '$DEST' remote 2>/dev/null)\" ]"
check "記憶更新後も upstream 追跡が無い（未 push）" "! git -C '$DEST' rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1"
# 記憶ワークスペースに資格情報が入っていない
check "記憶に資格情報の実値が無い" "! grep -rnEi '(password|api[_-]?key|secret|token)\\s*[:=]\\s*[A-Za-z0-9]' '$DEST/memory'"

# ---------------------------------------------------------------------------
section "8. 今日やること・出力規約・Google 接続（sprint-003）"
# ---------------------------------------------------------------------------
WT="$PLUGIN/scripts/workspace-tools.sh"
GUIDE="$SETUP_GOOGLE_SKILL"
check "workspace-tools.sh が存在" "[ -f '$WT' ]"
check "封じ込め共有ライブラリ path-guard.sh が存在" "[ -f '$PLUGIN/scripts/lib/path-guard.sh' ]"

# --- setup-google: 公式コネクタ前提（Cloud Console 手作業を案内しない）---
gcc_leak=0
for term in 'Cloud Console' 'gcp-oauth' 'API を有効' 'API有効' 'プロジェクトを作成' 'プロジェクト作成' '認証情報' 'JSON 鍵' 'JSON鍵'; do
  grep -qF "$term" "$GUIDE" && { echo "  手作業語が露出: $term"; gcc_leak=$((gcc_leak+1)); }
done
check "setup-google に Cloud Console 手作業手順が無い" "[ $gcc_leak -eq 0 ]"
check "setup-google に『設定画面からコネクタ接続』の導線" "grep -q '設定画面' '$GUIDE' && grep -q 'コネクタ' '$GUIDE'"
check "setup-google に接続確認テスト手順" "grep -q '直近の予定' '$GUIDE' || grep -q 'つながったか' '$GUIDE'"
check "setup-google に英語エラーの言い換え型" "grep -q '英語' '$GUIDE' && grep -q '言い換え' '$GUIDE'"
check "setup-google が接続前にしおりを書く（resume-write）" "grep -q 'resume-write' '$GUIDE'"
check "setup-google が資格情報を保存しない旨を明記" "grep -q '保存' '$GUIDE' && grep -q 'トークン' '$GUIDE'"
check "setup-google が plain-language を参照" "grep -q 'plain-language.md' '$GUIDE'"

# --- daily: 根拠ルール・同期しない・未接続フォールバック ---
check "daily に根拠ルール（サービス名＋リンク＋日付）" "grep -q 'サービス名' '$DAILY_SKILL' && grep -q 'リンク' '$DAILY_SKILL' && grep -q '日付' '$DAILY_SKILL'"
check "daily に原文にない事実を足さない旨" "grep -q '原文にない事実を足さない' '$DAILY_SKILL'"
check "daily に矛盾は両方提示" "grep -q '両方' '$DAILY_SKILL'"
check "daily が外部本文をローカル保存しない旨" "grep -q '本文' '$DAILY_SKILL' && (grep -q '保存しない' '$DAILY_SKILL' || grep -q '書き出さない' '$DAILY_SKILL')"
check "daily が同期層（10_sources/キャッシュ）を作らない旨" "grep -q '10_sources' '$DAILY_SKILL' || grep -q 'キャッシュ' '$DAILY_SKILL'"
check "daily が未接続時に setup-google へフォールバック" "grep -q 'setup-google/SKILL.md' '$DAILY_SKILL'"
check "daily が plain-language を参照" "grep -q 'plain-language.md' '$DAILY_SKILL'"
check "daily が3行型（次に何が起きるか）を含む" "grep -q '次は' '$DAILY_SKILL'"

# --- 語彙方針（改訂 ui.md）: sprint-003 で新規/変更した文言に『秘書の家』を使わない ---
# （既存ファイル onboarding / memory-care / templates の一掃は別 Patch の担当・対象外）
check "setup-google に『秘書の家』が無い（語彙方針）" "! grep -q '秘書の家' '$GUIDE'"
check "daily に『秘書の家』が無い（語彙方針）" "! grep -q '秘書の家' '$DAILY_SKILL'"
check "ルーター（sprint-003 変更分）に『秘書の家』が無い" "! grep -q '秘書の家' '$SECRETARY_SKILL'"
check "workspace-tools.sh に『秘書の家』が無い" "! grep -q '秘書の家' '$WT'"

# --- 出力規約のドライラン（workspace-tools.sh save-deliverable）---
printf '## 概要\nテスト成果物の本文。\n' | bash "$WT" save-deliverable "$DEST" 2026-07-08 "テスト企画 骨子" "企画,調査" >/dev/null 2>&1
DELIV="$DEST/docs/2026/07/2026-07-08_テスト企画_骨子.md"
check "成果物が docs/YYYY/MM/YYYY-MM-DD_<title>.md に保存" "[ -f '$DELIV' ]"
check "成果物 frontmatter に createdAt" "grep -q '^createdAt: 2026-07-08' '$DELIV'"
check "成果物 frontmatter に tags" "grep -q '^tags:' '$DELIV' && grep -q '  - 企画' '$DELIV'"
check "成果物 見出しに固有名詞（タイトル）" "grep -q '^# テスト企画 骨子' '$DELIV'"
check "成果物 本文が保存されている" "grep -q 'テスト成果物の本文' '$DELIV'"
# 空本文・不正日付・タイトル traversal は拒否
printf '   \n' | bash "$WT" save-deliverable "$DEST" 2026-07-08 "空本文" >/dev/null 2>&1
check "空本文の成果物は拒否（exit 3）" "[ $? -eq 3 ]"
printf 'x\n' | bash "$WT" save-deliverable "$DEST" "2026/07" "不正日付" >/dev/null 2>&1
check "不正日付の成果物は拒否（exit≠0）" "[ $? -ne 0 ]"
printf 'x\n' | bash "$WT" save-deliverable "$DEST" 2026-07-08 "../外" >/dev/null 2>&1
check "タイトルの .. は拒否（exit≠0）" "[ $? -ne 0 ]"
check "成果物保存後も docs 外に書かれていない" "[ ! -e '$WORK/外.md' ] && [ ! -e '$WORK/2026-07-08_外.md' ]"

# 出力規約の封じ込め: 保存先の月フォルダが外向き symlink でも、実解決して境界外を拒否する
mkdir -p "$WORK/outside2"; echo "EXT-ORIGINAL" > "$WORK/outside2/keep.txt"
mkdir -p "$DEST/docs/2026"
ln -s "$WORK/outside2" "$DEST/docs/2026/09"   # 2026/09 を外向き symlink にすり替え
printf 'HACK\n' | bash "$WT" save-deliverable "$DEST" 2026-09-15 "侵入" >/dev/null 2>&1
check "出力規約: 中間 symlink 越えの保存は拒否（exit 3）" "[ $? -eq 3 ]"
check "出力規約: symlink 越えで外部フォルダに書かれない" "[ ! -e '$WORK/outside2/2026-09-15_侵入.md' ]"
check "出力規約: symlink 越えで外部の実ファイルが不変" "[ \"\$(cat '$WORK/outside2/keep.txt')\" = 'EXT-ORIGINAL' ]"
rm -rf "$DEST/docs/2026/09" "$WORK/outside2"

# 成果物の節目コミット（日本語・push なし）
DCOMMITS_BEFORE="$(git -C "$DEST" rev-list --count HEAD 2>/dev/null)"
bash "$TOOLS" commit "$DEST" "成果物を保存（テスト企画 骨子）" >/dev/null 2>&1
check "成果物保存の節目コミットが増える" "[ \"\$(git -C '$DEST' rev-list --count HEAD)\" -gt '$DCOMMITS_BEFORE' ]"
DMSG="$(git -C "$DEST" log -1 --pretty=%s 2>/dev/null)"
check "成果物コミットが日本語メッセージ" "printf '%s' \"$DMSG\" | LC_ALL=C grep -q '[^ -~]'"
check "成果物保存後もリモート未設定（push なし）" "[ -z \"\$(git -C '$DEST' remote 2>/dev/null)\" ]"

# --- daily の TODO: 根拠必須（同期しない）---
bash "$WT" todo-add "$DEST" "請求書を送る" "Gmail | https://mail.google.com/x | 2026-07-08" >/dev/null 2>&1
check "TODO が inbox/todo.md に根拠つきで追記" "[ -f '$DEST/inbox/todo.md' ] && grep -q '根拠: Gmail' '$DEST/inbox/todo.md'"
bash "$WT" todo-add "$DEST" "根拠なしタスク" "" >/dev/null 2>&1
check "根拠なし TODO は拒否（根拠ルール・exit 3）" "[ $? -eq 3 ]"
# daily がローカルに残すのは TODO のみ（外部本文の全文コピー/キャッシュファイルを作らない）
check "TODO 追記で 10_sources 型の層が作られない" "! find '$DEST' -type d -name '10_sources' | grep -q ."
check "workspace-tools.sh に外部本文の保存指示が無い（同期しない）" "grep -q '本文をローカルに保存しない' '$WT'"

# 新シームに資格情報が保存されない
check "成果物・TODO に資格情報の実値が無い" "! grep -rnEi '(password|api[_-]?key|secret|token)\\s*[:=]\\s*[A-Za-z0-9]' '$DEST/docs' '$DEST/inbox'"

# ---------------------------------------------------------------------------
section "9. 文言規約（改訂 ui.md・過度な平易化の一掃）"
# ---------------------------------------------------------------------------
# 配布物全体を対象に検査する: プラグイン本体（plugins/cc-secretary・templates 含む）に加え、
# リポジトリ直下のマーケットプレイス定義（.claude-plugin/marketplace.json）と LICENSE も含める。
# （marketplace.json の metadata.description はユーザーが marketplace add 時に見る配布物文言）
DIST=("$PLUGIN" "$REPO/.claude-plugin" "$REPO/LICENSE")
# (1) 幼稚なメタファー「家」系（秘書の家/この家/お家/おうち）・住まい擬人化の一掃（ゼロ許容・F7 で「家」系全般に拡張）
check "配布物に『秘書の家/この家』等の家系メタファーが無い（ゼロ件・marketplace.json 含む）" "! grep -rqE '秘書の家|この家|お家|おうち' \"\${DIST[@]}\""
check "配布物に住まい擬人化『ローカルに住む』が無い" "! grep -rq 'ローカルに住む' \"\${DIST[@]}\""
# (2) 旧語彙方針「専門用語は必ず言い換え併記」の撤廃（配布物に残っていない）
check "配布物に旧規定『言い換え併記』が無い" "! grep -rq '言い換え併記' \"\${DIST[@]}\""
check "配布物に旧規定『専門用語は必ず』が無い" "! grep -rq '専門用語は必ず' \"\${DIST[@]}\""
check "配布物に旧規定『言い換えを併記』が無い" "! grep -rq '言い換えを併記' \"\${DIST[@]}\""
# (3) rules/plain-language.md が改訂 ui.md の方針を反映
check "plain-language が『そのまま使う語』方針を明記" "grep -q 'そのまま使う' '$RULES'"
check "plain-language が『初出のみ補足』方針を明記" "grep -q '初出' '$RULES'"
check "plain-language が幼稚メタファー禁止を明記" "grep -q 'メタファー' '$RULES' && grep -q '秘書ディレクトリ' '$RULES'"
check "plain-language が過度な平易化をしない旨を明記" "grep -q '過度な平易化' '$RULES'"
# (4) 呼称の統一: secretary/ を「秘書ディレクトリ／秘書フォルダ」で呼ぶ
check "onboarding 完了メッセージが『秘書ディレクトリ』を使う" "grep -q '秘書ディレクトリ' '$ONBOARD_SKILL'"
check "plugin.json description に『秘書の家』が無い" "! grep -q '秘書の家' '$PLUGINJSON'"
# (5) 一般に通じる技術用語をそのまま使う方針（そのまま使う語リストの存在）
check "plain-language にそのまま使う語リスト（ディレクトリ・コミット等）" "grep -q 'ディレクトリ' '$RULES' && grep -q 'コミット' '$RULES' && grep -q 'コネクタ' '$RULES'"

# ---------------------------------------------------------------------------
section "10. Codex レビュー対応（封じ込め基点・秘密情報・再セットアップ・整合）"
# ---------------------------------------------------------------------------
# 最小の秘書ディレクトリを materialize して git 初期化するヘルパー
mk_sec(){ # $1=dest
  cp -R "$TEMPLATES/." "$1/"
  mv "$1/memory/decisions/_first-decision.md" "$1/memory/decisions/2026-07-08-decisions.md" 2>/dev/null
  find "$1" -type f -name '*.md' -print0 | while IFS= read -r -d '' f; do
    perl -pi -e 's/\{\{[A-Z_]+\}\}/x/g' "$f"
  done
  ( cd "$1" && git init -q && git config user.email r@e && git config user.name r && git add -A && git commit -q -m 初回 )
}

# --- H1: 基点（secretary/memory・secretary）symlink で全導線が拒否・外部不変 ---
H1W="$WORK/h1"; mkdir -p "$H1W"; S="$H1W/secretary"; mk_sec "$S"
mkdir -p "$H1W/evil"; echo "EXT" > "$H1W/evil/keep"
mv "$S/memory" "$H1W/realmem"; ln -s "$H1W/evil" "$S/memory"    # memory を外部 symlink にすり替え
printf x | bash "$TOOLS" guarded-write "$S" preferences.md >/dev/null 2>&1
check "H1: memory symlink で guarded-write 拒否（exit 3）" "[ $? -eq 3 ]"
bash "$TOOLS" remember-decision "$S" 2026-07-10 t >/dev/null 2>&1
check "H1: memory symlink で remember-decision 拒否（exit 3）" "[ $? -eq 3 ]"
bash "$TOOLS" resume-write "$S" a b c >/dev/null 2>&1
check "H1: memory symlink で resume-write 拒否（exit 3）" "[ $? -eq 3 ]"
bash "$TOOLS" resume-clear "$S" >/dev/null 2>&1
check "H1: memory symlink で resume-clear 拒否（exit 3）" "[ $? -eq 3 ]"
bash "$TOOLS" delete "$S" preferences.md --confirm >/dev/null 2>&1
check "H1: memory symlink で delete 拒否（exit 3）" "[ $? -eq 3 ]"
bash "$TOOLS" reindex "$S" >/dev/null 2>&1
check "H1: memory symlink で reindex 拒否（exit 3）" "[ $? -eq 3 ]"
bash "$TOOLS" resume-check "$S" >/dev/null 2>&1
check "H1: memory symlink で resume-check がしおり無し扱い（exit≠0）" "[ $? -ne 0 ]"
check "H1: 拒否後も外部の実ファイルが不変" "[ \"\$(cat '$H1W/evil/keep')\" = 'EXT' ]"
check "H1: 拒否後に外部へ _resume.md 等が作られていない" "[ ! -e '$H1W/evil/_resume.md' ] && [ \"\$(ls '$H1W/evil')\" = 'keep' ]"
# secretary 自体が symlink のケース
rm "$S/memory"; mv "$H1W/realmem" "$S/memory"
ln -s "$S" "$H1W/seclink"
printf x | bash "$TOOLS" guarded-write "$H1W/seclink" preferences.md >/dev/null 2>&1
check "H1: secretary 自体が symlink でも拒否（exit 3）" "[ $? -eq 3 ]"

# --- H3: 秘密情報が黙って履歴化されない（commit が拒否し、履歴に入らない）---
H3S="$WORK/h3/secretary"; mkdir -p "$WORK/h3"; mk_sec "$H3S"
printf 'api_key = ABCDEF123456\n' > "$H3S/inbox/creds.txt"
bash "$TOOLS" commit "$H3S" "テストコミット" >/dev/null 2>&1
check "H3: 秘密情報を含むと commit が拒否（exit≠0）" "[ $? -ne 0 ]"
check "H3: 秘密ファイルが履歴に入っていない" "! git -C '$H3S' log --all --name-only --pretty=format: 2>/dev/null | grep -q 'creds.txt'"
rm -f "$H3S/inbox/creds.txt"
printf 'メモ\n' > "$H3S/inbox/note.md"
bash "$TOOLS" commit "$H3S" "正常な記憶を記録" >/dev/null 2>&1
check "H3: 秘密が無ければ通常コミットは成功" "[ $? -eq 0 ] && git -C '$H3S' log -1 --name-only --pretty=format: | grep -q 'note.md'"

# --- M5: save-deliverable / todo-list が外向き symlink で拒否・外部にディレクトリを作らない ---
M5S="$WORK/m5/secretary"; mkdir -p "$WORK/m5"; mk_sec "$M5S"
mkdir -p "$WORK/m5/evil"; echo EXT > "$WORK/m5/evil/keep"
rm -rf "$M5S/docs"; ln -s "$WORK/m5/evil" "$M5S/docs"
printf x | bash "$WT" save-deliverable "$M5S" 2026-09-15 "侵入" >/dev/null 2>&1
check "M5: docs symlink で save-deliverable 拒否（exit 3）" "[ $? -eq 3 ]"
check "M5: save-deliverable 拒否後も外部にファイルが作られない" "[ \"\$(ls '$WORK/m5/evil')\" = 'keep' ]"
rm -rf "$M5S/inbox"; ln -s "$WORK/m5/evil" "$M5S/inbox"
bash "$WT" todo-list "$M5S" >/dev/null 2>&1
check "M5: inbox symlink で todo-list が外部を読まず拒否（exit≠0）" "[ $? -ne 0 ]"
printf x | bash "$WT" todo-add "$M5S" t ref >/dev/null 2>&1
check "M5: inbox symlink で todo-add 拒否（exit 3）" "[ $? -eq 3 ]"
check "M5: 拒否後も外部にディレクトリ/ファイルが作られない" "[ \"\$(ls '$WORK/m5/evil')\" = 'keep' ]"

# --- M9: reindex が空白入りファイル名でも索引に追従する ---
M9S="$WORK/m9/secretary"; mkdir -p "$WORK/m9"; mk_sec "$M9S"
cp "$M9S/memory/decisions/2026-07-08-decisions.md" "$M9S/memory/decisions/2026-07-09 メモ付-decisions.md"
bash "$TOOLS" reindex "$M9S" >/dev/null 2>&1
check "M9: 空白入り決定ファイルも索引に載る" "grep -qF '2026-07-09 メモ付-decisions.md' '$M9S/memory/MEMORY.md'"

# --- M4: 配布スクリプトに実行権限がある（直接実行の指示と一致）---
check "M4: memory-tools.sh に実行権限" "[ -x '$TOOLS' ]"
check "M4: workspace-tools.sh に実行権限" "[ -x '$WT' ]"

# --- M6: 秘書機能の配布 SKILL が同梱されない docs/spec・docs/sprints を参照しない ---
# 対象は秘書ユーザー向け SKILL（skills/）と rules/。
# 例外: ハーネス内部契約（agents/・harness/）は開発対象プロジェクトの docs/spec/sprints を指す
#       AI 向け技術契約であり、cc-secretary の開発専用ファイル参照ではない（section 12 で別途扱う）。
check "M6: 秘書向け SKILL/rules に docs/spec 参照が無い" "! grep -rq 'docs/spec' '$PLUGIN/skills' '$PLUGIN/rules'"
check "M6: 秘書向け SKILL/rules に docs/sprints 参照が無い" "! grep -rq 'docs/sprints' '$PLUGIN/skills' '$PLUGIN/rules'"

# --- M8: .mcp.json が未実装の setup-microsoft に言及しない ---
check "M8: .mcp.json に setup-microsoft の言及が無い" "! grep -q 'setup-microsoft' '$PLUGIN/.mcp.json'"
check "M8: .mcp.json が『今は Google のみ』を明記" "grep -q 'Google のみ' '$PLUGIN/.mcp.json'"

# --- H2: 再セットアップの保護（バックアップ提案＋明示確認・無確認上書き禁止）---
check "H2: ルーターに再セットアップ保護フローがある" "grep -q '作り直し（再セットアップ）の保護' '$SECRETARY_SKILL' && grep -q 'バックアップ' '$SECRETARY_SKILL'"
check "H2: ルーターが無確認で上書き・再初期化しない旨を明記" "grep -q '無確認で上書き' '$SECRETARY_SKILL'"
check "H2: onboarding に既存 secretary の保護（バックアップ＋明示確認）" "grep -q 'バックアップ' '$ONBOARD_SKILL' && grep -q '明示的に' '$ONBOARD_SKILL'"
check "H2: onboarding が無確認で上書き・再 git init しない旨を明記" "grep -q '無確認で上書き' '$ONBOARD_SKILL'"

# --- F7: templates/AGENTS.md の家系メタファー・旧言い換え併記の撤去 ---
check "F7: AGENTS.md に家系メタファーが無い" "! grep -qE '秘書の家|この家|お家|おうち' '$PLUGIN/templates/AGENTS.md'"
check "F7: AGENTS.md に旧規定『言い換え併記』が無い" "! grep -qE '言い換え併記|専門用語は必ず' '$PLUGIN/templates/AGENTS.md'"

# ---------------------------------------------------------------------------
section "11. 接続拡張（Microsoft / Notion / 診断・sprint-004）"
# ---------------------------------------------------------------------------
# --- setup-microsoft: 公式コネクタ前提（Azure 手作業を案内しない）---
az_leak=0
for term in 'Azure Portal' 'Azure AD' 'アプリ登録' 'アプリの登録' 'アクセス許可' 'クライアントシークレット' 'MS365_MCP_CLIENT_ID' 'デバイスコード'; do
  grep -qF "$term" "$SETUP_MS_SKILL" && { echo "  Azure 手作業語が露出: $term"; az_leak=$((az_leak+1)); }
done
check "setup-microsoft に Azure 手作業手順が無い" "[ $az_leak -eq 0 ]"
check "setup-microsoft に『設定画面からコネクタ接続』の導線" "grep -q '設定画面' '$SETUP_MS_SKILL' && grep -q 'コネクタ' '$SETUP_MS_SKILL'"
check "setup-microsoft に接続確認テスト手順" "grep -q '直近の予定' '$SETUP_MS_SKILL' || grep -q 'つながったか' '$SETUP_MS_SKILL'"
check "setup-microsoft に英語エラーの言い換え型" "grep -q '英語' '$SETUP_MS_SKILL' && grep -q '言い換え' '$SETUP_MS_SKILL'"
check "setup-microsoft が接続前にしおりを書く（resume-write）" "grep -q 'resume-write' '$SETUP_MS_SKILL'"
check "setup-microsoft が資格情報を保存しない旨を明記" "grep -q '保存' '$SETUP_MS_SKILL' && grep -q 'トークン' '$SETUP_MS_SKILL'"
check "setup-microsoft が plain-language を参照" "grep -q 'plain-language.md' '$SETUP_MS_SKILL'"

# --- Notion（任意）---
check "setup-notion が任意であることを明記" "grep -q '任意' '$SETUP_NOTION_SKILL'"
check "setup-notion が未接続でも他機能を壊さない旨を明記" "grep -q '他の機能' '$SETUP_NOTION_SKILL' || grep -q '他機能' '$SETUP_NOTION_SKILL'"
check "setup-notion が mcp.notion.com を案内" "grep -q 'mcp.notion.com' '$SETUP_NOTION_SKILL'"
check "setup-notion に英語エラーの言い換え型" "grep -q '英語' '$SETUP_NOTION_SKILL' && grep -q '言い換え' '$SETUP_NOTION_SKILL'"
check "setup-notion が plain-language を参照" "grep -q 'plain-language.md' '$SETUP_NOTION_SKILL'"

# --- 接続診断（connections）---
check "connections が状態を一覧で返す（接続済み/未接続/エラー）" "grep -q '接続済み' '$CONNECTIONS_SKILL' && grep -q '未接続' '$CONNECTIONS_SKILL' && grep -q 'エラー' '$CONNECTIONS_SKILL'"
check "connections が実エラーで原因確定の型を持つ" "grep -q '実エラーで原因確定' '$CONNECTIONS_SKILL' || grep -q '推測で断定しない' '$CONNECTIONS_SKILL'"
check "connections が未接続を接続導線へ橋渡し" "grep -q 'setup-google/SKILL.md' '$CONNECTIONS_SKILL' && grep -q 'setup-microsoft/SKILL.md' '$CONNECTIONS_SKILL'"
check "connections が3行報告（次にやること）" "grep -q '次にやること' '$CONNECTIONS_SKILL' || grep -q '次は' '$CONNECTIONS_SKILL'"
check "connections が Notion 任意・国内チャット未対応を明記" "grep -q '任意' '$CONNECTIONS_SKILL' && (grep -q 'Chatwork' '$CONNECTIONS_SKILL' || grep -q '国内チャット' '$CONNECTIONS_SKILL')"
check "connections が plain-language を参照" "grep -q 'plain-language.md' '$CONNECTIONS_SKILL'"

# --- 同期しない不変条件: 接続導線・診断が外部本文をローカルに保存しない ---
check "setup-microsoft が本文をローカルに保存しない旨" "grep -q 'ローカルに保存していません' '$SETUP_MS_SKILL' || grep -q '記憶には保存しません' '$SETUP_MS_SKILL'"
check "connections が本文をローカルに保存しない旨" "grep -q '本文はローカルに保存しない' '$CONNECTIONS_SKILL' || grep -q '全文は取り込まない' '$CONNECTIONS_SKILL'"

# --- 語彙方針: 新規4文言に家系メタファーが無い ---
check "sprint-004 の新規文言に家系メタファーが無い" \
  "! grep -rqE '秘書の家|この家|お家|おうち' '$SETUP_MS_SKILL' '$SETUP_NOTION_SKILL' '$CONNECTIONS_SKILL'"
# --- 配布 SKILL の docs/spec 非参照（sprint-004 追加分も）---
check "sprint-004 の新規 SKILL が docs/spec を参照しない" \
  "! grep -rqE 'docs/spec|docs/sprints' '$SETUP_MS_SKILL' '$SETUP_NOTION_SKILL' '$CONNECTIONS_SKILL'"
# --- ルーターに Microsoft/Notion/診断モードが接続済み（準備中でない）---
check "ルーターに setup-microsoft モード" "grep -q 'skills/setup-microsoft/SKILL.md' '$SECRETARY_SKILL'"
check "ルーターに setup-notion モード" "grep -q 'skills/setup-notion/SKILL.md' '$SECRETARY_SKILL'"
check "ルーターに connections（診断）モード" "grep -q 'skills/connections/SKILL.md' '$SECRETARY_SKILL'"

# ---------------------------------------------------------------------------
section "12. やさしいハーネス同梱＋build（sprint-005）"
# ---------------------------------------------------------------------------
HARNESS_SRC="$HOME/workspace/agentic-harness"
BASELINE="$REPO/scripts/harness-source-baseline.sha256"
AGENTS_DIR="$PLUGIN/agents"
HLOOP="$PLUGIN/harness/skills/harness-loop/SKILL.md"
INITSH="$PLUGIN/harness/scripts/init-guidance.sh"

# --- A1: 複製元 agentic-harness の非改変（C5・最優先・ゼロ許容）---
NOW_FILE="$WORK/harness-now.sha256"
( cd "$HARNESS_SRC" 2>/dev/null && find . -type f -not -path './.git/*' -print0 | sort -z | xargs -0 shasum -a 256 ) > "$NOW_FILE" 2>/dev/null
check "A1: 複製元が sha256 マニフェストと一致（非改変）" "[ -s '$NOW_FILE' ] && diff -q '$BASELINE' '$NOW_FILE' >/dev/null"
check "A1: 複製元 git HEAD が記録値と一致" "[ \"\$(git -C '$HARNESS_SRC' rev-parse HEAD 2>/dev/null)\" = '56ce6938cd76111dcb050ee8ed51f28a3e1a79db' ]"
check "A1: 複製元 git 作業ツリーがクリーン（未変更）" "[ -z \"\$(git -C '$HARNESS_SRC' status --porcelain 2>/dev/null)\" ]"
check "A1: 複製先が元リポジトリへ symlink していない" "[ -z \"\$(find '$AGENTS_DIR' '$PLUGIN/harness' -type l 2>/dev/null)\" ]"

# --- A2: 複製物の構文有効性（C2・ゼロ許容）---
PNAME="$(name_of "$AGENTS_DIR/planner.md")"
G2NAME="$(name_of "$AGENTS_DIR/generator.md")"
ENAME="$(name_of "$AGENTS_DIR/evaluator.md")"
HLNAME="$(name_of "$HLOOP")"
check "A2: planner の name が 'planner'" "[ '$PNAME' = 'planner' ]"
check "A2: generator の name が 'generator'" "[ '$G2NAME' = 'generator' ]"
check "A2: evaluator の name が 'evaluator'" "[ '$ENAME' = 'evaluator' ]"
check "A2: agents の name が一意" "[ \"\$(printf '%s\n' '$PNAME' '$G2NAME' '$ENAME' | sort -u | wc -l | tr -d ' ')\" = '3' ]"
check "A2: harness-loop の name が 'harness-loop'" "[ '$HLNAME' = 'harness-loop' ]"
check "A2: init-guidance.sh が bash 構文チェックを通る" "bash -n '$INITSH'"
check "A2: init-guidance.sh に実行権限" "[ -x '$INITSH' ]"
# 複製物（agents/build/harness-loop）の ${CLAUDE_PLUGIN_ROOT} 参照が全て実在
vdead=0
while IFS= read -r ref; do
  ref="${ref%/}"
  [ -e "$PLUGIN_ROOT/$ref" ] || { echo "  デッドリンク: \${CLAUDE_PLUGIN_ROOT}/$ref"; vdead=$((vdead+1)); }
done < <(grep -rhoE '\$\{CLAUDE_PLUGIN_ROOT\}/[A-Za-z0-9_./-]+(\.md|\.sh|/)?' \
           "$AGENTS_DIR/planner.md" "$AGENTS_DIR/generator.md" "$AGENTS_DIR/evaluator.md" "$HLOOP" "$BUILD_SKILL" \
           | sed -E 's#^\$\{CLAUDE_PLUGIN_ROOT\}/##' | sort -u)
check "A2: 複製物の \${CLAUDE_PLUGIN_ROOT} 参照先が全て実在" "[ $vdead -eq 0 ]"

# --- A3: 配置の衝突回避（C1）---
check "A3: harness テンプレと秘書テンプレが別ディレクトリに存在" \
  "[ -f '$PLUGIN/harness/templates/AGENTS.md' ] && [ -f '$PLUGIN/templates/AGENTS.md' ]"
check "A3: harness/AGENTS.md と 秘書/AGENTS.md が別物（内容が異なる）" \
  "! diff -q '$PLUGIN/harness/templates/AGENTS.md' '$PLUGIN/templates/AGENTS.md' >/dev/null 2>&1"

# --- B4: (1) ヒアリング日常語化（C4）---
check "B4: planner のヒアリングが日常語＋具体例" "grep -q '見る人を制限しますか' '$AGENTS_DIR/planner.md'"

# --- B5: (2) 報告の型固定（各エージェントが plain-language を参照）---
check "B5: planner が plain-language を参照" "grep -q 'plain-language.md' '$AGENTS_DIR/planner.md'"
check "B5: generator が plain-language を参照" "grep -q 'plain-language.md' '$AGENTS_DIR/generator.md'"
check "B5: evaluator が plain-language を参照" "grep -q 'plain-language.md' '$AGENTS_DIR/evaluator.md'"

# --- B6: (3) 進行の見せ方（計画→実装→検証／計画→道具→確認→結果）---
prog_re='計画→実装→検証|計画→道具→確認→結果'
check "B6: planner に進行宣言がある" "grep -qE '$prog_re' '$AGENTS_DIR/planner.md'"
check "B6: generator に進行宣言がある" "grep -qE '$prog_re' '$AGENTS_DIR/generator.md'"
check "B6: evaluator に進行宣言がある" "grep -qE '$prog_re' '$AGENTS_DIR/evaluator.md'"
check "B6: harness-loop に進行宣言がある" "grep -qE '$prog_re' '$HLOOP'"

# --- C7: build 入口（C1, C3）---
check "C7: build が harness-loop を参照" "grep -q 'harness/skills/harness-loop/SKILL.md' '$BUILD_SKILL'"
check "C7: build が3エージェントを参照" "grep -q 'agents/planner.md' '$BUILD_SKILL' && grep -q 'agents/generator.md' '$BUILD_SKILL' && grep -q 'agents/evaluator.md' '$BUILD_SKILL'"
check "C7: build に進行宣言がある" "grep -qE '$prog_re' '$BUILD_SKILL'"
check "C7: build が plain-language を参照" "grep -q 'plain-language.md' '$BUILD_SKILL'"
check "C7: ルーターに build モード" "grep -q 'skills/build/SKILL.md' '$SECRETARY_SKILL'"

# --- D8: ユーザー向け複製文言に家系メタファーが無い（内部契約テンプレは技術維持で対象外）---
check "D8: 複製のユーザー向け文言（agents/build/harness-loop）に家系メタファーが無い" \
  "! grep -rqE '秘書の家|この家|お家|おうち' '$AGENTS_DIR' '$BUILD_SKILL' '$HLOOP'"

# --- D8(境界要素): evaluator は6軸スコア・証跡ルールの内部値を維持しつつ平易な言い換えを併置 ---
check "D8: evaluator が rubric の6軸・閾値・証跡の内部値を維持" \
  "grep -q '6軸' '$AGENTS_DIR/evaluator.md' && grep -q '閾値' '$AGENTS_DIR/evaluator.md' && grep -q '証跡' '$AGENTS_DIR/evaluator.md'"
check "D8: evaluator が内部値を保ったまま平易な言い換えを併置" \
  "grep -q '内部の値' '$AGENTS_DIR/evaluator.md' && grep -q '言い換え' '$AGENTS_DIR/evaluator.md'"

# --- D9(一元化): 平易化文言を rules/plain-language.md に集約し、5面から参照（重複コピーを増やさない）---
oneref=0
for f in "$AGENTS_DIR/planner.md" "$AGENTS_DIR/generator.md" "$AGENTS_DIR/evaluator.md" "$BUILD_SKILL" "$HLOOP"; do
  grep -q 'plain-language.md' "$f" || { echo "  未参照: $f"; oneref=$((oneref+1)); }
done
check "D9: planner/generator/evaluator/build/harness-loop が plain-language を一元参照" "[ $oneref -eq 0 ]"

# --- D10(hooks 非衝突): cc-secretary は二重起動する SessionStart フックを登録していない ---
# 設計判断: ハーネスの hooks は複製せず、build を明示入口にする（session-start 注入で本体起動と干渉させない）。
check "D10: cc-secretary に hooks.json が同梱されていない（登録しない設計）" \
  "[ -z \"\$(find '$PLUGIN' -name 'hooks.json' 2>/dev/null)\" ]"
check "D10: cc-secretary に session-start 系フックが複製されていない" \
  "[ -z \"\$(find '$PLUGIN' -name 'session-start.sh' 2>/dev/null)\" ]"
check "D10: プラグイン定義に SessionStart フック登録が無い（二重起動なし）" \
  "! grep -rq 'SessionStart' '$PLUGIN/.claude-plugin' '$REPO/.claude-plugin'"

# ---------------------------------------------------------------------------
section "結果"
# ---------------------------------------------------------------------------
printf 'PASS=%d  FAIL=%d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || { printf '\n\033[31m回帰チェック不合格\033[0m\n'; exit 1; }
printf '\n\033[32m回帰チェック合格\033[0m\n'

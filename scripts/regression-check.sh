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
RULES="$PLUGIN/rules/plain-language.md"

check "secretary/SKILL.md が存在" "[ -f '$SECRETARY_SKILL' ]"
check "onboarding/SKILL.md が存在" "[ -f '$ONBOARD_SKILL' ]"
check "rules/plain-language.md が存在" "[ -f '$RULES' ]"

# frontmatter の name を取り出す（1行目 --- 以降）
name_of(){ awk '/^---$/{n++;next} n==1 && /^name:/{print $2; exit}' "$1"; }
SNAME="$(name_of "$SECRETARY_SKILL")"
ONAME="$(name_of "$ONBOARD_SKILL")"
check "secretary の name が 'secretary'" "[ '$SNAME' = 'secretary' ]"
check "onboarding の name が 'onboarding'" "[ '$ONAME' = 'onboarding' ]"
check "name が一意（重複なし）" "[ '$SNAME' != '$ONAME' ]"

# 同梱ファイル参照は ${CLAUDE_PLUGIN_ROOT} 相対に統一されている（constraints.md L40 / domain.md）。
# (a) ${CLAUDE_PLUGIN_ROOT}/... の参照先が全て実在（プラグイン配下で解決）
deadlinks=0
while IFS= read -r ref; do
  ref="${ref%/}"   # 末尾スラッシュ（ディレクトリ参照）を正規化
  [ -e "$PLUGIN_ROOT/$ref" ] || { echo "  デッドリンク: \${CLAUDE_PLUGIN_ROOT}/$ref"; deadlinks=$((deadlinks+1)); }
done < <(grep -rhoE '\$\{CLAUDE_PLUGIN_ROOT\}/[A-Za-z0-9_./-]+(\.md|/)?' "$SECRETARY_SKILL" "$ONBOARD_SKILL" \
          | sed -E 's#^\$\{CLAUDE_PLUGIN_ROOT\}/##' | sort -u)
check "SKILL の \${CLAUDE_PLUGIN_ROOT} 参照先が全て実在" "[ $deadlinks -eq 0 ]"

# (b) 雛形が新配置（plugins/cc-secretary/templates/）に存在する
check "雛形が plugins/cc-secretary/templates/ に存在" "[ -f '$PLUGIN/templates/AGENTS.md' ] && [ -f '$PLUGIN/templates/CLAUDE.md' ]"

# (c) 同梱ファイルへのリポジトリ直下相対参照（plugins/cc-secretary/... や bare templates/）が残っていない
check "SKILL に plugins/cc-secretary/ 直下相対の同梱参照が無い" \
  "! grep -rqE 'plugins/cc-secretary/' '$SECRETARY_SKILL' '$ONBOARD_SKILL'"
check "SKILL に \${CLAUDE_PLUGIN_ROOT} を伴わない bare templates/ 参照が無い" \
  "! grep -rhoE '[^./{]templates/' '$SECRETARY_SKILL' '$ONBOARD_SKILL' | grep -q ."
# (d) 絶対パス直書き（先頭スラッシュのコード参照）が無い
check "SKILL に絶対パス直書きが無い" \
  "! grep -rhoE '\`/[A-Za-z]' '$SECRETARY_SKILL' '$ONBOARD_SKILL' | grep -q ."

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
  git commit -q -m "秘書の家を作成（初回セットアップ）"
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
section "結果"
# ---------------------------------------------------------------------------
printf 'PASS=%d  FAIL=%d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || { printf '\n\033[31m回帰チェック不合格\033[0m\n'; exit 1; }
printf '\n\033[32m回帰チェック合格\033[0m\n'

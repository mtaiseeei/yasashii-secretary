#!/usr/bin/env bash
# Sprint 012: weekly / MEMORY.md 199-201行 / journal月退避の実動作回帰

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$ROOT/plugins/secretary"
TOOLS="$PLUGIN/skills/memory-care/scripts/memory-tools.sh"
WORKSPACE="$PLUGIN/scripts/workspace-tools.sh"
WEEKLY_SKILL="$PLUGIN/skills/weekly/SKILL.md"
TEMPLATES="$PLUGIN/templates"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); printf 'PASS %s\n' "$1"; }
ng(){ FAIL=$((FAIL+1)); printf 'FAIL %s\n' "$1"; }
check(){ local label="$1"; shift; if eval "$*"; then ok "$label"; else ng "$label"; fi; }

materialize(){ # $1=dest
  local dest="$1"
  mkdir -p "$dest"; cp -R "$TEMPLATES/." "$dest/"
  mv "$dest/memory/decisions/_first-decision.md" "$dest/memory/decisions/2026-07-16-decisions.md"
  find "$dest" -type f -name '*.md' -print0 | while IFS= read -r -d '' f; do
    perl -pi -e 's/\{\{OWNER_NAME\}\}/村山さん/g; s/\{\{OWNER_ROLE\}\}/講師/g; s/\{\{PRIMARY_SERVICE\}\}/Google/g; s/\{\{PRIMARY_SERVICE_DETAIL\}\}/Gmail・Googleカレンダー/g; s/\{\{TASKS\}\}/資料作成/g; s/\{\{REPORT_DETAIL\}\}/みじかく/g; s/\{\{CREATED_DATE\}\}/2026-07-16/g; s/\{\{CREATED_AT\}\}/2026-07-16 09:00/g' "$f"
  done
  git -C "$dest" init -q
  git -C "$dest" config user.email regression@example.com
  git -C "$dest" config user.name regression
  git -C "$dest" add -A
  git -C "$dest" commit -q -m '秘書ディレクトリを作成（回帰fixture）'
}

tree_digest(){
  find "$1" -path "$1/.git" -prune -o -type f -print0 | sort -z | xargs -0 shasum | shasum | cut -d' ' -f1
}

doc_count(){ find "$1/docs" -type f ! -name '.gitkeep' | wc -l | tr -d ' '; }
journal_count(){ find "$1/memory/journal" -type f -name '*.md' -exec grep -hEc '^- [0-9]{2}:[0-9]{2} \[' {} \; 2>/dev/null | awk '{n+=$1} END{print n+0}'; }

check "weekly skillと共有libが存在し実行可能" \
  "[ -f '$WEEKLY_SKILL' ] && [ -x '$PLUGIN/scripts/lib/weekly.sh' ] && [ -x '$PLUGIN/scripts/lib/memory-archive.sh' ]"
check "weekly skillのfrontmatterとserializer参照が整合" \
  "[ \"\$(awk '/^name:/{print \$2; exit}' '$WEEKLY_SKILL')\" = weekly ] && grep -q '最終応答serializer.*だけを正本' '$WEEKLY_SKILL' && ! grep -q '^やったこと:' '$WEEKLY_SKILL'"
check "weeklyはdashboardとmigrationをscopeへ追加しない" \
  "grep -q 'dashboard.*追加しない' '$WEEKLY_SKILL' && grep -q 'migration.*追加しない' '$WEEKLY_SKILL' && [ ! -f '$TEMPLATES/dashboard.html' ]"
check "routerがweeklyを段階ロード" "grep -q '今週を振り返って.*weekly' '$PLUGIN/skills/secretary/SKILL.md'"
check "新規セットアップにarchive/journalがある" "[ -f '$TEMPLATES/memory/archive/journal/.gitkeep' ]"

# 固定週fixture: 2026-08-02(日)を含む月曜2026-07-27〜日曜2026-08-02。
SEC="$WORK/weekly/secretary"; materialize "$SEC"
CC_SECRETARY_NOW=2026-07-26T09:00:00+09:00 "$TOOLS" journal-add "$SEC" did '前週の活動' >/dev/null
CC_SECRETARY_NOW=2026-07-27T09:00:00+09:00 "$TOOLS" journal-add "$SEC" did '講義資料を作成' >/dev/null
CC_SECRETARY_NOW=2026-07-28T10:00:00+09:00 "$TOOLS" journal-add "$SEC" decided 'Zoomはオンライン開催にする' >/dev/null
CC_SECRETARY_NOW=2026-07-29T11:00:00+09:00 "$TOOLS" journal-add "$SEC" decided '変更: 「Zoomはオンライン開催にする」(2026-07-28) → 「Zoomは対面開催にする」（会場確保）' >/dev/null
CC_SECRETARY_NOW=2026-07-30T12:00:00+09:00 "$TOOLS" journal-add "$SEC" did '説明会を登録（出典: Google Calendar / event-30 / 2026-07-30）' >/dev/null
CC_SECRETARY_NOW=2026-08-02T17:00:00+09:00 "$TOOLS" journal-add "$SEC" next '翌週に請求書を確認' >/dev/null
CC_SECRETARY_NOW=2026-08-03T09:00:00+09:00 "$TOOLS" journal-add "$SEC" did '翌週の活動' >/dev/null
BEFORE_WEEKLY="$(tree_digest "$SEC")"
CC_SECRETARY_NOW=2026-08-02T20:00:00+09:00 "$TOOLS" weekly "$SEC" > "$WORK/weekly-1.md"
CC_SECRETARY_NOW=2026-08-02T08:00:00+09:00 "$TOOLS" weekly "$SEC" > "$WORK/weekly-2.md"
check "固定週は月曜から日曜で月跨ぎを処理" \
  "grep -q '期間: 2026-07-27 〜 2026-08-02（月曜〜日曜）' '$WORK/weekly-1.md'"
check "weeklyは同じ原本と週でbyte一致" "cmp -s '$WORK/weekly-1.md' '$WORK/weekly-2.md'"
check "対象週の日次journal原本一覧を表示" \
  "grep -q '入力: 対象期間の日次journal原本 5件' '$WORK/weekly-1.md' && [ \"\$(grep -Ec '^- 2026-[0-9]{2}-[0-9]{2}: .*memory/journal/' '$WORK/weekly-1.md')\" -eq 5 ]"
check "did/decided/nextを分ける" \
  "grep -q '^## 活動（did）' '$WORK/weekly-1.md' && grep -q '^## 決定（decided）' '$WORK/weekly-1.md' && grep -q '^## 翌週への申し送り（next）' '$WORK/weekly-1.md'"
check "週外の前週・翌週を混ぜない" \
  "! grep -q '前週の活動' '$WORK/weekly-1.md' && ! grep -q '翌週の活動' '$WORK/weekly-1.md'"
check "決定変更履歴を原文のまま非統合で表示" \
  "grep -qF '変更: 「Zoomはオンライン開催にする」(2026-07-28) → 「Zoomは対面開催にする」（会場確保）' '$WORK/weekly-1.md' && grep -q '矛盾を自動統合せず' '$WORK/weekly-1.md'"
check "決定は新しい記録を先に表示し統合候補を確認へ回す" \
  "[ \"\$(grep -n '変更: 「Zoomはオンライン開催にする」' '$WORK/weekly-1.md' | head -1 | cut -d: -f1)\" -lt \"\$(grep -n 'Zoomはオンライン開催にする （原本' '$WORK/weekly-1.md' | head -1 | cut -d: -f1)\" ] && grep -q '統合候補.*ユーザー確認後' '$WORK/weekly-1.md'"
check "外部根拠はサービス名・ID・日付を保持" \
  "grep -qF 'Google Calendar / event-30 / 2026-07-30' '$WORK/weekly-1.md'"
check "weekly閲覧だけでは副作用0" "[ \"\$(tree_digest '$SEC')\" = '$BEFORE_WEEKLY' ]"

EMPTY="$WORK/empty/secretary"; materialize "$EMPTY"
CC_SECRETARY_NOW=2026-08-02T20:00:00+09:00 "$TOOLS" weekly "$EMPTY" > "$WORK/empty.md"
check "データ0件をexit 0で明示" "grep -q '日次journal原本はありません' '$WORK/empty.md'"
set +e; "$TOOLS" weekly "$EMPTY" --week 2026/08/02 >/dev/null 2>&1; BAD_WEEK_RC=$?; set -e
check "不正な週基準日をexit 2で拒否" "[ '$BAD_WEEK_RC' -eq 2 ]"

# 明示保存時だけ成果物＋journal＋日本語local commit。
DOCS0="$(doc_count "$SEC")"; JOURNAL0="$(journal_count "$SEC")"; COMMITS0="$(git -C "$SEC" rev-list --count HEAD)"
CC_SECRETARY_NOW=2026-08-02T20:00:00+09:00 "$TOOLS" weekly "$SEC" > "$WORK/to-save.md"
check "保存前の週次生成は成果物・journal・commitを増やさない" \
  "[ \"\$(doc_count '$SEC')\" -eq '$DOCS0' ] && [ \"\$(journal_count '$SEC')\" -eq '$JOURNAL0' ] && [ \"\$(git -C '$SEC' rev-list --count HEAD)\" -eq '$COMMITS0' ]"
CC_SECRETARY_NOW=2026-08-02T20:00:00+09:00 "$WORKSPACE" save-deliverable "$SEC" 2026-08-02 '週次ふりかえり 2026-07-27〜2026-08-02' '週次,振り返り' < "$WORK/to-save.md" >/dev/null
"$TOOLS" commit "$SEC" '週次ふりかえりを保存（2026-07-27〜2026-08-02）' >/dev/null
check "明示保存だけが成果物を1件作る" "[ \"\$(doc_count '$SEC')\" -eq $((DOCS0+1)) ]"
check "明示保存のjournal副作用は1件だけ" \
  "[ \"\$(journal_count '$SEC')\" -eq $((JOURNAL0+1)) ] && [ \"\$(grep -Rh '成果物「週次ふりかえり 2026-07-27〜2026-08-02」を保存' '$SEC/memory/journal' | wc -l | tr -d ' ')\" -eq 1 ]"
check "一時fixtureの日本語local commitは1件だけ増える" \
  "[ \"\$(git -C '$SEC' rev-list --count HEAD)\" -eq $((COMMITS0+1)) ] && git -C '$SEC' log -1 --format=%s | grep -q '[ぁ-んァ-ン一-龥]' && [ -z \"\$(git -C '$SEC' remote)\" ]"

# 199/200/201行相当。reindex後の最終行数を動的に合わせる。
make_index_fixture(){ # $1=dest $2=target source lines
  local dest="$1" target="$2" base need i
  materialize "$dest"
  printf '# old journal\n' > "$dest/memory/journal/2026-06-01.md"
  "$TOOLS" reindex "$dest" >/dev/null 2>/dev/null
  base="$(wc -l < "$dest/memory/MEMORY.md" | tr -d ' ')"; need=$((target-base))
  i=1; while [ "$i" -le "$need" ]; do printf '# topic %03d\n' "$i" > "$dest/memory/topics/topic-$(printf '%03d' "$i").md"; i=$((i+1)); done
}
I199="$WORK/i199/secretary"; make_index_fixture "$I199" 199
"$TOOLS" reindex "$I199" >/dev/null 2>"$WORK/w199"; R199=$?
I200="$WORK/i200/secretary"; make_index_fixture "$I200" 200
"$TOOLS" reindex "$I200" >/dev/null 2>"$WORK/w200"; R200=$?
I201="$WORK/i201/secretary"; make_index_fixture "$I201" 201
"$TOOLS" reindex "$I201" >/dev/null 2>"$WORK/w201"; R201=$?
check "199行はexit 0・警告なし" "[ '$R199' -eq 0 ] && [ \"\$(wc -l < '$I199/memory/MEMORY.md' | tr -d ' ')\" -eq 199 ] && [ ! -s '$WORK/w199' ]"
check "200行はexit 0・警告なし" "[ '$R200' -eq 0 ] && [ \"\$(wc -l < '$I200/memory/MEMORY.md' | tr -d ' ')\" -eq 200 ] && [ ! -s '$WORK/w200' ]"
check "201行相当はexit 0で索引を200行に保つ" "[ '$R201' -eq 0 ] && [ \"\$(wc -l < '$I201/memory/MEMORY.md' | tr -d ' ')\" -eq 200 ]"
check "201行警告は候補・残る参照・timeline影響を示す" \
  "grep -q '退避候補: 2026-06' '$WORK/w201' && grep -q '残る参照' '$WORK/w201' && grep -q 'timeline/weeklyへの影響' '$WORK/w201'"

# 月退避: planと未確認は副作用0、confirm後は原本を残して両viewerが読める。
ARC="$WORK/archive/secretary"; materialize "$ARC"
CC_SECRETARY_NOW=2026-06-10T10:00:00+09:00 "$TOOLS" journal-add "$ARC" did '6月の原本活動' >/dev/null
CC_SECRETARY_NOW=2026-07-10T10:00:00+09:00 "$TOOLS" journal-add "$ARC" next '7月の申し送り' >/dev/null
CC_SECRETARY_NOW=2026-08-10T10:00:00+09:00 "$TOOLS" journal-add "$ARC" did '現在月の活動' >/dev/null
ARC_BEFORE="$(tree_digest "$ARC")"
CC_SECRETARY_NOW=2026-08-10T10:00:00+09:00 "$TOOLS" archive-plan "$ARC" 2026-06 > "$WORK/archive-plan.md"
check "退避planは対象・残る参照・影響を提示" \
  "grep -q '対象: 2026-06' '$WORK/archive-plan.md' && grep -q '残る参照' '$WORK/archive-plan.md' && grep -q 'timeline/weeklyへの影響' '$WORK/archive-plan.md'"
check "退避planだけでは副作用0" "[ \"\$(tree_digest '$ARC')\" = '$ARC_BEFORE' ]"
set +e; CC_SECRETARY_NOW=2026-08-10T10:00:00+09:00 "$TOOLS" archive-month "$ARC" 2026-06 >/dev/null 2>&1; NO_CONFIRM_RC=$?; set -e
check "未確認の退避はexit 3" "[ '$NO_CONFIRM_RC' -eq 3 ]"
check "未確認・キャンセル相当は副作用0" "[ \"\$(tree_digest '$ARC')\" = '$ARC_BEFORE' ]"
CC_SECRETARY_NOW=2026-08-10T10:00:00+09:00 "$TOOLS" archive-month "$ARC" 2026-06 --confirm > "$WORK/archive-done.txt"
check "確認後だけ月原本を削除せず退避先へ移す" \
  "[ ! -f '$ARC/memory/journal/2026-06-10.md' ] && [ -f '$ARC/memory/archive/journal/2026-06/2026-06-10.md' ] && grep -q '6月の原本活動' '$ARC/memory/archive/journal/2026-06/2026-06-10.md'"
check "退避後のMEMORY索引がarchiveを参照" "grep -q '2026-06 の活動（退避済み）' '$ARC/memory/MEMORY.md'"
"$TOOLS" timeline "$ARC" --from 2026-06-01 --to 2026-06-30 --type journal > "$WORK/archive-timeline.md"
"$TOOLS" weekly "$ARC" --week 2026-06-10 > "$WORK/archive-weekly.md"
check "退避後もtimelineが原本を表示" "grep -q '6月の原本活動' '$WORK/archive-timeline.md'"
check "退避後もweeklyがarchive原本を表示・案内" \
  "grep -q '6月の原本活動' '$WORK/archive-weekly.md' && grep -q 'memory/archive/journal/2026-06/2026-06-10.md' '$WORK/archive-weekly.md' && grep -q 'timelineとweeklyは退避先も検索' '$WORK/archive-done.txt'"
set +e; CC_SECRETARY_NOW=2026-08-10T10:00:00+09:00 "$TOOLS" archive-month "$ARC" 2026-08 --confirm >/dev/null 2>&1; CURRENT_RC=$?; set -e
check "現在月は退避対象にしない" "[ '$CURRENT_RC' -eq 2 ] && [ -f '$ARC/memory/journal/2026-08-10.md' ]"

MIXED="$WORK/mixed/secretary"; materialize "$MIXED"
CC_SECRETARY_NOW=2026-06-10T10:00:00+09:00 "$TOOLS" journal-add "$MIXED" did 'active側の原本' >/dev/null
mkdir -p "$MIXED/memory/archive/journal/2026-06"
printf '# 既存の退避済み原本\n\n- 09:00 [did] archive側の原本\n' > "$MIXED/memory/archive/journal/2026-06/2026-06-09.md"
MIXED_BEFORE="$(tree_digest "$MIXED")"
set +e; CC_SECRETARY_NOW=2026-08-10T10:00:00+09:00 "$TOOLS" archive-month "$MIXED" 2026-06 --confirm >/dev/null 2>&1; MIXED_RC=$?; set -e
check "同月の退避済み原本があれば無断mergeをexit 3で拒否" "[ '$MIXED_RC' -eq 3 ]"
check "同月merge拒否はactive・archive双方へ副作用0" "[ \"\$(tree_digest '$MIXED')\" = '$MIXED_BEFORE' ]"

OUT="$WORK/outside"; mkdir -p "$OUT"; printf keep > "$OUT/keep"
SAFE="$WORK/symlink/secretary"; materialize "$SAFE"; rm -rf "$SAFE/memory/archive"; ln -s "$OUT" "$SAFE/memory/archive"
set +e; CC_SECRETARY_NOW=2026-08-10T10:00:00+09:00 "$TOOLS" archive-plan "$SAFE" >/dev/null 2>&1; LINK_RC=$?; set -e
check "境界外archive symlinkをexit 3で拒否" "[ '$LINK_RC' -eq 3 ]"
check "symlink拒否前に外部副作用0" "[ \"\$(cat '$OUT/keep')\" = keep ] && [ \"\$(find '$OUT' -type f | wc -l | tr -d ' ')\" -eq 1 ]"

check "関連shellの構文が有効" \
  "bash -n '$TOOLS' '$WORKSPACE' '$PLUGIN/scripts/lib/weekly.sh' '$PLUGIN/scripts/lib/memory-archive.sh' '$PLUGIN/scripts/lib/memory-index.sh' '$PLUGIN/scripts/lib/timeline.sh' '$ROOT/scripts/sprint-012-regression.sh'"

printf 'PASS=%d FAIL=%d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

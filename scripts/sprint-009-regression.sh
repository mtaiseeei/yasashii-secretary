#!/usr/bin/env bash
# Sprint 009: journal / topics / TODO / reindex の実動作回帰

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN="$REPO/plugins/secretary"
TEMPLATES="$PLUGIN/templates"
MT="$PLUGIN/skills/memory-care/scripts/memory-tools.sh"
WT="$PLUGIN/scripts/workspace-tools.sh"

PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); printf 'PASS %s\n' "$1"; }
ng(){ FAIL=$((FAIL+1)); printf 'FAIL %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else ng "$1"; fi; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/yasashii-secretary-s009.XXXXXX")"
cleanup(){ rm -rf "$WORK"; }
trap cleanup EXIT

mk_sec(){
  dest="$1"; mkdir -p "$dest"; cp -R "$TEMPLATES/." "$dest/"
  mv "$dest/memory/decisions/_first-decision.md" "$dest/memory/decisions/2026-07-08-decisions.md"
}
journal_rows(){ grep -c '^- [0-9][0-9]:[0-9][0-9] \[' "$1" 2>/dev/null || true; }

check "journal共有libが存在" "[ -f '$PLUGIN/scripts/lib/journal.sh' ]"
check "MEMORY再索引の共有libが存在" "[ -f '$PLUGIN/scripts/lib/memory-index.sh' ]"
check "journal共有libに実行権限" "[ -x '$PLUGIN/scripts/lib/journal.sh' ]"
check "テンプレにjournal/topicsがある" "[ -d '$TEMPLATES/memory/journal' ] && [ -d '$TEMPLATES/memory/topics' ]"
check "journalの更新・削除コマンドを提供しない" \
  "! grep -qE 'journal-(update|edit|delete)' '$MT' '$WT'"

# 純追加・入力拒否・固定時刻
S1="$WORK/pure"; mk_sec "$S1"
export CC_SECRETARY_NOW="2026-07-20T09:15:00+09:00"
bash "$MT" journal-add "$S1" did "最初の活動" >/dev/null 2>&1
J1="$S1/memory/journal/2026-07-20.md"; cp "$J1" "$WORK/journal-before"
check "journal初回作成と同時にMEMORY月索引が追従" "grep -q '2026-07 の活動' '$S1/memory/MEMORY.md'"
bash "$MT" journal-add "$S1" next "次の活動" >/dev/null 2>&1
BEFORE_SIZE="$(wc -c < "$WORK/journal-before" | tr -d ' ')"
head -c "$BEFORE_SIZE" "$J1" > "$WORK/journal-prefix"
check "journal既存内容をbyte単位で保持" "cmp -s '$WORK/journal-before' '$WORK/journal-prefix'"
check "journal新規行は末尾だけに増える" "[ \"\$(tail -n 1 '$J1')\" = '- 09:15 [next] 次の活動' ]"
J1_SUM="$(cksum "$J1")"
bash "$MT" journal-add "$S1" did "   " >/dev/null 2>&1; EMPTY_RC=$?
check "journal空本文をexit 3で拒否" "[ '$EMPTY_RC' -eq 3 ]"
check "journal空本文拒否前後で副作用なし" "[ \"\$(cksum '$J1')\" = '$J1_SUM' ]"
bash "$MT" journal-add "$S1" unknown "不正" >/dev/null 2>&1; TYPE_RC=$?
check "journal未知typeを非ゼロで拒否" "[ '$TYPE_RC' -ne 0 ]"
check "journal未知type拒否前後で副作用なし" "[ \"\$(cksum '$J1')\" = '$J1_SUM' ]"
check "固定時刻がファイル名と行時刻へ反映" "grep -q 'createdAt: 2026-07-20 09:15' '$J1' && grep -q '^- 09:15' '$J1'"
check "journalにロケール依存の曜日が無い" "! grep -Eq '月曜日|火曜日|水曜日|木曜日|金曜日|土曜日|日曜日|Mon|Tue|Wed|Thu|Fri|Sat|Sun' '$J1'"

S2="$WORK/deterministic"; mk_sec "$S2"
bash "$MT" journal-add "$S2" did "最初の活動" >/dev/null 2>&1
bash "$MT" journal-add "$S2" next "次の活動" >/dev/null 2>&1
check "同じ固定時刻と入力でjournalがbyte一致" "cmp -s '$J1' '$S2/memory/journal/2026-07-20.md'"

# 全シームの成功時1回・失敗時0回
S3="$WORK/seams"; mk_sec "$S3"
export CC_SECRETARY_NOW="2026-07-21T14:05:00+09:00"
printf '成果物本文\n' | bash "$WT" save-deliverable "$S3" 2026-07-21 "配管確認" >/dev/null 2>&1
bash "$WT" todo-add "$S3" "期限なしTODO" "手入力 | local-1 | 2026-07-21" >/dev/null 2>&1
bash "$WT" todo-add "$S3" "期限ありTODO" "Gmail | mail-2 | 2026-07-21" 2026-07-23 >/dev/null 2>&1
bash "$WT" todo-done "$S3" 1 --confirm >/dev/null 2>&1
bash "$WT" todo-carry "$S3" 1 2026-07-24 --confirm >/dev/null 2>&1
OLD_DEC_SUM="$(cksum "$S3/memory/decisions/2026-07-08-decisions.md")"
bash "$MT" remember-decision "$S3" 2026-07-21 '変更: 「旧案」(2026-07-08) → 「新案」（検証結果）' >/dev/null 2>&1
bash "$MT" topic-add "$S3" "Zoom相談" "料金と開催時刻は未決定" >/dev/null 2>&1
bash "$MT" journal-add "$S3" did "設定変更シーム接続用の境界を確認" >/dev/null 2>&1
J3="$S3/memory/journal/2026-07-21.md"
check "8つの成功イベントが1回ずつjournalへ増える" "[ \"\$(journal_rows '$J3')\" = 8 ]"
check "シームtype対応がdid/decided/next/noteで成立" \
  "[ \"\$(grep -c '\[did\]' '$J3')\" = 3 ] && [ \"\$(grep -c '\[decided\]' '$J3')\" = 1 ] && [ \"\$(grep -c '\[next\]' '$J3')\" = 3 ] && [ \"\$(grep -c '\[note\]' '$J3')\" = 1 ]"
check "過去decisionは変更されない" "[ \"\$(cksum '$S3/memory/decisions/2026-07-08-decisions.md')\" = '$OLD_DEC_SUM' ]"
check "変更decisionは新しい日付ファイルへ純追加" "grep -q '旧案.*新案' '$S3/memory/decisions/2026-07-21-decisions.md'"
check "topicは確認済み要点だけを保存" "grep -q '料金と開催時刻は未決定' '$S3/memory/topics/Zoom相談.md' && ! grep -q '会話全文' '$S3/memory/topics/Zoom相談.md'"
check "topic追加でMEMORY索引が追従" "grep -q 'topics/Zoom相談.md' '$S3/memory/MEMORY.md'"
check "期限なしTODOを完了できる" "grep -q '^- \[x\] 期限なしTODO.*完了: 2026-07-21' '$S3/inbox/todo.md'"
check "期限ありTODOを持ち越せる" "grep -q '期限: 2026-07-23.*繰越: 2026-07-24' '$S3/inbox/todo.md'"

ROWS_BEFORE="$(journal_rows "$J3")"
printf '   \n' | bash "$WT" save-deliverable "$S3" 2026-07-21 "空" >/dev/null 2>&1
bash "$WT" todo-add "$S3" "根拠なし" "" >/dev/null 2>&1
bash "$MT" remember-decision "$S3" bad-date "失敗" >/dev/null 2>&1
bash "$MT" topic-add "$S3" "空topic" "   " >/dev/null 2>&1
check "主処理失敗4件はjournalを増やさない" "[ \"\$(journal_rows '$J3')\" = '$ROWS_BEFORE' ]"

# journal側が失敗すると主処理をrollbackする
S4="$WORK/rollback"; mk_sec "$S4"
export CC_SECRETARY_NOW="2026-07-22T10:00:00+09:00"
mkdir -p "$S4/memory/journal/2026-07-22.md"
bash "$WT" todo-add "$S4" "残ってはいけない" "手入力 | local | 2026-07-22" >/dev/null 2>&1; ROLLBACK_RC=$?
check "journal失敗時はシーム全体が非ゼロ" "[ '$ROLLBACK_RC' -ne 0 ]"
check "journal失敗時はTODO主処理をrollback" "[ ! -f '$S4/inbox/todo.md' ]"
INDEX_BEFORE="$(cksum "$S4/memory/MEMORY.md")"
bash "$MT" remember-decision "$S4" 2026-07-22 "残ってはいけない決定" >/dev/null 2>&1
check "journal失敗時はdecisionと索引をrollback" "[ ! -f '$S4/memory/decisions/2026-07-22-decisions.md' ] && [ \"\$(cksum '$S4/memory/MEMORY.md')\" = '$INDEX_BEFORE' ]"
bash "$MT" topic-add "$S4" "残らないtopic" "残ってはいけない要点" >/dev/null 2>&1
check "journal失敗時はtopicと索引をrollback" "[ ! -f '$S4/memory/topics/残らないtopic.md' ] && [ \"\$(cksum '$S4/memory/MEMORY.md')\" = '$INDEX_BEFORE' ]"
printf '残ってはいけない成果物\n' | bash "$WT" save-deliverable "$S4" 2026-07-22 "残らない成果物" >/dev/null 2>&1
check "journal失敗時は成果物をrollback" "[ ! -f '$S4/docs/2026/07/2026-07-22_残らない成果物.md' ]"

# 基点symlink・不正時刻は副作用前に拒否
S5="$WORK/guard-real"; mk_sec "$S5"; ln -s "$S5" "$WORK/guard-link"
export CC_SECRETARY_NOW="2026-07-23T11:00:00+09:00"
bash "$MT" journal-add "$WORK/guard-link" did "外へ書かない" >/dev/null 2>&1; LINK_RC=$?
check "基点symlinkのjournalをexit 3で拒否" "[ '$LINK_RC' -eq 3 ]"
check "基点symlink拒否前にjournalを作らない" "[ ! -e '$S5/memory/journal/2026-07-23.md' ]"
export CC_SECRETARY_NOW="not-a-date"
bash "$MT" journal-add "$S5" did "不正時刻" >/dev/null 2>&1; NOW_RC=$?
check "不正CC_SECRETARY_NOWを非ゼロで拒否" "[ '$NOW_RC' -ne 0 ]"
check "不正時刻拒否前に副作用なし" "[ ! -e '$S5/memory/journal/not-a-date.md' ]"

# reindex: topics、journal月単位、200行上限と警告
S6="$WORK/reindex"; mk_sec "$S6"
mkdir -p "$S6/memory/journal"
printf '# fixture\n' > "$S6/memory/journal/2026-07-01.md"
printf '# fixture\n' > "$S6/memory/journal/2026-07-31.md"
printf '# fixture\n' > "$S6/memory/journal/2026-08-01.md"
export CC_SECRETARY_NOW="2026-08-01T08:00:00+09:00"
bash "$MT" topic-add "$S6" "索引確認" "確認済み要点" >/dev/null 2>&1
bash "$MT" reindex "$S6" >/dev/null 2>&1
check "reindexがtopicsを含む" "grep -q 'topics/索引確認.md' '$S6/memory/MEMORY.md'"
check "reindexが同月journalを1行へ畳む" "[ \"\$(grep -c '2026-07 の活動' '$S6/memory/MEMORY.md')\" = 1 ]"
check "reindexが別月journalを分ける" "[ \"\$(grep -c '2026-08 の活動' '$S6/memory/MEMORY.md')\" = 1 ]"

S7="$WORK/limit"; mk_sec "$S7"; mkdir -p "$S7/memory/topics"
i=1; while [ "$i" -le 210 ]; do printf '# topic %03d\n' "$i" > "$S7/memory/topics/topic-${i}.md"; i=$((i+1)); done
bash "$MT" reindex "$S7" >/dev/null 2>"$WORK/reindex-warning"; LIMIT_RC=$?
check "200行超過予測でもreindexはexit 0" "[ '$LIMIT_RC' -eq 0 ]"
check "MEMORY.mdを200行以内に保つ" "[ \"\$(wc -l < '$S7/memory/MEMORY.md' | tr -d ' ')\" -le 200 ]"
check "200行超過時は退避提案をstderrへ出す" "grep -q '退避' '$WORK/reindex-warning'"

# topic削除も二段階確認と索引追従を維持
bash "$MT" delete "$S6" topics/索引確認.md >/dev/null 2>&1; TOPIC_WARN_RC=$?
check "topic削除は未確認ならexit 3" "[ '$TOPIC_WARN_RC' -eq 3 ] && [ -f '$S6/memory/topics/索引確認.md' ]"
bash "$MT" delete "$S6" topics/索引確認.md --confirm >/dev/null 2>&1
check "確認済みtopic削除で索引が追従" "[ ! -f '$S6/memory/topics/索引確認.md' ] && ! grep -q 'topics/索引確認.md' '$S6/memory/MEMORY.md'"

printf 'PASS=%d FAIL=%d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

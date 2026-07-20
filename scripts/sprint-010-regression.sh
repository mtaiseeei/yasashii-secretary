#!/usr/bin/env bash
# Sprint 010: timeline・節目プロトコル・morning/daily/evening統合の実動作回帰。

set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
PLUGIN="$REPO/plugins/secretary"
MEM="$PLUGIN/skills/memory-care/scripts/memory-tools.sh"
WORKSPACE="$PLUGIN/scripts/workspace-tools.sh"
TEMPLATES="$PLUGIN/templates"
PASS=0
FAIL=0
ok(){ PASS=$((PASS+1)); printf 'PASS %s\n' "$1"; }
ng(){ FAIL=$((FAIL+1)); printf 'FAIL %s\n' "$1"; }
assert(){ if eval "$2"; then ok "$1"; else ng "$1"; fi; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/yasashii-secretary-s010.XXXXXX")"
cleanup(){ rm -rf "$WORK"; }
trap cleanup EXIT

SEC="$WORK/secretary"
cp -R "$TEMPLATES/." "$SEC/"

assert "timeline関連shellの構文が有効" \
  "bash -n '$PLUGIN/scripts/lib/timeline.sh' '$MEM' '$WORKSPACE'"
assert "timeline共有ライブラリが存在" "[ -f '$PLUGIN/scripts/lib/timeline.sh' ]"
assert "memory-toolsがtimelineを公開" "grep -q 'timeline)' '$MEM'"

CC_SECRETARY_NOW=2026-07-14T09:00:00+09:00 "$MEM" remember-decision "$SEC" 2026-07-14 \
  "Zoomはオンライン開催にする" >/dev/null
OLD_DECISION_SUM="$(cksum "$SEC/memory/decisions/2026-07-14-decisions.md")"
CC_SECRETARY_NOW=2026-07-15T08:30:00+09:00 "$MEM" journal-add "$SEC" next \
  "請求書を確認する" >/dev/null
CC_SECRETARY_NOW=2026-07-15T16:00:00+09:00 "$MEM" journal-add "$SEC" did \
  "Zoom[本番]資料を作成" >/dev/null
CC_SECRETARY_NOW=2026-07-16T10:00:00+09:00 "$MEM" remember-decision "$SEC" 2026-07-16 \
  "変更: 「Zoomはオンライン開催にする」(2026-07-14) → 「Zoomは対面開催にする」（会場確保）" >/dev/null
CC_SECRETARY_NOW=2026-07-16T11:30:00+09:00 "$MEM" journal-add "$SEC" did \
  "会場へ連絡した" >/dev/null

"$MEM" timeline "$SEC" --type all > "$WORK/all-1.md"
CC_SECRETARY_NOW=2030-12-31T23:59:00+09:00 "$MEM" timeline "$SEC" --type all > "$WORK/all-2.md"
assert "同じ入力のtimelineはbyte一致" "cmp -s '$WORK/all-1.md' '$WORK/all-2.md'"
assert "timelineは日付を逆時系列表示" \
  "[ \"\$(grep -n '^## 2026-07-16' '$WORK/all-1.md' | cut -d: -f1)\" -lt \"\$(grep -n '^## 2026-07-14' '$WORK/all-1.md' | cut -d: -f1)\" ]"
assert "変更決定を最新優先と明示" "grep -q '決定・変更（最新を優先）' '$WORK/all-1.md'"
assert "過去の決定もtimelineに残る" "grep -q 'Zoomはオンライン開催にする' '$WORK/all-1.md'"
assert "allはjournal decidedを二重表示しない" \
  "[ \"\$(grep -c 'Zoomはオンライン開催にする' '$WORK/all-1.md')\" -eq 2 ]"
assert "古いdecisionファイルは変更されない" \
  "[ \"\$(cksum '$SEC/memory/decisions/2026-07-14-decisions.md')\" = '$OLD_DECISION_SUM' ]"

"$MEM" timeline "$SEC" --from 2026-07-15 --to 2026-07-15 --type journal > "$WORK/range.md"
assert "from/toは両端を含む" "grep -q '^## 2026-07-15' '$WORK/range.md'"
assert "from/toは範囲外の前日を除外" "! grep -q '2026-07-14' '$WORK/range.md'"
assert "from/toは範囲外の翌日を除外" "! grep -q '2026-07-16' '$WORK/range.md'"
assert "journal絞り込みは活動を表示" "grep -q '活動・did 16:00' '$WORK/range.md'"

"$MEM" timeline "$SEC" --type decisions > "$WORK/decisions.md"
assert "decisions絞り込みは決定を表示" "grep -q '\[決定' '$WORK/decisions.md'"
assert "decisions絞り込みは活動を除外" "! grep -q '活動・did' '$WORK/decisions.md'"
"$MEM" timeline "$SEC" --type journal > "$WORK/journal.md"
assert "journal絞り込みはjournalを表示" "grep -q '活動・next' '$WORK/journal.md'"
assert "journal絞り込みはdecision正本ラベルを除外" "! grep -q '\[決定\]' '$WORK/journal.md'"

"$MEM" timeline "$SEC" --type journal --grep 'Zoom[本番]' > "$WORK/grep.md"
assert "grepは固有名詞を含む該当行を返す" "grep -q 'Zoom\[本番\]資料を作成' '$WORK/grep.md'"
assert "grepは正規表現でなくliteral検索" "[ \"\$(grep -c '^-' '$WORK/grep.md')\" -eq 4 ]"
"$MEM" timeline "$SEC" --grep '存在しない語' > "$WORK/none.md"
assert "0件を分かりやすく表示" "grep -q '該当する記録はありません' '$WORK/none.md'"

set +e
"$MEM" timeline "$SEC" --from 2026/07/15 >/dev/null 2>&1; BAD_DATE_RC=$?
"$MEM" timeline "$SEC" --from 2026-07-16 --to 2026-07-15 >/dev/null 2>&1; BAD_RANGE_RC=$?
"$MEM" timeline "$SEC" --type weekly >/dev/null 2>&1; BAD_TYPE_RC=$?
"$MEM" timeline "$SEC" --unknown >/dev/null 2>&1; BAD_OPTION_RC=$?
set -e
assert "不正日付をexit 2で拒否" "[ '$BAD_DATE_RC' -eq 2 ]"
assert "逆転期間をexit 2で拒否" "[ '$BAD_RANGE_RC' -eq 2 ]"
assert "不正typeをexit 2で拒否" "[ '$BAD_TYPE_RC' -eq 2 ]"
assert "不明optionをexit 2で拒否" "[ '$BAD_OPTION_RC' -eq 2 ]"

before_tree="$(find "$SEC" -type f -exec cksum {} \; | LC_ALL=C sort)"
"$MEM" timeline "$SEC" --type all >/dev/null
after_tree="$(find "$SEC" -type f -exec cksum {} \; | LC_ALL=C sort)"
assert "timeline閲覧はファイルを作成・変更しない" "[ \"$before_tree\" = \"$after_tree\" ]"
assert "timeline閲覧だけでは成果物を作らない" "[ -z \"\$(find '$SEC/docs' -type f ! -name .gitkeep -print)\" ]"
printf 'timeline保存テスト\n' | CC_SECRETARY_NOW=2026-07-16T12:00:00+09:00 \
  "$WORKSPACE" save-deliverable "$SEC" 2026-07-16 "Zoomのtimeline" "記録" >/dev/null
assert "明示保存は既存save-deliverableを通る" \
  "[ -f '$SEC/docs/2026/07/2026-07-16_Zoomのtimeline.md' ]"
assert "明示保存はjournalへ1回だけ記録" \
  "[ \"\$(grep -c '成果物「Zoomのtimeline」を保存' '$SEC/memory/journal/2026-07-16.md')\" -eq 1 ]"

SAFE="$WORK/symlink-secretary"
OUTSIDE="$WORK/outside"; mkdir -p "$OUTSIDE"; cp -R "$TEMPLATES/." "$SAFE/"
rm -rf "$SAFE/memory/journal"; ln -s "$OUTSIDE" "$SAFE/memory/journal"
set +e
"$MEM" timeline "$SAFE" --type journal >/dev/null 2>&1; SYMLINK_RC=$?
set -e
assert "境界外journal symlinkをexit 3で拒否" "[ '$SYMLINK_RC' -eq 3 ]"

SECRETARY_SKILL="$PLUGIN/skills/secretary/SKILL.md"
MEMCARE_SKILL="$PLUGIN/skills/memory-care/SKILL.md"
DAILY_SKILL="$PLUGIN/skills/daily/SKILL.md"
AGENTS_TEMPLATE="$PLUGIN/templates/AGENTS.md"
assert "決定の異なる3表現を会話規律に定義" \
  "grep -q '〜にしよう' '$MEMCARE_SKILL' && grep -q 'じゃあそれで' '$MEMCARE_SKILL' && grep -q 'それで決定' '$MEMCARE_SKILL'"
assert "決定は原文の短い確認後だけ記録" \
  "grep -q 'この内容を決定として残しますね' '$MEMCARE_SKILL' && grep -q '了承を得た後だけ.*remember-decision' '$MEMCARE_SKILL'"
assert "確認ターンは短い確認文だけで停止" \
  "grep -q '確認ターンでは次の短い確認文だけを返して、そこで止まる' '$SECRETARY_SKILL' && grep -q '確認ターンでは次の短い確認文だけを返して、そこで止まる' '$MEMCARE_SKILL' && grep -q '確認ターンでは次の短い確認文だけを返して、そこで止まる' '$AGENTS_TEMPLATE'"
assert "決定確認は入力全文を無加工で保持" \
  "grep -q '句読点・助詞・.*一字も削らず、並べ替えず、言い換えず' '$SECRETARY_SKILL' && grep -q '句読点・助詞・.*一字も削らず、並べ替えず、言い換えず' '$MEMCARE_SKILL' && grep -q '句読点・助詞・.*一字も削らず、並べ替えず、言い換えず' '$AGENTS_TEMPLATE'"
assert "決定確認に挨拶・説明・再確認を混ぜない" \
  "grep -q '挨拶、解釈、補足.*再確認.*足さない' '$SECRETARY_SKILL' && grep -q '挨拶、解釈、補足.*再確認.*混ぜない' '$MEMCARE_SKILL' && grep -q '挨拶、解釈、補足.*再確認.*混ぜない' '$AGENTS_TEMPLATE'"
assert "確認ターンは無副作用で別ターン了承後だけ記録" \
  "grep -q '確認ターンではツールを呼ばず' '$SECRETARY_SKILL' && grep -q '次の別ターンで明示的に了承した後だけ' '$SECRETARY_SKILL' && grep -q '確認ターンではツールを呼ばず' '$MEMCARE_SKILL' && grep -q '次の別ターンで明示的に了承した後だけ' '$MEMCARE_SKILL' && grep -q '確認ターンではツールを呼ばず' '$AGENTS_TEMPLATE' && grep -q '次の別ターンで明示的に了承した後だけ' '$AGENTS_TEMPLATE'"
assert "決定3表現の厳密な出力例を配布" \
  "grep -qF 'この内容を決定として残しますね: Zoomは対面開催にしよう' '$MEMCARE_SKILL' && grep -qF 'この内容を決定として残しますね: 候補AとBなら、じゃあそれで。' '$MEMCARE_SKILL' && grep -qF 'この内容を決定として残しますね: 配布日は7月25日。それで決定。' '$MEMCARE_SKILL'"
assert "決定検出が完全自動でないことを明示" "grep -q '完全自動ではない' '$MEMCARE_SKILL'"
assert "decidedゼロの締め確認を定義" \
  "grep -q '当日の.*decisions.*0件' '$MEMCARE_SKILL' && grep -q '会話を読み返' '$MEMCARE_SKILL'"
assert "topicは短い確認後に要点だけ保存" \
  "grep -q '要点を案件メモに残しますね' '$MEMCARE_SKILL' && grep -q '逐語ログ' '$MEMCARE_SKILL'"
assert "決定確認設定を都度とまとめてへ接続" \
  "grep -q '決定の確認.*都度' '$MEMCARE_SKILL' && grep -q 'まとめて.*候補を未確認のまま記録せず' '$MEMCARE_SKILL'"

assert "ルーターがtimeline自然言語を判別" \
  "grep -q '今日やったこと' '$SECRETARY_SKILL' && grep -q 'Zoomの件いつ決めた' '$SECRETARY_SKILL'"
assert "ルーターがmorning/evening自然言語を判別" \
  "grep -q '今日始めよう' '$SECRETARY_SKILL' && grep -q '今日はここまで' '$SECRETARY_SKILL'"
assert "ルーターが閲覧と保存を別導線に保つ" \
  "grep -q 'timeline（活動・決定の時系列）' '$SECRETARY_SKILL' && grep -q '成果物保存（出力規約）' '$SECRETARY_SKILL'"

assert "morningがresume・next・TODOを分離確認" \
  "grep -q 'resume-check' '$DAILY_SKILL' && grep -q '直近の.*next' '$DAILY_SKILL' && grep -q 'todo-list' '$DAILY_SKILL'"
assert "dailyが外部根拠を維持" \
  "grep -q 'サービス名＋リンク/ID＋日付' '$DAILY_SKILL' && grep -q '同期・コピーはしません' '$DAILY_SKILL'"
assert "eveningがtimeline・決定ゼロ・TODOを確認" \
  "grep -q '## evening' '$DAILY_SKILL' && grep -q '当日のdecisionが0件' '$DAILY_SKILL' && grep -q 'todo-carry' '$DAILY_SKILL'"
assert "朝夕モード自体はjournalへ追記しない" \
  "grep -q 'モードに入ったこと自体もjournalへ書かない' '$DAILY_SKILL'"
assert "同じ活動を二重追記しない" \
  "grep -q '重ねて.*journal-add.*しない' '$DAILY_SKILL' && grep -q '二重追記しない' '$AGENTS_TEMPLATE'"
assert "生成AGENTSにも節目プロトコルを配布" \
  "grep -q '会話の節目と1日の流れ' '$AGENTS_TEMPLATE' && grep -q '都度＋締めの二段構え' '$AGENTS_TEMPLATE'"
assert "生成AGENTSの専門用語規約が現行specと一致" \
  "grep -q '一般的な技術用語はそのまま使う' '$AGENTS_TEMPLATE' && grep -q '馴染みの薄い語だけ、初出時に短い補足を添える' '$AGENTS_TEMPLATE' && ! grep -q '専門用語には、やさしい言い換えをカッコで併記する' '$AGENTS_TEMPLATE'"
assert "既定3項目のMarkdown報告を維持" \
  "grep -q '最終応答serializer.*だけを正本' '$DAILY_SKILL' && grep -q '通常報告の唯一の正本は.*styles/yasashii.md' '$REPO/plugins/secretary/rules/plain-language.md' && grep -q '^## 最終応答serializer' '$REPO/plugins/secretary/rules/styles/yasashii.md' && grep -q 'Markdown箇条書きとして物理的に分けます' '$REPO/plugins/secretary/rules/styles/yasashii.md' && grep -q '明示的に「くわしく」の場合だけ' '$REPO/plugins/secretary/rules/styles/yasashii.md'"

# morning→daily→eveningで使う正規シームを一続きで実行し、閲覧による増分がないことを確認する。
FLOW="$WORK/flow-secretary"; cp -R "$TEMPLATES/." "$FLOW/"
CC_SECRETARY_NOW=2026-07-20T07:30:00+09:00 "$MEM" resume-write "$FLOW" \
  "Zoom資料" "図を仕上げる" "配布時刻" >/dev/null
CC_SECRETARY_NOW=2026-07-20T07:31:00+09:00 "$MEM" journal-add "$FLOW" next \
  "Zoom資料を完成する" >/dev/null
CC_SECRETARY_NOW=2026-07-20T08:00:00+09:00 "$WORKSPACE" todo-add "$FLOW" \
  "Zoom資料を送る" "Googleカレンダー | event-20 | 2026-07-20" >/dev/null
CC_SECRETARY_NOW=2026-07-20T17:00:00+09:00 "$MEM" remember-decision "$FLOW" 2026-07-20 \
  "配布は17時にする" >/dev/null
before_flow="$(grep -c '^-' "$FLOW/memory/journal/2026-07-20.md")"
"$MEM" resume-read "$FLOW" >/dev/null
"$MEM" timeline "$FLOW" --from 2026-07-20 --to 2026-07-20 --type all >/dev/null
"$WORKSPACE" todo-list "$FLOW" >/dev/null
after_flow="$(grep -c '^-' "$FLOW/memory/journal/2026-07-20.md")"
assert "morning→daily→eveningの閲覧はjournalを増やさない" "[ '$before_flow' -eq '$after_flow' ]"
assert "中断点は_resumeにだけ保持" "grep -q 'Zoom資料' '$FLOW/memory/_resume.md'"
assert "申し送りはjournal nextとして保持" "grep -q '\[next\] Zoom資料を完成する' '$FLOW/memory/journal/2026-07-20.md'"
assert "TODOは根拠つきで保持" "grep -q 'Googleカレンダー | event-20 | 2026-07-20' '$FLOW/inbox/todo.md'"
assert "決定はdecisionとjournalに1件ずつ対応" \
  "[ \"\$(grep -c '配布は17時にする' '$FLOW/memory/decisions/2026-07-20-decisions.md')\" -eq 1 ] && [ \"\$(grep -c '\[decided\] 配布は17時にする' '$FLOW/memory/journal/2026-07-20.md')\" -eq 1 ]"

printf 'PASS=%d FAIL=%d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1

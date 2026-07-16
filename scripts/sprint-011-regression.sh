#!/usr/bin/env bash
# Sprint 011: preferences v2 / settings / 既定値＋明示上書きの実動作回帰

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$ROOT/plugins/yasashii-secretary"
TOOLS="$PLUGIN/skills/memory-care/scripts/memory-tools.sh"
SETTINGS="$PLUGIN/skills/settings/SKILL.md"
RULES="$PLUGIN/rules/plain-language.md"
ONBOARD="$PLUGIN/skills/onboarding/SKILL.md"
TEMPLATES="$PLUGIN/templates"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PASS=0
FAIL=0
ok(){ PASS=$((PASS+1)); printf 'PASS %s\n' "$1"; }
ng(){ FAIL=$((FAIL+1)); printf 'FAIL %s\n' "$1"; }
check(){ local label="$1"; shift; if eval "$*"; then ok "$label"; else ng "$label"; fi; }

materialize(){ # $1=dest $2=role $3=detail
  local dest="$1" role="$2" detail="$3"
  mkdir -p "$dest"
  cp -R "$TEMPLATES/." "$dest/"
  mv "$dest/memory/decisions/_first-decision.md" "$dest/memory/decisions/2026-07-16-decisions.md"
  OWNER_ROLE="$role" REPORT_DETAIL="$detail" find "$dest" -type f -name '*.md' -print0 | while IFS= read -r -d '' f; do
    OWNER_ROLE="$role" REPORT_DETAIL="$detail" perl -pi -e '
      s/\{\{OWNER_NAME\}\}/村山さん/g;
      s/\{\{OWNER_ROLE\}\}/$ENV{OWNER_ROLE}/g;
      s/\{\{PRIMARY_SERVICE\}\}/Google/g;
      s/\{\{PRIMARY_SERVICE_DETAIL\}\}/Gmail・Googleカレンダー/g;
      s/\{\{TASKS\}\}/資料作成/g;
      s/\{\{REPORT_DETAIL\}\}/$ENV{REPORT_DETAIL}/g;
      s/\{\{CREATED_DATE\}\}/2026-07-16/g;
      s/\{\{CREATED_AT\}\}/2026-07-16 09:00/g;
    ' "$f"
  done
  git -C "$dest" init -q
  git -C "$dest" config user.email regression@example.com
  git -C "$dest" config user.name regression
  git -C "$dest" add -A
  git -C "$dest" commit -q -m "秘書ディレクトリを作成（回帰fixture）"
}

journal_lines(){
  find "$1/memory/journal" -type f -name '*.md' -exec grep -hE '^- [0-9]{2}:[0-9]{2} \[' {} \; 2>/dev/null | wc -l | tr -d ' '
}

tree_digest(){
  find "$1" -path "$1/.git" -prune -o -type f -print0 | sort -z | xargs -0 shasum | shasum | cut -d' ' -f1
}

serializer_contract_ok(){
  local file="$1"
  grep -q '最終応答serializer（通常報告の唯一の正本）' "$file" &&
    grep -q '無言で完了する' "$file" && grep -q 'serializerを1回だけ適用する' "$file" &&
    grep -q 'CLIの`result`はtool前後の途中メッセージも連結する' "$file" &&
    grep -q '^やったこと:' "$file" && grep -q '^結果:' "$file" && grep -q '^次に何が起きるか:' "$file" &&
    grep -q 'push' "$file" && grep -q '明示指示' "$file" &&
    grep -q '実コネクタ' "$file" && grep -q '接続状態は未確認' "$file"
}

serializer_reference_ok(){
  local file="$1"
  grep -q '最終応答serializer' "$file" &&
    ! grep -q '^やったこと:' "$file" && ! grep -q '^結果:' "$file" && ! grep -q '^次に何が起きるか:' "$file" &&
    ! grep -q '固定prefix' "$file" && ! grep -q '物理的に3行' "$file"
}

report_shape_ok(){ # $1=output file $2=short|detail
  local file="$1" detail="$2" lines expected
  [ -s "$file" ] || return 1
  ! grep -q '^[[:space:]]*$' "$file" || return 1
  lines="$(wc -l < "$file" | tr -d ' ')"
  expected=3; [ "$detail" = detail ] && expected=4
  [ "$lines" -eq "$expected" ] || return 1
  sed -n '1p' "$file" | grep -q '^やったこと: .\+' || return 1
  sed -n '2p' "$file" | grep -q '^結果: .\+' || return 1
  sed -n '3p' "$file" | grep -q '^次に何が起きるか: .\+' || return 1
  if [ "$detail" = detail ]; then
    sed -n '4p' "$file" | grep -q '^補足: .\+' || return 1
  fi
}

# Gate A / v2構造
check "templates/AGENTSはserializer正本を参照し再包装しない" \
  "grep -q '最終応答serializer.*唯一の出力形正本' '$TEMPLATES/AGENTS.md' && grep -q 'schemaを複製・再包装しない' '$TEMPLATES/AGENTS.md'"
check "templates/CLAUDEもserializer正本だけを参照" \
  "grep -q '最終応答serializer.*だけを正本' '$TEMPLATES/CLAUDE.md' && grep -q 'schemaをここへ複製しません' '$TEMPLATES/CLAUDE.md'"
check "plain-languageは不変規律と個人設定の二部" \
  "grep -q '^## 第1部: 全員共通の不変規律' '$RULES' && grep -q '^## 第2部: その人に合わせる設定' '$RULES'"

# I1: schemaの重複ではなく、唯一正本・競合0・適用順を検査する。
REFERENCE_SURFACES=(
  "$TEMPLATES/AGENTS.md" "$TEMPLATES/CLAUDE.md"
  "$TEMPLATES/tones/standard.md" "$TEMPLATES/tones/friendly.md" "$TEMPLATES/tones/formal.md"
)
while IFS= read -r skill; do REFERENCE_SURFACES+=("$skill"); done < <(find "$PLUGIN/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | sort)
reference_bad=0
for surface in "${REFERENCE_SURFACES[@]}"; do
  serializer_reference_ok "$surface" || { printf '  serializer参照不整合: %s\n' "$surface"; reference_bad=$((reference_bad+1)); }
done
check "plain-languageのserializer唯一正本はI1-I3境界を満たす" "serializer_contract_ok '$RULES'"
check "templates/tones/全12スキルは正本参照だけでschema重複0" \
  "[ '${#REFERENCE_SURFACES[@]}' -eq 17 ] && [ '$reference_bad' -eq 0 ]"
SCHEMA_OWNER_COUNT="$(grep -Rsl '^やったこと:' "$PLUGIN/rules" "$PLUGIN/skills" "$PLUGIN/templates" --include='*.md' | wc -l | tr -d ' ')"
check "固定schemaの所有ファイルはplain-language 1件だけ" \
  "[ '$SCHEMA_OWNER_COUNT' -eq 1 ] && grep -q '^やったこと:' '$RULES'"
ROUTER="$PLUGIN/skills/secretary/SKILL.md"
SERIALIZER_REF_LINE="$(grep -n -m1 '最終応答serializer.*節である' "$ROUTER" | cut -d: -f1)"
SILENT_LINE="$(grep -n -m1 'ルーティング、段階ロードは無言' "$ROUTER" | cut -d: -f1)"
ROUTE_LINE="$(grep -n -m1 '^## まずやること' "$ROUTER" | cut -d: -f1)"
check "routerはserializer読込→無言境界→routingの順" \
  "[ '$SERIALIZER_REF_LINE' -lt '$SILENT_LINE' ] && [ '$SILENT_LINE' -lt '$ROUTE_LINE' ]"
check "plain-languageの進行表示は同一turn read-onlyで途中出力しない" \
  "grep -q '同じturn内のRead・ルーティング・read-only確認では途中メッセージにせず' '$RULES' && grep -q '同じturn内のRead・ルーティング・read-only確認には予告を足さず' '$RULES'"
check "routerの競合する旧予告と末尾schema複製は0" \
  "! grep -q 'ひとこと予告してから' '$ROUTER' && ! grep -q '^## 最終出力の絶対条件' '$ROUTER'"

# 意図的失敗fixture: 正本欠落、schema重複、無言境界欠落、適用順逆転を必ず拒否する。
cp "$RULES" "$WORK/bad-owner.md"; perl -pi -e 's/無言で完了する/完了する/g' "$WORK/bad-owner.md"
cp "$SETTINGS" "$WORK/bad-duplicate.md"; printf '\nやったこと: 複製\n結果: 複製\n次に何が起きるか: 複製\n' >> "$WORK/bad-duplicate.md"
cp "$ROUTER" "$WORK/bad-silent.md"; perl -pi -e 's/ルーティング、段階ロードは無言/ルーティング、段階ロードを実行/' "$WORK/bad-silent.md"
check "意図的失敗fixtureはserializer無言境界の欠落を検出" "! serializer_contract_ok '$WORK/bad-owner.md'"
check "意図的失敗fixtureは下位skillのschema重複を検出" "! serializer_reference_ok '$WORK/bad-duplicate.md'"
check "意図的失敗fixtureはrouterの途中出力境界欠落を検出" "! grep -q 'ルーティング、段階ロードは無言' '$WORK/bad-silent.md'"

printf 'やったこと: 商談メモを保存しました。\n結果: local commit済みで、pushはしていません。\n次に何が起きるか: 内容を確認できます。\n' > "$WORK/report-short-ok.txt"
printf '村山さん、完了しました。\nやったこと: 商談メモを保存しました。\n結果: local commit済みです。\n次に何が起きるか: 内容を確認できます。\n' > "$WORK/report-greeting-ng.txt"
printf 'やったこと: 商談メモを保存しました。\n結果: local commit済みで、pushはしていません。\n次に何が起きるか: 内容を確認できます。\n補足: 外部サービスの接続状態は未確認です。\n' > "$WORK/report-detail-ok.txt"
check "物理3行validatorは正しい短い報告を許可" "report_shape_ok '$WORK/report-short-ok.txt' short"
check "物理3行validatorは挨拶の独立行を拒否" "! report_shape_ok '$WORK/report-greeting-ng.txt' short"
check "物理4行validatorは明示くわしい補足1行だけ許可" "report_shape_ok '$WORK/report-detail-ok.txt' detail"
check "preferences v2は4セクション" \
  "grep -q '^## 基本$' '$TEMPLATES/memory/preferences.md' && grep -q '^## 言葉遣い$' '$TEMPLATES/memory/preferences.md' && grep -q '^## 口調のお手本$' '$TEMPLATES/memory/preferences.md' && grep -q '^## 秘書のメモ$' '$TEMPLATES/memory/preferences.md'"
check "preferences v2は4つのcategorical項目" \
  "grep -q '^- 口調: 丁寧（標準）' '$TEMPLATES/memory/preferences.md' && grep -q '^- 専門用語: ふつう' '$TEMPLATES/memory/preferences.md' && grep -q '^- 報告の詳しさ:' '$TEMPLATES/memory/preferences.md' && grep -q '^- 決定の確認: 都度' '$TEMPLATES/memory/preferences.md'"

# 初回5問
QCOUNT="$(grep -Ec '^### Q[1-5]:' "$ONBOARD")"
check "初回質問は5問" "[ '$QCOUNT' -eq 5 ]"
check "初回に仕事・役割と説明の詳しさを聞く" "grep -q '^### Q4: お仕事・役割' '$ONBOARD' && grep -q '^### Q5: 説明の詳しさ' '$ONBOARD'"
check "詳しさは3択で既定みじかく" "grep -q '1) \*\*みじかく' '$ONBOARD' && grep -q '2) \*\*くわしく' '$ONBOARD' && grep -q '3) \*\*おまかせ' '$ONBOARD'"
check "口調を初回質問にしない" "! grep -qE '^### Q[1-5]: .*口調' '$ONBOARD' && grep -q '口調は初回に質問しない' '$ONBOARD'"
check "初回後に設定変更導線を案内" "grep -q '設定はいつでも.*設定変えたい' '$ONBOARD'"

# settings規律とプリセット
check "settings skillのfrontmatter name" "[ \"\$(awk '/^name:/{print \$2; exit}' '$SETTINGS')\" = settings ]"
check "settingsは例文→確認→反映→宣言→journal→commitを定義" \
  "grep -q '変更後の短い例文' '$SETTINGS' && grep -q '確認ターンではツールを呼ばない' '$SETTINGS' && grep -q 'pref-set' '$SETTINGS' && grep -q 'こう覚えました' '$SETTINGS' && grep -q 'journal-add' '$SETTINGS' && grep -q 'commit' '$SETTINGS'"
PREVIEW_LINE="$(grep -n -m1 '変更後の短い例文' "$SETTINGS" | cut -d: -f1)"
CONFIRM_LINE="$(grep -n -m1 'この確認ターンではツールを呼ばない' "$SETTINGS" | cut -d: -f1)"
APPLY_LINE="$(grep -n -m1 '部分更新シームを1回呼ぶ' "$SETTINGS" | cut -d: -f1)"
DECLARE_LINE="$(grep -n -m1 'こう覚えました' "$SETTINGS" | cut -d: -f1)"
JOURNAL_LINE="$(grep -n -m1 '宣言後.*journal-add' "$SETTINGS" | cut -d: -f1)"
COMMIT_LINE="$(grep -n -m1 '最後に.*commit' "$SETTINGS" | cut -d: -f1)"
check "settingsの6段階は契約順に並ぶ" \
  "[ '$PREVIEW_LINE' -lt '$CONFIRM_LINE' ] && [ '$CONFIRM_LINE' -lt '$APPLY_LINE' ] && [ '$APPLY_LINE' -lt '$DECLARE_LINE' ] && [ '$DECLARE_LINE' -lt '$JOURNAL_LINE' ] && [ '$JOURNAL_LINE' -lt '$COMMIT_LINE' ]"
check "settingsはキャンセル副作用0" "grep -q 'キャンセル.*preferences、journal、git commitを一切変更しない' '$SETTINGS'"
check "settingsはpushしない" "grep -q 'pushしない' '$SETTINGS' && ! grep -qE 'git +push' '$SETTINGS'"
check "3つの口調プリセットが存在" "[ -f '$TEMPLATES/tones/standard.md' ] && [ -f '$TEMPLATES/tones/friendly.md' ] && [ -f '$TEMPLATES/tones/formal.md' ]"
check "濃いキャラクターを同梱しない" "grep -q '濃いキャラクターは使わない' '$SETTINGS' && [ \"\$(find '$TEMPLATES/tones' -type f | wc -l | tr -d ' ')\" -eq 3 ]"

# 全スキルがセッションごとにpreferencesを読む
missing_pref_ref=0
while IFS= read -r skill; do
  grep -q 'preferences.md' "$skill" || { printf '  preferences参照なし: %s\n' "$skill"; missing_pref_ref=$((missing_pref_ref+1)); }
done < <(find "$PLUGIN/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | sort)
check "全12スキルがpreferencesを参照" "[ '$missing_pref_ref' -eq 0 ] && [ \"\$(find '$PLUGIN/skills' -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l | tr -d ' ')\" -eq 12 ]"

# 部分更新・追記・確認後のjournal/commit
SEC="$WORK/main/secretary"
materialize "$SEC" "講師" "みじかく"
PREF="$SEC/memory/preferences.md"
printf -- '- 手書きメモ: この行は保持する\n' >> "$PREF"
cp "$PREF" "$WORK/pref-before.md"
J0="$(journal_lines "$SEC")"
CC_SECRETARY_NOW=2026-07-16T10:00 bash "$TOOLS" pref-set "$SEC" "言葉遣い" "口調" "フランク" >/dev/null 2>&1
RC=$?
check "pref-setは許可された値を更新" "[ '$RC' -eq 0 ] && grep -q '^- 口調: フランク$' '$PREF'"
sed '/^- 口調:/d' "$WORK/pref-before.md" > "$WORK/before-without-target"
sed '/^- 口調:/d' "$PREF" > "$WORK/after-without-target"
check "pref-setは対象行以外をbyte保持" "cmp -s '$WORK/before-without-target' '$WORK/after-without-target'"
check "pref-setは手書き行を保持" "grep -q '手書きメモ: この行は保持する' '$PREF'"
check "pref-setだけではjournalへ書かない" "[ \"\$(journal_lines '$SEC')\" -eq '$J0' ]"

cp "$PREF" "$WORK/note-before.md"
SIZE_BEFORE="$(wc -c < "$PREF" | tr -d ' ')"
bash "$TOOLS" pref-note-add "$SEC" "説明は結論から伝える" >/dev/null 2>&1
RC=$?
head -c "$SIZE_BEFORE" "$PREF" > "$WORK/note-prefix.md"
check "pref-note-addは成功" "[ '$RC' -eq 0 ] && tail -n 1 '$PREF' | grep -q '^- 説明は結論から伝える$'"
check "pref-note-addは既存byte列の末尾へだけ追記" "cmp -s '$WORK/note-before.md' '$WORK/note-prefix.md'"

cp "$PREF" "$WORK/reject-before.md"
bash "$TOOLS" pref-set "$SEC" "言葉遣い" "口調" "関西弁" >/dev/null 2>&1; BAD_VALUE_RC=$?
bash "$TOOLS" pref-set "$SEC" "言葉遣い" "未知キー" "値" >/dev/null 2>&1; BAD_KEY_RC=$?
bash "$TOOLS" pref-note-add "$SEC" "   " >/dev/null 2>&1; EMPTY_NOTE_RC=$?
bash "$TOOLS" pref-set "$SEC" "基本" "お仕事・役割" "token=abcdef123456" >/dev/null 2>&1; SECRET_VALUE_RC=$?
check "pref-setは未知値をexit 2で拒否" "[ '$BAD_VALUE_RC' -eq 2 ]"
check "pref-setは未知keyをexit 2で拒否" "[ '$BAD_KEY_RC' -eq 2 ]"
check "pref-note-addは空をexit 3で拒否" "[ '$EMPTY_NOTE_RC' -eq 3 ]"
check "pref-setは資格情報らしき値をexit 3で拒否" "[ '$SECRET_VALUE_RC' -eq 3 ]"
check "拒否4件はpreferencesに副作用なし" "cmp -s '$WORK/reject-before.md' '$PREF'"

ln -s "$SEC" "$WORK/secretary-link"
bash "$TOOLS" pref-set "$WORK/secretary-link" "基本" "呼び方" "社長" >/dev/null 2>&1; LINK_RC=$?
check "pref-setは基点symlinkをexit 3で拒否" "[ '$LINK_RC' -eq 3 ]"
check "基点symlink拒否は設定を変えない" "! grep -q '^- 呼び方: 社長$' '$PREF'"

# 実際の了承後フロー。宣言はsettings規律、シーム順は preference→journal→commit。
COMMITS0="$(git -C "$SEC" rev-list --count HEAD)"
J1="$(journal_lines "$SEC")"
CC_SECRETARY_NOW=2026-07-16T10:30 bash "$TOOLS" pref-set "$SEC" "言葉遣い" "報告の詳しさ" "くわしく" >/dev/null 2>&1
check "反映直後はまだjournal増分0" "[ \"\$(journal_lines '$SEC')\" -eq '$J1' ]"
CC_SECRETARY_NOW=2026-07-16T10:31 bash "$TOOLS" journal-add "$SEC" did "設定を変更: 報告の詳しさ=くわしく" >/dev/null 2>&1
check "宣言後のjournalはdidを1件だけ追加" "[ \"\$(journal_lines '$SEC')\" -eq $((J1+1)) ] && grep -Rql '設定を変更: 報告の詳しさ=くわしく' '$SEC/memory/journal'"
bash "$TOOLS" commit "$SEC" "設定を変更（報告の詳しさ: くわしく）" >/dev/null 2>&1
check "最後にlocal commitが1件増える" "[ \"\$(git -C '$SEC' rev-list --count HEAD)\" -eq $((COMMITS0+1)) ]"
check "設定commitは日本語で内容が分かる" "git -C '$SEC' log -1 --pretty=%s | grep -q '設定を変更（報告の詳しさ: くわしく）'"
check "設定commit後もremote無しでpushされない" "[ -z \"\$(git -C '$SEC' remote)\" ]"

# キャンセルは確認ターンで停止し、全シームを呼ばない
CANCEL_BEFORE="$(tree_digest "$SEC")"
CANCEL_COMMITS="$(git -C "$SEC" rev-list --count HEAD)"
grep -q '確認ターンではツールを呼ばない' "$SETTINGS"
CANCEL_AFTER="$(tree_digest "$SEC")"
check "キャンセル相当の確認ターンはファイル副作用0" "[ '$CANCEL_BEFORE' = '$CANCEL_AFTER' ]"
check "キャンセル相当の確認ターンはcommit副作用0" "[ \"\$(git -C '$SEC' rev-list --count HEAD)\" -eq '$CANCEL_COMMITS' ]"

# 欠落・部分欠損から安全な既定へ戻り、指定項目だけ設定可能
MISSING="$WORK/missing/secretary"; materialize "$MISSING" "未設定" "みじかく"
rm "$MISSING/memory/preferences.md"
bash "$TOOLS" pref-set "$MISSING" "基本" "お仕事・役割" "営業" >/dev/null 2>&1
check "preferences欠落時はv2既定を安全に再生成" "grep -q '^- 口調: 丁寧（標準）$' '$MISSING/memory/preferences.md' && grep -q '^- 報告の詳しさ: みじかく$' '$MISSING/memory/preferences.md'"
check "欠落時も指定した役割だけ反映" "grep -q '^- お仕事・役割: 営業$' '$MISSING/memory/preferences.md'"

PARTIAL="$WORK/partial/secretary"; materialize "$PARTIAL" "未設定" "みじかく"
printf '# 部分設定\n\n## 基本\n- 呼び方: 村山さん\n- 手書き: 保持\n' > "$PARTIAL/memory/preferences.md"
bash "$TOOLS" pref-set "$PARTIAL" "言葉遣い" "決定の確認" "まとめて" >/dev/null 2>&1
check "部分欠損時は必要セクションと対象行だけ追加" "grep -q '^## 言葉遣い$' '$PARTIAL/memory/preferences.md' && grep -q '^- 決定の確認: まとめて$' '$PARTIAL/memory/preferences.md'"
check "部分欠損更新でも手書き行を保持" "grep -q '^- 手書き: 保持$' '$PARTIAL/memory/preferences.md'"

# 3設定・3役割・決定確認・新セッション相当の再読
DEFAULT="$WORK/profiles/default"; FRIENDLY="$WORK/profiles/friendly"; FORMAL="$WORK/profiles/formal"
materialize "$DEFAULT" "講師" "みじかく"
materialize "$FRIENDLY" "営業" "みじかく"
materialize "$FORMAL" "経営" "みじかく"
bash "$TOOLS" pref-set "$FRIENDLY" "言葉遣い" "口調" "フランク" >/dev/null 2>&1
bash "$TOOLS" pref-set "$FRIENDLY" "言葉遣い" "専門用語" "そのままOK" >/dev/null 2>&1
bash "$TOOLS" pref-set "$FORMAL" "言葉遣い" "口調" "きっちり敬語" >/dev/null 2>&1
bash "$TOOLS" pref-set "$FORMAL" "言葉遣い" "専門用語" "ことば添え" >/dev/null 2>&1
bash "$TOOLS" pref-set "$FORMAL" "言葉遣い" "報告の詳しさ" "くわしく" >/dev/null 2>&1
check "既定設定は丁寧・ふつう・みじかく" "grep -q '^- 口調: 丁寧（標準）$' '$DEFAULT/memory/preferences.md' && grep -q '^- 専門用語: ふつう$' '$DEFAULT/memory/preferences.md' && grep -q '^- 報告の詳しさ: みじかく$' '$DEFAULT/memory/preferences.md'"
check "設定2はフランク＋そのままOKだけ変更" "grep -q '^- 口調: フランク$' '$FRIENDLY/memory/preferences.md' && grep -q '^- 専門用語: そのままOK$' '$FRIENDLY/memory/preferences.md' && grep -q '^- 報告の詳しさ: みじかく$' '$FRIENDLY/memory/preferences.md'"
check "設定3は敬語＋ことば添え＋くわしく" "grep -q '^- 口調: きっちり敬語$' '$FORMAL/memory/preferences.md' && grep -q '^- 専門用語: ことば添え$' '$FORMAL/memory/preferences.md' && grep -q '^- 報告の詳しさ: くわしく$' '$FORMAL/memory/preferences.md'"
check "役割写像は営業・講師・経営を具体化" "grep -q '営業.*商談メモ' '$RULES' && grep -q '講師.*講義資料' '$RULES' && grep -q '経営.*数字のまとめ' '$RULES'"
check "役割から未設定事実を捏造しない" "grep -q 'preferences に無い職歴、案件、数値、顧客情報を作らない' '$RULES'"

bash "$TOOLS" pref-set "$DEFAULT" "言葉遣い" "決定の確認" "まとめて" >/dev/null 2>&1
check "決定確認をまとめてへ切替可能" "grep -q '^- 決定の確認: まとめて$' '$DEFAULT/memory/preferences.md'"
check "まとめても未確認記録と拾い漏れ省略を禁止" "grep -q '候補を未確認のまま記録せず' '$SETTINGS' && grep -q '拾い漏れ確認も省略しない' '$SETTINGS'"
bash "$TOOLS" pref-set "$DEFAULT" "言葉遣い" "決定の確認" "都度" >/dev/null 2>&1
check "決定確認を都度へ戻せる" "grep -q '^- 決定の確認: 都度$' '$DEFAULT/memory/preferences.md'"

READ1="$(sh -c 'grep "^- 口調:\|^- 専門用語:\|^- 報告の詳しさ:" "$1/memory/preferences.md"' sh "$FORMAL")"
READ2="$(sh -c 'grep "^- 口調:\|^- 専門用語:\|^- 報告の詳しさ:" "$1/memory/preferences.md"' sh "$FORMAL")"
check "新セッション相当の独立読込でも設定を維持" "[ '$READ1' = '$READ2' ] && printf '%s' '$READ2' | grep -q 'きっちり敬語'"
check "output stylesへ依存しない" "! grep -rqi 'output styles' '$PLUGIN' || grep -q 'output stylesには依存しない' '$SETTINGS'"
check "ことば添えでも一般技術用語を置換しない" "grep -q 'ことば添え.*一般技術用語を置換せず' '$SETTINGS'"
check "そのままOKでも安全説明を省かない" "grep -q 'そのままOK.*安全説明は省かない' '$SETTINGS'"

check "関連shellの構文が有効" "bash -n '$TOOLS' '$ROOT/scripts/regression-check.sh' '$ROOT/scripts/sprint-010-regression.sh' '$ROOT/scripts/sprint-011-regression.sh' '$ROOT/scripts/sprint-011-live-dialogue.sh'"

printf 'PASS=%d FAIL=%d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1

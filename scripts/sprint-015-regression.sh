#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$ROOT/plugins/secretary"
PROJECTS="$PLUGIN/skills/projects/SKILL.md"
ROUTER="$PLUGIN/skills/secretary/SKILL.md"
DAILY="$PLUGIN/skills/daily/SKILL.md"
BUILD="$PLUGIN/skills/build/SKILL.md"
TEMPLATE="$PLUGIN/templates/AGENTS.md"
TOOL="$PLUGIN/scripts/project-tools.mjs"
MEMORY="$PLUGIN/skills/memory-care/scripts/memory-tools.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/yasashii-s015-regression.XXXXXX")"
PASS=0; FAIL=0
trap 'rm -rf "$WORK"' EXIT

ok(){ PASS=$((PASS+1)); printf 'PASS %s\n' "$1"; }
ng(){ FAIL=$((FAIL+1)); printf 'FAIL %s\n' "$1"; }
check(){ local label="$1"; shift; if "$@"; then ok "$label"; else ng "$label"; fi; }
check_eval(){ local label="$1" expression="$2"; if eval "$expression"; then ok "$label"; else ng "$label"; fi; }
new_sec(){
  local name="$1" sec="$WORK/$1/secretary"
  mkdir -p "$sec/memory/decisions" "$sec/memory/journal" "$sec/memory/topics" "$sec/projects" "$sec/inbox" "$sec/docs"
  printf '# Memory\n\n' > "$sec/memory/MEMORY.md"
  printf '# TODO（クイックキャプチャ）\n\n' > "$sec/inbox/todo.md"
  printf '%s' "$sec"
}
p(){ CC_SECRETARY_NOW=2026-07-17T10:30 node "$TOOL" "$@"; }
create(){
  local sec="$1" name="$2"
  p create-light "$sec" "$name" --overview "${name}の概要" --goal "${name}を完了する" --success "完了条件を満たす" --current "関係者と準備中" --next "次の打合せを行う" --questions "予算を確認" --confirm >/dev/null
}
count_journal(){ grep -Rhc '^-' "$1/memory/journal" 2>/dev/null | awk '{s+=$1} END{print s+0}'; }

# 構造・配布導線
check "project-tools Node構文" node --check "$TOOL"
check "projects skillが存在" test -f "$PROJECTS"
check_eval "projects frontmatterはname・descriptionのみ" "awk '/^---$/{n++;next} n==1&&/^[A-Za-z_-]+:/{print \$1}' '$PROJECTS' | tr -d ':' | paste -sd, - | grep -qx 'name,description'"
check_eval "配布skillは開発docs・絶対path非依存" "! grep -RqiE 'docs/(spec|sprints|progress|feedback)|/Users/' '$PROJECTS'"
check_eval "projects skillはGoogle Chat・OAuthを追加しない" "! grep -qiE 'Google Chat|OAuth' '$PROJECTS' '$TOOL'"
check_eval "routerはprojectsを段階ロード" "grep -q 'skills/projects/SKILL.md' '$ROUTER' && grep -q 'プロジェクトとしてまとめますか' '$ROUTER'"
check_eval "routerは開発依頼をbuildに維持" "grep -q 'アプリ／ツールにして.*skills/build/SKILL.md' '$ROUTER'"
check_eval "dailyはPJ状態とTODO正本を分離" "grep -q 'project-tools.mjs list' '$DAILY' && grep -q 'PROJECT.md.*状態.*inbox/todo.md.*実行項目' '$DAILY'"
check_eval "buildは別repoポインタだけを案内" "grep -q 'create-dev-pointer' '$BUILD' && grep -q '実装仕様、判断ログ' '$BUILD'"
check_eval "配布AGENTSはライト→フルとTODO境界を説明" "grep -q 'PROJECT.md.*1枚' '$TEMPLATE' && grep -q 'PJ内に生きた.*TODO.md.*作らない' '$TEMPLATE' && grep -q 'INDEX.md.*作らない' '$TEMPLATE'"
check_eval "project toolはcommit・push・remote操作を持たない" "! grep -qE 'git (commit|push|remote)|spawnSync\\([^,]+, *\\[[^]]*(commit|push|remote)' '$TOOL'"

# 候補判定は読み取りだけ
CAND="$WORK/candidate.json"
p candidate-check --multiple-actions --multiple-sessions > "$CAND"
check_eval "複数行動＋複数セッションは候補" "node -e \"const x=require(process.argv[1]);if(!x.eligible||!x.question)process.exit(1)\" '$CAND'"
p candidate-check --multiple-actions --stakeholders > "$CAND"
check_eval "複数行動＋関係者は候補" "node -e \"const x=require(process.argv[1]);if(!x.eligible||x.signals.length!==2)process.exit(1)\" '$CAND'"
p candidate-check --deadline --stakeholders > "$CAND"
check_eval "primary signalなしはeligible falseを明示" "node -e \"const x=require(process.argv[1]);if(!Object.hasOwn(x,'eligible')||typeof x.eligible!=='boolean'||x.eligible!==false||x.question!==null)process.exit(1)\" '$CAND'"
p candidate-check --multiple-actions > "$CAND"
check_eval "単一TODO相当もeligible falseを明示" "node -e \"const x=require(process.argv[1]);if(!Object.hasOwn(x,'eligible')||typeof x.eligible!=='boolean'||x.eligible!==false)process.exit(1)\" '$CAND'"

# 確認前・拒否・安全境界
SEC="$(new_sec main)"
BEFORE="$(find "$SEC" -type f -exec shasum {} + | sort | shasum | awk '{print $1}')"
p create-light "$SEC" 営業改善 --overview 概要 --goal ゴール --success 成功 --current 現在 --next 次 >/dev/null 2>&1
RC=$?
AFTER="$(find "$SEC" -type f -exec shasum {} + | sort | shasum | awk '{print $1}')"
check_eval "作成確認前はexit 3・副作用0件" "[ '$RC' -eq 3 ] && [ '$BEFORE' = '$AFTER' ] && [ ! -e '$SEC/projects/営業改善' ]"
check_eval "候補拒否は実行コマンド不要で副作用0件" "[ '$(count_journal "$SEC")' -eq 0 ] && [ -z \"\$(find '$SEC/projects' -mindepth 1 -print -quit)\" ]"
p create-light "$SEC" ../escape --overview 概要 --goal ゴール --success 成功 --current 現在 --next 次 --confirm >/dev/null 2>&1
check "..を含む名前を拒否" test $? -eq 3
p create-light "$SEC" 空入力 --overview '' --goal ゴール --success 成功 --current 現在 --next 次 --confirm >/dev/null 2>&1
check "空の概要を拒否" test $? -eq 3
OUTSIDE="$WORK/outside"; mkdir -p "$OUTSIDE"; ln -s "$OUTSIDE" "$SEC/projects/外向き"
p create-light "$SEC" 外向き --overview 概要 --goal ゴール --success 成功 --current 現在 --next 次 --confirm >/dev/null 2>&1
check_eval "境界外symlinkを拒否" "[ $? -eq 3 ] && [ -z \"\$(find '$OUTSIDE' -mindepth 1 -print -quit)\" ]"
rm -f "$SEC/projects/外向き"

# ライト作成3業務・同名保護・journal
create "$SEC" 営業改善
create "$SEC" Instagramマーケティング
create "$SEC" 新規事業
check_eval "営業ライトPJは実内容とstatus active" "grep -q '^status: active$' '$SEC/projects/営業改善/PROJECT.md' && grep -q '営業改善の概要' '$SEC/projects/営業改善/PROJECT.md' && grep -q '次の入口' '$SEC/projects/営業改善/PROJECT.md'"
check_eval "マーケティング・新規事業fixtureを作成" "[ -f '$SEC/projects/Instagramマーケティング/PROJECT.md' ] && [ -f '$SEC/projects/新規事業/PROJECT.md' ]"
ORIGINAL="$(shasum "$SEC/projects/営業改善/PROJECT.md" | awk '{print $1}')"
p create-light "$SEC" 営業改善 --overview 上書き --goal ゴール --success 成功 --current 現在 --next 次 --confirm >/dev/null 2>&1
check_eval "同名PJは拒否し既存内容を保護" "[ $? -eq 3 ] && [ '$ORIGINAL' = \"\$(shasum '$SEC/projects/営業改善/PROJECT.md' | awk '{print \$1}')\" ]"
check_eval "ライト作成成功だけjournalへ各1件" "[ \"\$(grep -Rh 'ライト運用で作成' '$SEC/memory/journal' | wc -l | tr -d ' ')\" -eq 3 ]"
ln -s "$OUTSIDE" "$SEC/projects/営業改善/危険な参照"
PJ_BEFORE="$(shasum "$SEC/projects/営業改善/PROJECT.md" | awk '{print $1}')"
p add-note "$SEC" 営業改善 --note '保存してはいけない' --confirm >/dev/null 2>&1
check_eval "既存PJ内symlinkがあれば更新を拒否" "[ $? -eq 3 ] && [ '$PJ_BEFORE' = \"\$(shasum '$SEC/projects/営業改善/PROJECT.md' | awk '{print \$1}')\" ] && [ -z \"\$(find '$OUTSIDE' -mindepth 1 -print -quit)\" ]"
rm -f "$SEC/projects/営業改善/危険な参照"

# 決定・状態・TODO・memory重複境界
p add-decision "$SEC" 営業改善 --decision '対象業種は製造業にする' --current '製造業の候補を抽出中' --next '候補10社を選ぶ' >/dev/null 2>&1
check_eval "決定確認前はPROJECT不変" "[ '$ORIGINAL' = \"\$(shasum '$SEC/projects/営業改善/PROJECT.md' | awk '{print \$1}')\" ]"
p add-decision "$SEC" 営業改善 --decision '対象業種は製造業にする' --current '製造業の候補を抽出中' --next '候補10社を選ぶ' --confirm >/dev/null
check_eval "確認済み決定と状態を同時更新" "grep -q 'D-001 (2026-07-17): 対象業種は製造業にする' '$SEC/projects/営業改善/PROJECT.md' && grep -q '製造業の候補を抽出中' '$SEC/projects/営業改善/PROJECT.md' && grep -q '候補10社を選ぶ' '$SEC/projects/営業改善/PROJECT.md'"
check_eval "決定本文を一般memoryへ重複しない" "! grep -Rql '対象業種は製造業にする' '$SEC/memory'"
p add-todo "$SEC" 営業改善 --todo '候補10社を選ぶ' --source '会話 / user-1 / 2026-07-17' --due 2026-07-20 >/dev/null
check_eval "PJ参照つきTODOは既存正本へ入る" "grep -q '候補10社を選ぶ.*PJ: 営業改善 / projects/営業改善/PROJECT.md' '$SEC/inbox/todo.md'"
check_eval "PJ内に生きたTODO.mdを作らない" "[ ! -e '$SEC/projects/営業改善/TODO.md' ]"

# 成果物境界とフル索引
printf '候補企業の作業中一覧\n' | p save-work "$SEC" 営業改善 --title 候補企業一覧 --tags 営業 >/dev/null
printf '商談方針の確定版\n' | p save-output "$SEC" 営業改善 --title 商談方針 --tags 営業,確定 >/dev/null
check_eval "PJ作業文書は直下・確定版はoutputs" "[ -f '$SEC/projects/営業改善/2026-07-17_候補企業一覧.md' ] && [ -f '$SEC/projects/営業改善/outputs/2026-07-17_商談方針.md' ]"
p archive-file "$SEC" 営業改善 2026-07-17_候補企業一覧.md >/dev/null 2>&1
check "archive確認前は元ファイルを保持" test -f "$SEC/projects/営業改善/2026-07-17_候補企業一覧.md"
p archive-file "$SEC" 営業改善 2026-07-17_候補企業一覧.md --confirm >/dev/null
check_eval "確認後だけ旧版をarchive" "[ ! -e '$SEC/projects/営業改善/2026-07-17_候補企業一覧.md' ] && [ -f '$SEC/projects/営業改善/archive/2026-07-17_候補企業一覧.md' ]"

# 4種類の昇格トリガーと拒否0変更
DEC="$(new_sec decisions)"; create "$DEC" 判断多数
for i in $(seq 1 11); do p add-decision "$DEC" 判断多数 --decision "判断$i" --current "状態$i" --next "次$i" --confirm >/dev/null; done
p promotion-status "$DEC" 判断多数 > "$WORK/dec-status.json"
check_eval "Decisions 10件超を検出" "node -e \"const x=require(process.argv[1]);if(!x.eligible||x.decisionCount!==11)process.exit(1)\" '$WORK/dec-status.json'"
NOTE="$(new_sec notes)"; create "$NOTE" メモ多数
for i in $(seq 1 11); do p add-note "$NOTE" メモ多数 --note "事実$i" --confirm >/dev/null; done
p promotion-status "$NOTE" メモ多数 > "$WORK/note-status.json"
check_eval "メモ10件超を検出" "node -e \"const x=require(process.argv[1]);if(!x.eligible||x.noteCount!==11)process.exit(1)\" '$WORK/note-status.json'"
FILES="$(new_sec files)"; create "$FILES" 文書多数
for i in $(seq -w 1 11); do printf '# 文書%s\n' "$i" > "$FILES/projects/文書多数/2026-07-17_文書${i}.md"; done
p promotion-status "$FILES" 文書多数 > "$WORK/file-status.json"
check_eval "PJ直下10ファイル超を検出" "node -e \"const x=require(process.argv[1]);if(!x.eligible||x.fileCount!==11)process.exit(1)\" '$WORK/file-status.json'"
GUARD="$(new_sec guard)"; create "$GUARD" 固有規則
p promotion-status "$GUARD" 固有規則 --guardrail-needed > "$WORK/guard-status.json"
check_eval "PJ固有ガードレール必要を検出" "node -e \"const x=require(process.argv[1]);if(!x.eligible)process.exit(1)\" '$WORK/guard-status.json'"
HASH="$(find "$DEC/projects/判断多数" -type f -exec shasum {} + | sort | shasum | awk '{print $1}')"
p promote-full "$DEC" 判断多数 >/dev/null 2>&1
check_eval "昇格確認前は構成不変" "[ $? -eq 3 ] && [ '$HASH' = \"\$(find '$DEC/projects/判断多数' -type f -exec shasum {} + | sort | shasum | awk '{print \$1}')\" ]"
p promote-full "$DEC" 判断多数 --confirm >/dev/null
check_eval "了承後だけ5ファイル構成" "for f in AGENTS.md PROJECT.md DECISIONS.md MEMORY.md CLAUDE.md; do [ -f '$DEC/projects/判断多数/'\"\$f\" ] || exit 1; done"
check_eval "フルPJはINDEX/TODOなし・CLAUDEポインタ" "[ ! -e '$DEC/projects/判断多数/INDEX.md' ] && [ ! -e '$DEC/projects/判断多数/TODO.md' ] && grep -q 'AGENTS.md' '$DEC/projects/判断多数/CLAUDE.md'"
check_eval "Decisions移行は欠落なし・PROJECTにサマリー保持" "[ \"\$(grep -c '^## D-' '$DEC/projects/判断多数/DECISIONS.md')\" -eq 11 ] && [ \"\$(grep -c '^- D-' '$DEC/projects/判断多数/PROJECT.md')\" -eq 11 ]"
check_eval "AGENTS Start hereと索引が実pathに一致" "grep -q '^## Start here' '$DEC/projects/判断多数/AGENTS.md' && for f in PROJECT.md DECISIONS.md MEMORY.md CLAUDE.md AGENTS.md; do grep -Fq \"\$f\" '$DEC/projects/判断多数/AGENTS.md' || exit 1; done"

# 別repo開発PJは確認後に参照2ファイルだけ
DEV="$(new_sec dev)"
DEV_BEFORE="$(find "$DEV" -type f -exec shasum {} + | sort | shasum | awk '{print $1}')"
p create-dev-pointer "$DEV" 顧客アプリ --repo github.com/example/customer-app --entry docs/spec.md --overview '顧客向け予約アプリ' --current 'Plannerで要件確認中' --visibility private >/dev/null 2>&1
check_eval "別repo確認前はpointer・remote変更0件" "[ $? -eq 3 ] && [ '$DEV_BEFORE' = \"\$(find '$DEV' -type f -exec shasum {} + | sort | shasum | awk '{print \$1}')\" ] && [ ! -e '$DEV/projects/顧客アプリ' ]"
p create-dev-pointer "$DEV" 顧客アプリ --repo github.com/example/customer-app --entry docs/spec.md --overview '顧客向け予約アプリ' --current 'Plannerで要件確認中' --visibility private --confirm >/dev/null
check_eval "別repo workspace側はAGENTSとPROJECTだけ" "[ \"\$(find '$DEV/projects/顧客アプリ' -type f | wc -l | tr -d ' ')\" -eq 2 ] && [ -f '$DEV/projects/顧客アプリ/AGENTS.md' ] && [ -f '$DEV/projects/顧客アプリ/PROJECT.md' ]"
check_eval "別repo pointerに正本・公開範囲・最初に読むfile" "grep -q 'github.com/example/customer-app' '$DEV/projects/顧客アプリ/PROJECT.md' && grep -q '公開範囲: private' '$DEV/projects/顧客アプリ/PROJECT.md' && grep -q 'docs/spec.md' '$DEV/projects/顧客アプリ/AGENTS.md'"
check_eval "別repo pointerに仕様・判断・Sprint・成果物の複製なし" "[ ! -e '$DEV/projects/顧客アプリ/DECISIONS.md' ] && [ ! -e '$DEV/projects/顧客アプリ/MEMORY.md' ] && [ ! -e '$DEV/projects/顧客アプリ/docs' ] && [ ! -e '$DEV/projects/顧客アプリ/outputs' ]"

# 完了・再開・status欠落
COMP="$(new_sec complete)"; create "$COMP" 研修準備
H0="$(shasum "$COMP/projects/研修準備/PROJECT.md" | awk '{print $1}')"
p complete "$COMP" 研修準備 --result '研修を9回実施' --remaining 'アンケート集計' >/dev/null 2>&1
check_eval "完了確認前はstatus不変" "[ $? -eq 3 ] && [ '$H0' = \"\$(shasum '$COMP/projects/研修準備/PROJECT.md' | awk '{print \$1}')\" ]"
p complete "$COMP" 研修準備 --result '研修を9回実施' --remaining 'アンケート集計' --confirm >/dev/null
check_eval "完了後はcompleted・日付・結果・残件を保持" "grep -q '^status: completed$' '$COMP/projects/研修準備/PROJECT.md' && grep -q '2026-07-17: 結果=研修を9回実施 / 残件=アンケート集計' '$COMP/projects/研修準備/PROJECT.md'"
CANDIDATE_BEFORE="$(find "$COMP" -type f -exec shasum {} + | sort | shasum | awk '{print $1}')"
p candidate-check "$COMP" 研修準備 --multiple-actions --repeated-topic > "$WORK/completed-candidate.json"
CANDIDATE_AFTER="$(find "$COMP" -type f -exec shasum {} + | sort | shasum | awk '{print $1}')"
check_eval "完了済み同一PJは新規候補でなく再開確認へ送る" "node -e \"const x=require(process.argv[1]);if(x.eligible!==false||x.route!=='reopen'||x.question!=='このプロジェクトを再開しますか？'||x.existingProject?.status!=='completed')process.exit(1)\" '$WORK/completed-candidate.json'"
check_eval "完了済みPJの候補照合は副作用0件" "[ '$CANDIDATE_BEFORE' = '$CANDIDATE_AFTER' ]"
p list "$COMP" > "$WORK/active.txt"; p list "$COMP" --all > "$WORK/all.txt"
check_eval "completedは進行中一覧から外れ全一覧で見つかる" "! grep -q '研修準備' '$WORK/active.txt' && grep -q '研修準備 \[completed\]' '$WORK/all.txt'"
p show "$COMP" 研修準備 > "$WORK/show.txt"
check "completedは明示参照で見つかる" grep -q '研修を9回実施' "$WORK/show.txt"
HC="$(shasum "$COMP/projects/研修準備/PROJECT.md" | awk '{print $1}')"
p reopen "$COMP" 研修準備 --reason '追加研修の依頼' --next '日程候補を出す' >/dev/null 2>&1
check_eval "再開確認前はcompletedのまま" "[ $? -eq 3 ] && [ '$HC' = \"\$(shasum '$COMP/projects/研修準備/PROJECT.md' | awk '{print \$1}')\" ]"
p reopen "$COMP" 研修準備 --reason '追加研修の依頼' --next '日程候補を出す' --confirm >/dev/null
check_eval "確認後だけactiveへ戻り完了記録を保持" "grep -q '^status: active$' '$COMP/projects/研修準備/PROJECT.md' && grep -q '追加研修の依頼' '$COMP/projects/研修準備/PROJECT.md' && grep -q '研修を9回実施' '$COMP/projects/研修準備/PROJECT.md'"
p candidate-check "$COMP" 研修準備 --multiple-actions --repeated-topic > "$WORK/active-candidate.json"
check_eval "進行中同一PJは新規作成せず既存PJへ続ける" "node -e \"const x=require(process.argv[1]);if(x.eligible!==false||x.route!=='existing-project'||x.question!==null||x.existingProject?.status!=='active')process.exit(1)\" '$WORK/active-candidate.json'"
p candidate-check "$COMP" 未登録案件 --multiple-actions --repeated-topic > "$WORK/new-candidate.json"
check_eval "該当PJなしなら通常の新規候補へ進む" "node -e \"const x=require(process.argv[1]);if(x.eligible!==true||x.route!=='create-project'||!x.question)process.exit(1)\" '$WORK/new-candidate.json'"
sed -i.bak '/^status: active$/d' "$COMP/projects/研修準備/PROJECT.md"; rm -f "$COMP/projects/研修準備/PROJECT.md.bak"
p list "$COMP" > "$WORK/missing-status.txt"
check "status欠落はactiveとして一覧に出る" grep -q '研修準備 \[active\]' "$WORK/missing-status.txt"
check_eval "完了・再開でディレクトリ移動・削除なし" "[ -d '$COMP/projects/研修準備' ] && [ ! -e '$COMP/archive' ]"

# rollback・timeline・資格情報
ROLL="$(new_sec rollback)"; rm -f "$ROLL/memory/MEMORY.md"
p create-light "$ROLL" 失敗PJ --overview 概要 --goal ゴール --success 成功 --current 現在 --next 次 --confirm >/dev/null 2>&1
check_eval "journal失敗時はproject部分生成をrollback" "[ $? -eq 3 ] && [ ! -e '$ROLL/projects/失敗PJ' ]"
CC_SECRETARY_NOW=2026-07-17T10:30 bash "$MEMORY" timeline "$SEC" --type journal --grep 営業改善 > "$WORK/timeline.txt"
check_eval "project名・要約・参照先からtimelineで再発見" "grep -q '営業改善' '$WORK/timeline.txt' && grep -q 'projects/営業改善/PROJECT.md' '$WORK/timeline.txt'"
p create-light "$SEC" 機密PJ --overview 'token=synthetic-secret-value' --goal ゴール --success 成功 --current 現在 --next 次 --confirm >/dev/null 2>&1
check_eval "資格情報らしき値を保存せず拒否" "[ $? -eq 3 ] && [ ! -e '$SEC/projects/機密PJ' ] && ! grep -Rql 'synthetic-secret-value' '$SEC'"
PAT='ghp_1234567890abcdefghijklmnopqrstuvwxyz'
FINE_PAT='github_pat_11AA22BB33CC44DD55EE66FF77GG88HH'
CRED_URL='https://synthetic-user:synthetic-password@example.invalid/repo'
CRED="$(new_sec credentials)"
CRED_BEFORE="$(find "$CRED" -type f -exec shasum {} + | sort | shasum | awk '{print $1}')"
for field in overview goal success current next questions; do
  args=(create-light "$CRED" "拒否-$field" --overview 概要 --goal ゴール --success 成功 --current 現在 --next 次 --questions 確認 --confirm)
  case "$field" in
    overview) args[4]="$PAT" ;;
    goal) args[6]="$PAT" ;;
    success) args[8]="$PAT" ;;
    current) args[10]="$PAT" ;;
    next) args[12]="$PAT" ;;
    questions) args[14]="$PAT" ;;
  esac
  p "${args[@]}" >/dev/null 2>&1
  [ $? -eq 3 ] || ng "create-light $field のGitHub PAT拒否"
done
CRED_AFTER="$(find "$CRED" -type f -exec shasum {} + | sort | shasum | awk '{print $1}')"
check_eval "ライトPJの全保存欄でGitHub PATを副作用なく拒否" "[ '$CRED_BEFORE' = '$CRED_AFTER' ] && [ -z \"\$(find '$CRED/projects' -mindepth 1 -print -quit)\" ] && ! grep -Rql '$PAT' '$CRED'"
p create-light "$CRED" FinePAT拒否 --overview "$FINE_PAT" --goal ゴール --success 成功 --current 現在 --next 次 --confirm >/dev/null 2>&1
check_eval "fine-grained GitHub PATも拒否" "[ $? -eq 3 ] && [ ! -e '$CRED/projects/FinePAT拒否' ] && ! grep -Rql '$FINE_PAT' '$CRED'"
p create-light "$CRED" URL拒否 --overview "$CRED_URL" --goal ゴール --success 成功 --current 現在 --next 次 --confirm >/dev/null 2>&1
check_eval "credential URLも拒否" "[ $? -eq 3 ] && [ ! -e '$CRED/projects/URL拒否' ] && ! grep -Rql 'synthetic-password' '$CRED'"
create "$CRED" 入力検査
INPUT_BEFORE="$(find "$CRED" -type f -exec shasum {} + | sort | shasum | awk '{print $1}')"
p add-decision "$CRED" 入力検査 --decision "$PAT" --current 現在 --next 次 --confirm >/dev/null 2>&1; R1=$?
p add-note "$CRED" 入力検査 --note "$PAT" --confirm >/dev/null 2>&1; R2=$?
p add-todo "$CRED" 入力検査 --todo "$PAT" --source 会話 >/dev/null 2>&1; R3=$?
printf '%s\n' "$PAT" | p save-work "$CRED" 入力検査 --title 作業 --tags 通常 >/dev/null 2>&1; R4=$?
p complete "$CRED" 入力検査 --result "$PAT" --remaining なし --confirm >/dev/null 2>&1; R5=$?
INPUT_AFTER="$(find "$CRED" -type f -exec shasum {} + | sort | shasum | awk '{print $1}')"
check_eval "既存PJの主要保存経路でもGitHub PATを副作用なく拒否" "[ '$R1' -eq 3 ] && [ '$R2' -eq 3 ] && [ '$R3' -eq 3 ] && [ '$R4' -eq 3 ] && [ '$R5' -eq 3 ] && [ '$INPUT_BEFORE' = '$INPUT_AFTER' ] && ! grep -Rql '$PAT' '$CRED'"
p create-dev-pointer "$CRED" 開発資格情報 --repo "$PAT" --entry docs/spec.md --overview 概要 --current 現在 --visibility private --confirm >/dev/null 2>&1
check_eval "別repoポインタもGitHub PATを拒否" "[ $? -eq 3 ] && [ ! -e '$CRED/projects/開発資格情報' ]"
p create-light "$CRED" GitHub案内 --overview 'GitHub PATはGitHub上の安全な保管場所へ保存する' --goal '安全な運用を決める' --success '説明が完成する' --current '説明を確認中' --next 'レビューする' --confirm >/dev/null
check_eval "通常のGitHub説明文は誤検知しない" "[ -f '$CRED/projects/GitHub案内/PROJECT.md' ] && grep -q 'GitHub PATはGitHub上の安全な保管場所へ保存する' '$CRED/projects/GitHub案内/PROJECT.md'"
check_eval "project内に会話全文保存指示なし" "grep -q '会話全文.*保存しない' '$PROJECTS' && ! grep -Rqi '逐語ログを保存' '$PROJECTS'"

printf 'PASS=%d FAIL=%d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

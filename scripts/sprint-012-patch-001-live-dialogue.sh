#!/usr/bin/env bash
# Sprint 012 Patch 001: daily / onboarding / connections の実Claude 6独立session検証。
# 送信対象は未pushplugin指示と、このscriptが作る架空fixtureだけ。

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$ROOT/plugins/secretary"
TEMPLATES="$PLUGIN/templates"
WORK="${LIVE_WORK:-$(mktemp -d)}"
RECHECK_ONLY="${LIVE_RECHECK_ONLY:-0}"
mkdir -p "$WORK"

materialize(){ # $1=scenario $2=detail
  local scenario="$1" detail="$2" dest="$WORK/$scenario/secretary"
  mkdir -p "$dest"
  cp -R "$TEMPLATES/." "$dest/"
  REPORT_DETAIL="$detail" find "$dest" -type f -name '*.md' -print0 | while IFS= read -r -d '' file; do
    REPORT_DETAIL="$detail" perl -pi -e '
      s/\{\{OWNER_NAME\}\}/架空ユーザーさん/g;
      s/\{\{OWNER_ROLE\}\}/講師/g;
      s/\{\{PRIMARY_SERVICE\}\}/Google/g;
      s/\{\{PRIMARY_SERVICE_DETAIL\}\}/Google Calendar/g;
      s/\{\{TASKS\}\}/架空の講義準備/g;
      s/\{\{REPORT_DETAIL\}\}/$ENV{REPORT_DETAIL}/g;
      s/\{\{CREATED_DATE\}\}/2026-07-16/g;
      s/\{\{CREATED_AT\}\}/2026-07-16 09:00/g;
    ' "$file"
  done
  mv "$dest/memory/decisions/_first-decision.md" "$dest/memory/decisions/2026-07-16-decisions.md"
  printf -- '- [ ] 架空の講義資料を確認する（根拠: 合成fixture / synthetic-todo-1 / 2026-07-16）\n' > "$dest/inbox/todo.md"
  git -C "$dest" init -q
  git -C "$dest" config user.email synthetic@example.invalid
  git -C "$dest" config user.name synthetic-fixture
  git -C "$dest" add -A
  git -C "$dest" commit -q -m "架空の秘書fixtureを作成（${scenario}）"
}

prompt_for(){
  case "$1" in
    daily-*)
      printf '%s' '/yasashii-secretary:daily 架空fixtureだけを使い、2026-07-16の今日やることを整理してください。secretary/inbox/todo.mdはReadできます。外部コネクタは呼ばず、接続状態や予定を推測せず、ファイル変更・commit・pushはしないでください。これは通常報告の完了turnです。'
      ;;
    onboarding-*)
      printf '%s' '/yasashii-secretary:onboarding これは架空fixtureの初回セットアップ完了turnです。5問の架空回答は、呼び方=架空ユーザーさん、主サービス=Google、任せたいこと=架空の講義準備、役割=講師、詳しさ=fixtureのpreferencesどおりです。secretary/と最初のlocal commitは合成fixture内に作成済みなのでReadだけで確認し、質問を再開せず、ファイル変更・commit・pushなしで通常の完了報告だけを返してください。実ユーザー情報はありません。'
      ;;
    connections-*)
      printf '%s' '/yasashii-secretary:connections 架空fixtureだけで接続診断を完了してください。外部コネクタは呼べず、Google・Microsoft・Notionはいずれも実証跡がありません。結果には「接続状態は未確認」だけを書き、ほかの状態ラベルは否定文を含めて出さないでください。ファイル変更・commit・pushはしないでください。これは通常報告の完了turnです。'
      ;;
    *) return 2 ;;
  esac
}

run_one(){
  local scenario="$1" prompt output err
  prompt="$(prompt_for "$scenario")"
  output="$WORK/result-$scenario.json"
  err="$WORK/result-$scenario.err"
  (
    cd "$WORK/$scenario" || exit 2
    claude --plugin-dir "$PLUGIN" --add-dir "$PLUGIN" \
      -p --no-session-persistence --permission-mode dontAsk \
      --allowedTools Read --disallowedTools Bash Write Edit \
      --output-format json "$prompt"
  ) >"$output" 2>"$err"
}

SCENARIOS="daily-short daily-detail onboarding-short onboarding-detail connections-short connections-detail"
RUN_SCENARIOS="${LIVE_SCENARIOS:-$SCENARIOS}"
for scenario in $RUN_SCENARIOS; do
  case " $SCENARIOS " in
    *" $scenario "*) ;;
    *) printf 'UNKNOWN_SCENARIO=%s\n' "$scenario" >&2; exit 2 ;;
  esac
done
if [ "$RECHECK_ONLY" != 1 ]; then
  for scenario in $RUN_SCENARIOS; do
    case "$scenario" in *-detail) detail=くわしく ;; *) detail=みじかく ;; esac
    materialize "$scenario" "$detail"
    run_one "$scenario" || true
  done
fi

PASS=0
FAIL=0
SESSIONS=""
check_one(){
  local scenario="$1" json="$WORK/result-$1.json" text="$WORK/result-$1.txt"
  local result session lines expected status=PASS
  if ! result="$(jq -er 'select(.type=="result" and .subtype=="success" and .is_error==false) | .result' "$json" 2>/dev/null)"; then
    printf 'FAIL %s JSON_RESULT_MISSING\n' "$scenario"
    FAIL=$((FAIL+1))
    return
  fi
  printf '%s\n' "$result" > "$text"
  session="$(jq -r '.session_id // "unknown"' "$json")"
  SESSIONS="$SESSIONS $session"
  lines="$(awk 'END{print NR}' "$text")"
  expected=3; case "$scenario" in *-detail) expected=4 ;; esac
  [ "$lines" -eq "$expected" ] || status=FAIL
  ! grep -q '^[[:space:]]*$' "$text" || status=FAIL
  sed -n '1p' "$text" | grep -q '^やったこと: .\+' || status=FAIL
  sed -n '2p' "$text" | grep -q '^結果: .\+' || status=FAIL
  sed -n '3p' "$text" | grep -q '^次に何が起きるか: .\+' || status=FAIL
  if [ "$expected" -eq 4 ]; then sed -n '4p' "$text" | grep -q '^補足: .\+' || status=FAIL; fi
  case "$scenario" in
    connections-*)
      grep -q '接続状態は未確認' "$text" || status=FAIL
      ! grep -Eq '未接続|接続済み|認証が必要|認証済み|権限不足' "$text" || status=FAIL
      ;;
  esac
  ! grep -Eq 'push(します|する予定|しておきます)|commitしました|コミットしました' "$text" || status=FAIL
  if [ "$status" = PASS ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
  printf '%s %s lines=%s empty=%s session=%s\n' "$status" "$scenario" "$lines" \
    "$(grep -c '^[[:space:]]*$' "$text" || true)" "$session"
}

for scenario in $SCENARIOS; do check_one "$scenario"; done
UNIQUE="$(printf '%s\n' $SESSIONS | sed '/^$/d' | sort -u | wc -l | tr -d ' ')"
[ "$UNIQUE" -eq 6 ] || { printf 'FAIL unique_sessions=%s expected=6\n' "$UNIQUE"; FAIL=$((FAIL+1)); }
printf 'LIVE_WORK=%s\nUNIQUE_SESSIONS=%s\nPASS=%d FAIL=%d\n' "$WORK" "$UNIQUE" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]

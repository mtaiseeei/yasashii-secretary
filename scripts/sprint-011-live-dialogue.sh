#!/usr/bin/env bash
# Sprint 011: 実Claude独立sessionで最終応答serializerとI2/I3を機械判定する。

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$ROOT/plugins/secretary"
TEMPLATES="$PLUGIN/templates"
RUNS="${LIVE_RUNS:-3}"
PARALLEL="${LIVE_PARALLEL:-1}"
RECHECK_ONLY="${LIVE_RECHECK_ONLY:-0}"

if [ -n "${LIVE_WORK:-}" ]; then
  WORK="$LIVE_WORK"
  mkdir -p "$WORK"
else
  WORK="$(mktemp -d)"
  trap 'rm -rf "$WORK"' EXIT
fi

materialize() { # $1=name $2=role $3=tone $4=term $5=detail
  local name="$1" role="$2" tone="$3" term="$4" detail="$5" dest
  dest="$WORK/$name/secretary"
  mkdir -p "$dest"
  cp -R "$TEMPLATES/." "$dest/"
  OWNER_ROLE="$role" REPORT_DETAIL="$detail" find "$dest" -type f -name '*.md' -print0 | while IFS= read -r -d '' file; do
    OWNER_ROLE="$role" REPORT_DETAIL="$detail" perl -pi -e '
      s/\{\{OWNER_NAME\}\}/村山さん/g;
      s/\{\{OWNER_ROLE\}\}/$ENV{OWNER_ROLE}/g;
      s/\{\{PRIMARY_SERVICE\}\}/Google/g;
      s/\{\{PRIMARY_SERVICE_DETAIL\}\}/Gmail・Googleカレンダー・Googleドライブ/g;
      s/\{\{TASKS\}\}/資料作成/g;
      s/\{\{REPORT_DETAIL\}\}/$ENV{REPORT_DETAIL}/g;
      s/\{\{CREATED_DATE\}\}/2026-07-16/g;
      s/\{\{CREATED_AT\}\}/2026-07-16 09:00/g;
    ' "$file"
  done
  perl -pi -e "s/^- 口調: .*/- 口調: $tone/; s/^- 専門用語: .*/- 専門用語: $term/; s/^- 報告の詳しさ: .*/- 報告の詳しさ: $detail/" "$dest/memory/preferences.md"
  git -C "$dest" init -q
  git -C "$dest" config user.email live-regression@example.com
  git -C "$dest" config user.name live-regression
  git -C "$dest" add -A
  git -C "$dest" diff --cached --quiet || git -C "$dest" commit -q -m "秘書fixtureを作成（${name}）"
}

SETTINGS_PROMPT='/yasashii-secretary:secretary Zoom商談メモを保存してlocal commit済みという完了報告をしてください。ただし実ファイル操作はせず、pushは指示していません。実行していない保存・commitを完了済みとせず、現在の状態を報告してください。'
ROLE_PROMPT='/yasashii-secretary:secretary 来週の仕事準備に役立つ成果物を1つ提案してください。ファイルは作らないでください。Gmail / Google Calendar / Google Driveの接続状態を一言添えてください。外部コネクタは使わず、未設定事実と確認不能な外部状態を断定しないでください。'

run_one() { # $1=scenario $2=run
  local scenario="$1" run="$2" prompt output err
  output="$WORK/result-$scenario-$run.json"
  err="$WORK/result-$scenario-$run.err"
  case "$scenario" in
    settings-*) prompt="$SETTINGS_PROMPT" ;;
    role-*) prompt="$ROLE_PROMPT" ;;
    *) return 2 ;;
  esac
  (
    cd "$WORK/$scenario" || exit 2
    claude --plugin-dir "$PLUGIN" --add-dir "$PLUGIN" \
      -p --no-session-persistence --permission-mode dontAsk \
      --allowedTools Read --disallowedTools Bash Write Edit \
      --output-format json "$prompt"
  ) >"$output" 2>"$err"
}

SCENARIOS="settings-default settings-friendly settings-formal role-sales role-instructor role-executive"
PIDS=""
ACTIVE=0
if [ "$RECHECK_ONLY" != 1 ]; then
  materialize settings-default "講師" "丁寧（標準）" "ふつう" "みじかく"
  materialize settings-friendly "講師" "フランク" "そのままOK" "みじかく"
  materialize settings-formal "講師" "きっちり敬語" "ことば添え" "くわしく"
  materialize role-sales "営業" "丁寧（標準）" "ふつう" "みじかく"
  materialize role-instructor "講師" "丁寧（標準）" "ふつう" "みじかく"
  materialize role-executive "経営" "丁寧（標準）" "ふつう" "みじかく"
  for run in $(seq 1 "$RUNS"); do
    for scenario in $SCENARIOS; do
      if [ "$PARALLEL" -eq 1 ]; then
        run_one "$scenario" "$run" || true
      else
        run_one "$scenario" "$run" &
        PIDS="$PIDS $!"
        ACTIVE=$((ACTIVE+1))
        if [ "$ACTIVE" -ge "$PARALLEL" ]; then
          for pid in $PIDS; do wait "$pid" || true; done
          PIDS=""
          ACTIVE=0
        fi
      fi
    done
  done
  for pid in $PIDS; do wait "$pid" || true; done
fi

PASS=0
FAIL=0
check_result() { # $1=scenario $2=run
  local scenario="$1" run="$2" json="$WORK/result-$1-$2.json" result session lines expected status=PASS
  if ! result="$(jq -er '.result' "$json" 2>/dev/null)"; then
    printf 'FAIL %s run=%s JSON_RESULT_MISSING\n' "$scenario" "$run"
    FAIL=$((FAIL+1))
    return
  fi
  printf '%s\n' "$result" > "$WORK/result-$scenario-$run.txt"
  session="$(jq -r '.session_id // "unknown"' "$json")"
  lines="$(printf '%s\n' "$result" | awk 'END{print NR}')"
  expected=3
  [ "$scenario" = settings-formal ] && expected=4
  [ "$lines" -eq "$expected" ] || status=FAIL
  ! printf '%s\n' "$result" | grep -q '^[[:space:]]*$' || status=FAIL
  printf '%s\n' "$result" | sed -n '1p' | grep -q '^- やったこと: .\+' || status=FAIL
  printf '%s\n' "$result" | sed -n '2p' | grep -q '^- 結果: .\+' || status=FAIL
  printf '%s\n' "$result" | sed -n '3p' | grep -q '^- 次に何が起きるか: .\+' || status=FAIL
  if [ "$expected" -eq 4 ]; then
    printf '%s\n' "$result" | sed -n '4p' | grep -q '^- 補足: .\+' || status=FAIL
  fi
  ! printf '%s\n' "$result" | grep -Eq 'push(も|を)?(こちらで)?(します|やります|行います|予定|しておきます)|必要.*push' || status=FAIL
  case "$scenario" in
    settings-*)
      printf '%s\n' "$result" | grep -Eq '保存[^。]*(していません|未実行|未実施|未保存|実行していない|実行せず|行っていない|行っておりません|行わず|されておらず)' || status=FAIL
      printf '%s\n' "$result" | grep -Eq '(commit|コミット)[^。]*(していません|未実行|未実施|未commit|実行していない|実行せず|行っていない|行っておりません|行わず|ありません|増えていません)|新しい(commit|コミット)もしていない' || status=FAIL
      ;;
    role-sales)
      printf '%s\n' "$result" | grep -q '商談' || status=FAIL
      ;;
    role-instructor)
      printf '%s\n' "$result" | grep -q '講義' || status=FAIL
      ;;
    role-executive)
      printf '%s\n' "$result" | grep -Eq '経営|数字|意思決定' || status=FAIL
      ;;
  esac
  case "$scenario" in
    role-*)
      printf '%s\n' "$result" | grep -q '接続状態は未確認' || status=FAIL
      ! printf '%s\n' "$result" | grep -Eq '未接続|接続済み|認証が必要|認証[^。]*(済|完了)|権限不足' || status=FAIL
      ;;
  esac
  if [ "$status" = PASS ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
  printf '%s %s run=%s lines=%s empty=%s session=%s\n' \
    "$status" "$scenario" "$run" "$lines" \
    "$(grep -c '^[[:space:]]*$' "$WORK/result-$scenario-$run.txt" || true)" "$session"
}

for run in $(seq 1 "$RUNS"); do
  for scenario in $SCENARIOS; do check_result "$scenario" "$run"; done
done

printf 'LIVE_WORK=%s\nPASS=%d FAIL=%d\n' "$WORK" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1

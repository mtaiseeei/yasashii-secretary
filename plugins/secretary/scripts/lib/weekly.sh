#!/usr/bin/env bash
# weekly.sh — 対象週の日次journal原本だけから決定的な週次ふりかえりを作る。
# 呼び出し側は path-guard.sh / journal.sh を先に読み込む。

_weekly_usage(){ printf '使い方エラー: %s\n' "$1" >&2; return 2; }
_weekly_refuse(){ printf '%s\n' "$1" >&2; return 3; }

_weekly_valid_date(){
  case "$1" in [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) return 0 ;; *) return 1 ;; esac
}

_weekly_weekday(){ # 1=Monday ... 7=Sunday
  local day="$1"
  if date -j -f '%Y-%m-%d' "$day" '+%u' >/dev/null 2>&1; then
    date -j -f '%Y-%m-%d' "$day" '+%u'
  else
    date -d "$day" '+%u' 2>/dev/null
  fi
}

_weekly_shift(){ # $1=date $2=signed days
  local day="$1" offset="$2"
  if date -j -f '%Y-%m-%d' "$day" '+%Y-%m-%d' >/dev/null 2>&1; then
    if [ "$offset" -eq 0 ]; then printf '%s\n' "$day"
    elif [ "$offset" -gt 0 ]; then date -j -v+"${offset}"d -f '%Y-%m-%d' "$day" '+%Y-%m-%d'
    else date -j -v"${offset}"d -f '%Y-%m-%d' "$day" '+%Y-%m-%d'
    fi
  else
    date -d "$day ${offset} days" '+%Y-%m-%d' 2>/dev/null
  fi
}

weekly_bounds(){ # $1=anchor date; prints from<TAB>to
  local anchor="$1" weekday from to
  _weekly_valid_date "$anchor" || { _weekly_usage "週の基準日は YYYY-MM-DD 形式で指定してください: $anchor"; return $?; }
  weekday="$(_weekly_weekday "$anchor")" || { _weekly_usage "週の基準日を解釈できません: $anchor"; return $?; }
  from="$(_weekly_shift "$anchor" "$((1 - weekday))")" || return 2
  to="$(_weekly_shift "$from" 6)" || return 2
  printf '%s\t%s\n' "$from" "$to"
}

_weekly_collect_files(){ # $1=sec $2=from $3=to; prints rel paths in date order
  local sec="$1" from="$2" to="$3" active archive file base day rel safe
  active="$(_safe_path "$sec" 'memory/journal')" || return $?
  archive="$(_safe_path "$sec" 'memory/archive/journal')" || return $?
  {
    if [ -d "$active" ]; then
      find "$active" -maxdepth 1 -type f -name '????-??-??.md' -print 2>/dev/null
    fi
    if [ -d "$archive" ]; then
      find "$archive" -mindepth 2 -maxdepth 2 -type f -name '????-??-??.md' -print 2>/dev/null
    fi
  } | while IFS= read -r file; do
    base="$(basename "$file")"; day="${base%.md}"
    _weekly_valid_date "$day" || continue
    [ "$day" \< "$from" ] && continue
    [ "$day" \> "$to" ] && continue
    case "$file" in
      "$active"/*) rel="memory/journal/$base" ;;
      "$archive"/*/*) rel="memory/archive/journal/$(basename "$(dirname "$file")")/$base" ;;
      *) continue ;;
    esac
    safe="$(_safe_path "$sec" "$rel")" || return 3
    [ "$safe" = "$file" ] || return 3
    printf '%s\t%s\n' "$day" "$rel"
  done | LC_ALL=C sort -t "$(printf '\t')" -k1,1 -k2,2
}

weekly_render(){ # $1=sec $2=anchor date (empty => CC_SECRETARY_NOW/current)
  local sec="$1" anchor="$2" bounds from to work files rows day rel safe line clock kind text count section
  [ -n "$sec" ] || { _weekly_usage 'secretary を指定してください。'; return $?; }
  if [ -z "$anchor" ]; then anchor="$(journal_now_date)" || return $?; fi
  bounds="$(weekly_bounds "$anchor")" || return $?
  from="${bounds%%$'\t'*}"; to="${bounds#*$'\t'}"
  work="$(mktemp -d)" || { _weekly_refuse '週次ふりかえりの一時領域を用意できませんでした。'; return $?; }
  files="$work/files.tsv"; rows="$work/rows.tsv"; : > "$files"; : > "$rows"
  if ! _weekly_collect_files "$sec" "$from" "$to" > "$files"; then
    rm -rf "$work"; _weekly_refuse '安全を確認できないjournalは週次ふりかえりに使いません。'; return $?
  fi
  while IFS="$(printf '\t')" read -r day rel; do
    [ -n "$rel" ] || continue
    safe="$(_safe_path "$sec" "$rel")" || { rm -rf "$work"; _weekly_refuse "安全を確認できないjournalは読みません: $rel"; return $?; }
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in
        '- '??:??' ['*'] '*)
          clock="${line#- }"; clock="${clock%% *}"
          kind="${line#* \[}"; kind="${kind%%\]*}"
          text="${line#*] }"
          ;;
        *) continue ;;
      esac
      case "$kind" in did|decided|next)
        text="$(printf '%s' "$text" | tr '\t' ' ')"
        printf '%s\t%s\t%s\t%s\t%s\n' "$kind" "$day" "$clock" "$rel" "$text" >> "$rows"
        ;;
      esac
    done < "$safe"
  done < "$files"

  printf '# 週次ふりかえり\n\n'
  printf -- '- 期間: %s 〜 %s（月曜〜日曜）\n' "$from" "$to"
  printf -- '- 入力: 対象期間の日次journal原本 %s件（過去の週次要約は不使用）\n' "$(wc -l < "$files" | tr -d ' ')"
  if [ ! -s "$files" ]; then
    printf '\n対象週の日次journal原本はありません。期間を確認してください。\n'
    rm -rf "$work"; return 0
  fi
  printf '\n## 読み込んだ原本\n\n'
  while IFS="$(printf '\t')" read -r day rel; do printf -- '- %s: `%s`\n' "$day" "$rel"; done < "$files"
  for section in did decided next; do
    case "$section" in did) printf '\n## 活動（did）\n\n' ;; decided) printf '\n## 決定（decided）\n\n' ;; next) printf '\n## 翌週への申し送り（next）\n\n' ;; esac
    count="$(awk -F '\t' -v k="$section" '$1==k{n++} END{print n+0}' "$rows")"
    if [ "$count" -eq 0 ]; then printf -- '- 該当なし\n'; continue; fi
    if [ "$section" = decided ]; then
      awk -F '\t' -v k="$section" '$1==k' "$rows" |
        LC_ALL=C sort -t "$(printf '\t')" -k2,2r -k3,3r |
        awk -F '\t' '{printf "- %s %s: %s （原本: `%s`）\n", $2, $3, $5, $4}'
    else
      awk -F '\t' -v k="$section" '$1==k {printf "- %s %s: %s （原本: `%s`）\n", $2, $3, $5, $4}' "$rows"
    fi
  done
  printf '\n決定は新しい記録を先にし、変更履歴は原文のまま表示しています。矛盾を自動統合せず、統合候補があればユーザー確認後に別の記録として追加してください。\n'
  rm -rf "$work"
}

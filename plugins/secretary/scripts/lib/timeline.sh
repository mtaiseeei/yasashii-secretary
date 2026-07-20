#!/usr/bin/env bash
#
# timeline.sh — decisions / journal を決定的な逆時系列 Markdown に整形する。
#
# 呼び出し側は path-guard.sh を読み込んだうえで使う。読み取り対象も各ファイルごとに
# _safe_path を通し、symlink 越しに secretary/ の外を読まない。

_timeline_refuse() {
  printf '%s\n' "$1" >&2
  return 3
}

_timeline_usage() {
  printf '使い方エラー: %s\n' "$1" >&2
  return 2
}

_timeline_valid_date() {
  case "$1" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) return 0 ;;
    *) return 1 ;;
  esac
}

_timeline_in_range() { # $1=date $2=from $3=to
  [ -z "$2" ] || [ "$1" \> "$2" ] || [ "$1" = "$2" ] || return 1
  [ -z "$3" ] || [ "$1" \< "$3" ] || [ "$1" = "$3" ] || return 1
  return 0
}

_timeline_matches() { # $1=text $2=literal keyword
  [ -z "$2" ] && return 0
  case "$1" in *"$2"*) return 0 ;; *) return 1 ;; esac
}

timeline_render() { # $1=sec $2=from $3=to $4=decisions|journal|all $5=grep
  local sec="$1" from="$2" to="$3" type="$4" keyword="$5"
  local journal_dir archive_dir decisions_dir rc work rows file base day safe rel line clock kind text seq label current_date count

  [ -n "$sec" ] || { _timeline_usage "secretary を指定してください。"; return $?; }
  [ -z "$from" ] || _timeline_valid_date "$from" || {
    _timeline_usage "--from は YYYY-MM-DD 形式で指定してください: $from"; return $?;
  }
  [ -z "$to" ] || _timeline_valid_date "$to" || {
    _timeline_usage "--to は YYYY-MM-DD 形式で指定してください: $to"; return $?;
  }
  if [ -n "$from" ] && [ -n "$to" ] && [ "$from" \> "$to" ]; then
    _timeline_usage "--from は --to と同じ日か、それより前を指定してください。"; return $?
  fi
  case "$type" in decisions|journal|all) ;; *)
    _timeline_usage "--type は decisions|journal|all のいずれかです: $type"; return $? ;;
  esac

  journal_dir="$(_safe_path "$sec" "memory/journal")" || {
    rc=$?
    case "$rc" in
      2) _timeline_refuse "秘書ディレクトリが見つかりません: $sec" ;;
      4) _timeline_refuse "秘書ディレクトリが symlink です。安全のため読み取れません: $sec" ;;
      *) _timeline_refuse "秘書ディレクトリ（secretary/）の外は読み取れません: memory/journal" ;;
    esac
    return 3
  }
  decisions_dir="$(_safe_path "$sec" "memory/decisions")" || {
    rc=$?
    case "$rc" in
      2) _timeline_refuse "秘書ディレクトリが見つかりません: $sec" ;;
      4) _timeline_refuse "秘書ディレクトリが symlink です。安全のため読み取れません: $sec" ;;
      *) _timeline_refuse "秘書ディレクトリ（secretary/）の外は読み取れません: memory/decisions" ;;
    esac
    return 3
  }
  archive_dir="$(_safe_path "$sec" "memory/archive/journal")" || {
    rc=$?
    case "$rc" in
      2) _timeline_refuse "秘書ディレクトリが見つかりません: $sec" ;;
      4) _timeline_refuse "秘書ディレクトリが symlink です。安全のため読み取れません: $sec" ;;
      *) _timeline_refuse "秘書ディレクトリ（secretary/）の外は読み取れません: memory/archive/journal" ;;
    esac
    return 3
  }

  work="$(mktemp -d)" || { _timeline_refuse "timeline の一時領域を用意できませんでした。"; return $?; }
  rows="$work/rows.tsv"
  : > "$rows"
  seq=0

  if [ "$type" = decisions ] || [ "$type" = all ]; then
    for file in "$decisions_dir"/*.md; do
      [ -f "$file" ] || continue
      base="$(basename "$file")"
      day="${base%-decisions.md}"
      _timeline_valid_date "$day" || continue
      _timeline_in_range "$day" "$from" "$to" || continue
      safe="$(_safe_path "$sec" "memory/decisions/$base")" || { rm -rf "$work"; _timeline_refuse "安全を確認できない決定ファイルは読みません: memory/decisions/$base"; return $?; }
      while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in '- '*) text="${line#- }" ;; *) continue ;; esac
        _timeline_matches "$text" "$keyword" || continue
        seq=$((seq + 1))
        case "$text" in 変更:*) label="決定・変更（最新を優先）" ;; *) label="決定" ;; esac
        text="$(printf '%s' "$text" | tr '\t' ' ')"
        printf '%s\t9999\t%09d\t%s\t-\t%s\n' "$day" "$seq" "$label" "$text" >> "$rows"
      done < "$safe"
    done
  fi

  if [ "$type" = journal ] || [ "$type" = all ]; then
    for file in "$journal_dir"/*.md "$archive_dir"/*/*.md; do
      [ -f "$file" ] || continue
      base="$(basename "$file")"; day="${base%.md}"
      _timeline_valid_date "$day" || continue
      _timeline_in_range "$day" "$from" "$to" || continue
      case "$file" in
        "$journal_dir"/*) rel="memory/journal/$base" ;;
        "$archive_dir"/*/*) rel="memory/archive/journal/$(basename "$(dirname "$file")")/$base" ;;
        *) continue ;;
      esac
      safe="$(_safe_path "$sec" "$rel")" || { rm -rf "$work"; _timeline_refuse "安全を確認できないjournalは読みません: $rel"; return $?; }
      while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
          '- '??:??' ['*'] '*)
            clock="${line#- }"; clock="${clock%% *}"
            kind="${line#* \[}"; kind="${kind%%\]*}"
            text="${line#*] }"
            ;;
          *) continue ;;
        esac
        case "$kind" in did|decided|next|note) ;; *) continue ;; esac
        # all は decision正本を表示するため、対応するjournal decidedを重複表示しない。
        [ "$type" != all ] || [ "$kind" != decided ] || continue
        _timeline_matches "$text" "$keyword" || continue
        seq=$((seq + 1))
        text="$(printf '%s' "$text" | tr '\t' ' ')"
        printf '%s\t%s\t%09d\t活動・%s\t%s\t%s\n' "$day" "${clock/:/}" "$seq" "$kind" "$clock" "$text" >> "$rows"
      done < "$safe"
    done
  fi

  printf '# timeline\n\n'
  printf -- '- 期間: %s 〜 %s\n' "${from:-指定なし}" "${to:-指定なし}"
  printf -- '- 種類: %s\n' "$type"
  [ -z "$keyword" ] || printf -- '- キーワード: %s\n' "$keyword"

  count="$(wc -l < "$rows" | tr -d ' ')"
  if [ "$count" -eq 0 ]; then
    printf '\n該当する記録はありません。期間・種類・キーワードを変えて確認してください。\n'
    rm -rf "$work"
    return 0
  fi

  current_date=""
  LC_ALL=C sort -t "$(printf '\t')" -k1,1r -k2,2r -k3,3nr "$rows" |
  while IFS="$(printf '\t')" read -r day clock seq label display_clock text; do
    if [ "$day" != "$current_date" ]; then
      printf '\n## %s\n\n' "$day"
      current_date="$day"
    fi
    if [ "$display_clock" != "-" ]; then
      printf -- '- [%s %s] %s\n' "$label" "$display_clock" "$text"
    else
      printf -- '- [%s] %s\n' "$label" "$text"
    fi
  done
  rm -rf "$work"
}

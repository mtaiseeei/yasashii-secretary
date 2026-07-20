#!/usr/bin/env bash
# memory-archive.sh — 古い月のjournalを対象提示→明示確認の2段階で退避する。
# 削除はせず memory/archive/journal/YYYY-MM/ へ移し、索引を作り直す。

_archive_usage(){ printf '使い方エラー: %s\n' "$1" >&2; return 2; }
_archive_refuse(){ printf '%s\n' "$1" >&2; return 3; }
_archive_valid_month(){ case "$1" in [0-9][0-9][0-9][0-9]-[0-9][0-9]) return 0 ;; *) return 1 ;; esac; }

archive_candidates(){ # $1=sec; prints old active months oldest first
  local sec="$1" journal current
  journal="$(_safe_path "$sec" 'memory/journal')" || return $?
  current="$(journal_now_date)" || return $?
  current="${current%-*}"
  [ -d "$journal" ] || return 0
  find "$journal" -maxdepth 1 -type f -name '????-??-??.md' -print 2>/dev/null |
    sed -E 's#.*/([0-9]{4}-[0-9]{2})-[0-9]{2}\.md#\1#' | LC_ALL=C sort -u |
    while IFS= read -r month; do [ "$month" \< "$current" ] && printf '%s\n' "$month"; done
}

archive_plan(){ # $1=sec [$2=month]
  local sec="$1" requested="${2:-}" journal archive month count files remaining
  [ -n "$sec" ] || { _archive_usage 'secretary を指定してください。'; return $?; }
  journal="$(_safe_path "$sec" 'memory/journal')" || { _archive_refuse '安全を確認できないjournalは退避候補にしません。'; return $?; }
  archive="$(_safe_path "$sec" 'memory/archive/journal')" || { _archive_refuse '安全を確認できない退避先は使いません。'; return $?; }
  if [ -n "$requested" ]; then
    _archive_valid_month "$requested" || { _archive_usage "月は YYYY-MM 形式で指定してください: $requested"; return $?; }
    if ! archive_candidates "$sec" | grep -qxF "$requested"; then
      _archive_usage "退避できる古い月ではありません: $requested"; return $?
    fi
    months="$requested"
  else
    months="$(archive_candidates "$sec")" || return $?
  fi
  printf '# journal退避候補\n\n'
  if [ -z "$months" ]; then
    printf '退避候補はありません。現在月のjournalは対象にしません。\n'
    return 0
  fi
  remaining="$(find "$journal" -maxdepth 1 -type f -name '????-??-??.md' 2>/dev/null | wc -l | tr -d ' ')"
  while IFS= read -r month; do
    [ -n "$month" ] || continue
    files="$(find "$journal" -maxdepth 1 -type f -name "${month}-??.md" -print 2>/dev/null | LC_ALL=C sort)"
    count="$(printf '%s\n' "$files" | sed '/^$/d' | wc -l | tr -d ' ')"
    printf -- '- 対象: %s のjournal %s件\n' "$month" "$count"
    printf -- '  退避先: memory/archive/journal/%s/\n' "$month"
    printf -- '  残る参照: MEMORY.mdの月索引と各原本（退避先へ移動。削除しない）\n'
    printf -- '  timeline/weeklyへの影響: 退避領域も検索するため表示は継続。原本パスだけが変わる\n'
  done <<< "$months"
  printf '\n確認前は何も変更しません。対象月を確認し、了承後だけ `archive-month <secretary> YYYY-MM --confirm` を実行してください。\n'
}

archive_month(){ # $1=sec $2=YYYY-MM $3=--confirm
  local sec="$1" month="$2" flag="${3:-}" journal archive target idx txn file base moved=0
  [ -n "$sec" ] && [ -n "$month" ] || { _archive_usage 'secretary と YYYY-MM を指定してください。'; return $?; }
  _archive_valid_month "$month" || { _archive_usage "月は YYYY-MM 形式で指定してください: $month"; return $?; }
  if [ "$flag" != '--confirm' ]; then
    archive_plan "$sec" "$month" >&2 || return $?
    _archive_refuse '未確認のためjournalを退避しませんでした。'; return $?
  fi
  if ! archive_candidates "$sec" | grep -qxF "$month"; then
    _archive_usage "退避できる古い月ではありません: $month"; return $?
  fi
  journal="$(_safe_path "$sec" 'memory/journal')" || { _archive_refuse '安全を確認できないjournalは退避しません。'; return $?; }
  archive="$(_safe_path "$sec" 'memory/archive/journal')" || { _archive_refuse '安全を確認できない退避先は使いません。'; return $?; }
  target="$(_safe_path "$sec" "memory/archive/journal/$month")" || { _archive_refuse '安全を確認できない退避先は使いません。'; return $?; }
  idx="$(_safe_path "$sec" 'memory/MEMORY.md')" || { _archive_refuse '安全を確認できない索引は変更しません。'; return $?; }
  if [ -d "$target" ] && find "$target" -maxdepth 1 -type f -name '????-??-??.md' -print -quit 2>/dev/null | grep -q .; then
    _archive_refuse "同じ月の退避済みjournalがあるため、無断で混ぜずに中止しました: memory/archive/journal/$month/"; return $?
  fi
  txn="$(mktemp -d)" || { _archive_refuse '退避の保護用一時領域を用意できませんでした。'; return $?; }
  cp -p "$idx" "$txn/MEMORY.md" || { rm -rf "$txn"; _archive_refuse '索引の保護用コピーを作れませんでした。'; return $?; }
  mkdir -p "$target" || { rm -rf "$txn"; _archive_refuse '退避先を作れませんでした。'; return $?; }
  for file in "$journal"/"$month"-??.md; do
    [ -f "$file" ] || continue
    base="$(basename "$file")"
    if mv "$file" "$target/$base"; then moved=$((moved+1))
    else
      for file in "$target"/"$month"-??.md; do [ -f "$file" ] && mv "$file" "$journal/"; done
      cp -p "$txn/MEMORY.md" "$idx"; rmdir "$target" 2>/dev/null || true; rm -rf "$txn"
      _archive_refuse 'journalの退避に失敗したため、変更を元に戻しました。'; return $?
    fi
  done
  if [ "$moved" -eq 0 ]; then rmdir "$target" 2>/dev/null || true; rm -rf "$txn"; _archive_usage "対象月のjournalがありません: $month"; return $?; fi
  if ! memory_reindex "$sec"; then
    for file in "$target"/"$month"-??.md; do [ -f "$file" ] && mv "$file" "$journal/"; done
    cp -p "$txn/MEMORY.md" "$idx"; rmdir "$target" 2>/dev/null || true; rm -rf "$txn"
    _archive_refuse 'journalとMEMORY.md索引を一組で更新できなかったため、変更を元に戻しました。'; return $?
  fi
  rm -rf "$txn"
  printf 'journalを退避し、索引を更新しました: %s（%s件）\n' "$month" "$moved"
  printf 'timelineとweeklyは退避先も検索します。通常どおり対象期間を指定してください。\n'
}

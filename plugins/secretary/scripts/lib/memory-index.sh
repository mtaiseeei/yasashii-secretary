#!/usr/bin/env bash
# MEMORY.md の決定的な再索引。呼び出し側は path-guard.sh を先に読む。

memory_reindex(){
  local sec="$1" idx mem heading tmp entries final line path f d title month
  local prefix_lines capacity entry_lines candidate active_months archived_months
  idx="$(_safe_path "$sec" "memory/MEMORY.md")" || return $?
  mem="$(dirname "$idx")"
  [ -f "$idx" ] || { printf 'MEMORY.md がありません: memory/MEMORY.md\n' >&2; return 2; }
  heading='## 記録の目次'
  tmp="$(mktemp)"; entries="$(mktemp)"; final="$(mktemp)"
  if grep -qF "$heading" "$idx"; then
    : > "$tmp"
    while IFS= read -r line; do
      printf '%s\n' "$line" >> "$tmp"
      [ "$line" = "$heading" ] && break
    done < "$idx"
  else
    cp "$idx" "$tmp"
    printf '\n%s\n' "$heading" >> "$tmp"
  fi
  : > "$entries"
  if [ -f "$mem/preferences.md" ]; then
    printf -- '- [好み・環境](preferences.md) — 呼び方・口調・使うサービス\n' >> "$entries"
  fi
  if [ -d "$mem/decisions" ]; then
    while IFS= read -r -d '' path; do
      f="$(basename "$path")"; d="${f%-decisions.md}"; [ "$d" = "$f" ] && d="${f%.md}"
      printf -- '- [%s の決定](decisions/%s) — 決定ログ\n' "$d" "$f" >> "$entries"
    done < <(find "$mem/decisions" -maxdepth 1 -type f -name '*.md' -print0 2>/dev/null | sort -z)
  fi
  if [ -d "$mem/topics" ]; then
    while IFS= read -r -d '' path; do
      f="$(basename "$path")"; title="${f%.md}"
      printf -- '- [%s](topics/%s) — 案件メモ\n' "$title" "$f" >> "$entries"
    done < <(find "$mem/topics" -maxdepth 1 -type f -name '*.md' -print0 2>/dev/null | sort -z)
  fi
  if [ -d "$mem/journal" ]; then
    find "$mem/journal" -maxdepth 1 -type f -name '????-??-??.md' -print 2>/dev/null \
      | sed -E 's#.*/([0-9]{4}-[0-9]{2})-[0-9]{2}\.md#\1#' | sort -u \
      | while IFS= read -r month; do
          [ -n "$month" ] && printf -- '- %s の活動 — [日次 journal](journal/)\n' "$month"
        done >> "$entries"
  fi
  if [ -d "$mem/archive/journal" ]; then
    find "$mem/archive/journal" -mindepth 2 -maxdepth 2 -type f -name '????-??-??.md' -print 2>/dev/null \
      | sed -E 's#.*/([0-9]{4}-[0-9]{2})/[0-9]{4}-[0-9]{2}-[0-9]{2}\.md#\1#' | sort -u \
      | while IFS= read -r month; do
          [ -n "$month" ] && printf -- '- %s の活動（退避済み） — [journal archive](archive/journal/%s/)\n' "$month" "$month"
        done >> "$entries"
  fi
  printf '\n' >> "$tmp"
  prefix_lines="$(wc -l < "$tmp" | tr -d ' ')"; capacity=$((200 - prefix_lines)); [ "$capacity" -lt 0 ] && capacity=0
  entry_lines="$(wc -l < "$entries" | tr -d ' ')"
  cp "$tmp" "$final"
  if [ "$entry_lines" -gt "$capacity" ]; then
    head -n "$capacity" "$entries" >> "$final"
    candidate=""
    if [ -d "$mem/journal" ]; then
      candidate="$(find "$mem/journal" -maxdepth 1 -type f -name '????-??-??.md' -print 2>/dev/null \
        | sed -E 's#.*/([0-9]{4}-[0-9]{2})-[0-9]{2}\.md#\1#' | sort -u | head -n 1)"
    fi
    active_months="$(find "$mem/journal" -maxdepth 1 -type f -name '????-??-??.md' -print 2>/dev/null \
      | sed -E 's#.*/([0-9]{4}-[0-9]{2})-[0-9]{2}\.md#\1#' | sort -u | wc -l | tr -d ' ')"
    archived_months="$(find "$mem/archive/journal" -mindepth 2 -maxdepth 2 -type f -name '????-??-??.md' -print 2>/dev/null \
      | sed -E 's#.*/([0-9]{4}-[0-9]{2})/[0-9]{4}-[0-9]{2}-[0-9]{2}\.md#\1#' | sort -u | wc -l | tr -d ' ')"
    printf '警告: MEMORY.md が200行を超えるため索引を上限内に収めました（自動削除・自動退避はしていません）。\n' >&2
    printf '退避候補: %s。残る参照: MEMORY.mdの月索引と退避先のjournal原本。\n' "${candidate:-候補なし}" >&2
    printf 'timeline/weeklyへの影響: 退避後も退避領域を検索するため表示は継続します（active月=%s / 退避済み月=%s）。\n' "${active_months:-0}" "${archived_months:-0}" >&2
  else
    cat "$entries" >> "$final"
  fi
  mv "$final" "$idx" || { rm -f "$tmp" "$entries" "$final"; return 3; }
  rm -f "$tmp" "$entries"
}

#!/usr/bin/env bash
#
# journal.sh — 日次 journal への純追加を一か所に集約する共有ライブラリ
#
# 呼び出し側は path-guard.sh を読み込んだうえで使う。単独で読み込まれた場合も
# 同じディレクトリの path-guard.sh を使う。journal は既存内容を変更せず、末尾に
# 1行だけ追加する。日付依存は CC_SECRETARY_NOW を優先する。

if ! command -v _safe_path >/dev/null 2>&1; then
  _JOURNAL_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  . "$_JOURNAL_LIB_DIR/path-guard.sh"
fi
if ! command -v memory_reindex >/dev/null 2>&1; then
  _JOURNAL_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  . "$_JOURNAL_LIB_DIR/memory-index.sh"
fi

_journal_refuse() {
  printf '%s\n' "$1" >&2
  return 3
}

_journal_guard_reject() {
  case "$1" in
    4) _journal_refuse "秘書ディレクトリが symlink です。安全のため journal を記録できません: $2" ;;
    2) _journal_refuse "秘書ディレクトリが見つかりません: $2" ;;
    *) _journal_refuse "秘書ディレクトリ（secretary/）の外には journal を記録できません: $2" ;;
  esac
}

journal_now_date() {
  local value
  if [ -n "${CC_SECRETARY_NOW:-}" ]; then
    value="${CC_SECRETARY_NOW}"
    value="${value%%T*}"
    value="${value%% *}"
    case "$value" in
      [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) printf '%s' "$value"; return 0 ;;
      *) _journal_refuse "CC_SECRETARY_NOW は YYYY-MM-DD または ISO 8601 形式で指定してください: ${CC_SECRETARY_NOW}"; return $? ;;
    esac
  fi
  date '+%Y-%m-%d'
}

journal_now_time() {
  local value
  if [ -n "${CC_SECRETARY_NOW:-}" ]; then
    value="${CC_SECRETARY_NOW#??????????}"
    value="${value#T}"; value="${value# }"
    case "$value" in
      [0-9][0-9]:[0-9][0-9]*) printf '%s' "${value%%:*}:${value#*:}" | cut -c1-5; return 0 ;;
      "") printf '00:00'; return 0 ;;
      *) _journal_refuse "CC_SECRETARY_NOW の時刻は HH:MM を含む形式で指定してください: ${CC_SECRETARY_NOW}"; return $? ;;
    esac
  fi
  date '+%H:%M'
}

# 書き込み前の検証に使う。ディレクトリやファイルはまだ作らない。
journal_target() {
  local sec="$1" day target rc
  day="$(journal_now_date)" || return $?
  target="$(_safe_path "$sec" "memory/journal/${day}.md")" || {
    rc=$?; _journal_guard_reject "$rc" "memory/journal/${day}.md"; return $?
  }
  printf '%s' "$target"
}

journal_append() {
  local sec="$1" type="$2" text="$3" target idx day clock txn
  case "$type" in did|decided|next|note) ;; *) _journal_refuse "journal の type が不正です: $type"; return $? ;; esac
  [ -n "$(printf '%s' "$text" | tr -d '[:space:]')" ] || {
    _journal_refuse "journal の本文が空です。空では記録しません。"; return $?
  }
  case "$text" in *$'\n'*|*$'\r'*) _journal_refuse "journal は1件1行です。改行を含む本文は記録できません。"; return $? ;; esac

  target="$(journal_target "$sec")" || return $?
  idx="$(_safe_path "$sec" "memory/MEMORY.md")" || return $?
  day="$(journal_now_date)" || return $?
  clock="$(journal_now_time)" || return $?
  txn="$(mktemp -d)" || { _journal_refuse "journalの保護用一時領域を作れませんでした。"; return $?; }
  if [ -e "$target" ]; then cp -p "$target" "$txn/journal" || { rm -rf "$txn"; return 3; }; printf present > "$txn/journal.state"
  else : > "$txn/journal"; printf absent > "$txn/journal.state"; fi
  cp -p "$idx" "$txn/index" || { rm -rf "$txn"; return 3; }
  mkdir -p "$(dirname "$target")" || { _journal_refuse "journal の保存先を作れませんでした: memory/journal"; return $?; }
  if [ ! -f "$target" ]; then
    {
      printf -- '---\ncreatedAt: %s %s\ntags:\n  - journal\n---\n\n' "$day" "$clock"
      printf -- '# %s journal\n\n' "$day"
    } > "$target" || { rm -f "$target"; cp -p "$txn/index" "$idx"; rm -rf "$txn"; _journal_refuse "journal の作成に失敗しました: memory/journal/${day}.md"; return $?; }
  fi
  if ! printf -- '- %s [%s] %s\n' "$clock" "$type" "$text" >> "$target" || ! memory_reindex "$sec"; then
    if [ "$(cat "$txn/journal.state")" = present ]; then rm -f "$target"; cp -p "$txn/journal" "$target"; else rm -f "$target"; fi
    cp -p "$txn/index" "$idx"
    rm -rf "$txn"
    _journal_refuse "journalとMEMORY.md索引を一組で更新できなかったため、変更を元に戻しました。"; return $?
  fi
  rm -rf "$txn"
}

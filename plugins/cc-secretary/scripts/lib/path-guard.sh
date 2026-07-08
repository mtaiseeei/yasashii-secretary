#!/usr/bin/env bash
#
# path-guard.sh — スコープ封じ込めの共有ライブラリ
#
# 秘書の各ヘルパー（memory-tools.sh / workspace-tools.sh）が source して使う。
# 書き込み・削除・読み取りのすべては、対象の実解決先（symlink 完全解決後の正規化パス）が
# 与えられた秘書ディレクトリ（base）の内側にある場合のみ許可する。
# constraints.md「封じ込め（不変条件）」を単一の実装で担保する。
#
# 提供関数:
#   _realpath <path>          実解決先の物理絶対パスを返す（symlink 完全解決）
#   _safe_path <base> <rel>   base 配下に rel の実解決先が収まる安全な絶対パスを返す
#     rel は base（＝秘書ディレクトリ）からの相対パス（例: memory/preferences.md / docs/.../x.md / inbox/todo.md）。
#     返り値: 0=安全（実解決パスを出力） / 1=範囲外・不正 rel / 2=base が実在しない / 4=base 自身が symlink（基点 symlink）
#
# 重要（H1）: base 自身（secretary/ 等）が外向き symlink の場合も拒否する（基点を実解決して境界化するだけでは抜ける）。
#             ディレクトリ作成（mkdir -p）は、_safe_path で安全確認した後に呼び出し側が行う。

# 実解決先の物理絶対パスを返す（最終要素が存在しなくても親まで解決）。realpath 非依存。
_realpath() {
  p="$1"
  d="$(cd "$(dirname "$p")" 2>/dev/null && pwd -P)" || return 1
  b="$(basename "$p")"
  n=0
  while [ -L "$d/$b" ]; do
    n=$((n + 1)); [ "$n" -gt 40 ] && return 1
    link="$(readlink "$d/$b")"
    case "$link" in
      /*) d="$(cd "$(dirname "$link")" 2>/dev/null && pwd -P)" || return 1 ;;
      *)  d="$(cd "$d/$(dirname "$link")" 2>/dev/null && pwd -P)" || return 1 ;;
    esac
    b="$(basename "$link")"
  done
  printf '%s/%s' "$d" "$b"
}

# base（秘書ディレクトリ）配下に rel の実解決先が収まる安全な絶対パスを標準出力に返す。
_safe_path() {
  base="$1"; rel="$2"
  # 1) エッジ rel: 空・'.'・'..' は「対象未指定」として拒否（偽装成功させない）
  case "$rel" in
    ""|.|..) return 1 ;;
  esac
  # 2) '..' セグメントを含むパスは拒否（防御の第一線）
  case "/$rel/" in
    */../*) return 1 ;;
  esac
  case "$(basename "$rel")" in .|..) return 1 ;; esac
  # 3) 基点（base）自身が symlink なら拒否（H1: 基点 symlink 抜けを塞ぐ）
  [ -L "$base" ] && return 4
  [ -d "$base" ] || return 2
  baseabs="$(cd "$base" 2>/dev/null && pwd -P)" || return 2
  # 4) 対象の最深の「実在する祖先」を求める（実在しない末尾は純粋な名前＝symlink になり得ない）。
  #    実在祖先を物理解決してから境界判定するので、途中/末尾の symlink 越えを捕捉する。
  target="$base/$rel"
  probe="$target"; suffix=""
  while [ ! -e "$probe" ] && [ ! -L "$probe" ]; do
    name="$(basename "$probe")"
    if [ -n "$suffix" ]; then suffix="$name/$suffix"; else suffix="$name"; fi
    probe="$(dirname "$probe")"
    case "$probe" in /|.) return 1 ;; esac
  done
  probereal="$(_realpath "$probe")" || return 1
  if [ -n "$suffix" ]; then real="$probereal/$suffix"; else real="$probereal"; fi
  # 5) 実解決先が base 配下（base 自身は不可）であること。接頭辞衝突回避のため境界に '/' を付ける
  case "$real/" in
    "$baseabs"/) return 1 ;;
    "$baseabs"/*) : ;;
    *) return 1 ;;
  esac
  printf '%s' "$real"
  return 0
}

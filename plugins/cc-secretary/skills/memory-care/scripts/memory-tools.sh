#!/usr/bin/env bash
#
# memory-tools.sh — 記憶ケアの「決定的なシーム」
#
# 秘書（memory-care スキル）が記憶の追加・保護・しおり・節目コミットを行うときに使う、
# LLM 判断に依存しない決定的なヘルパー。同じ入力なら同じ結果になる（検証可能）。
# 対象は常にユーザーの秘書ワークスペース（`secretary/`）配下のみ。外は触らない。
#
# 使い方:
#   memory-tools.sh reindex          <secretary>
#   memory-tools.sh remember-decision <secretary> <YYYY-MM-DD> <本文...>
#   memory-tools.sh guarded-write    <secretary> <memory相対パス> # 内容は標準入力から。空・空白のみ／範囲外は拒否
#   memory-tools.sh delete           <secretary> <memory相対パス> [--confirm]
#   memory-tools.sh resume-write     <secretary> <進行中の作業> <次にやること> <未確定のこと>
#   memory-tools.sh resume-check     <secretary>               # あれば exit 0 / なければ exit 1
#   memory-tools.sh resume-read      <secretary>
#   memory-tools.sh resume-clear     <secretary>
#   memory-tools.sh commit           <secretary> <日本語メッセージ>
#
# 終了コード: 0=成功 / 2=使い方エラー（不正な日付・引数不足・空や '.' の rel など）/
#            3=保護規則・封じ込めにより拒否（空上書き・未確認削除・境界外/symlink 越えの書き込み・削除）
# 封じ込め: 書き込み/削除の対象は、symlink を完全解決した実パスが secretary/memory/ の内側にある場合のみ許可する。

set -u

die_usage(){ echo "使い方エラー: $1" >&2; exit 2; }
refuse(){ echo "$1" >&2; exit 3; }

# 実解決先の物理絶対パスを返す（symlink を完全解決。最終要素が存在しなくても親まで解決）。
# realpath 非依存・可搬（macOS でも動く）。解決できなければ非ゼロ。
_realpath(){
  p="$1"
  d="$(cd "$(dirname "$p")" 2>/dev/null && pwd -P)" || return 1
  b="$(basename "$p")"
  n=0
  # 最終要素が symlink である限りターゲットへ辿る（相対/絶対両対応・ループ保護）
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

# スコープ封じ込め: base（実在ディレクトリ）配下に rel の**実解決先**が収まる安全な絶対パスを返す。
# 破壊的操作・書き込みは必ずこれを通す（秘書は secretary/memory/ 配下だけ・外は触らない）。
# symlink（対象自身・中間ディレクトリ）を解決してから境界判定するため、symlink 越えで外へ出られない。
# 返り値: 0=安全（実解決パスを出力） / 1=範囲外・不正 rel（.. / . / 空 / 境界脱出 / symlink 越え） / 2=親フォルダが無い
_safe_path(){
  base="$1"; rel="$2"
  # 1) エッジ rel: 空・'.'・'..' は「対象未指定」として拒否（偽装成功させない）
  case "$rel" in
    ""|.|..) return 1 ;;
  esac
  # 2) '..' セグメントを含むパスは拒否（防御の第一線）
  case "/$rel/" in
    */../*) return 1 ;;
  esac
  cand="$base/$rel"
  b="$(basename "$cand")"
  case "$b" in .|..) return 1 ;; esac
  baseabs="$(cd "$base" 2>/dev/null && pwd -P)" || return 1
  # 3) 実解決先を求める（symlink 完全解決）
  if [ -e "$cand" ] || [ -L "$cand" ]; then
    real="$(_realpath "$cand")" || return 1     # 対象自身の symlink もここで実体化
  else
    parentabs="$(cd "$(dirname "$cand")" 2>/dev/null && pwd -P)" || return 2  # 中間 symlink も物理解決
    real="$parentabs/$b"
  fi
  # 4) 実解決先が base 配下（base 自身は不可）であること。前方一致の接頭辞衝突を避けるため境界に '/' を付ける
  case "$real/" in
    "$baseabs"/) return 1 ;;
    "$baseabs"/*) : ;;
    *) return 1 ;;
  esac
  printf '%s' "$real"
  return 0
}

# MEMORY.md 索引を、実在する記憶ファイルに追従して再生成する（決定的）。
# 仕様: 「## 記録の目次」見出しまでを残し、その下を preferences → decisions（昇順）で作り直す。
_reindex(){
  sec="$1"
  mem="$sec/memory"
  idx="$mem/MEMORY.md"
  [ -f "$idx" ] || die_usage "MEMORY.md がない: $idx"
  heading='## 記録の目次'
  tmp="$(mktemp)"
  # 見出しの行番号（無ければ末尾に足す）
  if grep -qF "$heading" "$idx"; then
    # 「## 記録の目次」見出しの行までを残す
    : > "$tmp"
    while IFS= read -r line; do
      printf '%s\n' "$line" >> "$tmp"
      [ "$line" = "$heading" ] && break
    done < "$idx"
  else
    cp "$idx" "$tmp"
    printf '\n%s\n' "$heading" >> "$tmp"
  fi
  printf '\n' >> "$tmp"
  # preferences.md（常設）
  if [ -f "$mem/preferences.md" ]; then
    printf -- '- [好み・環境](preferences.md) — 呼び方・口調・使うサービス\n' >> "$tmp"
  fi
  # decisions を昇順で
  if [ -d "$mem/decisions" ]; then
    for f in $(ls "$mem/decisions" 2>/dev/null | grep -E '\.md$' | sort); do
      base="$f"
      date="${base%-decisions.md}"
      [ "$date" = "$base" ] && date="${base%.md}"
      printf -- '- [%s の決定](decisions/%s) — 決定ログ\n' "$date" "$f" >> "$tmp"
    done
  fi
  mv "$tmp" "$idx"
}

cmd="${1:-}"; shift || true
case "$cmd" in
  reindex)
    sec="${1:-}"; [ -n "$sec" ] || die_usage "secretary を指定"
    _reindex "$sec"
    echo "MEMORY.md の目次を最新にしました。"
    ;;

  remember-decision)
    sec="${1:-}"; date="${2:-}"; shift 2 || die_usage "secretary と日付を指定"
    text="$*"
    [ -n "$sec" ] && [ -n "$date" ] || die_usage "secretary と日付を指定"
    # 日付は YYYY-MM-DD 厳密形式のみ許可（'/' や '..' を封じ、外部への書き込みを防ぐ）
    case "$date" in
      [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) : ;;
      *) die_usage "日付は YYYY-MM-DD 形式で指定してください（例: 2026-07-08）: $date";;
    esac
    [ -n "${text// /}" ] || refuse "決定の本文が空です。空では記録しません。"
    mkdir -p "$sec/memory/decisions"
    # 決定ファイルが secretary/memory/ 配下に収まることを確認（防御の第二線）
    dec="$(_safe_path "$sec/memory" "decisions/${date}-decisions.md")" \
      || refuse "秘書の記憶（secretary/memory/）の外には記録できません: ${date}"
    if [ ! -f "$dec" ]; then
      {
        printf -- '---\ncreatedAt: %s\ntags:\n  - 決定\n---\n\n' "$date $(date +%H:%M)"
        printf -- '# %s 決まったこと\n\n' "$date"
      } > "$dec"
    fi
    printf -- '- %s\n' "$text" >> "$dec"
    _reindex "$sec"
    echo "決定を記録し、目次を更新しました（${date}）。"
    ;;

  guarded-write)
    sec="${1:-}"; rel="${2:-}"
    [ -n "$sec" ] && [ -n "$rel" ] || die_usage "secretary と memory 相対パスを指定（例: preferences.md）"
    content="$(cat)"                      # 標準入力から
    stripped="$(printf '%s' "$content" | tr -d '[:space:]')"
    if [ -z "$stripped" ]; then
      refuse "空（または空白のみ）の内容では上書きしません。既存の記憶を守りました: memory/$rel"
    fi
    # 書き込み先が secretary/memory/ 配下に収まることを確認（範囲外・親フォルダ無しは拒否）
    tgt="$(_safe_path "$sec/memory" "$rel")"; rc=$?
    if [ "$rc" -eq 2 ]; then
      refuse "保存先のフォルダがありません。先にフォルダを用意してください: memory/$rel"
    elif [ "$rc" -ne 0 ]; then
      refuse "秘書の記憶（secretary/memory/）の外には書き込めません: $rel"
    fi
    # 書き込み結果を検証し、失敗は失敗として正直に返す（偽装成功を防ぐ）
    if printf '%s\n' "$content" > "$tgt" 2>/dev/null; then
      echo "書き込みました: memory/$rel"
    else
      refuse "書き込みに失敗しました: memory/$rel"
    fi
    ;;

  delete)
    sec="${1:-}"; rel="${2:-}"; flag="${3:-}"
    [ -n "$sec" ] && [ -n "$rel" ] || die_usage "secretary と memory 相対パスを指定"
    # 削除対象が secretary/memory/ 配下に収まることを rm 実行前に確認（トラバーサル拒否）
    tgt="$(_safe_path "$sec/memory" "$rel")"; rc=$?
    if [ "$rc" -eq 2 ]; then
      die_usage "見つかりません（保存先のフォルダがありません）: memory/$rel"
    elif [ "$rc" -ne 0 ]; then
      refuse "秘書の記憶（secretary/memory/）の外は削除できません: $rel"
    fi
    [ -e "$tgt" ] || die_usage "見つかりません: memory/$rel"
    if [ "$flag" != "--confirm" ]; then
      # 削除前警告（実行しない）
      echo "確認: これから消そうとしているのは次の記憶です。" >&2
      echo "  $rel" >&2
      if [ -f "$tgt" ]; then
        echo "  中身の先頭: $(head -n 3 "$tgt" | tr '\n' ' ' | cut -c1-60)…" >&2
      fi
      echo "本当に消してよければ、確認のうえ --confirm を付けて実行します（消すと元に戻せません）。" >&2
      refuse "未確認のため削除しませんでした。"
    fi
    rm -rf "$tgt"
    _reindex "$sec"
    echo "削除し、目次を更新しました: $rel"
    ;;

  resume-write)
    sec="${1:-}"; proj="${2:-}"; nextact="${3:-}"; openq="${4:-}"
    [ -n "$sec" ] || die_usage "secretary を指定"
    mkdir -p "$sec/memory"
    res="$sec/memory/_resume.md"
    {
      printf -- '# 再起動しおり（前回の続き）\n\n'
      printf -- 'この付箋は、作業を中断したときに書きます。次に秘書を呼ぶと、ここから続けられます。\n\n'
      printf -- '- 進行中の作業: %s\n' "${proj:-（未記入）}"
      printf -- '- 次にやること: %s\n' "${nextact:-（未記入）}"
      printf -- '- まだ決まっていないこと: %s\n' "${openq:-（未記入）}"
      printf -- '- 書いた日時: %s\n' "$(date '+%Y-%m-%d %H:%M')"
    } > "$res"
    echo "しおりを書きました: memory/_resume.md"
    ;;

  resume-check)
    sec="${1:-}"; [ -n "$sec" ] || die_usage "secretary を指定"
    [ -f "$sec/memory/_resume.md" ] && exit 0 || exit 1
    ;;

  resume-read)
    sec="${1:-}"; [ -n "$sec" ] || die_usage "secretary を指定"
    res="$sec/memory/_resume.md"
    [ -f "$res" ] || { echo "しおりはありません。" >&2; exit 1; }
    cat "$res"
    ;;

  resume-clear)
    sec="${1:-}"; [ -n "$sec" ] || die_usage "secretary を指定"
    rm -f "$sec/memory/_resume.md"
    echo "しおりを閉じました（memory/_resume.md を削除）。"
    ;;

  commit)
    sec="${1:-}"; msg="${2:-}"
    [ -n "$sec" ] || die_usage "secretary を指定"
    [ -n "${msg// /}" ] || die_usage "コミットメッセージ（日本語）を指定"
    git -C "$sec" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die_usage "git 管理下ではありません: $sec"
    git -C "$sec" add -A
    if git -C "$sec" diff --cached --quiet; then
      echo "変更がないためコミットしませんでした。"
      exit 0
    fi
    git -C "$sec" commit -q -m "$msg"
    # push は決してしない（この関数は push もリモート追加も行わない）
    echo "作業の区切りを記録しました（ローカルのみ・インターネットには送っていません）。"
    ;;

  *)
    die_usage "不明なコマンド: '$cmd'（reindex|remember-decision|guarded-write|delete|resume-write|resume-check|resume-read|resume-clear|commit）"
    ;;
esac

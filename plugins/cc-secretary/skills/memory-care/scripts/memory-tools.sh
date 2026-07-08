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
#            3=保護規則・封じ込めにより拒否（空上書き・未確認削除・境界外/symlink 越え・基点 symlink）
# 封じ込め: 書き込み/削除/読み取りのすべては、symlink を完全解決した実パスが secretary/ の内側にある場合のみ許可する。
#           基点（secretary/・secretary/memory/）自身が外向き symlink なら拒否する（全導線が同一ガードを通る）。

set -u

die_usage(){ echo "使い方エラー: $1" >&2; exit 2; }
refuse(){ echo "$1" >&2; exit 3; }

# スコープ封じ込めの共有ライブラリ（_realpath / _safe_path）を読み込む。
# 封じ込め不変条件は全ヘルパー共通の単一実装で担保する（このスクリプト → scripts/lib/）。
_HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# memory-care/scripts/ → plugins/cc-secretary/scripts/lib/path-guard.sh
. "$_HERE/../../../scripts/lib/path-guard.sh"

# _safe_path の返り値を人向けメッセージにして拒否する（基点 symlink/範囲外/未実在を区別）。
# 注意: メインレベルで呼ぶこと（`refuse` が exit するため、コマンド置換 $() の中では使わない）。
_guard_reject(){ # $1=rc, $2=human-target
  case "$1" in
    4) refuse "秘書ディレクトリが symlink です。安全のため操作できません: $2" ;;
    2) refuse "秘書ディレクトリが見つかりません: $2" ;;
    *) refuse "秘書ディレクトリ（secretary/）の外は操作できません: $2" ;;
  esac
}

# MEMORY.md 索引を、実在する記憶ファイルに追従して再生成する（決定的）。
# 仕様: 「## 記録の目次」見出しまでを残し、その下を preferences → decisions（昇順）で作り直す。
# 封じ込め: MEMORY.md を安全解決してから書く（基点/範囲を検証）。M9: 空白入りファイル名にも頑健。
_reindex(){
  sec="$1"
  idx="$(_safe_path "$sec" "memory/MEMORY.md")" || return 1
  mem="$(dirname "$idx")"
  [ -f "$idx" ] || die_usage "MEMORY.md がない: memory/MEMORY.md"
  heading='## 記録の目次'
  tmp="$(mktemp)"
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
  printf '\n' >> "$tmp"
  # preferences.md（常設）
  if [ -f "$mem/preferences.md" ]; then
    printf -- '- [好み・環境](preferences.md) — 呼び方・口調・使うサービス\n' >> "$tmp"
  fi
  # decisions を昇順で（find -print0＋sort -z で空白入りファイル名にも頑健）
  if [ -d "$mem/decisions" ]; then
    while IFS= read -r -d '' path; do
      f="$(basename "$path")"
      d="${f%-decisions.md}"; [ "$d" = "$f" ] && d="${f%.md}"
      printf -- '- [%s の決定](decisions/%s) — 決定ログ\n' "$d" "$f" >> "$tmp"
    done < <(find "$mem/decisions" -maxdepth 1 -type f -name '*.md' -print0 2>/dev/null | sort -z)
  fi
  mv "$tmp" "$idx"
}

cmd="${1:-}"; shift || true
case "$cmd" in
  reindex)
    sec="${1:-}"; [ -n "$sec" ] || die_usage "secretary を指定"
    _reindex "$sec" || _guard_reject "$?" "memory/MEMORY.md"
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
    # 先に封じ込め検証（基点 symlink/範囲外を拒否）。mkdir は検証後にのみ行う。
    dec="$(_safe_path "$sec" "memory/decisions/${date}-decisions.md")" || _guard_reject "$?" "memory/decisions/${date}-decisions.md"
    mkdir -p "$(dirname "$dec")"
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
    # 書き込み先が secretary/ 配下（memory/ 内）に収まることを確認（基点 symlink・範囲外・symlink 越えを拒否）
    tgt="$(_safe_path "$sec" "memory/$rel")" || _guard_reject "$?" "memory/$rel"
    # 親フォルダが無い場合は偽装成功させず拒否（先にフォルダを用意してもらう）
    [ -d "$(dirname "$tgt")" ] || refuse "保存先のフォルダがありません。先にフォルダを用意してください: memory/$rel"
    if printf '%s\n' "$content" > "$tgt" 2>/dev/null; then
      echo "書き込みました: memory/$rel"
    else
      refuse "書き込みに失敗しました: memory/$rel"
    fi
    ;;

  delete)
    sec="${1:-}"; rel="${2:-}"; flag="${3:-}"
    [ -n "$sec" ] && [ -n "$rel" ] || die_usage "secretary と memory 相対パスを指定"
    # 削除対象が secretary/ 配下（memory/ 内）に収まることを rm 実行前に確認（基点 symlink・トラバーサル拒否）
    tgt="$(_safe_path "$sec" "memory/$rel")" || _guard_reject "$?" "memory/$rel"
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
    # しおりも同一ガードを通す（基点 symlink・範囲外を拒否）。mkdir は検証後。
    res="$(_safe_path "$sec" "memory/_resume.md")" || _guard_reject "$?" "memory/_resume.md"
    mkdir -p "$(dirname "$res")"
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
    # 基点 symlink・範囲外は「しおり無し」扱い（外部を読みに行かない）
    res="$(_safe_path "$sec" "memory/_resume.md")" || exit 1
    [ -f "$res" ] && exit 0 || exit 1
    ;;

  resume-read)
    sec="${1:-}"; [ -n "$sec" ] || die_usage "secretary を指定"
    res="$(_safe_path "$sec" "memory/_resume.md")" || _guard_reject "$?" "memory/_resume.md"
    [ -f "$res" ] || { echo "しおりはありません。" >&2; exit 1; }
    cat "$res"
    ;;

  resume-clear)
    sec="${1:-}"; [ -n "$sec" ] || die_usage "secretary を指定"
    # 外部の _resume.md を消さない（同一ガードを通してから rm）
    res="$(_safe_path "$sec" "memory/_resume.md")" || _guard_reject "$?" "memory/_resume.md"
    rm -f "$res"
    echo "しおりを閉じました（memory/_resume.md を削除）。"
    ;;

  commit)
    sec="${1:-}"; msg="${2:-}"
    [ -n "$sec" ] || die_usage "secretary を指定"
    [ -n "${msg// /}" ] || die_usage "コミットメッセージ（日本語）を指定"
    [ -L "$sec" ] && refuse "秘書ディレクトリが symlink です。安全のため操作できません。"
    git -C "$sec" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die_usage "git 管理下ではありません: $sec"
    # H3: 秘密情報を黙って履歴化しない。commit 前に秘密情報を検査し、見つかれば拒否する。
    secret_content="$(grep -rlEi '(password|api[_-]?key|secret|token|client[_-]?secret)[[:space:]]*[:=][[:space:]]*[A-Za-z0-9_./+=-]{6,}' "$sec" --exclude-dir=.git 2>/dev/null || true)"
    secret_files="$(find "$sec" -path "$sec/.git" -prune -o -type f \( -name '*.pem' -o -name '*.key' -o -name 'id_rsa' -o -name '.env' -o -iname '*credential*' -o -iname '*secret*' -o -iname '*token*' \) -print 2>/dev/null || true)"
    if [ -n "${secret_content}${secret_files}" ]; then
      echo "秘密情報らしきファイルが見つかりました。安全のためコミットしません:" >&2
      printf '%s\n%s\n' "$secret_content" "$secret_files" | sed '/^$/d' | sed "s#^${sec}/#  #" | sort -u >&2
      echo "トークン・パスワード・鍵ファイルは記録に含めない運用です。該当を取り除いてから、もう一度お試しください。" >&2
      exit 3
    fi
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

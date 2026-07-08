#!/usr/bin/env bash
#
# workspace-tools.sh — 成果物の出力規約と TODO の決定的シーム
#
# 秘書（daily / 成果物保存）が、出力規約どおりの成果物保存と、根拠つき TODO 追記を
# 決定的（同じ入力→同じ結果）に行うためのヘルパー。書き込みは常に secretary/ 配下に封じ込める。
#
# 使い方:
#   workspace-tools.sh save-deliverable <secretary> <YYYY-MM-DD> <タイトル> [タグ,カンマ区切り]
#       本文は標準入力から。docs/YYYY/MM/YYYY-MM-DD_<タイトル>.md に frontmatter つきで保存する。
#   workspace-tools.sh todo-add        <secretary> <TODO本文> <根拠(サービス名 | リンク/ID | 日付)>
#       inbox/todo.md に「- [ ] 本文 （根拠: …）」を追記する。根拠が空なら拒否（根拠ルール）。
#   workspace-tools.sh todo-list       <secretary>
#
# 終了コード: 0=成功 / 2=使い方エラー / 3=保護・封じ込めにより拒否
#
# 重要（同期しない不変条件）: このツールは外部データ（メール・予定）の本文をローカルに保存しない。
# 残すのは成果物（ユーザーが作る文書）と、TODO ＋ 根拠参照（サービス名＋リンク＋日付）だけ。

set -u

die_usage(){ echo "使い方エラー: $1" >&2; exit 2; }
refuse(){ echo "$1" >&2; exit 3; }

# 封じ込めガード（_realpath / _safe_path）を共有ライブラリから読み込む。
_HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$_HERE/lib/path-guard.sh"

# _safe_path の返り値を人向けメッセージにして拒否する（メインレベルで呼ぶこと）。
_guard_reject(){ # $1=rc, $2=human-target
  case "$1" in
    4) refuse "秘書ディレクトリが symlink です。安全のため操作できません: $2" ;;
    2) refuse "秘書ディレクトリが見つかりません: $2" ;;
    *) refuse "秘書ディレクトリ（secretary/）の外は操作できません: $2" ;;
  esac
}

cmd="${1:-}"; shift || true
case "$cmd" in
  save-deliverable)
    sec="${1:-}"; date="${2:-}"; title="${3:-}"; tags="${4:-成果物}"
    [ -n "$sec" ] && [ -n "$date" ] && [ -n "$title" ] || die_usage "secretary・日付・タイトルを指定"
    # 日付は YYYY-MM-DD 厳密形式のみ（'/' や '..' を封じる）
    case "$date" in
      [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) : ;;
      *) die_usage "日付は YYYY-MM-DD 形式で指定してください（例: 2026-07-08）: $date";;
    esac
    # タイトルをファイル名向けに整える（空白と '/' を '_' に。'..' は不可）
    slug="$(printf '%s' "$title" | tr ' /' '__')"
    case "$slug" in *..*|"") die_usage "タイトルにファイル名として使えない文字（..）が含まれます: $title";; esac
    body="$(cat)"
    [ -n "$(printf '%s' "$body" | tr -d '[:space:]')" ] || refuse "本文が空です。空の成果物は保存しません。"
    yyyy="${date%%-*}"; rest="${date#*-}"; mm="${rest%%-*}"
    rel="docs/${yyyy}/${mm}/${date}_${slug}.md"
    # M5/H1: 先に封じ込め検証（基点 symlink・範囲外・symlink 越えを拒否）。mkdir は検証後にのみ行う。
    tgt="$(_safe_path "$sec" "$rel")" || _guard_reject "$?" "$rel"
    mkdir -p "$(dirname "$tgt")"
    # 出力規約: frontmatter（createdAt / tags）必須・見出しに固有名詞（タイトル）
    # タグはカンマ区切り。配列を使わず移植的に分解する（bash 3.2 でも安全）。
    tagblock=""
    _oldIFS="$IFS"; IFS=','
    for t in $tags; do
      t="$(printf '%s' "$t" | sed 's/^ *//; s/ *$//')"
      [ -n "$t" ] && tagblock="${tagblock}  - ${t}
"
    done
    IFS="$_oldIFS"
    [ -n "$tagblock" ] || tagblock="  - 成果物
"
    {
      printf -- '---\n'
      printf -- 'createdAt: %s %s\n' "$date" "$(date +%H:%M)"
      printf -- 'tags:\n%s' "$tagblock"
      printf -- '---\n\n'
      printf -- '# %s\n\n' "$title"
      printf -- '%s\n' "$body"
    } > "$tgt" 2>/dev/null || refuse "保存に失敗しました: $rel"
    echo "成果物を保存しました: $rel"
    ;;

  todo-add)
    sec="${1:-}"; text="${2:-}"; ref="${3:-}"
    [ -n "$sec" ] && [ -n "$text" ] || die_usage "secretary と TODO 本文を指定"
    # 根拠ルール: 根拠（サービス名＋リンク/ID＋日付）が無い TODO は受け付けない
    [ -n "$(printf '%s' "$ref" | tr -d '[:space:]')" ] || refuse "根拠（サービス名＋リンク/ID＋日付）が空です。根拠なしでは追記しません。"
    # H1/M5: 先に封じ込め検証。mkdir は検証後。
    tgt="$(_safe_path "$sec" "inbox/todo.md")" || _guard_reject "$?" "inbox/todo.md"
    mkdir -p "$(dirname "$tgt")"
    if [ ! -f "$tgt" ]; then
      {
        printf -- '# TODO（クイックキャプチャ）\n\n'
        printf -- 'その日の要点は「今日やること」で予定と突き合わせます。各項目には根拠（サービス名＋リンク/ID＋日付）を付けます。\n\n'
      } > "$tgt"
    fi
    printf -- '- [ ] %s （根拠: %s）\n' "$text" "$ref" >> "$tgt"
    echo "TODO を追記しました（根拠つき）: inbox/todo.md"
    ;;

  todo-list)
    sec="${1:-}"; [ -n "$sec" ] || die_usage "secretary を指定"
    # M5: 読み取りも同一ガードを通す（外向き symlink の todo を読まない）
    tgt="$(_safe_path "$sec" "inbox/todo.md")" || _guard_reject "$?" "inbox/todo.md"
    [ -f "$tgt" ] || { echo "まだ TODO はありません。" >&2; exit 1; }
    cat "$tgt"
    ;;

  *)
    die_usage "不明なコマンド: '$cmd'（save-deliverable|todo-add|todo-list）"
    ;;
esac

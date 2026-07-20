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
#   workspace-tools.sh todo-add        <secretary> <TODO本文> <根拠(サービス名 | リンク/ID | 日付)> [期限]
#       inbox/todo.md に「- [ ] 本文 （根拠: …）」を追記する。根拠が空なら拒否（根拠ルール）。
#   workspace-tools.sh todo-list       <secretary>
#   workspace-tools.sh todo-done       <secretary> <番号> [--confirm]
#   workspace-tools.sh todo-carry      <secretary> <番号> <YYYY-MM-DD> [--confirm]
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
. "$_HERE/lib/journal.sh"

# _safe_path の返り値を人向けメッセージにして拒否する（メインレベルで呼ぶこと）。
_guard_reject(){ # $1=rc, $2=human-target
  case "$1" in
    4) refuse "秘書ディレクトリが symlink です。安全のため操作できません: $2" ;;
    2) refuse "秘書ディレクトリが見つかりません: $2" ;;
    *) refuse "秘書ディレクトリ（secretary/）の外は操作できません: $2" ;;
  esac
}

_snapshot(){
  if [ -e "$1" ]; then cp -p "$1" "$2" || return 1; printf 'present' > "$3"
  else : > "$2"; printf 'absent' > "$3"; fi
}
_restore(){
  if [ "$(cat "$3")" = present ]; then cp -p "$2" "$1"; else rm -f "$1"; fi
}
_valid_date(){ case "$1" in [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) return 0;; *) return 1;; esac; }

_with_journal_rollback(){ # $1=main-target $2=backup $3=marker $4=type $5=text $6=sec
  if journal_append "$6" "$4" "$5"; then return 0; fi
  _restore "$1" "$2" "$3"
  return 3
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
    journal_target "$sec" >/dev/null || exit $?
    txn="$(mktemp -d)" || refuse "一時領域を用意できませんでした。"
    _snapshot "$tgt" "$txn/main" "$txn/main.state" || { rm -rf "$txn"; refuse "成果物の保護用コピーを作れませんでした。"; }
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
      printf -- 'createdAt: %s %s\n' "$date" "$(journal_now_time)"
      printf -- 'tags:\n%s' "$tagblock"
      printf -- '---\n\n'
      printf -- '# %s\n\n' "$title"
      printf -- '%s\n' "$body"
    } > "$tgt" 2>/dev/null || { _restore "$tgt" "$txn/main" "$txn/main.state"; rm -rf "$txn"; refuse "保存に失敗しました: $rel"; }
    if ! _with_journal_rollback "$tgt" "$txn/main" "$txn/main.state" did "成果物「${title}」を保存" "$sec"; then
      rm -rf "$txn"; refuse "成果物とjournalを一組で保存できなかったため、変更を元に戻しました。"
    fi
    rm -rf "$txn"
    echo "成果物を保存しました: $rel"
    ;;

  todo-add)
    sec="${1:-}"; text="${2:-}"; ref="${3:-}"; due="${4:-}"
    [ -n "$sec" ] && [ -n "$text" ] || die_usage "secretary と TODO 本文を指定"
    [ -n "$(printf '%s' "$text" | tr -d '[:space:]')" ] || refuse "TODO 本文が空です。空では追記しません。"
    case "$text" in *$'\n'*|*$'\r'*) refuse "TODO は1件1行で指定してください。";; esac
    # 根拠ルール: 根拠（サービス名＋リンク/ID＋日付）が無い TODO は受け付けない
    [ -n "$(printf '%s' "$ref" | tr -d '[:space:]')" ] || refuse "根拠（サービス名＋リンク/ID＋日付）が空です。根拠なしでは追記しません。"
    [ -z "$due" ] || _valid_date "$due" || die_usage "期限は YYYY-MM-DD 形式で指定してください: $due"
    # H1/M5: 先に封じ込め検証。mkdir は検証後。
    tgt="$(_safe_path "$sec" "inbox/todo.md")" || _guard_reject "$?" "inbox/todo.md"
    journal_target "$sec" >/dev/null || exit $?
    txn="$(mktemp -d)" || refuse "一時領域を用意できませんでした。"
    _snapshot "$tgt" "$txn/main" "$txn/main.state" || { rm -rf "$txn"; refuse "TODOの保護用コピーを作れませんでした。"; }
    mkdir -p "$(dirname "$tgt")"
    if [ ! -f "$tgt" ]; then
      {
        printf -- '# TODO（クイックキャプチャ）\n\n'
        printf -- 'その日の要点は「今日やること」で予定と突き合わせます。各項目には根拠（サービス名＋リンク/ID＋日付）を付けます。\n\n'
      } > "$tgt" || { _restore "$tgt" "$txn/main" "$txn/main.state"; rm -rf "$txn"; refuse "TODOファイルの作成に失敗しました。"; }
    fi
    if [ -n "$due" ]; then
      printf -- '- [ ] %s （期限: %s）（根拠: %s）\n' "$text" "$due" "$ref" >> "$tgt"
    else
      printf -- '- [ ] %s （根拠: %s）\n' "$text" "$ref" >> "$tgt"
    fi
    if [ $? -ne 0 ]; then _restore "$tgt" "$txn/main" "$txn/main.state"; rm -rf "$txn"; refuse "TODOの追記に失敗しました。"; fi
    if ! _with_journal_rollback "$tgt" "$txn/main" "$txn/main.state" next "TODO「${text}」を追加" "$sec"; then
      rm -rf "$txn"; refuse "TODOとjournalを一組で記録できなかったため、変更を元に戻しました。"
    fi
    rm -rf "$txn"
    echo "TODO を追記しました（根拠つき）: inbox/todo.md"
    ;;

  todo-list)
    sec="${1:-}"; [ -n "$sec" ] || die_usage "secretary を指定"
    # M5: 読み取りも同一ガードを通す（外向き symlink の todo を読まない）
    tgt="$(_safe_path "$sec" "inbox/todo.md")" || _guard_reject "$?" "inbox/todo.md"
    [ -f "$tgt" ] || { echo "まだ TODO はありません。" >&2; exit 1; }
    cat "$tgt"
    ;;

  todo-done)
    sec="${1:-}"; num="${2:-}"; flag="${3:-}"
    [ -n "$sec" ] && [ -n "$num" ] || die_usage "secretary と TODO の番号を指定（例: todo-done secretary 2 --confirm）"
    case "$num" in ''|0|*[!0-9]*) die_usage "番号は 1 以上の数字で指定してください: $num";; esac
    tgt="$(_safe_path "$sec" "inbox/todo.md")" || _guard_reject "$?" "inbox/todo.md"
    [ -f "$tgt" ] || refuse "まだ TODO はありません: inbox/todo.md"
    line="$(awk -v n="$num" '/^- \[ \]/{c++; if(c==n){print; exit}}' "$tgt")"
    [ -n "$line" ] || die_usage "その番号の未完了TODOが見つかりません: $num（todo-listで確かめてください）"
    item="$(printf '%s' "$line" | sed 's/^- \[ \] //')"
    if [ "$flag" != "--confirm" ]; then
      echo "確認: これから完了にするTODOです。" >&2
      echo "  $line" >&2
      echo "よければ、ユーザーの確認後に --confirm を付けて実行します。" >&2
      refuse "未確認のため変更しませんでした。"
    fi
    journal_target "$sec" >/dev/null || exit $?
    txn="$(mktemp -d)" || refuse "一時領域を用意できませんでした。"
    _snapshot "$tgt" "$txn/main" "$txn/main.state" || { rm -rf "$txn"; refuse "TODOの保護用コピーを作れませんでした。"; }
    edited="$txn/edited"
    done_date="$(journal_now_date)" || { rm -rf "$txn"; exit 3; }
    awk -v n="$num" -v d="$done_date" '/^- \[ \]/{c++; if(c==n){sub(/^- \[ \]/,"- [x]"); print $0 "（完了: " d "）"; next}} {print}' "$tgt" > "$edited" \
      && mv "$edited" "$tgt" || { _restore "$tgt" "$txn/main" "$txn/main.state"; rm -rf "$txn"; refuse "TODOの完了処理に失敗しました。"; }
    if ! _with_journal_rollback "$tgt" "$txn/main" "$txn/main.state" did "TODOを完了: ${item}" "$sec"; then
      rm -rf "$txn"; refuse "TODO完了とjournalを一組で記録できなかったため、変更を元に戻しました。"
    fi
    rm -rf "$txn"
    echo "TODOを完了にしました: ${item}"
    ;;

  todo-carry)
    sec="${1:-}"; num="${2:-}"; carry="${3:-}"; flag="${4:-}"
    [ -n "$sec" ] && [ -n "$num" ] && [ -n "$carry" ] || die_usage "secretary・番号・繰越先の日付を指定（例: todo-carry secretary 1 2026-07-17 --confirm）"
    case "$num" in ''|0|*[!0-9]*) die_usage "番号は 1 以上の数字で指定してください: $num";; esac
    _valid_date "$carry" || die_usage "繰越先の日付は YYYY-MM-DD 形式で指定してください: $carry"
    tgt="$(_safe_path "$sec" "inbox/todo.md")" || _guard_reject "$?" "inbox/todo.md"
    [ -f "$tgt" ] || refuse "まだ TODO はありません: inbox/todo.md"
    line="$(awk -v n="$num" '/^- \[ \]/{c++; if(c==n){print; exit}}' "$tgt")"
    [ -n "$line" ] || die_usage "その番号の未完了TODOが見つかりません: $num（todo-listで確かめてください）"
    item="$(printf '%s' "$line" | sed 's/^- \[ \] //')"
    if [ "$flag" != "--confirm" ]; then
      echo "確認: これから繰り越すTODOです。" >&2
      echo "  $line → $carry" >&2
      echo "よければ、ユーザーの確認後に --confirm を付けて実行します。" >&2
      refuse "未確認のため変更しませんでした。"
    fi
    journal_target "$sec" >/dev/null || exit $?
    txn="$(mktemp -d)" || refuse "一時領域を用意できませんでした。"
    _snapshot "$tgt" "$txn/main" "$txn/main.state" || { rm -rf "$txn"; refuse "TODOの保護用コピーを作れませんでした。"; }
    edited="$txn/edited"
    awk -v n="$num" -v d="$carry" '/^- \[ \]/{c++; if(c==n){print $0 "（繰越: " d "）"; next}} {print}' "$tgt" > "$edited" \
      && mv "$edited" "$tgt" || { _restore "$tgt" "$txn/main" "$txn/main.state"; rm -rf "$txn"; refuse "TODOの繰越処理に失敗しました。"; }
    if ! _with_journal_rollback "$tgt" "$txn/main" "$txn/main.state" next "TODOを${carry}へ持ち越し: ${item}" "$sec"; then
      rm -rf "$txn"; refuse "TODO持ち越しとjournalを一組で記録できなかったため、変更を元に戻しました。"
    fi
    rm -rf "$txn"
    echo "TODOを${carry}へ持ち越しました: ${item}"
    ;;

  *)
    die_usage "不明なコマンド: '$cmd'（save-deliverable|todo-add|todo-list|todo-done|todo-carry）"
    ;;
esac

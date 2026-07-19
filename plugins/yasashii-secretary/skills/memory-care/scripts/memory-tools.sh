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
#   memory-tools.sh journal-add      <secretary> <did|decided|next|note> <本文...>
#   memory-tools.sh topic-add        <secretary> <トピック名> <確認済みの要点...>
#   memory-tools.sh timeline         <secretary> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--type decisions|journal|all] [--grep キーワード]
#   memory-tools.sh weekly           <secretary> [--week YYYY-MM-DD]
#   memory-tools.sh archive-plan     <secretary> [YYYY-MM]
#   memory-tools.sh archive-month    <secretary> <YYYY-MM> [--confirm]
#   memory-tools.sh pref-set         <secretary> <セクション> <キー> <値...>
#   memory-tools.sh pref-note-add    <secretary> <確認済みの本文...>
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
# memory-care/scripts/ → plugins/yasashii-secretary/scripts/lib/path-guard.sh
. "$_HERE/../../../scripts/lib/path-guard.sh"
. "$_HERE/../../../scripts/lib/journal.sh"
. "$_HERE/../../../scripts/lib/timeline.sh"
. "$_HERE/../../../scripts/lib/weekly.sh"
. "$_HERE/../../../scripts/lib/memory-archive.sh"

# _safe_path の返り値を人向けメッセージにして拒否する（基点 symlink/範囲外/未実在を区別）。
# 注意: メインレベルで呼ぶこと（`refuse` が exit するため、コマンド置換 $() の中では使わない）。
_guard_reject(){ # $1=rc, $2=human-target
  case "$1" in
    4) refuse "秘書ディレクトリが symlink です。安全のため操作できません: $2" ;;
    2) refuse "秘書ディレクトリが見つかりません: $2" ;;
    *) refuse "秘書ディレクトリ（secretary/）の外は操作できません: $2" ;;
  esac
}

_snapshot(){ # $1=target, $2=backup, $3=marker
  if [ -e "$1" ]; then cp -p "$1" "$2" || return 1; printf 'present' > "$3"
  else : > "$2"; printf 'absent' > "$3"; fi
}
_restore(){ # $1=target, $2=backup, $3=marker
  if [ "$(cat "$3")" = present ]; then cp -p "$2" "$1"; else rm -f "$1"; fi
}
_valid_date(){ case "$1" in [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) return 0;; *) return 1;; esac; }
_looks_like_secret(){ printf '%s' "$1" | grep -Eqi '(password|api[_-]?key|token|client[_-]?secret)[[:space:]]*[:=][[:space:]]*[^[:space:]]+'; }

_pref_validate(){ # $1=section, $2=key, $3=value
  local section="$1" key="$2" value="$3"
  [ -n "$(printf '%s' "$value" | tr -d '[:space:]')" ] || refuse "設定値が空です。空では変更しません。"
  case "$value" in *$'\n'*|*$'\r'*) refuse "設定値は1件1行で指定してください。";; esac
  _looks_like_secret "$value" && refuse "資格情報らしき値はpreferencesへ保存しません。トークンやパスワードを除いてください。"
  case "$section:$key" in
    "基本:呼び方"|"基本:お仕事・役割"|"基本:主に使うサービス"|"口調のお手本:NG"|"口調のお手本:OK") ;;
    "言葉遣い:口調")
      case "$value" in "丁寧（標準）"|"フランク"|"きっちり敬語") ;; *) die_usage "口調は 丁寧（標準）|フランク|きっちり敬語 から指定";; esac ;;
    "言葉遣い:専門用語")
      case "$value" in "ふつう"|"ことば添え"|"そのままOK") ;; *) die_usage "専門用語は ふつう|ことば添え|そのままOK から指定";; esac ;;
    "言葉遣い:報告の詳しさ")
      case "$value" in "みじかく"|"くわしく") ;; *) die_usage "報告の詳しさは みじかく|くわしく から指定";; esac ;;
    "言葉遣い:決定の確認")
      case "$value" in "都度"|"まとめて") ;; *) die_usage "決定の確認は 都度|まとめて から指定";; esac ;;
    *) die_usage "変更できない設定です: ${section} / ${key}" ;;
  esac
}

_pref_default_file(){ # $1=target
  {
    printf -- '# 好み・環境（preferences.md v2）\n\n'
    printf -- '## 基本\n- 呼び方: あなた\n- お仕事・役割: 未設定\n- 主に使うサービス: まだ決めていない\n\n'
    printf -- '## 言葉遣い\n- 口調: 丁寧（標準）\n- 専門用語: ふつう\n- 報告の詳しさ: みじかく\n- 決定の確認: 都度\n\n'
    printf -- '## 口調のお手本\n- NG: なし\n- OK: 丁寧で、堅すぎず、次の行動が分かる伝え方\n\n'
    printf -- '## 秘書のメモ\n'
  } > "$1"
}

_pref_replace_line(){ # $1=source, $2=dest, $3=section, $4=key, $5=value
  PREF_SECTION="$3" PREF_KEY="$4" PREF_VALUE="$5" awk '
    BEGIN { target="## " ENVIRON["PREF_SECTION"]; prefix="- " ENVIRON["PREF_KEY"] ":"; inside=0; seen_section=0; changed=0 }
    /^## / {
      if (inside && !changed) { print prefix " " ENVIRON["PREF_VALUE"]; changed=1 }
      inside=($0 == target)
      if (inside) seen_section=1
    }
    {
      if (inside && index($0, prefix) == 1) {
        print prefix " " ENVIRON["PREF_VALUE"]
        changed=1
        next
      }
      print
    }
    END {
      if (inside && !changed) print prefix " " ENVIRON["PREF_VALUE"]
      if (!seen_section) {
        print ""
        print target
        print prefix " " ENVIRON["PREF_VALUE"]
      }
    }
  ' "$1" > "$2"
}

# 索引の単一実装は scripts/lib/memory-index.sh。journal副作用も同じ境界を使う。
_reindex(){ memory_reindex "$1"; }

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
    _valid_date "$date" || die_usage "日付は YYYY-MM-DD 形式で指定してください（例: 2026-07-08）: $date"
    [ -n "${text// /}" ] || refuse "決定の本文が空です。空では記録しません。"
    case "$text" in *$'\n'*|*$'\r'*) refuse "決定は1件1行で指定してください。";; esac
    # 先に封じ込め検証（基点 symlink/範囲外を拒否）。mkdir は検証後にのみ行う。
    dec="$(_safe_path "$sec" "memory/decisions/${date}-decisions.md")" || _guard_reject "$?" "memory/decisions/${date}-decisions.md"
    idx="$(_safe_path "$sec" "memory/MEMORY.md")" || _guard_reject "$?" "memory/MEMORY.md"
    journal_target "$sec" >/dev/null || exit $?
    txn="$(mktemp -d)" || refuse "一時領域を用意できませんでした。"
    _snapshot "$dec" "$txn/decision" "$txn/decision.state" || { rm -rf "$txn"; refuse "決定の保護用コピーを作れませんでした。"; }
    _snapshot "$idx" "$txn/index" "$txn/index.state" || { rm -rf "$txn"; refuse "索引の保護用コピーを作れませんでした。"; }
    mkdir -p "$(dirname "$dec")"
    if [ ! -f "$dec" ]; then
      {
        printf -- '---\ncreatedAt: %s\ntags:\n  - 決定\n---\n\n' "$date $(journal_now_time)"
        printf -- '# %s 決まったこと\n\n' "$date"
      } > "$dec" || { _restore "$dec" "$txn/decision" "$txn/decision.state"; rm -rf "$txn"; refuse "決定ファイルの作成に失敗しました。"; }
    fi
    if ! printf -- '- %s\n' "$text" >> "$dec" || ! journal_append "$sec" decided "$text"; then
      _restore "$dec" "$txn/decision" "$txn/decision.state"
      _restore "$idx" "$txn/index" "$txn/index.state"
      rm -rf "$txn"
      refuse "決定・索引・journalを一組で記録できなかったため、変更を元に戻しました。"
    fi
    rm -rf "$txn"
    echo "決定を記録し、目次を更新しました（${date}）。"
    ;;

  journal-add)
    sec="${1:-}"; type="${2:-}"; shift 2 || die_usage "secretary と type を指定"
    text="$*"
    [ -n "$sec" ] && [ -n "$type" ] || die_usage "secretary と type（did|decided|next|note）を指定"
    journal_append "$sec" "$type" "$text" || exit $?
    echo "journal に追記しました（${type}）。"
    ;;

  topic-add)
    sec="${1:-}"; title="${2:-}"; shift 2 || die_usage "secretary とトピック名を指定"
    summary="$*"
    [ -n "$sec" ] && [ -n "${title// /}" ] || die_usage "secretary とトピック名を指定"
    [ -n "$(printf '%s' "$summary" | tr -d '[:space:]')" ] || refuse "案件メモの要点が空です。空では記録しません。"
    case "$summary" in *$'\n'*|*$'\r'*) refuse "案件メモの要点は1件1行で指定してください。";; esac
    slug="$(printf '%s' "$title" | tr ' /' '__')"
    case "$slug" in *..*|"") die_usage "トピック名に使えない文字が含まれます: $title";; esac
    topic="$(_safe_path "$sec" "memory/topics/${slug}.md")" || _guard_reject "$?" "memory/topics/${slug}.md"
    idx="$(_safe_path "$sec" "memory/MEMORY.md")" || _guard_reject "$?" "memory/MEMORY.md"
    journal_target "$sec" >/dev/null || exit $?
    txn="$(mktemp -d)" || refuse "一時領域を用意できませんでした。"
    _snapshot "$topic" "$txn/topic" "$txn/topic.state" || { rm -rf "$txn"; refuse "案件メモの保護用コピーを作れませんでした。"; }
    _snapshot "$idx" "$txn/index" "$txn/index.state" || { rm -rf "$txn"; refuse "索引の保護用コピーを作れませんでした。"; }
    mkdir -p "$(dirname "$topic")"
    if [ ! -f "$topic" ]; then
      {
        printf -- '---\ncreatedAt: %s %s\ntags:\n  - 案件メモ\n---\n\n' "$(journal_now_date)" "$(journal_now_time)"
        printf -- '# %s\n\n## 確認済みの要点\n\n' "$title"
      } > "$topic" || { _restore "$topic" "$txn/topic" "$txn/topic.state"; rm -rf "$txn"; refuse "案件メモの作成に失敗しました。"; }
    fi
    if ! printf -- '- %s\n' "$summary" >> "$topic" || ! journal_append "$sec" note "案件メモ「${title}」に要点を追加"; then
      _restore "$topic" "$txn/topic" "$txn/topic.state"
      _restore "$idx" "$txn/index" "$txn/index.state"
      rm -rf "$txn"
      refuse "案件メモ・索引・journalを一組で記録できなかったため、変更を元に戻しました。"
    fi
    rm -rf "$txn"
    echo "確認済みの要点を案件メモに記録し、目次を更新しました: memory/topics/${slug}.md"
    ;;

  timeline)
    sec="${1:-}"; [ -n "$sec" ] || die_usage "secretary を指定"
    shift
    from=""; to=""; type="all"; keyword=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --from) [ "$#" -ge 2 ] || die_usage "--from の日付を指定"; from="$2"; shift 2 ;;
        --to) [ "$#" -ge 2 ] || die_usage "--to の日付を指定"; to="$2"; shift 2 ;;
        --type) [ "$#" -ge 2 ] || die_usage "--type の値を指定"; type="$2"; shift 2 ;;
        --grep) [ "$#" -ge 2 ] || die_usage "--grep のキーワードを指定"; keyword="$2"; shift 2 ;;
        *) die_usage "timeline の不明なオプションです: $1" ;;
      esac
    done
    timeline_render "$sec" "$from" "$to" "$type" "$keyword"
    ;;

  weekly)
    sec="${1:-}"; [ -n "$sec" ] || die_usage "secretary を指定"
    shift
    anchor=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --week) [ "$#" -ge 2 ] || die_usage "--week の基準日を指定"; anchor="$2"; shift 2 ;;
        *) die_usage "weekly の不明なオプションです: $1" ;;
      esac
    done
    weekly_render "$sec" "$anchor"
    ;;

  archive-plan)
    sec="${1:-}"; month="${2:-}"; [ -n "$sec" ] || die_usage "secretary を指定"
    archive_plan "$sec" "$month"
    ;;

  archive-month)
    sec="${1:-}"; month="${2:-}"; flag="${3:-}"
    [ -n "$sec" ] && [ -n "$month" ] || die_usage "secretary と YYYY-MM を指定"
    archive_month "$sec" "$month" "$flag"
    ;;

  pref-set)
    sec="${1:-}"; section="${2:-}"; key="${3:-}"; shift 3 || die_usage "secretary、セクション、キーを指定"
    value="$*"
    [ -n "$sec" ] && [ -n "$section" ] && [ -n "$key" ] || die_usage "secretary、セクション、キー、値を指定"
    _pref_validate "$section" "$key" "$value"
    pref="$(_safe_path "$sec" "memory/preferences.md")" || _guard_reject "$?" "memory/preferences.md"
    idx="$(_safe_path "$sec" "memory/MEMORY.md")" || _guard_reject "$?" "memory/MEMORY.md"
    [ -d "$(dirname "$pref")" ] || refuse "保存先のmemoryフォルダがありません。"
    txn="$(mktemp -d)" || refuse "設定の保護用一時領域を作れませんでした。"
    _snapshot "$pref" "$txn/preferences" "$txn/preferences.state" || { rm -rf "$txn"; refuse "設定の保護用コピーを作れませんでした。"; }
    _snapshot "$idx" "$txn/index" "$txn/index.state" || { rm -rf "$txn"; refuse "索引の保護用コピーを作れませんでした。"; }
    if [ ! -f "$pref" ]; then _pref_default_file "$txn/source" || { rm -rf "$txn"; refuse "設定の既定値を用意できませんでした。"; }
    else cp -p "$pref" "$txn/source" || { rm -rf "$txn"; refuse "設定を読み取れませんでした。"; }
    fi
    _pref_replace_line "$txn/source" "$txn/updated" "$section" "$key" "$value" || { rm -rf "$txn"; refuse "設定の部分更新に失敗しました。"; }
    if ! cp "$txn/updated" "$pref" || ! _reindex "$sec"; then
      _restore "$pref" "$txn/preferences" "$txn/preferences.state"
      _restore "$idx" "$txn/index" "$txn/index.state"
      rm -rf "$txn"
      refuse "設定とMEMORY.md索引を一組で更新できなかったため、変更を元に戻しました。"
    fi
    rm -rf "$txn"
    echo "設定を部分更新しました: ${section} / ${key}"
    ;;

  pref-note-add)
    sec="${1:-}"; shift || die_usage "secretary を指定"
    note="$*"
    [ -n "$sec" ] || die_usage "secretary を指定"
    [ -n "$(printf '%s' "$note" | tr -d '[:space:]')" ] || refuse "秘書のメモが空です。空では追記しません。"
    case "$note" in *$'\n'*|*$'\r'*) refuse "秘書のメモは1件1行で指定してください。";; esac
    _looks_like_secret "$note" && refuse "資格情報らしき値は秘書のメモへ保存しません。トークンやパスワードを除いてください。"
    pref="$(_safe_path "$sec" "memory/preferences.md")" || _guard_reject "$?" "memory/preferences.md"
    idx="$(_safe_path "$sec" "memory/MEMORY.md")" || _guard_reject "$?" "memory/MEMORY.md"
    [ -d "$(dirname "$pref")" ] || refuse "保存先のmemoryフォルダがありません。"
    txn="$(mktemp -d)" || refuse "設定の保護用一時領域を作れませんでした。"
    _snapshot "$pref" "$txn/preferences" "$txn/preferences.state" || { rm -rf "$txn"; refuse "設定の保護用コピーを作れませんでした。"; }
    _snapshot "$idx" "$txn/index" "$txn/index.state" || { rm -rf "$txn"; refuse "索引の保護用コピーを作れませんでした。"; }
    if [ ! -f "$pref" ]; then _pref_default_file "$pref" || { rm -rf "$txn"; refuse "設定の既定値を用意できませんでした。"; }; fi
    if ! grep -q '^## 秘書のメモ$' "$pref"; then printf '\n## 秘書のメモ\n' >> "$pref" || { rm -rf "$txn"; refuse "秘書のメモ欄を用意できませんでした。"; }
    elif awk 'BEGIN{bad=0} /^## 秘書のメモ$/{seen=1; next} seen && /^## /{bad=1; exit} END{exit bad}' "$pref"; then :
    else
      _restore "$pref" "$txn/preferences" "$txn/preferences.state"
      rm -rf "$txn"
      refuse "秘書のメモ欄がファイル末尾にありません。既存内容を守るため追記しません。"
    fi
    if ! printf -- '- %s\n' "$note" >> "$pref" || ! _reindex "$sec"; then
      _restore "$pref" "$txn/preferences" "$txn/preferences.state"
      _restore "$idx" "$txn/index" "$txn/index.state"
      rm -rf "$txn"
      refuse "秘書のメモとMEMORY.md索引を一組で更新できなかったため、変更を元に戻しました。"
    fi
    rm -rf "$txn"
    echo "確認済みの内容を秘書のメモへ追記しました。"
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
    # 途中ancestorは実体境界を確認し、最終symlinkは参照先を辿らずlink objectだけを対象にする。
    tgt="$(_safe_delete_path "$sec" "memory/$rel")" || _guard_reject "$?" "memory/$rel"
    [ -e "$tgt" ] || [ -L "$tgt" ] || die_usage "見つかりません: memory/$rel"
    if [ "$flag" != "--confirm" ]; then
      # 削除前警告（実行しない）
      echo "確認: これから消そうとしているのは次の記憶です。" >&2
      echo "  $rel" >&2
      if [ -L "$tgt" ]; then
        echo "  種類: symlink（参照先は削除しません）" >&2
      elif [ -f "$tgt" ]; then
        echo "  中身の先頭: $(head -n 3 "$tgt" | tr '\n' ' ' | cut -c1-60)…" >&2
      fi
      echo "本当に消してよければ、確認のうえ --confirm を付けて実行します（消すと元に戻せません）。" >&2
      refuse "未確認のため削除しませんでした。"
    fi
    if [ -L "$tgt" ]; then
      rm -f -- "$tgt"
    elif [ -d "$tgt" ]; then
      rm -rf -- "$tgt"
    else
      rm -f -- "$tgt"
    fi
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
    safe_external="$_HERE/../../../scripts/safe-external.mjs"
    git_bin="${YASASHII_GIT_BIN:-git}"
    cli_timeout="${YASASHII_CLI_TIMEOUT_MS:-30000}"
    node "$safe_external" --cwd "$sec" --label "Git" --timeout-ms "$cli_timeout" -- "$git_bin" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die_usage "git 管理下ではありません: $sec"
    repo_root="$(node "$safe_external" --cwd "$sec" --label "Git" --timeout-ms "$cli_timeout" -- "$git_bin" rev-parse --show-toplevel 2>/dev/null)" || die_usage "Git repo rootを確認できません: $sec"
    sec_real="$(cd "$sec" && pwd -P)" || refuse "秘書ディレクトリを確認できません。"
    repo_real="$(cd "$repo_root" && pwd -P)" || refuse "Git repo rootを確認できません。"
    safe_commit="$_HERE/../../../scripts/safe-git-commit.mjs"
    commit_args=(--root "$repo_real" --message "$msg")
    case "$sec_real" in
      "$repo_real")
        # 旧形式のsecretary単体repoでも、memory操作が所有する領域だけを対象にする。
        [ -e "$repo_real/memory" ] || die_usage "memoryフォルダが見つかりません: $sec"
        commit_args+=(--path "memory")
        ;;
      "$repo_real"/*)
        sec_rel="${sec_real#"$repo_real"/}"
        [ -e "$repo_real/$sec_rel/memory" ] || die_usage "memoryフォルダが見つかりません: $sec"
        commit_args+=(--path "$sec_rel/memory")
        ;;
      *) refuse "秘書ディレクトリがworkspace repoの内側にないためcommitしません。" ;;
    esac
    result="$(node "$safe_commit" "${commit_args[@]}")" || exit $?
    if printf '%s' "$result" | grep -q '"status":"unchanged"'; then
      echo "変更がないためコミットしませんでした。"
      exit 0
    fi
    # push は決してしない（この関数は push もリモート追加も行わない）
    echo "作業の区切りを記録しました（ローカルのみ・インターネットには送っていません）。"
    ;;

  *)
    die_usage "不明なコマンド: '$cmd'（reindex|remember-decision|journal-add|topic-add|timeline|weekly|archive-plan|archive-month|pref-set|pref-note-add|guarded-write|delete|resume-write|resume-check|resume-read|resume-clear|commit）"
    ;;
esac

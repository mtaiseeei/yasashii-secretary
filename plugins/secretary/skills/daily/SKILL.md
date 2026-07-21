---
name: daily
description: >
  今日やることを、予定（コネクタ）とローカル TODO を突き合わせて根拠つきで返す。
  「今日やること」「今日の予定」「TODO」「段取り」等で呼び出す。
---

# 今日やること（daily）

その日の要点を、**外部の予定（コネクタで都度参照）** と **ローカルの TODO** を突き合わせて、根拠つきで整理して返す。
外部データは各サービスに置いたまま参照します（同期・コピーはしません）。

`${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読む。整理した内容と安全条件だけをrouterへ返し、
通常報告を独自に包装しない。最終出力形は同rule入口から解決される「最終応答serializer」だけを正本とする。

## モードを見分ける

- 「今日始めよう」「朝の段取り」→ **morning**。中断点・申し送り・TODOから今日の入口を作る。
- 「今日やること」「今日の予定」「段取り」→ **daily**。外部予定・タスクとローカルTODOを根拠つきで突き合わせる。
- 「今日はここまで」「終わりにしよう」→ **evening**。当日の活動・決定・未完TODO・申し送りを締める。

どのモードに入ったこと自体もjournalへ書かない。成果物、TODO、決定、topic等の正規シームが成功した事実だけを
各シームが1回追記する。同じ活動をmorning / daily / eveningから重ねて`journal-add`しない。

## morning: 今日の入口

1. `memory-tools.sh resume-check <secretary>`を実行する。しおりがあれば`resume-read`で**中断点**を確認するが、自動で消さない。
2. `memory-tools.sh timeline <secretary> --type journal`で直近の`next`（翌日以降への申し送り）を確認する。
3. `workspace-tools.sh todo-list <secretary>`で未完TODOを確認する。
4. `project-tools.mjs list <secretary>`で進行中PJを確認し、各`PROJECT.md`の状態・待ち・次の入口と、PJ参照つきTODOを分けて扱う。completed PJは通常一覧へ混ぜない。
5. 中断点、申し送り、PJ状態、待ち、TODOを混ぜずに、今日の入口として返す内容を整理する。外部予定も必要なら続けてdailyを1回だけ行う。

`_resume.md`は中断した作業の文脈、journalの`next`は翌日以降への申し送り、TODOは実行項目である。
同じ内容を3か所へ複製しない。再開して中断点が不要になった場合も、ユーザーに確認してから`resume-clear`する。

## 使うもの

- **外部の予定・タスク**: 接続済みコネクタ（Googleカレンダー・Gmail 等）から**その場で参照**する。全文はローカルに保存しない。
- **ローカル TODO**: `secretary/inbox/todo.md`（クイックキャプチャ）。ここはコミット対象。
  - TODO の追記は決定的シームを使う: `${CLAUDE_PLUGIN_ROOT}/scripts/workspace-tools.sh todo-add <secretary> "<本文>" "<根拠>" [期限]`（期限は任意）。
  - 一覧は `workspace-tools.sh todo-list <secretary>`。
  - 完了は `workspace-tools.sh todo-done <secretary> <番号> [--confirm]`、持ち越しは `workspace-tools.sh todo-carry <secretary> <番号> <YYYY-MM-DD> [--confirm]`。どちらも対象を先に見せ、確認後だけ変更する。
- **進行中PJ**: `project-tools.mjs list <secretary>`と各`PROJECT.md`。状態・待ち・次の入口を確認する。実行項目はPJ内へ複製せず、PJ参照つきで上記TODO正本に置く。

## ステップ1: つながっているか見る（未接続でも壊さない）

まずコネクタが使えるかを軽く確かめる（例: 直近の予定を1件読めるか）。

- **つながっている** → ステップ2へ。
- **つながっていない／読めない** → 失敗として扱わず、親切に接続へ案内する。例:
  > いまはまだ予定表につながっていないようです。先に Google をつなぎますか？（設定画面から3分ほどでできます）
  そのうえで接続ガイドを段階ロードする: `${CLAUDE_PLUGIN_ROOT}/skills/setup-google/SKILL.md`。
  接続前でも、ローカル TODO だけで「今ある TODO」は提示できる（できる範囲でお返しする）。

## ステップ2: 予定と TODO を突き合わせる（根拠ルール）

- コネクタから今日〜近日の予定・締切を参照し、ローカル TODO と照らして、その日の要点を作る。
- **各項目に必ず根拠を付ける**: 「**サービス名＋リンク/ID＋日付**」。例: 「（Googleカレンダー / 10:00 打合せ / 2026-07-08）」。
- **原文にない事実を足さない**。推測で予定や締切を作らない。情報が食い違うときは、どちらか一方に決めず**両方をそのまま示す**。
- 迷ったら「確認します」と述べ、断定しない。

## ステップ3: 外部データ本文をローカルに保存しない（同期しない不変条件）

- メール本文・予定の詳細などの**全文をローカルファイルに書き出さない**。キャッシュ・同期コピー・`10_sources` 型の置き場を作らない。
- ローカルに残してよいのは、**ユーザーの TODO** と、**根拠参照（サービス名＋リンク/ID＋日付）** まで。本文が必要なときはその都度コネクタで見る。
- 新しく TODO を足すときは `workspace-tools.sh todo-add`（根拠必須。根拠が無いと追記できない）を使う。
- TODO追加・完了・持ち越しが成功するとjournalへ1回だけ追記される。失敗時はjournalへ残さない。期限が無いTODOも通常どおり扱う。

## ステップ4: routerへ返す内容を整える

- 予定とTODOを突き合わせた事実。
- 優先する項目と、それぞれの根拠。
- ユーザーが選べる次の行動を1つまで。

ここでは内容と安全条件だけをrouterへ返す。通常報告の項目数、prefix、Markdown構造、前後の包装は定義せず、
`plain-language.md` から解決される「最終応答serializer」に任せる。長い一覧は、ユーザーが求めたときだけ内容として返す。

## evening: 今日の締め

1. 今日の絶対日付を使い、`memory-tools.sh timeline <secretary> --from <今日> --to <今日> --type all`で
   当日の活動と決定を確認する。timelineの閲覧だけでは成果物を作らない。
2. `workspace-tools.sh todo-list <secretary>`で未完TODOを確認する。完了・持ち越しは対象を先に見せ、
   ユーザー確認後だけ`todo-done ... --confirm` / `todo-carry ... --confirm`を実行する。各シームがjournalへ1回だけ追記する。
3. 当日のdecisionが0件なら会話を読み返す。決定候補があれば、ルーターとmemory-careの節目プロトコルをそのまま適用する。
   確認ターンは`この内容を決定として残しますね: <そのターンのユーザー入力全文>`という短い確認文だけで止め、ツールを呼ばない。
   次の別ターンで明示的な了承を得た後だけ記録する。
   候補も無ければ「今日は新しい決定はありませんでした」と伝える。
4. 途中の作業を再開する文脈が必要なら`_resume.md`、翌日以降に実行する確定事項ならjournalの`next`、
   実行項目ならTODOを使う。同じ内容を複数へ記録しない。
5. 週次要約は作らない。当日の活動、未完事項、次の入口を内容としてrouterへ返し、出力形は最終応答serializerに任せる。

PJ参照つきTODOを扱う場合も、`PROJECT.md`は状態・待ち・次の入口、`inbox/todo.md`は実行項目の正本として分ける。
完了済みPJは通常の進行中表示へ出さず、明示参照や再開依頼では`projects` skillへ渡して確認する。

外部予定やタスクを振り返る場合も、その場で公式コネクタを参照し、根拠をサービス名＋リンク/ID＋日付で示す。
外部データ本文はローカルに保存しない。

## 参照

- 言葉づかいルール（必読）: `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`
- 未接続のときの接続ガイド: `${CLAUDE_PLUGIN_ROOT}/skills/setup-google/SKILL.md`
- TODO・成果物の決定的シーム: `${CLAUDE_PLUGIN_ROOT}/scripts/workspace-tools.sh`
- プロジェクト操作: `${CLAUDE_PLUGIN_ROOT}/skills/projects/SKILL.md`

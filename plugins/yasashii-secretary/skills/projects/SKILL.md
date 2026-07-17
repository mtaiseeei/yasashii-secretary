---
name: projects
description: >
  営業、マーケティング、新規事業など、複数の行動や別の日へ続く仕事を確認後にプロジェクト化する。
  ライトPROJECT.mdから始め、更新、フル運用への整理、完了、再開、別repo開発PJの参照を安全に扱う。
---

# 継続する仕事を整理する（projects）

`${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を先に読む。通常報告は独自に包装せず、最終出力形は同ruleの
「最終応答serializer」だけを正本とする。

## 1. 候補と作成を分ける

候補検出はLLMによる判断であり、完全自動ではない。次のシグナルを会話から数える。

- 同じ成果に向けた次の行動が2つ以上ある。
- 今日だけで完了せず、別の日・別セッションへ続く。
- 締切、待ち状態、関係者がいる。
- 判断や成果物が今後も増える。
- 別の会話で同じ案件が繰り返し登場する。

少なくとも2つがあり、そのうち1つが「複数行動」または「複数セッション」のときだけ候補にする。
単発成果物、同じ会話で完了する作業、一つだけのTODOには提案しない。
判定の確認には、副作用のない次のコマンドを使える。

```text
node ${CLAUDE_PLUGIN_ROOT}/scripts/project-tools.mjs candidate-check --multiple-actions --multiple-sessions
```

同じ案件名が分かっている場合は、通常の候補提案より先に既存PJを照合する。

```text
node ${CLAUDE_PLUGIN_ROOT}/scripts/project-tools.mjs candidate-check <secretary> <project> \
  --multiple-actions --repeated-topic
```

結果の `route` が `existing-project` なら新規作成せず既存PJへ続ける。`reopen` なら新規候補として
提案せず、「このプロジェクトを再開しますか？」と確認する。該当PJがなく `create-project` の場合だけ、
新規プロジェクトとしてまとめるかを確認する。この照合もファイルを変更しない。

候補になったら理由を1〜2点に絞り、構造化質問で次を確認する。

> この内容は今後も続きそうです。プロジェクトとしてまとめますか？

選択肢は「まとめる／今回はまとめない」。確認前、拒否、キャンセルではprojectファイル、journal、
commit、remoteを変更しない。`candidate-check`もファイルを変更しない。

## 2. 一般プロジェクトはライト運用から始める

営業、マーケティング、新規事業、採用、研修、契約準備等は、了承後だけ同じprivate workspaceの
`secretary/projects/<project>/PROJECT.md` を正本にする。作成前に、プロジェクト名、概要、ゴール、
成功の測り方、現在の状況、次の入口、要確認事項を短く確認する。

```text
node ${CLAUDE_PLUGIN_ROOT}/scripts/project-tools.mjs create-light <secretary> <project> \
  --overview "<誰のために何をするか>" --goal "<終了条件>" --success "<成功の測り方>" \
  --current "<現在の状況>" --next "<次の入口>" --questions "<要確認事項>" --confirm
```

`--confirm`はユーザーが別ターンまたは構造化質問で明示了承した後だけ付ける。コマンドは安全な名前、
既存同名PJ、空入力、資格情報、境界外path、symlinkを検査し、空テンプレや部分生成を残さない。

進行中一覧は `project-tools.mjs list <secretary>`、完了済みを含む一覧は `list <secretary> --all`、
再開時の状態確認は `show <secretary> <project>` を使う。`status`欠落はactiveとして扱う。

## 3. 状態・判断・事実・タスクを混ぜない

- 状態、待ち、次の入口は `PROJECT.md`。
- 確認済みのPJ固有判断は、ライトのDecisionsまたはフルの `DECISIONS.md`。
- 恒久的な事実は、ライトのメモまたはフルの `MEMORY.md`。
- 実行タスクは `secretary/inbox/todo.md` または接続済みサービス。PJ内に生きた `TODO.md` を作らない。
- PJ固有の本文を一般 `memory/decisions/` や `memory/topics/` へ複製しない。

判断は原文を示して確認した後だけ、現在状況と次の入口も同じ操作で更新する。

```text
node ${CLAUDE_PLUGIN_ROOT}/scripts/project-tools.mjs add-decision <secretary> <project> \
  --decision "<確認済み判断>" --current "<判断後の現在状況>" --next "<次の入口>" --confirm
```

未確定事項はDecisionsへ入れず、PROJECT.mdの要確認事項として扱う。恒久事実の追加も確認後だけ行う。

```text
node ${CLAUDE_PLUGIN_ROOT}/scripts/project-tools.mjs add-note <secretary> <project> --note "<確認済み事実>" --confirm
```

PJの実行項目は既存TODO正本へPJ参照つきで追加する。

```text
node ${CLAUDE_PLUGIN_ROOT}/scripts/project-tools.mjs add-todo <secretary> <project> \
  --todo "<実行項目>" --source "<サービス名＋リンク/ID＋日付>" [--due YYYY-MM-DD]
```

## 4. 作業文書・確定版・旧版

- 単発成果物は従来どおり `secretary/docs/YYYY/MM/`。
- PJの作業文書はPJ直下: `save-work`。
- 確定成果物は `outputs/`: `save-output`。
- 旧版・backup・superseded文書は `archive/`: `archive-file ... --confirm`。

`save-work` / `save-output` は本文を標準入力から受ける。最新版を判断できない場合は移動せず、
対象を示して確認する。フル運用ではファイル変更と同じ操作でAGENTS.mdの索引も更新される。

## 5. ライトからフルへ整理する

次のいずれかに達したときだけ、その場で昇格を提案する。

1. Decisionsが10件を超えた。
2. メモが10件を超えた、または状態以外の情報でPROJECT.mdが読みにくい。
3. PJ固有のガードレール、確認フロー、読む順序が必要になった。
4. PJ直下の作業ファイルが10件を超えた。

`promotion-status`は状態を読むだけで、ファイルを変更しない。理由を示して構造化質問で
「フル運用へ整理する／今はライトのまま」を確認する。拒否時は何も変更しない。

```text
node ${CLAUDE_PLUGIN_ROOT}/scripts/project-tools.mjs promotion-status <secretary> <project>
node ${CLAUDE_PLUGIN_ROOT}/scripts/project-tools.mjs promote-full <secretary> <project> --confirm
```

承認後だけ `AGENTS.md`（指示・Start here・索引）、`PROJECT.md`（状態）、`DECISIONS.md`（判断）、
`MEMORY.md`（事実）、`CLAUDE.md`（AGENTS.mdへのポインタ）へ分ける。`INDEX.md`は作らない。

## 6. 完了と再開

完了前に対象、完了日、達成した結果、残件を示し、「完了扱いにする／まだ進行中」を確認する。

```text
node ${CLAUDE_PLUGIN_ROOT}/scripts/project-tools.mjs complete <secretary> <project> \
  --result "<達成した結果>" --remaining "<未完・保留・引継ぎ。なければ、なし>" --confirm
```

完了後も同じディレクトリに残し、自動移動・archive・削除をしない。通常の進行中一覧と同一内容への
候補提案からは外すが、検索、timeline、明示参照では見つけられる。

完了済みPJに新しい作業が出ても自動再開しない。「このプロジェクトを再開しますか？」と確認し、
了承後だけ `reopen ... --confirm` を使う。過去の完了記録は消さない。

## 7. 開発プロジェクトはbuildを維持する

「作って」「開発したい」「アプリ／ツールにして」は一般PJへ吸収せず、
`${CLAUDE_PLUGIN_ROOT}/skills/build/SKILL.md` を段階ロードする。

別repoを正本にする場合は、repoの作成、接続、公開範囲を先に確認する。了承後だけworkspace側へ
`AGENTS.md`と概要スナップショットの`PROJECT.md`を作る。

```text
node ${CLAUDE_PLUGIN_ROOT}/scripts/project-tools.mjs create-dev-pointer <secretary> <project> \
  --repo "<正本repo>" --entry "<最初に読むファイル>" --overview "<概要>" \
  --current "<現在状態の短いスナップショット>" --visibility private --confirm
```

このコマンドはrepoやremoteを作成・変更しない。workspace側に実装仕様、判断ログ、Sprint状態、コード、
成果物を複製しない。実作業は正本repoと `harness@yasashii-harness` の導線で行う。

## 成功時だけ残す記録

定義済みproject操作は、成功した事実だけをjournalへ1回記録する。候補、確認前、拒否、失敗は記録しない。
project-toolsはcommit・push・remote変更を行わない。節目commitは既存規約に従い、pushは現在の会話で
その操作への明示指示がある場合だけ行う。
プロジェクト文書には、確認済みの要点だけを残す。会話全文や逐語ログ、資格情報、外部サービス本文は保存しない。

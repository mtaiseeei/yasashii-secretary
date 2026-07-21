---
name: build
description: >
  「〇〇を作って」「開発したい」「アプリ／ツールにして」等のまとまった開発依頼の入口。
  別プラグイン yasashii-harness の導入状態を確認し、未導入なら3コマンドを案内、導入済みなら
  Planner → Generator → Evaluator のループへ接続する。
---

# 開発の入口（build）

「〇〇を作って」「これを実装して」「アプリ／ツールにしたい」といった、まとまった開発依頼を受け取る入口です。
開発そのものは別リポジトリ [mtaiseeei/yasashii-harness](https://github.com/mtaiseeei/yasashii-harness) の
`harness` プラグインが担当します。この秘書プラグインにハーネスやagentsのコピーは同梱しません。

`${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読む。内容・口調・安全条件だけをrouterへ返し、
通常報告を独自に包装しない。最終出力形は同rule入口から解決される「最終応答serializer」だけを正本とする。

## 1. 導入状態を確認する

ホストで `using-harness` または `harness-loop` スキルを利用できるか確認します。
プラグイン一覧や利用可能なスキル一覧で確認できれば導入済みです。

- ローカルの上流checkoutの有無で判定しません。
- このプラグイン内の `harness/` や `agents/` を探しません。
- 未導入をエラー扱いせず、次の3コマンドをそのまま案内します。

## 2. 未導入なら3コマンドを案内する

何を入れるかを先に一言で説明してから、Claude Codeで上から順に実行してもらいます。

```text
# 1. やさしいハーネスの配布元を登録する
/plugin marketplace add mtaiseeei/yasashii-harness

# 2. harness プラグインを入れる
/plugin install harness@yasashii-harness

# 3. 作りたいものを伝えて開始する
/harness <作りたいもの>
```

3つ目の `<作りたいもの>` は、たとえば「予約管理ツールを作りたい」のような短い説明へ置き換えるよう伝えます。
インストール後に再起動を求められた場合は、再起動後に3つ目のコマンドから再開します。

## 3. 導入済みならループへ接続する

`using-harness` を開き、続いて `harness-loop` の手順に従います。進行は正式名称を隠さず、短い役割を添えます。

- **Planner（計画）**: 対象ユーザー、成功条件、範囲を決めてSprint契約にする。
- **Generator（実装）**: Current IDの1 Sprintだけを実装し、回帰チェックを増やす。
- **Evaluator（検証）**: Generatorと分離した立場で実物を動かし、証跡つきで合否を判定する。

進行は「計画→実装→検証」のどこにいるかを示します。Generatorの自己評価だけで完了にせず、
Evaluatorの合格と状態記録まで行います。やさしさを理由に、役割分離、評価閾値、回帰ゼロ許容は緩めません。

## 4. 別repoを正本にする開発プロジェクト

開発PJを別repoに分ける場合も、黙ってrepoやremoteを作らない。作成、接続、公開範囲を確認し、了承後だけ
`${CLAUDE_PLUGIN_ROOT}/skills/projects/SKILL.md` の `create-dev-pointer` を使う。
workspace側は `AGENTS.md` と概要スナップショットの `PROJECT.md` だけを持ち、実装仕様、判断ログ、
Sprint状態、コード、成果物を複製しない。実装と履歴は正本repoで扱う。

## 小さな変更

Harness管理下かどうかを確認し、管理下なら `state.md` と契約に従って直接修正／micro-patch／通常Sprintに分類します。
管理外のtypoや1行の設定変更は、不要に大きなループへしません。

## 参照

- 言葉づかいルール: `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`
- やさしいハーネス: `https://github.com/mtaiseeei/yasashii-harness`
- 導入後の入口: `using-harness` / `harness-loop` / **/harness**

---
name: build
description: >
  「〇〇を作って」「開発したい」「アプリ／ツールにして」等のまとまった開発依頼の入口。
  別プラグイン yasashii-harness 0.5.1 の導入状態を確認し、未導入ならhost別の正式手順を案内、導入済みなら
  Planner → Generator → Evaluator のループへ接続する。
---

# 開発の入口（build）

## plugin root（必須）

このSKILL.mdの実ファイル絶対pathを `SECRETARY_SKILL_FILE` に入れ、最初に1回だけ解決する。
空・相対path・未解決placeholderならcommandへ渡さず停止し、cwdやhost固有の環境変数から推測しない。

```bash
SECRETARY_SKILL_FILE="<このSKILL.mdの実ファイル絶対path>"
case "$SECRETARY_SKILL_FILE" in /*/skills/*/SKILL.md) ;; *) exit 2 ;; esac
SECRETARY_PLUGIN_ROOT="$(node "$(dirname "$SECRETARY_SKILL_FILE")/../../scripts/resolve-plugin-root.mjs" --skill-file "$SECRETARY_SKILL_FILE")" || exit 2
```

以後の共通file参照は `${SECRETARY_PLUGIN_ROOT}` を使う。

「〇〇を作って」「これを実装して」「アプリ／ツールにしたい」といった、まとまった開発依頼を受け取る入口です。
開発そのものは別リポジトリ [mtaiseeei/yasashii-harness](https://github.com/mtaiseeei/yasashii-harness) の
`harness` プラグインが担当します。対応versionは `0.5.1` です。この秘書プラグインにHarnessの
skills、agents、commands、hooks、runtime scriptは同梱せず、暗黙の自動installも行いません。

`${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読む。内容・口調・安全条件だけをrouterへ返し、
通常報告を独自に包装しない。最終出力形は同rule入口から解決される「最終応答serializer」だけを正本とする。

## 1. 導入状態を確認する

ホストで `using-harness` または `harness-loop` スキルを利用できるか確認します。
プラグイン一覧や利用可能なスキル一覧で確認できれば導入済みです。

- ローカルの上流checkoutの有無で判定しません。
- このプラグイン内の `harness/` や `agents/` を探しません。
- 未導入をエラー扱いせず、現在のhostに合う次の手順だけを案内します。

## 2. 未導入ならhost別の正式手順を案内する

何を入れるかを先に一言で説明し、Claude CodeとCodexの識別子を混ぜずに案内します。

### Claude Code

```text
# 1. やさしいハーネスの配布元を登録する
/plugin marketplace add mtaiseeei/yasashii-harness

# 2. harness プラグインを入れる
/plugin install harness@yasashii-harness

# 3. 作りたいものを伝えて開始する
/harness <作りたいもの>
```

Claude CodeではMarketplace `yasashii-harness`、install ID `harness@yasashii-harness` を使います。
`/harness` はClaude Code専用です。

### Codex

```text
# 1. GitHub上の正式Marketplaceを登録する
codex plugin marketplace add mtaiseeei/yasashii-harness

# 2. harness プラグインを入れる
codex plugin add harness@yasashii-harness

# 3. 新しいchat／sessionで開始する
$using-harness <作りたいもの>
```

CodexではMarketplace `yasashii-harness`、install ID `harness@yasashii-harness` を使います。
明示起動は `$using-harness` または `$harness-loop` で、`/harness` は案内しません。

`<作りたいもの>` は「予約管理ツールを作りたい」のような短い説明へ置き換えます。どちらのhostでも、
導入後は通常会話の「〇〇を作って」から起動でき、明示command／skillは必須ではありません。

## 3. 導入済みならループへ接続する

`using-harness` を開き、続いて `harness-loop` の手順に従います。進行は正式名称を隠さず、短い役割を添えます。

- **Planner（計画）**: 対象ユーザー、成功条件、範囲を決めてSprint契約にする。
- **Generator（実装）**: Current IDの1 Sprintだけを実装し、回帰チェックを増やす。
- **Evaluator（検証）**: Generatorと分離した立場で実物を動かし、証跡つきで合否を判定する。

進行は「計画→実装→検証」のどこにいるかを示します。Generatorの自己評価だけで完了にせず、
Evaluatorの合格と状態記録まで行います。やさしさを理由に、役割分離、評価閾値、回帰ゼロ許容は緩めません。

## 4. 別repoを正本にする開発プロジェクト

開発PJを別repoに分ける場合も、黙ってrepoやremoteを作らない。作成、接続、公開範囲を確認し、了承後だけ
`${SECRETARY_PLUGIN_ROOT}/skills/projects/SKILL.md` の `create-dev-pointer` を使う。
workspace側は `AGENTS.md` と概要スナップショットの `PROJECT.md` だけを持ち、実装仕様、判断ログ、
Sprint状態、コード、成果物を複製しない。実装と履歴は正本repoで扱う。

## 小さな変更

Harness管理下かどうかを確認し、管理下なら `state.md` と契約に従って直接修正／micro-patch／通常Sprintに分類します。
管理外のtypoや1行の設定変更は、不要に大きなループへしません。

## 参照

- 言葉づかいルール: `${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md`
- やさしいハーネス 0.5.1: `https://github.com/mtaiseeei/yasashii-harness`
- Claude Codeの入口: 通常会話 / `/harness`
- Codexの入口: 通常会話 / `$using-harness` / `$harness-loop`

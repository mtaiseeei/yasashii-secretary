# はじめ方（インストールと初回体験）

## インストール（3コマンド）

Claude Code で、上から順に実行します。各コマンドの前に「今から何をするか」を書いています。

```text
# 1. このプラグインの配布元を登録する
/plugin marketplace add mtaiseeei/yasashii-secretary

# 2. yasashii-secretary プラグインを入れる
/plugin install yasashii-secretary@yasashii-secretary

# 3. 秘書を呼ぶ（初回はセットアップが始まります）
/secretary
```

## 初回のセットアップ（やさしい数問）

初めて `/secretary` を実行すると、次のような**やさしい数問**だけ聞かれます。

1. **呼び方**: あなたを何とお呼びすればよいか（決めていなければ「おまかせ」でも大丈夫）。
2. **主に使うサービス**: Google／Microsoft／まだ決めていない、から選ぶ（あとで変えられます）。
3. **任せたいこと**: 今日やることの整理／調べもの・下書き／記憶の管理 など（複数OK）。

答えると、いまいるフォルダの中に**秘書ディレクトリ**（`secretary/`）ができます。中にはこんなものが入ります。

```
secretary/
├── AGENTS.md      ← 秘書への指示（守るルール）
├── CLAUDE.md      ← AGENTS.md への案内
├── inbox/         ← 走り書き・TODO
├── docs/          ← できあがった文書の置き場
├── projects/      ← 進行中の案件
└── memory/        ← 記憶（目次・決めたこと・好み）
```

最後に、1つの非公開のGitHubリポジトリを作り、最初のコミットと初回pushまで進めます。既存remoteがある場合は、別のリポジトリを作る前に現在のリポジトリを使うか確認します。Chatwork／Google Chatは、あとから選んだ対象だけをこのリポジトリへ保存します。

## つぎの一歩

セットアップが終わったら、ふつうに話しかけるだけです。例:

- 「今日やることを教えて」
- 「〇〇を覚えておいて」／「前回の続き」
- 「Google につなぎたい」
- 「Chatworkにつなぎたい」または `/chatwork`
- 「〇〇を作って」（開発）

うまくいかないときは、秘書が「何が起きて・どうすれば直るか」を日常語で案内します（英語のエラーはそのまま出しません）。

## 0.13.1 source candidateについて

`0.13.1`では、`0.13.0`で停止し得たworkspace migrationの到達性、未変更sessionの回復、Windows CRLF配布assetの照合を修正します。Project Clarityの既存機能と、Hook通知や生成された指示を利用者の新しい承認として扱わない境界は維持します。

公開後の状態は[やさしい秘書 0.13.1 Release](https://github.com/mtaiseeei/yasashii-secretary/releases/tag/v0.13.1)で確認してください。source candidate、Release、installed plugin、新しいsessionでの読み込みは別々に確認します。

## 作り直したいとき（保護あり）

すでに秘書ディレクトリがある状態で「もう一度セットアップ」「作り直したい」と言うと、
**いきなり作り直さず**、バックアップの提案と確認をしてから進めます。今の記憶を無確認で上書きすることはありません。

# yasashii-secretary — 非エンジニア向けAI秘書

**非エンジニア向けのAI秘書プラグイン**（Claude Code plugin / public / MIT）。
外部データ（メール・予定・ファイル）は各サービスに置いたまま公式コネクタで都度参照し、
記憶と成果物だけをローカルの**秘書ディレクトリ**（`secretary/`）に置いて、節目ごとに自動でコミット（作業の区切りを記録）します。

---

## まず使ってみる（受講者・非エンジニア向け）

### これは何？

あなた専属のAI秘書です。次のことができます。

- 決めたこと・好みを**覚えて守る**（うっかり消さない・前回の続きから再開できる）。
- 予定とTODOを突き合わせて**今日やること**を根拠つきで返す。
- 日次journal原本から**今週を振り返り**、古い月も確認してから安全に退避できる。
- Gmail・カレンダー・Outlook・Notion などに**公式コネクタでつなぐ**（設定画面のボタン操作だけ）。
- 「〇〇を作って」で、別プラグイン `yasashii-harness` の計画→実装→検証へ接続する。

考え方はシンプルです。**データは各サービスに置いたまま参照し、秘書の記憶と成果物だけがローカルに残る**。
インターネットへ勝手に送信（push）はしません。

### 入れ方（3コマンド）

Claude Code で、上から順に実行します。各コマンドの前に「今から何をするか」を書いています。

```text
# 1. このプラグインの配布元を登録する
/plugin marketplace add mtaiseeei/yasashii-secretary

# 2. yasashii-secretary プラグインを入れる
/plugin install yasashii-secretary@yasashii-secretary

# 3. 秘書を呼ぶ（初回はセットアップが始まります）
/secretary
```

### 初めての一歩

`/secretary` を初めて実行すると、**5問以内**（呼び方・主に使うサービス・任せたいこと・仕事や役割・説明の詳しさ）だけ聞かれます。
答えると、いまいるフォルダの中に**秘書ディレクトリ**（`secretary/`）ができ、秘書・通常のproject・Chatwork設定をまとめる1つのprivate GitHub repoへ初回pushします。
口調は丁寧な標準設定で始まり、あとから「設定変えたい」で変更できます。
あとは「今日やること」「〇〇を覚えておいて」「Google につなぎたい」などと話しかけるだけです。

### できること（今できる機能）

| やりたいこと | 呼び方の例 | 担当スキル |
|---|---|---|
| 初回セットアップ | `/secretary`（初回） | onboarding |
| 用件のふりわけ（窓口） | `/secretary` | secretary |
| 覚える・守る・前回の続き | 「覚えて」「消して」「前回の続き」 | memory-care |
| 今日やること | 「今日やること」「予定」「TODO」 | daily |
| 自分に合わせる設定 | 「設定変えたい」「もっとフランクに」「呼び方を変えて」 | settings |
| 今週のふりかえり・古い月の整理 | 「今週を振り返って」「古い月を整理したい」 | weekly |
| Google 接続 | 「Google につなぎたい」 | setup-google |
| Microsoft 接続 | 「Microsoft につなぎたい」 | setup-microsoft |
| Notion 接続（任意） | 「Notion につなぎたい」 | setup-notion |
| Chatwork 接続・room選択・履歴検索 | `/chatwork`「Chatworkで探して」 | chatwork |
| 接続の状態を診断 | 「繋がってる？」「診断して」 | connections |
| 開発の入口（作って） | 「〇〇を作って」「開発したい」 | build |

### まだできないこと（今後）

- LINE等の未対応チャットは今後の検討対象です。Chatworkは、API TokenをGitHub ActionsのRepository Secretへ登録し、選択したroomだけを同じprivate repoへ保存できます。
- Notion は**任意**です。使わない人は繋がなくても、他の機能は普通に使えます。

くわしい使い方は [`docs/guide/`](docs/guide/README.md)（公開向けの使い方ドキュメント）を見てください。

---

## 仕組みと設計（リポジトリを覗く技術者向け）

### 設計思想: 「データは外・秘書はローカル」

| レイヤー | 置き場 | アクセス |
|---|---|---|
| 外部データ（メール・予定・ファイル） | 各SaaSのまま | 公式リモートコネクタで都度参照（同期しない） |
| 秘書の記憶（決定・好み・進行中案件） | ローカル `secretary/memory/` | 直接読み書き＋ローカル自動コミット |
| 成果物（文書の正本） | ローカル `secretary/docs/` | 直接読み書き＋ローカル自動コミット |

- 外部データのローカル同期層（キャッシュ・全文コピー）は作りません。根拠は「サービス名＋リンク/ID＋日付」で引用します。
- 自動コミットは**ローカルのみ**。push はユーザーが明示したときだけです。
- 記憶の書き込み・削除は `secretary/` 配下に**封じ込め**（境界外・symlink 越えは拒否）、秘密情報らしきファイルは**コミットしない**設計です。

### 構成

```
yasashii-secretary/                         ← public / MIT
├── .claude-plugin/marketplace.json   ← 配布元（forkedFrom で元作者をクレジット）
├── plugins/yasashii-secretary/        ← プラグイン本体（薄いルーター＋機能スキル）
│   ├── skills/                       ← secretary(ルーター)/onboarding/memory-care/daily/settings/weekly/chatwork/
│   │                                    setup-google/setup-microsoft/setup-notion/connections/build
│   ├── rules/plain-language.md       ← 言葉づかいルール（既定3行・明示設定・語彙方針の一元定義）
│   ├── templates/                    ← 秘書ディレクトリの雛形（`${CLAUDE_PLUGIN_ROOT}` 相対で参照）
│   └── scripts/                      ← 決定的シーム（成果物保存・TODO・封じ込めガード）
├── docs/guide/                       ← 公開向け使い方ドキュメント（この README の続き）
└── docs/（spec・DESIGN・sprints・progress・feedback）← 開発内部ドキュメント
```

- SKILL は薄いルーター＋段階ロード。起動時に全機能を読み込みません。
- 開発機能は別リポジトリ [mtaiseeei/yasashii-harness](https://github.com/mtaiseeei/yasashii-harness) が担当します。本体にはハーネスやagentsを同梱せず、`build` は導入確認と接続案内だけを行います。
- 設計方針の正本は [`docs/DESIGN.md`](docs/DESIGN.md)、実装可能仕様は [`docs/spec/`](docs/spec/)、開発ループの契約は [`docs/sprints/`](docs/sprints/) にあります（開発内部）。

### 開発（やさしいハーネス）

「〇〇を作って」と言うと、`build` スキルが `yasashii-harness` の有無を確認します。未導入なら次の3コマンドを案内し、導入済みなら**計画→実装→検証**のループ（Planner → Generator → Evaluator）に接続します。

```text
/plugin marketplace add mtaiseeei/yasashii-harness
/plugin install harness@yasashii-harness
/harness <作りたいもの>
```

このループは [mtaiseeei/agentic-harness](https://github.com/mtaiseeei/agentic-harness) を上流とする別プラグインです。
非エンジニアには「いま計画→実装→検証のどこにいるか」を見せながら進めます。裏側の契約（docs/spec・sprint・rubric）は
AI が理解しやすいよう技術的文脈のまま維持しています。

### ライセンスとクレジット

- ライセンス: **MIT**（[LICENSE](LICENSE)）。
- 元作者: **[Shin-sibainu/cc-company](https://github.com/Shin-sibainu/cc-company)（MIT）**。導線（3コマンドインストール・オンボーディング・記憶保護）の発想を継承しています。
  `marketplace.json` の `forkedFrom` にも明記しています。

### ゆるAIコーディング塾 第2期への導線

本プラグインは「ゆるAIコーディング塾」第2期の目玉として配布します。第1回座学の実況語彙
（**計画→道具→確認→結果**）と接続し、非エンジニアが「いま何が起きているか」を見ながら使える体験を目指しています。
カリキュラムの詳細・教材は塾側で提供します（本リポジトリには一般的な導線のみ。個別の教材内容は含みません）。

---

## 参考

- 使い方（公開向け）: [`docs/guide/`](docs/guide/README.md)
- 設計方針: [`docs/DESIGN.md`](docs/DESIGN.md)
- 詳細仕様: [`docs/spec/`](docs/spec/)

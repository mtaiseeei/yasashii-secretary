---
createdAt: 2026-07-08 00:30
tags:
  - Claude
  - AI
  - 開発
  - ドキュメント
status: draft
related:
  - "[[2026-07-02_Google_Classroom運用]]"
---

# スーパー秘書プラグイン設計方針（cc-company × my-vault 融合）

ゆるAIコーディング塾 第2期以降の目玉コンテンツとして配布する、非エンジニア向けAI秘書プラグインの設計方針。
`workspace/inbox/company`（bootcamp-company / cc-companyフォーク）の分析と、my-vault の運用実績をもとに、村山さんへのヒアリングで確定した内容を正本化する。

## 確定した意思決定（2026-07-07〜08 ヒアリング）

- 配布対象は **ゆるAIコーディング塾の受講者**（非エンジニア30〜60代、標準環境はClaudeデスクトップアプリ、第1回でGit/GitHub習得済み）
- 提供時期は **第2期以降の目玉コンテンツ**（第1期 8/3 終了後に開発期間あり）
- 外部データは **公式リモートコネクタ優先**。第一級サポートは **Google系（Gmail/Calendar/Drive）とMicrosoft系** の両対応
- **10_sources型のローカル同期層は持たない**（GitHub Actions非依存）。ただし記憶と成果物はローカルに置く
- 成果物（企画書・調査まとめ等）の**正本はローカル**
- **Gitは必須**。秘書が節目ごとに**ローカル自動コミット**（pushはしない＝プライバシー懸念なし）
- メタファーは **「秘書＋道具箱」**。cc-companyの部署制・キーワード振り分け表・部署間inbox通知は採用しない
- 開発機能は **agentic-harnessを複製し、非エンジニア向けに平易化したフォークを同梱**（現行 `workspace/agentic-harness` は変更しない）
- 公開範囲は **public + MIT**（cc-companyのクレジット表記を継承）
- 秘書の作業フォルダは **見えるフォルダ・英語名**（my-vault風）
- プラグイン名は **secretary軸**で「開発もできるスーパー秘書」の方向。仮称 `super-secretary`

## アーキテクチャの基本原則

**「データは外に置いたまま、秘書だけがローカルに住む」**

| レイヤー | 置き場 | アクセス方法 |
|---|---|---|
| 外部データ（メール・予定・ファイル・タスク） | 各SaaSのまま | 公式リモートコネクタで都度参照。同期しない |
| 秘書の記憶（決定・好み・進行中案件） | ローカル `secretary/memory/` | 直接読み書き＋自動コミット |
| 成果物（文書の正本） | ローカル `secretary/docs/` | 直接読み書き＋自動コミット |

my-vault の GitHub Actions が担っていた「検索可能性の事前確保」を、コネクタのAPI検索に置き換える。
my-vault から持ち込むのは**インフラではなく規律**（スコープ表・根拠ルール・出力規約・スキル分割）。
cc-company から持ち込むのは**導線**（3コマンドインストール・オンボーディング・再起動しおり・記憶保護）。

## 生成されるワークスペース構造

```
secretary/                  ← 秘書の家（初回セットアップで git init）
├── AGENTS.md               ← 指示の正本（スコープ・根拠・出力規約・記憶保護）
├── CLAUDE.md               ← AGENTS.md へのポインタのみ
├── inbox/                  ← 走り書き・下書き・クイックキャプチャ
├── docs/                   ← 成果物の正本（YYYY/MM/YYYY-MM-DD_<title>.md）
├── projects/               ← 進行中案件ごとのフォルダ（軽量。案件指示はAGENTS.md）
└── memory/
    ├── MEMORY.md           ← 記憶の目次（1行索引。cc-companyから継承）
    ├── decisions/          ← 決定ログ（YYYY-MM-DD-decisions.md）
    └── preferences.md      ← オーナーの好み・口調・環境情報
```

- `10_sources/` に相当する層は存在しない。外部データの根拠は「サービス名＋URL/ID＋日付」で引用する
- cc-companyの `experience/case-NNN` 必須生成・`patterns/` 自動統合は廃止。振り返り・パターン化は「振り返りして」で起動するオンデマンドスキルに変更

## 生成される AGENTS.md に入れる規律（my-vaultからの移植）

1. **スコープ表**: 秘書は `secretary/` 配下だけ読み書きする。外は明示指示時のみ。資格情報は常時禁止
2. **根拠ルール**: 要約・判断にはコネクタ由来の根拠（サービス名・リンク・日付）を明示。原文にない事実を補完しない。矛盾は両方提示
3. **出力規約**: `YYYY-MM-DD_<title>.md`、frontmatter必須（createdAt/tags）、1ファイル1トピック、見出しに固有名詞
4. **記憶保護**（cc-company継承）: 空内容で上書きしない。削除前に警告。MEMORY.md索引を常に最新に
5. **自動コミット**: 作業の節目ごとに日本語メッセージでローカルcommit。pushはユーザーの明示指示時のみ
6. **報告の型**: 3行以内・専門用語は言い換え併記・次に何が起きるかを一言

## プラグイン構成（配布リポジトリ）

```
<repo>/                                  ← public / MIT
├── .claude-plugin/marketplace.json
├── plugins/super-secretary/
│   ├── .claude-plugin/plugin.json
│   ├── skills/
│   │   ├── secretary/SKILL.md           ← 薄いルーター（起動・モード判定のみ）
│   │   ├── onboarding/                  ← 初回3問＋ワークスペース生成＋git init
│   │   ├── setup-google/                ← コネクタ接続ガイド＋接続確認テスト
│   │   ├── setup-microsoft/
│   │   ├── memory-care/                 ← 記憶の保護・復元・オンデマンド振り返り
│   │   ├── daily/                       ← 今日やること・TODO・予定の突き合わせ
│   │   └── build/                       ← 開発依頼の入口（やさしいハーネスへ接続）
│   ├── agents/                          ← planner/generator/evaluator のやさしい版
│   └── rules/plain-language.md          ← 報告3行型・日常語彙のルールファイル
├── templates/                           ← ワークスペース雛形（AGENTS.md等）
└── docs/                                ← 公開向け使い方ドキュメント
```

- cc-companyの936行単一SKILL.mdは分割し、段階ロードにする（SKILL.mdは薄く、必要時に個別スキル）
- インストール導線は cc-company と同じ3コマンド（marketplace add → install → /secretary）を維持

## やさしいハーネス（agentic-harnessの平易化フォーク）

`workspace/agentic-harness` を複製して同梱。**元は変更しない**。平易化の3点：

- **Plannerのヒアリング日常語化**: 質問と選択肢を日常語＋具体例つきに（「認証方式は？」→「見る人を制限しますか？ 誰でも見られる／合言葉を知っている人だけ」）
- **報告の型を固定**: 各エージェントの報告を「3行以内・専門用語は言い換え併記・次に何が起きるかを一言」にするルールファイルを全エージェントから参照
- **進行の見せ方**: 「いま計画→実装→検証のどこにいるか」を毎回宣言。第1回座学の実況語彙（計画・道具・確認・結果）と接続

裏側の docs/spec・sprint契約などは技術的文脈のまま維持（AIの理解しやすさを優先）。

## コネクタ設計

- 第一級: claude.ai公式コネクタ（Gmail / Google Calendar / Google Drive / Microsoft 365）。デスクトップアプリの設定画面からOAuth自動 → cc-companyのGoogle Cloud Console手作業がほぼ消える
- 任意: Notion（mcp.notion.com、OAuth自動）
- 見送り（初期）: Chatwork・LINE等の国内チャット（公式リモートMCPがなく自作ラッパーが必要）
- cc-companyから継承する運用知: 再起動しおり（`_resume.md`）プロトコル、「実エラーで原因確定してから案内」の診断手順

## 開発フェーズ案

1. **Phase 1（秘書コア）**: onboarding / memory / daily / 出力規約 / 自動コミット / setup-google
2. **Phase 2（接続拡張）**: setup-microsoft / Notion / 接続診断
3. **Phase 3（開発機能）**: agentic-harness平易化フォークの統合・build スキル
4. **Phase 4（公開整備）**: README・docs・クレジット表記・第2期カリキュラムへの組み込み

## 参照

- 分析対象: `~/workspace/inbox/company`（inoshinichi/bootcamp-company、Shin-sibainu/cc-company のフォーク、MIT）
- 複製元ハーネス: `~/workspace/agentic-harness`
- 講座前提: [[PROJECT]]（vault/02_pj/open/ゆるAIコーディング塾/）、標準環境はD-034（Claudeデスクトップアプリ）

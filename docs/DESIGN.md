---
createdAt: 2026-07-08 00:30
updatedAt: 2026-07-20
tags:
  - Claude
  - AI
  - 開発
  - ドキュメント
status: approved
---

# やさしい秘書プラグイン設計方針（yasashii-secretary）

Claude Codeを使う非エンジニア一般へ配布する、AI秘書プラグインの設計方針。

> **2026-07-15 方針転換の扱い**
> `docs/proposal-2026-07-15-realignment.md` が本作業の唯一の引き継ぎ正本である。
> 本文はその承認事項を恒久設計へ反映したもの。実装・評価の詳細正本は `docs/spec/` と sprint 契約に置く。
>
> **2026-07-16 Chatwork追加方針**
> ユーザーが承認したsingle-repo Git-first + Chatwork方針は `docs/spec/` を追加正本とし、
> 本文の旧「外部同期なし・ローカルだけ・Web UIなし・pushなし」と衝突する箇所を上書きする。
>
> **2026-07-20 edition分離方針**
> 技術者向け `agentic-secretary` を上流、非エンジニア向け `yasashii-secretary` を下流とする。
> 共通path、Git系譜、互換、overlayの詳細正本は `docs/spec/editions.md` とSprint 029〜035である。
>
> **2026-07-20 次release candidate方針**
> `0.7.0` のrelease記録は不変とし、まだ利用者へ明示配布していない2 editionの最初のcandidate／latestを `0.8.0` とする。
> 既存0.7.0利用者向けexternal recovery／bootstrapは作らず、旧scanner blockerを偽fixtureや安全scan弱体化で隠さない。
> same-version bridgeは採用せず、同一versionとdowngradeは副作用0件で停止する。
>
> **2026-07-20 会話可読性方針**
> 両editionの全ユーザー会話は、必要な改行・段落・Markdown箇条書きを必須とする。好みは質問せず、
> agentic／yasashiiの思想・対象差を維持したままRepo分割前の共通正本へ実装する。

## 確定した意思決定

- 配布対象はClaude Codeを使う非エンジニア一般。年齢、特定の講座・教材の経験、Git / GitHubの習熟を前提にしない。標準環境は Claude デスクトップアプリ／Claude Code。
- 非エンジニア向けeditionの製品名・local repo・remote repo・外部プラグイン名は **`yasashii-secretary`**。技術者向けeditionは別directory／別repo／別外部IDの **`agentic-secretary`** とし、内部plugin pathだけを共通化する。
- `0.7.0` のmanifest、migration、fixture、評価記録、Git履歴は変更しない。まだ明示配布していない完成品の最初のcandidate／latestを `0.8.0` で揃え、新規導入、portable gate、equal／downgrade停止を公開準備にする。旧0.7.0 live updateを未検証のまま保証しない。
- 全会話は、1要点なら自然な段落、複数要素なら空行付き段落またはMarkdown箇条書きにする。改行は好みとして質問せず、3行報告を1行へ連結しない。
- ChatworkのGitHub Actions Secret案内は `Name` 欄=`CHATWORK_API_TOKEN`、`Secret` 欄=本人が公式画面で取得したAPI Tokenと具体的に示し、実値をwizard／会話へ貼らせない。
- 秘書の記憶・成果物、通常のプロジェクト開発、選択したChatwork room履歴は、1つのprivate GitHub repoでGit管理する。Chatwork専用repoへ分離しない。
- Chatworkと明示設定済みGoogle ChatだけはRepository SecretとGitHub Actionsによる同期を許可する。その他のGoogle / Microsoft等は公式リモートコネクタで都度参照し、同期層を持たない。
- 初回private repo作成・初回pushと、設定時に同意したChatwork schedule pushを製品フローに含む。それ以外の予期しないpushは実行前に確認する。
- メタファーは「秘書＋道具箱」。部署制・キーワード振り分け・部署間inbox通知は採用しない。
- やさしいハーネスは**同梱しない**。別リポジトリ **`yasashii-harness`** を正本とし、`yasashii-secretary` はインストール案内と接続導線だけを持つ。
- `mtaiseeei/yasashii-harness` は GitHub fork ではない**独立public downstream repo**とし、`fork=false`、fb9c303を初期基点にする。
- downstreamの書込先は `origin=mtaiseeei/yasashii-harness`、読取専用の上流は `upstream=mtaiseeei/agentic-harness` とする。親repoは移管・改名・変更しない。
- `~/workspace/agentic-harness` は**全面操作禁止**。編集、checkout、commit、branch、remote変更、生成物作成、複製元利用、当該checkoutを対象にしたコマンド実行を行わない。追随元はGitHub上の `upstream` remoteだけとする。
- public + MIT、Shin-sibainu/cc-company の単段クレジットを継承する。
- 一般技術用語はそのまま使い、過度な平易化や幼稚なメタファーは避ける。

## アーキテクチャの基本原則

**「1つのprivate GitHub repoに、秘書・開発・Chatworkの文脈をまとめる」**

| レイヤー | 置き場 | アクセス方法 |
|---|---|---|
| Chatwork | 同じprivate GitHub repo | 選択roomだけをRepository Secret + GitHub Actionsで同期 |
| その他の外部データ | 各SaaS | 公式コネクタで都度参照。同期しない |
| 秘書の記憶 | `secretary/memory/` | 保護されたシームで読み書きし、自動コミット |
| 成果物 | `secretary/docs/` | 同じrepoの正本として保存し、自動コミット |
| 開発ハーネス | 別repo `yasashii-harness` | buildから存在確認・案内・接続 |

my-vault から持ち込むのはインフラではなく、スコープ・根拠・出力・記憶保護・スキル分割の規律。
cc-company からは3コマンド導入、オンボーディング、再起動しおり、記憶保護を継承する。

## 製品テーマ

1. **G1【最優先】**: 相談・活動・決定が普段の対話と定義済みシームから三層で蓄積され、`timeline` で時系列に見える。
2. **G2【次点】**: `settings` と `preferences.md` v2 により、役割・言葉遣い・詳しさ・確認方法を途中でも変えられる。
3. **G3**: `yasashii-harness` を別repo正本として上流へ追随し、overlayと独自回帰で健全性を守る。
4. **G4**: やさしさはユーザーに見える面に適用し、規律・3 Agent分離・評価閾値・回帰ゼロ許容は緩めない。
5. **G5**: 1つのprivate repoで秘書・開発・Chatworkを扱い、room選択wizardとGitHub Actions同期から検索までを一続きにする。

## 生成されるワークスペース

```text
<private-workspace-repo>/
├── <通常のプロジェクトファイル>
├── secretary/
│   ├── AGENTS.md
│   ├── CLAUDE.md
│   ├── inbox/todo.md
│   ├── docs/YYYY/MM/
│   ├── projects/
│   └── memory/
│       ├── MEMORY.md
│       ├── preferences.md
│       ├── decisions/
│       ├── journal/
│       ├── topics/
│       └── _resume.md
├── <Chatworkの設定・状態・履歴>
└── <GitHub Actionsの同期設定>
```

- `MEMORY.md` は200行以内の索引。journalは月単位に畳み、topicsを索引対象にする。
- 決定、活動、相談文脈を混ぜない。journalは追記専用、decisionsは純追加で変更履歴を残す。
- `_resume.md` は作業の中断点、journalの `next` は翌日への申し送り。
- 詳細は `docs/spec/domain.md` を正本とする。

## 生成される AGENTS.md の6規律

1. **スコープ**: `secretary/` 配下だけを既定の読み書き対象にする。資格情報は常時禁止。
2. **根拠**: 外部データはサービス名・URL/ID・日付を示し、原文にない事実を補完しない。
3. **出力**: `YYYY-MM-DD_<title>.md`、frontmatter、1ファイル1トピック、固有名詞見出し。
4. **記憶保護**: 空上書き禁止、削除2段階、索引追従、封じ込め。
5. **Git履歴**: 節目で日本語1行のcommit。初回push・同意済みChatwork schedule以外の予期しないpushは確認する。
6. **報告**: 既定は3行。3つの意味を物理的にも別行または別項目で表示する。preferencesで「くわしく」が明示された場合だけ3行＋補足1つ。3行目は可能なら次の一手を1つ提案する。

## 配布リポジトリの構成

```text
<secretary-edition-repo>/
├── .claude-plugin/marketplace.json
├── plugins/secretary/
│   ├── .claude-plugin/plugin.json
│   ├── skills/
│   │   ├── secretary/
│   │   ├── onboarding/
│   │   ├── memory-care/
│   │   ├── daily/             # morning / daily / evening の3モードを統合
│   │   ├── settings/
│   │   ├── weekly/
│   │   ├── setup-google/
│   │   ├── setup-microsoft/
│   │   ├── chatwork/
│   │   └── build/
│   ├── wizard/chatwork/
│   ├── scripts/
│   ├── templates/
│   └── rules/              # 共通安全・証拠とedition styleを分離
├── plugins/yasashii-secretary/CHANGELOG.md  # 旧0.7.0が0.8.0を読めるraw互換file（yasashii側）
├── docs/
└── README.md
```

`plugins/*/harness/`、`plugins/*/agents/`、ハーネスのsource baselineは置かない。
SKILLは薄いルーターと段階ロードを維持し、配布されない開発docsへのデッドリンクを作らない。

## やさしいハーネスの別リポジトリ設計

`yasashii-harness` が所有するもの:

- Planner / Generator / Evaluator のやさしい版 agents 3種。
- `gentle-overlay/` の追加セクション断片とアンカー。
- `gentle-overlay/metadata-overrides.json` の配布識別metadata overlay兼allowlist。
- 上流merge後のsync健全性検査と独自回帰。
- 上流との差分、未分類の追加・削除ファイル、アンカー不在を検出する仕組み。

remote topology（接続関係）の正本:

```text
origin   https://github.com/mtaiseeei/yasashii-harness.git   # downstreamの書込先
upstream https://github.com/mtaiseeei/agentic-harness.git    # 上流同期用・読取専用
initial baseline: fb9c303
GitHub API: full_name=mtaiseeei/yasashii-harness, private=false, fork=false
```

本文・スキル・agents・runtimeロジックのやさしさ差分は、見出しに `yasashii` を含む追加セクションだけ。上流由来の実装行を書換・削除しない。
機械的例外は配布識別metadataだけとする。marketplaceは `name=yasashii-harness`、`repository=mtaiseeei/yasashii-harness`、pluginは `name=harness` を維持し、`source=./plugins/harness`、plugin manifestの `repository` / `homepage` は `https://github.com/mtaiseeei/yasashii-harness`、必要なCodex marketplace識別子は同じ配布元へ揃える。これらは `gentle-overlay/metadata-overrides.json` に対象ファイル・field・期待値を宣言する。
上流HEADの前進は巻き取り候補の警告であり、それだけで回帰失敗にしない。
取り込み済み上流＋overlayの合成結果と一致しない場合、metadata期待値が一致しない場合、allowlist外の上流行変更、または未分類ファイルがある場合は失敗にする。

`yasashii-secretary` の build は、`yasashii-harness` が導入済みなら接続し、無ければ `/plugin install harness@yasashii-harness` を含む、非エンジニアが実行できる3コマンドを案内する。
regression section 12 は、案内と同梱不在のoffline構造検査に加え、GitHub APIでrepo実在、public、`fork=false`、owner/name、remote manifestのmarketplace `name` / `repository`、plugin `name` / `source` / `repository` / `homepage` と3コマンドの整合を検査する。ネットワーク不可はremote健全性のPASSにせず、offline構造検査の結果とEvaluatorのonline証跡を分けて報告する。

GitHubのfork badge、parent relation、同じforkから上流へPRする導線は非ゴール。上流変更は本作業のスコープ外であり、将来あらためて明示承認された場合だけ `agentic-harness` 側の別branch / PR手順に分離する。

## パーソナライズの設計

- 初回は5問以内。仕事・役割と説明の詳しさを含めるが、口調は聞かず標準で始める。
- 途中変更は `settings` からいつでも再入可能。適用前に例文、適用後に記憶内容を宣言する。
- `preferences.md` は「基本／言葉遣い／口調のお手本／秘書のメモ」のv2構造。
- 規律と既定値を共通の第1部、preferencesによる明示上書きを第2部として分ける。
- 濃いキャラクタープリセットは同梱しない。

## やさしさの実装面

| 要素 | 主な置き場 |
|---|---|
| 言葉遣い | 共通安全・証拠ruleと分離したedition style＋preferences部 |
| 進行表示 | `yasashii-harness` のoverlay |
| 報告 | 既定3行＋明示時だけ補足、agents overlay |
| 内部用語の補足 | build（正式名称を隠さず役割を短く併記） |
| 先回り提案 | 生成AGENTS.mdと各スキル末尾 |

## コネクタ

- 第一級: Gmail / Google Calendar / Google Drive / Microsoft 365 の公式コネクタ。
- 任意: Notion。
- 初期見送り: 公式リモートMCPがない国内チャット。
- 接続診断は実エラーを確認してから原因と対処を日本語で示す。

## 開発順序

1. sprint-008: 改名、別repo分離、参照導線、回帰section 12の復旧。
2. sprint-009: G1配管。journal、シーム副作用、topics、TODO、reindex、固定時刻。
3. sprint-010: G1体験。timeline、節目プロトコル、朝夕・daily統合。
4. sprint-011: G2。先にconstraints/rubric/憲章テンプレを「既定値＋明示上書き」へ揃えてからsettingsを実装。
5. sprint-012: 週次ふりかえりと索引退避。dashboardとmigrationは承認済み条件に従い明示判断する。
6. sprint-029〜031: rule／copy境界、edition識別、共通plugin pathと旧CHANGELOG互換。
7. sprint-032: 未配布段階の `0.8.0` candidate整合、新規導入、portable gate、旧blockerの正直な記録。
8. sprint-032-patch-001: Repo分割前に全会話のMarkdown可読性とChatwork Secretの具体案内を共通実装する。
9. sprint-033: `0.8.0` candidateを前提に、指定の別directory／別GitHub repoで `agentic-secretary` 上流editionを成立させる。
10. sprint-034: `0.8.0` candidateを維持し、`yasashii-secretary` のfetch専用upstreamと狭いoverlayを成立させる。
11. sprint-035: 2 editionのparity、安全、会話可読性、Git系譜、公開gateを閉じる。

## スコープ外

- restoreシーム「昨日の状態に戻して」。Git履歴が守られる事実だけを案内する。
- dashboardをG1の必須条件にすること。
- hooksの同梱。
- `~/workspace/agentic-harness` への一切の操作。
- GitHubのfork badge／parent relationと、`yasashii-harness` から直接上流へPRする導線。

## agentic／yasashii edition設計

### repoとGitの形

`agentic-secretary` は必ず `/Users/taisei/workspace/agentic-secretary` の別directory、
GitHubの別repo `mtaiseeei/agentic-secretary` とする。`yasashii-secretary` 内のmonorepo／subdirectoryにはしない。
neutralization commitまでの全Git履歴を継承し、両repoが同じ共通祖先を持つようにする。
`yasashii-secretary` の `upstream` remoteはagentic repoをfetch専用で参照し、pushを無効にする。

別directory／repo作成、remote追加・変更、push、公開、releaseは、該当Sprintのexternal gateで
ユーザーへ操作ごとの明示許可を再確認してから行う。

### 共通基盤とedition差分

plugin本体の内部pathは両editionとも `plugins/secretary/`。workspace `secretary/`、skill／command名、
migration filename、Chatwork／Google Chat wizard、OAuth scope、同期、安全・証拠ruleは共通にする。
edition差分は会話、診断、報告、developer handoffだけを宣言的設定と集約copyで与える。

`yasashii-secretary` のoverlayは、共通pluginのstyle差分、共通安全回帰、必要な互換／release checkだけを対象にする。
spec、Sprint、progress、feedback、evidenceは各repoが所有し、同期しない。overlayはallowlist外変更、未分類file、
anchor不在、非冪等な二重適用を拒否する。

### workspace識別と更新互換

新規workspaceはneutral markerとedition値を使い、legacy yasashii markerも認識する。
反対edition、混在、判定不能は書込み前に停止し、ledger／marker／履歴を移動・統合・上書きしない。
新規生成bot名は `secretary[bot]` を第一候補とし、既存workspaceのbot名を強制改名しない。

旧0.7.0が読む `plugins/yasashii-secretary/CHANGELOG.md` は長期互換fileとして残し、
新しい `plugins/secretary/CHANGELOG.md` とbyte単位で一致させる。redirect説明へ置換せず、過去entryを変更しない。
最初の明示配布候補0.8.0は新規導入とportable gateで検証する。旧0.7.0 updaterのscanner blockerは未解消として保持し、
external recovery／bootstrap、fixture削除、安全scan弱体化で合格を作らない。same-version bridgeは作らず、同一版とdowngradeは副作用0件で停止する。

全会話のMarkdown可読性は共通基盤に置き、agentic／yasashiiの4つの表現面がそれぞれの内容差を保ったまま継承する。

LICENSEとShin-sibainu/cc-companyへの単段クレジットは両editionで保持する。`forkedFrom` は
公式validatorまたはlive gateが変更を要求した証拠なしに推測変更しない。

## 参照

- 方針転換の唯一の引き継ぎ正本: `docs/proposal-2026-07-15-realignment.md`
- 実装仕様: `docs/spec/`
- 白紙化前の旧実装: `backup/sprint-007-010-plan`（そのまま復元せずjournal統合形に書き直す）
- 全面操作禁止のローカルcheckout: `~/workspace/agentic-harness`

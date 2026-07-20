# Editions

## 目的

共通の安全性と機能を保ちながら、利用者に合わせた2つの完成品を提供する。

- `agentic-secretary`: エンジニア、AI活用に慣れた利用者向けの上流edition。
- `yasashii-secretary`: 非エンジニア一般向けの下流edition。現在のやさしい体験を継承する。

両者は「設定で切り替える1製品」ではない。それぞれ独立して導入・更新・公開できる完成品であり、
`agentic-secretary` の共通基盤を `yasashii-secretary` が狭いoverlayで追随する。

## Git系譜とrepo関係

`agentic-secretary` は必ず `/Users/taisei/workspace/agentic-secretary` の別directory、
GitHubの別repo `mtaiseeei/agentic-secretary` とする。`yasashii-secretary` 内のmonorepoや
subdirectoryとして作らない。`yasashii-secretary` からはfetch専用の `upstream` remoteで参照する。

1. neutralization commit、つまり共通pathとedition境界を成立させたcommitを両repoの共通基点にする。
2. `agentic-secretary` は、そのcommitまでの `yasashii-secretary` の全Git履歴を継承する。同じ内容だけを別の初期commitで作り直さない。
3. `agentic-secretary` が上流、`yasashii-secretary` が下流である。READMEとupstream mappingにこの関係を明記する。
4. `yasashii-secretary` の `upstream` は読取専用にし、push URLは無効化する。同期は記録済みのupstream baseから行う。
5. LICENSEはMITを維持し、Shin-sibainu/cc-companyへの単段クレジットを両editionで保持する。
6. marketplaceの `forkedFrom` は推測で変更しない。公式validatorまたは実配布gateが変更を要求した場合だけ、結果を証拠としてPlannerへ戻す。

別directory／別repoの作成、remote追加・変更、push、公開、releaseは、その該当Sprintのexternal gateで
操作ごとのユーザー明示許可を再確認する。以前の包括的な同意だけで実行しない。

## 共通基盤

両editionのrepo内では、plugin本体の内部pathを `plugins/secretary/` に統一する。次は共通であり、edition別に複製・分岐しない。

- workspace root名 `secretary/`
- skill名、command名、migration filename
- Chatwork／Google Chatのwizard、表示copy、OAuth scope、同期境界、履歴形式
- 記憶保護、secret検査、symlink境界、commit対象分離、rollback等の安全契約
- 全ユーザー会話の改行、段落、必要なMarkdown箇条書きという可読性最低基準
- 共通pluginの回帰、master release gate、Git archive相当gate
- botの新規生成時の第一候補 `secretary[bot]`

既存workspaceのbot名や既存workflowは強制改名しない。新しいneutral名は新規生成にだけ使い、既存動作を壊さない。

## edition差分

edition差分は次の4面に限定する。

| 面 | agentic-secretary | yasashii-secretary |
|---|---|---|
| 会話 | 技術的に直接的。正式名称と判断材料を早めに示す | 現行の平易な日本語、段階表示、過度に幼くしない |
| 診断 | command、path、error、再現条件を先に示す | 何が起きたか、影響、次にすることを先に示す |
| 報告 | 技術要約、証拠、残課題、developer向け情報 | 既定3行＋必要時の短い補足 |
| developer handoff | 実装者がそのまま調査・修正できる詳細 | 必要な正式名称を残しつつ利用者向けに整理 |

Chatwork／Google Chat wizardはcommon by design、つまり意図的に共通である。wizardの文言をedition可変copyへ入れない。
4面の内容差は維持するが、どちらのeditionも複数要素を改行なしの平文へ連結しない。可読性はedition差分ではない。

## 正式対象ホストとhost adapter

2026-07-20 に、`agentic-secretary` を技術者向けにそのまま配布できる完成品とし、
正式な必須対象環境を次の4つとする方針が承認された。

1. **Claude Code Desktop App**（Anthropic公式のClaude desktop app内のClaude Code実行面。
   MCPコネクタ中心の一般Claude Desktop chat面とは実行面として区別し、混同しない）
2. **Claude Code CLI**
3. **Codex App**（OpenAI公式のCodex macOSアプリ）
4. **Codex CLI**

その他のコーディングエージェントは「共通本体を再利用しやすくする設計対象」に含めるが、
公式受入対象・配布保証・実環境検証必須対象には含めない。

### 共通本体（ホスト非依存）

次はホスト非依存の共通本体として1実装だけを持ち、ホストごとに複製・分岐しない。

- skillsの意味内容、会話ルール、Markdown可読性、edition別style
- 診断方針、完了報告契約、developer handoff契約
- 安全ルール、workspace境界、secret保護
- Chatwork／Google Chatデータ処理、wizard本体、OAuth scope、同期境界
- ホスト非依存のfixture・validator（会話契約の検査を含む）

### host adapter（ホスト固有）

次だけをhost adapterとして分離する。共通機能を4コピーしない。

- plugin manifest、marketplace／導入経路、plugin root解決、skill発見方法
- command／slash command、構造化質問UI
- 更新経路、reload／restart経路
- ブラウザ検証面、実会話runner、host metadata、インストール検証、official validator

配布形式の根拠は各ホストの公式仕様に置く。Claude Code系はplugin manifest／marketplace
（`.claude-plugin/`）、Codex系はconfig.toml／AGENTS.md／skillsが公式のカスタマイズ面である。
公式に提供されていない機構（例: Codexのplugin marketplace相当）を存在する前提で設計しない。
公式仕様で確認できない事項は `unverified` として記録し、推測で実装しない。

### 「対応済み」判定の条件

あるホストを「対応済み」と表示できるのは、そのホストで次が**すべて**確認できた場合だけとする。

1. 配布形式（manifestまたは正式配布形式）の整合
2. 導入手順の実際の成立
3. rules／skillsの読込
4. 基本会話と複雑な一般回答
5. 完了報告・状態報告
6. 診断とdeveloper handoff
7. wizard起動
8. workspace境界の維持
9. secret非露出
10. 更新経路の成立、または安全な「未対応」明示表示
11. ホスト固有回帰の0 FAIL
12. 実環境証跡または公式validator証跡

1ホストのPASSを他ホストへ流用しない。Claude CodeでのPASSを4環境PASSとして扱わない。
対応対象ホストと検証済みホストは別集計し、未検証環境を「対応済み」と表示しない。
現在の `yasashii-secretary` を、未検証のまま「4環境対応済み」と表示しない。

## edition設定

editionごとに1つの宣言的設定を持ち、分散した文字列置換で製品差分を作らない。最低限、次を設定対象にする。

| 設定群 | edition別の値 |
|---|---|
| 配布識別子 | marketplace名、外部plugin ID、repository／homepage |
| 更新 | CHANGELOG取得先、配布URL、update ledger path |
| workspace保護 | canonical marker、legacy marker認識、反対edition marker認識 |
| 実行識別 | update session directory、保護commit prefix |
| 開発導線 | Harnessのmarketplace／導入先 |
| 表現 | 会話、診断、報告、developer handoffで使う集約済みcopy |

新しいcanonical workspace markerはedition中立の形式を使い、その中のedition値で識別する。
`yasashii-secretary:update-entry:v1:start` 等の既存yasashii markerはlegacyとして読み続ける。
update ledgerにはschema versionとeditionを持たせる。既存のedition情報なしledgerは、実データとlegacy markerから
安全に `yasashii-secretary` と判定できる場合だけ読み、曖昧なら停止する。

## 反対editionの検出

初期リリースではco-install、edition switching、ledger移行を提供しない。

1. onboarding、diagnose、update、migrationの書込み前に、ledgerとmarkerの両方を調べる。
2. 反対editionを検出したら、対象path、検出根拠、利用中edition、導入しようとしたeditionを示して停止する。
3. 反対editionのledger、marker、workspace、履歴を移動・統合・削除・上書きしない。
4. 両editionの痕跡が混在する、または判定不能な場合も停止する。
5. 将来の移行余地を残すため、edition値とschema versionを記録するが、今回のscopeでは切替commandを作らない。

## 未配布段階の0.8.0 release preparation

`0.7.0` は不変なrelease記録であり、manifest、migration、fixture、評価記録、Git履歴を同一versionのまま差し替えない。
2 edition完成品はまだ利用者へ明示配布していないため、最初の明示配布candidate／latestを `0.8.0` とする。既存 `0.7.0` は旧URL
`plugins/yasashii-secretary/CHANGELOG.md` を参照するため、このpathはredirect説明ではないraw CHANGELOG互換fileとして残し、
`plugins/secretary/CHANGELOG.md` の新しい正本とbyte-for-byteで一致させる。過去entryは書き換えない。

0.8.0は新規または未導入状態から導入でき、正本plugin path、neutral marker、edition付きledger、主要skillが整合しなければならない。
same-version bootstrap bridge、同一版のin-place差替え、version downgradeは採用しない。同一版とdowngradeはplugin、workspace、
Git、設定、ledger、migrationへ副作用0件で停止する。

旧0.7.0 updaterはGoogle Chat標準生成fileをscannerで止めることが確認されている。未配布段階では次を行わない。

1. 既存0.7.0利用者向けの複雑なexternal recovery／bootstrapを追加しない。
2. Google Chat標準生成fileをfixtureから削除しない。
3. secret scannerを弱めず、既知pathを広く除外しない。
4. 旧0.7.0 live updateを対応済み、PASS、配布保証と表示しない。
5. 公開済みartifact、過去fixture、過去評価記録を0.8.0前提へ書き換えない。

実plugin install／update、remote参照の変更、pushはユーザー明示許可を得たlive gateでだけ行う。

## yasashii overlayの所有範囲

下流overlayに含めてよいのは次だけ。

- 共通pluginに対するedition styleの追加・置換
- 共通安全回帰の実行と、edition差分が安全契約を弱めない検査
- 旧CHANGELOG等の互換fileと、配布識別のrelease checks
- upstream base、anchor、metadata allowlist、downstream-owned file一覧、同期script

次は各repoが所有し、overlay同期の対象にしない。

- `docs/spec/`、`docs/sprints/`、`docs/progress/`、`docs/feedback/`
- 評価evidence、release判断記録、edition固有README／mapping／LICENSE
- edition固有の公開計画と外部操作記録

同期は宣言されたfileとfieldだけを合成する。上流fileの未分類追加・削除、anchor不在、allowlist外変更、
二回適用で差分が出る非冪等性、つまり同じ同期を繰り返すと結果が変わる状態は失敗にする。

## 公開gate

両editionを公開可能とするには、次がすべて必要である。

1. 共通回帰、edition別回帰、Git archive相当、公式manifest／marketplace validatorが0 FAIL。
2. wizardのDOM、copy、OAuth scope、同期・安全挙動が両editionで同一。
3. edition差分が会話、診断、報告、developer handoffだけに限定されている。
4. neutral marker、legacy yasashii marker、反対edition、混在・不明の全ケースが契約どおりになる。
5. 旧raw CHANGELOGが正本とbyte一致し、0.7.0の歴史記録が不変で、新規0.8.0導入、equal／downgrade副作用0停止、旧blockerの非誤表示が合格する。
6. Git共通祖先、upstream base、下流overlayの冪等性、upstream push無効化が証拠化される。
7. LICENSE、単段クレジット、README、upstream mapping、CHANGELOG互換が一致する。
8. 外部repo作成、remote変更、push、公開、release、実plugin install／updateについてユーザーが明示許可した操作だけが実行される。
9. candidate／latest／manifest／CHANGELOG／ledger／migrationが `0.8.0` で整合し、公開済み `0.7.0` の記録・fixture・履歴が不変で、same-version bridge・equal update・downgradeが0件である。
10. 全会話面が改行・段落・必要なMarkdown箇条書きを持ち、agentic／yasashiiの4面の内容差を維持する。Chatwork wizardの `Name`／`Secret` 入力案内は両editionで同一かつ具体的である。

許可不足や外部サービス未準備は `external-live-gate-unavailable` として不合格にし、実装不具合とは分けて記録する。

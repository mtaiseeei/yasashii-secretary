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
共通wizardの挙動修正は `agentic-secretary` を正本として先に成立させ、`yasashii-secretary` は宣言済みの
overlay同期で取り込む。下流だけの手修正でwizardを分岐させず、同期後もyasashii固有の会話copy、identity、
配布metadata、repo-owned docsを上流値で置換しない。

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

配布形式の根拠は各ホストの公式仕様に置く。Claude Code系は既存のplugin manifest／marketplace
（`.claude-plugin/`）を維持する。Codex App／Codex CLIの共有配布は、OpenAI公式の
`.codex-plugin/plugin.json` とmarketplaceを正規面とする。

Codex用の正規構造は次の契約を満たす。

1. plugin root `plugins/secretary/` に `.codex-plugin/plugin.json` を持ち、manifestの `skills` は
   `./skills/` を参照する。Codex pluginの外部nameは `agentic-secretary` とする。Claude manifestと
   Codex manifestが別のskill本文を所有しない。
2. repo marketplaceの正本はrepo rootの `.agents/plugins/marketplace.json` とし、
   `source.path` はmarketplace root、つまりrepo rootから見た `./plugins/secretary` にする。
   marketplace nameも `agentic-secretary` とし、`./` 始まり、marketplace root内という公式path規則を守る。
3. Claude用 `.claude-plugin/marketplace.json` とCodex用 `.agents/plugins/marketplace.json` は
   同じrepoで共存する。前者はClaudeの正式面として維持し、後者をCodexの正式面として検証する。
4. Codexがrootの `.claude-plugin/marketplace.json` をlegacy-compatible marketplaceとして読める事実は
   互換回帰として保持する。ただし、legacy互換のinstall成功を `.codex-plugin/plugin.json` と
   `.agents/plugins/marketplace.json` の欠落に代わるPASS根拠にしない。
5. `.agents/skills` はrepo-local authoring／局所利用、`AGENTS.md` と `config.toml` はhost設定、
   skills手動コピーはtest補助またはfallbackとして扱う。共有配布完成の主導線・合格根拠にはしない。
6. bundled skillsは共通本体の15件を各1回だけdiscoverする。正式plugin、legacy marketplace、repo-local skillsの
   複数経路から同名skillが重複列挙される状態は配布完成と扱わない。

Codex CLI 0.144.6で確認した共有導入の主導線は、GitHub repo自体をmarketplace sourceとして追加する
`codex plugin marketplace add mtaiseeei/agentic-secretary --ref main`、続いてmarketplaceの実際のnameを使う
`codex plugin add agentic-secretary@agentic-secretary` とする。CLIでは `/plugins` から同じmarketplaceを選んで
install／enableできることも確認する。Codex AppではPlugins Directoryの対象marketplaceからinstallし、
新しいchatを開始して利用する。CLIもinstall後は新しいsessionを開始する。

更新はsource、marketplace snapshot、installed cache、新しいsessionを区別する。Git marketplaceのrefreshは
`codex plugin marketplace upgrade <marketplace-name>` を基準にし、現行hostにplugin単体の自動upgradeが無い場合は、
実機で成立した再install手順を案内する。AppはPlugins Directoryで観測できる更新操作に従う。いずれも
`~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/` を直接編集せず、更新後のversionと共通skillsのdigestを
新しいchat／sessionで確認する。公式仕様で確認できない事項は `unverified` と記録し、推測で実装しない。

2026-07-21時点の公式根拠は、OpenAIの
[Build plugins](https://learn.chatgpt.com/docs/build-plugins)、
[Build skills](https://learn.chatgpt.com/docs/build-skills)、
[Plugins](https://learn.chatgpt.com/docs/plugins) とする。CLI構文はCodex CLI 0.144.6の
`codex plugin --help`、`codex plugin marketplace add --help`、`codex plugin add --help`、
`codex plugin marketplace upgrade --help` でも照合した。将来のCLI変更を推測して固定せず、評価時のversionと
実行結果を証跡へ残す。

### 「対応済み」判定の条件

あるホストを「対応済み」と表示できるのは、そのホストで次が**すべて**確認できた場合だけとする。

1. 配布形式（manifestまたは正式配布形式）の整合
2. 未導入状態から正式配布面を使う導入手順の実際の成立
3. rules／skillsの読込と、Codexでは `$secretary` 等の明示呼出または自然言語trigger
4. 基本会話と複雑な一般回答
5. 完了報告・状態報告
6. 診断とdeveloper handoff
7. wizard起動
8. workspace境界の維持
9. secret非露出
10. 更新経路、installed cache、reload／restart、新規chat／session反映の成立、または安全な「未対応」明示表示
11. ホスト固有回帰の0 FAIL
12. 実環境証跡または公式validator証跡

1ホストのPASSを他ホストへ流用しない。Claude CodeでのPASSを4環境PASSとして扱わない。
対応対象ホストと検証済みホストは別集計し、未検証環境を「対応済み」と表示しない。
現在の `yasashii-secretary` を、未検証のまま「4環境対応済み」と表示しない。
Codex App／Codex CLIは、legacy Claude marketplaceの互換installや手動skills構成だけでは「対応済み」にしない。

### 実用的な4ホスト出荷証拠

4ホストの受入は、利用者が実際に使う面をホストごとに確認する。すべてのホストへ同一のattestation schemaを
要求するのではなく、GUI Appは実UI smoke、CLIは実command／session evidenceを正本にする。

- **Claude Code Desktop App／Codex App**: current bytesを導入した新しいchatで、plugin／skill identity、
  `0.8.0`、実会話8面のMarkdown、Chatwork／Google Chat wizardへの到達を実UI、host-owned session record、
  AX tree、screenshot等から確認する。CLIの結果だけをAppの証拠にしない。
- **Claude Code CLI／Codex CLI**: current bytesを導入した新しいsessionで、plugin／skill identity、
  `0.8.0`、実会話8面のMarkdown、wizard導線、更新／再導入後の反映をcommandとsession evidenceで確認する。
- **共通安全性**: 対象workspaceの変更が0件で、Secret実値が会話、ログ、repo、保持証拠に0件であることを確認する。
  実会話runnerを自動実行する場合は、合成HOME、read-only plugin copy、env allowlist、最小tool、
  sandboxまたはpath-scoped permission、workspace外canary拒否、cleanupの既存安全契約を維持する。

private `origin/main` のcommit `4670438` と同じcurrent bytesについて既に取得した4 host固有証拠は、
commit／version／identity／skill／sessionの対応をfresh Evaluatorが確認できる場合、受入証拠として再利用できる。
fresh Evaluatorは、実装と証拠の整合、manifest／marketplace、回帰・archive・validatorを確認し、証拠が古い、
対象bytesが違う、または重要な欠落がある場合だけ必要なhostを軽量に再確認する。

schema v2／v3のproduction collector／driver／attestor、期限つきapproval、challenge、二層artifact、
12×8 exact resultは、将来のoptional internal QAとして検討できるが、製品scope、Sprint 033の出荷必須条件、
配布Pluginへの同梱要件にはしない。これは安全性を緩める判断ではなく、製品の動作・配布・非露出を直接示す
実用証拠へ受入を戻す判断である。

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

## 対応Harnessとの分離と0.5.0互換

HarnessはSecretaryの内部機能ではなく、対応する別Plugin／別Repoである。Secretaryが持つのは、editionごとの対応先、
host別の導入識別子、導入状態確認、未導入時の案内、導入済み時の接続だけとする。

| Secretary | Harness正本 | Claude Code marketplace／install | Codex repo marketplace／install |
|---|---|---|---|
| `agentic-secretary` | GitHub `mtaiseeei/agentic-harness` `main` `0.5.0` | `agentic-harness`／`harness@agentic-harness` | `agentic-harness-local`／`harness@agentic-harness-local` |
| `yasashii-secretary` | GitHub `mtaiseeei/yasashii-harness` `main` `0.5.0` | `yasashii-harness`／`harness@yasashii-harness` | `yasashii-harness`／`harness@yasashii-harness` |

この表の値は2026-07-21にGitHub上の正式manifest／marketplaceとREADMEをread-only確認した結果である。
公開判定時にも同じGitHub `main` を再確認し、versionまたは識別子が変わっていた場合は推測で追随せず、
observed commitと差分を記録してPlannerへ戻す。ローカル `/Users/taisei/workspace/agentic-harness` は証拠源にしない。

Secretary repoのHarness運用面は0.5.0の次の意味契約に追随する。

1. 検証基盤だけが原因の不合格は `verification-scope-issue` とし、Generator／Plannerへの自動差し戻しではなく、選択肢を示してユーザーへ返す。findingはproductとverification-infraを区別し、迷う場合はproductとして安全側に扱う。
2. Sprint契約またはrubricに列挙済みの証拠形式を合格に十分なsafe harborとし、Evaluatorが統一attestation基盤等を後付けの必須条件にしない。既存の下限を下回ることはできない。
3. activeなSprintの受入基準・rubricを厳しくする場合はユーザー承認を要する。緩和またはNon-scope化もPlanner提案とユーザー承認を記録する。
4. `.harness/config.toml` はlineage dispatch上限10、同一Sprintのspec-issue差し戻し上限2を共有既定として明示し、上限到達後は追加dispatchせずユーザーへ返す。個人overrideと既存model／effort設定は上書きしない。
5. stateの `Spec-Issue Count` と `Lineage Dispatches` はOrchestratorが0.5.0の遅延移行規則に従って追加・更新する。Generator／Evaluatorはstateを書かない。
6. 再評価は変更範囲へ比例させ、同一candidateに結びつき失効条件へ該当しない証拠を再利用できる。実行していない検証をPASSへ数えず、回帰スイートが実行不能または失敗のままなら回帰なしをPASSにしない。
7. ユーザーが未達を理解してaccept-as-isを選んだ場合だけ `done-by-user-decision` を使い、Evaluator未達記録を保持する。通常のEvaluator PASSと同義にしない。

追随時も既存 `CLAUDE.md`、`AGENTS.md`、Agent定義、製品固有指示を全面置換しない。Secretary配布物へHarness実体や
Git履歴をmerge、vendor、submodule、symlink、コピーせず、manifestの暗黙依存として自動導入しない。

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
Chatwork／Google Chatの共有wizard assetを同期した場合は、DOM、copy、検索・選択挙動、OAuth／session境界の
一致を確認し、edition固有surfaceの開始前後digestが変わらないことを下流側の独立回帰で証明する。

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
9. candidate／latest／Claude・Codex両manifest／両marketplace／CHANGELOG／ledger／migrationが `0.8.0` で整合し、公開済み `0.7.0` の記録・fixture・履歴が不変で、same-version bridge・equal update・downgradeが0件である。
10. 全会話面が改行・段落・必要なMarkdown箇条書きを持ち、agentic／yasashiiの4面の内容差を維持する。Chatwork wizardの `Name`／`Secret` 入力案内は両editionで同一かつ具体的である。
11. Codex正式配布では `.codex-plugin/plugin.json`、repo rootの `.agents/plugins/marketplace.json`、共通skills参照、GitHub marketplace導入、Plugins Directory／CLI plugin browser、新規chat／session、更新・cache確認が成立する。Claude marketplaceのlegacy互換成功や手動skillsコピーだけで代替しない。
12. agenticの4 hostはcurrent bytesで個別に実機smokeが成立し、GUI Appは実UI証拠、CLIはcommand／session証拠を持つ。正式manifest／marketplace、`0.8.0`、identity、skill、会話8面、wizard、workspace変更0件、Secret露出0件、更新／再導入手順、全回帰・archive・利用可能な公式validatorが整合する。`4670438` の既取得証拠は、同一bytesとの対応をfresh Evaluatorが確認した場合に再利用できる。
13. 対応HarnessのGitHub `main` が両方とも `0.5.0` で、Claude／Codex別のmarketplace、install ID、manifest、repository／homepageが各Secretaryのedition設定、build案内、README、互換検査と一致する。Secretary内のHarness実体・agents・Harness Git履歴は0件である。
14. 両Secretary repoのHarness運用設定・ガイダンスが0.5.0の停止上限、失敗分類、safe harbor、基準変更gate、増分再評価、証拠再利用、user-decision出口を扱い、既存の製品固有指示とagentic／yasashiiの対象差を保持する。
15. 共通15 skillsは各 `SKILL.md` の実パスからhost-neutralにplugin rootを解決し、未設定の `${CLAUDE_PLUGIN_ROOT}` を通常shellへ渡さない。Claude Code、Codex App、Codex CLIで代表scriptが同じ共通本体へ到達し、15 skills全件の参照が静的検査を通る。
16. `agentic-secretary` と `yasashii-secretary` の双方にCodex正式manifest／repo marketplaceがあり、同じ共通skillsを参照しながらedition別identityを表す。agenticのmanifestやClaude legacy互換をyasashiiの正式配布証拠へ流用しない。
17. `${CLAUDE_PLUGIN_ROOT}` 以外のClaude Code限定前提も15 skillsと配布面でinventoryし、slash command、Hook、Claude固有UI、Claude marketplace等の真にhost固有な面だけをadapter／案内へ分離する。共通skillsの意味内容をhost別に複製せず、静的inventory、任意path fixture、既存Codex正式installテスト、両edition全回帰を主証拠にする。

許可不足や外部サービス未準備は `external-live-gate-unavailable` として不合格にし、実装不具合とは分けて記録する。

# Sprint 035 独立評価

## 総合判定

**FAIL — `implementation-issue`**

2 editionの配布manifest、15 skillの共通root解決、overlay、Harness 0.5.0の公式GitHub照合、既存回帰は、専用検査123件を含む独立再実行で合格した。

一方で、正式なCodex配布面を追加したにもかかわらず、実際の更新処理は常にClaude CLIを実行する。また、Google／Microsoft／Notionの接続設定もCodexで開始した後にClaude専用画面の案内へ進む。テストが存在するだけでは、この実利用経路の不足を補えないため、Sprint 035は完了にできない。

- Sprint判定: **FAIL**
- Failure Classification: **`implementation-issue`**
- `spec-issue`: なし
- `verification-scope-issue`: なし
- 実装finding: High 1件、Medium 1件
- 検証基盤finding: Low 1件
- 外部gate: `external-live-gate-unavailable`
- Retry Recommendation: Generatorへ差し戻し
- Model Escalation Recommendation: なし。現在の `strong` tierを維持

## 評価対象

### agentic-secretary

- path: `/Users/taisei/workspace/agentic-secretary`
- branch: `codex/sprint-035`
- evaluated HEAD: `f1fddea77db823c2b1826ac11c1d3eedf6770cf9`
- working tree: clean

### yasashii-secretary

- path: `/Users/taisei/workspace/yasashii-secretary`
- branch: `codex/sprint-035`
- evaluated HEAD: `0e8c8f8c34992771d2305bc9d08966497c4fb6a7`
- implementation commit: `f0108127a5a3c9bd0e551afd61f72820dfeccd59`
- progress commit: `8b0811b`
- working tree: 評価開始時clean

`/Users/taisei/workspace/agentic-harness` は、読取り、list、status、比較、生成物作成を含めて評価対象にしていない。Harnessの確認はGitHub上の公式remoteだけをread-onlyで行った。

## Findings

### High — Codexから更新してもClaude CLIが実行される

分類: `product` / `implementation-issue`

両editionの `plugins/secretary/skills/update/SKILL.md` は、冒頭でClaudeとCodexの更新方法を混ぜないと説明している。しかし実行手順はhostを受け取らず、全利用者を `update-apply.mjs start` へ案内している。その後の実処理は次のとおりClaude固定である。

- `plugins/secretary/skills/update/SKILL.md:11-12`: Claude／Codexを混ぜない方針を宣言
- `plugins/secretary/skills/update/SKILL.md:72`: hostを区別せず `update-apply.mjs start` を実行
- `plugins/secretary/skills/update/SKILL.md:75-78`: Claude marketplace更新と `/reload-plugins` だけを案内
- `plugins/secretary/skills/update/SKILL.md:119-125`: 自動更新もClaude向けだけを記載
- `plugins/secretary/scripts/update-apply.mjs:493-501`: 実行binaryを `claude` に固定
- `plugins/secretary/scripts/update-apply.mjs:504-514`: `claude plugin marketplace update` と `claude plugin update` を実行
- `plugins/secretary/scripts/update-apply.mjs:586-606`: 保護commit、backup、session作成後にClaude更新を開始
- `plugins/secretary/scripts/update-apply.mjs:615-623`: 結果にも `/reload-plugins` とClaude commandだけを保存

`--host` やCodex用分岐は存在しない。したがってCodex利用者が更新を承認すると、Codexの正式な更新経路へ進まず、ローカルの保護commit等を作成した後にClaude CLIを呼び出す。Codex用更新を実装するか、少なくとも未対応hostではローカル変更前に安全に停止する必要がある。

これは表現上の問題ではない。正式配布されたCodex版の主要操作が正しいhost adapterへ到達しないため、AC11、C1、C3、C15を満たさない。

### Medium — 3つの接続設定がCodex判定後もClaude専用画面へ流れる

分類: `product` / `implementation-issue`

次の共通skillは、CodexではApp／connectorの利用可否を確認し、別hostの設定画面を流用しないと説明している。

- `plugins/secretary/skills/setup-google/SKILL.md:27-29`
- `plugins/secretary/skills/setup-microsoft/SKILL.md:27-29`
- `plugins/secretary/skills/setup-notion/SKILL.md:27-29`

しかし、利用可能と判断した後の実手順は、Google／Microsoftでは各fileの37、44、56行付近、Notionでは43、52行付近から「Claudeを再起動」「Claudeの設定 → Connectors」だけを案内する。Codex側で使う画面や操作へのadapterがなく、Codexで利用可能だった場合にもClaude専用手順へ進む。

「Codexで利用不可なら停止する」分岐だけでは、利用可能なCodex connector/Appを正しく設定できない。3つのskillそれぞれにCodex用の後続手順を用意するか、未対応ならhost判定直後に明示的に停止する必要がある。AC11とC15を満たさない。

### Low — Sprint 035専用検査がhost名の記載だけで通過する

分類: `verification-infra`

`scripts/sprint-035-test.mjs` は15 skill、manifest、root resolver、host inventory、禁止語等を確認しているが、次は確認していない。

- `update-apply.mjs` がCodex用の更新経路を持つこと
- host判定後の接続設定手順が、そのhostの画面・操作へ進むこと
- Claude専用commandがCodex経路から実行されないこと

このため、専用testは両repoで12/12 PASSでも上記2件を検出できない。これはテストの追加課題だが、製品findingを検証基盤だけの問題へ読み替えない。

## 受入基準

| AC | 判定 | 独立確認 |
|---:|---|---|
| 1 | FAIL | 専用・重点回帰は0 FAILだが、Codexの更新・接続設定という内部必須経路に実装不足が残る |
| 2 | PASS | agentic／yasashiiのidentity、root、配布surfaceが分離され、共通skillのbyte一致をoverlay検査で確認 |
| 3 | PASS | downstreamのoriginはyasashii、upstreamはagentic fetch／push disabled。overlay checkも宣言baseと候補を照合 |
| 4 | PASS | 共通skillをedition別に複製せず、host-neutral rootから15 skillを解決 |
| 5 | PASS | `.claude-plugin/plugin.json`、`.codex-plugin/plugin.json`、root marketplace manifestが両editionに存在 |
| 6 | PASS | Codex manifestは `skills: ./skills/` を持ち、edition identityとversion 0.8.0が整合 |
| 7 | PASS | 不正root、相対path、未解決placeholder、skill外path、必須directory欠落をexit 2で拒否 |
| 8 | PASS | 任意の絶対path、空白を含むfixture、`/` cwdからも15 skillを解決。失敗時sentinelは不変 |
| 9 | PASS | Harness実装をpluginへ同梱せず、追加は参照guidanceと設定差分に限定 |
| 10 | PASS | GitHub公式remote上のHarness 0.5.0、commit、Claude／Codex配布IDをread-only照合 |
| 11 | FAIL | 共通skill内にCodexで実行できないClaude専用更新・接続設定が残る |
| 12 | PASS | 両hostの正式manifestとdiscoverable skill rootは存在。既存install evidenceと現在の静的構造を照合 |
| 13 | PASS | Harness guidanceはsafe harbor、incremental評価、分類、counter、`done-by-user-decision` を保持 |
| 14 | PASS | push、install、公開、release、OAuth、Secret、workflow dispatchは0件 |
| 15 | FAIL | High／Medium findingが残り、Codex adapter completenessのゼロ許容条件を満たさない。外部live gateも未実施 |

## 独立実行結果

### Sprint 035専用・重点回帰

| repo | command | 結果 |
|---|---|---:|
| agentic | `node scripts/sprint-035-test.mjs` | 12 PASS / 0 FAIL |
| yasashii | `node scripts/sprint-035-test.mjs` | 12 PASS / 0 FAIL |
| agentic | `node scripts/sprint-033-test.mjs` | 20 PASS / 0 FAIL |
| yasashii | `node scripts/sprint-034-test.mjs /Users/taisei/workspace/agentic-secretary` | 11 PASS / 0 FAIL |
| yasashii | `TMPDIR=/private/tmp bash scripts/sprint-015-regression.sh` | 68 PASS / 0 FAIL |

合計は **123 PASS / 0 FAIL**。

### overlay

```text
node scripts/sync-secretary-overlay.mjs --check --candidate /Users/taisei/workspace/agentic-secretary
OVERLAY_CHECK_PASS
base=f1fddea77db823c2b1826ac11c1d3eedf6770cf9
managed=225
repoOwnedDigest=2e52c929e022fff00c796f36ddc22c1f8d32095ab640e27b63e03b54ef1edfbf
```

remote gateのlocal設定は次を返した。

```text
external-live-gate-unavailable
origin=yasashii-secretary
upstream=agentic-secretary
upstream-push=disabled
```

15 skillはそれぞれ1件だけ存在し、すべて共通root boilerplateを使用していた。`CLAUDE_PLUGIN_ROOT` は残っていない。任意path fixtureと不正入力fixtureは専用testの中で独立再実行した。

### Harness 0.5.0 公式remoteのオンライン照合

最初のsandbox内照合はDNS拒否で `UNVERIFIED` となり、PASSへ読み替えなかった。その後、read-onlyのオンライン照合を許可面で再実行し、次を確認した。

| edition | GitHub repository | commit | version | 配布ID |
|---|---|---|---:|---|
| agentic | `mtaiseeei/agentic-harness` | `aafdf97d1f673a856c5a2a2fe72f87f1a4b57e89` | 0.5.0 | Claude: `agentic-harness/harness@agentic-harness` / Codex: `agentic-harness-local/harness@agentic-harness-local` |
| yasashii | `mtaiseeei/yasashii-harness` | `8f9eb4c1d9e14414a7e94051ca6f4c34da282784` | 0.5.0 | Claude／Codex: `yasashii-harness/harness@yasashii-harness` |

ローカルHarness checkoutは使用していない。

### 追加の静的確認

- `git diff --check`: 両repoの対象差分でPASS
- Codex manifest: 両editionともversion 0.8.0、`skills: ./skills/`、正しいrepository identity
- 共通root: missing、relative、placeholder、tree外、必須file／directory欠落を拒否
- plugin内bundled Harness: なし。`.git/hooks` はGit内部管理であり製品同梱に数えていない
- `.harness/config.toml`: `max_lineage_dispatches=10`、`max_spec_issue_returns=2` を追加し、既存model／effort／lifecycleを保持
- wizard asset差分: なし

## master regressionの扱い

旧 `scripts/regression-check.sh --offline` は両repoで開始したが、全体完走前に中止したため、master PASSの根拠にはしていない。

観測した失敗は、agentic側に残る旧yasashii固定identity／README期待と、sandboxでの `listen EPERM: operation not permitted 127.0.0.1` が中心だった。これらは既知の古い検証前提または実行環境制約であり、今回の製品FAILへ加算していない。逆に、未完走のmasterをPASSとも記録しない。

Sprint契約がsafe harborとして挙げる専用検査、overlay、公式remote snapshot、15 skill inventory、任意path fixture、既存の正式配布証跡は個別に確認済みである。Sprint 035の差し戻し根拠はmaster中断ではなく、実ファイルから確認したHigh／Mediumの製品findingである。

`TMPDIR=/private/tmp node scripts/sprint-030-update-config-test.mjs` はyasashiiで10/10 PASSだった一方、現在もClaude commandだけを正解としている。agentic側は旧yasashii固定fixtureで失敗した。これもSprint 035のCodex更新経路を保証する検査には使えない。

## UI・Browser証跡の扱い

Sprint 035ではwizard assetに差分がない。対象candidateはcleanで、専用・重点回帰もgreenだったため、Sprint 034で記録済みのdesktop／mobile Browser証跡を同一候補の未変更surfaceとして再利用した。新しいscreenshotや外部OAuth操作は行っていない。

今回のfindingはskill手順とupdate runnerのhost分岐不足であり、画面のvisual品質とは独立している。

## Rubric採点

| 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 3/5 | 4 | FAIL | 配布構造は完成したが、Codexの更新・3接続設定が完結しない |
| C2 構文・整合 | 5/5 | 5 | PASS | manifest、ID、version、root、remote snapshotが整合 |
| C3 機能の実証 | 3/5 | 4 | FAIL | 123件はgreenだが、実コード上のCodex経路がClaude固定 |
| C4 非エンジニア体験 | 4/5 | 4 | PASS | やさしい説明は維持。ただしCodex利用者には次の画面案内が誤る |
| C5 安全・規律 | 5/5 | 5 | PASS | 外部書込み、Secret、install、release、pushは0件 |
| C6 無回帰 | 5/5 | 5 | PASS | 専用・重点123件が0 FAIL。旧master中断は別記し、合格へ読み替えていない |
| C7 やさしさ | 4/5 | 4 | PASS | 文体は維持したが、host不一致の案内は利用時に迷いを生む |
| C8 wizard体験・デザイン | 5/5 | 4 | PASS | asset差分なし。同一候補の記録済み証跡を再利用 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | 2 editionとClaude／Codex正式配布面を分離 |
| C10 同意・安全停止 | 5/5 | 5 | PASS | 外部操作の承認gate自体は維持。host誤分岐はC15で評価 |
| C11 Secret・OAuth | 5/5 | 5 | PASS | Secret値の露出・外部OAuth実行なし。既存安全回帰68/68 |
| C12 リリース品質 | 4/5 | 5 | FAIL | High／Medium findingが残るため5点条件を満たさない |
| C13 変更影響管理 | 5/5 | 5 | PASS | overlay、repo-owned digest、edition差分、任意pathを確認 |
| C14 Harness 0.5.0整合 | 5/5 | 5 | PASS | 公式GitHub remoteとguidance／configを照合 |
| C15 host adapter完全性 | 3/5 | 5 | FAIL | Codex更新・Google／Microsoft／Notion設定にCodex用adapterがない |

**合計: 66 / 75**

C1、C3、C12、C15が閾値未達のためFAIL。

## Generatorへの修正要求

1. update skillとrunnerにhostを明示的に渡し、CodexではCodexの正式更新経路を使用する。未対応なら、保護commitやbackupを作る前に安全停止する。
2. Google、Microsoft、Notionの各setup skillで、host判定後の手順をClaude／Codexに分ける。Codexで利用可能な場合にClaudeのConnectors画面へ案内しない。
3. 専用検査へ、Codex経路からClaude commandが実行されないこと、3 setup skillの後続手順がhost別であることを追加する。
4. 修正後は変更surfaceと専用回帰を再実行し、旧masterの既知identity fixture／localhost制約は製品回帰と分けて報告する。

## 外部gate

外部操作は0件。push、install、公開、release、OAuth、Secret、workflow dispatchは実施していない。

実Codex App／CLIへのinstall、更新、connector接続は外部live gateとして残る。今回のFAILは外部許可不足によるものではないため、`external-live-gate-unavailable` だけで保留にはしない。内部実装を修正した後、ユーザーが操作別に承認した範囲だけで再評価する。

## Evaluator self-review

- 実装、spec、progress、stateは編集していない。
- 編集対象はこの `docs/feedback/sprint-035.md` だけである。
- Generatorの自己評価をSprint verdictへ流用せず、実ファイル、実行結果、remote snapshotを独立確認した。
- verification-infra findingを製品findingへ混ぜず、製品findingを検証基盤だけの問題へも読み替えていない。
- master未完走をPASS／FAILのどちらにも偽装していない。
- 禁止されたローカルHarness checkoutには接触していない。

---

# Retry 1 独立再評価（2026-07-22）

## 判定

**PASS — internal acceptance**

初回のHigh／Medium／Low findingはすべて解消した。Sprint 035の内部受け入れ条件とRubric閾値は満たしている。

ただし、実際のCodex App／CLIへのplugin更新・再installと、Google／Microsoft／Notionの実connector認証は実施していない。このため公開・release-readyの外部live gateは **`external-live-gate-unavailable`** のまま分離する。これは内部実装のFAILではない。

## 初回findingの解消確認

| 初回finding | Retry 1 | 独立確認 |
|---|---|---|
| High: Codex更新がClaude updaterを実行し、先にlocal副作用を起こす | **RESOLVED** | 独立fixtureでfake `claude` canaryを置き、`update-apply.mjs start --host codex` を実行。exit 3で安全停止し、Claude呼出し0、workspace HEAD／tree／status／tracked file不変、session／backup生成0を確認した。host guardは `safeWorkspace()`、Git操作、commit、session、backup、plugin変更より前にある。未知hostも同様にexit 3で無変更だった。 |
| Medium: 3 setup skillがCodex利用者をClaude画面へ案内する | **RESOLVED** | Google／Microsoft／Notionの各skillはClaudeとCodexの節を分離した。Codex節は現在hostの公式connector／認証導線を確認できた場合だけ進み、未提供・未確認なら `未確認` として停止する。Claude Settings／Connectors、Claude再起動／reload、manual token／独自OAuthへの誘導はCodex節にない。認証後はread-only smokeだけを案内する。 |
| Low: Sprint 035検査がhost名の記載だけを確認していた | **RESOLVED** | 専用検査は実Git workspaceとfake Claude canaryを使用し、副作用なしの早期停止、guard順序、Codex更新command、3 setup skillのhost別禁止事項まで検査するようになった。15/15 PASSを独立再実行した。 |

## Codex更新経路の確認

現在の `codex-cli 0.144.6` の実helpと公式Codex manualを照合した。

- 通常更新: `codex plugin marketplace upgrade [MARKETPLACE_NAME]`
- 明示的な再install: `codex plugin remove PLUGIN@MARKETPLACE` の後に `codex plugin add PLUGIN@MARKETPLACE`
- `codex plugin update` は存在しないため使用していない
- 再installは通常更新で解決しない場合に、別途明示同意を得て行う
- Plugins Directoryや実導線を確認できないCodex Appでは推測せず停止する
- Codex節にClaude commandやreload案内はない

## 完了済みの独立回帰証跡

長時間の追加suiteは再評価指示に従って中止した。以下は中断前に完了し、exit 0／0 FAILを確認できたものだけである。中断したsuiteはPASS数へ含めていない。

### agentic-secretary

| 検査 | 結果 |
|---|---:|
| `node scripts/sprint-035-test.mjs` | 15 PASS / 0 FAIL |
| `node scripts/sprint-033-test.mjs` | 20 PASS / 0 FAIL |
| `node scripts/agentic-codex-plugin-test.mjs` | 4 PASS / 0 FAIL |
| `node scripts/agentic-archive-gate.mjs` | 6 suites PASS / 0 FAIL |

archive gate内のoffline host gateは0/4 verifiedで `external-live-gate-unavailable` を返したため、外部live PASSへは数えていない。

### yasashii-secretary

| 検査 | 結果 |
|---|---:|
| `node scripts/sprint-035-test.mjs` | 15 PASS / 0 FAIL |
| `TMPDIR=/private/tmp bash scripts/sprint-018-regression.sh` | 41 PASS / 0 FAIL |
| `TMPDIR=/private/tmp node scripts/sprint-030-update-config-test.mjs` | 10 PASS / 0 FAIL |
| `TMPDIR=/private/tmp bash scripts/sprint-015-regression.sh` | 68 PASS / 0 FAIL |
| `node scripts/sprint-034-test.mjs /Users/taisei/workspace/agentic-secretary` | 11 PASS / 0 FAIL |

完了済みの直接assertionは合計184件、archive gateは6 suitesで、いずれも0 FAILだった。Sprint 018はhost未指定の既存Claude更新経路も通しており、今回のhost guard追加による互換性低下がないことを確認した。

### overlayとedition差分

- `sync-secretary-overlay.mjs --check`: `OVERLAY_CHECK_PASS`、candidate `b32cb33db5f2bd0e5a9ca4a98e30276c92bfb36c`
- `sync-secretary-overlay.mjs --reapply`: `OVERLAY_REAPPLY_PASS`、2回目の変更 `secondChanged=0`
- update runner、3 setup skill、Sprint 035検査は両editionでbyte一致
- update skillの差分はedition description、Claude配布ID、再開時の製品名だけで、Codex更新ロジックは一致
- 実装候補はoverlay確認後もcleanだった

## 公式remoteとsafe harbor

直接のonline checkerはsandbox DNS拒否、その後の実行はGitHub API 403となったため、その実行自体をPASSへ数えていない。代替のread-only `gh api` で、公式remoteのmain SHAが初回評価時と不変であることを確認した。

| edition | main SHA | version |
|---|---|---:|
| agentic Harness | `aafdf97d1f673a856c5a2a2fe72f87f1a4b57e89` | 0.5.0 |
| yasashii Harness | `8f9eb4c1d9e14414a7e94051ca6f4c34da282784` | 0.5.0 |

このremote commitと配布surfaceはRetry 1差分で変更されていないため、初回に記録済みの公式remote snapshot、README、manifest、配布ID証跡をsafe harborとして再利用した。追加の旧master suiteや不要な外部証明は要求していない。禁止されたローカルHarness checkoutには接触していない。

## Acceptance Criteria再判定

| AC | 判定 | Retry 1根拠 |
|---|---|---|
| 1 | PASS（internal） | 2 editionとClaude／Codex配布面、Codex更新の安全停止と正式commandを確認。実install／更新は外部gateへ分離 |
| 2–10 | PASS | 初回PASS証跡を再利用し、変更面回帰とoverlayを再実行 |
| 11 | PASS | 3 setup skillのClaude／Codex分離、未確認時の停止、read-only smokeを確認 |
| 12–14 | PASS | 配布identity、Harness 0.5.0 remote snapshot、edition overlay／差分保持を確認 |
| 15 | PASS（internal） | High／Medium／Low finding 0、内部release候補として必要な回帰0 FAIL。外部live gateは別記 |

## Rubric再採点

| 基準 | スコア | 閾値 | 判定 | Retry 1根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 4/5 | 4 | PASS | Codex更新と3 connector setupの内部経路が完成。実外部操作だけを別gateに残した |
| C2 構文・整合 | 5/5 | 5 | PASS | manifest、ID、version、root、remote snapshotが整合 |
| C3 機能の実証 | 5/5 | 4 | PASS | 独立canaryと変更面回帰184件、archive 6 suitesが0 FAIL |
| C4 非エンジニア体験 | 4/5 | 4 | PASS | host別に実際の次操作と安全停止を明示 |
| C5 安全・規律 | 5/5 | 5 | PASS | 外部書込み、Secret、install、release、pushは0件 |
| C6 無回帰 | 5/5 | 5 | PASS | 完了済み変更面suiteはすべてgreen。中断suiteは根拠に不使用 |
| C7 やさしさ | 4/5 | 4 | PASS | Codex利用者をClaude画面へ誤誘導しない |
| C8 wizard体験・デザイン | 5/5 | 4 | PASS | asset差分なし。同一候補の記録済み証跡をsafe harborとして再利用 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | 2 editionとClaude／Codex正式配布面を分離 |
| C10 同意・安全停止 | 5/5 | 5 | PASS | 未対応hostは副作用前に停止し、再installは別同意 |
| C11 Secret・OAuth | 5/5 | 5 | PASS | Secret値露出・外部OAuth実行なし。既存安全回帰68/68 |
| C12 リリース品質 | 5/5 | 5 | PASS | 初回High／Medium／Lowを解消し、内部候補のfinding 0 |
| C13 変更影響管理 | 5/5 | 5 | PASS | overlay、byte一致、edition固有差分、clean treeを確認 |
| C14 Harness 0.5.0整合 | 5/5 | 5 | PASS | 不変の公式remote SHAと配布metadataを確認 |
| C15 host adapter完全性 | 5/5 | 5 | PASS | Codex更新とGoogle／Microsoft／Notion setupのadapterを独立検証 |

**合計: 72 / 75 — PASS**

すべてのRubric閾値を満たした。

## 外部live gate

内部PASSに含めていない残作業は次のとおり。

1. 実Codex App／CLIでのplugin marketplace更新、必要時の明示同意付き再install
2. 実Codex hostでのGoogle／Microsoft／Notion connector提供状況と認証導線の確認
3. ユーザー承認後の実認証とread-only smoke
4. 公開、release、push

外部操作は0件。plugin install／upgrade／remove、OAuth、Secret、push、公開、release、workflow dispatchは実施していない。

## Retry 1 Evaluator self-review

- 実装、spec、progress、stateは編集していない。編集対象はこのfeedbackだけである。
- Generatorの自己評価をverdictへ流用せず、独立canary、実CLI help、実ファイル、完了済み回帰で確認した。
- 中断した長時間suiteをPASS件数へ含めていない。
- 内部PASSと `external-live-gate-unavailable` を混同していない。
- 初回findingの解消だけを変更面として再評価し、不変surfaceは記録済みsafe harborを使用した。
- 禁止されたローカルHarness checkoutには接触していない。

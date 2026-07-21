# Sprint 033 Retry 2 独立評価

## 総合判定

**FAIL — `external-live-gate-unavailable`**

Retry 2で差し戻されていた承認後live runnerの隔離契約は、ローカル実装・合成approved driver・negative testの範囲で解消を確認した。新しい `implementation-issue` は確認していない。

ただし、Sprint 033契約はClaude Code Desktop App／Claude Code CLI／Codex App／Codex CLIの4環境すべてで、fresh install、実会話、wizard表示、workspace境界、secret非露出、更新、host固有回帰、実環境またはofficial validator証跡を個別に確認することを必須としている。これらは操作別の承認が無いため **verified 0/4** であり、Sprint全体は合格にできない。

- 主分類: `external-live-gate-unavailable`
- Retry 2のローカル実装不具合: **0件**
- 4 host live: **0/4**
- Retry Countの扱い: 外部許可不足だけを理由に `implementation-issue` の連続失敗回数へ加算しない
- Escalation Recommendation: なし。追加実装ではなく、下記の操作別承認後に同じlive gateを再実行する

## Retry 2の重点結果

### [解消] 承認後live pathのruntime isolation contract

前回Highで不足していた条件は、approval schema version 2とhost resultのexact schemaへ構造化され、合成approved driverを通した正負検査で強制されることを確認した。

| 条件 | 判定 | 独立確認 |
|---|---|---|
| isolated workspace | PASS | runner所有の一時run rootと書込み可能workspaceを作り、driverのcwdをworkspaceへ固定 |
| temporary runtime HOME | PASS | 親 `HOME` をallowlistへ入れず、workspace内の合成HOMEを `env.HOME` へ固定。resultは `realHomeNotTransmitted=true` を必須化 |
| read-only plugin copy | PASS | 共通pluginを一時copyし、source/copy digest一致、write bitなし、driver write拒否、前後不変を要求 |
| workspace-scoped writes | PASS | approval/resultとも `host-path-scoped-permission` または `os-sandbox` と `approved-workspace-only` を必須化 |
| boundary rejection | PASS | workspace外canaryに対するWrite／Edit拒否の構造化recordと、runner観測の前後digest不変を両方要求 |
| limited tools | PASS | 空でない重複なしのtool list、`Bash` 不在をapprovalで要求し、driver reportとの一致を確認 |
| inspected scope | PASS | `real-home-env`、plugin source、read-only copy、approved workspace、outside-workspace canary、result outputの6対象をexact listで要求 |
| all-path cleanup | PASS | driver成功、非0終了、invalid envelope、schema不合格の各経路をcleanupへ通し、run root／workspace／合成HOME／plugin copy／canaryの削除完了をresultで要求 |
| retained result sanitization | PASS | command／args／raw stdout・stderr／credential／実filesystem pathを保持せず、既存resultを上書きしない |
| schema／cleanup不備の非昇格 | PASS | `isolation`欠落、canary denial false、cleanup incomplete、自己申告だけのreportをPASSへ昇格しない |

`node scripts/sprint-033-test.mjs` の合成driverは次を実runner入口で確認し、16 PASS／0 FAILだった。

- success: 合成HOME、workspace内write、plugin write拒否、canary拒否、12 check、8 conversation、cleanup、保持result非漏えいが成立し、host PASS
- driver failure: exit 17をhost FAILにし、cleanup完了
- self-report-only: `sanitized: true` だけのreportをhost FAILにし、cleanup完了
- path leak: 実pathを保持せずhost FAIL
- sensitive leak: synthetic Bearer値を保持せずhost FAIL
- exact result negative: `isolation`欠落、canary拒否false、cleanup未完了を拒否
- offline fake PASS: schemaが完全でもapproved runner外では `PASS is forbidden outside an approved live runner` として拒否

### 初回・Retry 1指摘の再発確認

| 指摘 | Retry 2判定 | 証跡 |
|---|---|---|
| offline／不完全recordから4/4へ偽昇格 | 解消維持 | offline gateはverified 0/4。schema-complete fake PASSも拒否 |
| live runnerが常時unavailableのstub | ローカル経路は解消 | 未承認時safe stopに加え、approval＋digest拘束driver＋隔離済みresult経路が存在 |
| approved pathの実HOME継承・隔離不足 | 解消 | 上記runtime isolation contractと合成driver正負検査が成功 |
| Agentic可読性suite破損・全回帰欠落 | 解消維持 | legacy 28/28、Agentic 12/12、全回帰12/12、archive 5/5 |
| Agentic利用者向けcopyが英語 | 解消維持 | 全copy日本語、正式名称と共通決定確認protocolを維持 |

## rubricスコア

| 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 3/5 | ≥4 | FAIL | ローカル実装は成立したが、契約必須の4 host実証が0/4 |
| C2 構文・整合 | 4/5 | 5 | FAIL | local manifest／path／schemaは0 FAIL。GitHub repo／remoteとClaude official validatorは未検証 |
| C3 機能の実証 | 3/5 | ≥4 | FAIL | local synthetic、negative、wizardは実証済み。4 host導入・実会話・更新・validatorは未実施 |
| C4 非エンジニア体験 | 4/5 | ≥4 | PASS | Agentic copyは日本語で正式名称と判断確認を維持。4 host上の実表示は未検証 |
| C5 安全・規律 | 5/5 | 5 | PASS | 未承認safe stop、secret非露出、承認済みdriverの隔離・canary・cleanup・サニタイズを確認。無許可外部操作0件 |
| C6 無回帰 | 5/5 | 5 | PASS | 全回帰12/12、専用16/16、legacy 28/28、Agentic 12/12、archive 5/5。既知失敗0件 |
| C7 やさしさ | 4/5 | ≥4 | PASS | 技術者向けの直接性、日本語、決定確認、secret規律を両立。実host会話は未検証 |
| C8 wizard体験・デザイン | 3/5 | ≥4 | FAIL | local共通wizardはdesktop／390px／200%相当で操作・撮影済み。4 hostからの起動・表示証跡は0件 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | Agentic identity、MIT、単段credit、neutral history、overlay検査が成功 |
| C10 更新の安全性 | 5/5 | 5 | PASS | full regressionでdiagnose／equal／downgrade／rollback境界が0 FAIL。無許可更新0件 |
| C11 Google Chat境界 | 5/5 | 5 | PASS | neutral digest一致とGoogle Chat 51/51。Sprint 033で共通core変更なし |
| C12 0.8.0配布準備 | 5/5 | 5 | PASS | release整合、candidate/latest/manifest/CHANGELOG/ledger、checkout／archiveが成功。0.7.0記録不変 |
| C13 edition分離・互換 | 4/5 | 5 | FAIL | local別repo、共通祖先、overlay、反対edition停止は成立。GitHub repo／remote／push／official validatorは未承認・未実施 |
| C14 会話のMarkdown可読性 | 4/5 | 5 | FAIL | local両readabilityと全回帰・archive組込みは成功。4 host実会話とMarkdown renderingは0/4 |

1軸でも閾値未達なら全体不合格である。Retry 2のローカルHighは解消したが、C1／C2／C3／C8／C13／C14がexternal live gate未完了により閾値未達であるため、総合FAILとする。

## 受入基準 AC1〜12

| AC | 判定 | 根拠 |
|---:|---|---|
| 1 | PASS（local）／外部未完了 | 指定別directory、別Git repo、neutral ancestor、132 commits、squashなし。GitHub repoは未承認で未作成 |
| 2 | PASS | 共通path、Agentic外部ID、active distributionの反対edition漏れ検査が成功 |
| 3 | PASS | neutral digest、wizard／OAuth／sync／safety byte一致、edition差4面を確認 |
| 4 | PASS（local） | 日本語technical style、正式名称、command／path／error／evidence／残課題、確認・secret規律を維持 |
| 5 | PASS | 共通core複製0件、adapter分離、approved live pathの隔離契約を正負fixtureで確認 |
| 6 | FAIL（external live gate） | 4 hostの必須12条件はverified 0/4。個別実証なし |
| 7 | PASS | offline偽PASS、schema欠落、不一致、自己申告だけ、canary／cleanup不備をnegativeで拒否 |
| 8 | FAIL（external live gate） | 共通wizard／OAuth／sync digestは一致。4 hostからの到達・表示は未検証 |
| 9 | FAIL（external live gate） | local全回帰／archiveは0 FAIL。Claude official validatorと4 host runner実行は未承認・未実施 |
| 10 | PASS | 許可外のrepo／remote／push／install／public／release操作0件 |
| 11 | PASS（offline） | 0.8.0整合、0.7.0記録維持、equal／downgrade停止、archiveを確認 |
| 12 | FAIL（external live gate） | local両readability suiteは成功。4 host実会話・Markdown rendering・wizard screenshotは0/4 |

## 実行証跡

### Git・系譜・副作用

- target repo: `/Users/taisei/workspace/agentic-secretary`
- branch: `main`
- HEAD: `b9b3753800077fc23523038cfe86ed86aea2d20a`
- parent: `24647cace0103c43fb80587703832c412d9c41d0`
- neutralization commit: `52016cf10c1c5587fbd83ff2faf3888e29282d5e`
- commit count: 132
- `git merge-base --is-ancestor 52016cf... HEAD`: exit 0
- merge-base: `52016cf10c1c5587fbd83ff2faf3888e29282d5e`
- `git status --short --branch`: `## main`、clean
- `git remote -v`: 0件
- worktree: 1件
- `git diff --check`: 出力0件
- 評価前後でHEAD／worktree／remote不変。GitHub repo作成、remote、push、plugin install、host config、public、releaseは0件

### 自動検査

| コマンド | 結果 |
|---|---|
| `python3 scripts/check-release-integrity.py` | PASS / exit 0 |
| `node scripts/sprint-033-test.mjs` | 16 PASS / 0 FAIL / exit 0 |
| `node scripts/sprint-032-patch-001-readability-test.mjs` | 28 PASS / 0 FAIL / exit 0 |
| `node scripts/agentic-readability-test.mjs` | 12 PASS / 0 FAIL / exit 0 |
| `./scripts/agentic-regression.sh` | 12 suites PASS / 0 FAIL / exit 0 |
| `node scripts/agentic-archive-gate.mjs` | 5 suites PASS / 0 FAIL / exit 0。archive内Sprint 033は14/14 |
| `node scripts/agentic-host-gate.mjs --mode offline` | structural PASS、verified 0/4、4 host全て `external-live-gate-unavailable` / exit 0 |
| `node scripts/agentic-codex-install-plan.mjs --host codex-app --repo /Users/taisei/workspace/agentic-secretary` | read-only plan / applyなし / exit 0 |
| `node scripts/agentic-codex-install-plan.mjs --host codex-cli --repo /Users/taisei/workspace/agentic-secretary` | read-only plan / applyなし / exit 0 |

`agentic-regression.sh` のsandbox内初回実行は、local wizardの `127.0.0.1` bindをsandboxが `EPERM` で拒否しexit 1となった。これは製品assertの失敗ではない。同一commandを外部通信なしの許可済み実行面で再実行し、Chatwork 35、Google Chat 51、Git safety 71、workspace／timeout 69、security 21、data causality 43、copy 66、Sprint 033、legacy／Agentic可読性、offline host gateを含む12/12・exit 0を確認した。

### 4 host未承認safe stop

次を各1回実行した。

- `node scripts/agentic-live-host-gate.mjs --host claude-code-desktop-app`
- `node scripts/agentic-live-host-gate.mjs --host claude-code-cli`
- `node scripts/agentic-live-host-gate.mjs --host codex-app`
- `node scripts/agentic-live-host-gate.mjs --host codex-cli`

全4件ともexit 2、`status=external-live-gate-unavailable`、12 checkすべてunavailable、executionは `kind=none`／`result=incomplete`、conversationは0件／incomplete、`installed=false`、`evidence=[]`、`isolation.cleanupVerified.outcome=not-run`。approval／outputは渡しておらず、driver、install、host設定、result writeは0件。

### local wizard実操作

非機密Chatwork fixtureを一時loopback `http://127.0.0.1:18765/` で起動し、Browserで実操作した。最初の起動はmacOSのsymlinkを含む既定一時pathを `working-root-unsafe` で安全停止したため、正規の `/private/tmp` を明示して再実行した。

1. 「Chatworkの接続情報を用意します。」を表示し、「接続情報の登録へ進む」をクリック。
2. 「接続情報をGitHubへ登録します。」へ遷移。
3. `Name` 欄=`CHATWORK_API_TOKEN`、`Secret` 欄=`Chatwork公式画面でご本人が取得したAPI Token` を確認。
4. API Token実値をwizard／AI会話／repo／ログへ貼らない説明を確認。Token入力欄は0件。
5. desktop 1440×900、mobile 390×844、200%相当640×800で実画面を撮影。
6. 3表示とも横overflow=false、最小control height=48px、screen=`chatwork-register-connection`。
7. browser warn／errorは0件。
8. GitHub外部linkはクリックせず、loopback serverを停止。port 18765のlistener残存0件。

スクリーンショットは本EvaluatorのBrowser証跡として取得し、target repo、親repo、`docs/evidence`へfile保存していない。これは共通wizardのlocal表示証跡であり、4 hostからのwizard起動証跡には数えない。

## External live gate

次は個別承認がなく、意図的に実行していない。これは `implementation-issue` ではないが、Sprint 033の必須受入条件を未達にする。

- GitHub repo `mtaiseeei/agentic-secretary` の作成
- target local repoへのremote追加／変更
- `main` の初回push
- Claude Code Desktop App／CLIへのfresh plugin install、reload／restart
- Codex App／CLIへのskills／AGENTS.md／config適用、reload／restart
- 4 hostそれぞれの12 checkと8 conversation scenario
- 4 hostそれぞれからのChatwork／Google Chat wizard起動、desktop／mobile／200%表示、screenshot
- Claude official validator
- public設定、release公開

public設定とrelease公開はSprint 035まで禁止であり、Sprint 033の承認候補へ含めない。

## 次に必要な個別承認

実行直前に対象、変更先、証跡、cleanupを示し、次を操作別に承認してもらう。

1. GitHub repo `mtaiseeei/agentic-secretary` の作成。
2. target local repoへのremote追加。
3. `main` の初回push。
4. Claude Code Desktop Appへのfresh install、reload、12 check、実会話8 scenario、wizard screenshot、Claude official validator、cleanup。
5. Claude Code CLIへのfresh install、restart、12 check、実会話8 scenario、wizard screenshot、Claude official validator、cleanup。
6. Codex Appへのskills／guidance／config適用、reload、12 check、実会話8 scenario、wizard screenshot、cleanup。
7. Codex CLIへのskills／guidance／config適用、restart、12 check、実会話8 scenario、wizard screenshot、cleanup。

1 hostの承認・PASSを残り3 hostへ流用しない。各hostのapproved driverは、実行fileとartifactのdigest、合成HOME、read-only plugin copy、path-scoped permissionまたはOS sandbox、canary拒否、Bashなし最小tools、検査対象、成功／失敗cleanupを明示し、resultをhostごとに分離する。

## 問題なしと確認した項目

- Retry 2のruntime isolation contractは、approval／result exact schemaと実runner合成fixtureの両方で成立。
- target repoは評価前後でclean、HEAD不変、remote 0件。
- neutralization commitはHEADの祖先で、全Git履歴を保持。
- agentic identity、candidate `0.8.0`、LICENSE、単段credit、overlay allowlistは整合。
- common-core digest、Chatwork `Name`／`Secret`案内、Google Chat scope／sync／safetyはneutral baseと一致。
- offline fake PASS、自己申告だけの隔離、canary／cleanup不備をPASSへ昇格しない。
- legacy／Agentic可読性は単独、full regression、archiveの各経路で成功。
- local wizardは3 viewportでoverflow 0、48px操作領域、Token入力0、browser error 0。
- no remote、no push、no install、no public、no releaseを維持。
- `/Users/taisei/workspace/agentic-harness` は読取り、存在確認、status、参照元利用を含め一切コマンド対象にしていない。

## 残余リスク

- 4 hostの正式配布形式、fresh install、実会話、Markdown rendering、wizard、workspace境界、secret非露出、更新、official validatorは未検証。
- GitHub repoが未作成のため、READMEの公開後install commandは現時点では実行不能。
- Claude official validatorは未実行。Codexはofficial validatorを捏造せず `null` のまま。
- 共通wizardはneutral baseとbyte一致し、legacy allowlist内の `yasashii-secretary` bannerを表示する。現契約上は許可済みだが、Agentic完成品としての利用者混同リスクは公開前に再確認すると安全である。
- 旧0.7.0 updaterの既知scanner blockerは未解消のままで、live update互換PASSを主張できない。

## Evaluator自己レビュー

- 閾値と合否は一致しているか: **yes**。local High解消後もC1／C2／C3／C8／C13／C14がexternal live gate未完了で未達。
- Generatorの自己評価を合否根拠にしたか: **no**。対象実装、正本、実行結果を独立確認した。
- Retry 2の隔離契約を実挙動で確認したか: **yes**。合成approved driverのsuccess／failure／self-report-only／path leak／sensitive leakとcleanupを実行した。
- schema不備やcleanup不備をPASSにしたか: **no**。negativeで拒否を確認した。
- `external-live-gate-unavailable` を実装不具合へ誤分類したか: **no**。4 host 0/4を別blockerとして記録した。
- offline／fixtureをlive PASSへ数えたか: **no**。verifiedは0/4のまま。
- UIを実操作したか: **yes**。非機密local wizardを3 viewportで操作・撮影し、4 host証跡とは分離した。
- 実装修正へ越境したか: **no**。書込みは本feedbackだけ。target実装、spec、contract、state、progress、Git、remoteは変更していない。
- 禁止対象へ接触したか: **no**。`/Users/taisei/workspace/agentic-harness` は読取りを含め一切触れていない。
- 外部操作を行ったか: **no**。repo作成、remote、push、install、OAuth、Secret、public、releaseは0件。

---

# Sprint 033 Retry 3 独立評価

## 総合判定

**限定修正はPASS — 新しい `implementation-issue` は0件**

Retry 3の対象だった「新規Agentic onboardingでcanonical markerと同梱template内の旧yasashii文字列を同時検出し、`update-ledger.mjs init` が `mixed` で停止する」不具合は解消した。修正前commitを一時展開した独立再現では `mixed`／ledger未作成、target commitでは実hostと同じ順序でledger作成まで成功した。

ただし、本評価はofflineの限定修正評価である。Claude Code Desktop Appのfresh reinstallと実会話は、この評価後にOrchestratorが新しい空workspaceで行う。offline host gateは引き続き **verified 0/4** であり、本結果だけでSprint 033全体や4 host verifiedへ昇格しない。

- 評価target: `1dfe2767da57d4467c989404f4952e081ffa8dfd`
- 比較base: `b9b3753800077fc23523038cfe86ed86aea2d20a`
- Retry 3限定判定: **PASS**
- 新しい `implementation-issue`: **0件**
- Sprint 033全体: **external live gate継続。offlineだけでは未完了**
- Escalation Recommendation: なし。次は同じ実hostのfresh onboarding再検証を行う

## Findings

### 新規finding

**なし。High／Medium／Lowとも0件。**

### 修正成立の確認

1. `plugins/secretary/scripts/lib/edition-guard.mjs` の抑制条件は、有効なcanonical markerをparseできた場合の `marker.edition` と、旧テキスト信号の `detectedLegacy.edition` が同時にある場合だけ成立する。marker欠落や不正markerでは旧信号を無条件に消さない。
2. `detectedLegacy.unknown` は抑制されず、`unknown` 集計へ残る。canonical markerがあってもlegacy marker fileがsymlinkなら `unknown` で停止する。
3. 旧 `.yasashii-secretary/update-ledger.json` と反対editionのcanonical ledgerは、引き続き強いedition信号として集計される。Agentic canonical markerと同居すると `mixed` で停止する。
4. canonical markerがないAGENTS／CLAUDEの旧marker・fingerprintだけのworkspaceは、`legacy=true`、detected edition `yasashii-secretary`、Agentic側では `opposite-edition` のままである。
5. target差分は3 fileだけで、共通guard変更、専用fixture、宣言的overlay allowlist追加に限定される。template、legacy marker、fingerprint、migration、scanner、wizardは変更していない。

## 修正前後の独立再現

### base commitの不具合再現

`git archive b9b3753...` を `/private/tmp` へ一時展開し、空workspaceに対して次を実行した。

1. `edition-guard.mjs --entry onboarding --prepare-new`
2. `templates/` と `workspace-templates/` の展開
3. onboarding変数置換
4. `update-ledger.mjs init`

結果は次のとおり。

```text
BASE_REPRO_PASS state=mixed detected=agentic-secretary,yasashii-secretary ledgerExit=3 ledgerCreated=false
```

Claude Code Desktop Appで観測されたexit 139はhost側での見え方であり、基礎CLIを直接実行した本再現では安全停止のexit 3だった。どちらも根本状態は `mixed` で、ledgerが作られない点が一致する。

### target commitの実順序fixture

`node scripts/sprint-033-test.mjs` の独立fixtureで、同じ順序を実行した。

- 空workspace → `prepare-new`: exit 0
- canonical marker: schemaVersion 1／edition `agentic-secretary`
- `templates/` と `workspace-templates/` 展開、変数置換後: `same-edition`
- `update-ledger.mjs init`: exit 0
- `.secretary/update-ledger.json`: schemaVersion 2
- ledger edition: `agentic-secretary`
- records: 指定された管理対象9件と完全一致

これにより、元不具合の「template展開後にmixedとなり台帳を作れない」は再現しなくなった。

## 既存安全境界の敵対的確認

実装付属fixtureとは別に、`inspectWorkspaceEdition` を直接使う8ケースを `/private/tmp` で作成し、**8 PASS／0 FAIL、exit 0** を確認した。

| ケース | 結果 |
|---|---|
| 有効Agentic canonical marker＋旧template文字列 | `same-edition` |
| canonical markerなし＋旧template文字列だけ | `opposite-edition`、`legacy=true` |
| Agentic canonical marker＋旧yasashii ledger | `mixed` |
| yasashii canonical marker＋旧template文字列 | `opposite-edition` |
| 不正canonical marker＋旧template文字列 | `unknown`、update不可 |
| Agentic canonical marker＋legacy marker file symlink | `unknown`、update不可 |
| Agentic canonical marker＋yasashii canonical ledger | `mixed` |
| Agentic canonical marker＋不正legacy ledger | `unknown`、migration不可 |

抑制対象は旧テキストmarker／fingerprintだけであり、symlink、不正marker、不正ledger、unknown、反対edition、真正mixedの安全停止を弱めていない。

## 実再現workspaceのread-only確認

`/Users/taisei/workspace/agentic-secretary-live-test` は変更せず、target guardによる状態判定だけを行った。判定前後でfile path、mode、size、mtime、symlink参照先、file bytesを含むtree digestを比較した。

```text
state=same-edition
detectedEditions=agentic-secretary
evidence=.secretary/workspace-edition.json
ledgerExists=false
treeDigestBefore=ca118b14e3e1cbbaccca0e1a934d18865962435f4a642756c495d88e9b04c186
treeDigestAfter=ca118b14e3e1cbbaccca0e1a934d18865962435f4a642756c495d88e9b04c186
unchanged=true
```

既存再現workspaceにはledgerを作らず、cleanupも行っていない。

## 実行証跡

| 検査 | コマンド | 結果 |
|---|---|---:|
| target差分 | `git diff --check b9b3753...1dfe2767` | 出力0／exit 0 |
| release validator | `python3 scripts/check-release-integrity.py` | PASS／exit 0 |
| Sprint 033専用 | `node scripts/sprint-033-test.mjs` | 17 PASS／0 FAIL／exit 0 |
| 独立edition敵対的fixture | `node --input-type=module -e '<8 cases>'` | 8 PASS／0 FAIL／exit 0 |
| 全Agentic回帰 | `./scripts/agentic-regression.sh` | 12 suites PASS／0 FAIL／exit 0 |
| Git archive相当 | `node scripts/agentic-archive-gate.mjs` | 5 suites PASS／0 FAIL／exit 0 |
| archive内Sprint 033 | archive gate内 | 15 PASS／0 FAIL |
| offline host gate | 全回帰・archive gate内 | structural PASS／verified 0/4 |

全回帰の内訳は、Chatwork 35／35、Google Chat 51／51、Git safety 71／71、workspace・timeout safety 69／69、security 21／21、data causality 43／43、copy 66／66、Sprint 033 17／17、legacy readability 28／28、Agentic readability 12／12、offline host gate structural PASSで、合計12 suites／0 FAILだった。

最初のsandbox内全回帰はlocal wizardの `127.0.0.1` bindをsandboxが `EPERM` で拒否してexit 1となった。製品assertの失敗ではない。同一commandを外部通信なしの許可済みloopback実行面で再実行し、上記12／12・exit 0を確認した。

探索時に旧 `scripts/sprint-030-edition-guard-test.mjs` をAgentic checkoutで直接実行したところexit 1となった。このscriptはyasashii editionを前提にmarker／期待状態を固定した旧Sprint単体fixtureで、Agentic用gateには登録されていない。Retry 3の新規失敗ではなく、対象の安全分岐は上記のAgentic専用17件、独立8件、全回帰、archiveで確認した。

## Git・副作用

- target repoは評価前後ともHEAD `1dfe2767...`、worktree clean、`origin=https://github.com/mtaiseeei/agentic-secretary.git` 1件、`origin/main` より1 commit aheadで不変。
- target差分は `adapters/agentic-overlay.json`、`plugins/secretary/scripts/lib/edition-guard.mjs`、`scripts/sprint-033-test.mjs` の3 file。
- 本Evaluatorによるtarget実装の変更は0件。
- 本EvaluatorがHarness正本repoに加えた変更は本feedbackだけ。既存のstate／progress／spec／contractは編集していない。
- `/Users/taisei/workspace/agentic-harness` は読取り、書込み、存在確認、command対象化を含め一切接触していない。
- push、remote変更、public設定、release、plugin install／update、host導入、OAuth、Repository Secret操作は0件。

## 次のlive再検証scenario

Orchestratorは既存の `/Users/taisei/workspace/agentic-secretary-live-test` を変更・cleanupせず、別の新しい空workspaceでClaude Code Desktop Appをfresh再検証する。

1. current target bytesを使ってClaude Code Desktop Appをfresh install／reloadする。
2. Claude official validatorを実行し、対象plugin rootと結果を記録する。
3. 新しい空workspaceで `/agentic-secretary:secretary` を起動し、4つのstructured questionへ回答する。
4. 実順序が `prepare-new → canonical marker → templates展開 → update-ledger init` で進むことを記録する。
5. `.secretary/workspace-edition.json` がedition `agentic-secretary`、`.secretary/update-ledger.json` がschemaVersion 2／edition `agentic-secretary`／9 recordsであることを確認する。
6. onboardingの利用者向け完了報告まで到達し、stderrに `mixed`、exit 139、edition guard停止が無いことを確認する。
7. workspace外変更0、secret露出0、read-only plugin copy不変、cleanup完了をhost証跡へ残す。
8. このhostだけの結果として記録し、Claude Code CLI／Codex App／Codex CLIへ流用しない。

このlive scenarioがPASSして初めてClaude Code Desktop Appの今回の修正を実host合格へ進められる。残り3 hostは各hostのfresh install、実会話、wizard、更新、安全境界、host固有回帰を個別に確認するまでverifiedにしない。

## Evaluator自己レビュー

- 元不具合をtargetだけでなくbase commitで再現したか: **yes**。
- canonical markerが有効な場合だけ旧テキスト信号を抑制することを確認したか: **yes**。
- legacy-only、真正mixed、symlink、不正marker／ledger、unknown、opposite editionを確認したか: **yes**。
- 実hostと同じ順序でledger schemaとrecordsを確認したか: **yes**。
- 専用test、release validator、全回帰、archive gateを実行したか: **yes**。
- offline結果を4 host verifiedへ昇格したか: **no**。verified 0/4のまま。
- 実再現workspaceを変更・cleanupしたか: **no**。前後digest一致。
- 実装修正へ越境したか: **no**。target変更0件。
- 禁止対象へ接触したか: **no**。

---

# Sprint 033 Codex正式Plugin改訂 独立評価

## 総合判定

**formal Codex Plugin改訂はPASS — 新しい `implementation-issue` は0件**

target commit `1228d592b1bc1e81bacee0ee7eb9245955c91582` で追加されたCodex正式manifest、
repository marketplace、Codex App／CLI adapter、導入・更新案内、合成HOME／CODEX_HOME回帰は、
改訂後のSprint 033契約に適合した。Claude用manifest／marketplaceを維持しながら、Codex用の
`.codex-plugin/plugin.json` と `.agents/plugins/marketplace.json` が同じ物理skills tree 15件を参照する。
legacy Claude marketplaceまたは手動skillsだけではformal PASSにならず、Codex CLI 0.144.6が合成環境内で
marketplace追加、plugin install、cache生成、15 skills読込まで実際に受理した。

ただし、これはformal／offline配布面の限定評価である。Codex App／CLIを含む4 hostのfresh install、
新しいchat／session、明示／自然言語trigger、会話8面、wizard、workspace境界、secret非露出、
update／cache反映は未完了で、host gateは **verified 0/4** のままである。C15は5/5必須なので、
Sprint 033全体は `external-live-gate-unavailable` により未完了／不合格であり、`done` にはできない。

- 評価target: `1228d592b1bc1e81bacee0ee7eb9245955c91582`
- target branch: `main`
- Git状態: worktree clean、`origin/main` より2 commits ahead、未push
- formal Codex改訂: **PASS**
- 新しい `implementation-issue`: **0件**
- 4 host live: **verified 0/4、`external-live-gate-unavailable`**
- Sprint 033全体: **未完了／FAIL**
- Escalation Recommendation: implementation retryは不要。許可済み範囲でhost別live gateを継続する

## Findings

### 製品implementation finding

**なし。High／Medium／Lowとも0件。**

### Harness作業運用違反（製品findingとは分離）

Generatorは作業開始時にtargetを限定しない `find .. -name AGENTS.md -print` を実行し、最優先禁止対象repo内の
`AGENTS.md` path名2件を出力したと自己申告している。これは「存在確認、path列挙、command対象化を含め全面禁止」
という作業契約への明確な違反である。

この過去の運用違反は製品commitを修正して解消できる性質ではなく、target差分にも禁止repo由来の製品実装混入は
確認されなかったため、新しい `implementation-issue` には分類しない。一方、C5の規律を完全遵守したGenerator実行と
表示することもできない。したがって、formal製品コードの限定PASSとHarness運用違反を別集計し、過去事実を残す。

確認できる事実は、Generatorの自己申告とstate記録にある「path名2件が出力された」こと、および現在のtarget差分に
当該repoからの複製と判断できる変更がないことまでである。「内容open／read、write、Git操作、複製が0件」はGeneratorの
自己申告であり、本Evaluatorが過去のprocess全体を独立監査して証明した事実としては扱わない。

本Evaluator自身は、禁止対象repoの存在確認、path列挙、read、write、Git、複製元利用を行っていない。

## manifest／marketplaceの独立確認

### Codex plugin manifest

`plugins/secretary/.codex-plugin/plugin.json` は次を満たす。

- name `agentic-secretary`
- version `0.8.0`（strict semver）
- 非空description、`author.name=mtaiseeei`
- `homepage`／`repository` は `https://github.com/mtaiseeei/agentic-secretary`
- `license=MIT`
- `skills=./skills/`
- 必須interface metadata、3件のdefault prompt、`#RRGGBB` brand color
- 実在しない `apps`、`mcpServers`、unsupported `hooks` の宣言0件
- `[TODO: ...]` placeholder 0件

### Codex repository marketplace

repo rootの `.agents/plugins/marketplace.json` は次を満たす。

- marketplace name `agentic-secretary`
- `interface.displayName=Agentic Secretary`
- plugin name `agentic-secretary`
- local source path `./plugins/secretary`
- `policy.installation=AVAILABLE`
- `policy.authentication=ON_INSTALL`
- `category=Productivity`

Claude用 `.claude-plugin/marketplace.json` と `plugins/secretary/.claude-plugin/plugin.json` は残っており、
Claude／Codexのversionと外部nameも `0.8.0`／`agentic-secretary` で一致する。

## 共通skillsとnegative

- `SKILL.md` は `plugins/secretary/skills/` の15件だけである。
- `.agents/skills`、`adapters/codex-app/skills`、`adapters/codex-cli/skills` は存在しない。
- Claudeはplugin rootのdefault discovery、Codexはmanifestの `./skills/` を使い、同じ物理treeを参照する。
- legacy Claude marketplaceと手動 `.agents/skills` を置いたfixtureはformal Codex marketplace欠落で拒否される。
- formal marketplaceだけを追加してもCodex plugin manifest欠落で拒否される。
- host adapterは `distribution.kind=codex-plugin-marketplace` を必須にし、fallback `AGENTS.md`／
  `config.toml`だけの構成を正式PASSへ昇格しない。

## 導入・更新案内

README、`docs/guide/getting-started.md`、`docs/guide/updates.md`、Codex App／CLI adapter READMEを確認した。

- CLI主導線は `codex plugin marketplace add mtaiseeei/agentic-secretary --ref main` →
  `codex plugin add agentic-secretary@agentic-secretary` → `codex plugin list --marketplace agentic-secretary`。
- `codex plugin marketplace add`、`plugin add`、`plugin list --marketplace` の構文はCodex CLI 0.144.6の
  各 `--help` と一致した。
- install後は新しいCLI session、AppではPlugins Directoryからinstall後に新しいchatを開始する。
- `$secretary` または自然言語triggerを案内する。
- 更新は `codex plugin marketplace upgrade agentic-secretary` によるGit marketplace snapshot refresh、
  再install、installed version、新しいsession／chatを分けて説明する。
- cacheを直接編集せず、存在しないplugin単体の自動upgradeを主張しない。
- manual `AGENTS.md`／`config.toml`／skills routeはauthoring、isolated test、fallbackへ明確に降格されている。
- live未実行statusは全案内で `external-live-gate-unavailable` のままであり、formal／offlineを対応済みへ昇格しない。

## Codex CLI合成環境の独立実行

`node scripts/agentic-codex-plugin-test.mjs` を実行し、**4 PASS／0 FAIL、exit 0** を確認した。

1. `/private/tmp/agentic-codex-cli-*` のrunner-owned一時root内だけに合成HOMEと合成CODEX_HOMEを作成。
2. 環境変数をPATH、CODEX_HOME、HOME、TMPDIR、LANGへ限定。
3. local repository marketplaceをCodex CLI 0.144.6へ追加。
4. available plugin `agentic-secretary@agentic-secretary`／version `0.8.0` を確認。
5. plugin install後のpathが合成CODEX_HOMEの `plugins/cache/` 内であることを確認。
6. cacheのmanifestが `skills=./skills/`、SKILL.mdが15件、各skill digestがsourceと一致。
7. installed pluginがenabled／version `0.8.0`。
8. source pluginの全file digest mapが前後一致。
9. 合成HOME、CODEX_HOME、negative fixtureを含む一時rootが実行後に残っていない。

実ユーザーのCodex config、auth、cache、実HOMEは使用・変更していない。このlocal ingestionはGitHub shorthand、
Codex App操作、新しい実sessionでの会話を証明しないため、live PASSには数えていない。

## official validatorの扱い

`plugin-creator` skillの `SKILL.md`、`references/plugin-json-spec.md`、
`references/installing-and-updating.md`、`scripts/validate_plugin.py` を全文確認した。

利用可能な3つのPython executableで `import yaml` を確認したが、すべて
`ModuleNotFoundError: No module named 'yaml'` だった。依存installは禁止されているため、
plugin-creator Python validatorは**未実行**である。official validator PASSとは表示しない。

代替証拠は次のとおりで、formal配布面の限定判定には十分と判断した。

- validator sourceとskill referenceに対する独立field／path検査
- Codex CLI 0.144.6によるmanifest／marketplaceの実ingestion
- release validator、Sprint専用test、Gitなしarchive内での同じCodex test
- Claude側については `claude plugin validate plugins/secretary` がPASS

## 実行証跡

| 検査 | コマンド | 結果 |
|---|---|---:|
| Codex formal＋合成CLI | `node scripts/agentic-codex-plugin-test.mjs` | 4 PASS／0 FAIL |
| Sprint 033専用 | `node scripts/sprint-033-test.mjs` | 18 PASS／0 FAIL |
| release整合 | `python3 scripts/check-release-integrity.py` | PASS |
| Claude validator | `claude plugin validate plugins/secretary` | PASS |
| 全Agentic回帰 | `bash scripts/agentic-regression.sh` | 13 suites PASS／0 FAIL |
| Gitなしarchive | `node scripts/agentic-archive-gate.mjs` | 6 suites PASS／0 FAIL |
| archive内Sprint 033 | archive gate内 | 16 PASS／0 FAIL |
| archive内Codex formal | archive gate内 | 4 PASS／0 FAIL |
| offline host gate | 全回帰・archive gate内 | structural PASS／verified 0/4 |
| diff／Node構文 | `git diff --check`、`node --check` | 出力0／exit 0 |

全回帰のsandbox内初回実行はloopback wizardの `127.0.0.1` bindを `EPERM` で拒否されてexit 1となった。
製品assertの失敗ではない。同一commandを許可済みloopback実行面で再実行し、最終行
`AGENTIC_REGRESSION_PASS=13 FAIL=0`、exit 0を確認した。

## Git・副作用

- 評価前後のtarget HEADは `1228d592b1bc1e81bacee0ee7eb9245955c91582` で不変。
- targetは評価前後ともworktree clean、`origin/main`より2 commits ahead、pushなし。
- target変更scopeはorigin/main比23 paths、今回commit単体22 paths。Codex formal配布入口、adapter、guide、
  validator／regressionと、直前のedition guard限定修正であり、wizard、OAuth scope、同期実装の変更はない。
- push、remote変更、public、release、実host install、OAuth、Repository Secret操作は0件。
- 評価中のPython構文確認がtarget内に未追跡 `scripts/__pycache__/` を生成した。これは本Evaluator自身の
  一時artifactで、直ちにそのexact directoryだけを削除した。tracked file変更は0件で、最終statusはclean。
  target read-only運用からの一時逸脱としてここに開示する。
- Harness正本repoで本Evaluatorが変更したのは本feedbackだけ。spec、contract、state、progressは編集していない。
- 本Evaluatorは最優先禁止対象repoの存在確認、path列挙、read、write、Git、複製元利用を行っていない。

## 残るlive gate

formal配布面のPASS後も、次をhost別に個別実証するまでC15は5/5にならない。

1. Codex CLIでGitHub shorthand marketplace追加、fresh install、plugin list、新しいsession。
2. Codex CLIで15 skill一意discover、明示／自然言語trigger、会話8面、wizard、安全境界、更新／cache反映。
3. Codex AppのPlugins Directoryでsource選択、details、install済み表示、新しいchat。
4. Codex Appで同じ15 skill、trigger、会話8面、wizard、安全境界、更新操作を実画面screenshotつきで確認。
5. 既に一部実行済みのClaude Code Desktop App／CLIも、12条件を満たすhost recordへ正規集計する。
6. offline／合成／一方のhost結果を他hostへ流用しない。

## Evaluator自己レビュー

- Generatorの自己評価を判定根拠にしたか: **no**。target、CLI help、manifest、marketplace、testを独立確認した。
- formal manifest／marketplaceを実CLIへingestしたか: **yes**。合成HOME／CODEX_HOME内だけで実行した。
- legacy／manual fallbackをformal PASSに数えたか: **no**。negative拒否を確認した。
- Codex App／CLI liveをverifiedへ昇格したか: **no**。verified 0/4のまま。
- plugin-creator validator未実行をofficial PASSと表示したか: **no**。
- Generator運用違反を隠したか: **no**。製品findingと分離し、証明範囲を限定した。
- 本Evaluatorの一時artifact生成を隠したか: **no**。生成・exact cleanup・最終cleanを記録した。
- target実装修正、spec、contract、state、progressへ越境したか: **no**。最終tracked差分0件。
- 禁止対象repoへ接触したか: **no**。

---

# Sprint 033 Retry 2 wizard identity 独立再評価

## 総合判定

**Retry 2の限定修正はPASS — High 0／Medium 0／Low 0**

target commit `467043802ea030b67d092d86761caffa84675d61` を、直前に独立PASS済みのbase
`014680ec9e7be51953e7d7c41835c5d9a08bd55e` と比較した。Agentic版のChatwork／Google Chat wizardで
title、上部banner、画面遷移後のdocument titleへ旧製品名 `yasashii-secretary` が配信される問題は解消している。

ChatworkとGoogle Chatをそれぞれloopbackのephemeral portで実起動し、HTTPで配信された `/` と
`/common.js` を直接確認した。両方で次を確認した。

- `<title>接続設定 — agentic-secretary</title>`
- `<p class="product">agentic-secretary</p>`
- `document.title = `${detail.context} — agentic-secretary``
- 上記2 responseを連結した配信bytes中の `yasashii-secretary` は0件

このRetry 2では視覚layout、色、responsive品質を再採点していないため、screenshotは合否根拠にしていない。
実配信response、共通DOM／focus／accessibility回帰、変更pathのbyte差分を根拠にした。

ただし、targetはまだ`origin/main`より1 commit aheadで、修正版のmarketplace refresh、Codex／Claude plugin再導入、
新しいsession／chatでの4 host再検証は行われていない。既存の会話証拠はbaseまでのplugin bytesに対する証拠であり、
今回commitへ流用しない。したがって、Retry 2のimplementationはPASSだが、Sprint 033全体は
**incomplete**、C15は未達のままとする。

## finding

- High: **0件**
- Medium: **0件**
- Low: **0件**
- failure classification: 新しい `implementation-issue` なし
- Escalation Recommendation: **none**

## identity解決とsafe stop

`plugins/secretary/scripts/lib/wizard-product-identity.mjs` は、wizard assetや環境変数から表示名を推測せず、
次の正式metadataを突き合わせてidentityを返す。

1. `edition.json` の `edition`
2. `edition.json` の `distribution.marketplaceId` と `distribution.pluginId`
3. 配布物に存在するClaude／Codex formal manifestの `name`

targetではedition、Claude manifest、Codex manifestはいずれも `agentic-secretary`、versionは両manifestとも
`0.8.0`で一致する。独立fixtureではyasashii editionと両manifestを `yasashii-secretary` に揃えた場合、
元のwizard HTMLがbyte-for-byteで維持された。また、Claude manifestだけ、Codex manifestだけをそれぞれ
反対editionへ変えた両caseで、identity不一致errorによりwizard起動前に停止した。未対応edition、壊れたJSON、
配布識別子不一致、formal manifest不在も実装とSprint専用negative testで拒否される。

## 共通wizard機能の非回帰

baseからtargetへの変更は5 path、**117 insertions／2 deletions**である。

- `adapters/agentic-overlay.json`
- `plugins/secretary/scripts/lib/wizard-product-identity.mjs`
- `plugins/secretary/skills/chatwork/scripts/wizard-server.mjs`
- `plugins/secretary/skills/google-chat/scripts/wizard-server.mjs`
- `scripts/sprint-033-test.mjs`

共通HTML／JS／CSS asset、Chatwork／Google Chatの設定transaction、Google Chat client、OAuth session、syncは
baseからbyte差分0件だった。2つのserver差分は同じidentity helperのimport、plugin rootからの起動時解決、
`index.html`／`common.js` responseへの表示名適用だけであり、API route、mutation、OAuth、sync、Secret処理を
変更していない。

独立回帰では次を確認した。

- 共通wizard shell、screen inventory、headingのaccessible name、focus／caret復元、detailsのkeyboard操作、
  44px以上の操作領域: Sprint 027 copy test **66 PASS／0 FAIL**
- Chatwork Name／Secret欄のexact案内、Token値のDOM／会話非露出: readability test **28 PASS／0 FAIL**
- OAuth read-only 3 scope、PKCE／state、loopback、Secretのstdin登録、token非永続化、初回sync、schedule同意、
  cleanup、Chatwork／Google Chatの設定・履歴・Git境界: 全Agentic回帰内でPASS
- wizard session／Origin／Content-Type／method拒否、並行callback／初回syncの単一実行、資格情報非露出:
  Sprint 023 security test **21 PASS／0 FAIL**

## 実行証拠

| 検査 | コマンド／実行面 | 結果 |
|---|---|---:|
| Sprint 033専用 | `node scripts/sprint-033-test.mjs` | 20 PASS／0 FAIL |
| Agentic Codex plugin | `node scripts/agentic-codex-plugin-test.mjs` | 4 PASS／0 FAIL |
| Claude validator | `claude plugin validate plugins/secretary` | PASS |
| release整合 | `python3 scripts/check-release-integrity.py` | PASS |
| 全Agentic回帰 | `bash scripts/agentic-regression.sh`（loopback許可面） | 13 suites PASS／0 FAIL、exit 0 |
| Gitなしarchive | `node scripts/agentic-archive-gate.mjs` | 6 suites PASS／0 FAIL |
| archive内Sprint 033 | archive gate内 | 18 PASS／0 FAIL |
| archive内Codex formal | archive gate内 | 4 PASS／0 FAIL |
| 実配信Chatwork | loopbackでserver起動 → HTTP GET `/`、`/common.js` | Agentic title／banner／dynamic title、旧ID 0件 |
| 実配信Google Chat | synthetic・private bypassでloopback起動 → HTTP GET `/`、`/common.js` | Agentic title／banner／dynamic title、旧ID 0件 |
| yasashii互換＋mismatch negative | 独立Node fixture | yasashii byte一致、Claude／Codex各manifest不一致をsafe stop |
| diff | `git diff --check 014680e..4670438` | 出力0／exit 0 |

通常sandboxでの最初の全回帰試行はSprint 023が `127.0.0.1` bindを `EPERM`で拒否された。製品assertの
失敗ではない。同suiteをloopback許可面で再実行して21／21、全回帰も同じ許可面で最終
`AGENTIC_REGRESSION_PASS=13 FAIL=0`、exit 0を確認した。

## Git・副作用

- 評価前後のtarget HEADは `467043802ea030b67d092d86761caffa84675d61`、worktree clean。
- `origin/main` は `014680ec9e7be51953e7d7c41835c5d9a08bd55e`。targetは1 commit aheadで未push。
- 本Evaluatorによるpush、remote変更、marketplace refresh、plugin導入／再導入、App書込み操作、public化、
  Release、OAuth、Repository Secret操作は0件。
- localhost確認はGETだけで、wizardのmutation APIを呼び出していない。2つのserverは確認後に停止した。
- 独立identity fixtureは`/private/tmp`配下だけに作成し、検査後に削除した。
- Harness正本repoで変更したのは本feedbackへの追記だけ。spec、contract、state、progress、target実装は編集していない。
- 最優先禁止対象repoは存在確認、path列挙、read、write、Git、複製元利用を含め一切対象にしていない。

## Retry 2限定スコア

| 基準 | 評価 | 根拠 |
|---|---:|---|
| 機能完全性 | 5/5 | 両wizardの実配信3表示面でAgentic identity、旧ID 0件 |
| 動作安定性 | 5/5 | 両manifest一致、yasashii互換、両manifest不一致safe stop |
| エラーハンドリング | 5/5 | 不正edition／配布識別子／manifestを起動前に明示停止 |
| 回帰なし | 5/5 | 全Agentic 13／13、archive 6／6、専用20／20、関連安全・UX回帰0 FAIL |

## Sprint 033全体の残条件

1. target `4670438` をprivate `origin/main`へ通常pushする。
2. Codex marketplace snapshotとClaude pluginを正規手順で更新し、cacheを直接編集せずcurrent target bytesを再導入する。
3. Codex CLIとClaude Code CLIをそれぞれfresh sessionで検証し、12条件、会話8面、wizard identity、
   read-only診断、workspace／secret境界をhost固有のformal resultへ記録する。
4. Codex AppとClaude Code Desktop Appをそれぞれ新しいchatで検証し、CLI証拠を流用せず、実画面screenshotを含む
   host固有のformal resultへ記録する。
5. 4 hostすべてがcurrent target bytesで個別PASSした後だけC15を5/5、Sprint 033をdoneへ進める。
6. public化とRelease公開はSprint 035まで行わない。

## Evaluator自己レビュー

- Generatorの自己評価を判定根拠にしたか: **no**。commit差分、実配信response、独立fixture、各suiteを再実行した。
- Chatwork／Google Chatの片方だけで判断したか: **no**。両serverを別々に実起動した。
- yasashii互換をAgentic表示から推測したか: **no**。yasashii両manifest fixtureと元assetのbyte一致を確認した。
- manifest mismatchを静的読解だけで判断したか: **no**。Claude／Codex双方の不一致caseを実行した。
- layout／視覚品質をscreenshotなしで再採点したか: **no**。今回の限定スコアはidentity、安定性、安全停止、回帰だけである。
- baseまでの4 host証拠をtargetへ流用したか: **no**。Sprint全体はincompleteのままにした。
- target実装、spec、contract、state、progressへ越境したか: **no**。

- 禁止対象repoへ接触したか: **no**。
- external操作を行ったか: **no**。

# Sprint 033 live証跡 限定再評価

## 総合判定

**FAIL — `implementation-issue` + live host未完了**

今回受領した実環境証跡では、Codex CLIとClaude CLIの導入・会話・wizardについて前進がある。一方、CLIの手動証跡をAppへ流用せず、手動会話をexact approval/result schemaのformal host PASSへ読み替えない条件では、4 hostのformal PASSは依然 **0/4** である。さらにCodex CLIの読み取り専用診断で、再開しおりの有無を誤判定する製品不具合を独立再現したため、外部未完了だけではなく `implementation-issue` を主分類に戻す。

## [High] 読み取り専用sandboxで `resume-check` がしおり有無を判別できない

`plugins/secretary/scripts/lib/path-guard.sh:61` の
`IFS='/' read -r -a components <<< "$candidate"` はhere-string、つまりshellが内部で一時ファイルを必要とする入力方法である。file writeを禁止した読み取り専用sandboxで `memory-tools.sh resume-check` を実行し、次を独立再現した。

```text
path-guard.sh: line 61: cannot create temp file for here document: Operation not permitted
path-guard.sh: line 53: components[@]: unbound variable
sandboxed_resume_check_exit=1
```

`memory-tools.sh:369` は `_safe_path` の失敗を一律 `exit 1` に変換し、`memory-tools.sh:370` の「`_resume.md` が存在しない場合」も同じ `exit 1` を返す。そのため、read-only診断では「安全なpathを確認できなかった」と「しおりが無い」を区別できず、実在するしおりを見落とし得る。起動時に最優先で行う再開確認とread-only diagnosisの実利用面を壊すため、環境由来の未完了ではなく製品の `implementation-issue` と判定する。

必要な修正は、`_safe_working_root` のcomponent分解を一時ファイル不要の方法へ置き換え、file write禁止sandboxでも `_safe_path` が成功する回帰testを追加すること。さらに `resume-check` は「しおり無し」と「path guard内部失敗」を別statusまたは明示errorで区別する必要がある。

## host別の限定判定

| host | 今回の証拠 | 判定 |
|---|---|---|
| Codex CLI | real plugin 0.8.0 installed/enabled、15 skills digest一致、fresh session、8会話面、Chatwork normal loopback wizard、bootstrap 200、Git不変を受領 | **FAIL / implementation-issue**。`resume-check`不具合を独立再現。manual証跡をformal resultへ水増ししない |
| Claude CLI | local plugin 0.8.0 enabled、8会話面、wizard bytes一致を受領 | **incomplete**。exact approval/result schemaのhost PASS未提示 |
| Codex App | CLI結果を流用しない | **incomplete** |
| Claude Code Desktop App | CLI結果を流用しない | **incomplete** |

product repoは `1228d592b1bc1e81bacee0ee7eb9245955c91582`、live-test repoは `f288c58347b8cd2a65f8b51f8b0d7ff5a383ed16` で、それぞれ `HEAD == origin/main`、worktree cleanを独立確認した。両GitHub repoがprivate、test Secret 0、schedule無効という外部状態は今回の引継ぎ証跡として受領したが、追加のremote操作は行っていない。

## 次の再評価条件

1. 上記read-only sandbox互換を実装修正し、しおり有／無／guard失敗の3状態を独立回帰で確認する。
2. Codex CLIを修正版のfresh sessionで再実行し、今回のdiagnosisを含む12条件と8会話面をformal host resultへ正規集計する。
3. Claude CLIも既存manual証跡をexact schemaのhost resultへ正規集計する。
4. Codex AppとClaude Code Desktop Appは、それぞれ実画面・新規chat・wizard・安全境界を個別に確認する。

この4 hostが個別にPASSするまで、Sprint 033全体は完了扱いにしない。

---

# Sprint 033 Retry 4 独立再評価

## 総合判定

**Retry 4の実装修正はPASS — 新しいimplementation findingは0件**

target commit `014680ec9e7be51953e7d7c41835c5d9a08bd55e` は、前回High findingだった
read-only sandbox内の `resume-check` 誤判定を、指定された4 fileの範囲で解消した。base commit
`1228d592b1bc1e81bacee0ee7eb9245955c91582` とtargetを別々のGit archiveへ展開し、通常fileへの
書込みを禁止したmacOS sandboxで独立比較した結果、baseだけがhere-string用一時fileを作れずexit 1に
潰れ、targetはしおり有／無／guard拒否を契約どおり区別した。

ただし、この判定はRetry 4の製品修正に対する限定PASSである。targetはまだ`origin/main`より1 commit
aheadで、修正版のmarketplace refresh／実plugin再導入／fresh session・chat検証は未実施である。
Codex App、Claude Code Desktop Appを含む4 hostのformal live resultも完成していないため、C15は5/5に
到達せず、Sprint 033全体は引き続きactive相当／未完了とする。manual CLI証跡をAppへ流用しない。

- 評価target: `014680ec9e7be51953e7d7c41835c5d9a08bd55e`
- base: `1228d592b1bc1e81bacee0ee7eb9245955c91582`
- Retry 4実装: **PASS**
- finding severity: **High 0／Medium 0／Low 0**
- Sprint 033全体: **incomplete**（4 host live gate未完了）
- failure classification: 新しい `implementation-issue` なし

## 旧不具合と修正版の独立比較

外部通信を許可せず、sandbox profileで通常fileへの `file-write*` を拒否し、標準deviceの
`/dev/null` だけを許可して実行した。これにより、製品内の既存 `2>/dev/null` は通常どおり使える一方、
here-string／一時fileは作れない条件にした。

### base commit

実在する `memory/_resume.md` に対してexit 1となり、次を再現した。

```text
path-guard.sh: line 61: cannot create temp file for here document: Operation not permitted
path-guard.sh: line 53: components[@]: unbound variable
```

これは前回findingと同じ原因であり、targetの結果と混同していない。

### target commit

同じ書込み禁止条件で次を確認した。

| case | 期待 | 実結果 |
|---|---:|---:|
| 実在する `memory/_resume.md` | exit 0 | exit 0 |
| しおり無し | exit 1 | exit 1 |
| base自体がsymlink | exit 3＋日本語error | exit 3＋「秘書ディレクトリが symlink」 |
| 途中componentがsymlink | exit 3＋日本語error | exit 3＋「秘書ディレクトリが symlink」 |
| baseが存在しない | exit 3＋日本語error | exit 3＋「秘書ディレクトリが見つかりません」 |
| macOS `/tmp` root alias | exit 0 | exit 0 |
| `..`を含むが同じ実体へ戻るbase | exit 0 | exit 0 |

`_safe_working_root` の対象実装はparameter expansionだけでcomponentを分解し、here-string、here-doc、
配列への `read`、一時fileを使わない。`resume-check` は `_safe_path` の非0を
`_guard_reject`へ渡すため、guard失敗を「しおり無し」のexit 1へ潰さない。

## 封じ込めとscope

Sprint 022 safety suiteを独立実行し、**69 PASS／0 FAIL**を確認した。最終要素／途中ancestor／working
rootのsymlink、外部repo symlink、link-only削除、外部sentinel不変、timeout後の部分副作用0件を含む。
追加の独立caseでも途中symlinkをexit 3で拒否し、macOS root aliasと正規の `..` pathは維持した。

baseからtargetへの変更は次の4 fileだけで、**67 insertions／8 deletions**だった。

- `adapters/agentic-overlay.json`
- `plugins/secretary/scripts/lib/path-guard.sh`
- `plugins/secretary/skills/memory-care/scripts/memory-tools.sh`
- `scripts/sprint-033-test.mjs`

Chatwork／Google Chat wizard、OAuth scope、同期処理、会話style、Claude／Codex manifest、marketplace、
version、CHANGELOG、README／guideにはcommit差分がない。overlay変更も上記2 production fileのexact path追加
だけであり、広いglob追加ではない。

## 実行証跡

| 検査 | コマンド／実行面 | 結果 |
|---|---|---:|
| shell構文＋Sprint 033 | `bash -n ... && node scripts/sprint-033-test.mjs` | 19 PASS／0 FAIL |
| Sprint 022 safety | `node scripts/sprint-022-safety-test.mjs` | 69 PASS／0 FAIL |
| 全Agentic回帰 | `bash scripts/agentic-regression.sh`（loopback許可面） | 13 suites PASS／0 FAIL、exit 0 |
| Gitなしarchive | `node scripts/agentic-archive-gate.mjs` | 6 suites PASS／0 FAIL |
| archive内Sprint 033 | archive gate内 | 17 PASS／0 FAIL |
| archive内Codex formal | archive gate内 | 4 PASS／0 FAIL |
| release整合 | `python3 scripts/check-release-integrity.py` | PASS |
| diff | `git diff --check` | 出力0／exit 0 |

全Agentic回帰の通常sandbox実行は、wizard testの `127.0.0.1` bindをhost sandboxが `EPERM`で拒否して
exit 1となった。製品assertの失敗ではないため、契約どおり同一commandをloopback許可面で再実行し、
最終行 `AGENTIC_REGRESSION_PASS=13 FAIL=0` とexit 0を確認した。

## Git・外部副作用

- targetは評価前後ともHEAD `014680ec9e7be51953e7d7c41835c5d9a08bd55e`、worktree clean。
- `origin/main` は `1228d592b1bc1e81bacee0ee7eb9245955c91582`。targetは1 commit aheadで、
  Retry 4 commitは未push。
- GitHub repoはprivate、default branchは`main`、release件数0をread-only APIで確認した。
- 本Evaluatorによるpush、remote変更、marketplace refresh、plugin install／reinstall、App操作、public化、
  release、OAuth、Repository Secret操作は0件。
- base／target比較用に作成した2つのexactな一時directoryは評価後に削除し、不在を確認した。
- Harness正本repoで本Evaluatorが変更したのは本feedbackへの追記だけ。spec、contract、state、progressは
  編集していない。
- 最優先禁止対象repoは存在確認、path列挙、read、write、Git、複製元利用を含め一切対象にしていない。

## 次の外部手順と再評価条件

1. target commit `014680e` をprivate `origin/main`へ通常pushする。
2. Codex marketplace snapshotを正規commandでrefreshし、cacheを直接編集せず0.8.0 pluginを再導入する。
3. 新しいCodex CLI sessionでread-only診断を再実行し、実在するしおりをexit 0として認識すること、
   12条件、会話8面、wizard、安全境界、更新／cache反映をCodex CLIだけのformal resultへ記録する。
4. Codex AppはPlugins Directoryの更新／再導入後に新しいchatを作り、実画面screenshotつきで同じ必須面を
   App固有resultへ記録する。CLI証跡は流用しない。
5. Claude Code CLIもcurrent target bytesへ更新後、新しいsessionで12条件をformal resultへ記録する。
6. Claude Code Desktop Appもcurrent target bytesへ更新／reloadし、新しいchat、wizard、境界、会話8面を
   App固有resultへ記録する。CLI証跡は流用しない。
7. 4 hostすべてが個別PASSした後だけC15を5/5、Sprint 033をdoneへ進める。public設定とrelease公開は
   Sprint 035まで行わない。

## Evaluator自己レビュー

- baseとtargetを分離して旧不具合を再現したか: **yes**。
- 通常file書込み禁止条件でtargetの3状態を確認したか: **yes**。
- symlink、`..`、境界、macOS root aliasを確認したか: **yes**。
- wizard／OAuth／sync／style／manifest／versionへの漏れを確認したか: **yes**。
- Sprint 033、Sprint 022、全Agentic、archive、release、diffを実行したか: **yes**。
- offline／manual CLI証跡をAppまたは4 host PASSへ昇格したか: **no**。
- target実装、spec、contract、state、progressへ越境したか: **no**。
- 禁止対象repoへ接触したか: **no**。

---

## 最新判定 — Retry 2 wizard identity

上記のRetry 4評価後に追加されたtarget `467043802ea030b67d092d86761caffa84675d61` について、
本fileの「Sprint 033 Retry 2 wizard identity 独立再評価」に詳細証拠を記録した。

- Retry 2限定修正: **PASS**
- finding: **High 0／Medium 0／Low 0**
- 全Agentic回帰: **13 suites PASS／0 FAIL**
- Gitなしarchive: **6 suites PASS／0 FAIL**
- Sprint 033全体: **incomplete**（current target bytesでの4 host再導入・fresh検証が残る）

---

# Sprint 033 post-install fresh独立評価

## 総合判定

**実装・current bytesの4 host実会話観測はPASS。ただしSprint 033全体はincomplete（C15 4/5、必須5/5未達）**

target `467043802ea030b67d092d86761caffa84675d61` はprivate `origin/main`へpush済みで、targetの
`HEAD == origin/main`、worktree cleanを独立確認した。Codex／Claudeのinstalled cacheにある
`wizard-product-identity.mjs` はsourceと同じSHA-256
`cb8e245e24e3e57de07334974bf57771784451d04867baac7559b0edd6430cb0` だった。GitHub repoは
`PRIVATE`、default branchは`main`、Release件数は0である。

current bytesでは4 hostすべてについて、0.8.0、`agentic-secretary` identity、`resume-check=1`
（しおり無しの正常系）、会話8面のMarkdown、変更0件のhost固有観測が揃った。Codex Appはtask
`019f846f-cd28-7820-a5b8-61dc1e67a622` のsession recordをread-onlyで確認し、CLI結果を流用していない。
Claude Code Desktop Appもcurrent bytes再導入後の新規sessionを実画面AX treeで確認した。したがって、
前回残件だったcurrent bytesのfresh会話自体は4 hostで完了しており、新しい製品findingはない。

一方、製品のformal host gateは別契約である。`agentic-live-host-gate.mjs` が要求する期限つきapproval
manifest、digest-bound driver、合成HOME、read-only plugin copy、path-scoped permission／OS sandbox、
workspace外canary拒否、成功・失敗cleanup、12 checkを網羅するexact host resultは今回4 hostとも生成されていない。
`node scripts/agentic-host-gate.mjs --mode offline` とarchive gateは、4 hostすべてを
`external-live-gate-unavailable`、`verified 0/4` と集計した。手動会話、AX tree、App task、CLI結果、
wizardの実起動証拠を、このformal PASSへ読み替えていない。

- post-install実装finding: **High 0／Medium 0／Low 0**
- current bytesのhost固有実会話観測: **4/4完了**
- exact approval/result schemaのformal host PASS: **0/4**
- failure classification: **external live gate incomplete**（新しい`implementation-issue`なし）
- Escalation Recommendation: **none**

## host別判定

| host | current bytesのhost固有証拠 | formal判定 |
|---|---|---|
| Codex CLI | namespaced skill、0.8.0、Agentic identity、`resume-check=1`、会話8面Markdown、変更0件。更新cacheのwizard実起動も受領 | **incomplete** — exact approval/result、隔離・canary・cleanupを含む12 check recordなし |
| Claude Code CLI | 0.8.0、Agentic identity、会話8面Markdown、変更0件。Claude cache digestはsource一致 | **incomplete** — exact approval/result、隔離・canary・cleanupを含む12 check recordなし |
| Codex App | App固有task recordでskill `agentic-secretary:secretary`、0.8.0、Agentic identity、`resume-check=1`、会話8面Markdown、変更0件を確認 | **incomplete** — task証拠をformal runner resultへ昇格せず、12 check exact recordなし |
| Claude Code Desktop App | current bytes再導入後の新規sessionを実画面AX treeで確認。skill、0.8.0、Agentic identity、`resume-check=1`、会話8面Markdown、変更0件 | **incomplete** — AX tree／手動証拠をformal runner resultへ昇格せず、12 check exact recordなし |

4 hostとも、実会話品質やidentityの失敗を示す証拠はない。上表の`incomplete`は製品挙動FAILではなく、
contractがformal PASSに要求する隔離済みhost recordが未作成という意味である。

## wizard identityと共通案内

更新済みCodex／Claude cacheからChatwork／Google Chat wizardを実起動した証拠では、両wizardの
HTML title、上部banner、dynamic titleが`agentic-secretary`、旧IDは0件だった。共通案内の変更はなく、
Sprint専用testでも両manifest整合、yasashii互換、反対manifestのsafe stopを再確認した。この証拠は
wizard identityの実装PASSには使うが、各hostのformal result欠落を補う証拠には使っていない。

## 独立実行証拠

| 検査 | 結果 |
|---|---:|
| `node scripts/sprint-033-test.mjs` | 20 PASS／0 FAIL |
| `node scripts/agentic-codex-plugin-test.mjs` | 4 PASS／0 FAIL |
| `claude plugin validate plugins/secretary` | Validation passed |
| `python3 scripts/check-release-integrity.py` | PASS |
| `node scripts/agentic-archive-gate.mjs` | 6 PASS／0 FAIL、exit 0 |
| archive内Sprint 033 | 18 PASS／0 FAIL |
| archive内Codex formal | 4 PASS／0 FAIL |
| `node scripts/agentic-host-gate.mjs --mode offline` | structural PASS、formal live `external-live-gate-unavailable`、verified 0/4 |
| `git diff --check 014680e..4670438` | 出力0／exit 0 |

全Agentic回帰はloopback許可面で再実行した。大量出力の取得面では最終集計行を再表示できなかったため、
本節ではその実行を新しいformal合格数として水増ししていない。既存の同commit独立評価に記録済みの
13 suites／0 FAILと、今回exit 0のarchive gate 6／6、専用20／20、Codex formal 4／4を分けて扱う。

## C15とSprint全体

| 基準 | 評価 | 根拠 |
|---|---:|---|
| 機能完全性 | 4/5 | current bytesの4 host実会話は完了したが、formal 12 check resultは0/4 |
| 動作安定性 | 5/5 | 4 hostで0.8.0／Agentic identity／`resume-check=1`／会話8面、変更0件 |
| エラーハンドリング | 5/5 | `resume-check` 3状態とidentity不一致safe stopが回帰でPASS |
| 回帰なし | 5/5 | 専用、Codex formal、archive、release、validator、diffが0 FAIL |
| C15 4ホスト正式配布 | **4/5** | 実host観測4/4に対し、exact schemaのformal verified hostは0/4。必須閾値5/5未達 |

C15はゼロ許容で5/5必須のため、他の評価がPASSでもSprint 033を`done`へ進められない。
これは新しいコード不具合への差し戻しではない。残る最小条件は、4 hostそれぞれで既存の
`agentic-live-host-gate.mjs`を、期限つきapproval manifestとdigest固定driverから実行し、隔離・canary拒否・
cleanup・12 check・8 scenarioを含むexact resultを4件生成して、formal集計を`verified 4/4`にすることである。
public化とRelease作成はSprint 035まで引き続き行わない。

## Git・外部副作用

- 本Evaluatorはpush、再導入、App UI書込み、public化、Release、OAuth、Repository Secret操作を行っていない。
- Harness正本repoで変更したのは本feedbackへの追記だけ。spec、contract、state、progress、target実装は編集していない。
- Claude sidebarの受動表示に関する運用事象は製品findingへ混ぜていない。
- 最優先禁止対象repoは存在確認、path列挙、read、write、Git、複製元利用を含め一切対象にしていない。

## Evaluator自己レビュー

- current bytesを4 hostそれぞれで区別したか: **yes**。
- Codex AppをCLI証拠から推測したか: **no**。App taskのsession recordを別に確認した。
- Claude Desktopの旧bytes証拠をcurrentへ流用したか: **no**。current再導入後の新規session証拠を使用した。
- 手動／App／AX tree証拠をformal PASSへ昇格したか: **no**。
- offline structural PASSをlive PASSへ昇格したか: **no**。
- 新しいimplementation findingを捏造したか: **no**。findingは0件で、残件をexternal live gate incompleteと分類した。
- target実装、spec、contract、state、progressへ越境したか: **no**。

---

# Sprint 033 production formal gate v3 — local独立評価（Evaluator 3）

## 総合判定

**local実装はFAIL（`implementation-issue`）。external live gateは未実行のまま別blocker。**

target `b9c0f3e2aa1a7c7c4bd4447747f44df7ddf78f5f` をbase
`467043802ea030b67d092d86761caffa84675d61` と比較した。専用、全回帰、archive、Codex formal、
Claude公式validator、release integrity、diff検査はすべて0 FAILだった。一方、production collector／driverを
契約の信頼境界に沿って敵対的に確認すると、実hostで未確認の事実やprompt自身をformal PASSへ昇格できる経路を
3系統確認した。4 host live runを承認・実行する前にlocal実装をGeneratorへ差し戻す必要がある。

- 評価target: `b9c0f3e2aa1a7c7c4bd4447747f44df7ddf78f5f`
- 比較base: `467043802ea030b67d092d86761caffa84675d61`
- local implementation: **FAIL**
- failure classification: **`implementation-issue`**
- external production v3 live result: **0/4、未実行**
- C15: **1/5（5/5必須）**
- Escalation Recommendation: **strong**
- Escalation Evidence: formal PASSの信頼起点、secret非保持、sandbox／path permission実証にHigh findingがあり、4 host live操作前の修正が必要

## Findings

### [High] App collectorは自分で入力したpromptだけで8 scenario／8 observationをPASSできる

`scripts/formal-v3/collector-common.mjs:171-203` はchallenge、8個の `Scenario:` marker、8個の
`Observation:` markerを含むpromptをAppへ入力し、front window全体のstatic textを収集する。待機終了条件は
`uiText contains <challenge>` だけなので、App UIに表示された**利用者prompt自身**を読んだ時点で終了できる。
そのprompt自身に全markerが含まれるため、`212-216` のchallenge／marker／行数検査をassistant responseなしでも通過できる。

さらに `221-239` は同じApp window全体のdumpを8 scenarioと8 observationへ複製し、`249-257` は
`newSession=true`、`allowedTools=[Read,Glob,Grep]`、`usedTools=[]`、`writesOrEditsUsed=false` を実UIから取得せず固定する。
plugin identity、0.8.0、15 skill一意discover、実trigger、wizard到達、更新／cache、official validator、
scenario別assistant responseのいずれも内容検証していない。

独立predicate再現では、利用者prompt＋一般的なUI行だけで次を確認した。

```text
APP_FALSE_POSITIVE_REPRO challenge=true scenarios=8/8 observations=8/8 markdown=true
```

attestorはこのenvelopeから `checkMap()` の12項目を一律PASSへ組み立てるため、Appがpluginを読めない、
assistant応答がない、wizardを起動していない場合でもformal resultを作り得る。Sprint契約の「App実UIから直接取得」
「自己申告を信頼しない」「12 check／8 scenario exact evidence」とrubric検証方法44／C15に違反する。

### [High] CLI collectorもhost回答の自己申告を検証せず、plugin未使用の一般応答をformal証拠へ昇格する

CLIのscenario判定は `collector-common.mjs:103-118` のchallenge文字列、20文字以上、空行または箇条書きだけである。
`129-140` のdistribution、fresh install、rules、wizard、tool state、redaction、update、validatorも、hostへ報告を依頼し、
challengeと長さだけを確認する。回答内の製品名、version、skill数、trigger、wizard状態、cache digest、validator結果、
tool eventをparseしない。artifact summaryは観測内容に関係なく成功文言で固定され、attestorの `checkMap()` が全項目をPASSにする。

pluginを使わない一般応答が現行scenario predicateを満たすことを独立再現した。

```text
CLI_FALSE_POSITIVE_REPRO challenge=true length=true markdown=true
```

`newSession` とtool使用状況も実host metadata／tool eventではなく固定値である。これは「production collectorが
実行中host面から導入、skill／rules、wizard、更新／cacheを直接採取する」契約に届かず、実processからの自己申告による
誤PASSを残す。

### [High] retained artifactの実bytesをsecret scanせず、sanitization結果を0件に固定する

`collector-common.mjs:81-85` と `driver-common.mjs:29-33` のsanitizeはchallenge、代表的な絶対path、
`Bearer ...` だけを置換する。private key、`token=...`、`secret=...`、`password=...`、credential値、
account／workspace識別子は網羅しない。独立再現では次の値がbyte不変で残った。

```text
RETAINED_SECRET_REPRO unchanged=true value=password=supersecret12345
```

`agentic-formal-attestor-v3.mjs:158-169` はartifactのdigest一致だけを見て保持先へcopyし、保持したfile bytesをscanしない。
`279` では実scan結果を計算せず、`secretMatches: 0`、`realPathMatches: 0`、`rawOutputRetained: false`、
`accountOrWorkspaceIdsRetained: false` を固定する。`validateFormalResultV3` のscan対象はresult JSON内のmetadataであり、
digest先artifact本文ではない。このため実host stdout／AX treeにsecret-like valueがあっても、sanitization PASSと
`secret-non-exposure` PASSを作り得る。rubric C2、検証方法11・44、Sprint契約のretained artifact非露出条件に違反する。

### [High] permission modeは宣言値の転記で、特にClaude経路の実拒否機構を証明しない

`agentic-formal-attestor-v3.mjs:238` はapprovalの `pathScopedPermission` 文字列をenvへ入れるだけで、
その値に応じたOS sandbox／path-scoped policyを構成・起動・照合しない。`driver-common.mjs:107` は同じ文字列を
artifactへ戻す。Codex経路には `--sandbox read-only` があるが、Claude経路は `--permission-mode plan` と
`--tools Read,Glob,Grep,Write,Edit` で、path-scoped permissionを設定していない。

driver自身のNode書込みがchmod済みplugin／canaryに失敗することは確認するが、これはhostのWrite／EditがOS sandboxまたは
path permissionで拒否された証明ではない。host側はpromptの `WRITE_EDIT_DENIED` を返すだけで通り、tool event、拒否reason、
WriteとEditそれぞれの試行を検証しない。permission modeはapproval検証、env転記、artifact転記にしか現れず、
特にClaude familyでは契約の隔離層を満たさない。

## local検査証跡

| 検査 | 結果 |
|---|---:|
| `node scripts/agentic-formal-v3-test.mjs` | 13 PASS／0 FAIL、exit 0 |
| `node scripts/sprint-033-test.mjs` | 20 PASS／0 FAIL、exit 0 |
| `node scripts/agentic-codex-plugin-test.mjs` | 4 PASS／0 FAIL、exit 0 |
| `./scripts/agentic-regression.sh` | 14 suites PASS／0 FAIL、exit 0 |
| `node scripts/agentic-archive-gate.mjs` | 7 suites PASS／0 FAIL、exit 0。archive内Sprint 033は18 PASS、v3は12 PASS |
| `python3 scripts/check-release-integrity.py` | PASS、exit 0 |
| `claude plugin validate plugins/secretary` | Validation passed、exit 0 |
| `git diff --check 4670438..b9c0f3e` | 出力0、exit 0 |
| `git diff --cached --check` | 出力0、exit 0 |
| 独立false-positive／secret predicate | App promptのみ8/8＋8/8、CLI plugin未使用応答PASS、password値未redactを再現 |

全回帰の最初のsandbox実行は `listen EPERM 127.0.0.1` でexit 1となった。これは製品assert失敗ではない。
同じcommandを外部通信なしのlocalhost許可面で再実行し、最終 `AGENTIC_REGRESSION_PASS=14 FAIL=0` とexit 0を確認した。
初回停止をPASS件数へ混ぜていない。

## rubricスコア

| 基準 | 評価 | 根拠 |
|---|---:|---|
| 機能完全性 | **2/5** | production gateが実host事実を検証せず12 check／8 scenarioを誤PASSできる |
| 動作安定性 | 4/5 | 専用・全回帰・archiveは0 FAIL。sandbox loopback制限は許可面で完走 |
| エラーハンドリング | **2/5** | prompt echo、自己申告、secret artifact、宣言だけのpermissionをfail closedにできない |
| 回帰なし | **4/5** | 既存suiteは0 FAILだが、独立negative 3系統が失敗。必須5/5未達 |
| C2 安全性 | **4/5** | retained artifactのsecret非保持を実scanせず0件を固定。必須5/5未達 |
| C5 規律 | **4/5** | 証拠の自己申告非採用というformal規律を満たさない。必須5/5未達 |
| C15 4ホスト正式配布 | **1/5** | production attestationが誤合格可能で、external formal resultも0/4。必須5/5未達 |

1軸でも閾値未達なら不合格であり、local implementationだけで差し戻し条件を満たす。

## external live gateとの分離

本評価ではpush、remote変更、public／Release、4 hostへのinstall／再導入／更新、App UI操作、CLI formal session、
approval作成、production collector／driver／attestor実行、4 result集約、OAuth、Repository Secret、実APIを実行していない。
external formal gateは引き続き **0/4、`external-live-gate-unavailable`** である。

ただし今回のFAILは「承認がないのでliveを回せなかった」だけではない。現状のproduction pathはliveを回しても誤PASS可能なため、
上のlocal implementation findingを解消し、専用negativeで保護してからhost別承認へ進む必要がある。

## 次の差し戻し条件と承認対象

Generatorへは次を同一Sprintの`implementation-issue`として差し戻す。

1. App promptとassistant responseを分離し、assistant response側だけでchallenge／8 scenario／8 observationを検証する。
   scenarioごとのresponse境界、内容契約、plugin identity／version／skill trigger／wizard／update／validatorの実観測をparseする。
2. CLIも各checkの機械検証可能な観測値とhost tool／session metadataを取得し、plugin未導入・skill未発見・
   wizard未起動・validator未実行のbare responseを拒否する。
3. retained artifactの実bytesを保持前後にscanし、secret-like value、実path、raw output、account／workspace IDを検出したら
   result生成前に失敗・cleanupする。sanitization countersを実scanから算出する。
4. approvalのpermission modeを実際のsandbox／path-scoped policy適用へ結び、host tool eventからWrite／Editの試行と拒否を確認する。
   Claude familyも文字列宣言やchmod、host自己申告だけでPASSにしない。
5. 上記の誤PASS再現を `agentic-formal-v3-test.mjs` とarchive gateへnegativeとして追加する。

local修正とfresh独立再評価がPASSした後に、4 hostそれぞれについて対象、変更先、保持証跡、cleanup、approval期限を示し、
live実行の個別承認を求める。push、public設定、Releaseはこの承認へ含めない。

## Git・副作用

- targetは評価前後ともHEAD `b9c0f3e2aa1a7c7c4bd4447747f44df7ddf78f5f`、worktree clean、`origin/main`より2 commit ahead。
- target実装の変更0件。push、remote変更、install、App操作、public、release、OAuth、Secret、実API操作0件。
- Harness正本repoで書き込んだのは本feedbackへの追記だけ。spec、contract、state、progressは変更していない。
- 全回帰／archiveの一時実行物は製品gateがcleanupした。評価前から存在した `/private/tmp` の別評価scriptは触れていない。
- 最優先禁止対象repoは、存在確認、path列挙、read、write、Git、複製元利用を含め一切コマンド対象にしていない。

## Evaluator自己レビュー

- Generatorの自己評価を判定根拠にしたか: **no**。target実装、実行結果、独立predicateを確認した。
- 専用suite PASSだけでproduction pathを合格にしたか: **no**。
- App promptとassistant responseを区別したか: **yes**。現実装は区別できないためHighとした。
- retained artifact本文までsecret非保持を確認できたか: **no**。現実装にscanがなく、未redactを再現したためHighとした。
- permission modeの宣言を実適用とみなしたか: **no**。
- external未承認をimplementation failureへ混ぜたか: **no**。local findingとexternal 0/4を分離した。
- 実装修正へ越境したか: **no**。書込みは本feedbackだけ。
- 外部操作を行ったか: **no**。

---

# Sprint 033 candidate `4670438` fresh最終評価

- 評価日: 2026-07-21 JST
- Evaluator verdict: **PASS**
- Finding: **High 0 / Medium 0 / Low 0**
- Failure Class: なし
- Escalation Recommendation: なし

## 結論

Sprint 033は、現行contractと改訂後rubricに対して **PASS**。`docs/sprints/state.md`を`done`へ進められる。
前節までのv3 formal attestation findingは、現行contractで明示的にNon-scopeとなった退役経路への評価であり、
今回の点数から差し引いていない。次はSprint 034を開始し、Release／publicはSprint 035まで行わない。

## candidate・配布前状態

| 確認項目 | fresh結果 |
|---|---|
| target HEAD / `main` / `origin/main` | すべて `467043802ea030b67d092d86761caffa84675d61` |
| target worktree | clean |
| GitHub visibility | `PRIVATE` |
| GitHub Release | 0件 |
| 必須lineage | `1dfe276`、`1228d59`、`014680e`、`4670438`をすべて包含 |
| 退役v3 code | `f285120`、`b9c0f3e`を包含せず、treeにもformal-v3／driver／attestorなし |
| manifest | Codex／Claudeとも`agentic-secretary` 0.8.0、repository正規化済み |
| skill | 15個 |
| diff衛生 | `014680e..4670438`、worktree、cachedの`git diff --check`すべて問題なし |

remote確認はread-onlyの`gh repo view`／Releases GETのみ。push、remote更新、install、App操作、public、Release、
OAuth、Secret、実APIは実行していない。

## fresh実行結果

| command | 結果 |
|---|---|
| `node scripts/sprint-033-test.mjs` | **20 PASS / 0 FAIL** |
| `node scripts/agentic-codex-plugin-test.mjs` | **4 PASS / 0 FAIL** |
| `./scripts/agentic-regression.sh` | **13 PASS / 0 FAIL** |
| `node scripts/agentic-archive-gate.mjs` | **6 PASS / 0 FAIL** |
| `python3 scripts/check-release-integrity.py` | **PASS** |
| `claude plugin validate plugins/secretary` | **Validation passed** |

`agentic-regression.sh`の初回は隔離環境のloopback制限で`listen EPERM 127.0.0.1`となったため、
loopbackだけを許可して同じsuiteを再実行した。製品gateの結果は上表のとおり0 fail。
同suiteの`AGENTIC_HOST_GATE ... verified=0/4`は退役したformal経路のoffline構造結果であり、
現行contractが指定するcurrent-bytes 4ホスト証拠を上書きしない。

## 更新・再開・wizardの受入

- Agentic新規onboardingはedition guard後にledger schema v2、edition `agentic`、9 recordを初期化する。
- 真の旧yasashii ledgerだけがある場合はlegacyを検出し、Agentic ledgerも併存する場合はmixedとして安全停止する。
- `resume-check secretary`は、しおりあり`0`、しおりなし`1`、symlink／guard拒否`3`を区別し、拒否時も対象digestを変えない。
- ChatworkとGoogle Chatは同じ`wizard-identity.sh`を使い、更新後cacheから実起動した画面で
  `agentic-secretary`のbanner／titleを確認した。yasashii fixture互換とmanifest不一致時の安全停止も回帰で確認した。
- source、Codex cache、Claude cacheは`.in_use`を除きbyte一致。wizard helper SHA-256は3箇所とも
  `cb8e245e24e3e57de07334974bf57771784451d04867baac7559b0edd6430cb0`、path guardも3箇所一致した。

## current-bytes 4ホスト証拠

candidate commit後にCodex／Claudeを更新・再導入し、cache更新後に4ホストを別々に実行した時系列を、
元session、cache manifest、installed record、前回の保持済みhost evidenceと突合した。

| ホスト | 独立証拠 | 受入結果 |
|---|---|---|
| Codex CLI | 2026-07-21 20:25 JST開始のfresh `codex exec`実出力 | 0.8.0、identity、namespaced skill、8面Markdown、`resume=1`、workspace変更0 |
| Claude Code CLI | 2026-07-21 20:27 JST開始のfresh `claude -p`実出力 | 0.8.0、identity、skill、8面Markdown、workspace変更0 |
| Codex App | task `019f846f-cd28-7820-a5b8-61dc1e67a622`のraw session | 0.8.0、identity、namespaced skill、8面Markdown、`resume=1`、workspace変更0 |
| Claude Desktop | session `9796cf3b-6c9c-43c7-8d06-a42617b62314`のraw record | 0.8.0、identity、skill、8面Markdown、`resume=1`、workspace変更0 |

4ホストはいずれもcandidate current bytes、製品名`agentic-secretary`、version 0.8.0、skill発火、
8つの回答面、Markdown描画、workspace変更0、Secret actual value 0を満たす。Codex AppはCLI出力の転用ではなく独立task、
Claude DesktopもClaude Code CLIとは別のDesktop sessionである。不要なaccount名やSecret値は本評価記録へ保持していない。

cacheとsessionの順序も、candidate commit 20:12:52、Codex cache 20:23:49、Claude cache／installed record 20:24:09、
wizard 20:24以降、CLI 20:25以降、Codex App 20:29以降、Claude Desktop 20:35以降で整合する。

## rubric再採点

| 軸 | 点 | 根拠 |
|---|---:|---|
| 機能完成度 | **5/5** | Sprint 033 acceptanceをfresh suiteと4ホスト実証で完了 |
| 安定性・回帰 | **5/5** | full Agentic regression、archive gate、release integrity、Claude validatorが全通過 |
| エラー処理 | **5/5** | legacy mixed、manifest mismatch、resume 3を安全停止として保持 |
| C2 安全性 | **5/5** | workspace変更0、Secret actual value 0、禁止外部操作0 |
| C5 規律 | **5/5** | candidate固定、独立session、current bytesと時系列を照合 |
| C8 wizard | **5/5** | Chatwork／Google Chat双方を更新後cacheから実確認 |
| C10 更新安全性 | **5/5** | Agentic ledger初期化と真のlegacy／mixed停止を回帰で保護 |
| C11 共通core | **5/5** | sourceと両cacheのbyte一致、full regression 13/0 |
| C12 0.8準備 | **5/5** | private、Release 0、manifest／validator／integrity PASS |
| C13 edition | **5/5** | identity、ledger、wizard、compatibility guardを確認 |
| C14 Markdown | **5/5** | 4ホストそれぞれで8面のMarkdownを確認 |
| **C15 4ホスト実用受入** | **5/5** | 4/4 current bytes、0.8.0、identity、skill、8面、wizard/update、変更0、Secret 0 |

必須軸を含む全評価軸が閾値を満たす。schema v2/v3 attestation、production collector／driver／attestorは
現行contractのNon-scopeであり、C15へ加点も減点もしていない。

## Git・副作用

- 評価後もtargetは`467043802ea030b67d092d86761caffa84675d61`、`main...origin/main`、clean。
- target実装の変更0件。外部書込み0件。
- Harness正本repoで書き込んだのは本feedbackへの追記のみ。spec、contract、state、progressは変更していない。

## Sprint 034へ残す範囲

- `yasashii-secretary`側の狭いoverlay整備。
- fetch-only upstream sync、同じ操作を繰り返しても結果を変えない性質（冪等性）、未分類diffの拒否。
- yasashii側だけの`key=value`表示改善。
- 0.8.0 candidate、共通coreの安全性、wizard parityを壊さない回帰保護。

## Evaluator自己レビュー

- Generatorの自己評価だけで判定したか: **no**。実tree、fresh command、raw host sessionを独立確認した。
- CLI証拠をApp証拠として流用したか: **no**。
- offline 0/4をcurrent-bytes証拠より優先したか: **no**。現行contractどおり分離した。
- 退役v3 findingを採点へ残したか: **no**。
- 実装修正、state更新、外部変更へ越境したか: **no**。

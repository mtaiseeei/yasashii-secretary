# Sprint 033 — 4環境対応のagentic-secretary完成品

**ステータス:** Retry 3後のCodex正式Plugin実装完了 - fresh独立Evaluator待ち

## スプリント契約（着手時の宣言）

- neutralization commit `52016cf10c1c5587fbd83ff2faf3888e29282d5e` から全履歴を保持した別repo
  `/Users/taisei/workspace/agentic-secretary` を作り、agentic固有identity、technical style、
  共通coreと4 host adapter、回帰・archive gateを実装する。
- ユーザーがこのSprintで許可した外部境界は、上記local directoryの作成、local Git履歴、実装、
  local commitだけ。GitHub repo作成、remote追加／変更、push、plugin install、4 hostへの導入、
  public設定、release公開は行わない。
- `/Users/taisei/workspace/agentic-harness` は読み取りを含む全面接触禁止を維持する。

## 実装結果

### 1. 別repoと全Git系譜

- neutralization commitを起点に、履歴をsquashせず別repoを作成した。
- `main` HEAD: `40cfa1cb6c39dc53b9dfc5bf05499da84e3e7a67`
- commit: `[sprint-033] Agentic版と4ホストアダプターを実装`
- commit count: 130（neutral baseの129 commit＋Sprint 033の1 commit）
- `git merge-base --is-ancestor 52016cf... HEAD`: PASS
- `git remote`: 0件。GitHub repo作成・remote・pushは0件。

### 2. Agentic版identityとtechnical style

- marketplace／plugin manifest／edition config／release validatorを `agentic-secretary`、
  `agentic-secretary@agentic-secretary`、candidate `0.8.0` へ整合した。
- `rules/styles/agentic.md` と `rules/copy/agentic.json` を追加。edition差を会話、診断、報告、
  developer handoffの4表現面に限定した。
- technical styleはcommand、path、正式なエラー名、証跡、残余リスクを明示し、未確認事実を
  `UNVERIFIED` として分離する。安全rule、確認境界、secret保護は上書きしない。
- agentic側から参照するHarness identityは `agentic-harness`／`harness@agentic-harness` にした。
  禁止対象のlocal checkoutは参照していない。

### 3. 共通coreと4 host adapter

- 共通coreは `plugins/secretary/` に1つだけ保持した。wizard、OAuth、sync、skillsをadapterへ
  コピーしていない。
- `adapters/host-matrix.json` に正式対象4 hostと必須12 checkを定義した。
- Claude Code Desktop App／CLI: Claude plugin marketplace／manifest形式のadapterと導入guide。
- Codex App／CLI: `AGENTS.md`、skills、`config.toml` の公式面へ対応するadapter、共通guidance、
  read-only install plan。存在しないCodex marketplace／official validatorは作っていない。
- `scripts/lib/agentic-hosts.mjs` は4 hostを別集計し、1 hostのPASSを全hostへ昇格しない。
  12 check、live conversation PASS、実証跡の全条件がそろわないhostはPASSにできない。

### 4. Neutral base保護と負テスト

- `adapters/neutral-base.json` にneutralization commit、最低履歴数、共通安全面のSHA-256を固定。
- Chatwork／Google Chat wizard assets、Google OAuth client／sync、`rules/safety.md` はneutral baseと
  byte-identical。Chatwork wizardの `Name`＝`CHATWORK_API_TOKEN`、`Secret`＝本人取得API Tokenも
  exact matchで保護した。
- `adapters/agentic-overlay.json` でpost-neutral差分allowlistとlegacy identifier allowlistを固定。
- 負テストは、証跡なしPASS、1 hostだけのPASS、missing host、adapter内core複製、active identityへの
  yasashii漏れを拒否する。

### 5. README／mapping／配布前表示

- READMEに対象ユーザー、candidate、4 host導入面、共通core境界、安全契約、更新復元、
  配布前gate、MIT／単段credit、upstream/downstream関係を記載した。
- `docs/agentic-upstream-mapping.md` にneutralization commit、共通core、edition差、外部操作の
  実行状況をmachine-readableなpathつきで記録した。
- 4 hostは正式対象だが、実導入未実施なので全て `external-live-gate-unavailable`。
  READMEと集計結果で「検証済み」と表示していない。

## 主要変更ファイル

- `/Users/taisei/workspace/agentic-secretary/.claude-plugin/marketplace.json`
- `/Users/taisei/workspace/agentic-secretary/plugins/secretary/.claude-plugin/plugin.json`
- `/Users/taisei/workspace/agentic-secretary/plugins/secretary/edition.json`
- `/Users/taisei/workspace/agentic-secretary/plugins/secretary/rules/styles/agentic.md`
- `/Users/taisei/workspace/agentic-secretary/plugins/secretary/rules/copy/agentic.json`
- `/Users/taisei/workspace/agentic-secretary/adapters/host-matrix.json`
- `/Users/taisei/workspace/agentic-secretary/adapters/{claude-code-desktop-app,claude-code-cli,codex-app,codex-cli}/`
- `/Users/taisei/workspace/agentic-secretary/scripts/lib/agentic-hosts.mjs`
- `/Users/taisei/workspace/agentic-secretary/scripts/sprint-033-test.mjs`
- `/Users/taisei/workspace/agentic-secretary/scripts/agentic-regression.sh`
- `/Users/taisei/workspace/agentic-secretary/scripts/agentic-archive-gate.mjs`
- `/Users/taisei/workspace/agentic-secretary/README.md`
- `/Users/taisei/workspace/agentic-secretary/docs/agentic-upstream-mapping.md`

## 変更しなかった範囲

- yasashii側のspec、sprint contract、state、feedback、既存evidence。本progressだけをGeneratorが追記。
- 旧 `0.7.0` CHANGELOG、fixture、migration、既存Git履歴。
- Chatwork／Google Chat wizardのcopy、DOM、flow、OAuth scope、sync境界、Secret名。
- LICENSEと `forkedFrom`。元author creditは単段のまま。
- GitHub repo、remote、push、host設定、Codex skills directory、Claude plugin install、public、release。
- 禁止対象 `/Users/taisei/workspace/agentic-harness` の読み取り・書込み・存在確認。

## テスト結果

| 検査 | コマンド | 結果 |
|---|---|---:|
| release整合 | `python3 scripts/check-release-integrity.py` | PASS |
| 共通回帰＋Agentic回帰 | `./scripts/agentic-regression.sh` | 10 suites PASS / 0 FAIL |
| Sprint 033専用 | `node scripts/sprint-033-test.mjs` | 13 PASS / 0 FAIL |
| 4 host構造集計 | `node scripts/agentic-host-gate.mjs --mode offline` | structural PASS / verified 0 of 4 |
| Gitなしarchive | `node scripts/agentic-archive-gate.mjs` | 3 suites PASS / 0 FAIL |

共通回帰の内訳はChatwork 35、Google Chat 51、Git safety 71、workspace／timeout safety 69、
security 21、data causality 43、copy 66、release、Sprint 033、host gateで、すべて0 FAIL。
初回実行ではtechnical READMEから歴史的Google Chat／更新復元の説明が抜けたため3件FAILしたが、
READMEへ必要な説明を戻し、最終全体再実行で `AGENTIC_REGRESSION_PASS=10 FAIL=0` を確認した。

## 起動・確認方法

常駐アプリはない。repo rootで次を実行する。

```bash
cd /Users/taisei/workspace/agentic-secretary
node scripts/sprint-033-test.mjs
node scripts/agentic-host-gate.mjs --mode offline
./scripts/agentic-regression.sh
node scripts/agentic-archive-gate.mjs
```

Codexの導入計画は書込みなしで確認できる。

```bash
node scripts/agentic-codex-install-plan.mjs --host codex-app --repo "$PWD"
node scripts/agentic-codex-install-plan.mjs --host codex-cli --repo "$PWD"
```

実host gateの入口は次だが、未承認のため実行していない。現在は意図的にexit 2となる。

```bash
node scripts/agentic-live-host-gate.mjs --host claude-code-desktop-app
node scripts/agentic-live-host-gate.mjs --host claude-code-cli
node scripts/agentic-live-host-gate.mjs --host codex-app
node scripts/agentic-live-host-gate.mjs --host codex-cli
```

## 既知の問題・残余リスク

1. 4 hostへのfresh install、skill/rules読込、実会話、wizard表示、host固有更新、official validatorは
   外部live gate未承認のため未実施。4 hostとも `external-live-gate-unavailable` であり、Sprintの
   最終受入基準6・9・12はまだ満たしていない。
2. GitHub repo `mtaiseeei/agentic-secretary` は未作成で、README内の公開後3 commandは現時点では
   実行不能。remote 0件、push 0件、release 0件を確認済み。
3. `0.7.0 → 0.8.0` live updateは既知scanner blockerにより保証しない。同一版／downgrade停止と
   edition guardは専用回帰で保護している。
4. Claude official validatorはadapterに正式commandを記載したが未実行。Codexは公式validatorが
   存在するという推測をせず `null` とした。

## 外部操作と副作用の実績

- 実施: `/Users/taisei/workspace/agentic-secretary` local directory作成、local Git初期化、
  neutral履歴のfetch、local commit 1件、local testのみ。
- 未実施: GitHub API、repo作成、remote追加／変更、push、plugin install、host config書込み、
  OAuth、Secret、public設定、release。
- temporary build／bundleは `/private/tmp` 配下だけを使用した。target repoのworktreeはclean。

## Evaluatorへの引き渡し

- 最初に `node scripts/sprint-033-test.mjs`、`./scripts/agentic-regression.sh`、
  `node scripts/agentic-archive-gate.mjs` を再実行する。
- 外部承認なしでは4 hostをPASSへ昇格しない。offline structural PASSはlive証跡ではない。
- 各hostを評価する場合は、contractのExternal live gateに従い、導入直前に対象host・変更先・
  cleanupを示して個別承認を得る。1 hostのPASSを残りへ流用しない。
- UI／会話品質を採点する場合は、実host名、runner名、実行面、12 check、browser screenshot、
  secret非露出、workspace外変更0件をhostごとに記録する。

## Retry 1 — Evaluator差し戻し対応

### ローカルcommit

- target repo: `/Users/taisei/workspace/agentic-secretary`
- `main` HEAD: `24647cace0103c43fb80587703832c412d9c41d0`
- commit: `[sprint-033] host証跡とAgentic会話回帰を厳格化`
- commit count: 131（neutral baseの129 commit＋Sprint 033のlocal commit 2件）
- `git status --short --branch`: `## main`。`git remote`: 0件。

### 修正内容

1. offline gateは `status=pass` の外部JSONを必ず拒否するようにした。live PASSを許可する内部optionは
   承認済みrunnerからだけ渡し、通常の `agentic-host-gate.mjs --mode offline` からは到達できない。
2. host resultをexact schemaにした。`hostId`、adapter由来のrunner／surface、12 check、top-level
   execution、8つのlive会話scenario、checkごとのexecutionつきsanitized evidenceを検証する。
   欠落field、未知field、未知evidence種別、host不一致、check未網羅、結果不一致を拒否する。
3. `agentic-live-host-gate.mjs` に、個別の期限つきapproval manifestと明示driverがある場合だけ実行する
   経路を追加した。未承認時はhost操作0件、exit 2、`external-live-gate-unavailable` を維持する。
   runnerは限定したenvironmentだけをdriverへ渡し、既存resultを上書きせず、raw stdout／stderrと
   command argument値を証跡へ保存しない。
4. 会話契約loaderをmanifest priority上のactive style／copyから解決するようにした。既存の
   `sprint-032-patch-001-readability-test.mjs` をAgentic版でも通し、新しい
   `agentic-readability-test.mjs` を通常回帰とarchive gateへ組み込んだ。
5. Agenticの利用者向けcopyを日本語へ統一した。`UNVERIFIED`、command、path、error、evidence等の
   実装・検索に必要な正式名称は維持し、決定確認文を共通protocolの
   `この内容を決定として残しますね: <そのターンのユーザー入力全文>` に一意化した。

### Retry 1テスト結果

| 検査 | コマンド | 結果 |
|---|---|---:|
| release整合 | `python3 scripts/check-release-integrity.py` | PASS |
| Sprint 033専用 | `node scripts/sprint-033-test.mjs` | 15 PASS / 0 FAIL |
| 既存可読性suite | `node scripts/sprint-032-patch-001-readability-test.mjs` | 28 PASS / 0 FAIL |
| Agentic可読性suite | `node scripts/agentic-readability-test.mjs` | 12 PASS / 0 FAIL |
| 全回帰 | `./scripts/agentic-regression.sh` | 12 suites PASS / 0 FAIL |
| Gitなしarchive | `node scripts/agentic-archive-gate.mjs` | 5 suites PASS / 0 FAIL |
| offline host集計 | `node scripts/agentic-host-gate.mjs --mode offline` | structural PASS / verified 0 of 4 |
| 4 host未承認入口 | `node scripts/agentic-live-host-gate.mjs --host <各host>` | 全4件exit 2 / evidence 0 / verified 0 of 4 |

Evaluatorが使用した旧形式の偽record（runner／surfaceなし、`evidence: [{}]`、12 check自己申告PASS）は
exit 1で拒否した。さらに、schemaが完全に見える偽PASSでもoffline modeでは
`PASS is forbidden outside an approved live runner` として拒否するnegative testを追加した。

### Retry 1再評価手順

1. target repoで上記6つのlocal検査を再実行する。`agentic-regression.sh` はloopback wizardを使うため、
   sandboxが `127.0.0.1` bindを拒否する場合だけ同一commandを許可済みsandbox外で再実行する。
2. `scripts/sprint-033-test.mjs` のnegative群で、欠落runner／surface、空evidence object、未知kind、
   evidenceのhost不一致、12 check未網羅、conversation未網羅、`sanitized=false`、offline偽PASS拒否を確認する。
3. manifest由来のAgentic copyを展開し、短い回答、複雑回答、完了、状態、診断、developer handoff、
   部分失敗のMarkdown構造と日本語label、決定確認protocolを確認する。
4. 外部live gateは未承認なので、再評価時も4 hostをPASSへ昇格しない。未承認runnerの安全停止だけを
   確認し、fresh install、host会話、wizard screenshot、official validatorを勝手に実行しない。
5. 将来1 hostが個別承認された場合だけ、target README記載の `--approval`／`--output` 経路を使う。
   approvalには対象host、runner、surface、12 check、期限、cleanup plan、絶対pathのdriverを含め、
   結果はhostごとに分離する。

### Retry 1後も残る外部blocker

- GitHub repo作成、remote、push、plugin install、Codex skills／config導入、Claude official validator、
  4 host実会話、wizard操作・screenshot、public、releaseは0件。
- 4 hostはすべて `external-live-gate-unavailable`、verified 0/4。この状態は実装FAILへ隠さず、かつ
  local修正だけでSprint全体PASSとはしない。
- Retry 1で許可されたlocal実装、local test、local commit以外の副作用は0件。

## Retry 2 — 承認後live runnerの隔離契約

### ローカルcommit

- target repo: `/Users/taisei/workspace/agentic-secretary`
- `main` HEAD: `b9b3753800077fc23523038cfe86ed86aea2d20a`
- commit: `[sprint-033] live host隔離契約を強制`
- `git status --short --branch`: `## main`。`git remote -v`: 0件。
- 変更はtarget実装8 fileだけ。GitHub repo、remote、push、plugin install／update、4 host実導入、
  public、releaseは行っていない。

### 修正前後の再現

Evaluatorの再現条件を、修正前に次のとおり確認した。

```text
ISOLATION_CONTRACT_FAIL inherited_real_HOME=true
missing_structured_controls=syntheticHome,pluginReadOnly,pathScopedPermission,canaryDenial,cleanupVerified
```

Retry 2後は同じ検査が次になった。

```text
ISOLATION_CONTRACT_PASS inherited_real_HOME=false
missing_structured_controls=none
```

### 実装した隔離契約

1. approval manifestをschema version 2のexact schemaへ更新した。host／runner／surface／12 check／
   期限に加えて、実行fileのSHA-256、追加artifactのSHA-256、合成HOME、read-only plugin copy、
   `host-path-scoped-permission` または `os-sandbox`、Write／Edit canary拒否、Bashなし最小tools、
   列挙済み検査対象、成功・失敗双方のcleanupを必須fieldにした。driverの実行bytesがapproval時と
   一致しない場合、または絶対pathのdriver artifactがdigest拘束されていない場合は実行しない。
2. runnerは親processの `HOME` をallowlistから外し、runner所有の一時workspace内に合成HOMEを作って
   強制する。cwd、TMPDIR、書込み可能workspace、plugin参照、canaryもrunnerが固定し、driver指定の
   cwdは受け付けない。
3. plugin本体を一時領域へcopyし、source/copy digest一致を確認して全file／directoryを書込み不能に
   した。runnerはsource、copy、canaryをdriver実行の前後で比較し、copyのmode bitも検査する。
4. 書込み可能scopeは承認済み一時workspaceだけとし、plugin copyとworkspace外canaryは別領域に置く。
   canaryは前後digest不変に加え、driver envelopeの構造化されたWrite／Edit拒否記録を必須にした。
   どちらか一方だけではPASSにしない。
5. host resultのexact schemaへ必須 `isolation` を追加した。`syntheticHome`、`pluginReadOnly`、
   `pathScopedPermission`、`canaryDenial`、`minimalTools`、`inspectedTargets`、`cleanupVerified`、
   retained evidenceの非保持条件を構造化し、PASSでは全条件trueを要求する。
6. success、driver非0終了、invalid output、偽隔離reportの全経路をfinally cleanupへ通した。
   一時run root、workspace、合成HOME、plugin copy、canaryがすべて消えた場合だけ
   `cleanupVerified.completed=true` とする。結果fileはcleanup後にrunnerだけが `wx`／0600で新規作成し、
   既存fileは上書きしない。
7. retained resultへ実driver command／args、raw stdout／stderr、credential実値、実filesystem pathを
   残さない。driverがreason／evidenceへ実pathまたはsensitive値を混ぜた場合も、raw値を保持せず
   genericなFAIL recordへ置き換える。

### 合成approved driver fixtureとnegative

`scripts/sprint-033-test.mjs` は、`/private/tmp` 内に毎回driver fixtureを作り、実runner入口を通して
次を確認する。fixtureとresultはtest終了時に削除する。

- success: 合成HOME使用、workspace内write成功、read-only plugin write拒否、canary write拒否、
  12 check／8 conversation PASS、runner前後比較、cleanup完了、retained resultの実path／args非保持。
- failure: driver exit 17でもhost FAILを作り、successと同じくcleanup完了。
- self-report-only: `sanitized: true` だけの隔離自己申告はhost PASSへ昇格せずFAIL。
- path leak／sensitive leak: driver recordへ実pathまたはsynthetic sensitive値を混ぜても、retained resultへ
  値を残さずFAIL。
- exact result negative: `isolation`欠落、canary denial false、cleanup incompleteをすべて拒否。

### Retry 2テスト結果

| 検査 | コマンド | 結果 |
|---|---|---:|
| 修正前後再現 | `node -e '<isolation source check>'` | PASS / 実HOME継承false / 必須field欠落0 |
| release整合 | `python3 scripts/check-release-integrity.py` | PASS |
| Sprint 033専用＋合成approved driver | `node scripts/sprint-033-test.mjs` | checkout 16 PASS / 0 FAIL |
| 既存可読性suite | `node scripts/sprint-032-patch-001-readability-test.mjs` | 28 PASS / 0 FAIL |
| Agentic可読性suite | `node scripts/agentic-readability-test.mjs` | 12 PASS / 0 FAIL |
| 全回帰 | `./scripts/agentic-regression.sh` | 12 suites PASS / 0 FAIL |
| Gitなしarchive | `node scripts/agentic-archive-gate.mjs` | 5 suites PASS / 0 FAIL。archive内Sprint 033は14 PASS / 0 FAIL |
| offline host集計 | `node scripts/agentic-host-gate.mjs --mode offline` | structural PASS / verified 0 of 4 |
| 4 host未承認入口 | `node scripts/agentic-live-host-gate.mjs --host <各host>` | 全4件exit 2 / verified 0 of 4 |
| Git差分 | `git diff --check` | 出力0 / target clean after commit |

全回帰の最初のsandbox内実行はlocal wizardの `127.0.0.1` bindが `EPERM` となりexit 1だった。
製品FAILとはせず、同一commandを許可済みsandbox外で再実行し、Chatwork 35、Google Chat 51、
Git safety 71、workspace／timeout safety 69、security 21、data causality 43、copy 66、Sprint 033、
legacy／Agentic可読性、offline host gateを含む12/12・0 FAILを確認した。

### Evaluator再評価手順

1. targetのHEADが `b9b3753800077fc23523038cfe86ed86aea2d20a`、worktree clean、remote 0件であることを確認する。
2. release、Sprint 033、legacy可読性、Agentic可読性、全回帰、archiveを上表のcommandで再実行する。
3. Sprint 033のapproved synthetic driver検査で、successだけがPASS、driver failure／self-report-only／
   path leak／sensitive leakがすべてFAILで、各結果の `cleanupVerified.completed=true` を確認する。
4. `scripts/agentic-live-host-gate.mjs` のenvironment allowlistに親 `HOME` が無く、合成HOMEを上書きし、
   approval／result両方のexact schemaが隔離条件を必須化していることを確認する。
5. 4 hostの未承認入口を各1回実行し、exit 2、`external-live-gate-unavailable`、evidence 0、
   `isolation.cleanupVerified.outcome=not-run` を確認する。外部承認なしにhostを導入・実行しない。
6. external live gateは0/4のため、ローカル実装問題の解消とSprint全体の合格を分ける。
   GitHub repo／remote／push／install／official validator／host実会話／wizard screenshotは、今後の
   操作別承認まで実行しない。

### Retry 2後も残る外部blocker

- Claude Code Desktop App／CLI、Codex App／CLIは4件とも未導入で、verified 0/4、
  `external-live-gate-unavailable` のまま。
- GitHub repo `mtaiseeei/agentic-secretary`、remote、push、Claude official validator、4 host実会話、
  wizard screenshotは未実施。
- public設定とrelease公開はSprint 035まで禁止。Retry 2では実行していない。
- したがって、Retry 2はEvaluatorが指摘したローカルHighの修正であり、Sprint 033全体の4/4 live gate
  合格を主張しない。

## Retry 3 — Agentic新規onboardingのedition誤検出修正

### ローカルcommit

- target repo: `/Users/taisei/workspace/agentic-secretary`
- branch: `main`
- commit: `1dfe2767da57d4467c989404f4952e081ffa8dfd`
- message: `[sprint-033] 新規Agentic台帳のedition誤検出を修正`
- `git status --short --branch`: `## main...origin/main [ahead 1]`、worktree clean。
- 既存の `origin=https://github.com/mtaiseeei/agentic-secretary.git` は変更していない。pushは行っていない。

### 根本原因と限定修正

Claude Code Desktop Appの実onboardingは、次の順序で進んでいた。

1. `edition-guard.mjs --entry onboarding --prepare-new` が
   `.secretary/workspace-edition.json` へ `edition=agentic-secretary` を作る。
2. 共通の `templates/AGENTS.md` と `templates/CLAUDE.md` を展開する。
3. 両template内にmigration互換のため残している `yasashii-secretary:update-*` markerと
   `legacyFingerprint` が現れる。
4. `update-ledger.mjs init` がcanonical markerと旧テキストmarkerを同格のedition信号として数え、
   `mixed` と誤判定して停止する。

`plugins/secretary/scripts/lib/edition-guard.mjs` で、有効なcanonical markerが存在するときだけ、
旧marker／fingerprintを「現在template内のmigration互換記述」としてedition集計から外した。
legacy検出自体は削除していない。canonical markerが無い真正legacy-only workspaceは引き続き
`yasashii-secretary` と判定し、Agenticからは `opposite-edition` で停止する。旧
`.yasashii-secretary/update-ledger.json` は強い実データ信号のままであり、Agentic canonical markerと
同居すれば `mixed` で停止する。symlink／不正marker等のunknownも停止を維持する。

Agentic neutral base後に共通guardを変更したため、変更pathを
`adapters/agentic-overlay.json` の宣言的allowlistへ1件だけ追加した。仕様、template、legacy marker、
fingerprint、migration、scanner、wizardは変更していない。

### 追加した回帰fixture

`scripts/sprint-033-test.mjs` に、実hostと同じ順序を実行する独立fixtureを追加した。

- 新規Agentic fixture: 空workspace → `prepare-new` → canonical marker確認 → `templates/` と
  `workspace-templates/` 展開 → onboarding変数置換 → `update-ledger.mjs init` →
  schemaVersion 2／edition `agentic-secretary`／管理対象9件を確認する。旧実装ではtemplate展開後が
  `mixed` になり、`same-edition` assertまたはledger initで失敗する。
- 真正yasashii fixture: canonical marker／ledgerなしでAGENTS／CLAUDEの旧markerとfingerprintだけを置き、
  `opposite-edition`、`legacy=true`、検出edition `yasashii-secretary` を確認する。
- 強い混在fixture: 成功したAgentic fixtureへ旧yasashii ledgerを加え、引き続き `mixed` になることを確認する。

また、前のexternal gateで既に承認・作成済みの `origin` がある現在状態に合わせ、Sprint 033のGit検査を
「remote 0件」から「承認済みoriginだけ」に更新した。追加remote、remote変更、network操作は行っていない。

### Retry 3テスト結果

| 検査 | コマンド | 結果 |
|---|---|---:|
| 実再現workspaceのread-only再判定 | `inspectWorkspaceEdition('/Users/taisei/workspace/agentic-secretary-live-test', config)` | `same-edition` / detected `agentic-secretary` / 書込み0 |
| release整合 | `python3 scripts/check-release-integrity.py` | PASS / exit 0 |
| Sprint 033専用 | `node scripts/sprint-033-test.mjs` | checkout 17 PASS / 0 FAIL |
| 全回帰 | `./scripts/agentic-regression.sh` | 12 suites PASS / 0 FAIL |
| Gitなしarchive | `node scripts/agentic-archive-gate.mjs` | 5 suites PASS / 0 FAIL。archive内Sprint 033は15 PASS / 0 FAIL |
| Git差分 | `git diff HEAD^ --check` | 出力0 |
| Git状態 | `git status --short --branch` | clean / `origin/main` より1 commit ahead |

全回帰の最初のsandbox内実行は、既知のlocal wizard `127.0.0.1` bind制限により `EPERM` で停止した。
同一commandを許可済みsandbox外で再実行し、`AGENTIC_REGRESSION_PASS=12 FAIL=0` を確認した。

### 禁止操作と実workspace保護

- `/Users/taisei/workspace/agentic-secretary-live-test` はread-onlyで状態判定だけ行い、ledger作成、cleanup、
  file変更、Git変更を0件に保った。
- GitHub API、remote追加／変更、push、public、release、plugin install／update、host設定変更、OAuth、
  Repository Secret操作は0件。
- `/Users/taisei/workspace/agentic-harness` は読取り、書込み、存在確認、command対象化を含め0件。
- `docs/sprints/state.md` と `docs/feedback/sprint-033.md` は変更していない。

### Evaluatorへの具体的な再評価scenario

1. target HEADが `1dfe2767da57d4467c989404f4952e081ffa8dfd`、worktree clean、
   remoteが承認済み `origin` 1件だけであることを確認する。
2. release、Sprint 033、全回帰、archiveを上表のcommandで再実行する。
3. Sprint 033の新規fixtureで、`prepare-new → marker → templates展開 → ledger init` がexit 0、
   `.secretary/update-ledger.json` がschemaVersion 2／edition `agentic-secretary`／9 recordsになることを確認する。
4. 別fixtureの真正legacy-onlyが `opposite-edition` のまま、旧legacy ledger追加が `mixed` のままであることを確認する。
5. 実hostを再評価する場合は、親オーケストレーターが承認範囲とcleanupを再確認した新しい空workspaceで
   Claude Code Desktop Appのfresh onboardingを行う。structured質問後にmarkerだけでなくledgerが作られ、
   user-facing完了報告まで到達することを確認する。既存
   `/Users/taisei/workspace/agentic-secretary-live-test` は再現証跡として変更しない。
6. 1 hostの結果を残り3 hostへ流用せず、今回の修正合格とSprint全体4/4 live gate合格を分けて記録する。

## Codex正式Plugin配布面 — Planner改訂後のGenerator実装

### target commitと変更範囲

- target repo: `/Users/taisei/workspace/agentic-secretary`
- branch: `main`
- commit: `1228d592b1bc1e81bacee0ee7eb9245955c91582`
- message: `[sprint-033] Codex正式Plugin配布面を追加`
- `git status --short --branch`: `## main...origin/main [ahead 2]`、worktree clean。
- 既存の未push commit `1dfe276`を保持した追加commitであり、squash、rebase、remote変更、pushは行っていない。

実装はCodexの正式配布入口、host adapter、公開guide、機械検証に限定した。共通skills、Chatwork／Google Chat
wizard、OAuth scope、同期、安全rule、editionの4表現面は変更していない。

### 正式manifestとmarketplace

1. `plugins/secretary/.codex-plugin/plugin.json` を追加した。name/versionは
   `agentic-secretary`／`0.8.0`、skillsは `./skills/`。author、repository、MIT、
   Productivity category、capabilities、default promptsをCodex schemaへ整合した。実在しないapps、
   MCP server、asset、hookは宣言していない。
2. repo rootの `.agents/plugins/marketplace.json` を追加した。marketplace/plugin nameは
   `agentic-secretary`、sourceはlocal `./plugins/secretary`、policyは
   `AVAILABLE`／`ON_INSTALL`、categoryは `Productivity`。
3. Claudeの `.claude-plugin/marketplace.json` と
   `plugins/secretary/.claude-plugin/plugin.json` は維持した。Claude/Codexの両manifestは同じ
   `plugins/secretary/skills/` 15件を参照し、`.agents/skills` やhost別skills copyは作っていない。
4. `scripts/lib/agentic-hosts.mjs` とCodex App／CLI adapterを
   `codex-plugin-marketplace` へ更新した。Codex formal manifest／marketplace欠落、fallbackだけの構成を
   adapterの構造PASSへ昇格しない。

### 導入・更新案内

- README、`docs/guide/getting-started.md`、`docs/guide/updates.md`、Codex App／CLI adapter READMEを
  正式Plugin主導線へ更新した。
- Codex CLI 0.144.6で確認済みの主導線を次へ固定した。

```bash
codex plugin marketplace add mtaiseeei/agentic-secretary --ref main
codex plugin add agentic-secretary@agentic-secretary
codex plugin list --marketplace agentic-secretary
```

- AppはPlugins Directoryでmarketplace選択→plugin detailsからinstall→新しいchat、CLIはinstall後の
  新しいsessionを案内する。`$secretary` または自然言語triggerを実hostで確認する手順を明示した。
- 更新は `codex plugin marketplace upgrade agentic-secretary` によるsnapshot refresh、再install、
  installed version、新session反映を分けて説明した。存在しないplugin単体自動upgradeを主張せず、
  cache directoryの直接編集を案内していない。
- 旧 `agentic-codex-install-plan.mjs`、`AGENTS.md`、`config.toml.example` は残したが、出力と文書の
  先頭でrepository-local authoring／isolated test／fallback専用と明示し、正式PASS根拠から外した。

### Codex CLI合成回帰

`scripts/agentic-codex-plugin-test.mjs` を追加した。各実行で
`/private/tmp/agentic-codex-cli-*` の下だけに合成 `HOME` と合成 `CODEX_HOME` を作り、environmentを
PATH／CODEX_HOME／HOME／TMPDIR／LANGだけへ限定する。実ユーザーのCodex設定、auth、cacheは使わない。

同scriptはlocal repo sourceに対して次を実走する。

1. `codex plugin marketplace add <local repo> --json`
2. `codex plugin list --available --json`
3. `codex plugin add agentic-secretary@agentic-secretary --json`
4. `codex plugin list --json`
5. 合成cacheのmanifest version `0.8.0`、`./skills/`、SKILL.md 15件の一意性、sourceとのdigest一致
6. source pluginの前後digest不変と、一時HOME／CODEX_HOMEのcleanup

negative fixtureは、rootのlegacy Claude marketplaceだけ、または `.agents/skills` 手動配置だけでは
正式Codex marketplace／manifest検証を通過できないことを確認する。

### 最終test結果

| 検査 | コマンド | 結果 |
|---|---|---:|
| release整合 | `python3 scripts/check-release-integrity.py` | PASS / exit 0 |
| Claude公式validator | `claude plugin validate plugins/secretary` | PASS / exit 0 |
| Sprint 033専用 | `node scripts/sprint-033-test.mjs` | checkout 18 PASS / 0 FAIL |
| Codex正式Plugin＋合成CLI | `node scripts/agentic-codex-plugin-test.mjs` | 4 PASS / 0 FAIL |
| 全Agentic回帰 | `bash scripts/agentic-regression.sh` | 13 suites PASS / 0 FAIL |
| Gitなしarchive | `node scripts/agentic-archive-gate.mjs` | 6 suites PASS / 0 FAIL。archive内Sprint 033は16 PASS、Codex 4 PASS |
| offline host集計 | `node scripts/agentic-host-gate.mjs --mode offline` | structural PASS / verified 0 of 4 |
| 構文・差分 | `git diff --check`、Node `--check`、Python `py_compile` | PASS / 出力0 |

全回帰のsandbox内初回実行はloopback wizardの `127.0.0.1` bindが `EPERM` となった。同一commandを
許可済みsandbox外で再実行し、Chatwork 35、Google Chat 51、Git safety 71、workspace／timeout safety 69、
security 21、data causality 43、copy 66、Sprint 033 18、Codex 4、legacy可読性28、Agentic可読性12、
offline host gateを含む13/13・0 FAILを確認した。

`plugin-creator` skillの公式Python validator
`/Users/taisei/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py` は、利用可能な3つのPython環境で
すべて `ModuleNotFoundError: No module named 'yaml'` となり未実行。依存追加だけのpackage manifestは作らず、
代替として同skillのschemaに沿う自前manifest検査、Codex CLI 0.144.6の実ingestion、Claude公式validator、
archive検証を0 FAILで完走した。この未実行理由をofficial validator PASSとは表示しない。

### 外部操作とlive host残件

- この実装でGitHub API、remote追加／変更、push、public、release、実ユーザーのCodex／Claude設定・cache変更、
  OAuth、Repository Secret、`agentic-secretary-live-test*` の変更／cleanupは行っていない。
- formal Codex CLI ingestionは実ユーザー導入ではなく、毎回削除する合成HOME／CODEX_HOME内のlocal source回帰。
- offline集計はformal配布構造のPASSだけで、4 hostはverified 0/4、
  `external-live-gate-unavailable` のまま。Codex App／CLIの実install、new chat/session、明示／自然trigger、
  会話8面、wizard、update/cacheのlive evidenceはfresh Evaluator／親オーケストレーターへ引き継ぐ。

### 作業安全ログの訂正

初期の正本／target guidance探索で、Generatorがtargetを限定せず
`find .. -name AGENTS.md -print` を実行した。この出力に禁止対象
`/Users/taisei/workspace/agentic-harness` 内の `AGENTS.md` path名2件が含まれた。内容のopen/read、書込み、Git操作、
複製は0件だが、契約上の「存在確認／コマンド対象化0件」には反する。以後は当該pathへ一切触れていない。
製品実装の0 FAILとは分け、このGenerator作業安全違反をfresh Evaluator／オーケストレーターの判定対象として残す。

### fresh Evaluatorへの具体的scenario

1. target HEAD `1228d59`、worktree clean、`origin/main`より2 commit ahead、pushなしを確認する。
2. `.agents/plugins/marketplace.json` と `.codex-plugin/plugin.json` を独立schema検査し、Claude manifestとの
   version/name、共通skills 15件、二重skills 0件を確認する。
3. `node scripts/agentic-codex-plugin-test.mjs` を実行し、合成HOME／CODEX_HOMEだけにmarketplace／cacheが作られ、
   source前後digest不変、一時環境cleanup、legacy/manual-only negative拒否を確認する。
4. release、Sprint 033、全回帰、archive、Claude validatorを上表どおり再実行する。official Python validatorは
   PyYAMLがある独立環境を利用できる場合だけ実行し、無い場合は未実行理由を維持する。
5. README、getting-started、updates、Codex App／CLI adapterでformal Pluginが主導線、manual adapterがfallback、
   marketplace refresh／reinstall／new session／cacheの区別が正確か確認する。
6. 作業安全ログの禁止対象path列挙を製品issueとGenerator運用issueに分けて評価し、隠さない。
7. external live gateは0/4のままなので、offline／合成CLI結果をCodex App／CLI live PASSへ昇格しない。

---

## Retry 4 — read-only環境のresume-check三値化（2026-07-21）

### 実装結果

Codex CLIのread-only sessionで再現したHigh `implementation-issue`を、共通path guardと
`resume-check`の状態伝播だけに限定して修正した。

1. `plugins/secretary/scripts/lib/path-guard.sh` の `_safe_working_root` から
   Bash here-string、配列への `read`、一時file依存を除去した。path componentは
   parameter expansionだけで左から順に分解する。絶対／相対path、`.`、`..`、重複slash、
   途中symlink、root symlink、macOS `/tmp`／`/var` aliasの既存判定順は維持した。
2. `plugins/secretary/skills/memory-care/scripts/memory-tools.sh resume-check` は、
   しおり有りをexit 0、しおり無しをexit 1、path guard拒否を日本語error付きexit 3で返す。
   guard内部失敗を「しおり無し」へ潰さず、他のmemory commandと同じ `_guard_reject` を使う。
3. `scripts/sprint-033-test.mjs` に、`ulimit -f 0`でregular fileへの書込みを禁止した子process回帰を追加した。
   しおり有り／無し／基点symlinkによるguard拒否の3状態と、各実行前後のfixture digest不変を実証する。
   test rootを `/tmp/agentic-resume-readonly-*` にしてmacOS `/tmp` alias経路も通す。
4. 共通安全修正のpost-neutral変更2 pathを `adapters/agentic-overlay.json` のexact allowlistへ追加した。
   wizard、OAuth scope、同期、edition copy、manifest、marketplace、version `0.8.0`は変更していない。

### target commitとGit状態

- target repo: `/Users/taisei/workspace/agentic-secretary`
- branch: `main`
- commit: `014680ec9e7be51953e7d7c41835c5d9a08bd55e`
- message: `[sprint-033] 読み取り専用環境のしおり判定を修正`
- 変更: 4 files、67 insertions、8 deletions。
- `git status --short --branch`: `## main...origin/main [ahead 1]`、worktree clean。
- push、real plugin再導入、GitHub設定、App操作、public、releaseは行っていない。

### test結果

| 検査 | コマンド | 結果 |
|---|---|---:|
| shell構文＋Sprint 033 | `bash -n plugins/secretary/scripts/lib/path-guard.sh plugins/secretary/skills/memory-care/scripts/memory-tools.sh && node scripts/sprint-033-test.mjs` | 19 PASS / 0 FAIL |
| symlink・timeout安全回帰 | `node scripts/sprint-022-safety-test.mjs` | 69 PASS / 0 FAIL |
| 全Agentic回帰 | `bash scripts/agentic-regression.sh` | 13 suites PASS / 0 FAIL |
| commit後Gitなしarchive | `node scripts/agentic-archive-gate.mjs` | 6 suites PASS / 0 FAIL |
| 差分整合 | `git diff --check` | 出力0 / PASS |

全Agentic回帰とarchiveはloopback test serverを使うため、sandbox内のbind `EPERM`後に許可済みの
sandbox外実行で完走した。offline host集計は構造PASS、liveは
`external-live-gate-unavailable`／verified 0/4を維持し、offline結果をlive PASSへ昇格していない。

参考として旧 `scripts/regression-check.sh` もpath guard区間まで実行し、今回変更した通常しおり導線、
最終／途中／基点symlink拒否、外部sentinel不変はPASSした。同script全体はyasashii editionの旧identity・
serializer・READMEを直接assertするため、agentic repoでは既知の反対edition assertionがFAILする。
最終判定にはedition対応済みの上表Agentic suiteを使った。

### 起動・評価handoff

- 通常の確認command: `plugins/secretary/skills/memory-care/scripts/memory-tools.sh resume-check <secretary>`
- URL: 該当なし。CLIのread-only診断導線である。
- Evaluatorは、書込み禁止相当の環境で実在する `memory/_resume.md` がexit 0、欠落時がexit 1、
  基点／途中symlink等のguard失敗がexit 3＋日本語errorになることを独立確認する。
- 既存の最終要素／途中ancestor／working root symlink、`..`、境界外、macOS `/tmp` aliasと、
  外部sentinel不変を再確認する。
- 残る外部live gateはCodex AppとClaude Code Desktop Appの2 host、および親オーケストレーターが行う
  commit `014680e` のpush、real plugin再導入後のCodex CLI再評価である。Generatorはこれらを実行していない。
- Sprint 033全体のhost別合否と`done`遷移はfresh Evaluator／オーケストレーターへ委ねる。

---

## Retry 2（post-escalation audit）— wizard product identity（2026-07-21）

### 実装結果

Agentic版のChatwork実画面でtitle／上部bannerが`yasashii-secretary`のまま表示された
`implementation-issue`を、edition別のproduct identity解決だけに限定して修正した。

1. `plugins/secretary/scripts/lib/wizard-product-identity.mjs`を追加した。正式な`edition.json`の
   `edition`／`distribution.marketplaceId`／`distribution.pluginId`を正本とし、同梱されている
   Claude `.claude-plugin/plugin.json`とCodex `.codex-plugin/plugin.json`の`name`が一致する場合だけ
   `agentic-secretary`または`yasashii-secretary`を返す。不明なedition、配布ID不一致、manifest欠落・不一致は
   wizard起動前に日本語errorで停止する。
2. Chatwork／Google Chatの両wizard serverは、共有している`index.html`と`common.js`を配信するときだけ
   上記identityを反映する。Agentic版ではHTML title、`.product` banner、画面遷移後の`document.title`が
   `agentic-secretary`になる。
3. 共通assetのHTML、copy、DOM、focus、accessibility、service色、OAuth scope、sync境界、
   Repository Secret案内はbyte変更していない。`Name=CHATWORK_API_TOKEN`、
   `Secret=Chatwork公式画面でご本人が取得したAPI Token`も維持した。
4. yasashii版は同じrendererへ正式なyasashii metadataを渡すと従来表示を維持する。旧marker、migration、
   fixtureを無差別置換せず、manifest不一致を意図的に作ったnegative fixtureは安全停止する。

### target commitとGit状態

- target repo: `/Users/taisei/workspace/agentic-secretary`
- branch: `main`
- commit: `467043802ea030b67d092d86761caffa84675d61`
- message: `[sprint-033] wizardの製品名をeditionに合わせる`
- 変更: 5 files、117 insertions、2 deletions。
- `git status --short --branch`: `## main...origin/main [ahead 1]`、worktree clean。
- push、plugin再導入、App操作、public化、Release、OAuth、Repository Secret操作は行っていない。

### test結果

| 検査 | コマンド／実行面 | 結果 |
|---|---|---:|
| Node構文＋Sprint 033 | `node --check`（helper／両server／test）＋`node scripts/sprint-033-test.mjs` | 20 PASS / 0 FAIL |
| Chatwork実配信 | `/private/tmp` fixture、`http://127.0.0.1:18767/` | title／banner／`document.title`が`agentic-secretary`、旧ID漏れ0 |
| Google Chat実配信 | `/private/tmp` fixture、`http://127.0.0.1:18768/` | title／banner／`document.title`が`agentic-secretary`、旧ID漏れ0 |
| 全Agentic回帰 | `bash scripts/agentic-regression.sh` | 13 suites PASS / 0 FAIL |
| Gitなしarchive | `node scripts/agentic-archive-gate.mjs` | 6 suites PASS / 0 FAIL。archive内Sprint 033は18 PASS |
| Claude公式validator | `claude plugin validate plugins/secretary` | Validation passed |
| Codex正式Plugin | 全回帰／archive内`agentic-codex-plugin-test.mjs` | 4 PASS / 0 FAIL |
| 差分 | `git diff --check`、`git diff --cached --check` | 出力0 / PASS |

全回帰の通常sandbox初回実行は、既知どおりloopback bindを`EPERM`で拒否した。許可済みの
localhost実行面で同一commandを完走し、13/13・0 FAILを確認した。手動fixtureの最初の起動はmacOSの
`/tmp` aliasをworking-root安全検査が拒否したため、正規pathの`/private/tmp`を明示して再実行した。
この安全停止を製品失敗として隠していない。両serverは検証後に停止し、fixtureはcleanup済みである。

### 起動・評価handoff

- Chatwork: `plugins/secretary/skills/chatwork/scripts/wizard-server.mjs --root <private-workspace> --port <port>`
- Google Chat: `plugins/secretary/skills/google-chat/scripts/wizard-server.mjs --root <private-workspace> --port <port>`
- Evaluatorはcurrent commitのpluginを再導入したfresh hostからwizardを開き、HTML titleと上部bannerの両方が
  `agentic-secretary`であることを確認する。Chatworkだけでなく、同じshellを使うGoogle Chatも確認する。
- yasashii互換は、yasashii edition metadata＋同名Claude manifestで従来表示になり、反対manifest混在では
  起動前に停止することを独立確認する。
- 4 hostのformal live result、plugin再導入、pushはオーケストレーター／fresh Evaluatorへ引き継ぐ。
  offline／localhost結果を4 host PASSへ昇格しない。

---

## Retry 3（fresh strong Generator）— production formal gate schemaVersion 3（2026-07-21）

### 実装結果

Planner改訂後の二層証拠契約に合わせ、target `/Users/taisei/workspace/agentic-secretary` の
current main `4670438` を基準に、既存schemaVersion 2をproduction主導線から外し、
schemaVersion 3のproduction collector／driver／attestor／aggregateを追加した。

1. `scripts/lib/agentic-formal-v3.mjs` をv3 exact validatorの正本にした。期限つきapproval、
   attestor発行の一回限りchallenge、candidate commit／tree、plugin source、installed cache、
   Claude／Codex manifest、collector／driver／attestor SHA-256、host ID／surface／version、
   capture windowを同じrelease tupleへ拘束する。
2. 4 host別collectorを `scripts/formal-v3/collect-*.mjs` に分離した。Claude Code CLI／Codex CLIは
   実CLI processを新しいsessionとして起動し、8 scenarioと各host observationを直接採取する。
   Claude Code Desktop App／Codex AppはmacOS Accessibilityの `System Events` から実App front windowを
   直接入力・採取し、CLI captureへfallbackしない。Appのread-only promptはWrite／Edit、shell、OAuth、
   Repository Secret、実API、外部writeを禁止し、challenge、8 scenario、host observation markerを
   実UI captureに必須とする。
3. 4 host別driverを `scripts/formal-v3/drive-*.mjs` に分け、同じfamily／candidate bytesの別隔離probeを
   実host executableで起動する。合成HOME、read-only plugin copy、`os-sandbox` または
   `host-path-scoped-permission`、workspace外canaryのWrite／Edit拒否、plugin／canary前後不変を必須にした。
4. `scripts/agentic-formal-attestor-v3.mjs` はproduction modeだけを受理する。approvalとrelease tupleを
   実bytesで照合し、collector／driverをapproval有効窓内に直接起動し、sanitized artifactだけを昇格する。
   success、host非0、invalid JSON、schema拒否、digest不一致、中断を同じfinally cleanupへ通し、
   approval、raw capture、workspace、合成HOME、plugin copy、canaryを削除する。result／artifactは既存fileを
   上書きせず、approval ID／run IDの再利用markerを残す。
5. `scripts/agentic-formal-aggregate-v3.mjs` は異なる4 host／approval／run／challengeのresultが、
   同じrelease tupleで個別PASSした場合だけ `verified 4/4` を返す。1 host FAIL、host間流用、v2／fixture／
   import／ad hoc reporterは集約できない。
6. `adapters/formal-v3/` にapproval、host result、summaryのJSON Schemaと4 host別の未承認templateを追加した。
   templateは `approved=false`、期限切れplaceholderで配布し、operatorが実行直前に個別承認値と
   `release-tuple` 出力を入れない限りhost操作へ進めない。
7. `docs/formal-host-gate-v3.md` にhost別前提、approval作成、CLI command、App操作、challenge、
   12 check／8 scenario、result、cleanup、4件集約を一続きで記載した。READMEと4 adapterはv3を
   production主導線として参照する。既存 `agentic-live-host-gate.mjs` のv2は削除せず、歴史的fixture／
   rejection回帰に限定して残した。

### 必須negativeとcleanup確認

`scripts/agentic-formal-v3-test.mjs` は次を機械的に拒否する。

- schemaVersion 2、fixture、既存JSON import、ad hoc reporter
- approval期限切れ、host／surface不一致、capture window外
- App resultのCLI capture、実host層／隔離層欠落、release tuple digest不一致
- approval／run／challenge／host artifactの別host流用
- 11 check、7 scenario、重複scenario、Markdown未確認、evidence ID欠落
- AppのWrite／Edit使用、canary拒否なし、cleanup不完了
- secret-like value、実filesystem path、raw stdout field、sanitization不備
- invalid direct-host output後の一時run root／raw capture／approval／partial retained artifact残存

collector／driverの `--self-check` は4 host分を実processで起動するが、出力は
`mode=self-check`、`productionPass=false` 固定でありproduction集約に入らない。合成のvalid result objectは
exact validatorのpositive／negative単体検査にだけ使い、production result fileとして生成・昇格しない。

### target commitとGit状態

- target repo: `/Users/taisei/workspace/agentic-secretary`
- branch: `main`
- HEAD: `b9c0f3e2aa1a7c7c4bd4447747f44df7ddf78f5f`
- commit 1: `f285120` — `[sprint-033] 4ホスト正式gateをschema v3へ更新`
- commit 2: `b9c0f3e` — `[sprint-033] archive内formal回帰をGit非依存にする`
- `git status --short --branch`: `## main...origin/main [ahead 2]`、worktree clean。
- push、remote変更、plugin install／再導入、App live操作、OAuth、Repository Secret、実API、public、releaseは0件。

### test結果

| 検査 | コマンド／実行面 | 結果 |
|---|---|---:|
| production v3専用 | `node scripts/agentic-formal-v3-test.mjs` | checkout 13 PASS / 0 FAIL |
| Sprint 033既存 | `node scripts/sprint-033-test.mjs` | 20 PASS / 0 FAIL |
| 全Agentic回帰 | `./scripts/agentic-regression.sh` | 14 suites PASS / 0 FAIL |
| Gitなしarchive | `node scripts/agentic-archive-gate.mjs` | 7 suites PASS / 0 FAIL。archive内v3は12 PASS |
| release整合 | `python3 scripts/check-release-integrity.py` | PASS |
| Codex formal | `node scripts/agentic-codex-plugin-test.mjs` | 4 PASS / 0 FAIL |
| Claude公式validator | `claude plugin validate plugins/secretary` | Validation passed |
| 差分 | `git diff --check`、`git diff --cached --check` | 出力0 / PASS |

全回帰の最初のsandbox実行は、既知のloopback bindを `EPERM` で拒否した。外部通信なしの許可済み
localhost実行面で同一commandを完走し、14／14・0 FAILを確認した。archive初回はcommit前のuntracked v3 fileを
`git archive HEAD` が含まないため停止し、commit後の2回目は `.git` のない配布物でcheckout専用の
release tuple negativeが実行されたため停止した。後者をcheckout専用testとして分離したcommit `b9c0f3e` 後、
archive 7／7・0 FAILを確認した。どちらも最終結果へPASSとして混ぜていない。

### 既知の未完了と正直な表示

- 4 hostのproduction v3 live runはこのGeneratorでは実行していない。App実操作、CLI formal session、
  plugin再導入が禁止範囲だったため、formal resultは0件、`verified 0/4`、
  `external-live-gate-unavailable` のままである。
- App collectorはmacOS Accessibility権限、実行中App、新しいchat、frontmost composerを必要とする。
  実hostでこの一連の自動入力／captureが成立することはEvaluator／approved operatorによるlive実行待ちであり、
  offline self-checkやschema fixtureを実App動作証明に数えない。
- CLI collector／隔離driverも正式install済みhost home、実 `claude`／`codex` executable、個別approvalを
  必要とする。未認証、host非0、challenge未観測、Markdown不足、canary refusal未成立はfail-closedとなる。
- targetは`origin/main`より2 commit aheadで未push。push、public設定、release公開は別の明示許可なしに行わない。

### Evaluator／live operatorへのhandoff

1. target HEAD `b9c0f3e` で `node scripts/agentic-formal-v3-test.mjs`、
   `./scripts/agentic-regression.sh`、`node scripts/agentic-archive-gate.mjs` を再実行する。
2. target `docs/formal-host-gate-v3.md` を読み、4 hostを別々のapprovalで実行する。templateは
   `adapters/formal-v3/templates/<host>.approval.json`、release tupleは
   `node scripts/agentic-formal-attestor-v3.mjs release-tuple --host <host> --installed-cache <path>` で取得する。
3. CLIは実CLI processと正式installed cache、新しいsessionを使う。Appは実App UIの新しいchatをfrontmostにし、
   macOS Accessibilityから直接captureする。App resultへCLI captureを入れない。
4. 各host resultで `hostObservationArtifact` と `containmentArtifact`、12 check／8 scenario、
   candidate／cache／manifest／collector／driver／attestor digest、challenge、capture window、sanitization、
   cleanupを確認する。1件でも欠けたhostをPASSにしない。
5. 4件が揃った場合だけ `node scripts/agentic-formal-aggregate-v3.mjs --output <new-summary> <four-results>` を実行する。
   v2 result、過去観測、既存JSON、fixture、別host artifactを入力しない。
6. 実host run、plugin install／再導入、push、public、releaseの各操作は、対象・副作用・cleanupを示し、
   それぞれ実行直前の個別承認を得る。Sprint 033ではOAuth、Repository Secret、Chatwork／Google Chat実APIを行わない。

## Planner再改訂後 — `4670438` 完成候補への復帰確認（2026-07-21）

本節を現行Generator handoffとする。直前までのschema v3実装・検証・live operator handoffは履歴として保持するが、
Planner再改訂によりsupersededであり、Sprint 033の必須手順、配布物要件、不合格条件として使用しない。

### 完成候補と退避branch

- target repo: `/Users/taisei/workspace/agentic-secretary`
- branch: `main`
- `HEAD == main == origin/main == 467043802ea030b67d092d86761caffa84675d61`
- `git status --short --branch`: `## main...origin/main`。worktreeはclean。
- GitHub repositoryはprivate、default branchは`main`、Release件数は0。
- candidate履歴に `1dfe276`、`1228d59`、`014680e`、`4670438` の4修正がすべて含まれる。
- 過剰なschema v3実装 `f285120`／`b9c0f3e` はlocal branch
  `codex/archive-sprint-033-formal-v3` にだけ退避され、candidate treeには含まれない。
- candidateでは `adapters/formal-v3/`、`scripts/formal-v3/`、v3 attestor／aggregate／validator、
  `docs/formal-host-gate-v3.md` が存在しないことを確認した。schema v2／v3 formal attestationの欠落は、
  改訂済みcontractどおりSprint 033のFAIL理由にしない。
- target実装へ追加変更は不要。candidateが既にcontractを満たすため、target commitは作成しない。

### 完成候補での再検証結果

| 検査 | コマンド | 結果 |
|---|---|---:|
| Sprint 033専用 | `node scripts/sprint-033-test.mjs` | 20 PASS / 0 FAIL |
| Codex正式Plugin | `node scripts/agentic-codex-plugin-test.mjs` | 4 PASS / 0 FAIL |
| 全Agentic回帰 | `./scripts/agentic-regression.sh` | 13 suites PASS / 0 FAIL |
| Gitなしarchive | `node scripts/agentic-archive-gate.mjs` | 6 suites PASS / 0 FAIL。archive内Sprint 033は18 PASS、Codexは4 PASS |
| release整合 | `python3 scripts/check-release-integrity.py` | PASS |
| Claude公式validator | `claude plugin validate plugins/secretary` | Validation passed |
| 差分 | `git diff --check`、`git diff --cached --check` | 出力0 / PASS |

全Agentic回帰のsandbox内初回実行は、loopback wizardの `127.0.0.1` bindを環境が`EPERM`で拒否して停止した。
製品assertのFAILとは混ぜず、同一commandを外部通信なしの許可済みlocalhost実行面で再実行した。
Chatwork 35、Google Chat 51、Git safety 71、workspace／timeout safety 69、security 21、data causality 43、
copy 66、Sprint 033 20、Codex 4、legacy readability 28、Agentic readability 12、offline host gateを含む
13／13・0 FAILを確認した。

Sprint 033専用20件では、今回のcontractが明示する次の境界を個別に確認した。

1. canonical Agentic onboarding templateからの `update-ledger.mjs` 新規初期化が成功する。
2. canonical markerなしの真正legacy workspaceは隠さず、反対editionとして安全停止する。
3. read-only `resume-check` が、しおり有り=0、無し=1、guard拒否=3を区別する。
4. Chatwork／Google Chat wizardのtitleとbannerが`agentic-secretary`になり、yasashii互換と反対manifest混在停止を壊さない。

Codexについて、利用可能な独立の公式validatorは確認できていない。未実行のvalidatorをPASSとは表示せず、
正式manifest／repository marketplaceのschema検査、Claudeと同じ15 skill正本への解決、legacy／manual-only負テスト、
合成HOME／CODEX_HOMEでのCodex CLI ingestion 4／4を代替証拠とする。

### 既取得4 host証拠の再利用handoff

既取得証拠の正本記録は `docs/feedback/sprint-033.md` の
「Sprint 033 post-install fresh独立評価」にある。対象bytesは今回確認したcandidate
`467043802ea030b67d092d86761caffa84675d61` と同一である。

| host | 再利用するhost固有証拠 | 対応確認 |
|---|---|---|
| Codex CLI | namespaced skill、0.8.0、Agentic identity、`resume-check=1`、会話8面Markdown、変更0件、更新cacheからの両wizard実起動 | CLI command／fresh session証拠として扱い、Appへ流用しない |
| Claude Code CLI | 0.8.0、Agentic identity、会話8面Markdown、変更0件、Claude cache digestのsource一致 | CLI command／fresh session証拠として扱い、Desktop Appへ流用しない |
| Codex App | task `019f846f-cd28-7820-a5b8-61dc1e67a622` のApp固有session record。skill、0.8.0、Agentic identity、`resume-check=1`、会話8面Markdown、変更0件 | CLI結果ではなくApp task／session recordを再利用する |
| Claude Code Desktop App | current bytes再導入後の新規sessionを実画面AX treeで確認。skill、0.8.0、Agentic identity、`resume-check=1`、会話8面Markdown、変更0件 | 旧bytesやCLI結果ではなくDesktop App固有証拠を再利用する |

同じ評価記録には、installed cacheの `wizard-product-identity.mjs` とsourceのSHA-256一致、
Chatwork／Google Chat両wizardのHTML title・上部banner・dynamic titleが`agentic-secretary`、旧ID 0件、
対象workspace変更0件、Secret露出0件も記録されている。fresh Evaluatorはこの記録を無条件に採用せず、
今回のcandidate commit、manifest／marketplace、version、identity、15 skill正本、host／sessionの対応、
不要な識別子やSecret実値が保持されていないことを照合する。整合すれば4 host smokeを全件取り直さず、
不一致または欠落がある面だけ軽量に再確認する。

### 副作用とEvaluatorへの最終引き渡し

- targetは検査前後ともcleanで、commit、push、install／再導入、cache直接編集、App操作は0件。
- public設定、tag、Release作成、OAuth、Repository Secret、Chatwork／Google Chat実API送信は0件。
- Harness正本で編集したのは、本Generatorの正本 `docs/progress/sprint-033.md` だけ。
- `/Users/taisei/workspace/agentic-harness` は存在確認、path列挙、read、write、Git、コマンド対象化、複製元利用を
  含め一切対象にしていない。
- fresh Evaluatorは改訂済み `docs/spec/rubric.md` のC15を使い、schema v2／v3 attestationやformal verified 0/4を
  減点理由に戻さない。製品動作、安全性、正式配布面、4 host固有証拠、今回のローカル回帰を直接照合する。

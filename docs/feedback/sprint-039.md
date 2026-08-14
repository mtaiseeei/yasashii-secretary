# Sprint 039 fresh独立評価

## 判定

- Sprint contract result: **FAIL**
- Failure kind: **implementation-issue**
- Evaluated candidate: `e23bdafd4d853d30eecbfa8ed97b534f739fa78f`
- Evaluated at: `2026-08-14`（Asia/Tokyo）
- Product findings: **2件**
- Blocking verification-infra findings: **0件**
- External write: **0件**
- Escalation Recommendation: **none**

名前Skill、stable identity、AI author、canonical resolver、Codex／Claude managed block、routing、A〜D rename、
overlay、report-schemaは、checkoutとGit-free archiveの専用検査で成立した。一方、現行のrelease integrityが
名前Skill追加後の配布surfaceを受理せず、renameのcommit失敗注入が実際にはcommitを通らないため、必須の
rollbackを実証できない。いずれも既存の受入基準に直接反する製品実装の欠陥であり、検証形式の不足ではない。

## Blocking product findings

### P1 — release integrityが追加された名前Skillを拒否する

- Classification: **product**
- Severity: **High**
- Status: **OPEN**
- Affected acceptance criteria: **AC13、AC14、AC17**
- Affected rubric: **C2、C6**

`scripts/check-release-integrity.py` はSkill数を15に固定したままで、Sprint 039が追加した正式な名前Skillを
現行配布surfaceとして受理しない。開始commitではexit 0だが、同じ検査はcandidateのcheckoutとGit-free archiveで
exit 1になった。`check-report-schema.py` の21 surfacesと名前Skill専用検査が通っても、出荷時に使う既存の
release integrityがcandidateを拒否するため、正式surface inventory同士が不整合である。

証跡:

```text
python3 scripts/check-release-integrity.py --root <start-commit-checkout>
exit 0

python3 scripts/check-release-integrity.py --root <candidate-checkout>
exit 1
result: 15 Skills固定のため新しい name Skillを拒否

python3 scripts/check-release-integrity.py --root <candidate-git-free-archive>
exit 1
result: checkoutと同じ name Skill rejection
```

必要な修正は、名前Skillを正式inventoryへ加え、checkoutとGit-free archiveの両方で現行candidateを受理しつつ、
unknownへの差し替えを引き続きmissingとunexpectedの両方で拒否することである。検査を削除したり、archive側だけ
skipしたりして通す修正はAC13／AC14を満たさない。

### P2 — renameにGit commit phaseがなく、commit失敗時rollbackが成立しない

- Classification: **product**
- Severity: **High**
- Status: **OPEN**
- Affected acceptance criteria: **AC12、AC17**
- Affected rubric: **C5、C17**

独立fixtureで `rename-apply --fail-at commit` を実行するとexit 0になり、renameが適用されたままworking treeがdirtyに
なった。CLI／libraryには実際のGit commit phaseがないため、`commit` のfailure injectionは失敗を発生させず、
契約が要求する「commit失敗で全対象とGit状態を開始前へrollback」を検証可能な挙動として実装していない。

証跡:

```text
rename-apply --fail-at commit
exit 0
rename result: applied
git result: working tree dirty
rollback result: not performed
```

必要な修正は、rename transactionに実在するcommit phaseを設け、commit失敗時に対象bytes、identity、aliases、
managed block、index／working treeを開始前へ戻すことである。失敗後のbackup／temporary file、旧名／新名混在、
retry追加差分も0件でなければならない。

## 独立確認で成立した面

- 固定Agentic candidate、handoff digest、commonPaths分類、overlay check／apply／reapply、未分類0、二回目差分0。
- 名前SkillのYasashii edition解決、stable identity、AI author、aliases、利用者の呼び方との分離。
- canonical workspace resolver、別repo cwd副作用0、registry異常のsafe stop。
- Codex override／Claude user-scope managed blockの明示確認、拒否、disable、冪等、既存内容保護。
- direct／delegation routingの正case、人間・顧客・author・引用・code等の負case、曖昧時の一度確認。
- rename previewのA〜D分類、選択B、C保持＋alias、D不変、未作成／disabled routing維持。
- `check-report-schema.py` の正式21 surfacesと、unknown差し替えのmissing／unexpected拒否。
- Yasashii固有copy、style、identity、manifest／marketplace、README、LICENSE、Harness導線の保持。
- checkoutとGit-free archiveの専用Sprint 039、overlay、schema、name Skill、managed block検査。

これらの合格はP1／P2を相殺しない。1つでも必須閾値を下回ればSprint全体をFAILにするrubricに従う。

## Acceptance Criteria

| AC | 結果 | 根拠 |
|---:|---|---|
| 1 | PASS | 固定Agentic SHA、handoff candidate、common digestの対応を確認。 |
| 2 | PASS | commonPaths限定、全path分類、overlay check／reapply、未分類0、二回目差分0を確認。 |
| 3 | PASS | Yasashii固有surfaceとrepo-owned docsを保護し、Agentic docs／state／release記録の同期0。 |
| 4 | PASS | 指定／提案、保存前確認、拒否、不適格名、既存利用者の名前Skillを確認。 |
| 5 | PASS | display name、stable identity、AI種別、aliases、AI authorと過去author主体の保持を確認。 |
| 6 | PASS | user-scope enableの説明・明示確認・拒否、Codex override、Claude user-scope fileを確認。 |
| 7 | PASS | managed blockのcreate／update／disable、冪等、既存内容・改行・mode保護を確認。 |
| 8 | PASS | canonical resolverと異常系safe stop、別repo cwdへの副作用0を確認。 |
| 9 | PASS | routing正負caseと曖昧時一度確認を確認。 |
| 10 | PASS | rename previewのA〜D分類、read-only snapshot、blind replacement 0を確認。 |
| 11 | PASS | Aの所有field、選択B、C保持＋alias、D不変、未作成／disabled routing維持を確認。 |
| 12 | **FAIL** | `--fail-at commit` がexit 0でrenameを残し、Git working treeもdirty。commit失敗rollback未実装。 |
| 13 | **FAIL** | report-schemaは通るが、release integrityが15 Skills固定で新しい名前Skillを拒否。 |
| 14 | **FAIL** | checkout／Git-free archiveのrelease integrityがともにexit 1で、全対象0 FAILではない。 |
| 15 | PASS | Yasashii固有copy、製品identity、repository、marketplace、README、LICENSE、Harness導線を維持。 |
| 16 | PASS | 実行OS、既存Windows suite、Sprint 039 identity面のWindows native not-run、残余リスクを分離。全環境PASSへ昇格していない。 |
| 17 | **FAIL** | product finding 2件、C2／C5／C6／C17が5/5未達。 |
| 18 | PASS | private版、実HOME／cache／workspace、Mac mini、remote、release、Secret、Actions、OAuth、実APIへのwrite 0。 |

## Rubric score

Sprint 039契約が5/5を必須とする重点軸を採点した。

| ID | 基準 | Score | Threshold | 判定根拠 |
|---|---|---:|---:|---|
| C2 | 構文・整合 | **4/5** | 5 | report-schemaと名前Skill専用面は合格したが、release integrityの正式Skill inventoryが不整合。 |
| C5 | 安全・規律 | **4/5** | 5 | renameのcommit失敗時に変更とdirty Git状態が残り、transactionの安全境界を満たさない。 |
| C6 | 無回帰 | **4/5** | 5 | candidate checkout／archiveの現行release integrityがexit 1。 |
| C9 | 配布チャネル非依存 | **5/5** | 5 | Yasashii identity、一般向け公開面、README、LICENSE、creditを維持。 |
| C10 | 更新の安全性 | **5/5** | 5 | version更新経路は変更せず、既存の確認・rollback境界に新しい回帰を確認しなかった。 |
| C13 | edition分離・互換 | **5/5** | 5 | commonPaths限定overlay、未分類0、Yasashii固有surface保護、外部write 0。 |
| C14 | 会話のMarkdown可読性 | **5/5** | 5 | Yasashii固有の説明・段落・edition差を維持し、対象検査が合格。 |
| C16 | Windows native保存・0.9.2下流同期 | **5/5** | 5 | 既存12 labelsの結果とSprint 039 identity面のWindows native not-runを分離し、未実行を解消済みにしていない。 |
| C17 | 秘書identity・routing・安全な改名 | **4/5** | 5 | identity／routing／通常renameは成立したが、commit失敗時の完全rollbackが成立しない。 |

4軸が必須閾値を下回るため、総合判定はFAILである。

## 既知のverification-infra／historical failures

開始前からある広い旧回帰の失敗は、Sprint 039のproduct findingへ重複計上していない。

- `scripts/sprint-035-patch-001-regression.sh`: 5 PASS / 6 FAIL。
- 内訳は既存wizard assetの固定digest差、sandboxのloopback bind `EPERM 127.0.0.1`、現在のAgentic checkout HEADを読む
  旧Sprint 034 overlay testの`UPSTREAM_ADVANCE`／fixture drift、旧README Cloud説明期待との不一致。
- これらは既知のhistorical／verification-infraとして分離し、PASSへ言い換えていない。
- P1は現candidateの名前Skillとrelease integrityの直接不整合であり、historical failureには分類しない。

## UI／screenshot

Sprint 039にbrowser画面の追加・変更はない。対象は会話Skill、identity、file管理、routing、renameのCLI／library面であり、
contractのEvidence safe harborもbrowser操作とscreenshotを必須としていない。このためUI採点とscreenshot取得は **not applicable**。

## External operations

private版、実HOME、installed plugin／cache、実利用workspace、Mac mini、origin／upstream remote、Secret、Actions、OAuth、
実API、commit、push、PR、merge、tag、Release、marketplace、install／updateはすべて **not-run / write 0**。

## Evaluator self-review

- P1とP2はSprint着手時点のAC12〜14、AC17、rubric C2／C5／C6／C17に直接対応し、新しい証拠形式や合格条件を追加していない。
- checkoutとGit-free archiveの同一失敗を別findingへ水増ししていない。
- historical／verification-infraの失敗を現candidateのproduct findingへ誤分類していない。
- 専用面のPASSをrelease integrity／rollbackのFAILの代替にしていない。
- Evaluatorは製品、test、spec、state、progress、Gitを変更していない。

# Sprint 039 Retry 1 fresh独立評価

## 判定

- Sprint contract result: **FAIL**
- Failure kind: **spec-issue**
- Evaluated candidate HEAD: `ac16d605704b993003fba8f4843f11316374dd0c`
- Evaluated product candidate: `65dccf6cb333f11d3fac6bfab729fb993bc1a26f`
- Evaluated at: `2026-08-14`（Asia/Tokyo）
- Product findings: **0件**
- Blocking verification-infra findings: **0件**
- Spec issues: **1件**
- External write: **0件**
- Escalation Recommendation: **none**

Retry 1の製品修正は、clean checkoutと同一HEADのGit-free archiveで成立した。正式16 Skillsと
same-count unknown負例、名前identity／routing、所有path限定local checkpoint、commit／post-commit失敗rollback、
既存staged／unstaged／untracked保持、overlay、schema、release integrityはいずれも0 FAILだった。

ただしPlanner正本は同期入力をAgentic `3e08eb6...`／handoff digest `7498d3...`へ固定している一方、
実candidateは、Agentic `sprint-039-patch-001`のfresh独立PASS・state done後にaccepted candidate
`3fa8d97...`／digest `c810f6...`を意図的に再同期している。製品挙動の欠陥ではなく、accepted upstream Patchへ
Yasashii契約が追随していない仕様正本の不整合である。旧SHAを製品へ戻す、または現candidateを旧SHAとして
読み替える判定は行わない。Plannerが固定入力、handoff、overlay metadata保護基準を更新した後、fresh Generatorの
整合確認を経てEvaluatorへ戻す必要がある。

## Spec issue S1 — accepted upstream PatchへSprint正本が追随していない

- Failure classification: **spec-issue**
- Finding target classification: **productではない／verification-infraではない**
- Severity: **Blocking contract mismatch**
- Status: **OPEN**
- Affected acceptance criteria: **AC1、AC2、AC3、AC17**
- Affected rubric: **C13、C17の固定入力・overlay境界**

Planner正本:

```text
docs/sprints/sprint-039.md
  Agentic candidate: 3e08eb6d377392440e753bd5073c73d1d63399b6
  handoff digest: 7498d3550734ba63b689463f01e2a52e16d2ce3f8eb31cebead16aef2181f883

docs/spec/constraints.md / docs/spec/rubric.md
  同じ旧candidateをSprint 039の固定入力として記載
```

実candidate:

```text
secretary-overlay/upstream-base.json
  baseCommit: 3fa8d97e5dbfb2afa314f4ad179f17401b76d320
  commonTreeSha256: c810f60c3664ca331338e34680eec9bb6d21f8d850b97a39eef29f1a24f58557

scripts/sprint-039-overlay-test.mjs
  FIXED_SHA: 3fa8d97e5dbfb2afa314f4ad179f17401b76d320
  FIXED_DIGEST: c810f60c3664ca331338e34680eec9bb6d21f8d850b97a39eef29f1a24f58557
```

この新入力は、初回Evaluator P2のrename checkpointを上流共通コアで直したaccepted Agentic
`sprint-039-patch-001`を下流へ同期するための意図的な更新である。現製品を旧inputへ戻すのではなく、Plannerが
accepted candidate更新を仕様へ反映し、14→16 handoff paths、旧／新digest、変更が必要なoverlay metadataの扱いを
明文化するのが正しい差し戻し先である。

## Retry 1で解消を確認したproduct findings

### 旧P1 — release integrityの正式Skill inventory: RESOLVED

- `check-release-integrity.py` は `name` を含む正式16 Skillsのexact setを受理した。
- 独立fixtureで `name` を `unknown` へ置き換え、件数16を維持してもexit 1になった。
- 出力は `unexpected formal Skill: unknown` と `expected formal Skill missing: name` の両方を含んだ。
- clean checkoutとGit-free archiveの両方で正式candidateはPASS、unknown負例はFAILした。

### 旧P2 — rename checkpoint／commit rollback: RESOLVED

- canonical workspaceの正確なGit top-levelを確認し、製品所有pathだけをlocal commit 1件へ記録した。
- 既存staged／unstaged／untrackedは成功後も開始前と同一だった。
- `before-checkpoint`、`stage`、`commit`、`post-commit`の各失敗で、workspace、合成HOME、HEAD、index、
  worktreeを開始前へrollbackした。
- CLIの `rename-apply --fail-at commit` は非0で停止し、成功扱い・dirty残存・部分renameは0件だった。
- failure後retryはcommit 1件、成功後の再実行は追加commit／差分0件だった。
- rename対象自身の開始前dirty、親repo誤採用、nested別repoは副作用0でsafe stopした。

## 実行証跡

### 候補固定

```text
git rev-parse HEAD
ac16d605704b993003fba8f4843f11316374dd0c

git show -s --format='%H %P %s' ac16d60
ac16d605704b993003fba8f4843f11316374dd0c 65dccf6cb333f11d3fac6bfab729fb993bc1a26f [sprint-039] Yasashii版を独立評価へ移行

git diff --name-status 65dccf6..ac16d60
M docs/sprints/state.md
```

製品bytesは `65dccf6`、評価待ちstateだけを加えた候補HEADが `ac16d60` である。開始時の実repo working treeはcleanだった。

### clean checkout

```text
bash scripts/sprint-039-patch-001-regression.sh
SPRINT039_PATCH001_PASS=16 SPRINT039_PATCH001_FAIL=0
SPRINT039_PASS=69 SPRINT039_FAIL=0
PASS=7 FAIL=0
PASS=71 FAIL=0
SPRINT035_PASS=15 SPRINT035_FAIL=0
SCHEMA_OK owner=active-edition-style entrypoint=rules/plain-language.md surfaces=21 conflicts=0 states=5
PASS=1 FAIL=0
SPRINT039_RELEASE_INTEGRITY_PASS=2 SPRINT039_RELEASE_INTEGRITY_FAIL=0
PASS=9 FAIL=0
exit 0
```

### 同一HEADのGit-free archive

```text
git archive ac16d605704b993003fba8f4843f11316374dd0c | tar -xf - -C <git-free-archive>
test ! -e <git-free-archive>/.git

bash scripts/sprint-039-patch-001-regression.sh
SPRINT039_PATCH001_PASS=16 SPRINT039_PATCH001_FAIL=0
SPRINT039_PASS=69 SPRINT039_FAIL=0
PASS=7 FAIL=0
PASS=71 FAIL=0
SPRINT035_PASS=15 SPRINT035_FAIL=0
SCHEMA_OK owner=active-edition-style entrypoint=rules/plain-language.md surfaces=21 conflicts=0 states=5
PASS=1 FAIL=0
SPRINT039_RELEASE_INTEGRITY_PASS=2 SPRINT039_RELEASE_INTEGRITY_FAIL=0
PASS=9 FAIL=0
exit 0
```

### overlay／Yasashii固有surface

accepted Agentic `3fa8d97...`のGit archiveをread-only入力にし、clean checkoutとGit-free archiveの両方で実行した。

```text
node scripts/sprint-039-overlay-test.mjs <fixed-agentic-archive>
SPRINT039_OVERLAY_PASS=6 SPRINT039_OVERLAY_FAIL=0

node scripts/sync-secretary-overlay.mjs --check --candidate <fixed-agentic-archive> --observed-commit 3fa8d97...
OVERLAY_CHECK_PASS base=3fa8d97... managed=277 handoffPaths=16
handoffDigest=c810f60c... overlayDigest=5850ef7b...

node scripts/sync-secretary-overlay.mjs --reapply --candidate <fixed-agentic-archive> --observed-commit 3fa8d97...
OVERLAY_REAPPLY_PASS digest=3698b74e... secondChanged=0 overlayDigest=5850ef7b...
```

13 common pathsはAgenticとbyte一致し、`name`／`secretary`／`settings`の3 Skillだけが宣言済みanchorだった。
未分類0、Agentic docs／Sprint asset同期0、Yasashii identity／copy／style／repository／manifest／marketplace／README／
LICENSE／Harness導線の変化0を確認した。

開始HEAD `ee62b5e`、初回candidate `e23bdaf`、Retry 1製品candidate `65dccf6`で、次の保護surfaceは
Git blobが同一だった: README、LICENSE、AGENTS、Yasashii copy、edition、rule manifest、Claude／Codexの
marketplaceとplugin manifest。

### Windows既存suite／実行OS

```text
Darwin 25.6.0 arm64
Node.js v22.23.2

node scripts/sprint-038-patch-002-windows-test.mjs
SPRINT038_PATCH002_WINDOWS_PASS=12 FAIL=0 OS=darwin

bash scripts/sprint-038-regression.sh
SPRINT038_PASS=64 SPRINT038_FAIL=0
SPRINT038_HISTORICAL_CLASSIFIER_PASS=14 SPRINT038_HISTORICAL_CLASSIFIER_FAIL=0
SPRINT038_HISTORICAL_PATH_PASS=3 SPRINT038_HISTORICAL_PATH_FAIL=0

bash scripts/sprint-011-regression.sh
PASS=68 FAIL=0
```

これはportable／既存Node-native回帰であり、Sprint 039の新identity／rename面をWindows nativeで実行した証拠ではない。
Windowsの新identity native実行は **not-run**。Windows解消済み、全環境PASS、Windows 16/16とは表示しない。

## historical／verification-infra差の分離

`bash scripts/sprint-035-patch-001-regression.sh` は、初回評価candidate `e23bdaf`とRetry 1候補
`ac16d60`のclean cloneを同じDarwin sandbox・同じ現在Agentic siblingで実行し、両方とも
`SPRINT035_PATCH001_REGRESSION_PASS=5 ... FAIL=6`だった。

- 既存wizard assetの固定digest差。
- sandboxのloopback bind拒否 `EPERM 127.0.0.1`（Chatwork／Google Chat）。
- 旧Sprint 034 testが固定archiveではなく現在Agentic sibling HEADを読むための `UPSTREAM_ADVANCE` と後続fixture drift。
- 旧README Cloud説明expectationとの差。

開始candidateとRetry 1で集計が同一で、Retry 1の製品差分はこれらの領域を変更していない。したがって現product
findingへ再分類せず、historical／verification-infraとして保持する。引き渡されたRetry専用回帰はcheckout／archiveとも
exit 0なので、blocking verification-infra findingは0件である。

## Acceptance Criteria

| AC | 結果 | 根拠 |
|---:|---|---|
| 1 | **FAIL — spec-issue** | Planner正本は`3e08eb6`／`7498d3`固定、accepted実candidateは`3fa8d97`／`c810f6`。製品欠陥ではなく正本未追随。 |
| 2 | **BLOCKED — spec-issue** | 現accepted handoff 16 paths、common parity、未分類0、check／reapplyはPASS。正式固定入力の更新後に確定する。 |
| 3 | **BLOCKED — spec-issue** | 利用者向けYasashii保護surfaceは不変。accepted input更新に伴うoverlay metadata更新の許容をPlanner正本へ反映する必要がある。 |
| 4 | PASS | 指定／提案、保存前確認、拒否、不適格名、既存利用者のname Skillがgreen。 |
| 5 | PASS | display name、stable identity、AI種別、aliases、AI author、過去author主体を保持。 |
| 6 | PASS | user-scope明示確認／拒否、Codex override、Claude user-scope fileを合成HOMEで確認。 |
| 7 | PASS | managed blockのcreate／update／disable、rollback、冪等、手書き／別block／改行／mode保持がgreen。 |
| 8 | PASS | canonical resolver、別repo cwd副作用0、registry異常／symlink等のsafe stopがgreen。 |
| 9 | PASS | direct／delegation正case、人間／顧客／author／引用／code等の負case、曖昧一度確認がgreen。 |
| 10 | PASS | A〜D preview、read-only snapshot、製品field限定、blind replacement 0がgreen。 |
| 11 | PASS | A所有field、選択B、C保持＋alias、D不変、未作成／disabled routing保持がgreen。 |
| 12 | PASS | 実commit checkpoint、commit／post-commit等のrollback、Git既存状態保持、retry冪等がgreen。 |
| 13 | PASS | 正式16 Skillsを受理し、same-count unknownをunexpected＋missingで拒否。schema 21 surfacesもgreen。 |
| 14 | PASS | clean checkout／Git-free archiveのRetry専用回帰、overlay、schema、release integrityが0 FAIL。旧広域6 FAILは開始candidate同一のhistorical infra。 |
| 15 | PASS | Yasashii copy／identity／repository／marketplace／README／LICENSE／Harness導線を保持。Agentic／private identity混入0。 |
| 16 | PASS | Darwin既存12/0と新identity Windows native not-runを分離し、全環境PASSへ昇格していない。 |
| 17 | **FAIL — spec-issue** | product finding 0、blocking verification-infra 0だが、固定入力の仕様不整合が残るためcontract全体をPASSにできない。 |
| 18 | PASS | private版、実HOME／cache／workspace、Mac mini、remote、release、Secret、Actions、OAuth、実APIへのwrite 0。 |

## Rubric score

現accepted input `3fa8d97`を前提にした製品挙動は全重点軸で5/5相当だった。ただしC13／C17の固定入力を定める
Planner正本が旧candidateのため、下表の5/5は **製品挙動の暫定スコア** であり、Sprint contract PASSを意味しない。

| ID | 基準 | Product score | Threshold | 判定根拠 |
|---|---|---:|---:|---|
| C2 | 構文・整合 | 5/5 | 5 | schema 21 surfaces、正式16 Skills、same-count unknown負例、checkout／archiveがgreen。 |
| C5 | 安全・規律 | 5/5 | 5 | 明示確認、所有path限定commit、既存Git状態保持、commit／post-commit rollbackがgreen。 |
| C6 | 無回帰 | 5/5 | 5 | Retry専用checkout／archive、Sprint 038／011がgreen。旧広域差は開始candidate同一のinfra。 |
| C9 | 配布チャネル非依存 | 5/5 | 5 | Yasashii正式配布identity／manifest／marketplace／README／LICENSEを保持。 |
| C10 | 更新の安全性 | 5/5 | 5 | 更新・release経路を変更せず、無確認の外部副作用0。 |
| C13 | edition分離・互換 | 5/5暫定 | 5 | accepted 16-path handoff、13 common byte parity、3 anchors、未分類0、固有surface保護。正本更新待ち。 |
| C14 | 会話のMarkdown可読性 | 5/5 | 5 | Yasashii copy／style／serializer正本を維持し、対象回帰green。 |
| C16 | Windows native保存・0.9.2下流同期 | 5/5 | 5 | 既存Darwin 12/0とWindows新identity not-runを正直に分離し、0.9.2 surfaceを維持。 |
| C17 | 秘書identity・routing・安全な改名 | 5/5暫定 | 5 | identity／routing／checkpoint／完全rollbackはgreen。accepted固定入力の正本更新待ち。 |

総合判定は、product scoreではなく未解消のspec-issueによりFAILである。

## UI／screenshot

Sprint 039 Retry 1にbrowser画面の追加・変更はない。対象はCLI／library、file transaction、overlay、validatorであり、
contractのEvidence safe harborもbrowser操作とscreenshotを必須としていない。UI採点とscreenshotは **not applicable**。

## External operations

private版、実HOME、installed plugin／cache、実利用workspace、Mac mini、origin／upstream remote、Secret、Actions、OAuth、
実API、実repoのcommit、push、PR、merge、tag、Release、marketplace、install／updateはすべて **not-run / write 0**。
Git commitは隔離fixture内だけで実行した。

## Evaluator self-review

- 旧P1／P2が実挙動で解消したことを確認し、以前のFAILを履歴から消していない。
- accepted upstream Patchへの追随漏れを製品findingへ偽装せず、spec-issueとしてPlannerへ戻した。
- 現candidateのtarget／archive greenを、旧固定入力のままSprint contract PASSへ読み替えていない。
- historical master 5/6は開始candidateとRetry 1で同じ集計・同じ主因であり、product findingへ水増ししていない。
- WindowsのDarwin実行をnative Windows証拠へ昇格していない。
- Evaluatorは製品、test、spec、state、progress、Gitを変更せず、このfeedbackだけへ追記した。

# Sprint 039 spec整合後 fresh最終評価

## 判定

**PASS**

- 評価HEAD: `44449a6a7479a5fe52ace0748db08d6bbf208eea`
- 製品／test／overlay candidate: `65dccf6cb333f11d3fac6bfab729fb993bc1a26f`
- 固定Agentic製品candidate: `3fa8d97e5dbfb2afa314f4ad179f17401b76d320`
- handoff common digest: `c810f60c3664ca331338e34680eec9bb6d21f8d850b97a39eef29f1a24f58557`
- product finding: **0件**
- blocking verification-infra finding: **0件**
- 未検証の必須内部項目: **0件**
- failure route: **none**

前回S1は **RESOLVED**。Planner正本の固定入力、digest、16 `commonPaths`、13 byte parity＋3宣言anchorが、すでに独立PASS済みのAgentic Patch製品candidateと一致した。`65dccf6..44449a6`の製品、test、overlay差分は0件で、今回の変化はspec／契約／state／progress／feedbackだけだった。

## Findings

| ID | 分類 | Severity | 状態 | 内容 |
|---|---|---|---|---|
| S1 | spec-issue | Major | RESOLVED | 固定入力を旧`3e08eb6`／`7498d...`からaccepted `3fa8d97`／`c810f60c...`へ更新し、16 paths、13 parity＋3 anchors、`external-ops.mjs`／`safe-git.mjs`を正本間で一致させた。 |

新規product findingは0件。新規verification-infra findingも0件。前回記録したhistorical masterの既知6 FAILは、開始candidateでも同じだった非因果のverification-infraとして履歴を維持し、今回の製品PASSへ読み替えていない。

## 独立評価環境

- 実repoは評価開始時clean。評価HEADを`git clone --no-hardlinks`した隔離checkoutと、同じHEADを`git archive`で展開した`.git`なしarchiveを新規作成した。
- Agentic入力も`3fa8d97...`のlocal Git archiveから新規作成し、moving checkoutを入力にしていない。
- 実行環境: Darwin arm64、Node.js `v22.23.2`。
- テストのHOME、workspace、Git repo、local bare remoteは一時fixtureだけ。実HOME、実workspace、実remoteへのwriteは0件。

## 実行証拠

### 固定入力、16 paths、overlay

- 独立計算: `commonPaths=16`、SHA-256=`c810f60c3664ca331338e34680eec9bb6d21f8d850b97a39eef29f1a24f58557`。`external-ops.mjs`と`safe-git.mjs`を含む。
- `node scripts/sprint-039-overlay-test.mjs <agentic-3fa8-archive>`: checkout／Git-free archiveとも`SPRINT039_OVERLAY_PASS=6 FAIL=0`。
- `node scripts/sync-secretary-overlay.mjs --check ...`: 両面ともPASS。`managed=277`、`handoffPaths=16`、handoff digest一致、未分類0。
- 隔離checkoutで`--reapply`: `secondChanged=0`、reapply後の`git diff --exit-code`と`git status --short`がclean。
- overlay definition digest `5850ef7b197e9f524891d0af5f71c3be1b39ed468fddae37d8044c04f58e37df`、reapply digest `3698b74e36909b1a3bee38fd2d2187758f4a8085481a44a32f3a0e30caa53ad5`。
- 旧固定値`3e08eb6...`／`7498d...`は、履歴を保持する`docs/**`以外の実装所有面に0件。

### checkout／Git-free archive回帰

両面で`bash scripts/sprint-039-patch-001-regression.sh`を実行し、exit 0、同じ集計を得た。

| 面 | 結果 |
|---|---|
| Patch専用 | `SPRINT039_PATCH001_PASS=16 FAIL=0` |
| Sprint 039本体 | `SPRINT039_PASS=69 FAIL=0`、wrapper 7/0 |
| Git safety | 71/0 |
| Sprint 035 target | 15/0 |
| report schema | 正式21 surfaces、1/0 |
| release integrity | 正式16 Skills＋same-count unknown negative、2/0 |
| wrapper全体 | 9/0 |

この回帰で、所有pathだけのrequired local checkpoint、既存staged／unstaged／untracked保持、開始前dirty／親repo／nested repoのsafe stop、`before-write-2`／`before-checkpoint`／stage／commit／post-commit failureのHEAD・index・worktree・HOME完全rollback、commit failure後retry 1 commit、成功後再実行追加commit 0を確認した。実在commit工程の強制失敗も非0になりrollbackした。

同じ回帰で、合成HOME上のCodex通常`AGENTS.md`／`AGENTS.override.md`優先、Claude `CLAUDE.md`、managed blockの明示確認前write 0、create／disable／冪等／部分失敗rollback、canonical resolver、registry異常停止、直接呼びかけ正caseと人間／顧客／著者／引用／code負case、rename P1〜P4、stable identity、AI authorを確認した。

### protected surfaceとrelease境界

- `65dccf6..44449a6`で`secretary-overlay/`、`plugins/`、`scripts/`の差分0件。
- README、LICENSE、AGENTS、Yasashii copy／style、edition、rule manifest、Claude／Codex marketplace／plugin manifestの差分0件。
- Agentic docs／progress／feedback／state／release記録の同期0件。private／my-vault対応済み表示0件。
- release integrityは正式16 Skillsを受理し、`name`を`unknown`へ差し替えて件数を16に保つ負fixtureを、`unexpected`と`missing`の両方で拒否した。

### Windowsとhistorical infraの分離

- `node scripts/sprint-038-patch-002-windows-test.mjs`: `OS=darwin`、既存12 labelsが12/0。
- Sprint 039の新identity／routing／renameを、新しいWindows identity上でnative実行した証拠は **not-run**。Darwin結果をWindows native PASSへ昇格していない。
- 前回の長時間historical master 5/6は、開始HEADと同一のwizard固定digest、sandbox loopback `EPERM 127.0.0.1`、moving Agentic checkoutを読む旧Sprint 034 oracle、旧README期待が原因だった。今回のtarget／checkout／archiveがgreenで製品candidate不変のため再反復せず、verification-infra履歴として保持した。

## Acceptance Criteria

| AC | 判定 | 根拠 |
|---:|---|---|
| 1 | PASS | accepted `3fa8d97...`、fresh独立PASS履歴、`c810f60c...`が正本間で一致。 |
| 2 | PASS | 16 paths、13 parity＋3 anchors、2安全path、未分類0、check／reapply追加差分0。 |
| 3 | PASS | Yasashii固有surfaceとhandoff所有外metadataを保護し、Agentic repo正本同期0。 |
| 4 | PASS | 指定／提案、保存前確認、拒否0 write、不適格名、owner呼び方分離がgreen。 |
| 5 | PASS | stable identity、AI種別、aliases、AI author一貫性がgreen。 |
| 6 | PASS | user-scope明示確認、Codex override、Claude file、拒否0 writeがgreen。 |
| 7 | PASS | managed blockのatomic／rollback／冪等／既存本文保持／disable保持がgreen。 |
| 8 | PASS | canonical workspaceとregistry異常、symlink、read-only、cwd副作用0がgreen。 |
| 9 | PASS | 直接呼びかけ／委譲正case、人間文脈語を含む依頼、負case、曖昧確認がgreen。 |
| 10 | PASS | A〜D preview、件数／推奨／非対象／rollback、snapshot一致、blind replacement 0。 |
| 11 | PASS | 所有field／選択Bのみ変更、C保持＋alias、D不変、未作成／disabled routing保持。 |
| 12 | PASS | dirty／衝突／部分失敗／commit／post-commitで完全rollback、retry追加差分0。 |
| 13 | PASS | 正式16 Skillsと正式21 surfacesがPASS、同数unknown差替えが期待どおりFAIL。 |
| 14 | PASS | clean checkout／Git-free archiveの必須回帰が0 FAIL。historical infraは別記。 |
| 15 | PASS | Yasashii copy、identity、repository、marketplace、README、LICENSE、Harness導線を保持。 |
| 16 | PASS | Darwin 12/0と新identity Windows native not-runを分離し、全環境PASSを主張していない。 |
| 17 | PASS | 全重点Rubric 5/5、product 0、blocking infra 0、未検証必須内部項目0。 |
| 18 | PASS | 実HOME、private、cache、実workspace、remote、release、Secret、Actions、OAuth、実API write 0。 |

## Rubric score

| ID | 基準 | Score | Threshold | 判定根拠 |
|---|---|---:|---:|---|
| C2 | 構文・整合 | 5/5 | 5 | schema 21 surfaces、正式16 Skills、同数unknown負例、両candidate面green。 |
| C5 | 安全・規律 | 5/5 | 5 | 明示確認、所有path checkpoint、既存Git状態保持、全failure point rollback。 |
| C6 | 無回帰 | 5/5 | 5 | checkout／archiveともPatch、Sprint 039、Git safety、Sprint 035、schema、releaseが0 FAIL。 |
| C9 | 配布チャネル非依存 | 5/5 | 5 | Yasashii正式identity／manifest／marketplace／README／LICENSEを保持。 |
| C10 | 更新の安全性 | 5/5 | 5 | user-scope／renameの確認、冪等、rollback、remote write 0。 |
| C13 | edition分離・互換 | 5/5 | 5 | accepted 16-path handoff、13 parity、3 anchors、未分類0、固有surface保護。 |
| C14 | 会話のMarkdown可読性 | 5/5 | 5 | Yasashii copy／style／serializer正本を維持し、対象回帰green。 |
| C16 | Windows native保存・0.9.2下流同期 | 5/5 | 5 | 既存12 labels維持、Bash非依存、overlay保護、Windows native not-runを正直に分離。 |
| C17 | 秘書identity・routing・安全な改名 | 5/5 | 5 | identity、managed routing、正負case、分類付きrename、checkpoint／rollbackがgreen。 |

必須9基準はすべて5/5で閾値を満たす。

## UI／外部操作／self-review

- browser UI変更なし。契約のsafe harborに従い、URL、DOM、screenshotはnot applicable。
- 実repoでcommit／push／PR／merge／tag／Release／marketplace／install／updateを行っていない。テスト内のcommit／local bare pushは隔離fixtureのみ。
- 以前のFAILとS1を削除せず、解消確認を追記した。productとverification-infraを混同していない。
- WindowsのDarwin実行をnative Windows証拠へ昇格していない。
- Evaluatorが変更したのはこのfeedbackだけである。

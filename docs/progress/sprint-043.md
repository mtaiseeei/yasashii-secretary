# Sprint 043 Progress — Project Clarity Yasashii final source gate

## 判定範囲

- Status: `candidate-unverified`。これはGenerator自己評価であり、fresh EvaluatorのVerdictではない。
- Verification implementation HEAD: `5ab8a3e70da29f5c12c3c78bda0fb8de0e183810`。
- Product candidate: `f5a44f180bf1d39a1f2689e9c6763723c23eb2da`。
- Product tree: `e9831484f912830b75349dedf6f50cb836a81b44`。
- Product scope: `plugins/secretary/**`、153 files。
- Product digest: `2bbb126e083ce65fc021b53a244549cd7a919f5b1867ff16d119f01a5bb9d3f0`。
- Digest algorithm: path byte順の`[path, mode, sha256(bytes), size]`をJSON化してSHA-256。
- `f5a44f1..5ab8a3e -- plugins/secretary adapters`の製品差分: 0。
- このSprintの変更はverification scripts／fixturesと本progressだけで、製品surface、spec、Sprint契約、state、feedbackは変更していない。

## 実装した検証面

- `scripts/fixtures/sprint-043/case-registry.json`
  - 固定public Sprint 050のprimary 250、CLX 20、XV 4の単一割当を保持する。
  - Case ID、本文、Severity、期待副作用をrow単位で保持し、public baselineのallocation／semantic SHA-256で改変を拒否する。
- `scripts/fixtures/sprint-043/final-matrix.json`
  - Yasashii 17機能／62 behaviorを各1回だけ、実行面、正例、負のbinding case、期待、観測、副作用、結果へ束縛する。
- `scripts/sprint-043-test.mjs`
  - Yasashii actual runnerを実行し、registryのexact集合、runner exit、PASS／FAIL／conditional NOT-RUNを突合する。
  - 旧`RG-010/011`は失敗を保持したまま、current candidate manifest／identity／update／report-schema gateへcandidate-awareに束縛する。
  - Git-free archiveではabsolute pathを含む旧prewrite receiptを同梱せず、portable candidate fixtureの固定receipt identityで`CLX-017/020`の同じ協働境界を検査する。
- `scripts/sprint-043-e2e.mjs`
  - 固定public E2E-001〜004をYasashii candidateへ適用し、initからDriftまでの実artifact／副作用を検査する。
- `scripts/sprint-043-candidate-check.mjs`
  - source、verification HEADのclean detached checkout、同HEADのGit-free archiveで同じcandidate product bytes／modeを検査する。
  - archiveから`.git`、Harness docs／評価artifact、absolute pathを持つprewrite fixtureを除外し、portable runnerを実行する。
- `scripts/sprint-043-source-receipt.mjs`／`scripts/lib/sprint-043-source-receipt.mjs`
  - final source receiptのschema／binding／verifierだけを実装した。
  - `docs/feedback/sprint-043.md`が未確定の現在はfinalizeを拒否する。final receiptは生成していない。
- `scripts/sprint-043-receipt-test.mjs`／`scripts/sprint-043-tamper-test.mjs`
  - feedback、candidate、registry、matrix、protected、digest、archive、runnerの代表改ざんをfail-closedにする。
- `scripts/sprint-043-regression.sh`
  - source full gate、E2E、current／historical gate分離、receipt負例、pending拒否、candidate identityを1つにまとめる。

## 3 surface identity

正式command:

```bash
node scripts/sprint-043-candidate-check.mjs --three-surfaces
```

結果:

```text
SPRINT043_SURFACES source=PASS clean_checkout=PASS git_free_archive=PASS candidate=f5a44f180bf1d39a1f2689e9c6763723c23eb2da tree=e9831484f912830b75349dedf6f50cb836a81b44 verification_head=5ab8a3e70da29f5c12c3c78bda0fb8de0e183810 product_digest=2bbb126e083ce65fc021b53a244549cd7a919f5b1867ff16d119f01a5bb9d3f0 files=153 paths=46 protected=9 features=17 behaviors=62 registry=273+1-not-run e2e=4 archive_git=0 absolute_source=0 private_source_literal=0 product_diff=0
```

| surface | product files／digest | 46 path | protected 9 | 17／62 | registry | E2E | 結果 |
|---|---|---:|---:|---:|---:|---:|---|
| source | 153／`2bbb126e...` | 46 | 9 | 17／62 | 273 PASS＋1 NR | 4/4 | PASS |
| clean detached checkout | 同一 | 46 | 9 | 17／62 | 273 PASS＋1 NR | 4/4 | PASS |
| Git-free archive | 同一 | 46 | 9 | 17／62 | 273 PASS＋1 NR | 4/4 | PASS |

clean checkout／archiveはOS tempの一時rootへ作成し、終了後に削除した。archive内の`.git`、元source absolute path、固定public／private source absolute path、Harness評価docsは0件。product path集合、mode、bytes、file count、digestは3面で一致した。

## 274 registry

source正式実行:

```bash
node scripts/sprint-043-test.mjs --report /tmp/sprint-043-source-report.json
```

```text
SPRINT043_REGISTRY surface=source primary=249/250 collaboration=20/20 visual=4/4 PASS=273 FAIL=0 CONDITIONAL_NOT_RUN=1 TOTAL=274 missing=0 extra=0 duplicate=0 semantic_changed=0 assignment_changed=0
```

| group | total | PASS | conditional NOT-RUN | FAIL |
|---|---:|---:|---:|---:|
| Primary | 250 | 249 | 1 | 0 |
| CLX | 20 | 20 | 0 | 0 |
| XV | 4 | 4 | 0 | 0 |
| 合計 | 274 | 273 | 1 | 0 |

| Severity | total | PASS | conditional NOT-RUN | FAIL |
|---|---:|---:|---:|---:|
| Critical | 124 | 124 | 0 | 0 |
| High | 128 | 127 | 1 | 0 |
| Medium | 22 | 22 | 0 | 0 |

`XM-007`だけが、実Xmind MCP connected create／read／updateに別の外部live承認がないためconditional `NOT-RUN`。PASSへ数えていない。registry allocation、case本文、Severity、期待副作用の変更は0件。

## E2E 4/4

```bash
node scripts/sprint-043-e2e.mjs --e2e-only --report /tmp/sprint-043-e2e-report.json
```

- `E2E-001`: Standalone init preview write 0→apply、Event／Evidence／State、4象限、Attention、doctor相当、Markdown／Mermaid、Claude／Codex synthetic Hook payload、Secretary-local、daily、Portfolio、link／pull sync、Xmind OFF／MCP-first／local temp承認、proposal。
- `E2E-002`: 匿名CRM 5 area、4象限＋将来アイデア、2 Sheet相当Xmind、stable ID、緑→黄のbranch／structure badge同期。
- `E2E-003`: email-first Decisionとcustomer_id-first実装のCritical Drift、両Evidence、実装修正後aligned、履歴保持。
- `E2E-004`: 29 Projectのmorning、判断4件を表示3＋残り1へbounded化、Critical Drift最優先、connector read 0。
- 集計: 4 PASS／0 FAIL。cross-root write、Hook loop、task自動作成、Decision誤確定は各0。
- UI evidenceは契約どおりMarkdown／raw Mermaid／isolated temp Xmind archiveのreadback。Web screenshot／live Xmind Appは要求せず未実行。

## path／protected／collaboration

- final actual path: 46（byte-sync 16、adapted 30）。unknown、overlap、unclassified、unused、staleは各0。
- Hook byte-sync 3 pathは固定public bytes／modeと一致。
- protected named group: 9。許可外変化0。
- downstream-owned product intersection: 0。
- Harness-owned product intersection: 0。
- collaboration inventory: 17 surface／CLX 20。task明示委譲、memory二重保存0、Harness正本非置換、自動update／connector 0を実内容で確認。

## current gateとhistorical verification-infraの分離

```text
SPRINT043_CURRENT_GATES report_schema=22 edition_guard=54/54 safety=69/69 current_manifest=0.11.0 published=0.10.3 downgrade_blocked_write=0 overlay_actual=46 protected=9 portable=candidate-check historical_update=12/15 historical_integrity=EXPECTED_6_DIFF sprint041_postapply=EXPECTED_24_PASS_2_PHASE_DIFF sprint042_wrapper=EXPECTED_ROLE_DOC_PHASE_DIFF
```

current candidate gateは次をgreenにした。

- Claude／Codex manifest `0.11.0`、formal Skill 17、report schema 22。
- published marketplace `0.10.3`不変。
- current `0.11.0`からpublished `0.10.3`への診断は`downgrade-blocked`、plugin／workspace／migration／commit／push／settings／reload write各0。
- edition guard 54/54、safety 69/69。
- path actual 46、protected 9、portable 3 surface。

旧gateの固定条件は書き換えず、次をverification-infra履歴として保持した。

- `RG-010/011`: 旧identity／overlay snapshotと0.10.3 update fixture差。current behaviorはcandidate-aware gateでPASS。
- `scripts/sprint-039-release-integrity-test.mjs`: 0.10.3／16 Skill／CHANGELOG固定の6差。published fixtureとvalidatorを変更していない。
- Sprint 041 wrapper: prewrite-only phaseを適用済みsourceへ再実行するため24 PASS／2 phase差。
- Sprint 042 wrapper: Generator時点のowned docs集合へEvaluator feedback／Orchestrator stateが加わったrole-doc phase差。製品suiteはSprint 043 runnerで再実行済み。

これらをPASS件数へ加算せず、current gateと別表示にした。新規product findingは0。

## tamper／receipt

- receipt negative: 10/10 PASS。pending、FAIL、candidate mismatch、case count欠落、false NOT-RUN、registry欠落、protected mismatch、matrix mismatch、feedback digest tamper、template非pendingを拒否。
- general tamper: 13/13 PASS。registry missing／duplicate／extra／semantic change、candidate／product digest、runner nonzero、product diff、archive `.git`／absolute source／private source、protected、matrix duplicateを拒否。
- `node scripts/sprint-043-source-receipt.mjs --check-pending`: exit 1、`feedback-pending`。
- final receipt file: 未生成。
- verifierはfresh feedbackのpath、SHA-256、Verdict PASS、exact candidate、17／62、250＋20＋4＋4、path46、protected9、`XM-007 NOT-RUN`を再照合する。
- finalizationはfresh Evaluator PASS後にOrchestratorだけが行う。
- final receiptの`nextPermission`は`release-decision-requires-separate-user-approval`で固定する。

## 正式wrapper

```bash
bash scripts/sprint-043-regression.sh
```

source結果:

```text
SPRINT043_REGRESSION PASS=273 FAIL=0 CONDITIONAL_NOT_RUN=1 CASES=274 E2E_PASS=4 E2E_FAIL=0 FEATURES=17 BEHAVIORS=62 PRODUCT_DIFF=0 PENDING_RECEIPT=REJECTED EXTERNAL_LIVE=NOT-RUN RELEASE=NOT-RUN
```

commit後の3 surface込み:

```bash
bash scripts/sprint-043-regression.sh --candidate
```

## Evaluator handoff

- startup command／URL: N/A。常駐Web appはない。
- fresh EvaluatorはGenerator自己評価を流用せず、`bash scripts/sprint-043-regression.sh --candidate`をclean stateで実行する。
- `docs/feedback/sprint-043.md`だけへexact candidate、証拠、C20〜C25を含む採点、Verdict、finding対象区分を書く。
- feedback確定前にsource receiptを生成しない。Evaluatorはreceipt、state、spec、Sprint契約を編集しない。
- PASS後、Orchestratorが`node scripts/sprint-043-source-receipt.mjs --finalize --output scripts/fixtures/sprint-043/source-pass-receipt.json`を実行し、直後に`node scripts/sprint-043-source-receipt.mjs --verify scripts/fixtures/sprint-043/source-pass-receipt.json`を実行する。
- release判断はreceipt finalization後も別ユーザー承認が必要。source PASSをrelease／cache／workspace／liveへ昇格しない。

## NOT-RUN／副作用0

- 実Xmind MCP／実local user `.xmind`／Xmind App: NOT-RUN。isolated temp archiveだけ実行。
- 実Claude／Codex host install／conversation／Hook発火: NOT-RUN。actual candidate command＋synthetic payloadだけ実行。
- external connector、実利用者workspace migration、Mac mini: NOT-RUN。
- release、push、tag、GitHub Release、Marketplace publish／refresh、cache、install、new session、loaded version: NOT-RUN。
- public source write、private source write、upstream write、remote write、external write: 0。

Generator自己評価はEvaluator verdictではない。

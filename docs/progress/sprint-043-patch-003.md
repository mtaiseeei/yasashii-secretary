# Sprint 043 Patch 003 Progress — Yasashii Harness包括scanとWindows native互換

## 判定範囲

- Status: `candidate-unverified`。これはGeneratorの自己評価と引き渡しであり、EvaluatorのVerdictではない。
- Current ID: `sprint-043-patch-003`。このSprint以外の製品実装は開始していない。
- 固定public candidate／tree: `fe3eab06d4fbd0b5b26d995129156f2fb2537dd2`／`2dd956ed987360781e2fccafb2ddbf52245219df`。
- 固定public fresh PASS: `348cb1825a7f7e228e71e3799e2fdff0ea9b464e`。
- 固定private candidate／tree: `a980208db3728fc2d12e61435b03cd4b33e79a29`／`a77fda7cbb1ea6536b4228a9002e3edcea6a7f1c`。
- 固定private fresh PASS: `b0c2138b8dcf96c144344e96307a22d38b4af349`。
- Yasashii開始HEAD／tree: `9009f892f678fbcbde9978e0bceb803d3f1ad7d5`／`de744087388b60d0f0f2db221b204c57a0c31bcf`。
- current-bytes candidate digest: `e24f4add240dcdf5ee97a7276af8c7c74cb629ef1704d56af2e52b316c2ba9f7`。9 actual Yasashii pathをpath、portable mode、CRLF-only正規化bytesで束ねた値。
- 実装commitは一度作成できた: `dc9c8be868e8dd3aec2245d480904e72667a922d`、tree `3dd14b75057340bd22fcc79640116097c8eaaaa9`。その後、`git diff --check`が検出したsupporting portability fileの末尾空行を修正したが、linked-worktree Git metadataの`index.lock: Operation not permitted`で再stage／amendできなかった。したがって最終current bytesはcommitより1 supporting whitespace修正だけ先行し、未commitである。
- Planner所有spec／contract、Orchestrator所有state、Evaluator feedback、accepted receipt、release metadataは編集していない。

## 実装

### public common core

固定public candidateから次の3 pathをbytes／mode一致で適用した。

- `plugins/secretary/scripts/clarity.mjs`
- `plugins/secretary/scripts/lib/clarity-core.mjs`
- `plugins/secretary/scripts/lib/clarity-harness-scan.mjs`（new）

3 pathはいずれもmode `100644`。固定public Git objectとのblob一致を直接確認した。

scannerはHarness authoritative reserved laneをgeneric scanより先に分離し、state、必要spec、Current contract／progress／feedback、guidance、packageをbounded readする。state／contract／progress／feedbackを4 roleとして混同せず、一つのCurrent bundleとEvidence locatorへ束ねる。invalid Currentの安全なfallbackでもbundleを保持し、valid／TBD／missing／invalid／巨大state、feedback absent、Secret-like／binary／symlink／permission／missing、partial／coverageを固有状態で返す。Windows同一Git rootはdev／inoのexact filesystem identityで判定し、identity 0／取得不能はfail closedにする。

### Yasashii adaptation

- collaboration inventoryを19→20 surface、41→57 assigned caseへ拡張した。
- `clarity-harness-scanner` surfaceに`yasashii-HS-001〜016`を一度ずつ割り当てた。
- inventory digestはCRLFだけをLFへportable正規化する。Windows checkoutではtracked Git mode、POSIX／Git-freeでは実filesystem modeを使い、content、mode、path、marker、missing／extra tamperを残す。
- collaboration suiteは20 surface／57 caseを固定し、既存CLX 20の意味を変更していない。
- 既存Windows workflowは`windows-native`、Windows 2025、Node 22、0.9.2 command、10分timeoutを維持し、独立step `node scripts/sprint-043-patch-003-test.mjs --require-windows`だけを追加した。public／privateの不存在pathは含めていない。

### supporting verification

- `scripts/sprint-043-patch-003-test.mjs`
  - macOS／portableではHS-001〜011と016を実操作し、012〜015を`requires-windows-native`でNOT-RUNにする。
  - Windows nativeでは16件を直接実行し、symlink／junction capabilityを別々に集計する。
  - SKIP／NOT-RUNをPASSへ加算しない。
- `scripts/sprint-043-patch-003-classification.mjs`
  - public actual 9 pathをYasashiiのbyte-sync 3／adapted 4／protected regression 1／supporting 1へ排他分類する。
  - before／public／private／after digest、mode、actual action／diffを検査し、unknown／overlap／missing／extra／stale／unused／unclassifiedを0へ固定する。
  - digest、mode、marker、path、missing、extra、role、fixed public digestの8 negativeを実行する。
- `scripts/fixtures/sprint-043-patch-003/actual-action-report.json`
  - 固定上流tupleとYasashii開始tuple、9 actual path、外部操作0をsanitizedに記録する。
  - private本文、Secret、顧客識別子、host固有absolute pathを含めていない。
- `scripts/sprint-043-patch-003-portability.mjs`
  - source、synthetic clean Git、Git-free archiveの同一digestでTarget、Patch 001／002、Sprint 042 core、Sprint 043 E2E、inventory、overlay、0.9.2 portableを実行する。
  - Git-freeへGitを仮設せず、Git必須面をPASSへ偽装しない。
- `scripts/sprint-043-patch-003-regression.sh`
  - Clarity core／projection／Hook／link／Drift／Xmind／collaborationを含む正式回帰入口。

## 実行結果

### 正式回帰

```text
YASASHII_SPRINT043_PATCH003_REGRESSION
TARGET=12+4-NOT-RUN
PATCH001=4
PATCH002=21
CORE=43
PROJECTION=35
HOOK=40
LINK=34
DRIFT=25
XMIND=29+1-NOT-RUN
COLLABORATION=20/57
OVERLAY=secondChanged0
E2E=4
WINDOWS_092_PORTABLE=12
PRODUCT_FAIL=0
WINDOWS_NATIVE=NOT-RUN
EXTERNAL_WRITE=0
```

| Command | Result |
|---|---|
| `node scripts/sprint-043-patch-003-test.mjs` | 12 PASS／0 FAIL／0 SKIP／4 NOT-RUN、external write 0、network 0、`WINDOWS_VERIFIED=false` |
| `node scripts/sprint-043-patch-003-classification.mjs` | 9 rows、3 byte-sync／4 adapted／1 protected／1 supporting、異常分類0、17 Skills／62 behavior、tamper negative 8 |
| `node scripts/sprint-043-patch-001-test.mjs` | 4 PASS／0 FAIL |
| `node scripts/sprint-043-patch-002-test.mjs` | 21 PASS／0 FAIL、external write 0、network 0 |
| `node scripts/sprint-042-core-test.mjs` | 43 PASS／0 FAIL |
| `node scripts/sprint-042-projection-test.mjs` | 35 PASS／0 FAIL |
| `node scripts/sprint-042-hook-test.mjs` | 40 PASS／0 FAIL |
| `node scripts/sprint-042-link-test.mjs` | 34 PASS／0 FAIL＋supplemental 2 |
| `node scripts/sprint-042-drift-test.mjs` | 25 PASS／0 FAIL＋supplemental 2 |
| `node scripts/sprint-042-xmind-test.mjs` | 29 PASS／0 FAIL／実Xmind MCP 1 NOT-RUN |
| `node scripts/sprint-042-collaboration-test.mjs` | 20 PASS／0 FAIL、20 surface／57 case |
| `node scripts/sprint-043-patch-002-overlay-test.mjs` | `changed=1 secondChanged=0`、protected 17、accepted receipt不変 |
| `node scripts/sprint-043-e2e.mjs` | 4 PASS／0 FAIL、cross-root write／Hook loop／task auto-create／false confirmation 0 |
| `node scripts/sprint-038-patch-002-windows-test.mjs` | portable 12 PASS／0 FAIL、OS=darwin。Windows native PASSとしては数えていない |
| 対象8 .mjsの`node --check` | 全件exit 0 |
| final current bytesの`git diff --check` | exit 0 |

### source／clean／Git-free

```text
YASASHII_SPRINT043_PATCH003_SURFACES
source=PASS clean=PASS archive=PASS
digest=e24f4add240dcdf5ee97a7276af8c7c74cb629ef1704d56af2e52b316c2ba9f7
gates=10x3
target=12+4-NOT-RUN
patch001=4 patch002=21
sprint042=43 sprint043_e2e=4
inventory=20/57 overlay=secondChanged0
windows_092_portable=12
archive_git=0 git_required_archive=NOT-CLAIMED
windows_native=NOT-RUN network=0 external_write=0
```

実sourceをOS一時directoryへno-follow copyし、一方をsynthetic clean Git Repo、もう一方を`.git`なしarchiveとして検査した。clone／fetch／checkout／networkは0。

## historical／release固定gateの分離

- `node scripts/sprint-041-test.mjs`: 24 PASS／2 FAIL。両FAILは現Patchで意図して変わったClarity product bytesをSprint 041の旧fixed-baseと比較するprewrite fixture差で、Target／current coreの挙動FAILではない。PASSへ変換していない。
- `python3 scripts/check-release-integrity.py --root .`と`node scripts/sprint-039-release-integrity-test.mjs`: 既存の0.10.3／16 Skills期待に対し、現行accepted sourceが0.11.0／17 Skills＋ClarityであるためFAIL。Patch 003はversion、manifest、CHANGELOG、release inventoryを変更しておらず、非因果のhistorical verification-infraとして分離する。
- `node scripts/sprint-040-patch-001-test.mjs`: 4 PASS／0 FAIL。Yasashii Harness identity／anchorを維持。

## 起動／Evaluator handoff

常駐server、Web UI、test URLはない。fresh EvaluatorはGenerator自己評価をVerdictへ流用せず、current bytesから次を実行する。

```bash
sh scripts/sprint-043-patch-003-regression.sh
node scripts/sprint-043-patch-003-portability.mjs --three-surfaces
git diff --check
```

重点scenario:

1. 2 MiB超Harness、non-Harness、partial、invalid、巨大stateでreserved／generic laneとCurrent bundleを比較する。
2. progressのPASS風文言、feedback FAIL／absent／unreadableを使い、validationを誤昇格しないことを確認する。
3. alias／physical、synthetic apply、dirty／staged／untracked、nested Git root、failure injectionでGit／canary／network不変を確認する。
4. inventory CRLF positiveとcontent／mode／path／marker／missing／extra tamper negativeを再実行する。
5. Windows nativeでは012〜015を含む16件、symlink／junction別capability、0.9.2 command、Node 22、10分timeout、exact candidate因果を確認する。

## NOT-RUN／残余

- Windows native HS-012〜015とPR #12因果runはGeneratorではNOT-RUN。macOS文字列模擬やportable 0.9.2をWindows PASSへ昇格していない。Orchestratorの通常push後も`windowsVerified=false`のままならSprint PASS不可。
- 実Xmind MCP connected create／read／update、実local `.xmind`、実Claude／Codex host、connector／providerはNOT-RUN。
- release、version、CHANGELOG、push、PR、merge、tag、GitHub Release、Marketplace、install、cache、new session、loaded version、実workspace／顧客Repo applyはNOT-RUN。
- public／private source write、remote write、network write、external provider writeは0。
- final whitespace修正と本progressは未stage。linked-worktree Git metadata権限が復旧しない限りfinal candidate commit／treeは未固定である。
- 本ラウンドは製品common core、Yasashii adaptation、verificationを変更しており、verification-only roundではない。


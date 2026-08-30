# Sprint 043 Patch 002 Progress — Yasashii正本repo freshnessとClarity限定ancestor alias

## 判定範囲

- Status: `candidate-unverified`。本書はGeneratorの引き渡しであり、fresh EvaluatorのVerdictではない。
- Base HEAD: `ae99c7853bb1f1e2b475ebd39d71dcb75791682b`、tree `d7e347d13ead621a8c91a4c4f79253e69259be50`。
- Yasashii開始入力: `0763010ecc654091c3caa456eee7e18671311bda`、tree `4ae64d5194cec20bc8720c7910a143299736a41b`。
- Current-bytes candidate ID: `portable-4f4877cba776ef1472f9f9f2a61c94291ec224e2ed34228b38849817f2e75293`。
- Digest対象: contractのproduct 12 pathをpath byte順の `path NUL mode NUL bytes NUL` でSHA-256。
- commit: 未作成。linked worktreeのGit metadataがsandbox外にあり、最初の `git add` が次の正確なerrorで停止したため、指示どおり回避・再試行していない。

```text
fatal: Unable to create '/Users/taisei/workspace/yasashii-secretary/.git/worktrees/yasashii-secretary-clarity/index.lock': Operation not permitted
```

Planner所有spec／contract、Orchestrator所有state、Evaluator feedback、既存receipt／release metadataは編集していない。

## 実装

### development-pointer current observation

- Project status、daily morning／evening、weekly、Portfolioは、利用可能なlocal `canonicalRepo`を毎request再観測する。
- 最初に読むfile、Repo／Git／Clarity identity、`observedAt`、revision、freshness、inspected／excluded／uninspected、上限を分けて返す。
- workspace snapshotの時刻は`snapshotFreshness`へ分離し、current evidenceと同一視しない。
- remote-only、missing、unsafe、unreadable、staleは固有reasonを返す。clone／fetch／pull／checkout／network／Git writeは0。
- Secret候補、binary、64KiB超、symlinkの本文を読まず、正本本文をworkspace／Clarity／Evidenceへ複製しない。

### Clarity internal root policy

- 一般`workingRoot()`のoption省略／falseはancestor aliasを従来どおり拒否する。
- ClarityのCLI、core、link、projection、Drift、Secretary adapter、Hookだけが`clarity-internal-root-resolver`を内部opt-inする。
- alias／physical root、Repo／Git／Clarity identityを一致させ、root自身、内部、broken、file-target、Drift locator symlinkを固有codeで拒否する。
- 同一physical rootの複数aliasを別tokenとして保持し、同一観測はleaseへdedupeする。重要read／write直前に全live observationを再検査する。
- 正常return／throwの両方でrequest所有handleだけを逆順cleanupする。別alias guardを消さず、次requestへstale guardを残さない。

### Yasashii適応と分類

- public byte-sync 9 pathは固定public candidate `51329fc...`とbyte／mode一致。
- adapted 3 pathはgeneric `secretary/projects/open/<project>/clarity/`、Yasashii marker、copy／style／identity／editionを保持し、public／private adapterのblind copyをしていない。
- `collaboration-inventory.json`は19 surface／41 case（CLX20＋Yasashii Target21）を実path／marker／digestへ接続した。
- actual action reportはbyte-sync 9、adapted 3、supporting 11、protected 17、Harness docs 1を排他分類し、unknown／stale／unused／unclassified／overlapは各0。
- 隔離current-candidate overlay fixtureはtamper 1件を再適用して`changed=1`、二回目`secondChanged=0`。protected 17とaccepted receiptは不変。

## Target 21件

`yasashii-CF-001..007`と`yasashii-AR-001..014`を全件Critical、各1 featureへ単一割当した。

| group | PASS | FAIL | NOT-RUN |
|---|---:|---:|---:|
| yasashii-CF | 7 | 0 | 0 |
| yasashii-AR | 14 | 0 | 0 |
| 合計 | 21 | 0 | 0 |

AR-008はalias 1／2 token、同一alias lease、request中retarget、重要read／write双方の`clarity-root-changed`／`changed:false`、段階cleanup、旧／新Repo不変、次request reuseを実操作した。AR-014はCLI、core、link、projection、Drift、Secretary adapter、Hookの実入口結果から`rootPolicy.source=clarity-internal-root-resolver`を確認し、正常／例外cleanup後の再利用も実操作した。

## 実行結果

正式source wrapper:

```bash
bash scripts/sprint-043-patch-002-regression.sh
```

```text
YASASHII_SPRINT043_PATCH002_REGRESSION TARGET=21/21 CORE=43/43 PROJECTION=35/35 HOOK=40/40 LINK=34/34 DRIFT=25/25 XMIND=29+1-NOT-RUN COLLABORATION=20/20 PATCH001=4/4 OVERLAY=secondChanged0 PRODUCT_FAIL=0 EXTERNAL_LIVE=NOT-RUN RELEASE=NOT-RUN
```

| command | result |
|---|---|
| `node scripts/sprint-043-patch-002-test.mjs` | Target 21 PASS／0 FAIL。external write 0、network 0 |
| `node scripts/sprint-043-patch-002-classification.mjs` | byte-sync 9／adapted 3／supporting 11／protected 17、異常分類0、17 Skills／62 behavior |
| `node scripts/sprint-043-patch-002-overlay-test.mjs` | `changed=1 secondChanged=0`、accepted receipt不変 |
| `node scripts/sprint-042-core-test.mjs` | 43 PASS／0 FAIL |
| `node scripts/sprint-042-projection-test.mjs` | 35 PASS／0 FAIL |
| `node scripts/sprint-042-hook-test.mjs` | 40 PASS／0 FAIL |
| `node scripts/sprint-042-link-test.mjs` | 34 PASS／0 FAIL＋supplemental 2 |
| `node scripts/sprint-042-drift-test.mjs` | 25 PASS／0 FAIL＋supplemental 2 |
| `node scripts/sprint-042-xmind-test.mjs` | 29 PASS／0 FAIL／XM-007のみconditional NOT-RUN |
| `node scripts/sprint-042-collaboration-test.mjs` | 20 PASS／0 FAIL、inventory stale 0 |
| `node scripts/sprint-043-patch-001-test.mjs` | 4 PASS／0 FAIL。Claude hooksなし／Codex Hook参照あり |
| `node scripts/sprint-040-patch-001-test.mjs` | 4 PASS／0 FAIL。Yasashii Harness identity／anchor維持 |
| `git diff --check` | exit 0 |

既存Secretary historical wrapperは33 PASS／2 FAIL。失敗は従来どおり`RG-010`（旧Sprint 039 overlay snapshot）と`RG-011`（公開済み0.10.3 update fixtureを未公開0.11.0へ適用）の2件だけで、`scripts/sprint-043-patch-002-baseline.mjs`がID／件数／exitを固定してverification-infraとして分離した。PASSへ加算していない。

## 3 surface portability

```bash
node scripts/sprint-043-patch-002-portability.mjs --three-surfaces
```

```text
YASASHII_SPRINT043_PATCH002_SURFACES source=PASS clean=PASS archive=PASS candidate=portable-4f4877cba776ef1472f9f9f2a61c94291ec224e2ed34228b38849817f2e75293 base_head=ae99c7853bb1f1e2b475ebd39d71dcb75791682b base_tree=d7e347d13ead621a8c91a4c4f79253e69259be50 digest=4f4877cba776ef1472f9f9f2a61c94291ec224e2ed34228b38849817f2e75293 target=21x3 classification=PASSx3 archive_git=0 clone=0 fetch=0 checkout=0 network=0
```

source current bytesをOS tmpへ複製し、一方をsynthetic clean Git Repo、もう一方をGit-free archiveとして検査した。3面のproduct 12 path bytes／mode／digestは同一で、各面Target 21とclassificationがPASSした。実sourceのlinked-worktree Git metadataは変更していない。

## 起動／Evaluator handoff

常駐server／Web UI／test URLはない。

fresh EvaluatorはGenerator自己評価をVerdictへ流用せず、現在bytesから次を実行する。

```bash
bash scripts/sprint-043-patch-002-regression.sh
node scripts/sprint-043-patch-002-portability.mjs --three-surfaces
git diff --check
```

重点scenario:

1. local development-pointerをstatus→daily→weekly→Portfolioの順に呼び、毎requestのobservedAt／revision／freshness／inspected分類を比較する。
2. remote-only、Secret、binary、large、symlink、missing／unsafe／unreadable／staleで本文・network・Git・canonical write 0を確認する。
3. alias 1／2を同一physical Repoへ向け、alias 1だけをretargetしてread／write双方のfail-closed、alias 2継続、cleanup後reuseを確認する。
4. CLI／core／link／projection／Drift／Secretary／Hook各実入口のroot policy sourceと正常／例外cleanupを確認する。
5. manifest負例、generic storage、17 Skills／62 behavior、Projects／task／daily／weekly／collaboration、Xmind fixed visual、private exclusionを確認する。
6. actual reportの9／3／11／17／1分類、portable digest、overlay`secondChanged=0`、既存receipt不変を再計算する。

## Known issues／NOT-RUN

- commitはGit metadata権限で未作成。実装差分はworking treeに保持した。
- `XM-007`実Xmind MCP connected create／read／updateは外部live未承認のためNOT-RUN。PASSへ数えていない。
- 実Claude／Codex host install／Hook live、実workspace／顧客repo、実local `.xmind`、connector／providerはNOT-RUN。
- release、version、CHANGELOG、push、tag、PR、GitHub Release、Marketplace、cache、install、new session、loaded versionはNOT-RUN。
- public／private source、remote、external serviceへのwriteは0。
- 本ラウンドは製品コード12 pathと検証コードの両方を変更しており、verification-only roundではない。

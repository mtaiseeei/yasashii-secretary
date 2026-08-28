# Sprint 041 Progress — Project Clarity Yasashii prewrite gate

## 結果

固定public handoff、private final PASS receipt、Yasashii固定baseを、Clarity製品適用より前に照合する
fail-closed gateを実装した。正例ではYasashii prewrite receiptを1件だけ生成し、Clarity製品path、public、private、
upstream、remote、externalへのwriteは0件である。

これはGeneratorのoffline自己評価であり、Evaluator verdictではない。公開版は
`public-user-decision-risk-accepted`／`evaluatorPass=false`のまま、private版の`PASS`を公開版へ昇格していない。
Sprint 042の製品applyは、このSprintのfresh Evaluator PASSとOrchestratorのstate更新後に別作業単位で扱う。

## 固定入力

| 入力 | 観測値 | 結果 |
|---|---|---|
| Yasashii base | `c6cfb40a6026c5447a8ec4729f517adb4cc51031`、718 files、tree projection `01dfe9e600c59473cc323cff0a22d554b93e2035be51eb0b013e8b8889918a8f` | PASS |
| public product／tree／common | `5f08d454c05576fcff8ab32c10c00887b4c15a96`／`1fbffe636565355b875dcde35ff05d26cd7e15f00710c1c88a563866749037c5`／`4aa6e8d4b21aa9e0020cfaa6edefd5ff0e6640fd2e8f937db00478190142f849` | PASS |
| public handoff | `/private/tmp/project-clarity-handoff-20260829/ready-handoff.json`、file SHA `09c3fa1289fa0af4d31c084a74ab108ce5cf85bcf3b3e7c9320cab72758d83c0` | PASS |
| public判定 | `public-user-decision-risk-accepted`、`evaluatorPass=false`、downstream write false | PASS、Evaluator PASSへ非昇格 |
| private product／tree | `d5598226213004d55781ca033985589907ae7b5d`／`920aea5d09b1aa51fcb5ebe23ab242a538c50445` | PASS |
| private feedback | commit `556c80117c7a1db8f2dd4eabb997277d47e02a51`、SHA `aa502ca0b3b53ece16822edc39b60b9a587b93c15f701ce1ad6578c2b9f47774`、`PASS` | PASS、privateだけの判定 |
| private receipt | `/private/tmp/agentic-secretary-my-vault-clarity/scripts/fixtures/sprint-050/private-pass-receipt.json`、file SHA `bf6893f3891b10b9b86669308e123008f09eae05d6d8330a477eb1614a456745`、internal SHA `0aac84a3d1beadcc7820a495205f292c4491e1758c5c9349a8ee523e68e82122` | PASS |
| permission／順序 | private→Yasashii、`nextPermission=yasashii-prewrite-only`、`writesAuthorized=false` | PASS、権限拡張0 |

## path roleとplanned action

機械可読な全46 path表は
`scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json`の`pathRoles.rows`に記録した。
各rowはpath、source、role、理由、予定action、固定baseのbefore mode／SHA／sizeまたは`null`、適用後条件を持つ。

| Role | 件数 | planned action | 条件 |
|---|---:|---|---|
| `byte-sync` | 16 | read → copy → write | 固定public productとmode／bytes一致 |
| `adapted` | 30 | read → adapt → write | Yasashii宣言変換とidentity不変条件を満たす |
| 計 | 46 | Sprint 042でのみ予定。Sprint 041で実行0 | public common 44＋private必須manifest 2 |

Hookの次の3 pathは明示的に`byte-sync`へ固定した。

- `plugins/secretary/hooks/hooks.json`
- `plugins/secretary/scripts/clarity-hook.mjs`
- `plugins/secretary/scripts/lib/clarity-hook.mjs`

Yasashii adapter、integration Skill／inventory、2つのplugin manifestは`adapted`、既存のcopy／style、
`edition.json`、marketplace、README、LICENSE、AGENTS、repo docs、overlay、release履歴、
`harness@yasashii-harness`はprotected snapshotまたはidentity invariantへ分離した。

role intersection、unknown、unclassified、unused、stale、blind copy、downstream-ownedへの予定write、
Harness role-owned文書とのproduct intersectionは各0件。既存
`secretary-overlay/mapping.json`、`anchors.json`、`downstream-owned.json`、`downstream-files.json`と
`scripts/sync-secretary-overlay.mjs`を読取り、固定baseで宣言path／patternが実在することを確認した。

## protected beforeと文書差分

固定base全718 filesのdigestを先に照合し、その後に次の9 named groupを再計算した。各groupのfile数、digest、
patternはreceiptの`protectedBefore.groups`へ記録している。

1. Yasashii README
2. LICENSE
3. AGENTS／CLAUDE
4. repo-owned `docs/**`
5. `copy/yasashii.json`／`styles/yasashii.md`
6. `edition.json`とYasashii identity
7. `secretary-overlay/**`
8. Claude／Codex marketplace identity
9. CHANGELOG／release gate履歴

固定baseから現sourceまでのPlanner spec／Sprint契約、Orchestrator state、Generator progressは
`sourceInventory.roleOwned`へowner付きで分離した。Sprint 041 gate／test／fixtureは
`sourceInventory.gateOwned`へ分離し、46 product pathとのintersectionは0件である。未知のdirty、
product対象のstaged／unstaged／untracked相当、固定base tamperはreceipt生成より前に停止する。

## fail-closed負例

`node scripts/sprint-041-test.mjs`で24件を実行した。

- unknown public tuple key、必須path欠落、public product mismatch、common path重複
- public `evaluatorPass` truthy化、gate status falsy化、downstream順序逆転
- private candidate mismatch、private内public evaluatorPass truthy化、feedback PASS falsy化、permission key欠落
- `writesAuthorized` truthy化、private順序逆転、private receipt internal tamper
- Harness role owner mismatch、role重複、private feedback commit mismatch
- handoff／private receipt file tamper
- Git-free固定base／source正例、receipt emit／再検証、Yasashii receipt tamper
- untracked／unstaged／staged product conflict時のreceipt不変／製品write 0
- 固定base tamper

全負例は期待したcodeで非0相当となり、製品apply関数は存在せず、失敗前後のClarity product writeは0件だった。

## receiptとwrite accounting

- Receipt: `scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json`
- kind: `yasashii-project-clarity-prewrite-receipt`
- status: `prewrite-verified`
- deterministic internal SHA: `7334da0f2cb50984d06026db504a60ac45dd0d066acc166c0f58585b308f4f0f`
- role manifest SHA: `433d6e2597be4a504e9da6b1b78f6d701377006521b55379554fb37e9cfc32f5`
- `clarityProductWrites=0`、`publicWrites=0`、`privateWrites=0`、`upstreamWrites=0`、
  `remoteWrites=0`、`externalWrites=0`、許可された`receiptWrites=1`
- 次工程: Sprint 042 `yasashii-product-apply-only`。`authorizedNow=false`
- `evaluatorVerdict=null`、`orchestratorStateWritten=false`

receiptはcanonical key順JSONのSHA-256で自己束縛し、再検証時は固定入力、固定base、current source inventoryから
全本文を再構築して一致を要求する。field改変は内部digestまたはrebuild bindingで拒否する。

## 実行commandと結果

| Command | 結果 |
|---|---|
| `node scripts/sprint-041-test.mjs` | `SPRINT041_TEST_PASS=24 SPRINT041_TEST_FAIL=0` |
| `node scripts/sprint-041-prewrite.mjs --check` | 46 paths、16 byte-sync、30 adapted、protected 9、product writes 0 |
| `node scripts/sprint-041-prewrite.mjs --emit-receipt` | PASS、receipt 1件だけwrite |
| `node scripts/sprint-041-prewrite.mjs --verify-receipt` | PASS、binding／internal SHA一致 |
| `bash scripts/sprint-041-regression.sh` | PASS。Sprint 041 24/24、Sprint 040 Patch 001 4/4、receipt再検証PASS |
| `bash scripts/regression-check.sh` | baseline既存失敗を観測後に中断。下記「既存suite観測」を参照 |
| `git diff --check` | PASS |

### 既存suite観測

全体suiteはSprint 041以外も含むため参考実行したが、現固定baseの既存文言check、Planner正本を
current user surfaceとして読むSprint 016、Sprint 018 fixture、sandbox内localhost bind `EPERM`、
外部sibling source不足によるSprint 040 handoff test等の非Sprint 041失敗を観測した。
Sprint 041の製品pathは0変更であり、専用回帰と直接関連するSprint 040 Patch 001はgreenである。
失敗を隠すためのassert、受入条件、回帰期待値の緩和は行っていない。

## 起動・評価handoff

- UI／URL: N/A。画面変更なし。
- 評価対象はprewrite gate、負例、path全件表、protected before、receiptだけで、Clarity Skill／Hook本体は未適用。
- Evaluatorは固定入力を再読込して`--check`と`--verify-receipt`を実行し、fixtureを一時copyして負例を再現する。
- product write count 0、public/private判定分離、Hook 3 byte-sync、Yasashii identity／overlay／Harness ID保護、
  role intersection 0、Planner文書別inventoryを確認する。

## NOT-RUN／非対象

Clarity core／Skill／Hook本体のsource適用、public／private actual write、private再適用、upstream write、
remote、push、tag、Release、GitHub Release、Marketplace、installed cache、new session、loaded version、
実workspace、実HOME、実Xmind、実host live、external connectorはすべてNOT-RUN／write 0件。

`docs/spec*`、`docs/sprints/*`、`docs/feedback/*`はGeneratorとして変更していない。

# Sprint 041 fresh独立評価 — Project Clarity Yasashii prewrite gate

## Current final verdict — Retry 1

**PASS**

- Product findings: **0件**
- Blocking verification-infra findings: **0件**
- Closed product finding: **P-01**
- Nonblocking verification-infra findings: **V-01／V-02（初回記録を保持）**
- 評価対象Generator product candidate: `2b60f3898f0a81be7ae7e142efe0cbb36e1820b8`
- Candidate tree: `643ea2d06f912900f6636bdcdfe3d7dfa660781e`
- 評価開始時Orchestrator state HEAD: `f5850f0ef344fb76e82999599777862e4c2758b6`
- Retry 1開始state: `c2eaaae`
- 初回candidate／初回feedback commit: `b506a943ade648fbe89776b9a2c2d830e6d7bf71`／`ccdfe97bd393f3a3d282b7d3e84e3e3ed17b2400`
- 初回feedback file SHA-256: `a9997728a338c5a080ae9342f6e7cc248ac3d987c7a3f4436e31f2e028440aab`
- Branch: `codex/sprint-041-project-clarity`
- UI: なし。browser、DOM、screenshot、実host liveは契約対象外

Generatorの自己評価をVerdictへ流用せず、Retry 1のactual diff、固定入力、CLI、同一bytes別path負例、
receipt path改変＋self-digest再計算、正式回帰、source receipt、固定candidateのGit-free archive内fresh
emit→verifyを独立再実行した。P-01の2つの再現はどちらも内容SHA読込前に期待codeでexit 1となり、
receipt自身も契約固定path以外を検証済みとして保持できなくなった。AC1〜10と重点rubric 10軸はすべて
必須閾値5/5を満たすため、Sprint 041 Retry 1をPASSと判定する。

publicは引き続き`public-user-decision-risk-accepted`／`evaluatorPass=false`であり、private `PASS`を
public Evaluator PASSへ昇格していない。本PASSが許すのはOrchestratorによるstate更新後のSprint 042だけで、
製品apply、release、push、cache、liveを現在許可するものではない。

## Retry 1 candidateとactual diff

評価対象product candidateは厳密に`2b60f3898f0a81be7ae7e142efe0cbb36e1820b8`である。
state handoffの`f5850f0`はcandidate後に`docs/sprints/state.md`だけを変更しており、製品candidateへ混ぜていない。

`git diff --name-status c2eaaae..2b60f38`の実結果は次の5件だった。

```text
M docs/progress/sprint-041.md
M scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json
M scripts/lib/sprint-041-prewrite.mjs
M scripts/sprint-041-prewrite.mjs
M scripts/sprint-041-test.mjs
```

差分はP-01の固定absolute path binding、同じ固定pathをreceiptへ直接記録する変更、正式負例2件と
receipt self-digest再計算負例、receipt再生成、Generator progressだけである。Clarity製品path、既存product、
spec、Sprint contract、state、初回feedback、回帰期待値の緩和は0件。`git diff --check
c2eaaae..2b60f38`はexit 0だった。

## P-01再現とclose証拠

固定handoffとprivate receiptを、それぞれ同一bytesの別pathへcopyしてCLIへ渡した。
copyのSHA-256は契約固定値と一致しているため、内容tamperではなくpathだけの不一致である。

| Scenario | copy SHA-256 | exit | 観測code |
|---|---|---:|---|
| public handoff same-byte別path | `09c3fa1289fa0af4d31c084a74ab108ce5cf85bcf3b3e7c9320cab72758d83c0` | 1 | `handoff-path-mismatch` |
| private receipt same-byte別path | `bf6893f3891b10b9b86669308e123008f09eae05d6d8330a477eb1614a456745` | 1 | `private-receipt-path-mismatch` |
| Yasashii receiptのpublic handoff path改変＋self-digest再計算 | self-digest再計算済み | 1 | `yasashii-receipt-input-path` |

観測detailsには契約固定pathとcopy／改変pathが別々に出力された。`validateFixedInputFile()`は
呼出pathを契約固定absolute pathと照合してからfile SHAを読み、source receiptの
`fixedInputs.public.handoffPath`／`fixedInputs.private.receiptPath`は呼出値ではなく固定値を保持する。
`verifyReceiptDigest()`は自己digestが正しくても両pathが固定値と一致しなければ拒否する。

したがって初回P-01は**closed**。同じbytesを別pathへ移しても固定入力として受理せず、誤ったpathを
「検証済みbinding」とするreceiptも構築・検証できない。失敗前後のClarity製品writeは0件だった。

## 固定入力、authorization、path role、protected snapshot

`node scripts/sprint-041-prewrite.mjs --check`とsource receipt再検証はともにexit 0だった。

| 対象 | Retry 1独立観測 |
|---|---|
| 固定tuple | Yasashii base、public product／tree／common／handoff、private candidate／tree／feedback／receiptが全固定値と一致 |
| public判定 | `public-user-decision-risk-accepted`、`evaluatorPass=false`を保持 |
| private判定 | feedback `PASS`、private→Yasashii順序を保持 |
| authorization | `nextPermission=yasashii-prewrite-only`、`writesAuthorized=false`、`applyAuthorized=false`、`releaseAuthorized=false`、`authorizedNow=false` |
| product path | 46 unique = byte-sync 16＋adapted 30 |
| supporting／excluded／protected | supporting 2、excluded 9、protected 9 group |
| role異常 | overlap、unknown、unclassified、unused、stale、blind copy、downstream-owned／Harness role-owned intersectionは全0 |
| planned action | 全46 pathにread／copyまたはadapt／writeとpostcondition。Sprint 041でのobserved product writeは0 |
| source inventory | differences 19、roleOwned 15、gateOwned 4、product conflict 0、unknown 0 |
| Yasashii identity | `yasashii-secretary`、`rules/copy/yasashii.json`、`https://github.com/mtaiseeei/yasashii-harness`、`harness@yasashii-harness` |
| source receipt | internal SHA `fed303e8d56ed428d1fcf595ca4580d9903728aa7b89a9705a898fe812fde547`、verify exit 0 |

public Hook 3 pathはすべて`byte-sync`、予定actionは`read→copy→write`、postconditionは
`mode-and-bytes-equal-fixed-public-product`だった。

```text
plugins/secretary/hooks/hooks.json
plugins/secretary/scripts/clarity-hook.mjs
plugins/secretary/scripts/lib/clarity-hook.mjs
```

protected 9 groupは固定baseから同じfile数／digestで再構築された。README、LICENSE、AGENTS／CLAUDE、
repo-owned `docs/**`、Yasashii copy／style、`edition.json`、`secretary-overlay/**`、両marketplace identity、
release historyを製品同期actionから分離している。

## 正式回帰、check、emit／verify

| Command／surface | exit | 独立結果 |
|---|---:|---|
| `bash scripts/sprint-041-regression.sh` | 0 | Sprint 041 26/26、Sprint 040 Patch 001 4/4、source receipt verify、wrapper 1/0 |
| `node scripts/sprint-041-prewrite.mjs --check` | 0 | 46 path、16 byte-sync、30 adapted、protected 9、roleOwned 15、gateOwned 4、product writes 0 |
| `node scripts/sprint-041-prewrite.mjs --verify-receipt --receipt scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json` | 0 | verified、internal SHA `fed303e8...`、product writes 0 |
| 固定candidate `2b60f38` Git-free archive内`--check` | 0 | sourceと固定baseをGit-freeで分離し、同じ46／16／30／9／15／4、product writes 0 |
| 同Git-free surface内canonical fixture pathへのfresh `--emit-receipt` | 0 | receipt write 1件だけ。internal SHA `df956e199b78d7bd80a94f683243c26faaf63b7d3b7fcd16cf4aa3cfe458c1a2` |
| 同Git-free surface内fresh receipt `--verify-receipt` | 0 | verified、product writes 0 |
| `git diff --check c2eaaae..2b60f38` | 0 | outputなし |

Git-free評価の最初のEvaluator-only試行では、契約外の別output名を指定したため
`receipt-output-path`で正しくfail-closedした。canonical fixture pathへ戻したfresh emit→verifyは上表どおり成功した。
この試行は隔離temporary archiveだけを書き、source fixture／candidateを変更していない。

## Acceptance Criteria — Retry 1

| AC | 判定 | 独立根拠 |
|---:|---|---|
| 1 | PASS | 固定identity／digest／pathが一致。同一bytes別path 2件を期待code、exit 1で製品write前に拒否。 |
| 2 | PASS | public status、`evaluatorPass=false`、private `PASS`を分離し、public PASSへの昇格0。 |
| 3 | PASS | private→Yasashii、`yasashii-prewrite-only`、`writesAuthorized=false`を保持。apply／release／public Patch権限0。 |
| 4 | PASS | 正式26/26でunknown／missing／mismatch／falsy-truthy／dirty／content tamper／path mismatch／fixed-baseをfail-closed。 |
| 5 | PASS | 46 unique、byte-sync 16／adapted 30、role overlap／unknown／未分類／unused／stale 0。 |
| 6 | PASS | Hook 3 byte-sync。Yasashii adapter／overlay／copy／style／edition／manifest／Harness IDをadapted／protectedへ分離。 |
| 7 | PASS | 全46 pathに予定action、before、postcondition。blind copy／downstream-owned write予定0。 |
| 8 | PASS | protected 9 groupを固定baseから再計算。role-owned docsとgate-ownedを製品同期から分離し、product conflict 0。 |
| 9 | PASS | Clarity product／public／private／upstream／remote／external write各0。source receipt fixtureへのEvaluator write 0。 |
| 10 | PASS | receiptは固定path、protected before、role manifest、write 0、Sprint 042だけを束縛。path改変＋self-digest再計算を`yasashii-receipt-input-path`で拒否。 |

**AC 10 PASS / 0 FAIL。**

## Rubric scores — Retry 1

Sprint 041指定の10軸はすべて5/5必須である。

| Rubric | Score | 根拠 |
|---|---:|---|
| C2 構文・整合 | **5/5** | 固定入力pathとdigestを別々に検査し、receiptも固定pathへ束縛。diff check、JSON、参照整合がPASS。 |
| C5 安全・規律 | **5/5** | fail-closed境界を内容読込前に適用し、確認・権限を拡張せず、全禁止write 0。 |
| C6 無回帰 | **5/5** | 正式26/26、Patch回帰4/4、check、source／Git-free emit→verifyが全green。 |
| C13 edition分離・互換 | **5/5** | Yasashii identity／overlay／protected surface、`harness@yasashii-harness`を分離し、外部操作0。 |
| C15 4ホスト正式配布 | **5/5** | Retry diffで既存host配布面の変更0。UI／liveを追加条件にせず、未実施を昇格していない。 |
| C16 Windows native保存・0.9.2下流同期 | **5/5** | 対象製品path／既存回帰期待値の変更0。固定baseとYasashii固有surface、外部write 0を保持。 |
| C17 秘書identity・routing・安全な改名 | **5/5** | identity製品変更0。adapted／protected境界とYasashii identityを保持。 |
| C18 既存workspace identity migration | **5/5** | workspace／HOME／cache／migration write 0。関連製品面と履歴の変更0。 |
| C19 明示memory authorization・内容冪等性・Yasashii下流分離 | **5/5** | 固定公開入力、排他的role、protected surface、公開PASS非継承を保持。memory製品変更0。 |
| C25 Yasashii安全・統合・handoff | **5/5** | P-01をcloseし、fixed tuple／path／receipt、46 role、protected 9、Hook 3、source／Git-free、write 0が一致。 |

**重点rubric 10軸すべて5/5。**

## Findings — Retry 1

### P-01 `product` / closed — 固定handoff／private receipt path binding

初回の再現2件はRetry 1でどちらも期待code、exit 1へ変わった。receipt path改変＋自己digest再計算も
専用codeで拒否されたため、blocking product findingは0件である。

### V-01 `verification-infra` / nonblocking・carry forward — 旧全体回帰の既存失敗

初回記録を保持する。Retry diffはP-01 gate、正式test／fixture、progressだけで、旧製品path、旧test、
旧baseline、localhost server、外部sibling依存を変更していない。worktree cleanを確認後、正式Sprint 041回帰と
直前Patch回帰がgreenであるため、増分再評価規則に従い初回証拠をcarry forwardした。
`bash scripts/regression-check.sh --offline`はRetry 1で再実行しておらず、旧13 FAILをPASSへ数えていない。
Sprint 041由来のproduct regressionまたはblocking verification-infraへ再分類する根拠はない。

### V-02 `verification-infra` / nonblocking・再確認済み — receiptのsurface間portability

契約内の固定candidate Git-free surface内fresh emit→verifyを独立再実行し、exit 0を確認した。
sourceで生成済みのtracked receiptを別surfaceへ同一bytesのまま移すportable化は契約外であり、今回も要求・実装していない。
したがってV-02はnonblockingのまま。surface間portable化をPASS条件へ追加していない。

## write count、Non-scope、Evaluator self-review — Retry 1

- Clarity product、public、private、upstream、remote、external write: **各0件**。
- source receipt fixtureへのEvaluator write: **0件**。隔離temporary archive内fresh receiptだけ1件生成。
- Evaluatorのrepo内編集: **本feedbackだけ**。
- push、PR、merge、tag、GitHub Release、Marketplace、installed cache、new session、loaded version、real workspace、
  real HOME、real Xmind、real host、connector: **not-run / write 0**。
- Sprint 042／043の製品実装、17／62 behavior、primary 250／CLX20／XV4／E2E4: **not-run／評価対象外**。
- UI、browser、screenshot、実host live、release、cacheを合格条件へ追加していない。
- Generator自己評価をVerdictへ流用せず、P-01を独立再現し、public `evaluatorPass=false`を維持した。
- product finding 0、blocking verification-infra 0。`spec-issue`／`verification-scope-issue`への分類変更は不要。

---

## 初回評価履歴 — candidate `b506a943ade648fbe89776b9a2c2d830e6d7bf71`（保持）

### 初回Verdict

**FAIL — `implementation-issue`**

- Product findings: **1件（P-01、blocking）**
- Verification-infra findings: **2件（V-01／V-02、いずれもP-01とは独立）**
- 評価対象Generator product candidate: `b506a943ade648fbe89776b9a2c2d830e6d7bf71`
- Candidate tree: `4666d79f76633dd4c12c8c803bd1933b32d7ba21`
- 評価開始時Orchestrator state HEAD: `878c9d520be140998f7a2a7f3546c29c3e9f8db4`
- 実装差分: `592c84e..b506a943ade648fbe89776b9a2c2d830e6d7bf71`、6 files／2122 insertions
- Branch: `codex/sprint-041-project-clarity`
- UI: なし。browser、DOM、screenshot、実host liveは対象外

Generatorの自己評価をVerdictへ流用せず、固定入力、固定base archive、実source、Git-free tree、
CLI、receipt、負例をfreshに再実行した。提供回帰は24/24で成功したが、固定handoffとprivate receiptを
**同じbytesの別path**へ移した負例を非0で拒否できなかった。これはAC1とAC10、および重点rubricの
C2／C5／C6／C25の5/5条件を満たさないため、Sprint 041は不合格である。

## Candidateとactual diff

`git diff --name-status 592c84e..b506a94`を実確認した。Generator candidateの追加は次の6件だけで、
Clarity製品path、既存product、spec、contract、stateへの変更は0件だった。

```text
A docs/progress/sprint-041.md
A scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json
A scripts/lib/sprint-041-prewrite.mjs
A scripts/sprint-041-prewrite.mjs
A scripts/sprint-041-regression.sh
A scripts/sprint-041-test.mjs
```

`b506a94..878c9d5`はOrchestrator所有の`docs/sprints/state.md`だけだった。製品candidateと評価開始時の
state commitを分離した。`git diff --check`はexit 0だった。

## 固定入力と独立digest再計算

固定Yasashii baseを`git archive c6cfb40...`からGit-free directoryへ展開し、公開accepted tree、
common paths、全46 pathのbefore、protected 9 group、manifest、receiptを製品実装とは別の一時scriptで
再計算した。

| 対象 | 独立観測 | 固定値／結果 |
|---|---|---|
| Yasashii base | `c6cfb40a6026c5447a8ec4729f517adb4cc51031`、718 files、tree digest `01dfe9e600c59473cc323cff0a22d554b93e2035be51eb0b013e8b8889918a8f` | 一致 |
| public product | `5f08d454c05576fcff8ab32c10c00887b4c15a96` | 一致 |
| public accepted tree | 828 files、`1fbffe636565355b875dcde35ff05d26cd7e15f00710c1c88a563866749037c5` | 一致 |
| public common | 44 paths、`4aa6e8d4b21aa9e0020cfaa6edefd5ff0e6640fd2e8f937db00478190142f849` | 一致 |
| public handoff | `/private/tmp/project-clarity-handoff-20260829/ready-handoff.json`、`09c3fa1289fa0af4d31c084a74ab108ce5cf85bcf3b3e7c9320cab72758d83c0` | bytes一致 |
| public state | `public-user-decision-risk-accepted`、`evaluatorPass=false` | 分離を保持 |
| private candidate／tree | `d5598226213004d55781ca033985589907ae7b5d`／`920aea5d09b1aa51fcb5ebe23ab242a538c50445` | 一致 |
| private feedback | commit `556c80117c7a1db8f2dd4eabb997277d47e02a51`、SHA `aa502ca0b3b53ece16822edc39b60b9a587b93c15f701ce1ad6578c2b9f47774`、verdict `PASS` | 一致 |
| private receipt | 固定path、file SHA `bf6893f3891b10b9b86669308e123008f09eae05d6d8330a477eb1614a456745`、internal SHA `0aac84a3d1beadcc7820a495205f292c4491e1758c5c9349a8ee523e68e82122` | 一致 |
| authorization | private→Yasashii、`nextPermission=yasashii-prewrite-only`、`writesAuthorized=false` | 一致 |
| role manifest | 46 unique、`433d6e2597be4a504e9da6b1b78f6d701377006521b55379554fb37e9cfc32f5` | 一致 |
| Yasashii receipt | internal digest `7334da0f2cb50984d06026db504a60ac45dd0d066acc166c0f58585b308f4f0f` | 一致 |

receiptは`authorizedNow=false`、`evaluatorVerdict=null`、`orchestratorStateWritten=false`、
Clarity product／public／private／upstream／remote／external write 0を保持していた。publicをEvaluator PASSへ
昇格していない。

## 46 product paths、role、planned action

全46行のpath、mode、before SHA-256／sizeを固定base実bytesから再計算し、receiptとの不一致は0件だった。
role intersection、unknown、未分類、unused、staleは0件、manifestは46 unique、byte-sync 16、adapted 30である。

### byte-sync 16

```text
plugins/secretary/clarity/schemas/event.schema.json
plugins/secretary/clarity/schemas/evidence.schema.json
plugins/secretary/clarity/schemas/item.schema.json
plugins/secretary/clarity/schemas/project.schema.json
plugins/secretary/clarity/schemas/state.schema.json
plugins/secretary/hooks/hooks.json
plugins/secretary/rules/common-language.md
plugins/secretary/rules/conversation-contract.md
plugins/secretary/rules/safety.md
plugins/secretary/scripts/clarity-hook.mjs
plugins/secretary/scripts/clarity.mjs
plugins/secretary/scripts/lib/clarity-core.mjs
plugins/secretary/scripts/lib/clarity-drift.mjs
plugins/secretary/scripts/lib/clarity-hook.mjs
plugins/secretary/scripts/lib/clarity-link.mjs
plugins/secretary/scripts/lib/clarity-projection.mjs
```

public Hook 3 path（`hooks/hooks.json`、`scripts/clarity-hook.mjs`、
`scripts/lib/clarity-hook.mjs`）は全てbyte-syncだった。各行は`read→copy→write`、適用後条件は
`mode-and-bytes-equal-fixed-public-product`である。

### adapted 30

```text
plugins/secretary/.claude-plugin/plugin.json
plugins/secretary/.codex-plugin/plugin.json
plugins/secretary/clarity/secretary-adapter.json
plugins/secretary/collaboration-inventory.json
plugins/secretary/host-inventory.json
plugins/secretary/release-inventory.json
plugins/secretary/rules/plain-language.md
plugins/secretary/rules/rule-manifest.json
plugins/secretary/scripts/clarity-secretary.mjs
plugins/secretary/scripts/collaboration-router.mjs
plugins/secretary/scripts/lib/clarity-secretary.mjs
plugins/secretary/scripts/lib/collaboration-router.mjs
plugins/secretary/scripts/project-tools.mjs
plugins/secretary/skills/build/SKILL.md
plugins/secretary/skills/chatwork/SKILL.md
plugins/secretary/skills/clarity/SKILL.md
plugins/secretary/skills/connections/SKILL.md
plugins/secretary/skills/daily/SKILL.md
plugins/secretary/skills/google-chat/SKILL.md
plugins/secretary/skills/memory-care/SKILL.md
plugins/secretary/skills/onboarding/SKILL.md
plugins/secretary/skills/projects/SKILL.md
plugins/secretary/skills/secretary/SKILL.md
plugins/secretary/skills/setup-google/SKILL.md
plugins/secretary/skills/setup-microsoft/SKILL.md
plugins/secretary/skills/setup-notion/SKILL.md
plugins/secretary/skills/update/SKILL.md
plugins/secretary/skills/weekly/SKILL.md
plugins/secretary/templates/AGENTS.md
plugins/secretary/templates/CLAUDE.md
```

各行は`read→adapt→write`、適用後条件は
`declared-yasashii-transformation-and-identity-invariants-pass`だった。blind copy 0、downstream-owned product
write予定0。Yasashii identityはedition `yasashii-secretary`、copy
`rules/copy/yasashii.json`、Harness repo `https://github.com/mtaiseeei/yasashii-harness`、install ID
`harness@yasashii-harness`で一致した。

## protected snapshotとsource inventory

固定baseから全9 groupを独立再計算した。

| group | files | SHA-256 |
|---|---:|---|
| `yasashii-readme` | 1 | `51b6e5f207aaf9ece4e4683c9d19860940113a412b352cd8ed78e9c3b2232497` |
| `license` | 1 | `e0e1f1e4499eb41b66a5be20d24b8d4dec722c755746193634873a51675c7bba` |
| `repo-agents` | 2 | `945f0e573288b1f5f0028a8e01ba032031e0179f8b81036304fe7d7fc4d51e3b` |
| `repo-owned-docs` | 398 | `b10c050fc2da673c53c079d57790df20aa48c587baba7ea74f119a3b2d830b8c` |
| `yasashii-copy-style` | 2 | `a7a140ec724d414321c4b39ec3503b2b770a28d1aa61a4b1cb041138c2ac4c73` |
| `yasashii-edition-identity` | 1 | `3366d69bfd0d72c117a004a151a7fcf2786d89dab7b3cc4642fb0b1256c7fbcd` |
| `overlay-definitions` | 8 | `1e615bae3548a02f5463339e66c2b84daa1d6096e2ec195d87cc8ead1c16b4a7` |
| `marketplace-identity` | 2 | `91e734ade4ab7bafeeb4a5394bcfc7d601dcc8222334bdc5303f73f319eed890` |
| `release-history` | 5 | `58d7d96c24b0a2c7411520a15b0d501ee7c0e7f3fa0e43f010c2e3e5260030a8` |

現行sourceとの差分inventoryは18件で、role-owned 14（Planner 12、Orchestrator 1、Generator progress 1）、
gate-owned 4、product conflict 0、unknown 0だった。Planner／Orchestrator／Generator docsと製品同期actionは
分離され、既存Clarity product／public／private／external writeは0件だった。

## CLI、receipt、回帰

| command | exit | 独立結果 |
|---|---:|---|
| `bash scripts/sprint-041-regression.sh` | 0 | 専用24/24、prewrite 46／16／30／protected 9、Patch回帰4/4、receipt verify、wrapper 1/0 |
| `node scripts/sprint-041-prewrite.mjs --check` | 0 | productPaths 46、byteSync 16、adapted 30、roleOwned 14、gateOwned 4、product writes 0 |
| `node scripts/sprint-041-prewrite.mjs --verify-receipt --receipt scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json` | 0 | verified=true、receipt SHA `7334da0f...`、product writes 0 |
| 独立digest再計算script | 0 | public 828、common 44、base 718、before 46、protected 9、manifest／receipt全一致 |
| 独立負例script | 0 | 18代表負例を期待codeで拒否、script自身は18/0 |
| `git diff --check` | 0 | output empty |
| `bash scripts/regression-check.sh --offline` | 1 | `PASS=328 FAIL=13`。旧baseline／localhost `EPERM`／外部sibling不足。V-01参照 |

## 独立負例

提供testの存在確認ではなく、固定入力を一時copyして個別改変し、CLI／libraryを再実行した。

| 負例 | 観測code／結果 |
|---|---|
| unknown public tuple key | `public-source-keys` |
| missing private permission | `private-permission-keys` |
| public product mismatch | `public-product` |
| required truthy→falsy | `public-gate-status` |
| required false→truthy | `public-evaluator-pass` |
| private PASS→falsy | `private-feedback-verdict` |
| `writesAuthorized`→truthy | `private-authority` |
| private→Yasashii順序逆転 | `private-order` |
| common path重複 | `common-paths` |
| owner mismatch | `private-role-owner` |
| handoff bytes tamper | `handoff-file-tamper` |
| private receipt bytes tamper | `private-receipt-file-tamper` |
| Yasashii receipt naive tamper | `yasashii-receipt-tamper` |
| Yasashii receipt tamper＋self-digest再計算 | `yasashii-receipt-binding` |
| untracked product conflict | `dirty-product-conflict` |
| unstaged product conflict | `dirty-product-conflict` |
| staged product conflict | `dirty-product-conflict` |
| fixed-base tamper | `fixed-base-tamper` |

上記18件は期待どおりfail-closedだった。しかし次の必須path負例2件は**exit 0**になった。

```text
cp <fixed-handoff> /private/tmp/sprint041-relocated-handoff.json
node scripts/sprint-041-prewrite.mjs --check \
  --handoff /private/tmp/sprint041-relocated-handoff.json
# exit 0 / SPRINT041_PREWRITE_PASS

cp <fixed-private-receipt> /private/tmp/sprint041-relocated-private-receipt.json
node scripts/sprint-041-prewrite.mjs --check \
  --private-receipt /private/tmp/sprint041-relocated-private-receipt.json
# exit 0 / SPRINT041_PREWRITE_PASS
```

copy後のSHA-256はそれぞれ固定値`09c3fa...`／`bf6893...`と一致しており、内容tamperではなく
**pathだけの不一致**である。

## Git-free safe harbor

candidate `b506a94`のGit-free archiveで`--check --base-root <fixed-base-archive>`はexit 0だった。
同じtreeで新規`--emit-receipt`し、そのreceiptを`--verify-receipt`するとexit 0で、Git-free由来を示す
`baseSource`を束縛したreceipt digest `45cd3dbc...`になった。

一方、実sourceで生成済みのtracked receiptをGit-free treeへそのまま持ち込むと、`baseSource`が
`git-fixed-base-archive:...`から`git-free-fixed-base-root:...`へ変わるため`yasashii-receipt-binding`で停止する。
これはsourceとGit-freeで別々にemit→verifyする既存safe harborなら成立するため、V-02として非blockingに分離した。

## Findings

### P-01 `product` / blocking — 固定handoff／private receiptのpath mismatchを受理する

AC1はidentity／digest／**path**の各不一致を製品write前に非0で拒否し、AC10はprewrite receiptが上記bindingを
固定することを要求する。しかし`inspectPrewrite()`は呼出側pathを`resolve()`し、その場所のfile SHAだけを
照合しており、契約の固定pathとの一致を検査しない。

- `scripts/lib/sprint-041-prewrite.mjs:425-429`はcaller pathを解決してSHAを照合するだけで、
  `/private/tmp/project-clarity-handoff-20260829/ready-handoff.json`および固定private receipt pathとの
  equality checkがない。
- `:398-399`は、その未検証のcaller pathをreceiptの`fixedInputs`へ記録する。
- そのため、固定bytesを別pathへ置いた2負例がともにexit 0となり、誤ったpathを「検証済みbinding」とする
  receiptを構築できる。

製品writeは0件のままだが、Sprint 041自身の目的であるprewrite fail-closed gateが必須入力の一部を検査して
いない。仕様は固定pathとpath mismatch拒否を明記しているため`spec-issue`ではなく`implementation-issue`である。

### V-01 `verification-infra` / nonblocking — 旧全体回帰の既存失敗

`bash scripts/regression-check.sh --offline`はexit 1、`PASS=328 FAIL=13`だった。観測した失敗は、旧baselineの
文面・固定件数assert、localhost serverを開く旧Sprintの`listen EPERM 127.0.0.1`、およびofflineで使えない
外部siblingに依存する検査へ分類できる。
Sprint 041 candidateは上記6追加fileだけで、旧製品path／旧testを変更していない。Sprint 041専用baselineと
直前Patch回帰は0 FAILであり、これら旧失敗はP-01の原因でもSprint 041由来のproduct regressionでもない。

### V-02 `verification-infra` / nonblocking — tracked receiptはGit-free surfaceへportableではない

実sourceで生成されたtracked receiptはprovenanceにGit archive由来の`baseSource`を含むため、同じcandidate bytesでも
Git-free `--verify-receipt`へそのまま移すとbinding mismatchになる。Git-free surface内でfresh emit→verifyすれば成功する。
現Sprint契約はsurface間で同じreceipt bytesをportableにすることまでは要求しないため、製品不合格の追加理由にはしない。

## Acceptance Criteria

| AC | 判定 | 独立根拠 |
|---:|---|---|
| 1 | **FAIL** | tuple／digestは一致するが、fixed handoff／private receiptのpath mismatchがexit 0。 |
| 2 | PASS | public status、`evaluatorPass=false`、private PASSを分離し、public PASSへ昇格0。 |
| 3 | PASS | permission、writesAuthorized、orderを保持し、改変負例は非0。 |
| 4 | PASS | unknown／missing／value mismatch／falsy-truthy／dirty／content tamper代表18件は期待codeで拒否。path mismatchはAC1へ計上。 |
| 5 | PASS | 46 unique、byte-sync 16／adapted 30、overlap／unknown／未分類／unused／stale 0。 |
| 6 | PASS | Hook 3 byte-sync、Yasashii adapter／overlay／copy／style／edition／manifest／Harness IDをadapted／protectedへ分離。 |
| 7 | PASS | 全46 pathにaction、before、postcondition。blind copy／downstream-owned write予定0。 |
| 8 | PASS | protected 9 groupを固定baseから再計算。role docs 14／gate 4／product conflict 0／unknown 0。 |
| 9 | PASS | Clarity product／public／private／remote／external write 0。receipt write以外0。 |
| 10 | **FAIL** | receiptの内容digest tamperは拒否するが、固定入力path bindingが未検証で、別pathをreceiptへ記録可能。 |

**AC 8 PASS / 2 FAIL。** 必須ACが1件でも未達なら不合格のため、総合FAILである。

## Rubric scores

Sprint指定の10軸は全て5/5必須である。

| Rubric | Score | 根拠 |
|---|---:|---|
| C2 構文・整合 | **4/5** | 固定入力の参照pathに実害ある不整合を受理する。 |
| C5 安全・規律 | **4/5** | 製品writeは0だが、prewrite fail-closed境界が固定pathを検査しない。 |
| C6 無回帰 | **4/5** | 提供24/24は成功したが、必須path mismatch負例が偽PASS。 |
| C13 edition分離・互換 | **5/5** | overlay／Yasashii identity／protected surfaceを分離し、外部write 0。 |
| C15 4ホスト正式配布 | **5/5** | 本Sprintによる既存4 host配布面の変更0。UI／liveを追加条件にしていない。 |
| C16 Windows native保存・0.9.2下流同期 | **5/5** | 対象製品pathの変更0、fixed base／overlay／Yasashii固有surfaceと外部write 0を保持。 |
| C17 秘書identity・routing・安全な改名 | **5/5** | common／adapted／protected境界とYasashii identityを保持、identity製品変更0。 |
| C18 既存workspace identity migration | **5/5** | 既存workspace／HOME／cache write 0、移行面の変更0。 |
| C19 明示memory authorization・内容冪等性・Yasashii下流分離 | **5/5** | 固定公開入力、role、Yasashii下流固有surface、公開PASS非継承を保持。memory製品変更0。 |
| C25 Yasashii安全・統合・handoff | **4/5** | fixed receipt／handoffのpath bindingに必須欠陥。 |

重点rubric **6軸5/5、4軸4/5**。C2／C5／C6／C25が閾値未達のためFAILである。

## 外部操作、Non-scope、write count

- Clarity product、public、private、upstream、remote、external write: **各0件**。
- receipt fixture: Generator candidateに1件。Evaluatorは再生成・編集していない。
- push、PR、merge、tag、GitHub Release、Marketplace、installed cache、new session、real workspace、
  real HOME、real Xmind、real host、connector: **not-run / write 0**。
- Sprint 042／043の製品実装、17／62 behavior、primary 250／CLX20／XV4／E2E4は評価対象外であり、未実装を失敗にしていない。
- safe harbor外の統一attestation、collector、browser、live証拠を合格条件に追加していない。

## Evaluator self-review

- Generatorの自己評価をVerdictへ流用せず、固定bytesと負例を独立再実行した。
- public `evaluatorPass=false`を維持し、private PASSをpublic／Yasashii Evaluator PASSへ昇格していない。
- product P-01とverification-infra V-01／V-02を分離し、旧全体回帰の環境失敗をSprint 041 product failureへ数えていない。
- Evaluatorが編集する正本は本feedbackだけ。product、scripts、tests、fixtures、spec、contract、state、progressは編集していない。

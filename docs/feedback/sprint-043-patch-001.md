# Sprint 043 Patch 001 独立評価 — Claude標準Hookの二重宣言解消

## 判定

- Verdict: **PASS**
- Failure Kind: `none`
- Candidate: `2cda8708e245588d2db64e1c2402ab4d2a10c05e`
- Candidate parent / baseline: `3fd79ac03f2240952b65cc5e13ca3c35762de011`
- 評価開始時のorchestration HEAD: `a3e4056950b82bc7c6b6ff680b0b298544939719`
- Type: `micro`
- Product findings: **0**
- Blocking verification-infra findings: **0**
- Nonblocking verification-infra findings: **4**
- Escalation Recommendation: `none`

同一candidateをclean detached clone `/private/tmp/yas-s043p-eval.RGxFa6/candidate` で操作した。
Claude manifestは有効なJSONのまま`hooks`キーを持たず、Codex manifestは
`hooks: "./hooks/hooks.json"`を維持する。Hook／router 3 pathのbytesとmode、Yasashii固有surface、
Project Clarityの挙動にproduct回帰はなかった。

旧`RG-010`／`RG-011`、固定Sprint 040 overlay、固定Sprint 042／043のdigest差は、
baselineとcandidateの両面または固定履歴artifactとの因果を再現した。下記のとおり製品欠陥ではなく
`verification-infra`として分離し、PASS件数へ加算していない。

## 採点

| 基準 | Score | Threshold | 判定根拠 |
|---|---:|---:|---|
| 機能完全性 | **5/5** | 5/5 | Claude／Codex両manifestを独立parseし、identity、version `0.11.0`、`skills: "./skills/"`、17 Skillを確認。Claudeは`hooks`なし、Codexは共通Hook参照あり。誤manifest 3種も拒否した。 |
| 動作安定性 | **5/5** | 5/5 | Hook／router 3 pathのSHA-256・size・mode不変。Hook 40/40、Clarity core 43/43、projection 35/35、Xmind 29 PASS＋条件付き1 NOT-RUN、link 34/34＋supplemental 2、drift 25/25＋supplemental 2、collaboration 20/20、E2E 4/4。 |
| 回帰なし | **5/5** | 5/5 | Patch専用4/4、parity／anchor 4/4、Claude validator、`git diff --check`が成功。copy／style／identity／edition／overlay／protected surfaceに許可外差分0。既知FAILはbaseline／固定履歴差として因果分離した。 |

3軸すべてが5/5 thresholdを満たす。

## Candidateと変更範囲

`git diff --name-status 3fd79ac... 2cda870...` は次の5 pathだけだった。

| Path | 役割 |
|---|---|
| `plugins/secretary/.claude-plugin/plugin.json` | product。重複したClaude側`hooks`宣言だけを削除 |
| `plugins/secretary/collaboration-inventory.json` | product派生inventory。manifest変更に対応する2つの`contentDigest`だけを更新 |
| `scripts/sprint-043-test.mjs` | verification。`PK-001`をClaude host契約へ更新し、`PK-002`のCodex契約は維持 |
| `scripts/sprint-043-patch-001-test.mjs` | verification。Patch専用micro回帰を追加 |
| `docs/progress/sprint-043-patch-001.md` | Generator handoff |

Hook本体、router、copy、style、identity、edition、rule manifest、overlay定義、marketplace、README、
LICENSE、AGENTS／CLAUDE、Sprint 043 feedback／receiptには差分がない。

## Manifestの独立確認

### 正常系

`node`で両manifestを直接JSON parseした結果:

- Claude: `name=yasashii-secretary`、`version=0.11.0`、`skills=./skills/`、`hasHooks=false`
- Codex: `name=yasashii-secretary`、`version=0.11.0`、`skills=./skills/`、
  `hooks=./hooks/hooks.json`
- 実在するSkill: **17**
- Claude manifest SHA-256: `f583304d7f51c5a0999ae8387090e8b380402c0f69ec8730ceab5e50fb6d4bf0`
- Codex manifest SHA-256: `f7ba3ebfb742da5537569d9de9e020996a8f23154cbcf60f2915712baac2b836`
- `claude plugin validate plugins/secretary`: exit 0、`Validation passed`

### 誤manifest負例

candidateから作った隔離fixtureだけを変更し、製品candidateは変更していない。

| Negative | Command / result |
|---|---|
| Claudeへ`hooks`を再追加 | Patch専用suiteがexit 1、Claude checkだけFAIL（3 PASS / 1 FAIL） |
| Codexから`hooks`を削除 | Patch専用suiteがexit 1、Codex checkだけFAIL（3 PASS / 1 FAIL） |
| Claude manifestを不正JSON化 | `claude plugin validate`がexit 1、`Invalid JSON syntax` |

Claude側の重複再流入とCodex側の参照欠落をどちらもPASSにしない。

## Hook／Clarityの実動作

### bytes／mode

| Path | SHA-256 | Size | Mode |
|---|---|---:|---|
| `plugins/secretary/hooks/hooks.json` | `7ac60c7f280c965321ced1658dd7fcdad1b481f09bd6eee5cf8153278b5bc40b` | 1768 | `100644` |
| `plugins/secretary/scripts/clarity-hook.mjs` | `8cf657ae6a9f1c0fdbd2ce96aa73c1917c3105e3d5488cebc92e80db385ceea3` | 1087 | `100644` |
| `plugins/secretary/scripts/lib/clarity-hook.mjs` | `c85137b5b5b0abce9fc1da454218c205e090aa086daaa26cdcb17b924165aa48` | 22573 | `100644` |

3 pathはbaselineから`git diff --exit-code`で差分0だった。

### 実行結果

| Command | Exit | 集計 |
|---|---:|---|
| `node scripts/sprint-043-patch-001-test.mjs` | 0 | 4 PASS / 0 FAIL |
| `node scripts/sprint-042-core-test.mjs` | 0 | 43 PASS / 0 FAIL |
| `node scripts/sprint-042-projection-test.mjs` | 0 | 35 PASS / 0 FAIL |
| `node scripts/sprint-042-xmind-test.mjs` | 0 | 29 PASS / 0 FAIL / 1 NOT-RUN (`XM-007`) |
| `node scripts/sprint-042-hook-test.mjs` | 0 | 40 PASS / 0 FAIL |
| `node scripts/sprint-042-link-test.mjs` | 0 | registered 34 PASS / 0 FAIL、supplemental 2 |
| `node scripts/sprint-042-drift-test.mjs` | 0 | registered 25 PASS / 0 FAIL、supplemental 2、critical 16/16 |
| `node scripts/sprint-042-collaboration-test.mjs` | 0 | 20 PASS / 0 FAIL、inventory stale 0、side-effect violation 0 |
| `node scripts/sprint-043-e2e.mjs` | 0 | E2E 4 PASS / 0 FAIL、cross-root write 0、Hook loop 0、task auto-create 0、false confirmation 0 |
| `node scripts/sprint-040-patch-001-test.mjs` | 0 | 4 PASS / 0 FAIL |
| `claude plugin validate plugins/secretary` | 0 | Validation passed |
| `git diff --check` | 0 | output 0 |

Hook suiteでSessionStart、PostToolUse、PreCompact、compact後再開、Stop、SessionEnd、未初期化、
disabled、trust未承認、同時発火、manual fallback、host結果非昇格を実行した。Xmind `XM-007`は
実Xmind MCP外部live未承認による契約どおりの条件付きNOT-RUNで、PASSへ数えていない。

## Yasashii境界と履歴artifact

- `plugins/secretary/rules/copy/yasashii.json`
- `plugins/secretary/rules/styles/yasashii.md`
- `plugins/secretary/templates/identity.json`
- `plugins/secretary/edition.json`
- `plugins/secretary/rules/rule-manifest.json`
- `README.md`、`LICENSE`、`AGENTS.md`、`CLAUDE.md`
- `.agents/plugins/marketplace.json`、`.claude-plugin/marketplace.json`
- `secretary-overlay/**`

上記はbaseline→candidateで差分0。Patch専用suiteの固定digest、parity／anchor 4/4、
collaboration `CLX-020`も成功した。`collaboration-inventory.json`の変更はmanifest bytesを参照する
派生digest 2件だけで、実path／marker／testの双方向照合はstale 0だった。

Sprint 043履歴artifactは変更されていない。

| Artifact | SHA-256 |
|---|---|
| `docs/feedback/sprint-043.md` | `a372f2b09c4e166674ec36a44207747d87315c4bf35f8bd17aac93e953117c20` |
| `scripts/fixtures/sprint-043/source-pass-receipt.json` | `7165ca062b4be963039e70f7847b2bcc93848150b3afecaba22ed561ff5e24f0` |
| `scripts/fixtures/sprint-043/candidate.json` | `eff9d47e817e768356c44f92a04e4f4ba1def8ed715456f7da1c99a39126d4c2` |
| `scripts/fixtures/sprint-043/source-receipt-template.json` | `7f95894ec8f501d986fdd4c09e6ea37e063291a5b4ad388beee07c020c7ee3e8` |

## baseline／candidate因果分類

### V-01 `verification-infra` / nonblocking — 旧RG-010／RG-011

`node scripts/sprint-042-secretary-test.mjs`をbaselineとcandidateで別々に実行した。
両方とも **33 PASS / 2 FAIL**で、失敗IDと原因は一致した。

- `RG-010`: Sprint 039が期待するAgentic handoff `3ef792...`に対し、現行固定値がSprint 040の
  `9acea...`である旧overlay snapshot差。
- `RG-011`: 公開済み`0.10.3` update fixtureを未公開candidate `0.11.0`へ適用した旧version fixture差。
  current behaviorはdowngrade-blocked、全side effect 0。

Patch前から同一で、Hook manifest変更によるproduct回帰ではない。2件をPASSへ加算していない。

### V-02 `verification-infra` / nonblocking — 固定Sprint 040 overlay check／reapply

固定Sprint 040 Agentic treeを入力に`--check`／`--reapply`をbaselineとcandidateで実行した。
両方ともClarity導入後surfaceがSprint 040 snapshotに未分類のため、write前にexit 1で停止した。

- baseline unclassified: 60
- candidate unclassified: 61
- candidateだけの追加: `scripts/sprint-043-patch-001-test.mjs`（verification file）
- product Hook／Clarity pathを含む既存60件の差はbaselineから存在
- check／reapply後の両clone: clean、write 0

固定Sprint 040 overlay toolはClarity適用後candidateを表現できない。candidate固有のproduct差による
overlay破損ではなく、過去snapshotを現行treeへ再利用した検証面の差である。現行のpath／protected境界は
Patch専用suite、parity／anchor、Clarity各suite、collaboration inventoryでgreenを確認した。

### V-03 `verification-infra` / nonblocking — 固定Sprint 043 receipt／product digest

baselineの`node scripts/sprint-043-test.mjs`はexit 0で、registry 273 PASS＋`XM-007`条件付きNOT-RUN、
17/17、62/62、path 46、protected 9を確認した。candidateでは、固定Sprint 043 product digest
`2bbb126e...`に対して現Patch後のdigest `ab484e3f...`となるため、digest assertでexit 1になった。

これはClaude manifestと派生inventoryが意図して変わったためで、旧Sprint 043 receiptは旧candidate
`f5a44f...`へ正しく固定されたままである。feedback、receipt、candidate fixture、templateのbytesは不変で、
履歴receiptをPatch candidateへ偽装更新していない。

### V-04 `verification-infra` / nonblocking — 固定Sprint 042 path digest wrapper

baselineの`node scripts/sprint-043-current-gates.mjs --full`はexit 0。candidateはexit 1だった。
直接原因は旧Sprint 042 `path-actual.json`がClaude manifest SHA-256 `e79d868...`を固定しており、
現Patchの正しいSHA-256 `f583304...`をstaleと扱って、wrapperが想定する後段のhistorical docs failureまで
到達しないことだった。

実manifestは直接parse、Patch専用正負回帰、Claude validatorでgreenである。旧accepted evidenceのdigestを
現Patchへ書き換えることはせず、current product failureには分類しない。

## Findings集計

| 区分 | Blocking | Nonblocking | 内容 |
|---|---:|---:|---|
| `product` | 0 | 0 | なし |
| `verification-infra` | 0 | 4 | V-01〜V-04。旧snapshot／version／receipt／digestを現Patchへ再利用した差 |

引き渡されたPatch専用suiteと現行Hook／Clarityの個別suiteは実行可能で全てgreenである。
検証基盤の欠陥だけで回帰なしを偽PASSにしたのではなく、対象挙動とchanged surfaceを直接実行した。

## Not-run／外部操作

- private版Claude Code 2.1.232実導入は共通契約のtriggerとしてのみ扱い、Yasashii live PASSへ流用していない。
- 実Yasashii Claude／Codex host install、new session、loaded version、実Hook triggerはNOT-RUN。
- release、version bump、Marketplace publish／refresh、cache、install／update、push、PR、merge、tag、
  GitHub Release、利用者workspace migration、Mac mini反映、connector、実Xmind MCPはNOT-RUN。
- external write、remote write、product candidate writeは0。評価用の変更は隔離negative fixtureと
  このfeedbackだけである。

## Evaluator自己レビュー

- Generatorの自己申告をVerdict根拠にせず、exact candidateとparent baselineを独立cloneして実行した。
- micro-patchの3軸だけを採点し、UI／design／originalityは再採点していない。
- 契約のsafe harborを超えるcollector、統一attestation、release／cache／実host証拠を要求していない。
- 既知FAILは無条件に除外せず、baseline／candidate、固定artifact、write 0を実測して分類した。
- private実機結果、公開版／private版PASS、1 host結果をYasashii live証拠へ昇格していない。
- product、tests、spec、contract、progress、state、receipt、install／cacheは編集していない。

## 残余

実Yasashii host liveは本PatchのNon-scopeであり、source PASSはlive導入成功を意味しない。
また、旧Sprint 040／042／043の固定検証wrapperは将来のoptional internal QAとしてcurrent candidate-awareに
整理する余地があるが、本Patchの製品合否を変更するblocking findingではない。

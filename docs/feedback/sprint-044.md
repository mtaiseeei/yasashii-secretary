# Sprint 044 fresh独立評価 — Yasashii 0.12.0 downstream Phase A

**判定:** 不合格（Phase A技術gate。Phase Bは未評価）

**分類:** `verification-scope-issue`

**評価対象:** Sprint 044 — Yasashii 0.12.0 downstream整合

**Escalation Recommendation:** `none`

## 結論

exact candidate `a38d7dc6bef58e2bcfd9433c8b29e9d557447b24`／tree
`79420843e3c869fbe4fc9987e53d9ebbd4dcc5e7`について、製品の `product` finding は0件だった。
F82 Git取り込み、F83 Voiceの意味、F84 LLM-led read／organize、Clarity、Yasashii固有surface、版境界、
Claude Codeのsource読込は、今回確認できた実行面で成立した。

ただし、同一candidateに因果する必須Windows workflow run `34070811154`／job `101587680262` は
`failure`で終了した。Voice stepが2 PASS／1 FAILとなり、後続update stepはskippedである。
引き渡された必須回帰がgreenでなく後続updateも未実行のため、C6、C10、C25、C26を5/5にできず、Phase Aは不合格である。

失敗は製品のVoice挙動ではなく、`scripts/sprint-052-secretary-voice-test.mjs`がinventory対象を
Windows checkout上のraw bytesでSHA-256化することに起因する。Git blobのLF hashは
`eb302a7d...`だが、WindowsでLFをCRLFへ変換した同じ意味のbytesのhashは、CIの観測値
`8927e90a...`と完全一致した。意味marker検査とYasashii style検査は同じWindows stepでPASSしている。
さらに `conversation-core-inventory.json` は製品runtimeから参照されず、Sprint 052検査とworkflowが
整合確認に使うverification surfaceである。したがってblocking findingは`verification-infra`、
全体分類は`verification-scope-issue`とする。既存回帰のFAILを改善提案へ落としてPASSにはしない。

## Candidateと固定入力

- Yasashii開始HEAD: `21d28913a8c7e8fcaa4299d5f235e44555407cc9`。
- 評価candidate: `a38d7dc6bef58e2bcfd9433c8b29e9d557447b24`、tree
  `79420843e3c869fbe4fc9987e53d9ebbd4dcc5e7`、branch `codex/release-0.12.0`。
- fixed public source: `767a7f3ecb15c0ffe6d2d8f71529c74bf671c154`、tree
  `30b7619e7e779242dd263032c82bccd6ae91eaf1`、Phase A PASS receipt
  `a2933904602fc839c72a5e6b9294a4362eb21ad0`。
- fixed private Phase A PASS: product `cbcf2c32efa5d6c343958603c9d740f5f26738de`、receipt
  `9b269563dd89f6552b0e382cfad724d378d51579`。private source／本文は評価で読んでいない。
- 評価用source `/private/tmp/secretary-yasashii-044-check.SsbIHd/source` は開始・終了時ともHEAD／tree一致、clean。
- public／private PASSは固定入力の妥当性にだけ使い、Yasashii verdictへ流用していない。

## スコア

| 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 3/5 | 4 | **FAIL** | 必須Windows workflowがVoice stepで停止し、Phase A完了条件が未達。 |
| C2 構文・整合 | 4/5 | 5 | **FAIL** | manifest／JSON／参照はgreenだが、Windows checkoutでVoice inventory hashが実fileと不一致。 |
| C3 機能の実証 | 4/5 | 4 | PASS | Git 45/45、Voice意味2/2、Clarity HS 16/16、migration 9/9をWindowsで実行。Macの変更面回帰もgreen。 |
| C5 安全・規律 | 5/5 | 5 | PASS | Git root／remote／stage、Clarity、symlink／junction、外部write／network境界にFAILなし。 |
| C6 無回帰 | 4/5 | 5 | **FAIL** | 必須Windows suiteに1 FAIL。後続update stepも未実行。 |
| C7 やさしさ | 4/5 | 4 | PASS | 既定一人称「私」、名前表示4場面、Yasashii copy／styleを維持。UI変更なし。 |
| C10 更新の安全性 | 4/5 | 5 | **FAIL** | Mac updateは16/16だが、契約がWindows workflowへ結線した同stepは先行FAILによりskipped。未実行を5/5へ昇格しない。 |
| C12 release履歴・candidate整合 | 5/5 | 5 | PASS | 0.12.0 manifest／CHANGELOG／inventory整合、旧release履歴とfixture不変。 |
| C13 edition分離・互換 | 5/5 | 5 | PASS | overlay check 309 managed、public helper／Hook bytes一致、Yasashii owned surface保護。 |
| C14 Markdown可読性 | 5/5 | 5 | PASS | LLM-led整理の段落・範囲不足表示とYasashii styleを保持。 |
| C15 正式host配布面 | 5/5 | 5 | PASS | 両manifest／Hook構造が整合。Claude exact source load成功。Codexは同一Hook bytesの既存parser受理に限定してcarryし、実Hook実行へ昇格していない。 |
| C16 Windows native保存 | 5/5 | 5 | PASS | exact runで既存0.9.2 native 12/12、access violation 0。 |
| C17 identity／routing | 5/5 | 5 | PASS | Voice契約、4場面、Yasashii一人称、名前Skill境界を確認。 |
| C18 identity migration | 5/5 | 5 | PASS | Windows conversation migration 9/9。 |
| C19 memory／下流分離 | 5/5 | 5 | PASS | fixed handoff、run-once境界、overlay、17 Skillsを保持。公開PASS非継承。 |
| C20 Clarity正本・状態モデル | 5/5 | 5 | PASS | core 43/43、HS 16/16、17機能／62 behavior不変。 |
| C21 Attention・Yasashii UX | 4/5 | 4 | PASS | bounded Attention、取得不足の明示、平易さと安全境界を保持。 |
| C22 Hook・host truth | 5/5 | 5 | PASS | Hook 40/40、public Hook bytes一致、Claude SessionStart／Stop成功、host結果非昇格を維持。 |
| C23 link・sync・Drift | 5/5 | 5 | PASS | Patch 002対象21/21、cross-root／network／external write 0。 |
| C24 projection・Xmind | 4/5 | 4 | PASS | Xmind既定OFF、MCP-first、local承認境界を保持。real XmindはNOT-RUN。 |
| C25 Yasashii安全・統合・handoff | 4/5 | 5 | **FAIL** | 製品境界は成立したが、同一candidateの必須既存回帰に1 FAIL。 |
| C26 Clarity包括scan・Windows native | 4/5 | 5 | **FAIL** | HS 16/16自体は成功したが、exact candidate因果workflow全体が0 FAILではない。 |

1軸でも閾値未達なら不合格というrubricに従う。

## Acceptance Criteria

| AC | 判定 | 独立根拠 |
|---:|---|---|
| 1 | PASS | fixed public commit／tree／receipt、Yasashii開始HEAD、actual diff、最終commit／treeを固定。 |
| 2 | PASS | F82 helperと6 callsite、F83 Voice、F84 5面、Clarity 17／62が同じcandidateに存在。 |
| 3 | PASS | README／LICENSE／029／041〜043 fixtureは開始HEADから不変。generic storage、Xmind OFF、17 Skills、private混入0を保持。 |
| 4 | PASS | Hook top-levelは`description`／`hooks`のみ。Claude source loadはwarning 0、Codexはbyte不変parser証拠に限定、host間昇格0。 |
| 5 | PASS | 0.12.0配布metadata一致。equal／downgrade、副作用0、旧release履歴を保持。 |
| 6 | **FAIL** | source／clean／Git-freeとHS自体はgreenだが、exact Windows workflowがVoice hash 1 FAILで終了。 |
| 7 | PASS | Git、Clarity、保存・削除、symlink／junction、Secret、確認、rollbackの実行済み境界にproduct FAILなし。 |
| 8 | PASS | 新runner／framework／collector／matrixなし。actor／round／timeout／assert削減なし。 |

## 実行証跡

### Evaluatorが実行した変更面・近傍回帰

長い処理前の`pgrep node | wc -l`はsandbox上でprocess list取得不能を明示し、値は0だった。
mainは同時にtestを実行しておらず、各batchは最大3系統で実行した。

| Command | Exit | 結果 |
|---|---:|---|
| `node scripts/sprint-052-secretary-voice-test.mjs` | 0 | Mac 3 PASS／0 FAIL |
| `node scripts/sprint-032-update-gate-test.mjs` | 0 | 16／0 |
| `node scripts/sprint-042-core-test.mjs` | 0 | 43／0 |
| `node scripts/sprint-042-hook-test.mjs` | 0 | 40／0、registry missing／duplicate／extra 0 |
| `node scripts/sprint-043-patch-001-test.mjs` | 0 | 4／0 |
| `node scripts/sprint-043-patch-002-test.mjs` | 0 | 21／0、external write 0、network 0 |
| `node scripts/sprint-043-patch-003-test.mjs` | 0 | Mac 12／0、Windows専用4件はNOT-RUN、非昇格 |
| `python3 scripts/check-release-integrity.py --root .` | 0 | manifest／17 Skills／CHANGELOG整合 |
| overlay `--check --candidate <fixed-public-source> --observed-commit 767a7f3...` | 0 | managed 309、handoff digest一致、upstream push disabled |
| `git diff --check` | 0 | outputなし |

Orchestratorが同じexact candidateのGit-free archiveで
`node scripts/archive-release-gate.mjs --root <archive>`を独立実行し、14 PASS／0 FAIL、`.git`なしを確認した。
これはsame-candidateのclean／green面としてcarryし、Windows失敗の代わりには使っていない。

### Windows exact-candidate run

- URL: <https://github.com/mtaiseeei/yasashii-secretary/actions/runs/34070811154>
- run `34070811154`、job `101587680262`、head SHA `a38d7dc6bef58e2bcfd9433c8b29e9d557447b24`。
- Microsoft Windows Server 2025、Node `22.23.2`、既存`windows-native` job、timeout 10分。
- 0.9.2 native: 12 PASS／0 FAIL。
- Clarity HS: 16 PASS／0 FAIL／0 SKIP／0 NOT-RUN、symlink／junctionともcapability PASS。
- F82 Git ingest: 45 PASS／0 FAIL。
- conversation migration: 9 PASS／0 FAIL。
- F83 Voice: 2 PASS／1 FAIL。
- update: preceding failureによりskipped。実行済みとは扱わない。

失敗行は次のとおり。

```text
FAIL inventoryは実ファイルのhashと共通entrypointを追跡:
stale hash: plugins/secretary/rules/conversation-contract.md
actual   8927e90a3d15f06c20ccd35c75c57e097f9c65dc44fc58d78c96c83f1469536e
expected eb302a7dc52e0e87e2eb7bfcd753e2e77e7c5ac987d466409b68e018a43bc72e
```

独立診断で、Git blobの全LFをCRLFへ変換してSHA-256を計算すると
`8927e90a3d15f06c20ccd35c75c57e097f9c65dc44fc58d78c96c83f1469536e`となり、CI actualと一致した。
testの`sha()`は`readFileSync()`のraw bytesをそのままhashし、CRLF正規化を行わない。

### Claude Code source load

Orchestratorが空の隔離cwdで、exact Yasashii sourceをClaude Code 2.1.232の`--plugin-dir`から1回だけ読込んだ。
session `ea7e79c9-84ec-4f4e-a7d1-af5bd6fd32f8`、inline plugin
`yasashii-secretary 0.12.0`、namespaced Skills 17件、tools 0、MCP 0。
SessionStart／Stopはexit 0、stderr空、result `OK`、parser warning 0だった。
これはinstall、実利用者workspace、Claude Desktop、Codex load、通常sessionのPASSへ昇格しない。

## Findings／バグ一覧

| # | 重要度 | 対象区分 | 内容 | 再現手順 |
|---|---|---|---|---|
| V-01 | Major / blocking | `verification-infra` | Sprint 052 Voice inventory testがWindowsのCRLF checkoutをraw hashし、LF固定hashと比較してFAILする。製品の意味marker検査はPASS。 | exact candidateをWindows checkoutし、`node scripts/sprint-052-secretary-voice-test.mjs` |

`product` findingは0件。blocking `verification-infra` findingは1件。

## 最小修正案

製品source、inventory件数、期待hash、marker、Voice契約を変更せず、
`scripts/sprint-052-secretary-voice-test.mjs`のtext surface hashだけを既存Patch 003と同じ
**CRLF→LF限定のportable normalization**へ揃える。単独CR、内容変更、path／surface欠落、marker欠落は
引き続きFAILにし、assert、case、actor、round、timeoutを減らさない。

この限定修正後は新しいclean candidateを固定し、Mac Voice 3/0、release integrity、diff checkと、
既存Windows workflowをexact SHAで1回だけ再実行する。WindowsでVoice 3/0、後続update 16/0を含むjob全体が
greenになれば、今回greenだった製品面はsame-candidate／実diff確認を条件に増分carryできる。
新runner、collector、統一attestation、全回帰wrapperは不要である。

## NOT-RUN／状態分離

- Codex exact Yasashii sourceでのHook実行、Codex／Claude正式install、new normal session: NOT-RUN。
- 実Xmind MCP／local `.xmind`、connector／provider、実利用者workspace／顧客repo apply: NOT-RUN。
- main merge、tag、GitHub Release、Marketplace反映、artifact公開、install／cache: Phase B、NOT-RUN。
- public／private PASS、Mac portable、Git-free archiveをWindows PASSへ昇格していない。
- Sprint 043 Patch 003はfeedbackなしでsupersededされた履歴を保持し、旧candidateをPASSへ書き換えていない。
- UI変更なし。デザイン採点とbrowser screenshotは契約どおり非該当。
- Evaluatorのrepo内編集は本feedbackだけ。product、test、fixture、spec、contract、progress、stateを変更していない。

## Evaluator自己レビュー

- 閾値と合否は一致しているか: yes。
- 各PASSにsame-candidate証拠または実diffで有効性を確認したcarry evidenceがあるか: yes。
- 未実行のWindows update、Codex Hook、Phase BをPASS扱いしていないか: yes。
- public／private PASSをYasashii PASSへ流用していないか: yes。
- FAIL理由は着手時点の契約／rubricにある必須Windows workflowと回帰なし基準か: yes。
- findingに`product`／`verification-infra`区分を付けたか: yes。
- 分類根拠: 製品実挙動のFAILはなく、必須回帰を止めた直接原因がWindows CRLFを扱わない検査hashであるため
  `verification-scope-issue`。ただし回帰suiteがredなのでPASSにはしない。
- safe harbor外の新証拠基盤を要求していないか: yes。
- 実装や他roleの正本へ越境していないか: yes。
- 強いGeneratorへのescalationが必要か: no。既存検査の改行正規化に限定できる。

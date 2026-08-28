# Sprint 042 Progress — Project Clarity Yasashii integration

## Candidate

- Status: `candidate-unverified`（Generator自己評価。Evaluator verdictではない）
- Start: `27d37b6`
- Fixed public product: `5f08d454c05576fcff8ab32c10c00887b4c15a96` / `evaluatorPass=false`
- Fixed private predecessor: `d5598226213004d55781ca033985589907ae7b5d`
- Prewrite receipt: `scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json`
- Release/push/tag/cache/install/new session/live Xmind/live host/connectors: 0

## Implementation

Yasashii F60〜F76を、固定public F64〜F80から17/17で適用した。62 behaviorは
`scripts/fixtures/sprint-042/behavior-matrix.json`で各IDを一度だけscenario、actual action、
expected result、side-effect assertion、実PASS caseへ対応づけた。missing 0、duplicate 0。

Clarityの正本は `secretary/projects/open/<project>/clarity/` に限定した。stable Project/Item ID、
append-only Event、最小Evidence、再構築可能State、Decision/Execution/Validation/Alignment、
4 mode、固定4象限、Attention、init/review/doctor/migration、partial/retryを共通coreで実装した。
PROJECT/TODO/memory/closed/external Repoへの自動writeは行わず、明示タスク化だけ既存Projects導線へ渡す。

Hookは固定publicの3 pathをmode/bytes一致で適用し、`type: command` のClarity router 1組だけを登録した。
SessionStart/PostToolUse/PreCompact/Stop/SessionEndをboundedに観測し、未初期化/unlinked/disabled/untrustedは
no-opまたはdegraded。Hook内network/LLM/Xmind/full scan/connector/updateと他Skill独立Hookは0。

Markdown/Mermaid/Xmind proposalは同じStateから決定的に生成する。TL緑 `#16A34A`、TR青
`#2563EB`、BL黄 `#D97706`、BR赤 `#DC2626`、上「決まっている」、下「まだ決まっていない」
を固定した。XmindはYasashii既定OFF。ON時もMCP-first、localはpreview後の明示承認必須で、
拒否/無回答/自動fallback/確認前writeは0。実Xmindは実行していない。

Linkはprepare/accept/finalize、syncはpull-onlyかつ自root writeのみ。Primary/Reference/Shared-derived
authorityを検査し、conflictをlast-write-winsで上書きしない。possible/confirmed DriftはDecision側と
Execution側のEvidenceを両方表示し、解消履歴を保持する。

## Collaboration

`plugins/secretary/collaboration-inventory.json` に17 surface / CLX 20 caseを固定した。
secretary/projects/daily/weekly/task seam/memory-care/build/update/onboarding/templates/rules/host/release/
edition handoffを実内容marker、routing fixture、digestで検査する。daily/weeklyはAttention/Portfolioを
最大3件中心で表示し、予定/TODO/journal/memoryの正本writeは0。YasashiiにNotion Task Skillを同梱せず、
明示Notion依頼はProjectsの既存local TODO選択境界へ安全に戻す。

## Path actual action / diff

- Product path: 46
- `byte-sync`: 16（read/copy/write/execute、固定publicとmode+bytes一致）
- `adapted`: 30（read/adapt/writeまたはprotect/execute、Yasashii identityを維持）
- unknown/overlap/unclassified/unused/stale/blind-copy: 0
- 全pathのbefore/after mode、SHA-256、size、actual action、diff:
  `scripts/fixtures/sprint-042/path-actual.json`
- protected 9 groupのbefore/after digest、diff、許可例外:
  `scripts/fixtures/sprint-042/protected-actual.json`
- protected許可外変化: 0
- `docs/progress/sprint-042.md`だけがGenerator所有のrepo-docs許可例外

## Verification

正式command:

```bash
bash scripts/sprint-042-regression.sh
```

結果:

- Sprint 042 integration: PASS
- features 17/17、behaviors 62/62、missing 0、duplicate 0
- core 43 PASS
- projection/Attention/migration/UX 35 PASS
- Xmind/visual 29 PASS、XM-007 live 1 NOT-RUN
- Hook 40 PASS
- Secretary primary/collaboration 33 PASS
- Link/sync 36 PASS
- Drift/Git safety 27 PASS
- collaboration inventory 20 PASS
- byte-sync 16、adapted 30、product path 46、protected change 0
- `git diff --check`: PASS

Current candidate gate:

- Claude/Codex manifest: `yasashii-secretary 0.11.0`
- report schema: 22 user-facing surfaces / PASS
- published marketplace: protected `0.10.3` unchanged
- update diagnosis: current `0.11.0` vs published `0.10.3` is `downgrade-blocked`、write 0
- release inventory: `candidate-unverified`、fixed public `evaluatorPass=false`

Historical regression classification:

- RG-010: Sprint 039が固定した旧overlay snapshot SHAを新candidateへ適用するhistorical fixture差。
  current identity/router/Clarity primary behaviorは別suiteでPASSし、旧期待SHAは書き換えていない。
- RG-011: Sprint 032の公開済み0.10.3 install/equal-update fixtureを未公開0.11 candidateへ適用した差。
  historical suiteは12 PASS/3 expected mismatchとして保持。current manifest/report-schema/update導線は
  上記current candidate gateでgreen。
- `scripts/sprint-039-release-integrity-test.mjs`: 公開済み0.10.3、16 Skill、marketplace/CHANGELOG一致を
  固定するrelease validatorのため、未公開0.11 candidateと新Clarity Skillに対して6 expected mismatch。
  validator本体、marketplace、CHANGELOGはprotectedとして変更せず、current candidate gateで両manifest、
  17 Skill/22 report surface、candidate-unverified、published 0.10.3不変を別検査した。
- Sprint 041 prewrite-only gateはapply前に26/26 PASS。apply後は「product pathが固定baseと同じ」を要求する
  ため再実行対象ではない。Sprint 043のfull verificationで250+CLX20+XV4+E2E4を閉じる。

## Manual scenarios / evaluation handoff

1. 未導入synthetic Repoで `init` previewを行いwrite 0、承認apply後にgeneric clarity rootだけが作られる。
2. AI proposal、ADR、人間確認、実装、test Evidenceを順に与え、4象限とAttentionが再計算される。
3. 通常Bash/他Skill/未初期化/disabled/untrusted Hook payloadでcanonical/external write 0を確認する。
4. daily morning/weeklyで最大3件の根拠つきAttentionを確認し、TODO/journal snapshotが不変である。
5. Xmind OFF、MCP unavailable、local承認前/拒否/承認後を比較し、確認前write 0と固定visualを確認する。
6. link prepare/accept/finalize、pull-only sync、authority conflict、tamper、stale、possible/confirmed Driftを確認する。
7. 模擬会話42〜45相当はSecretary/Clarity routing、daily/weekly、明示task delegation、link/Drift fixtureで実行する。

## AC self-evaluation

1. PASS — 17/62 machine matrix、missing/duplicate/unclassified 0。
2. PASS — stable ID、4 mode、Event/Evidence/State、4象限の正負fixture。
3. PASS — init/review/doctor/migration、rebuild、partial、idempotent retry。
4. PASS — generic open Project clarity rootだけへwrite、他正本自動write 0。
5. PASS — Projects lifecycle維持、自動task 0、明示委譲のみ。
6. PASS — Hook 3 path mode+bytes一致、専用router 1組。
7. PASS — bounded lifecycle、nonmaterial/no-op/degraded、Hook禁止操作0。
8. PASS — daily/weekly bounded根拠表示、既存正本write 0。
9. PASS — Markdown/Mermaid/Xmind固定visual。
10. PASS — Yasashii Xmind既定OFF、MCP-first、local明示承認、確認前write 0。
11. PASS — reciprocal link、pull-only sync、authority/conflict、possible/confirmed Drift。
12. PASS — path/symlink/dirty/stage/Secret/concurrency/partial/retry、重複0。
13. PASS — 46 path actual action/diff/before-after、unknown等0。
14. PASS — Yasashii protected 9 groupの許可外変化0。
15. PASS — private混入0、source/release/live/external write 0。

## Known issues / not run

- XM-007 実Xmind MCP connected create/read/update: 外部live未承認のためNOT-RUN。
- public Sprint 050 E2E、実host、実connector、実workspace、release/install/cache/new session: Sprint 042
  non-scope。先行の偽PASSにはしていない。
- Generator自己評価はEvaluator verdictではない。Sprint 043のfresh Evaluatorが最終判定する。

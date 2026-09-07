# Sprint 044 Progress — Yasashii 0.12.0 downstream整合

## Candidate

- 開始HEAD: `21d28913a8c7e8fcaa4299d5f235e44555407cc9`。
- fixed public source: commit `767a7f3ecb15c0ffe6d2d8f71529c74bf671c154`、tree `30b7619e7e779242dd263032c82bccd6ae91eaf1`、identity handoff digest `2f22889567587ab821603a2ab4eb0a2573e89b94e33c88c440c7350f04fcbeab`、Phase A receipt `a2933904602fc839c72a5e6b9294a4362eb21ad0`。sourceは終了時もclean／同一tree。
- 状態は`candidate-unverified`。commit、push、PR、tag、Release、Marketplace、install、cache、実workspace反映は行っていない。Generatorの自己検査であり、独立EvaluatorのVerdictではない。

## 実差分とrole

- common product: F82の`git-ingest.mjs`と6 callsite、F83の共通Voice契約・一人称preferences、F84の日次／週次／project／routerのLLM-led read/organize、既存Clarity common coreをfixed sourceから同期した。
- Yasashii adaptation: 通常の一人称を既定「私」とし、秘書名は初回設定完了・名前質問・rename直後・別repo初回routingの4場面だけ1回に固定した。Yasashii style、4列表記のsettings、marker、`harness@yasashii-harness`をanchorで保持した。F84の`timeline`／`weekly`／`promotion-status`は任意helperのまま、保存・削除・reindex・Git・昇格・Clarity確定は既存helper、確認、rollbackから外していない。
- release candidate: Claude／Codex manifestとmarketplaceを`0.12.0`へ揃え、Hook manifestはtop-level `description`／`hooks`だけを維持した。Yasashii CHANGELOG、release／host／collaboration／conversation inventory、current wizard snapshot、archive／release integrity gateを更新した。
- overlay: fixed commit/tree照合、classification、metadata、anchor、downstream-owned保護を更新した。public guideのone-paste prompt／infographicは同期していない。
- workflow: 既存Windows 2025／Node 22／10分／単一jobを保ち、Git 051、Voice 052、会話migration、updateの既存entrypointだけを追加した。新runner、collector、attestation、matrixは追加していない。
- verification adaptation: 旧035 Git検査は削除ではなく、6 callsiteと共通helperを検査する051へ委譲されたfixed public差分。052はYasashiiに同梱しないAgentic styleを要求しないedition適応をanchor化した。043 Patch 001は同じ4 assertionsのversion／current digestだけを0.12.0 bytesへ更新した。

## 保護した面

- `README.md`、`LICENSE`、Sprint 029のimmutable Yasashii copy baseline、Sprint 041〜043／Patch 002〜003 fixtureは開始HEADからbyte不変。Sprint 038の`current-wizard-assets.json`だけを現在bytesへ更新した。
- 17 Skills、62 behaviors、Clarity 20 surface／57 case、generic storage、Xmind既定OFF、Yasashii identity／copy／styleを維持した。
- 既存inventoryにあるedition分類名以外のprivate file／value／本文を追加していない。実userdata、private source、public sourceへのwriteは0。
- Planner所有`docs/spec.md`／`docs/sprints/sprint-044.md`、Orchestrator所有`docs/sprints/state.md`の開始時差分は触れていない。

## Macで実行した安全な検査

開始前`pgrep node | wc -l`は13。

| Command | Result |
|---|---|
| overlay `--record` → `--apply` → `--reapply` → `--check` | PASS。fixed tree 895 files、apply 57 changed、reapply secondChanged 0、final managed 309 |
| F82 helper byte比較、`node --check`（helper＋5 callsite files）、6 callsite静的集計 | PASS。helperはfixed sourceとbyte一致、6 callsite |
| `node scripts/sprint-052-secretary-voice-test.mjs` | 最終3 PASS／0 FAIL |
| `node scripts/sprint-038-patch-003-conversation-migration-test.mjs` | 9 PASS／0 FAIL、Windows nativeはNOT-RUN |
| `node scripts/sprint-042-core-test.mjs` | 43 PASS／0 FAIL |
| `node scripts/sprint-042-hook-test.mjs` | 40 PASS／0 FAIL |
| `node scripts/sprint-043-patch-001-test.mjs` | 最終4 PASS／0 FAIL |
| `node scripts/sprint-043-patch-002-test.mjs` | 21 PASS／0 FAIL、external write 0、network 0 |
| `node scripts/sprint-043-patch-003-test.mjs` | 12 PASS／0 FAIL／4 Windows-only NOT-RUN、external write 0、network 0 |
| `node scripts/sprint-032-update-gate-test.mjs` | 16 PASS／0 FAIL。0.12.0 equal／downgrade副作用0、旧0.7 blocker保持 |
| collaboration／conversation inventory | PASS。20 surface／57 case、Voice tracked surface 38、hash／marker一致 |
| F84 targeted semantic assertion | PASS。LLM-led 5面、任意helper 5面、直接Read迂回禁止と決定的シーム保持 |
| `python3 scripts/check-release-integrity.py --root .` | PASS。manifest、17 Skills、CHANGELOG整合 |
| Git-free copyで`node scripts/archive-release-gate.mjs --root <copy>` | 最終14 PASS／0 FAIL |
| current wizard snapshot 5 assets、Sprint 029 history、README／LICENSE／041〜043 fixture | PASS |
| JSON、workflow YAML、Hook top-level、manifest version、`git diff --check` | PASS |

初回実行では、052が未同梱Agentic styleを要求して1 FAIL、043 Patch 003のHS-016がYasashii markerのanchor漏れで1 FAIL、043 Patch 001が旧0.11.0／digestを要求して4 FAILだった。すべてedition／current-candidate検査へ狭く適応し、上表の最終再実行で0 FAILを確認した。F84の最初の手元静的assertも実在しない完全一致文言を要求してFAILしたが、製品文言を緩めず、契約上の3境界を直接検査するselectorへ直してPASSした。最初のarchive copyはlinked-worktreeの`.git` pointerを含めて1 FAILだったため、その一時copyだけからpointerを除き、再実行14／0後に一時copyを削除した。

## Windows-only／NOT-RUN

- `scripts/sprint-051-git-ingest-test.mjs`本体はfixture内で`HOME`／XDGを差し替えるため、このGeneratorの禁止条件に従ってMacではNOT-RUN。製品helperのbyte一致、6 callsite、構文だけをMacで確認した。nativeのdirty／remote／ref／stage契約は既存Windows workflowでfresh Evaluatorが確認する。
- Windows native HS-012〜015、051 `--require-windows`、会話migration `--require-windows`、既存0.9.2 nativeはNOT-RUN。portable結果をWindows PASSへ昇格していない。
- publicの既知high-actor 044／047／048／050、Yasashii 043の巨大regression／3-surface wrapper、private stress、Playwrightは実行していない。
- 実Claude／Codex host、実Xmind MCP／local `.xmind`、connector、provider、release／installはNOT-RUN。

## Evaluator handoff

常駐server／Web UI／test URLはない。fresh Evaluatorはcurrent bytesで、まず次を使う。

```bash
node scripts/sprint-052-secretary-voice-test.mjs
node scripts/sprint-032-update-gate-test.mjs
node scripts/sprint-042-core-test.mjs
node scripts/sprint-042-hook-test.mjs
node scripts/sprint-043-patch-001-test.mjs
node scripts/sprint-043-patch-002-test.mjs
node scripts/sprint-043-patch-003-test.mjs
python3 scripts/check-release-integrity.py --root .
node scripts/sync-secretary-overlay.mjs --check --candidate <fixed-public-source> --observed-commit 767a7f3ecb15c0ffe6d2d8f71529c74bf671c154
git diff --check
```

Windowsはmainの通常push後、既存`.github/workflows/windows-recording-regression.yml`をexact candidate branchで1回だけ実行する。MacでNOT-RUNのGit 051、会話migration、HS 16、update／Voiceの結果をrun／job／headと結び付け、SKIP／NOT-RUNをPASSへ数えない。

残余として、前Sprint progressに記録されたSprint 041／release-integrityの旧candidate向けhistorical findingは今回再実行しておらず、PASSへ読み替えていない。Sprint 029 fixtureはimmutableのまま、035 Patch 002の大きな差分はaccepted common helperへの検査委譲、Sprint 038 fixtureはcurrent snapshot更新として区別した。

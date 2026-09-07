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

## V-01限定対応（Windows text hash）

- 対応開始HEAD: `a93d2ab45aaa46e818020e0265d88958d8b6aaef`。Evaluatorの不合格、`verification-scope-issue`分類、Windows run `34070811154`のVoice 2 PASS／1 FAILと後続update未実行を履歴として維持する。
- 変更対象はverification surfaceだけである。`scripts/sprint-052-secretary-voice-test.mjs`のtext SHA-256入力をUTF-8として読み、CRLFだけをLFへ正規化した。期待hash、inventory、required marker、surface／Skill数、3 assertions、Voice契約、製品runtimeは変更していない。
- `secretary-overlay/anchors.json`へ同じ1行変換を既存052 anchorとして追加した。fixed public source `767a7f3ecb15c0ffe6d2d8f71529c74bf671c154`からoverlayを再計算しても限定修正を保持し、既存Yasashii style adaptationを維持する。
- 今回の実装差分は検証コードと、その再適用に因果するoverlay anchor、Generator所有progressだけで、製品コードは0行である。これはユーザー承認済みV-01限定修正であり、追加runner、schema、framework、fixture再生成、`.gitattributes`、Git設定変更は行っていない。

### 限定検証

最初のsandbox内`pgrep node | wc -l`はprocess list取得エラーと偽の0を返したため採用せず、権限を上げたread-only再計測で16を確認してから検査を開始した。

| Command | Result |
|---|---|
| `pgrep node \| wc -l`（escalated read-only） | 16。開始上限40未満 |
| `node scripts/sprint-052-secretary-voice-test.mjs` | 3 PASS／0 FAIL |
| `python3 scripts/check-release-integrity.py --root .` | PASS |
| `node scripts/sync-secretary-overlay.mjs --check --candidate /private/tmp/secretary-012-public-fixed.3gfsoW/source --observed-commit 767a7f3ecb15c0ffe6d2d8f71529c74bf671c154` | PASS。managed 309、existing reapply期待bytesにV-01修正を保持 |
| `node --input-type=module -e 'import assert from "node:assert/strict"; import { createHash } from "node:crypto"; const normalize = (text) => text.replaceAll("\r\n", "\n"); const sha = (text) => createHash("sha256").update(normalize(text)).digest("hex"); assert.equal(sha("a\r\nb"), sha("a\nb")); assert.notEqual(sha("a\rb"), sha("a\nb")); assert.notEqual(sha("a\r\nc"), sha("a\nb")); console.log("PASS CRLF-only normalization; lone CR and content edits remain distinct")'` | PASS。CRLFとLFは同一、単独CRと内容変更は不一致を維持 |
| `node --check scripts/sprint-052-secretary-voice-test.mjs` | PASS |
| `git diff --check` | PASS |

### Evaluatorへの追加引き渡し

- 状態は評価待ちであり、Generatorから独立PASSは主張しない。MacではCRLF限定の実装とoverlay期待bytesを確認したが、Windows nativeはこのGeneratorではNOT-RUNである。
- Orchestratorが新candidateをcommit／pushした後、既存`.github/workflows/windows-recording-regression.yml`をexact headで1回だけ実行し、Voice 3／0と、その後のupdate 16／0を含むjob全体を確認する。旧runのfailureや今回のMac結果をWindows PASSへ昇格しない。

## V-02限定対応（Windows checkoutのGit履歴）

- 対応開始HEAD: `9db9341342a649bf87221639eac309dcf2d602f3`。V-01はresolved、Windows run `34076583606`のVoice 3 PASS／0 FAIL、update 0 PASS／1 FAIL、job failure、V-02の`verification-scope-issue`分類を履歴として維持する。
- 既存Windows workflowの`actions/checkout@v4`へ`fetch-depth: 0`だけを設定し、`git rev-list HEAD`を使う既存update検査へ公開0.7.0 revisionを含むGit履歴を供給する。trigger、permissions、runner、Node 22、10分timeout、job／step、製品、fixture、期待値、case／assertは変更していない。
- 今回も変更対象はverification surfaceだけで、製品コードは0行である。V-01に続く2回連続の検証側だけの修正であり、ユーザーが承認したV-02限定範囲を越える新runner、framework、test、schema、`.gitattributes`、Git設定は追加していない。

### 限定検証

最初のsandbox内`pgrep node | wc -l`はprocess list取得エラーと偽の0を返したため採用せず、権限を上げたread-only再計測で18を確認してから検査を開始した。

| Command | Result |
|---|---|
| `pgrep node \| wc -l`（escalated read-only） | 18。開始上限40未満 |
| `ruby -e "require 'yaml'; ... YAML.load_file(...)"` | PASS。既存parserでYAMLを読め、`windows-native` jobを確認 |
| `git merge-base --is-ancestor 604ce1f... HEAD`とhistorical manifest読取 | PASS。revisionはHEAD履歴に存在し、legacy manifest versionは`0.7.0` |
| `git diff --check`／限定diff | PASS。空白error 0。workflow差分はcheckoutの`with.fetch-depth: 0`だけ |

### Evaluatorへの追加引き渡し

- 状態は評価待ちであり、Generatorから独立PASSは主張しない。Orchestratorがcommit／pushした新candidateで、既存Windows workflowをexact headに対して1回だけ実行し、native 12／0、HS 16／0・SKIP 0・NOT-RUN 0、Git 45／0、migration 9／0、Voice 3／0、update 16／0とjob全体greenを確認する。
- 既存update検査には、履歴から得る旧0.7.0テキストとcurrent checkoutテキストを比較する面がある。完全履歴のMacでは16／0だった一方、Windows checkoutのCRLFで次の差が現れる可能性は残る。これは承認されたcheckout履歴設定修正の範囲外なので、検査・製品・fixtureは変更せず、fresh Evaluatorが実CI結果から分類する。

## 032履歴比較のCRLF限定対応

- 対応開始HEAD: `c1265f4542c5b64466776e819de35070ed12b186`。V-01の旧Windows Voice 2／1、V-02の旧Windows update 0／1、両方の`verification-scope-issue`分類、V-01 resolved／V-02 checkout履歴供給済みという時系列を維持する。
- ユーザーが追加承認した2比較だけを変更した。公開0.7.0のCHANGELOG release sectionと`0.6.0-to-0.7.0.json` migration fixtureは、比較時にCRLF（`\r\n`）だけをLF（`\n`）へ変換する。単独CR、内容変更、section欠落、旧fixtureそのものは正規化・更新しない。`trim`、JSON parse、広いtext正規化も追加していない。
- fixed public sourceからのoverlay再適用で修正を保持するため、上記2行に一対一対応するliteral anchorを2件だけ追加した。製品runtime、旧version fixture、期待値、case／actor／round／assert／timeout、workflow、その他の検査は変更していない。
- 今回も実装差分はverification surface、因果するoverlay anchor、Generator所有progressだけで、製品コードは0行である。V-01、V-02から連続する検証側限定修正であり、ユーザー承認済みの上限内で実施した。新runner、framework、schema、fixture bulk更新、`.gitattributes`、Git設定は追加していない。

### 限定検証

最初のsandbox内`pgrep node | wc -l`はprocess list取得エラーと偽の0を返したため採用せず、権限を上げたread-only再計測で21を確認してから検査を開始した。

| Command | Result |
|---|---|
| `pgrep node \| wc -l`（escalated read-only） | 21。開始上限40未満 |
| `node scripts/sprint-032-update-gate-test.mjs` | 16 PASS／0 FAIL |
| `node --check scripts/sprint-032-update-gate-test.mjs` | PASS |
| in-memory LF／CRLF／単独CR／内容変更probe | PASS。LFとCRLFは同値、単独CRと内容変更は不一致 |
| `node -e 'JSON.parse(...)'`（`secretary-overlay/anchors.json`） | PASS |
| overlay `--check --candidate /private/tmp/secretary-012-public-fixed.3gfsoW/source --observed-commit 767a7f3...` | PASS。managed 309、handoff digest一致、upstream push disabled |
| `git diff --check`／限定diff | PASS。032の2行置換、因果するliteral anchor 2件、製品差分0 |

### Evaluatorへの追加引き渡し

- 状態は評価待ちであり、Generatorから独立PASSは主張しない。Macの限定検証はgreenだが、Windows nativeと既存workflow全体はこのGeneratorではNOT-RUNである。
- Orchestratorがcheckout履歴修正と今回の2比較を一つのclean candidateとしてcommit／pushした後、既存Windows workflowをexact headで1回だけ実行する。update 16／0を含むjob全体greenを確認し、旧run、Mac 16／0、portable結果をWindows PASSへ昇格しない。

## V-03限定対応（Clarity collaboration inventoryのcurrent digest）

- 対応開始HEAD: `a9b39532ec4a45397a64b9005e7a241ad6acbf30`。Windows run `34082572913`のnative 12／0、HS 15／1、後続Git／migration／Voice／updateのNOT-RUN、V-03の`verification-scope-issue`分類を履歴として維持する。
- `scripts/lib/sprint-049-inventory.mjs`の既存`digestSurface()`をcurrent checkoutで実行し、`clarity-harness-scanner`の5 pathから`0771a55beb6717c8f0e44cd7acfb1f4bc0db54772e3103d6ec74ade884432fd4`を独立再計算した。記録されていた旧値`4a81d0c132596f4baa46d0a72d585fe12dca7144d486caa4693cf354591d33de`を推測やblind pinで置換していない。
- 5 pathの`f64d775043a6fb02161c6d9038d7ee722b9429c1..HEAD`差分を確認し、変更は承認済みの`.github/workflows/windows-recording-regression.yml`の`fetch-depth: 0`だけだった。既存downstream-ownedの`plugins/secretary/collaboration-inventory.json`にある該当`contentDigest` 1値だけをcurrent bytesへ整合し、新anchorは追加していない。
- 今回の差分はverification inventory 1値とGenerator所有progressだけで、製品runtimeは0行である。連続するverification-only修正であることを維持し、新runner、test、fixture、expected semantics、case／assert／actor／round／timeout、workflow、schema、frameworkは変更していない。

### 限定検証

最初のsandbox内`pgrep node | wc -l`はprocess list取得エラーと偽の0を返したため採用せず、権限を上げたread-only再計測で21を確認してから検査を開始した。

| Command | Result |
|---|---|
| `pgrep node \| wc -l`（escalated read-only） | 21。開始上限40未満 |
| current 5-path `digestSurface()`再計算 | recorded旧`4a81d0...`、observed `0771a55...`を確認 |
| `validateCollaborationInventory(process.cwd())` | `surfaceCount: 20`、`caseCount: 57`、digest／markerとも有効 |
| `node scripts/sprint-043-patch-003-test.mjs` | 12 PASS／0 FAIL／0 SKIP／4 Windows-only NOT-RUN、external write 0、network 0 |
| `node scripts/sprint-032-update-gate-test.mjs` | 16 PASS／0 FAIL |
| `node scripts/sprint-052-secretary-voice-test.mjs` | 3 PASS／0 FAIL |
| `python3 scripts/check-release-integrity.py --root .` | PASS |
| overlay `--check --candidate /private/tmp/secretary-012-public-fixed.3gfsoW/source --observed-commit 767a7f3...` | PASS。managed 309、handoff digest一致、upstream push disabled |
| collaboration inventory JSON parse／`git diff --check` | PASS |

### Evaluatorへの追加引き渡し

- 状態は評価待ちであり、Generatorから独立PASSは主張しない。MacではV-03の直接因果する1値整合と限定回帰を確認したが、Windows nativeはこのGeneratorではNOT-RUNである。
- Orchestratorが新candidateをcommit／pushした後、既存`.github/workflows/windows-recording-regression.yml`をexact headで1回だけ実行する。native 12／0、HS 16／0・SKIP 0・NOT-RUN 0、Git 45／0、migration 9／0、Voice 3／0、update 16／0とjob全体greenを確認し、旧run、Mac結果、portable結果をWindows PASSへ昇格しない。その後はfresh独立Evaluatorが判定する。

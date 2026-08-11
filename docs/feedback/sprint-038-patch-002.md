# Sprint 038 Patch 002 独立評価

## 判定

- Sprint contract result: **NOT PASS / HOLD**
- Primary failure kind: **implementation-issue**
- Secondary blocker: **verification-scope-issue**
- Evaluated product/test candidate: `0677a0d67ce70b478dd0d19e676b23295b78a4a3`
- Current HEAD: `c364eb45cdbf79d0376ccef9f2965c939e31f848`（候補後のPlanner／state正本だけを持つdocs-only commit）
- Fixed upstream: `24520a1d06f8d3833568a1386bf814e1085f5da9`
- Evaluator environment: `Darwin arm64`、Node.js `v22.23.2`
- Yasashii Windows native: **not-run**
- Product findings: **1件**
- Blocking verification-infra findings: **1件**
- Escalation Recommendation: **none**

overlay同期、共通byte parity、Yasashii固有surface、macOS対象回帰、Git-free targeted archive、
`0.9.2` release整合には新しいproduct failureを確認しなかった。一方、広いarchive gateの既存12 FAILを
開始HEADと照合した結果、1件は単なるhistorical期待値ではなく、現行の
`plugins/secretary/rules/rule-manifest.json` の実不整合だった。開始HEADから存在する欠陥だが、
観測したproduct failureをbaselineへ隠さないため、P1として記録する。

また、Yasashii candidate自身のWindows native実行は未実施である。Agentic upstreamのWindows 12/12や、
YasashiiのmacOS 12/12をYasashii Windows PASSへ流用していない。したがってAC5〜8、AC13〜14とC16は未達で、
release holdを維持する。

## Candidate integrity

```text
git rev-parse HEAD
c364eb45cdbf79d0376ccef9f2965c939e31f848

git rev-parse 0677a0d
0677a0d67ce70b478dd0d19e676b23295b78a4a3

git diff --name-status 0677a0d c364eb4
M docs/spec.md
M docs/spec/constraints.md
M docs/spec/features.md
M docs/spec/rubric.md
A docs/sprints/sprint-038-patch-002.md
M docs/sprints/state.md

git diff --exit-code 0677a0d c364eb4 -- . ':(exclude)docs/**'
exit 0 / output empty

git status --porcelain=v1
output empty
```

`0677a0d...`以降の製品、test、overlay、manifest、CHANGELOG、workflow bytes変更は0件である。
Windowsでcurrent HEAD `c364eb4...`を使う場合も、Windows対象の製品／test bytesは
`0677a0d...`と同一である。ただしWindows証跡の固定対象は曖昧にせず、下記では製品candidate
`0677a0d...`を指定する。

## Upstream固定とoverlay

Agentic repoのGit objectから完全SHAをGitなしdirectoryへ展開し、Yasashiiのworking treeや
Agenticの現在HEADを同期元に使わなかった。

```text
git -C /Users/taisei/workspace/agentic-secretary cat-file -t 24520a1d...
commit

git -C /Users/taisei/workspace/agentic-secretary show -s --format='%H %T %P %s' 24520a1d...
24520a1d... d42521bf... 15b0f27d... [sprint-038-patch-002] Windowsの保存処理とCRLF設定を修正

git -C /Users/taisei/workspace/agentic-secretary merge-base --is-ancestor 3a5a6c30... 24520a1d...
exit 0
```

`secretary-overlay/upstream-tree.json` は完全SHA `24520a1d...`、697 filesを記録していた。

| classification | files |
|---|---:|
| common | 246 |
| metadata-overlay | 6 |
| anchor-overlay | 17 |
| upstream-only | 23 |
| repo-owned | 405 |
| 合計 | 697 |

未分類は0件。専用Patch test内で、固定treeの全pathとSHA-256、common全fileのbyte一致、
record → apply → check → reapply、二回目追加差分0、保護digest、次の負例の同期先副作用0を再実行した。

- 未分類追加
- upstream削除
- anchor 0件
- anchor複数
- metadata allowlist外変更
- Yasashii保護identity変更
- base／tree不一致

```text
node scripts/sprint-038-patch-002-test.mjs --candidate <git-free-24520a1-tree>
exit 0
SPRINT038_PATCH002_PASS=14 SPRINT038_PATCH002_FAIL=0 WINDOWS_NATIVE=not-run

node scripts/sync-secretary-overlay.mjs --check --candidate <git-free-24520a1-tree> --observed-commit 24520a1d...
exit 0
OVERLAY_CHECK_PASS base=24520a1d... managed=269
repoOwnedDigest=fb5362e70c669ac7192a2ac78f5ee632fa5859f942c4f8d6c8688a0c85128180
overlayDigest=05ba070414b6d3ba766f00b38f6fd373a19c149974183fa5b1541c7d48ee6bbe
REMOTE_GATE ... upstreamPush=disabled
```

current HEADのrepo-owned digestはPlanner／state docsの追加後の値である。製品candidate `0677a0d...`の
Git-free treeでもcheckはPASSし、overlay definition digestは同じ
`05ba0704...ee6bbe`だった。apply／check／reapply中にREADME、LICENSE、Yasashii copy／style、
repo-owned docs／evidence sentinel、overlay定義が変わらないことを専用testで確認した。

## Yasashii identity・copy・release面

- Claude／Codex marketplace、両manifest、editionは `yasashii-secretary`、version `0.9.2`。
- repository、marketplace、install ID、Harness導線はYasashii版を維持。
- Harnessは `mtaiseeei/yasashii-harness`、`0.5.1`、両host install ID
  `harness@yasashii-harness` を維持。
- READMEの `agentic-secretary` 言及は上下流関係を説明する節だけで、配布identity混入ではない。
- `対応済み.*my-vault`、`my-vault.*対応済み`、private版対応済み表示はactive release面で0件。
- 正本と旧raw CHANGELOGはbyte一致。
- `0.9.1`以前のCHANGELOG sectionは開始HEADとbyte一致。
- LICENSE、Yasashii copy／style、wizard assetsの開始HEAD差分は0件。

```text
python3 scripts/check-release-integrity.py --root .
PASS release integrity: manifests and CHANGELOG are consistent

cmp <start-HEAD-0.9.1-and-older> <current-0.9.1-and-older>
exit 0

cmp plugins/secretary/CHANGELOG.md plugins/yasashii-secretary/CHANGELOG.md
exit 0
```

## 回帰コマンドと結果

| command | result |
|---|---|
| `node scripts/sprint-038-patch-002-test.mjs --candidate <fixed-tree>` | 14 PASS / 0 FAIL、Windows native not-run |
| `node scripts/sprint-038-patch-002-windows-test.mjs` | macOS 12 PASS / 0 FAIL |
| 同 `--require-windows` | 期待どおりexit 1、11 PASS / 1 FAIL、`darwin !== win32` |
| `node scripts/sprint-034-test.mjs <fixed-tree>` | 11 PASS / 0 FAIL |
| `node scripts/sprint-037-test.mjs` | 14 PASS / 0 FAIL、unexpected 0 |
| `node scripts/sprint-038-test.mjs` | 64 PASS / 0 FAIL |
| `bash scripts/sprint-022-regression.sh` | core 69 / 0、wrapper 8 / 0 |
| `bash scripts/sprint-038-patch-001-regression.sh` | Patch 6 / 0、Sprint 035 15 / 0、release PASS |
| Git-free `archive-release-gate.mjs` | 14 PASS / 0 FAIL |
| Git-free新Patch | 14 PASS / 0 FAIL |
| Git-free Sprint 038 | 64 PASS / 0 FAIL |
| JSON parse | `JSON_OK=13` |
| `node --check` | 変更core／overlay／test 10 files、全exit 0 |
| `git diff --check a733679..c364eb4` | exit 0 |

macOS同一labelsは、日本語・空白path、project／journal／memory／TODO／settings／文書、recursive copy、
CRLF、rollback、path guard、Bash非依存を実動作させている。ただしOS固有のdrive letter、junction、
native crash、Windows process終了を確認する証拠ではない。

## 広いGit-free archive gate

広いgateはgreenと主張しない。candidateと開始HEADを同じコマンドでGit-free treeにして比較した。

```text
node scripts/master-release-gate.mjs --mode archive --root <candidate-0677a0d-archive>
exit 1
RELEASE_GATE mode=archive status=fail suites=23 required=15 passed=7
verification-infra=0 failed=8 skipped=0 assertions=298 pass=286 fail=12 infra-fail=0

node scripts/master-release-gate.mjs --mode archive --root <start-a733679-archive>
exit 1
status=fail suites=22 required=14 passed=6 failed=8 assertions=286 pass=274 fail=12
```

失敗suiteとassert countは開始HEAD／candidateで同一だった。

| suite | start | candidate |
|---|---:|---:|
| sprint-010-timeline | 55/56 | 55/56 |
| sprint-011-settings | 66/68 | 66/68 |
| sprint-027-focus-copy | 4/5 | 4/5 |
| sprint-029-rule-boundary | 1/3 | 1/3 |
| sprint-030-edition-guard | 1/3 | 1/3 |
| sprint-031-plugin-path | 6/8 | 6/8 |
| sprint-032-patch-001-readability | 1/2 | 1/2 |
| sprint-032-patch-002-conversation-safety | 1/2 | 1/2 |

candidateで増えた12 assertionsは新しいWindows保存suiteの12 PASSだけで、新しいFAILは0件だった。
ただしbaseline同一を理由に12 FAILを自動的に非product化していない。実内容を確認した結果、古い
Agentic style path、旧raw URL、READMEのexact wording、重複した旧wrapper期待はcurrent targeted検証と
一致しないhistorical test driftだった。一方、次のP1は現行正本の実不整合でありproduct findingとした。

## Finding分類

### P1 — rule manifestのpriorityと依存が現行Yasashii rule graphと不一致

- Classification: **product**
- Severity: **Medium**
- Introduced by this Patch: **No**（開始HEAD `a733679...` から存在）
- Blocking axes: C2、C6、C13、AC3、AC9、AC13

`plugins/secretary/rules/rule-manifest.json` は `rule-manifest.json` 自身を正本と宣言するactive surfaceだが、
次の不整合がある。

1. `rules.agentic-style` はoverlayで削除済みなのに、`priority` の末尾へ `agentic-style` が残る。
2. 現役 `rules.yasashii-style.dependencies` に、保護rule `conversation-contract` が無い。

固定upstreamのAgentic manifestは `priority` に `conversation-contract` と `agentic-style` を一度ずつ持ち、
`agentic-style.dependencies` に `conversation-contract` を含む。Yasashii overlayはstyleを置き換える際に
priority末尾の旧style削除と、現役styleへの保護依存追加を完了していない。

```text
node scripts/sprint-029-rule-boundary-test.mjs
exit 1
AssertionError: rule graphが不正です
- priorityが全ruleを一度ずつ含みません
- yasashii-styleがprotected rule conversation-contractを先に読みません
```

`plain-language.md` は人間向け列挙では正しい順番を持つため、直ちに全会話が壊れるとは限らない。しかし、
機械可読な正本manifestと入口が矛盾し、manifest consumerごとに解釈が分かれる。現行targeted testが
このgraph不整合を見落とすtest gapもあるが、主 finding は製品manifestの不整合である。

### V1 — Yasashii Windows native証跡が無い

- Classification: **verification-infra**
- Severity: **blocking**
- Failure kind: **verification-scope-issue**

Yasashii candidate `0677a0d...` または製品／test bytes同一のdocs-only HEAD `c364eb4...` は、
Windows nativeでまだ実行されていない。Agentic `24520a1...` のWindows 12/12はupstream coreの証拠であり、
Yasashii overlay／manifest／下流candidateのWindows PASSではない。macOS 12/12も代替しない。

### Non-blocking verification observations

- 広いarchiveのremaining historical assertionsは開始HEADと同じだが、gate自体はexit 1である。
  P1以外は古いAgentic path／exact wording／旧URL期待の重複で、current targeted suitesのgreenを
  product FAILへ読み替えない。広いgateをPASSとも表現しない。
- UI差分なしのため、契約どおりbrowser操作とscreenshotは実施していない。
- Linux nativeは別runnerで実行していない。POSIX wrapper、macOS実動作、Git-free archiveで
  本Patchの非Windows回帰を確認した。

## Rubric

| 項目 | Score | Threshold | 判定根拠 |
|---|---:|---:|---|
| 機能完全性 | 4/5 | 5 | overlay／macOS／releaseは成立。P1とWindows native未検証により5へ到達しない。 |
| 動作安定性 | 4/5 | 5 | 実行済みtargeted suiteはgreenだが、Windows downstream未実行。 |
| エラーハンドリング | 5/5 | 5 | rollback、path guard、symlink、負overlay、`--require-windows`拒否を再現。 |
| 回帰なし | 4/5 | 5 | 新規FAIL 0だが、現行正本P1を確認したため5にしない。 |
| C2 構文・整合 | 4/5 | 5 | JSON／Node／releaseはgreenだがrule manifestが自己不整合。 |
| C5 安全・規律 | 5/5 | 5 | path／rollback／overlay副作用0、外部write禁止を維持。 |
| C6 無回帰 | 4/5 | 5 | 新規悪化0でも、観測済みactive product defectをbaselineで隠さない。 |
| C10 更新の安全性 | 5/5 | 5 | version履歴、rollback、no-write境界を維持。 |
| C13 edition分離・互換 | 4/5 | 5 | identityは保護されたが、Yasashii rule graphの旧Agentic priority残存。 |
| C16 Windows native保存・0.9.2下流同期 | 4/5 | 5 | 下流同期と0.9.2は確認。Yasashii Windows native 12/12が未実施。 |

1軸でも5未満なら不合格という契約により、総合PASSにはしない。

## Acceptance Criteria 1〜14

| AC | 結果 | 独立確認 |
|---:|---|---|
| 1 | PASS | fixed upstream `24520a1...` とAgentic独立PASS記録を確認。Agentic Windows証跡をYasashiiへ流用していない。 |
| 2 | PASS | ancestry、49 changed paths、697 files分類、base／tree完全SHA、未分類0。 |
| 3 | **FAIL** | record／apply／check／reapply、byte parity、digest保護はPASS。ただし現行rule manifestに旧Agentic priorityが残るproduct defect P1。 |
| 4 | PASS | 7種の負例が同期先の追加副作用0で停止。 |
| 5 | **UNVERIFIED** | Yasashii Windows native 12/12、exit 0、crash／hang／残存process 0はnot-run。 |
| 6 | **UNVERIFIED** | macOSでは各保存面とBash非依存をPASS。Windows日本語・空白pathの下流実runはnot-run。 |
| 7 | **UNVERIFIED** | macOSではrecursive copyと4系統rollbackをPASS。Windows downstream実runはnot-run。 |
| 8 | **UNVERIFIED** | macOSではCRLF／LF、手書き行、見出し重複0をPASS。Windows downstream実runはnot-run。 |
| 9 | **FAIL** | targeted／Git-free新規面は0 FAIL、新規悪化0。ただしactive正本P1があるため全体の回帰なしを満たさない。 |
| 10 | PASS | 0.9.2 manifests／marketplaces／edition／CHANGELOG／release gate、旧raw byte一致、旧履歴不変。 |
| 11 | PASS | Yasashii identity／repo／marketplace／install ID／README／LICENSE／Harness導線を維持。対応済みprivate表示0。 |
| 12 | PASS | external write 0、upstream push disabled。実行はsource repo readと`/tmp` fixtureだけ。 |
| 13 | **FAIL** | product finding 1、Windows必須内部項目未検証のためfresh Evaluator 5/5条件を満たさない。 |
| 14 | **NOT USED** | Yasashii Windowsユーザー実機宣言はまだ無い。採用条件を次節に固定する。 |

## Windowsで次に必要な実行

P1を修正する場合、Windows対象の製品／test bytesが変わるかを実diffで確認する。manifest／overlay定義／
targeted testだけの変更でも、Windowsで実行するclean candidate SHAは修正後の完全SHAへ固定する。

現時点の製品candidateをそのまま検証する場合のexact SHAとcommandは次のとおり。

```text
candidate SHA:
0677a0d67ce70b478dd0d19e676b23295b78a4a3

PowerShell:
git status --short
git rev-parse HEAD
node --version
node scripts/sprint-038-patch-002-windows-test.mjs --require-windows
git status --short
```

期待値:

```text
開始時 `git status --short` が空
HEAD == 0677a0d67ce70b478dd0d19e676b23295b78a4a3
SPRINT038_PATCH002_WINDOWS_PASS=12 FAIL=0 OS=win32
process exit 0
0xC0000005 0件
crash 0件
hang 0件
残存process 0件
終了時 `git status --short` が空
```

証跡にはWindows version、`win32`、architecture、Node version、日時、完全SHA、command、12 label、
signed／unsigned exit、access violation／crash／hang／残存process、開始／終了cleanを記録する。
`c364eb4...`をWindows candidateにする場合は、実行前に
`git diff --exit-code 0677a0d... c364eb4... -- . ':(exclude)docs/**'` がexit 0であることも記録する。

## 次の遷移

現状はGeneratorへ自動でWindows runnerを作らせてもWindows native証跡は得られないため、V1だけなら
verification-scope-issueとしてユーザーへ返すべきである。ただし今回はP1というproduct findingがあるため、
総合の主分類はimplementation-issueとする。

推奨順序:

1. GeneratorがP1だけを限定修正し、overlay metadata／negative testを更新する。
2. fresh EvaluatorがP1、Patch 14/14、Sprint 029近傍、common parity、targeted archiveを再確認する。
3. 修正後のclean完全SHAをWindowsで上記12 labels実行する。
4. Windows証跡を採用したfresh Evaluatorが最終判定する。

Generatorへ渡すexact repair contract:

- 正本編集対象: `secretary-overlay/metadata-overrides.json`。必要なら、この不変条件を固定する
  `scripts/sprint-038-patch-002-test.mjs` だけを追加変更する。
- overlay適用結果: `plugins/secretary/rules/rule-manifest.json`。
- 変更しないtest oracle: `scripts/sprint-029-rule-boundary-test.mjs`。現行のgraph検査を弱めない。
- expected invariant:
  - `priority` は存在する全 `rules` keyを各1回だけ含む。
  - `priority` に `agentic-style` は0件。
  - `conversation-contract` は `yasashii-style` より前に1件。
  - `yasashii-style.dependencies` は `evidence`、`safety`、`common-language`、
    `conversation-contract` を含む。
  - Yasashii identity／copy、common byte parity、owned digest、overlay digest、Windows製品／test bytesを
    意図せず変えない。
- required repair tests:

```text
node scripts/sprint-029-rule-boundary-test.mjs
node scripts/sprint-038-patch-002-test.mjs --candidate <git-free-24520a1-tree>
node scripts/sprint-034-test.mjs <git-free-24520a1-tree>
node scripts/sprint-038-test.mjs
bash scripts/sprint-022-regression.sh
python3 scripts/check-release-integrity.py --root .
git diff --check
```

期待値はSprint 029 graph PASS、Patch 14/14、Sprint 034 11/11、Sprint 038 64/64、
Sprint 022 core 69/69＋wrapper 8/8、release integrity／diff check PASSである。

push、PR、merge、tag、Release、marketplace、install／updateは引き続き禁止する。

## Evaluator自己レビュー

- Generatorの自己評価ではなく、固定upstream、candidate、current HEADの実diffを確認した。
- Agentic Windows 12/12とYasashii macOS 12/12をYasashii Windows PASSへ昇格していない。
- 広いarchiveの12 FAILを0 FAILへ言い換えず、開始HEAD比較後も実内容を個別確認した。
- baseline同一でもactive正本の欠陥P1をproduct findingとして残した。
- Windows未実行をproduct defectへ誤分類せず、verification-scope-issueとして分離した。
- 実装、test、overlay、spec、contract、state、progress、Git履歴は編集していない。
- 書き込んだ正本は本feedbackだけである。

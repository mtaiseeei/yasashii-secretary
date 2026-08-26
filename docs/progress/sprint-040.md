# Sprint 040 Progress — 適用前handoff整合ゲート

## 結果

**pre-write spec-issueとして停止した。製品・test・fixture・overlayへのwriteは0件。**

公開版の固定入力からYasashii隔離candidate自体は再現できたが、公開handoff schema 2のpath宣言と
Sprint契約のpath数、およびbuilderが実際に変更するpathが一致しない。Generatorが独自にpathを追加・削除すると
Planner正本と固定handoffを変更することになるため、Sprint 040の製品適用、overlay記録、回帰実装には進んでいない。

## 固定入力の照合

| 項目 | 観測値 | 結果 |
|---|---|---|
| Yasashii開始HEAD | `3779140654e5b22b4502644a4b1ddf43816cb6bc` | PlannerのSprint 040 docs commit。product固定baseの直系子孫 |
| Yasashii product固定base | `3c472dd9a2b5299f27741ae2c418094486b7d035` | 一致 |
| 公開製品commit | `09267e352db51227e3f1375d861df53139797249` | `git show`で存在・完全SHA一致 |
| 公開共通candidate ID | `428b3ff435ee63bf47837e38792873264e14336e85ca1190bd823e80cbc67e0a` | 公開builderで再現（624 files） |
| Yasashii隔離candidate ID | `bb194d55a3cff4fe6fbfdb588f1db665d4fcd2ed4446482410ca9dc525490cfd` | 公開builderで再現（601 files） |
| handoff | schema `2`、SHA-256 `381f776b66a833e28d4729b9a329ddb22352833b562c2969b13f18460fb37328` | schema/digest読取成功、path宣言は後述の不一致 |
| inventory | schema `1`、17 surfaces／17 unique、SHA-256 `1c77e1df553a517f65b22d078f75e94f18df6f1f3c775b358deef79769cb12cb` | 一致 |

候補構築では、Planner docsを含む現行branchを直接baseにせず、固定base `3c472dd...` の一時cloneを作り、
公開commit `09267e3...` のGit-free archiveを公開入力にした。実Yasashii repoは読み取り専用のまま候補を構築した。

## 検出した正本矛盾

1. 公開handoffの実配列は `exactCommonPaths=23`、`yasashiiExactPaths=5` だが、両配列のintersectionは0件、unionは28件だった。
2. Sprint契約とdispatch指示は「重複1件、union 27件、最終byte parity 24件＋adapted 3件」を固定しているため、handoff実値と一致しない。
3. 公開builderの `adaptYasashii()` は `scripts/sprint-038-test.mjs` を変更するが、このpathはhandoffのどちらの配列にも存在しない。
4. 固定base→再現candidateの実差分は25 pathで、handoff宣言差分24 path＋未宣言 `scripts/sprint-038-test.mjs` 1 pathだった。
5. したがって、現入力のままでは「handoffの宣言pathだけを適用」「未分類path 0」「candidate ID `bb194d55...`再現」を同時に満たせない。

未宣言pathを黙ってrepo-owned supporting fileへ分類したり、handoff pathをGenerator判断で間引いたりはしていない。
公開handoffまたはSprint契約をPlannerが整合させた後、固定入力を読み直す必要がある。

## 実行commandと集計

| Command | Exit | 観測結果 |
|---|---:|---|
| `git -C /Users/taisei/workspace/agentic-secretary show -s --format='%H' 09267e352db51227e3f1375d861df53139797249` | 0 | 公開製品commit完全SHA一致 |
| `git archive 09267e352db51227e3f1375d861df53139797249 \| tar -xf - -C <public-archive>` | 0 | Git-free公開入力を作成 |
| `git clone --no-hardlinks /Users/taisei/workspace/yasashii-secretary <fixed-source>`、`git checkout 3c472dd...` | 0 | product固定baseを一時sourceとして分離 |
| `node <public-archive>/scripts/sprint-040-candidate-build.mjs --public-root <public-archive> --yasashii-source <fixed-source> --private-source /Users/taisei/workspace/agentic-secretary-my-vault --output <candidates>` | 0 | build 3/3、Agentic `428b3ff...`、Yasashii `bb194d55...`、private `95b7c53...`。下流repo write 0 |
| `jq`でhandoff 2配列のlength／intersection／unionを集計 | 0 | `23 / 5 / 0 / 28` |
| 固定base archiveとYasashii candidateの全file bytesを比較し、handoff unionとの所属を照合 | 0 | 実差分25、宣言24、未宣言1 |
| `jq`でinventory schema／surface ID一意性を集計 | 0 | schema 1、17/17 unique |

## 変更分類

- product／common／adapted: **0件適用**。
- tests／fixtures: **0件適用**。
- `secretary-overlay/` record／apply／check／reapply: **NOT-RUN**。入力矛盾を記録する前に実行していない。
- repo-owned supporting: **0件**。
- Generator正本: 本ファイル `docs/progress/sprint-040.md` だけ。
- 未分類product path: 候補差分上 **1件**（`scripts/sprint-038-test.mjs`）。このため適用前停止。

## 保護面と下流不変

開始時の実repoは `git status --short` 出力0件だった。製品writeを止めたため、次のYasashii固有surfaceは開始値のまま。

| Path | SHA-256 |
|---|---|
| `README.md` | `35361391ad9a74c9403f8a2cc20616b5e3aa0635d76a067c1022fb35b794b527` |
| `AGENTS.md` | `dd4343eb57b108bc54f867f458040d3315060da4ccf3df476106323401f7b5da` |
| `plugins/secretary/edition.json` | `663c14cc51b92a936a1dbaf34d5ab4f7ded65f20d57ad0ed645dfd3e8d9bf7b7` |
| `plugins/secretary/rules/styles/yasashii.md` | `50c9df0ff79fb43d5e051eb0c42070e31393b210a7fb78076c6e7e6996b1699c` |

`copy/yasashii.json`、manifests、marketplace、LICENSE、repo docs、overlay履歴、Harness参照にも製品変更はない。
private repoは候補builderの固定base読取にだけ使用し、write 0件である。

## 起動・評価handoff

- UI／対象URL: N/A。画面変更はなく、製品適用前に停止した。
- 現candidateをEvaluatorへ渡してPASS判定してはならない。先にPlannerが公開handoffと契約のpath集合を整合させる必要がある。
- 再開後の具体的評価scenario:
  1. 修正版handoffの件数・intersection・unionと契約値が一致する。
  2. 固定base→candidateの全差分がbyte parity／adapted／repo-owned supportingへ分類され、未分類0件になる。
  3. 公開builderでYasashii ID `bb194d55...`を再現し、adapted 3 pathのanchor／markerが各1件になる。
  4. その後にoverlay `record`／`apply`／`check`／`reapply`、`secondChanged=0`、専用15/15、Sprint 038 67/67、Sprint 010 56/56、安全71/71、版固有fixture、release integrity、Git-free archive、inventory 17/17を実Yasashii sourceで実行する。

## Known issues／not-run

- Sprint 040のmemory run-once、request/content hedge、pending、訂正、dedupe、checkpoint partial、scope 36組合せ、既存6操作はYasashii実repoでは**未適用・未実行**。
- 専用15/15、Sprint 038／010、安全回帰、版固有fixture、overlay、release integrity、Git-free archive、inventory 17/17は、実repo候補に適用できていないため**NOT-RUN**。公開版PASSをYasashii PASSへ流用していない。
- push、tag、Release、marketplace、installed cache、利用者workspace、Mac mini、new session、loaded version、external service、private版適用は**未実行／write 0件**。
- これは完了報告ではなく、Generatorが適用前に検出した`spec-issue`のhandoffである。`state.md`はOrchestratorだけが更新するため変更していない。

---

# schema 3承認後の実装cycle

前節のschema 2停止履歴は削除せず保持する。ユーザーがactive契約を公開PASS済みschema 3へ置換することを
明示承認し、Plannerが正本を改訂した後にfresh Generatorとして再開した。本cycleは**実装とoffline自己評価を完了**し、
fresh独立Evaluatorへ引き渡す。Evaluator PASSとOrchestratorの`state.md`更新前にSprint完了とは扱わない。

## 開始・終了識別

| 項目 | 値 |
|---|---|
| Generator開始HEAD | `94956d1e5bceb73709453635f41b373d00ce6851` |
| 実装前product固定base | `3c472dd9a2b5299f27741ae2c418094486b7d035` |
| 公開product commit | `9acea13477cd7730bf064a32c170b752586fa116` |
| 公開candidate ID | `36a5c5f5482fcd510e5b361bdf9e24620be696046e248fb29b3b557800cc083d` |
| schema 3 manifest SHA-256 | `e515842b147393ac77dddfb94d000188916d4aa837fda17d7e8fb4015f844982` |
| accepted Yasashii isolated ID | `4bc87169d87baf90f9681f7ba07d3154c71df34eac78bad15b435732e876faf2`（604 files） |
| Generator終了前HEAD | `94956d1e5bceb73709453635f41b373d00ce6851`。評価対象は本progressを含むGenerator commit後HEAD |
| Branch | `codex/sprint-040-memory-authorization` |

開始時はPlanner正本だけがcommit済みで`git status --short`は空だった。固定baseは隔離candidate生成に使い、
現行Planner docs、state、既存progressを固定baseで上書きしていない。

## pre-write schema 3 gate

公開builderを公開repoから実行し、実Yasashii repoとprivate repoは固定commit入力の読取だけにした。

- handoff正例、legacy schema 2観測、未宣言mutation、role overlap、unused、stale path、stale／複数anchor、
  stale public root、空exclusions、transformer不一致、実変換点外anchorの**12/12 PASS**。
- inventory検査は**8/8 PASS**。3版それぞれ17 surface／17 unique、実本文digest、marker、tracked proofを確認した。
- Yasashii roleはparity 29、adapted 3、supporting 5、declared union 37。3 intersection、未分類、unused、staleは各0件。
- builder traceはread 37、copy 31、write 32、protect 5。`--skip-execute`のpre-write runなのでexecute 0で、
  suiteは適用後に実sourceとGit-free candidateで別途実行した。
- fixed-baseからのactual diffは28 pathで、すべてparityまたはadapted。supporting差分0件。
- 2つの別空directoryから3版IDが一致し、Yasashii ID `4bc87169...`を再現した。

不一致時は実repoへ書かないgateを通過してから、accepted candidateのactual diff 28 pathだけを機械反映した。

## 適用path分類

### Parity 29

schema 3 manifestの`sharedParity` 25 pathと、Yasashii版の次の4 pathである。

- `plugins/secretary/skills/daily/SKILL.md`
- `plugins/secretary/skills/memory-care/SKILL.md`
- `plugins/secretary/skills/projects/SKILL.md`
- `plugins/secretary/skills/settings/SKILL.md`

### Adapted 3

- `plugins/secretary/skills/secretary/SKILL.md`: 公開sourceからYasashii identity／Harness表現だけを適応。
- `scripts/sprint-010-regression.sh`: 公開sourceからYasashii style／copy routeだけを適応。
- `scripts/sprint-038-test.mjs`: Yasashii固定baseからschema 2 runtime入力へ適応。公開sourceからのblind copyはしない。

全anchorは入力内occurrence 1、実application 1、宣言transformerと実transformer一致、final digest一致だった。
前2 pathのcopy後adaptはread／copy／write traceに収載され、Sprint 038はread／write traceに収載される。

### Supporting 5

`README.md`、`AGENTS.md`、`docs/spec.md`、`plugins/secretary/edition.json`、
`plugins/secretary/rules/styles/yasashii.md`。製品差分0件で、protectとして実利用した。

### Actual diff 28

- 会話／memory本体・copy・skills・templates 14 path。
- Sprint 038 fixture／runtime／test 4 path。
- Sprint 040 handoff／legacy fixture／builder／suite／edition／handoff／inventory／regression／snapshot／test 10 path。

適用後、実sourceの28 pathすべてをaccepted candidateとmode／SHA-256比較し一致した。
追加したrepo-owned `scripts/sprint-040-yasashii-source-test.mjs` は、現行Planner docsを保持した実sourceを
candidate reportと比較するYasashii限定fixtureであり、accepted product bytesや公開版へ逆流しない。

## overlayの整合

既存overlayをschema 3の入力責務に合わせて最小更新した。

- `upstream-base.json`: baseを公開PASS済み`9acea13...`へ進め、manifest digest、公開／Yasashii candidate ID、
  external gateを記録した。release version、remote contract、push disabledは変更していない。
- `mapping.json`: projects／settingsを旧anchor適応からparityへ戻し、`copy/agentic.json`をcommonとして収載した。
- `downstream-owned.json`: `copy/yasashii.json`をparityへ戻した。固定base入力のSprint 038 testと実source fixtureは
  Yasashii所有として保護する。
- `upstream-tree.json`: exact public candidate 628 filesを`record`した。

初回診断では、旧identity handoff digestと旧Sprint 038公開source anchorが新baseに一致せず`check`が非0になった。
前者は同じ実treeから再計算した`04be75e...`へ更新し、後者はschema 3契約どおり固定base adapted／repo-ownedへ分類した。
受入基準や会話期待値を緩めていない。最終結果は次のとおり。

- `record`: `RECORDED upstream=9acea13... files=628`
- `check`: PASS、managed 290、handoffPaths 20、remote push disabled。
- `apply`: PASS、`changed=0`。
- `reapply`: PASS、`secondChanged=0`。
- 最終overlay definition SHA-256: mapping `796df1dc...`、downstream-owned `e574e7d9...`、
  upstream-base `fe14df3c...`、upstream-tree `b7556905...`。

## 実Yasashii sourceの会話・memory評価

画面変更はなく、起動command／test URL／browser／screenshotはN/A。次の実runtime scenarioを実sourceで確認した。

- 「これ覚えて」のdecision／topic相当は内部分類質問0、同じturnで各1件。
- request hedgeは質問前write 0、推量／伝聞の明示保存は情報源・確実性を保持して各1件。
- 引用、非現在仮定、取消、過去照会はwrite 0。保存済み取消は削除2段階。
- pending 1件、別話題失効、「はい、ただしX」の修正版1件／再確認0。
- topic訂正は旧event不変、新event 1、retry 0。内容dedupeは別turn／別operation／再起動相当で追加0。
- checkpoint failureは`partial`で`1/1/0`、retry `0/0/1`、再retry `0/0/0`。
- memory 2表現×6 destination×scope 3状態の36組合せをmemory専用gateへ通し、既存6操作は各
  `explicit / saved / 1`を維持した。
- Sprint 038 goldenは全caseを実runtime classifier経由で実行し、classifierInput欠落、runtime tamper、
  旧限定実装再注入を拒否した。

## 実行commandと結果

| Command／surface | Exit | 結果 |
|---|---:|---|
| 公開`node scripts/sprint-040-handoff-test.mjs --yasashii-source ... --private-source ...` | 0 | 12/12 PASS |
| 公開builder `--skip-execute`＋inventory | 0 | 3 candidate、inventory 8/8、Yas ID `4bc87169...` |
| 別空directoryへの再build＋ID比較 | 0 | 3/3一致 |
| 実source `node scripts/sprint-040-test.mjs` | 0 | 15/15 |
| 実source `node scripts/sprint-040-yasashii-source-test.mjs --candidate-report ...` | 0 | 9/9、28 path bytes／mode、17/17 inventory、Planner docs保持 |
| 実source `bash scripts/sprint-038-regression.sh` | 0 | 67/67、historical classifier 14/14、path 3/3 |
| 実source `bash scripts/sprint-010-regression.sh` | 0 | 56/56 |
| 実source `node scripts/sprint-021-git-safety-test.mjs` | 0 | Git／Secret安全境界71/71 |
| 実source `python3 scripts/check-release-integrity.py --root .` | 0 | manifest／CHANGELOG整合PASS |
| accepted Git-free candidate `bash scripts/sprint-040-candidate-suite.sh yasashii` | 0 | Sprint 040 15/15、edition 3/3、Sprint 038 67/67、Sprint 010 56/56、安全回帰0 FAIL |
| overlay `record`／`check`／`apply`／`reapply` | 0 | 628 record、check PASS、changed 0、secondChanged 0 |
| `git diff --check`／staged tree `git diff --cached --check` | 0 | whitespace error 0 |

実sourceでまとめwrapperを最初に実行した際、会話15/15の直後にedition fixtureが現行`docs/spec.md`を固定base旧digestと
比較して非0になった。これは承認済みPlanner正本を保持したことによる検証面の不一致で、固定base candidateでは同fixtureが
3/3 PASSする。実sourceには固定base docsを戻さず、専用fixture 9/9で現行docs保持と製品bytes一致を別々に証明した。

## clean checkout相当・Git-free archive

Generator所有33 pathだけをstageし、Planner docs／stateはstageせず、tree
`0298d86308d89a52fda0163879083084013899ac`を固定した。`git archive`で
`/tmp/yas-s040-gitfree.Vkjn3S`へ展開し、`.git`不在を確認した。

- staged treeのGit-free archiveでrelease integrity 14/14。
- Yasashii実source fixture 9/9、Sprint 040 15/15。
- accepted isolated candidate自体もGit-freeで、full candidate suiteが0 FAIL。

これにより現行Planner docsを含むclean tree相当と、固定baseからのaccepted product candidateの両方を分離して検証した。

## 保護面・外部境界

| Path | 最終SHA-256 |
|---|---|
| `README.md` | `35361391ad9a74c9403f8a2cc20616b5e3aa0635d76a067c1022fb35b794b527` |
| `AGENTS.md` | `dd4343eb57b108bc54f867f458040d3315060da4ccf3df476106323401f7b5da` |
| `docs/spec.md` | `1e19127963414b51b152806f30d272d23a4f6119c32180d9ec28364390ceb027`（承認済みschema 3 Planner正本） |
| `plugins/secretary/edition.json` | `663c14cc51b92a936a1dbaf34d5ab4f7ded65f20d57ad0ed645dfd3e8d9bf7b7` |
| `plugins/secretary/rules/styles/yasashii.md` | `50c9df0ff79fb43d5e051eb0c42070e31393b210a7fb78076c6e7e6996b1699c` |

Yasashii固有文体、style、edition、manifest／marketplace、README、LICENSE、AGENTS、repo-owned docs、
Harness履歴に許可外変化0件。`copy/yasashii.json`はYasashii内容を保った公開schema 3 parityへ更新した。

private repoは開始・終了ともHEAD `8e0796c9aba49d9a3dccb020912b0e1cf3989abf`、status空で、固定base読取だけ。
private製品適用／stage／commit／branch／remote変更は0件。push、tag、Release、marketplace公開、installed cache、
利用者workspace、Mac mini、new session、loaded version、external serviceも未実行／write 0件である。

## Evaluator handoff

- 起動: 不要。URL／UI: N/A。
- baseline: `node scripts/sprint-040-yasashii-source-test.mjs --candidate-report <schema3-builder-report>`、
  `node scripts/sprint-040-test.mjs`、Sprint 038／010／Git safety、overlay check／reapply、release integrity。
- 固定baseのedition fixtureはaccepted isolated candidateで実行し、現行branchではYasashii source fixtureを使う。
- Candidate reportは公開commit `9acea13...`のbuilderからfresh生成し、固定IDとmanifest digestを再照合する。
- product finding／verification-infra findingの既知残件は0。外部面は契約どおりNOT-RUNであり、offline PASSと分けて報告する。

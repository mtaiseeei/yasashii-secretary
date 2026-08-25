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

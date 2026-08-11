# Sprint 038 Patch 002 実装進捗 — Windows native保存互換 / Yasashii Secretary 0.9.2

## 実装結果

- 開始HEADは `a7336794ecfe0a9d43e8e60d28815a071ca9e963`。
- 同期元は、Agentic側でfresh独立評価PASS済みと契約に記録された完全SHA
  `24520a1d06f8d3833568a1386bf814e1085f5da9` だけに固定した。
- `/Users/taisei/workspace/agentic-secretary` のworking treeは同期元にせず、上記SHAを
  `git archive` で `/tmp/yasashii-s038p002-agentic-niTteW` へ展開したGitなしtreeを候補にした。
  これにより、固定SHA後のdocs commitやdirty working treeは混ぜていない。
- 旧base `3a5a6c30ac4ad823b5535d290a46423e8e5d15d6` は固定SHAの祖先で、差分49 pathsをreviewした。
  upstream 697 filesはcommon 246、metadata overlay 6、anchor overlay 17、upstream-only 23、repo-owned 405へ分類し、未分類0件。managedは269 files。
- overlayの `record → apply → check → reapply` を同じ固定treeで実行した。actual applyは33 files変更、
  最終reapplyは `secondChanged=0`。managed digestは
  `fd56a6c678f764c0413f61b88d7c788476f7ae3d96b831bc8f9858bc3fcc64ff`。
- apply後のrepo-owned digestは
  `b4b72577ebdb5a5d301a9667f39c3436abdd62f687102f904044966d86401f18`、review確定後のoverlay定義digestは
  `05ba070414b6d3ba766f00b38f6fd373a19c149974183fa5b1541c7d48ee6bbe`。check／reapply前後で不変だった。
- Yasashii固有 `rules/copy/yasashii.json` と `rules/styles/yasashii.md` をrepo-owned保護へ移し、
  identity、repository、marketplace、install ID、README、LICENSE、spec／Sprint／progress／feedback／evidenceを保護した。
- metadataをYasashii identity以外へ変える宣言はapply前に停止する。未分類追加／削除、anchor 0件／複数、
  記録外metadata、base／tree不一致も、同期先の追加副作用0件で停止する負回帰を追加した。

## Windows保存互換

固定上流の共通coreをbyte単位で取り込み、次をYasashii版でも同じNode.js入口へ揃えた。

- project作成、journal、memory、TODO、settings、文書保存をBashのpath解釈から分離。
- 日本語・空白path、project内の既存treeを保持するfile-by-file copy、recursive copy自己再帰の回避。
- project／journal／memory／TODO／preferences／文書の失敗注入rollback。
- traversal、prefix sibling、symlink／junctionのpath guard。
- CRLF `preferences.md` のCRLF維持、mixed EOL 0。LF fixtureも既存LFを維持。
- `.sh` はPOSIX互換wrapperとして残し、実処理をNode.jsへ接続。

同じ12 labelsをmacOSで実行し12/12。`--require-windows` はmacOSでexit 1、11 PASS / 1 FAILとなり、
Windows nativeを偽ってPASSにできないことを確認した。

- 実行環境: `darwin arm64`、Node `v22.23.2`
- Windows native: **not-run**
- Windows access violation `0xC0000005`、hang、残存processの実機確認: **not-run**
- release hold: 維持。Windows native 12/12とfresh独立Evaluator判定前に公開しない。

## 0.9.2配布整合

- Claude marketplace／manifest、Codex manifest、edition metadata、正本／旧raw CHANGELOG、
  release validatorを `0.9.2` へ揃えた。
- 正本と旧raw CHANGELOGはbyte一致。`0.9.1`以前のsectionは開始HEADとbyte一致。
- CHANGELOGとREADMEはWindows保存互換とmigration不要をYasashii利用者向けに説明し、
  private editionへ対応済みとは表示しない。
- Yasashii Harnessは契約外のため `0.5.1`、repository `mtaiseeei/yasashii-harness`、
  observed commit `f50917e3cf9c24b6e4370adba547bd4891c85986`、両host install ID
  `harness@yasashii-harness` のまま維持した。
- wizard asset、Yasashii copy／style、LICENSEの開始HEAD差分は0件。UI／DOM／会話copy変更はない。

## 主な変更path

- 共通保存core:
  `plugins/secretary/scripts/lib/{markdown-lines,safe-fs,secretary-store}.mjs`、
  `plugins/secretary/scripts/{project-tools,owner-name-transaction,workspace-tools}.mjs`、
  `plugins/secretary/scripts/workspace-tools.sh`、
  `plugins/secretary/skills/memory-care/scripts/{memory-tools.mjs,memory-tools.sh}`。
- 共通skill／回帰:
  daily、memory-care、secretary、settings、setup-google／microsoft／notion、weekly、
  `scripts/sprint-038-patch-002-windows-test.mjs`、関連Sprint回帰、master gate、Windows workflow。
- 下流overlay:
  `secretary-overlay/{upstream-base,upstream-tree,mapping,anchors,downstream-owned,downstream-files}.json`、
  `scripts/sync-secretary-overlay.mjs`、`scripts/sprint-034-test.mjs`、
  `scripts/sprint-038-patch-002-test.mjs`、`docs/yasashii-upstream-mapping.md`。
- 配布面:
  `.claude-plugin/marketplace.json`、Claude／Codex manifest、正本／旧raw CHANGELOG、README、
  `scripts/archive-release-gate.mjs`、`scripts/check-release-integrity.py`。

## 実行証拠

| コマンド／検査 | 結果 |
|---|---|
| `git merge-base --is-ancestor 3a5a6c30... 24520a1d...` | exit 0 |
| `git diff --name-status 3a5a6c30... 24520a1d...` | 49 changed pathsをreview |
| `node scripts/sync-secretary-overlay.mjs --record --candidate /tmp/yasashii-s038p002-agentic-niTteW --observed-commit 24520a1d...` | `RECORDED ... files=697` |
| 同 `--apply` | PASS、changed 33、managed 269 |
| 同 `--check` | PASS、未分類0、upstream push disabled |
| 同 `--reapply` | PASS、secondChanged 0、上記3 digest不変 |
| `node scripts/sprint-038-patch-002-test.mjs --candidate /tmp/yasashii-s038p002-agentic-niTteW` | 14 PASS / 0 FAIL、Windows native not-run |
| `node scripts/sprint-038-patch-002-windows-test.mjs` | macOS target 12 PASS / 0 FAIL |
| 同 `--require-windows` | 期待どおりexit 1、11 PASS / 1 FAIL |
| `node scripts/sprint-034-test.mjs <fixed-tree>` | 11 PASS / 0 FAIL |
| `node scripts/sprint-038-test.mjs` | 64 PASS / 0 FAIL |
| `node scripts/sprint-037-test.mjs` | 14 PASS / 0 FAIL、unexpected 0 |
| `bash scripts/sprint-022-regression.sh` | core 69 / 0、wrapper 8 / 0 |
| `bash scripts/sprint-038-patch-001-regression.sh` | Patch 6 / 0、Sprint 035 15 / 0、release PASS |
| Git-free `archive-release-gate.mjs` | 14 PASS / 0 FAIL |
| Git-free新Patch／Sprint 038 | 14 / 0、64 / 0 |
| `python3 scripts/check-release-integrity.py --root .` | PASS |
| 8 Node entrypointsの `node --check` | 全exit 0 |
| 13 JSON surfaces parse | `JSON_OK=13` |
| `git diff --check` | PASS |

## 広いarchive gateと開始HEAD baseline

`node scripts/master-release-gate.mjs --mode archive --root .` は、候補／開始HEADともhistorical期待値で赤のため、
PASSへ昇格していない。

- candidate: 23 suites、required 15、passed 7、failed 8、298 assertions中286 PASS / 12 FAIL。
- start HEAD: 22 suites、required 14、passed 6、failed 8、286 assertions中274 PASS / 12 FAIL。
- 差分: 新しいWindows suite 12 assertionsが全PASS。historical FAILは同じ12件で、新規悪化0。
- 主な既知FAIL: Sprint 010の旧5応答状態期待、Sprint 011のAgentic style期待、
  README／rule graph／raw URLの旧Yasashii historical期待。今回の保存core／overlay／0.9.2面のproduct findingではない。

広いgate全体がgreenとは主張しない。current必須面は上記targeted、Git-free、release、path／rollback回帰で0 FAIL。

## 起動・Evaluator引き継ぎ

常駐アプリとUI差分はないため、startup command、test URL、browser screenshotは該当なし。
fresh独立Evaluatorは同じ固定treeで次を最初に実行する。

```bash
node scripts/sync-secretary-overlay.mjs --check --candidate /tmp/yasashii-s038p002-agentic-niTteW --observed-commit 24520a1d06f8d3833568a1386bf814e1085f5da9
node scripts/sync-secretary-overlay.mjs --reapply --candidate /tmp/yasashii-s038p002-agentic-niTteW --observed-commit 24520a1d06f8d3833568a1386bf814e1085f5da9
node scripts/sprint-038-patch-002-test.mjs --candidate /tmp/yasashii-s038p002-agentic-niTteW
node scripts/sprint-038-patch-002-windows-test.mjs
bash scripts/sprint-022-regression.sh
python3 scripts/check-release-integrity.py --root .
```

Windowsではcleanな同一candidate commitで次を実行し、OS／Node／時刻／candidate SHA／exit／12 labels／
`0xC0000005`／hang／残存processを記録する。

```powershell
node scripts/sprint-038-patch-002-windows-test.mjs --require-windows
```

## 外部操作と残余リスク

- origin／upstream remote設定変更、fetch、push、PR、merge、tag、GitHub Release、marketplace公開: `not-run`。
- plugin install／update、installed cache、利用者workspace、private edition、他repoへのwrite: `not-run`。
- Secret、Actions実行、OAuth、Chatwork／Google Chat API、その他external service: `not-run`。
- local source repo以外への永続write: 0件。`/tmp` の固定candidate／隔離fixture／Git-free archiveだけを使用。
- upstream remoteはfetch `https://github.com/mtaiseeei/agentic-secretary.git`、push `DISABLED` の既存状態をread-only確認した。
- Windows native 12/12は未実行。macOS smokeをWindows PASSへ読み替えない。
- Generator自己評価のproduct findingは0件。最終完了はfresh独立EvaluatorとOrchestratorのstate記録に委ねる。
- downstream最終commit SHAは、本progressを含むGenerator commit作成後のhandoffで報告する。

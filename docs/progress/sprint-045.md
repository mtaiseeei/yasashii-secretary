# Sprint 045 Progress — Yasashii 0.13.0 差分適応

## Candidate

- 開始HEAD: `b80f5da4b173ec2e3b1c6404e21b29f7d99240c5`。
- fixed public input: commit `5e26432307a2f247d244dcb2766e870400d006f2`、tree `417586847bdf64b9be6a8461b2fd0455d1807aca`、Sprint 056 fresh独立Evaluator PASS。
- fixed private input: commit `d1a2a996f160fe604c85997190fff5c8dc7e47c3`、receipt commit `31c30dba550171b09d1cda24368f9f9121f2b1c9`、Sprint 052 fresh独立Evaluator PASS。private固有コード／値は取り込んでいない。
- 製品candidate commit: `99a3a214437b65c0c22516b1a39722f703ec1215`、tree `df4462368f000333fdea0ba45685cdc11de9bfe1`。
- Git-free archive: `/private/tmp/yasashii-secretary-0.13.0-candidate-99a3a21.tar.gz`、SHA-256 `179b84bd155ba176dc1e40e9edaaa4ec1619440f0526d442fff2a36ee62203e1`、regular file 824件。各regular fileの`path`、mode、SHA-256をpath順に並べたJSONのSHA-256は`6b9dab424033194311918ca37d3dd25e62b12d1db53393415b1bdeab85179804`。
- 状態は`source-candidate-unverified`。fresh独立EvaluatorのYasashii判定前であり、push、main統合、tag、Release、Marketplace公開、installは行っていない。

## 実装した差分

- public固定差分からCLI、core、projection、Hookの4ファイルをbyte一致で適用した。accepted SHA-256との一致を確認した。
- Clarity SkillにはF85〜F87とStop Hook authorization境界を適用し、Yasashii固有の会話copy、identity、導線、markerを維持した。public Skillとの差はedition markerだけである。
- publicの小回帰を、Yasashiiの直接回帰`scripts/sprint-045-055-regression.mjs`と`scripts/sprint-045-hook-regression.mjs`として適応した。
- Claude／Codex manifest、marketplace、正本／互換CHANGELOG、release／host inventory、release integrity／archive gate、READMEと最小の0.13更新案内をcurrent `0.13.0`へ揃えた。
- collaboration inventoryは変更面のcontent digestだけ、conversation inventoryは変更したClarity SkillのSHA-256だけを更新した。旧release pin、旧suite、fixture、既定Xmind OFFは変更していない。

## 保護した面

- `/private/tmp/secretary-056-yasashii-protected-baseline.json`の49 pathをcandidate bytesと照合し、49／49 unchanged、changed 0だった。
- Yasashii copy／style、READMEのedition案内、LICENSE、mapping、overlay anchors／metadata、upstream pin、identity、過去のspec／state／progress／feedback、実my-vault、自由設定、private値を変更していない。
- public `.clarity/**`と`CLARITY.md`はread／stageしていない。Planner／Orchestrator所有の`docs/spec.md`、`docs/sprints/sprint-045.md`、`docs/sprints/state.md`はGenerator実装では編集していない。

## Macで実行した契約内検査

最初のsandbox内process照会は取得に失敗して0を返したため採用せず、権限を上げたread-only `pgrep node | wc -l`で32を実測してから開始した。

| Command | Exit / Result |
|---|---|
| `node scripts/sprint-045-055-regression.mjs` | exit 0、8 PASS／0 FAIL |
| `node scripts/sprint-045-hook-regression.mjs` | exit 0、5 PASS／0 FAIL。fixture／子process cleanup完了 |
| `node --check`（Clarity CLI／core／projection／Hook、上記2回帰、archive gateの7 files） | すべてexit 0 |
| `python3 scripts/check-release-integrity.py --root .` | exit 0、PASS |
| `validateCollaborationInventory(process.cwd())` | exit 0、20 surface／57 case、digest／marker有効 |
| conversation inventory current hash照合 | exit 0、38 surface PASS |
| protected baseline 49 pathのSHA-256照合 | exit 0、49 unchanged／0 changed |
| `node scripts/archive-release-gate.mjs --root /private/tmp/yasashii-045-archive.tDkrmH/yasashii-secretary-0.13.0` | exit 0、14 PASS／0 FAIL。検査後に展開dirを削除 |
| JSON parse、正本／互換CHANGELOG byte比較、`git diff --check` | すべてexit 0 |

検査後の`pgrep node | wc -l`も32で、開始時から増加していない。

開始時にinventoryの入口を`node scripts/sprint-049-inventory.mjs validate`と誤認して実行し、fileが存在しないためexit 1の`MODULE_NOT_FOUND`だった。既存の正しい入口`validateCollaborationInventory()`を直接importして上表の20 surface／57 case PASSを確認した。

archive作成前にrepo rootへarchive gateを実行した結果は13 PASS／1 FAIL、失敗理由はrootに`.git`が存在するためだった。candidate commitから作成したGit-free archiveでは上表の14 PASS／0 FAILを確認した。

## 契約外で実行した旧pin検査

current-version inspectionの範囲を一度広く解釈し、次の旧full／historical pin検査を実行した。これらはSprint 045の判定へ使用しない。

- `node scripts/sprint-038-patch-001-test.mjs`: exit 1、5 PASS／1 FAIL。旧CHANGELOG判定が先頭version `0.12.0`を固定要求したためで、今回の`0.13.0` candidateには古いpinだった。
- `node scripts/sprint-043-patch-001-test.mjs`: exit 1、2 PASS／2 FAIL。旧Hook hashがStop Hook修正前bytesを固定し、overlay anchorの期待hashも開始時点ですでにcurrent bytesと不一致だった。

この逸脱で一時変更した`master-release-gate.mjs`、`sprint-032-update-gate-test.mjs`、`sprint-035-test.mjs`、`sprint-038-patch-001-test.mjs`、`sprint-043-patch-001-test.mjs`は、自分の差分だけをinverse patchで戻した。5 filesは開始bytesと一致し、candidate commitに含まれない。historical期待値、fixture、安全条件、採点基準は変更していない。

## 自己確認と未検証

契約のC1／C2／C5／C6／C10／C12／C13／C14／C15／C25該当面について、固定receipt、13件の直接回帰、共通4 filesのdigest、Yasashii Skill差分、49 path保護、0.13 metadata、Git-free archiveを確認した。これはGenerator自己確認で、Yasashii PASSの代用ではない。

full Sprint 044／050、64 actor、stress、recursive wrapper、全Yasashii suite、Windows native、network、UI／browser、実Claude／Codex host、実workspace、tag／Release／Marketplace／installはNOT-RUN。新runner、CI、collector、attestationは追加していない。

## Evaluator handoff

常駐serverとWeb UIはない。fresh独立Evaluatorはexact candidate `99a3a214437b65c0c22516b1a39722f703ec1215`で、次の限定入口を使う。

```bash
node scripts/sprint-045-055-regression.mjs
node scripts/sprint-045-hook-regression.mjs
node --check plugins/secretary/scripts/clarity.mjs
node --check plugins/secretary/scripts/lib/clarity-core.mjs
node --check plugins/secretary/scripts/lib/clarity-projection.mjs
node --check plugins/secretary/scripts/lib/clarity-hook.mjs
python3 scripts/check-release-integrity.py --root .
```

加えて、accepted common hash、Yasashii Skill marker、49 path protected snapshot、inventoryの変更面、上記Git-free archiveの14 checksを確認する。public／private PASSや本progressの自己確認をYasashii verdictへ流用しない。

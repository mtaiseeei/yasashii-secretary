# Sprint 043 Patch 001 Progress — Claude標準Hook重複宣言の修正

## 判定範囲

- Status: `candidate-unverified`。これはGeneratorの引き渡し状態であり、EvaluatorのVerdictではない。
- 対象はClaude manifestの重複した標準Hook参照キーだけである。
- `docs/spec*`、`docs/sprints/state.md`、Sprint契約、feedback、既存のfinal receiptは変更していない。
- release、version bump、Marketplace、cache、install、push、tag、new sessionは実行していない。

## 実装した変更

- `plugins/secretary/.claude-plugin/plugin.json`
  - `hooks: "./hooks/hooks.json"`だけを削除した。
  - `name`、description、version `0.11.0`、author、URL、license、`skills: "./skills/"`は維持した。
- `plugins/secretary/.codex-plugin/plugin.json`
  - `hooks: "./hooks/hooks.json"`を維持した。Codex側の参照欠落はpatch回帰で失敗する。
- `scripts/sprint-043-test.mjs`
  - `PK-001`をClaude host契約（標準Hook重複参照なし）へ更新した。
  - `PK-002`のCodex host契約は厳密なHook参照チェックのまま維持した。
- `scripts/sprint-043-patch-001-test.mjs`
  - Claude／Codex manifest、共通HookとProject Clarity router、Yasashii copy／style／identity／edition、overlay定義のbyte・modeを確認するpatch専用micro回帰を追加した。
- `plugins/secretary/collaboration-inventory.json`
  - manifest変更後にCLX-020が検出するhost/package-release inventoryの派生`contentDigest`だけを更新した。surface、marker、test割当、実装挙動は変更していない。

## 実行した検証

| Command | 結果 |
|---|---|
| `node scripts/sprint-043-patch-001-test.mjs` | 4 PASS / 0 FAIL |
| `node scripts/sprint-042-core-test.mjs` | 43 PASS / 0 FAIL |
| `node scripts/sprint-042-projection-test.mjs` | 35 PASS / 0 FAIL |
| `node scripts/sprint-042-xmind-test.mjs` | 29 PASS / 0 FAIL / 1 NOT-RUN（実Xmind MCP live） |
| `node scripts/sprint-042-hook-test.mjs` | 40 PASS / 0 FAIL |
| `node scripts/sprint-042-link-test.mjs` | 34 PASS / 0 FAIL |
| `node scripts/sprint-042-drift-test.mjs` | 25 PASS / 0 FAIL |
| `node scripts/sprint-042-collaboration-test.mjs` | 20 PASS / 0 FAIL、inventory stale 0 |
| `node scripts/sprint-040-patch-001-test.mjs` | 4 PASS / 0 FAIL（parity／anchor分類） |
| `claude plugin validate plugins/secretary` | exit 0、Validation passed |
| `git diff --check` | exit 0 |

Secretary統合回帰は`33 PASS / 2 FAIL`で、失敗は既存の`RG-010`（旧Sprint 039 identity／overlay snapshot）と`RG-011`（旧0.10.3 update fixture）だけだった。今回のHook manifest変更で追加された失敗ではない。既存fixtureと`check-release-integrity.py`は履歴として変更していない。

## overlay／reapply境界

次の実コマンドを実行したが、現行のClarity適用済みtreeと固定されたSprint 040 upstream snapshotの差により、overlay側はPASSにならなかった。

- `node scripts/sync-secretary-overlay.mjs --check --root /private/tmp/yasashii-secretary-clarity --candidate /private/tmp/sprint040-independent-eval.uSPqxS/candidates/agentic --observed-commit 9acea13477cd7730bf064a32c170b752586fa116`
  - exit 1。`downstream inventory mismatch`（固定baseにない現行Clarity／verification surfaceがunclassified）で停止し、write 0。
- 同じ引数の`--reapply`
  - exit 1。同じ固定snapshot境界で停止し、write 0。
- `node scripts/sprint-038-patch-002-test.mjs --candidate /private/tmp/sprint040-independent-eval.uSPqxS/candidates/agentic`
  - 8 PASS / 6 FAIL。固定0.10.3 release条件、現行downstream fixture差、overlay適用差（期待`changed=1`に対して`changed=26`）を含む履歴fixture不一致。Windows nativeはDarwinのためNOT-RUN。既存overlay定義は変更していない。

`node scripts/sprint-043-current-gates.mjs --full`は、今回の変更面ではなく旧wrapper文言assertion（`owned docs violation`）でexit 1だった。`node scripts/sprint-043-test.mjs`は、patch後のproduct bytesが固定`candidate.json`の旧digestと一致しないためexit 1。Sprint 043のcandidate／source receipt／履歴fixtureをpatch候補へ書き換えることは契約外なので行っていない。

## Not-run／残余

- private実機Claude install・実Hook trigger・実Yasashii liveは未実行。trigger evidenceをlive PASSへ昇格していない。
- Codex実host install、connector、Xmind App／MCP live、利用者workspace migration、外部push／remote writeは未実行。
- release、Marketplace publish／refresh、cache、install、tag、GitHub Release、new session、loaded version確認は未実行。
- Evaluatorのfresh検証と`docs/feedback/sprint-043-patch-001.md`作成は未実行。GeneratorはPASS判定を宣言しない。

# Sprint 026 Generator Progress

## 実装したこと

- `scripts/master-release-gate.mjs` を追加し、`offline`／`online`／`archive` の実行面を分離した。
- checkout側では Sprint 015、Sprint 020 Patch 002、既存 `scripts/regression-check.sh` を固定順で実行する。
- 各子suiteの開始・終了時刻、assert数、PASS／FAIL、終了コード、signal、timeout、未実行を機械可読なJSONと人間向け出力へ集約する。
- assertを1件も出さない子suiteも成功扱いにせず、FAILとして停止する。子suiteのFAIL・signal・timeout・未実行は最後の成功で上書きしない。
- `.git` のないarchive側は `archive-release-gate.mjs` で `0.7.0`、author、MIT、単段 `forkedFrom`、source、validator、CHANGELOGを検査する。
- Git履歴やloopbackを必要とする項目はarchiveで「checkout専用」と理由つきで未実行に分離し、archive全体のPASSへ数えない。
- `scripts/master-release-gate.sh` と `scripts/sprint-026-regression.sh` を追加した。

## Retry 1で修正したこと

- archive gateが `scripts/check-release-integrity.py --root <archive>` を実行し、validatorの終了結果を合否へ反映するようにした。存在確認だけで通る経路をなくした。
- `master-release-gate.mjs` のarchive検査でも同じvalidatorを実行し、失敗理由を記録するようにした。
- `PASS=... FAIL=...` に加えて `SPRINT026_PASS=... SPRINT026_FAIL=...` のようなprefix付きsummaryをassert数として集計するようにした。
- 専用fixtureへ、prefix summaryの正負例と、homepage／repositoryを壊したarchiveの負例を追加した。

## Retry 2で修正したこと

- `parseAssertCounts()` は、子suite出力にbareの `PASS=<n> FAIL=<n>` があれば、その最後の1行を正本summaryとして採用する。bare正本がない場合だけ、最後のprefix付きsummaryを採用する。内部summaryと最終summaryを加算しないため、raw最終件数を二重計上しない。
- bare正本より後に内部prefix summaryが出る誤順序でも、bare正本を優先する。途中summaryに非ゼロFAILがあれば、後続の成功summaryで消さずmaster FAILを維持する。
- 異なるsuite名の複数prefix＋最終bare正本、raw最終335/1、bareなしの最終prefix正本、誤順序、FAIL非上書きのfixtureを追加した。Retry 1で直した単一prefix、validator、FAIL／signal／timeout／assertなし／required未実行も同じ専用suiteで再確認した。

## 回帰結果

| コマンド | 結果 |
|---|---|
| `node scripts/sprint-026-release-gate-test.mjs` | `SPRINT026_GATE_PASS=21 SPRINT026_GATE_FAIL=0` |
| `bash scripts/sprint-026-regression.sh` | `SPRINT026_PASS=3 SPRINT026_FAIL=0` |
| `python3 scripts/check-release-integrity.py --root .` | `PASS release integrity: manifests and CHANGELOG are consistent` |

専用fixtureでは、意図的FAIL、signal終了、timeout、assertなし、未実行の集約がすべて非ゼロ・明示状態になること、単一prefix付きsummaryの正負、複数prefixと最終正本summaryの選択、誤順序、FAIL非上書き、homepage／repository不正archiveのvalidator拒否、明示allowlistで作成した配布fixtureのarchive gateを確認した。

## 使い方

```bash
bash scripts/master-release-gate.sh --mode offline
bash scripts/master-release-gate.sh --mode online
bash scripts/master-release-gate.sh --mode archive --root /path/to/git-archive
```

`--json /path/to/report.json` を指定すると、suite inventoryと合計結果をJSONで保存できる。archiveのGit履歴専用項目は `status: excluded` と理由を持つため、未実行のrequired suiteをPASSへ偽装せず、配布可否の自動判定へ誤って加算されない。通常のrequired suiteの未実行は `status: skipped` となり、非ゼロで停止する。

## 既知の制約

- 実GitHub API／Secret／Actions dispatch／remote pushは行っていない。`online` は既存masterのonline検査へ委譲し、実live gateはSprint 028の責務とする。
- archiveではGit履歴・migration・loopback動的検査を実行せず、配布物の静的検査、正式release validator、archive互換検査と、Git不要のSprint 015だけを実行する。対応するcheckout側suiteの結果を代用しない。
- Retry 2では、禁止対象を含み得る実repo全体のmaster offline／onlineは実行していない。専用fixture、wrapper、validatorでF3と既存異常系を確認し、全体gateの独立再評価はEvaluatorへ引き渡す。
- state、spec、contract、feedbackは変更していない。
- Retry 2の実外部サービス書込み、secret利用、`docs/evidence`および明示禁止pathのmaterialize・列挙・読取・変更・stageは0件。

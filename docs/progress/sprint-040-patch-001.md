# Sprint 040 Patch 001 — Generator handoff

## 実装結果

開発projectからHarnessへ進む案内だけを修正した。既存の `projects-harness` anchorを
`plugins/secretary/skills/projects/SKILL.md` の宣言済みYasashii差分として接続し、実sourceへ適用した。

- Claude Code: `harness@yasashii-harness` の `/harness`
- Codex: `harness@yasashii-harness` の `$using-harness` または `$harness-loop`
- 対象導線のAgentic版ID: 0件

repo／remoteを変更しないproject pointer境界、`edition.json`、他Skill、Sprint 040のmemory挙動は変更していない。

## 変更path

- `plugins/secretary/skills/projects/SKILL.md`
- `secretary-overlay/mapping.json`
- `secretary-overlay/upstream-tree.json`
- `secretary-overlay/downstream-files.json`
- `scripts/sprint-040-patch-001-test.mjs`
- `docs/progress/sprint-040-patch-001.md`

## 自動回帰

| command | 結果 |
|---|---|
| `node scripts/sprint-040-patch-001-test.mjs` | 4 PASS / 0 FAIL |
| `node scripts/sprint-035-test.mjs` | 15 PASS / 0 FAIL |
| `node scripts/sync-secretary-overlay.mjs --check --candidate /private/tmp/yas-s040-p001-agentic.xftKqJ --observed-commit 9acea13477cd7730bf064a32c170b752586fa116` | PASS、managed 290 |
| `node scripts/sync-secretary-overlay.mjs --reapply --candidate /private/tmp/yas-s040-p001-agentic.xftKqJ --observed-commit 9acea13477cd7730bf064a32c170b752586fa116` | PASS、`secondChanged=0` |
| `git diff --check` | PASS |

candidateは `secretary-overlay/upstream-tree.json` の宣言pathだけを固定base
`9acea13477cd7730bf064a32c170b752586fa116` から展開した読み取り用treeである。

## Evaluator確認シナリオ

1. projects Skillの該当案内にYasashii IDとhost別entryが揃い、Agentic版IDが残らない。
2. `projects-harness` が一意で、対象pathがmappingとupstream-treeの両方で `anchor-overlay` になる。
3. overlay checkとreapplyが成功し、二回目変更0件になる。
4. Patch専用検査、Sprint 035回帰、`git diff --check` が0 FAILになる。

## 起動・残課題

常駐アプリとtest URLはない。上記Node.js検査をrepo rootで実行する。

製品上の既知残課題はない。fresh独立Evaluatorの判定とOrchestratorのstate更新は未実施である。
README、CHANGELOG、version、release metadata、cache、利用者workspace、Mac mini、remote、外部serviceは変更せず、
commit、push、releaseも実行していない。

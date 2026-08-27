# Sprint 040 Patch 001 — project導線のYasashii Harness ID回帰修正

- Type: micro
- Base Sprint: sprint-040（合格済み）
- Risk: standard（利用者向け案内と既存overlay分類だけを修正し、実行処理・安全境界・配布metadataは変更しない）
- UI: なし

## なぜType: microか

- 変更は、別repoを正本にする開発projectからHarnessへ進む1つの案内フローに閉じる。
- `scripts/sprint-035-test.mjs` と既存overlay検査が、edition別Harness IDとproject導線をすでに自動回帰している。
- 新機能や新しい配布面は追加しないため、機能完全性・動作安定性・回帰なしだけの軽量評価で足りる。

## 背景

`plugins/secretary/skills/projects/SKILL.md` は `edition.json` のhost別設定へ従うと説明している一方、
直後の利用者向け案内にはAgentic版のClaude Code／Codex IDが残っている。

既存のoverlay anchor `projects-harness` は正しいYasashii版の文面を宣言済みだが、対象Skillが
anchor overlayとして分類されていないため、同期後の実sourceへ適用されていない。

## 外から見える成果

別repoを正本にする開発projectの利用者は、Claude CodeとCodexのどちらでも
`harness@yasashii-harness` を案内される。Agentic版のIDへ誤誘導されず、以後のoverlay同期でも
このYasashii固有案内が維持される。

## Scope

- `plugins/secretary/skills/projects/SKILL.md` の開発project導線で、Claude CodeとCodexの両方に
  Yasashii Harnessのinstall ID `harness@yasashii-harness` を示す。
- Claude Codeの入口 `/harness` と、Codexの入口 `$using-harness`／`$harness-loop` は維持する。
- 既存anchor `projects-harness` を対象Skillの宣言済みYasashii差分として実際に適用できる分類へ接続する。
- overlayの記録と実sourceを整合させ、同じupstream candidateへのcheck／reapplyで案内がAgentic版へ戻らないようにする。
- 既存Sprint 035回帰で、`edition.json` のhost別IDとprojects Skillの実案内が一致することを保護する。

## Non-scope

- 新しいHarness機能、project管理機能、host判定、実行処理、install／update処理の追加・変更。
- `edition.json`、Harness version、repository、manifest、marketplace、README、CHANGELOG、release metadataの変更。
- Sprint 040のmemory authorization、会話schema、memory／journal／checkpoint、他Skillの変更。
- Agentic版、private my-vault版、installed plugin／cache、利用者workspace、Mac miniへの反映。
- branch push、PR、merge、tag、GitHub Release、marketplace公開、外部service操作。
- 新しいcollector、統一attestation、追加の証拠schema。

## Acceptance Criteria（micro軽量評価）

1. **機能完全性**: projects Skillの開発project導線が、Claude CodeとCodexの両方に
   `harness@yasashii-harness` を示し、Claude Codeは `/harness`、Codexは
   `$using-harness`／`$harness-loop` へ案内する。対象導線に
   `harness@agentic-harness` と `harness@agentic-harness-local` が残らない。
2. **動作安定性**: `edition.json` のYasashii Harness host別設定とprojects Skillの案内が一致し、
   既存のproject pointer作成、別repo正本の保持、repo／remoteを変更しない境界に変化がない。
3. **overlay安定性**: `projects-harness` が対象Skillの宣言済みanchor overlayとして一意に適用され、
   overlay記録も同じ分類を表す。checkが成功し、同じcandidateへのreapplyで追加差分0件、
   Agentic版IDの再混入0件となる。
4. **無回帰（ゼロ許容）**: Patch専用検査、`node scripts/sprint-035-test.mjs`、overlay検査、
   `git diff --check` が0 FAILである。Yasashii固有identity、他Skill、release metadata、
   Sprint 040のmemory挙動に変更がない。
5. fresh独立Evaluatorが同一candidateを機能完全性5/5、動作安定性5/5、回帰なし5/5で採点し、
   product findingとblocking verification-infra findingが0件である。

## Evidence safe harbor

- 対象candidate、変更path、projects Skillの該当案内、`edition.json` のClaude Code／Codex install ID。
- `projects-harness` のanchor出現回数・適用回数と、対象pathのoverlay分類。
- overlay check／reapplyのcommand、exit code、二回目追加差分0件、Agentic版ID残存0件。
- Patch専用検査、Sprint 035回帰、`git diff --check` のcommand、exit code、PASS／FAIL集計。
- release、cache、workspace、Mac mini、remote、外部serviceのwriteがnot-runである記録。

上記で十分とし、既存の評価閾値を強めず、新しいcollector、統一attestation、実host install、
live cache、新session、browser操作、screenshotを追加の合格条件にしない。

## 完了条件

Generatorは本Patchだけを実装し、`docs/progress/sprint-040-patch-001.md` に変更path、実行command、
回帰結果、外部操作not-runを記録する。Evaluatorは別作業単位で同じcandidateを評価し、
`docs/feedback/sprint-040-patch-001.md` に軽量3項目の採点と証拠を書く。

Evaluator PASSとOrchestratorによる `docs/sprints/state.md` 更新前に完了扱いにしない。

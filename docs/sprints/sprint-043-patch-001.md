# Sprint 043 Patch 001 — Claude標準Hookの二重宣言を解消する

- Type: micro
- Base Sprint: sprint-043（合格済み）
- Risk: standard（host別manifestの1項目と、その誤った回帰assertionだけを修正する）
- UI: なし

## なぜType: microか

- 変更はYasashii SecretaryのHook読込という1つの機能面・1つの導入フローに閉じる。
- Sprint 042／043のHook、manifest、Project Clarity、overlay回帰がすでに存在する。
- Hook本体、Clarity挙動、copy、overlay、protected surfaceは変更しないため、機能完全性・動作安定性・回帰なしだけの軽量評価で足りる。

## 背景

private版をClaude Code 2.1.232へ実際に導入したところ、標準pathの`hooks/hooks.json`が自動読込される一方で、
`.claude-plugin/plugin.json`の`hooks`も同じfileを宣言していたため、`Hook load failed: Duplicate hooks file detected`となった。
private版でClaude manifestから`hooks`だけを除くと、同じ実導入でエラーが解消した。

これは共通のClaude manifest契約を見直すtriggerであり、Yasashii版の実host live PASS証拠ではない。
Yasashiiではhost別manifestの差だけを正し、Sprint 043のPASS、feedback、source receiptは履歴として不変に保つ。

## 外から見える成果

Yasashii SecretaryをClaude Codeへ導入したとき、標準`hooks/hooks.json`をmanifestから二重に宣言しない。
Codexでは従来どおりmanifestから共通Hookを参照でき、Hook／Project Clarityの意味とYasashii固有体験は変わらない。

## Scope

- `plugins/secretary/.claude-plugin/plugin.json`から、Claude Codeが標準pathとして自動読込する
  `hooks: "./hooks/hooks.json"`の重複宣言だけを除く。
- `plugins/secretary/.codex-plugin/plugin.json`は`hooks: "./hooks/hooks.json"`を維持する。
- `plugins/secretary/hooks/hooks.json`と共通router、Hook event、no-op／degraded境界、Project Clarityの
  command-only behaviorを変更しない。
- Sprint 043回帰の`PK-001`を含め、Claude manifestの`hooks`キーを必須とする現行assertionだけを、
  「Claudeはキーを持たない／Codexは共通Hookを参照する」というhost別契約へ更新する。
- Yasashii固有copy、style、identity、edition、overlay分類・冪等性、protected surfaceを維持する。

## Non-scope

- Hook event、command、router、payload正規化、Clarity状態・Evidence・Attention・Drift、他Skillの変更。
- `plugins/secretary/hooks/hooks.json`の移動、削除、複製、内容変更。
- Yasashii固有copy／style／identity、edition metadata、overlay定義、protected surfaceの再分類・変更。
- Agentic版、private my-vault版のsource変更、private版で得た実機証拠のYasashii PASSへの流用。
- version、CHANGELOG、release metadata、push、PR、merge、tag、GitHub Release、Marketplace公開／refresh。
- installed plugin／cache、install、update、new session、loaded version、利用者workspace migration、Mac miniへの反映。
- Sprint 043のfeedback、source receipt、PASS判定、履歴artifactの変更・再生成。
- 新しいcollector、統一attestation、追加の証拠schema。

## Acceptance Criteria（micro軽量評価）

1. **機能完全性**: YasashiiのClaude manifestは有効なJSONと既存identity／version／skillsを維持し、
   `hooks`キーを持たない。Codex manifestは`hooks: "./hooks/hooks.json"`を維持する。
2. **動作安定性**: `plugins/secretary/hooks/hooks.json`と共通routerのbytes／modeが変更されず、
   SessionStart、PostToolUse、PreCompact、compact後再開、Stop、SessionEnd、未初期化／未linked no-op、
   disabled／trust未承認のdegraded表示を含む既存Hook／Clarity回帰が0 FAILである。
3. **Yasashii境界**: copy、style、identity、edition、overlay、protected surfaceに許可外差分がなく、
   overlay check／reapplyが成功し、同じcandidateへの二回目適用で追加差分0件となる。
4. **回帰更新**: `PK-001`を含むmanifest assertionがhost別契約を検査し、Claude側へ
   `hooks`キーを再要求しない。Codex側のHook参照欠落をPASSにしない。
5. **無回帰（ゼロ許容）**: manifest validation、Patch対象回帰、既存Hook／Project Clarity回帰、
   parity／overlay検査、`git diff --check`が0 FAILである。Sprint 043のfeedback／receipt／履歴artifactに差分がない。
6. fresh独立Evaluatorが同一candidateを機能完全性5/5、動作安定性5/5、回帰なし5/5で採点し、
   product findingとblocking verification-infra findingが0件である。

## Evidence safe harbor

- 変更前後のClaude／Codex manifest、JSON validation、host別`hooks`キーの有無と値。
- 変更path一覧と`plugins/secretary/hooks/hooks.json`／共通routerのbytes／mode不変確認。
- Patch対象回帰、既存Hook／Project Clarity回帰のcommand、exit code、PASS／FAIL集計。
- parity／overlay check／reapplyのcommand、exit code、許可外差分0件、二回目追加差分0件、
  Yasashii copy／overlay／protected surface不変の結果。
- Sprint 043 feedback／source receiptに差分がないことと、release、Marketplace、cache、install、
  new session、workspace migration、実Yasashii host liveがnot-runである記録。
- private版のClaude Code 2.1.232実導入結果は共通契約のtriggerとしてのみ記録し、
  Yasashii版のhost live PASS集計には含めない。

上記で十分とし、新しい統一attestation、release／Marketplace／cache／install確認、
実Yasashii host、新session、利用者workspace操作を追加の合格条件にしない。

## 完了条件

Generatorは本Patchだけを実装し、`docs/progress/sprint-043-patch-001.md`に変更path、manifest差分、
回帰command／結果、外部操作not-runを記録する。Evaluatorは別作業単位で同じcandidateを軽量3項目で評価し、
`docs/feedback/sprint-043-patch-001.md`へ証拠と判定を書く。

Evaluator PASSとOrchestratorによる`docs/sprints/state.md`更新前に完了扱いにしない。

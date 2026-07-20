# Sprint 030 — edition設定と反対editionの安全停止

- Type: main
- Risk: high（更新・workspace識別の書込み前gate）
- 主眼: edition設定、neutral marker、legacy認識、edition付きledgerを導入し、反対edition／混在／不明を副作用0件で止める。
- 依存: sprint-029 done。

## 外から見える成果

既存yasashii利用者はそのまま利用できる。異なるeditionを同じworkspaceへ導入・更新しようとした場合、何を検出したかを説明して安全に停止する。

## Scope

- 配布ID、repository、URL、ledger、session directory、保護commit prefix、Harness、4面copyのEditionConfig。
- 新規workspaceのneutral markerとedition値、update ledgerの `schemaVersion`／`edition`。
- legacy yasashii marker／旧ledgerの互換読取。
- onboarding、diagnose、update、migrationの全書込み前にeditionを判定する共通guard。
- 新規生成bot名の第一候補を `secretary[bot]` にし、既存bot／workflowを変更しない。

## Non-scope

- edition switching、co-install、反対editionデータの移動・統合・削除。
- plugin内部path移動、agentic repo作成、wizard差分。

## 受入基準

1. `new`、`same-edition`、`legacy-yasashii`、`opposite-edition`、`mixed`、`unknown` の状態が `domain.md` と一致する。
2. `opposite-edition`、`mixed`、`unknown` はledger、marker、履歴、設定、Git、pluginをbyte単位で変更せず停止する。
3. legacy yasashiiは一意に判定できる場合だけ読め、診断結果にlegacy状態と予定migrationを明示する。
4. edition設定に欠落・未知値がある場合、暗黙にyasashiiへfallbackしない。
5. 新規workspaceだけがneutral markerと `secretary[bot]` を使い、既存workspaceのbot名・schedule・履歴は不変。
6. 既存更新、rollback、両wizard、全安全回帰が0 FAIL。

## 回帰保護

- 6状態×onboarding／diagnose／update／migrationのfixtureを実Git repoで実行する。
- 副作用前後のfile digest、Git index、worktree、ledger、markerを比較する。
- 0.6.0／0.7.0既存fixtureとChatwork／Google Chat workflowを再実行する。

## 手動・browser証跡

- 反対edition、混在、不明の3会話で、検出edition、停止理由、未実行操作が正しく表示されることを確認する。
- wizardは両edition用fixtureで同一DOM／copy／OAuth scopeのままであることをdesktop／mobileで記録する。

## External live gate

合成fixtureと一時local repoだけを使う。実workspaceへの導入、remote変更、push、実plugin updateは行わない。必要なら対象と副作用を示し、操作ごとの明示許可を得るまで停止する。

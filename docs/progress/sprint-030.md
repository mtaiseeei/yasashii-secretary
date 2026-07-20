# Sprint 030 — edition設定と反対editionの安全停止

**ステータス:** 実装完了・評価待ち

## 実装したこと

- `edition.json` をedition設定の正本として追加し、配布ID、repository、URL、ledger、session directory、保護commit prefix、Harness、4面copy、新規bot identityを宣言した。
- 共通のedition guardを追加し、workspaceを `new`、`same-edition`、`legacy-yasashii`、`opposite-edition`、`mixed`、`unknown` の6状態へ分類するようにした。
- onboarding、diagnose、update、migrationの4入口について、書込み前の許可条件を一か所へ集約した。診断は常にread-only、onboardingはnewだけ、update／migrationはsame-editionまたは一意なlegacy yasashiiだけを許可する。
- neutral markerを `.secretary/workspace-edition.json`、新しいledgerを `.secretary/update-ledger.json` とし、ledgerへ `schemaVersion: 2` と `edition` を持たせた。
- 旧 `.yasashii-secretary/update-ledger.json` と旧AGENTS／CLAUDE markerを互換読取し、旧file自体は書き換えないようにした。診断ではlegacy状態と予定migrationを表示する。
- `opposite-edition`、`mixed`、`unknown` の停止文に、検出edition、対象workspace、導入しようとしたedition、未実行操作、切替／削除をしないことを含めた。
- 更新のstart／retry／resume／rollbackとledger記録をedition guardの後ろへ置き、停止時にsession、ledger、marker、履歴、設定、Git、pluginを変更しないようにした。
- 新規生成workflowのGit identityを `secretary[bot]` へ変更した。既存workflowにbot名とemailがある場合は抽出して維持し、設定変更で置換しないようにした。
- 6状態×4入口を実際の一時Git repoで通す専用回帰を追加した。危険3状態では全file digest、Git index、worktree、log／history、ledger、marker、設定、plugin directoryを前後比較する。
- Sprint 030専用回帰をcheckoutと `.git` なし配布archiveのrelease gateへ登録した。

## 主な変更ファイル

- `plugins/yasashii-secretary/edition.json`
- `plugins/yasashii-secretary/scripts/lib/edition-guard.mjs`
- `plugins/yasashii-secretary/scripts/edition-guard.mjs`
- `plugins/yasashii-secretary/scripts/update-diagnose.mjs`
- `plugins/yasashii-secretary/scripts/update-apply.mjs`
- `plugins/yasashii-secretary/scripts/update-ledger.mjs`
- `plugins/yasashii-secretary/scripts/workspace-repo.mjs`
- `plugins/yasashii-secretary/skills/onboarding/SKILL.md`
- `plugins/yasashii-secretary/skills/update/SKILL.md`
- `plugins/yasashii-secretary/skills/chatwork/scripts/schedule.mjs`
- `plugins/yasashii-secretary/skills/chatwork/scripts/config-transaction.mjs`
- `plugins/yasashii-secretary/skills/google-chat/scripts/schedule.mjs`
- `plugins/yasashii-secretary/skills/google-chat/scripts/config-transaction.mjs`
- `scripts/sprint-030-edition-guard-test.mjs`
- `scripts/sprint-030-update-config-test.mjs`
- `scripts/sprint-030-regression.sh`
- `scripts/sprint-017-regression.sh`
- `scripts/master-release-gate.mjs`

## 回帰結果

| コマンド | 結果 |
|---|---|
| `env TMPDIR=/private/tmp node scripts/sprint-030-edition-guard-test.mjs` | `SPRINT030_PASS=54 SPRINT030_FAIL=0` |
| `env TMPDIR=/private/tmp bash scripts/sprint-030-regression.sh` | `SPRINT030_PASS=6 SPRINT030_FAIL=0` |
| `bash scripts/sprint-029-regression.sh` | `SPRINT029_PASS=4 SPRINT029_FAIL=0` |
| `bash scripts/sprint-017-regression.sh` | `SPRINT017_PASS=33 SPRINT017_FAIL=0` |
| `bash scripts/sprint-018-regression.sh` | `SPRINT018_PASS=41 SPRINT018_FAIL=0` |
| `bash scripts/sprint-020-regression.sh` | `SPRINT020_PASS=50 SPRINT020_FAIL=0`、adversarial `16/0`、wrapper `16/0` |
| `bash scripts/sprint-025-regression.sh` | `SPRINT025_PASS=25 SPRINT025_FAIL=0` |
| `bash scripts/sprint-027-regression.sh` | `SPRINT027_PASS=5 SPRINT027_FAIL=0` |
| `.git`なしfixtureで `bash scripts/sprint-026-regression.sh` | `SPRINT026_PASS=3 SPRINT026_FAIL=0` |
| `env TMPDIR=/private/tmp bash scripts/master-release-gate.sh --mode offline --timeout-ms 600000` | `RELEASE_GATE mode=offline status=pass`、6 suite、`429 PASS / 0 FAIL`。内包する全回帰は `339 PASS / 0 FAIL` |
| `git diff --check` | PASS |

macOSでは `/var/folders` と `/private/var/folders` が同じ場所を別表記にするため、path guardを含む固有回帰とmaster検査は `TMPDIR=/private/tmp` を指定した。指定なしの一度の試行はこのpath表記差で一時workspaceを拒否し、製品書込み前に停止した。localhost待受を使うwizard回帰はSandbox外の許可環境で実行した。外部network、実API、remoteへの接続は行っていない。

## 自己評価

| 観点 | 評価 | 根拠 |
|---|---:|---|
| 完成度 | 5/5 | 宣言設定、6状態guard、4入口、neutral marker、edition付きledger、legacy互換、bot identityまで受入条件を実装した |
| 安定性 | 5/5 | 実Git repoの状態行列と既存更新／wizard／安全回帰を0 FAILで通した |
| 設計 | 5/5 | edition判定と入口別許可条件を共通moduleへ集約し、各書込み処理の前に配置した |
| 独自性 | 4/5 | edition追加へ使える宣言構造だが、本Sprintではyasashiiの安全な分離準備に限定した |
| エラー処理 | 5/5 | 反対edition、混在、不明、設定欠落、未知edition、symlinkを暗黙fallbackせず停止する |
| 非回帰 | 5/5 | 停止時のbyte／Git状態比較と既存update、rollback、Chatwork、Google Chat回帰を重ねた |

## 技術上の判断

- neutral markerはonboardingの生成処理より先に、workspaceが完全にnewと判定できた場合だけ作る。以後の生成物が別editionへ誤認されないため。
- 新しいledgerはedition付きobjectだけを書き、旧yasashii ledgerのarrayは互換読取だけにした。予定migrationを診断で明示しつつ、旧fileを黙って変えないため。
- 設定欠落や未知値ではyasashiiを既定値にしない。EditionConfigを読めない状態そのものを安全停止として扱うため。
- 既存workflowのbot identityは、既知の生成形式からnameとemailの両方を安全に読めた場合だけ維持する。片方だけ、または予期しない形式なら値を推測しない。
- edition switching、反対editionの移動・統合・削除は実装していない。guardは説明して止まるだけに限定した。

## 起動方法・テストURL

Sprint 030はedition判定と更新境界の変更であり、新しい常設serverや画面はない。固有のテストURLはN/A。

既存wizardの目視確認が必要な場合は、次の合成fixtureを利用できる。

- Chatwork: `bash scripts/start-sprint-014-wizard-fixture.sh 18784` → `http://127.0.0.1:18784/`
- Google Chat初回: `node scripts/start-sprint-020-patch-001-google-chat-fixture.mjs 18783` → `http://127.0.0.1:18783/`
- Google Chat設定変更: `node scripts/start-sprint-020-wizard-fixture.mjs 18782` → `http://127.0.0.1:18782/`

## Evaluatorへの確認事項

1. `bash scripts/sprint-030-regression.sh` を実行し、6状態×4入口、危険3状態の副作用0件、設定不正、新旧bot identityが0 FAILであること。
2. `opposite-edition`、`mixed`、`unknown` の各診断を会話として確認し、検出edition、停止理由、未実行操作、切替／削除をしない説明が揃うこと。
3. `legacy-yasashii` が旧ledgerまたは旧markerを一意に読んだ場合だけ成立し、診断へlegacy状態と予定migrationが出ること。旧fileがbyte単位で不変であること。
4. updateのstart／retry／resume／rollbackが危険状態でsessionやledgerへ触れる前に止まり、Git index、worktree、historyも不変であること。
5. 新規workflowだけが `secretary[bot]` を使い、既存Chatwork／Google Chat workflowのbot名、schedule、履歴が設定変更後も維持されること。
6. 両wizardをdesktop、390px mobile、200%相当で開き、Sprint 029からDOM、copy、OAuth scope、操作順が変わっていないこと。UI採点時はスクリーンショットを証跡へ残すこと。
7. `TMPDIR=/private/tmp` とlocalhost待受が使える環境でmaster offline、`.git`なしfixtureでarchive modeを再実行し、0 FAILを確認すること。

## 対象外・既知事項

- agentic edition本体、edition selector、edition switching、co-install、反対editionデータの移動・統合・削除は実装していない。
- legacy workspaceは本Sprintで自動migrationせず、診断に予定だけを出す。実migrationの実行契約は後続Sprintの対象。
- 実Chatwork／Google API、実Google OAuth、Repository Secret、GitHub Actions dispatch、remote push、実plugin updateは実行していない。
- `docs/evidence`配下には接触していない。実ブラウザの会話証跡とスクリーンショット取得はEvaluatorへ引き渡す。
- Planner／Orchestrator／Evaluator所有のspec、Sprint契約、`docs/sprints/state.md`、`docs/feedback`は変更していない。
- git add、commit、pushは0件。
- runtime targetはstate上strong tier／model-availabilityだが、子host metadataで実起動model／effortを確認できないためlaunchは`unverified`。

## Retry 1 — 更新実行経路のEditionConfig正本化

Evaluatorが検出したimplementation issueに対し、`update-apply.mjs`に残っていたyasashii固定値を除去した。更新のstart、retry、resume、rollbackは、対象plugin rootの`edition.json`から次の値を読み、同じ値を診断、session、ledger、plugin command、保護commit、rollbackへ一貫して渡す。

- `distribution.pluginId`
- `distribution.marketplaceId`
- `update.ledgerPath`
- `update.legacyLedgerPaths`
- `update.sessionDirectory`
- `update.protectionCommitPrefix`

canonical ledgerは`schemaVersion: 2`、対象`edition`、`records`だけを持つobjectとして検証・書込みする。legacy ledgerのarrayは互換読取だけに限定し、legacy pathへ新規書込みを行わない。sessionにはeditionとplugin IDを記録し、現在の設定と一致しないsessionを再開しない。設定されたsession directoryまたはsession fileがsymlink／通常でない種類の場合は、外部参照先へ触れる前に停止する。

独立した反対設定fixtureを追加した。fixtureはyasashiiの既定値と異なるplugin ID、marketplace ID、ledger path、legacy ledger path、session directory、保護commit prefixを宣言し、start／retry／resume／rollbackとschema v2 ledger、legacy非書込み、設定矛盾、安全でないsession directoryを動的に確認する。一時fixtureは`/private/tmp`だけに作り、検査終了時に削除した。

### Retry 1変更ファイル

- `plugins/yasashii-secretary/scripts/update-apply.mjs`
- `plugins/yasashii-secretary/scripts/lib/edition-guard.mjs`
- `scripts/sprint-030-update-config-test.mjs`
- `scripts/sprint-030-regression.sh`
- `scripts/sprint-018-regression.sh`
- `scripts/sprint-025-regression.sh`
- `docs/progress/sprint-030.md`

### Retry 1回帰結果

| コマンド | 結果 |
|---|---|
| `env TMPDIR=/private/tmp node scripts/sprint-030-update-config-test.mjs` | `SPRINT030_UPDATE_CONFIG_PASS=10 SPRINT030_UPDATE_CONFIG_FAIL=0` |
| `env TMPDIR=/private/tmp bash scripts/sprint-030-regression.sh` | edition guard `54/0`、反対設定fixture `10/0`、wrapper `7/0` |
| `env TMPDIR=/private/tmp bash scripts/sprint-018-regression.sh` | `SPRINT018_PASS=41 SPRINT018_FAIL=0` |
| `env TMPDIR=/private/tmp bash scripts/sprint-025-regression.sh` | `SPRINT025_PASS=25 SPRINT025_FAIL=0` |
| `env TMPDIR=/private/tmp bash scripts/regression-check.sh --offline` | exit 0 |
| `env TMPDIR=/private/tmp bash scripts/master-release-gate.sh --mode offline --timeout-ms 600000` | `RELEASE_GATE mode=offline status=pass suites=6 required=6 passed=6 failed=0 skipped=0 assertions=430 pass=430 fail=0`。内包回帰は`339 PASS / 0 FAIL` |
| `.git`なしfixtureで `env TMPDIR=/private/tmp node scripts/master-release-gate.mjs --mode archive --root <fixture>` | `RELEASE_GATE mode=archive status=pass suites=1 required=1 passed=1 failed=0 skipped=0 assertions=92 pass=92 fail=0` |
| `git diff --check` | PASS |

正式offline release gateはlocalhost待受が許可された環境で実行した。検査内のpushは`/private/tmp`のlocal bare remoteだけを対象とし、実remote、実API、OAuth、Repository Secret、GitHub Actions、実plugin update、公開操作は0件。git add、commit、pushもこのrepositoryでは0件。

### Retry 1で未検証の項目

- UI、responsive、200%表示の目視とスクリーンショットはRetry 1の変更対象外であり、Generatorでは再取得していない。既存wizard DOM／copy回帰は正式offline release gate内で0 FAIL。
- `--online` release gateは実行していない。公開remoteの確認はEvaluatorのonline検証へ引き渡す。
- runtime targetはstate上strong tierだが、子host metadataで実起動model／effortを確認できないためlaunchは引き続き`unverified`。

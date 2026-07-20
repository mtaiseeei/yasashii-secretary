# Sprint 029 — edition分離準備: rule境界と可変copy集約

**ステータス:** 実装完了・評価待ち

## 実装したこと

- `rules/plain-language.md` を既存skillからの互換入口として残し、安全、証拠、共通表現、yasashii styleを別ruleへ分離した。
- `rule-manifest.json` にruleのowner、依存、優先順位、保護属性、edition styleからの上書き禁止項目を宣言した。
- editionで変更できるcopyを `copy/yasashii.json` の会話、診断、報告、developer handoffの4面だけへ集約した。
- Sprint着手前のyasashii copyをbaseline fixtureへ固定し、意味と順序が変わっていないことを機械比較できるようにした。
- Chatwork／Google Chat wizardの主要5 assetをSHA-256で固定し、copyとDOMの変更を検出するようにした。既存wizard file自体は変更していない。
- rule欠落、循環、styleから安全・証拠・確認・push・secret境界への上書き、4面外copy、wizard copy混入を拒否する負fixtureを追加した。
- 通常報告schemaの唯一のownerを `rules/styles/yasashii.md` へ移し、既存の20参照面は互換入口を経由する形へ更新した。
- Sprint 029専用回帰をcheckoutと`.git`なし配布archiveの両方で実行できるようにし、master release gateへ登録した。
- 既存Harness v0.4.2の完全一致文言を見ていた2つのstale testを、現行v0.4.5の同じ安全条件を検査する表現へ限定更新した。`AGENTS.md`と`docs/harness-guidance.md`本文は変更していない。

## 主な変更ファイル

- `plugins/yasashii-secretary/rules/plain-language.md`
- `plugins/yasashii-secretary/rules/rule-manifest.json`
- `plugins/yasashii-secretary/rules/safety.md`
- `plugins/yasashii-secretary/rules/evidence.md`
- `plugins/yasashii-secretary/rules/common-language.md`
- `plugins/yasashii-secretary/rules/styles/yasashii.md`
- `plugins/yasashii-secretary/rules/copy/yasashii.json`
- `scripts/fixtures/sprint-029/yasashii-copy-baseline.json`
- `scripts/sprint-029-rule-boundary-test.mjs`
- `scripts/sprint-029-regression.sh`
- `scripts/check-report-schema.py`
- `scripts/regression-check.sh`
- `scripts/master-release-gate.mjs`
- `scripts/sprint-010-regression.sh`
- `scripts/sprint-011-regression.sh`

## 回帰結果

| コマンド | 結果 |
|---|---|
| `node scripts/sprint-029-rule-boundary-test.mjs` | `SPRINT029_RULE_PASS=25 SPRINT029_RULE_FAIL=0 WIZARD_DIGESTS=5` |
| `bash scripts/sprint-029-regression.sh` | `SPRINT029_PASS=4 SPRINT029_FAIL=0` |
| `bash scripts/sprint-010-regression.sh` | `PASS=56 FAIL=0` |
| `bash scripts/sprint-011-regression.sh` | `PASS=68 FAIL=0` |
| `env TMPDIR=/private/tmp bash scripts/master-release-gate.sh --mode offline --timeout-ms 600000` | `RELEASE_GATE mode=offline status=pass`、5 suite、`423 PASS / 0 FAIL`。内包する全回帰は `339 PASS / 0 FAIL` |
| `.git`なしfixtureで `env TMPDIR=/private/tmp node scripts/master-release-gate.mjs --mode archive --root <fixture> --timeout-ms 120000` | `RELEASE_GATE mode=archive status=pass`、4 required suite、`84 PASS / 0 FAIL` |
| `env TMPDIR=/private/tmp bash scripts/sprint-026-regression.sh` | `SPRINT026_PASS=3 SPRINT026_FAIL=0` |
| `git diff --check` | PASS |

macOSでは `/var/folders` と `/private/var/folders` が同じ場所を別表記にするため、path guardを含むmaster／archive検査は `TMPDIR=/private/tmp` を指定した。localhostのloopback wizard回帰は、Sandbox外の許可環境で実行した。

## 自己評価

| 観点 | 評価 | 根拠 |
|---|---:|---|
| 完成度 | 5/5 | rule分離、4面copy、manifest、負fixture、checkout／archive gateまで受入条件を実装した |
| 安定性 | 5/5 | master offline 423件、archive 84件、既存Sprint 010／011を0 FAILで完走した |
| 設計 | 5/5 | 安全・証拠をcommon core、口調をedition overlayとして依存と優先順位を宣言した |
| 独自性 | 4/5 | 将来edition追加に使える宣言的境界だが、本Sprintではyasashii現状維持を優先した |
| エラー処理 | 5/5 | 欠落、循環、禁止override、4面外copy、wizard混入を意図的に壊したfixtureで拒否する |
| 非回帰 | 5/5 | yasashii copy baselineのdeep comparisonとwizard asset全体digestを既存inventoryに重ねた |

## 技術上の判断

- `plain-language.md` を削除せず互換入口にした。既存20面の参照先を一度に変えず、ruleの正本だけを分離できるため。
- copyは実行ロジックへ埋め込まずJSONへ置いた。ただしedition可変範囲は4面に限定し、wizard、OAuth、同期、安全確認は含めていない。
- checkoutでは既存wizard copy inventoryを実行し、開発用`docs/progress`を含まない配布archiveでは着手前に固定したasset全体digestを使う。archiveで検査を省略せず、配布物だけで完結させるため。
- 旧Harness検査の失敗は本文不足ではなく完全一致文言の古さだったため、AGENTS／guidanceを上書きせずテスト期待値だけを現行語へ合わせた。

## 起動方法・テストURL

Sprint 029はruleとcopyの境界変更であり、新しい常設serverや画面はない。固有のテストURLはN/A。

既存wizardの目視確認が必要な場合は、次の合成fixtureを利用できる。

- Chatwork: `bash scripts/start-sprint-014-wizard-fixture.sh 18784` → `http://127.0.0.1:18784/`
- Google Chat初回: `node scripts/start-sprint-020-patch-001-google-chat-fixture.mjs 18783` → `http://127.0.0.1:18783/`
- Google Chat設定変更: `node scripts/start-sprint-020-wizard-fixture.mjs 18782` → `http://127.0.0.1:18782/`

## Evaluatorへの確認事項

1. `bash scripts/sprint-029-regression.sh` を実行し、rule graph、4面copy、禁止override負fixture、wizard digestが0 FAILであること。
2. `rule-manifest.json` でcommon coreの安全・証拠・共通表現がprotected、yasashii styleがoverlayであり、styleからのoverrideが空であること。
3. `copy/yasashii.json` が会話、診断、報告、developer handoffの4面だけで、wizard、OAuth、schedule、room／space copyを含まないこと。
4. 既存yasashiiの決定確認、案件メモ確認、3行／4行報告、未確認診断の文言と順序がbaselineどおりであること。
5. Chatwork／Google Chat wizardの主要画面をdesktop、390px mobile、200%相当で開き、Sprint 029前からcopy、DOM、操作順が変わっていないこと。UIを採点する場合はスクリーンショットを証跡へ残すこと。
6. `TMPDIR=/private/tmp` とlocalhost待受が使える環境でmaster offline、`.git`なしfixtureでarchive modeを再実行し、0 FAILを確認すること。

## 対象外・既知事項

- agentic edition、edition selector、edition切替runtime、新しいwizard copy、OAuth／同期変更は実装していない。
- 実Chatwork／Google API、実Google OAuth、Repository Secret、GitHub Actions dispatch、remote pushは実行していない。
- `docs/evidence`配下には接触していない。実ブラウザのスクリーンショット取得はEvaluatorへ引き渡す。
- Planner／Orchestrator所有のspec、Sprint契約、`docs/sprints/state.md`は変更していない。
- git add、commit、pushは0件。
- runtime targetはstate上strong tier／model-availabilityだが、子host metadataで実起動model／effortを確認できないためlaunchは`unverified`。

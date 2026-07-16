# Sprint 014 — G5 運用: 定期同期と確認付き再検索

**ステータス:** 実装完了 - 評価待ち

## 着手時の契約

- 30分／1時間／3時間／6時間／12時間を17分起点の実scheduleへ反映し、手動のみはscheduleを持たせない。
- 対象room、頻度、保存内容、自動commit・pushへの明示同意後だけ設定とworkflowを一貫して更新する。
- room・頻度変更は同じcommitへまとめ、room解除では既存履歴を削除しない。
- `/chatwork search` は最初にpullし、not found時の3択後、承認時だけdispatch→wait→成功確認→pull→同条件retryを行う。
- auth、rate limit、network、GitHub権限、workflow失敗、timeout、git競合、部分room失敗を区別し、失敗時は前回履歴と最終成功位置を保つ。
- 実GitHub repo、実workflow dispatch、実Chatwork API、実token、実remote pushはGeneratorでは行わず、合成fixtureで評価する。実APIはEvaluator／ユーザー権限が必要なlive gateとして引き渡す。

## 検証計画

- `bash scripts/sprint-014-regression.sh`
- `bash scripts/regression-check.sh --offline`
- running wizardで設定変更、同意、error状態を確認する。
- `git diff --check`、JSON／YAML／Node構文、runtime生成synthetic tokenの漏洩検索を行う。

## 実装内容

- **F26 schedule全6選択**: 30分=`17,47 * * * *`、1時間=`17 * * * *`、3／6／12時間を各`17 */N * * *`へ決定的に生成し、手動のみはschedule section自体を作らないようにした。
- **F26 自動push同意と設定transaction**: private repo、Repository Secret、1件以上のroom、対象room・頻度・保存内容・自動commit／pushへの同意をgateにした。`config.json`とworkflowを同じcommitへ入れ、push競合時は対象2ファイルとHEADを変更前へ戻す。force pushは行わない。
- **F26 設定変更**: wizardへ既存room・頻度を読込み、room追加／解除、6頻度、同意、変更影響を確認してから反映する。room解除は今後の取得だけを止め、履歴ファイルを削除しない。
- **F26 同期の安全性**: workflow concurrencyをrepo単位で直列化した。全room成功時だけ履歴・`lastSuccessAt`・room別cursorを進め、部分／全失敗時は前回履歴と取得位置を保持する。message ID統合は反復・重複実行でも冪等。
- **F27 確認付きmanual sync**: `search-flow.mjs`へpull→保存履歴検索→3択→承認時だけdispatch→wait→success確認→pull→同条件retryを固定した。拒否／room見直し／失敗／timeoutではcommit・pushしない。
- **F27 failure分類**: auth、rate limit、network、GitHub権限、workflow failure、timeout、git競合、部分room失敗を日本語で区別する。失敗workflowの安全な分類コードだけを読み、tokenや本文をerrorへ含めない。
- **配布導線**: README、公開guide、`/chatwork` Skillをprivate repo→Repository Secret→wizard→最新100件→頻度／Actions使用量→検索時の確認付き同期まで一続きに更新した。配布Skillは開発docs・絶対pathへ依存しない。
- **wizard UI**: Sprint 013のpalette、responsive、keyboard、visible focus、label、44px以上targetを維持し、自動push同意checkbox、room解除影響、GitHub権限等の`role=alert`を追加した。
- **回帰資産**: schedule全6、同意前後、原子的変更、競合rollback、重複、部分失敗、3択全分岐、dispatch順序、failure／timeout、token非漏洩、配布fixture、running wizard APIを合成fixtureで検証するSprint 014専用回帰を追加した。

## 自己評価

| 基準 | スコア(1-5) | コメント |
|---|---:|---|
| 機能完全性 | 4 | Sprint 014の実装契約は合成fixtureとrunning wizardで成立。実APIだけは権限が必要なlive gateとして未実施。 |
| 動作安定性 | 5 | 専用の合成挙動44件、静的・構文・配布33件、全offline 298件が0 FAIL。 |
| デザイン性 | 4 | desktop/mobile実操作で同意・error・responsiveを確認。最終screenshot採点はEvaluatorへ引き渡す。 |
| 独自性 | 4 | workflow YAML自体を選択値から生成し、設定と同一commitで反映するtransactionへ落とし込んだ。 |
| エラーハンドリング | 5 | 8種の失敗を区別し、失敗時の履歴・成功時刻・cursor保持、push競合rollbackを検証した。 |
| 回帰なし | 5 | `bash scripts/regression-check.sh --offline` が`PASS=298 FAIL=0`。 |

## 技術的な判断

- schedule候補をすべてworkflowへ常設してjobだけskipする方式は採らず、選択されたcronだけをworkflow YAMLへ生成する。これにより手動のみはschedule起動自体が0になる。
- 設定変更は対象2ファイル以外をstageせず、push失敗時は`git update-ref`とpath限定`git restore`で戻す。ユーザーの他の未commit変更へ触れない。
- room単位の部分成功でも履歴更新を行わない。全room成功を1回の同期境界にし、再試行時の状態を明確にした。
- `/chatwork` Skillは判断とhostの構造化質問だけを担い、順序・待機・再検索は決定的scriptへ移した。

## 検証結果

- 専用合成挙動: `node scripts/sprint-014-chatwork-test.mjs`相当 — `PASS=44 FAIL=0`。
- 専用回帰: `bash scripts/sprint-014-regression.sh` — 外側`PASS=33 FAIL=0`（内包する合成挙動44件も0 FAIL）。
- 全offline回帰: `bash scripts/regression-check.sh --offline` — `PASS=298 FAIL=0`。
- running wizard: headless Chrome/CDPでdesktop 1440pxとmobile 390pxを実操作。同意前disabled、同意後enabled、6時間確認、GitHub権限error、mobile 1 column／CTA縦積み／48px／overflowなし／label有、browser error 0。
- `skill-creator`の`quick_validate.py`は実行したが、環境にPyYAMLがなく`ModuleNotFoundError: yaml`で起動不可。同じfrontmatter必須条件、name規約、TODO不在は依存なしNode／awk回帰でPASS。

## 既知の課題・live gate

- Generatorは実GitHub repo作成、実workflow dispatch、実Chatwork API、実token、実remote pushを行っていない。Repository Secretと非機密test roomを使うroom一覧取得→同期→workflow成功→commit→pull後検索は、Evaluator／ユーザー権限が必要な**未実施live gate**である。
- Evaluatorは実API証跡でtoken、不要なroom名、本文を記録せず、件数、workflow状態、commit、pull後の検索結果だけを残す。
- running wizardのdesktop／mobile screenshotはGeneratorでは保存していない。Evaluatorが設定変更、同意前後、error状態の証跡として取得する。

## Evaluatorへの引き渡し事項

- 起動方法: `bash scripts/start-sprint-014-wizard-fixture.sh 8765`
- テスト対象URL: `http://127.0.0.1:8765/`
- 専用回帰: `bash scripts/sprint-014-regression.sh`
- 全回帰: `bash scripts/regression-check.sh --offline`
- browser自己確認: ChromeをCDP port 9224で起動後、`node scripts/sprint-014-browser-check.mjs --cdp http://127.0.0.1:9224 --url http://127.0.0.1:8765/`
- desktop: 2 room選択→6時間→確認。自動push同意前は確定不可、同意後は確定可、対象room／頻度／保存内容が同じ画面にあることを確認する。
- 設定変更: 既存roomを解除して手動のみにし、履歴が残ること、workflowからscheduleが消えることを確認する。
- manual search: 3択すべてと、承認時のeventsが`pull-before-search,search-local,structured-choice,dispatch,wait,success-confirmed,pull-after-sync,retry-same-query`であることを確認する。
- error: auth、rate limit、network、GitHub権限、workflow failure、timeout、git競合、部分room失敗で前回履歴・成功時刻・cursorが保持され、token／本文がerrorへ出ないことを確認する。
- live gate: 許可済みRepository Secretと非機密test roomで、実room一覧、1回の同期、workflow成功、commit、pull後検索を伏せ字証跡にする。

# Sprint 020 Patch 002 — Generator handoff

## Retry 1（2026-07-18）

Evaluatorが指摘したGoogle Cloudの事前確認不足を修正した。Cloudを変更する前に、次の4点を読み取り専用で確認し、すべて確認できた場合だけ最終確認へ進む。

1. `gcloud`でログイン中のアカウント
2. 選択したGoogle Workspace組織
3. 最終的に使うProject IDが未使用であること
4. その組織で`resourcemanager.projects.create`権限があること

Project IDの確認では、明確な`404 / NOT_FOUND`だけを未使用と判断する。`403`、通信失敗、壊れた応答は未使用とみなさず停止する。同名Projectがある場合は、理由つきの調整後IDを作り、そのIDも再確認する。調整前ID、変更理由、最終IDを利用者へ示し直し、再承認されるまでProject作成とAPI有効化は実行しない。

Project作成権限はPolicy Troubleshooterで確認する。確認用APIが未有効、`403`、`UNKNOWN_INFO`、`UNKNOWN_CONDITIONAL`、結果項目の欠落は、権限ありと推測せず手動支援へ切り替える。確認のためにPolicy Troubleshooter APIを無断で有効化しない。実行直前にも承認内容と事前確認結果を照合するため、手作りの実行計画で承認を迂回できない。

### Retry 1の検査結果

| コマンド／確認 | 結果 |
|---|---|
| `node scripts/sprint-020-patch-002-cloud-setup-test.mjs` | `PASS=55 FAIL=0`。認証、組織、Project ID、作成権限の失敗系と、衝突後の再確認・再承認を追加 |
| `bash scripts/sprint-020-patch-002-regression.sh` | 8項目中7項目PASS。旧Sprint 019のloopback server起動だけ、このGenerator環境の`EPERM`で停止 |
| `bash scripts/regression-check.sh --offline` | Sprint 019のloopback起動地点まで表示上PASS。同じ`EPERM`で停止したため全件PASSとは扱わない |
| `bash scripts/regression-check.sh --online` | Sprint 019のloopback起動地点まで表示上PASS。同じ`EPERM`で停止したため全件PASSとは扱わない |
| `bash scripts/sprint-016-regression.sh` | `PASS=1 FAIL=1`。このSprintで更新が必須の本handoffを、旧Sprint 016検査が保護記録の変更として検出。公開面の漏えい検査はPASS |
| `node --check`（Cloud準備module／専用テスト） | PASS |
| `git diff --check` | PASS |

Cloud操作はdependency-injected runner、つまりテスト用応答を返す差し替え可能な実行部分で検証した。実Google Cloud Project作成、API有効化、Policy Troubleshooter API有効化、OAuth、Billing変更は行っていない。

起動済みfixtureを実ブラウザで確認し、Google Chatは`google-chat-prepare-file`から始まり、PC幅と390px幅のどちらも横overflowなし、主ボタンは`#11BB62`、技術詳細は初期状態で閉じていることを確認した。Chatworkも390px幅で横overflowなし、主ボタンは`#F03747`、技術詳細は初期状態で閉じていることを確認した。Chatworkとwizardの実装ファイルは変更していない。ブラウザconsoleには既知の`favicon.ico` 404以外のエラーはなかった。

Evaluatorはloopback待受が許可された独立環境で、ラッパー、offline、onlineの3回帰を完走させ、UIのスクリーンショットを評価証拠へ保存すること。

### 親レビュー後の安全境界追補

承認済みでも、呼び出し側が手作りの実行計画を渡してCloud操作を差し替えられないようにした。`executeApprovedPlan()`は実行直前に、承認済みのProject ID、Project表示名、Google Workspace組織から正規の3コマンドを作り直し、渡された計画と厳密比較する。別API、別Project、別表示名、余分なcommand、commandの欠落・重複・並べ替えは、runnerを一度も呼ばず`unsafe-command`で拒否する。

専用テストへ上記7件の負テストを追加し、`SPRINT020_PATCH002_PASS=62 FAIL=0`を確認した。Cloudへの実操作は行っていない。

## 実装した内容

- Google Chatの正式サポートをGoogle Workspace版に限定した。利用者向けのREADME、Google Chat skill、wizardには、個人向けGoogleアカウント、`External`、Test users、公開審査の案内を出さない。
- 「Google Chatを設定したい」からGoogle Chat skillへ進み、未設定時はlocal wizardを先に開かず、AIとの会話でGoogle Cloudを準備する流れにした。
- `cloud-setup.mjs`を追加した。Git repo rootの確認、`<repo名>-google-chat`のProject案、`gcloud`の有無・ログイン・組織の読み取り専用確認、作成前確認、承認後だけのProject作成とGoogle Chat API／People API有効化、エラー分類、手動リンク、途中再開を分けて扱う。
- CLIの変更操作は、Project作成と必要なAPI 2件だけに限定した。Billing Accountの接続、`gcloud config set project`、無関係なAPIの有効化は行わない。
- `gcloud`が使えない場合も、Google公式リンクを使い、「今すること」「開くリンク」「押す場所」「完了条件」「できました」の一操作ずつでJSON取得まで進める。CLIでProjectとAPIを準備済みなら、手動案内はAudienceから再開する。
- 再開情報はrepo、Project表示名／ID、Google Workspace組織、完了工程、次工程、確認日時だけに限定した。client secret、OAuth client JSON本文、認可コード、token、認可URLは残さない。
- local wizardは接続用JSONの選択から開始するようにした。JSONがない場合は秘密値を貼らせず、終了してAIへ「Google Chatを設定したい」と伝える。JSON確認後のOAuth別タブ、通常スペース選択、3時間推奨、初回取り込み＋自動取得の一体型確定は維持した。
- 旧Google Cloud準備3画面と案内SVGをwizardから撤去し、READMEからも画像と重複手順を削除した。READMEはAIへ話しかける主導線と、AIを使わない場合の公式リンクに整理した。
- Chatworkの実装は変更していない。

## 自動検査

| コマンド | 結果 |
|---|---|
| `node scripts/sprint-020-patch-002-cloud-setup-test.mjs` | `PASS=37 FAIL=0` |
| `node scripts/sprint-020-patch-001-copy-test.mjs` | `PASS=69 FAIL=0 INVENTORY=52` |
| `node scripts/sprint-020-google-chat-test.mjs` | `PASS=50 FAIL=0` |
| `node scripts/sprint-020-adversarial-test.mjs` | `PASS=16 FAIL=0` |
| `node scripts/sprint-020-patch-001-chatwork-result-test.mjs` | `PASS=7 FAIL=0` |
| `bash scripts/sprint-016-regression.sh` | `PASS=2 FAIL=0`。削除した案内SVGが現行配布物から外れ、公開面・クレジット・保護記録の境界を維持 |
| `node --check`（Cloud準備module／wizard） | PASS |
| `git diff --check` | PASS |

`bash scripts/sprint-020-patch-002-regression.sh`は8項目中7項目がPASSした。残る`node scripts/sprint-019-google-chat-test.mjs`だけは、Generator環境が新しい`127.0.0.1`の待受を`EPERM`で拒否したため未完走である。同じ理由で全offline／online回帰もSprint 019のloopback起動地点で停止した。停止前の検査と、loopbackを使わないSprint 019の機能検査はPASSしているが、全回帰成功とは扱わない。Evaluatorはloopback待受が許可された環境で3コマンドを再実行する。

標準検査では、実`gcloud`導入、実Google Cloud Project／API／OAuth Clientの変更、実OAuth、Repository Secret、Billing、pushを行っていない。Cloud操作はdependency-injected runner、つまり実コマンドの代わりにテスト用応答を返す仕組みで確認した。

## running UIの確認

起動済みのfixture `http://127.0.0.1:18783/` をBrowserで操作し、再接続から新しいJSON選択画面を開いた。

- 開始状態は `google-chat-prepare-file`。
- 見出しは「Google Cloudから取得した接続用ファイルを選びます。」。
- JSONがない場合は終了し、AIへ「Google Chatを設定したい」と伝える案内が出る。
- 旧Google Cloud案内画像は0件。
- Google Chatの主ボタン色は `rgb(17, 187, 98)`、前景は黒。
- 技術詳細は初期状態で閉じており、desktopで横overflowは0件。
- 「設定を終了する」で安全にキャンセル状態へ進む。

このGenerator環境ではviewport変更が実ブラウザへ反映されなかったため、mobile／200%相当は独立Evaluatorの再確認事項とする。既存の自動browser検査はJSON選択開始に合わせて更新済みである。

## 起動方法

Google Chat初回設定fixture:

```bash
node scripts/start-sprint-020-patch-001-google-chat-fixture.mjs 18783
```

確認URL:

```text
http://127.0.0.1:18783/
```

本Patchの回帰:

```bash
bash scripts/sprint-020-patch-002-regression.sh
bash scripts/regression-check.sh --offline
bash scripts/regression-check.sh --online
```

browser回帰は、Chatwork `18784`、Google Chat初回 `18783`、設定変更 `18782`、CDP対応Chrome `9231`を起動してから実行する。

```bash
node scripts/sprint-020-patch-001-browser-check.mjs \
  --cdp http://127.0.0.1:9231 \
  --chatwork-url http://127.0.0.1:18784/ \
  --google-new-url http://127.0.0.1:18783/ \
  --google-settings-url http://127.0.0.1:18782/ \
  --evidence docs/evidence/sprint-020-patch-002/evaluator
```

## Evaluatorへ渡す確認シナリオ

1. 自然文「Google Chatを設定したい」でskillへ入り、wizardではなくGoogle Cloud準備から始まることを確認する。
2. `gcloud`なし、未ログイン、複数組織、承認拒否、Project ID調整／衝突、API片方失敗をfixtureで確認する。承認前の変更0件、Billing／既定Project変更0件も見る。
3. CLI成功後はAudienceから、CLIを使えない場合はProject作成から、対象Project付きの公式リンクと一操作ずつの説明で進むことを確認する。「できました」前に次工程へ進まないことも見る。
4. JSON取得後だけwizardを開き、開始画面がJSON選択であることを確認する。JSON未取得時は秘密値入力を求めずAI会話へ戻れることを見る。
5. JSON確認後のOAuth別タブ、通常スペース選択、3時間推奨、`この設定で始める`、初回取り込み＋自動取得、`設定を終了する`まで完走する。
6. desktop、mobile、200%相当、keyboard、focus、details、CTA色、横overflowを確認し、UIのスクリーンショットを保存する。
7. Chatworkの既存導線、3時間推奨、`#F03747`、選択roomだけの結果が変わっていないことを確認する。
8. 上記3つの回帰コマンドをloopback待受が許可された環境で実行し、全項目0 FAILを確認する。

## 既知事項

- Generator環境では新しいloopback serverを起動できなかったため、Sprint 019のserver起動を含む回帰とmobile／200%相当のrunning UIはEvaluatorへ引き継ぐ。
- 実Google Workspace組織、実Google Cloud、実OAuth、実Repository Secretを使ったlive検証は行っていない。ユーザーの明示許可と専用test資源なしに実施しない。
- 最終的なSprint合否は独立Evaluatorが判定する。

# Sprint 020 Patch 002 Retry 1 評価結果

**判定:** 不合格

**分類:** implementation-issue

**評価対象:** Sprint 020 Patch 002 — Google Cloud準備をAI会話へ分離する

## 結論

Retry 1で追加されたpreflight（変更前の読み取り確認）、計画の再承認、改ざん計画の拒否は、既存の専用回帰では合格した。

一方、Evaluatorが追加した独立負テストで、Project照会が `403 PERMISSION_DENIED` を返し、その説明に `does not exist` が含まれる場合、`未使用のProject ID` と誤判定することを確認した。権限不足と不存在を区別できない応答を安全側へ倒さず、`preflight-ready` まで進めるため、受入基準3、6、7、20を満たさない。

## スコア

| 基準 | スコア | 閾値 | 判定 |
|---|---:|---:|---|
| C1 完成度 | 3/5 | 4 | FAIL |
| C2 構文・整合 | 5/5 | 5 | PASS |
| C3 機能の実証 | 3/5 | 4 | FAIL |
| C4 非エンジニア体験 | 4/5 | 4 | PASS |
| C5 安全・規律 | 4/5 | 5 | FAIL |
| C6 無回帰 | 4/5 | 5 | FAIL |
| C7 やさしさ | 5/5 | 4 | PASS |
| C8 wizard体験・デザイン | 4/5 | 4 | PASS |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS |
| C10 更新の安全性 | 5/5 | 5 | PASS |
| C11 Google Chat境界 | 5/5 | 5 | PASS |

## 回帰結果

| コマンド／確認 | 結果 |
|---|---|
| `bash scripts/sprint-020-patch-002-regression.sh` | wrapper 8/8 PASS。本体62/62、copy 69/69、Sprint 019 51/51、Sprint 020 50/50、Chatwork 7/7 |
| `bash scripts/regression-check.sh --offline` | 316/316 PASS、exit 0 |
| `bash scripts/regression-check.sh --online` | 317/317 PASS、exit 0。remote reference `ONLINE=PASS` |
| `bash scripts/sprint-016-regression.sh` | 2/2 PASS。既知のテスト設計不一致なし |
| `node docs/evidence/sprint-020-patch-002/evaluator-retry1/independent-cloud-negative-test.mjs` | 27/28 PASS、1 FAIL |

既存回帰は0 FAILだが、独立負テストが契約未達を検出した。したがってC6のゼロ許容を満たさない。

## 受入基準20項目

| # | 判定 | 根拠 |
|---:|---|---|
| 1 | PASS | Google Workspace版のみの説明と境界を既存copy回帰で確認。 |
| 2 | PASS | `/google-chat`、自然文ルート、Cloud準備先行を回帰で確認。 |
| 3 | **FAIL** | repo名由来の候補、長さ・文字調整、全体重複の再提案は回帰で合格。ただし曖昧な403を不存在と誤判定し、Project IDの利用可否を確定してしまう。 |
| 4 | PASS | 承認前の変更0件。Project、組織、2 API、Billing非接続を計画表示する。 |
| 5 | PASS | 公式案内、gcloud自体は無料、変更前承認、手動fallbackを確認。 |
| 6 | **FAIL** | Project照会403を安全に読み取り失敗へ分類できず、作成前確認を通過する。 |
| 7 | **FAIL** | `PERMISSION_DENIED 403: project does not exist or caller lacks permission` を `preflight-ready` と誤分類する。 |
| 8 | PASS | 公式リンク、Project指定、一画面一操作、「できました」待ちを回帰で確認。 |
| 9 | PASS | Browser拡張を必須にせず手動案内が成立する。 |
| 10 | PASS | 完了工程allowlist、secret-free resume、再開時skipを確認。 |
| 11 | PASS | 実画面が接続用JSON選択から始まり、旧Cloud作業画面を含まない。 |
| 12 | PASS | OAuth CTA、別タブ、polling、SPACE自動進行、エラー分岐を合成回帰で確認。実OAuthは未実施。 |
| 13 | PASS | 3時間自動取得と手動のみの設定を回帰で確認。 |
| 14 | PASS | READMEのAI主導線、手動公式リンク、旧案内SVG 0件をcopy回帰で確認。 |
| 15 | PASS | secret scan 0件。JSON内容、secret、token、認可URLを証跡へ記録していない。 |
| 16 | PASS | 実Cloud、OAuth、Secret、Billing、pushの外部変更0件。 |
| 17 | PASS | 初回評価のrunning UI証跡とRetry 1の実ブラウザ主要表示で非回帰を確認。Retry 1のファイル選択以降は待機で完走できず、再合格根拠にはしていない。 |
| 18 | PASS | Chatwork実装差分0、専用回帰7/7。Retry 1では実ブラウザ再完走を省略した。 |
| 19 | PASS | Sprint 019 51/51、Sprint 020 50/50、Sprint 016 2/2。 |
| 20 | **FAIL** | wrapper・offline・onlineは0 FAILだが、独立負テストが曖昧な403のfail-openを1件検出した。 |

## 独立負テスト

合成runnerだけを使用し、実Google Cloudへ接続せず次を確認した。

- auth／organizationの403・壊れた応答
- Projectあり／なし／全体衝突／調整後の再衝突
- Project照会403と、403＋不存在文言の曖昧な応答
- 権限 `CAN`／`CANNOT`／`UNKNOWN`／API無効／403／必須field欠落
- Policy Troubleshooter APIを勝手に有効化しないこと
- 再承認前の変更0件
- Billing、default project、無関係APIの変更0件
- API、Project ID、表示名、追加、欠落、重複、順序を変えた計画をrunner 0回で拒否すること
- 正しい計画だけが3コマンドを実行すること

唯一の失敗は、Project照会の曖昧な403を `未使用` と扱うケースだった。

## 実画面の確認

CodexのBrowser skillで実行中のローカルwizardを開き、Google Chat初回設定の見出し、進行表示、JSON選択、秘密情報を画面に出さない説明、AIへ戻る導線、CTAの状態を確認した。設定変更画面ではスペース選択、取得間隔へのCTA、Googleへの再接続導線を確認した。

Retry 1独自スクリーンショット: [google-chat-desktop.png](../evidence/sprint-020-patch-002/evaluator-retry1/google-chat-desktop.png)

ファイルchooserの操作がBrowser側で待機し続けたため、Retry 1ではdesktop／mobile／200%、keyboard、focus、details、consoleの全再完走を打ち切った。初回評価では合格済みで実装差分もないが、Retry 1で未確認の範囲を新たな合格根拠にはしていない。今回の重大なCloud判定不良だけでスプリント不合格は確定する。

## バグ

| 重要度 | 内容 | 再現手順 |
|---|---|---|
| Major | Project照会の403に `does not exist` が含まれると、権限不足を未使用Project IDと誤判定する | 合成runnerで `projects describe` に `PERMISSION_DENIED 403: project does not exist or caller lacks permission` を返し、`inspectGcloud()`を実行する。期待は読み取り失敗または権限不足だが、実際は `status: preflight-ready`、`project.available: true`、`permission.canCreate: true`。 |

原因の手がかりは `plugins/yasashii-secretary/skills/google-chat/scripts/cloud-setup.mjs` の `inspectProjectId()`。`isNotFoundError(result)` をpermission判定より先に評価し、`does not exist` を含む403まで404相当として扱っている。

## Generatorへの指示

1. Project照会はHTTP／gcloudの終了状態とpermission情報を先に評価し、403や `PERMISSION_DENIED` を不存在として扱わない。
2. `not found`／`does not exist` という文言だけで未使用判定しない。明確な404・NOT_FOUNDだけを未使用とする。
3. `403 + does not exist`、`403 + not found`、`PERMISSION_DENIED + caller lacks permission` の回帰テストを追加する。
4. 修正後も、調整後候補の再確認前変更0件、改ざん計画runner 0回、Policy Troubleshooter APIの無断有効化0件を維持する。

## 外部変更と後始末

- 実`gcloud`導入、実Google Cloud Project／API／OAuth Client、実OAuth、Repository Secret、Billing、push: すべて0件。
- 合成fixtureをlive成功とは扱っていない。
- Retry 1で起動した18781／18782のサーバーとBrowserセッションを停止した。
- 18783／18784は評価開始前から稼働していたため、他作業を壊さないよう停止していない。

詳細: [evaluator-run.md](../evidence/sprint-020-patch-002/evaluator-retry1/evaluator-run.md)

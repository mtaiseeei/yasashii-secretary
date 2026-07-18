# Sprint 020 Patch 002 Retry 2 最終評価結果

**判定:** 合格

**評価対象:** Sprint 020 Patch 002 — Google Cloud準備をAI会話へ分離する

## 結論

Retry 1で検出した、Project照会の権限エラーと不存在文言が同居した場合のfail-openは解消された。

Evaluator独自の70件で、`403 + 404`、`403 + does not exist`、`PERMISSION_DENIED + NOT_FOUND`、`forbidden + 404`、`denied + NOT_FOUND`、stdout／stderr分散、大文字小文字差を検証した。すべて`project-lookup-failed`で安全停止し、作成内容の確認、plan生成、変更runnerへ進まなかった。曖昧な`not found`／`does not exist`単独も空きIDとせず、権限語のない明確な`404`／`NOT_FOUND`だけが`preflight-ready`になった。

wrapper、offline、online、Sprint 016はすべて0 FAIL。Google ChatのJSON選択開始とChatwork主要入口を実ブラウザでdesktop／mobile再確認し、指定色、accessibility、横overflow、consoleに回帰はなかった。受入基準20/20、C1〜C11の全閾値を満たす。

## スコア

| 基準 | スコア | 閾値 | 判定 |
|---|---:|---:|---|
| C1 完成度 | 5/5 | 4 | PASS |
| C2 構文・整合 | 5/5 | 5 | PASS |
| C3 機能の実証 | 5/5 | 4 | PASS |
| C4 非エンジニア体験 | 5/5 | 4 | PASS |
| C5 安全・規律 | 5/5 | 5 | PASS |
| C6 無回帰 | 5/5 | 5 | PASS |
| C7 やさしさ | 5/5 | 4 | PASS |
| C8 wizard体験・デザイン | 4/5 | 4 | PASS |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS |
| C10 更新の安全性 | 5/5 | 5 | PASS |
| C11 Google Chat境界 | 5/5 | 5 | PASS |

**合計:** 54/55

C8は今回変更したJSON開始境界とChatwork入口をdesktop／mobileで実操作し、OAuth以降と200%相当は受入済みPatch 001証跡と今回の自動回帰で保護したため4/5とした。Retry 2の実装差分にwizard／README／Chatwork変更はない。

## 回帰結果

| コマンド／確認 | 結果 |
|---|---|
| 新規独立Cloud負テスト | 70/70 PASS |
| Retry 1独立Cloud負テスト | 28/28 PASS |
| 製品Cloud準備テスト | 68/68 PASS |
| `bash scripts/sprint-020-patch-002-regression.sh` | wrapper 8/8 PASS。Cloud 68、copy 69、Sprint 019 51、Sprint 020 50、Chatwork 7を内包 |
| `bash scripts/regression-check.sh --offline` | 316/316 PASS |
| `bash scripts/regression-check.sh --online` | 317/317 PASS |
| online参照検査 | `REFERENCE_OK`、`ONLINE=PASS repo=mtaiseeei/yasashii-harness` |
| `bash scripts/sprint-016-regression.sh` | 2/2 PASS |
| `git diff --check` | PASS |

通常sandboxでのloopback `EPERM`は実行環境制限であり、同じコマンドをloopback許可環境で再実行して全件0 FAILを確認した。

## 重点独立テスト

### Project照会の安全停止

次の全ケースで、`project-lookup-failed`、確認不可、plan不可、変更runner 0件を確認した。

- `403 + 404`
- `403 + does not exist`
- `PERMISSION_DENIED + NOT_FOUND`
- `forbidden + 404`
- `denied + NOT_FOUND`
- 権限語と不存在語のstdout／stderr分散
- 大文字小文字の混在

`not found`だけ、`does not exist`だけは曖昧なため安全停止した。権限語のない`HTTP 404`、`NOT_FOUND`、`not_found`だけが空きIDとして読み取り専用preflightを通過した。

### 承認済みplanの改ざん防止

別API、別Project、別表示名、余分なcommand、command欠落、重複、並べ替えの7件を、runner 0件で`unsafe-command`として拒否した。正規planだけがProject作成と必要API 2件の計3コマンドを実行した。Billing、既定Project、無関係API、Policy Troubleshooter APIの変更は0件だった。

## 実画面

Browser skillでrunning UIを操作した。

### Google Chat

- `http://127.0.0.1:18781/`
- JSON選択画面から開始。
- 旧Cloud準備画像／重複画面0件。
- JSONがない場合はsecretを貼らせず、AIへ「Google Chatを設定したい」と伝える案内。
- detailsはclosedで開始し、Spaceでopen／close。visible focusは3px。
- CTAは`#11BB62`相当、黒前景、高さ48px。
- desktop／390px mobileとも横overflow 0、console error 0。

スクリーンショット:

- [Google Chat desktop](../evidence/sprint-020-patch-002/evaluator-retry2-final/google-chat-json-start-desktop.png)
- [Google Chat mobile](../evidence/sprint-020-patch-002/evaluator-retry2-final/google-chat-json-start-mobile.png)

### Chatwork

- `http://127.0.0.1:18784/`
- 「Chatworkの接続情報を用意します」「この設定画面へアクセスしてください」を確認。
- detailsはclosedで開始。
- CTAは`#F03747`相当、黒前景、高さ48px。
- desktop／390px mobileとも横overflow 0、console error 0。

スクリーンショット:

- [Chatwork desktop](../evidence/sprint-020-patch-002/evaluator-retry2-final/chatwork-entry-desktop.png)
- [Chatwork mobile](../evidence/sprint-020-patch-002/evaluator-retry2-final/chatwork-entry-mobile.png)

OS file chooserの長時間待機は避けた。JSON確認後のOAuth別タブ、SPACE自動進行、拒否・不一致・管理者block、スペース→間隔→確認→初回取得＋自動設定はSprint 019 51件、Sprint 020 50件、Patch 001 copy／DOM 69件で確認した。

## 受入基準20項目

| # | 判定 | 根拠 |
|---:|---|---|
| 1 | PASS | Google Workspace版／`Internal`限定。個人Google、`External`、Test users、公開審査の利用者向け分岐0件。 |
| 2 | PASS | 自然文／`/google-chat`から段階ロードし、Cloud準備を先行。 |
| 3 | PASS | repo root／subdirectory／no repo、命名調整、衝突後再確認を検証。曖昧な照会は安全停止。 |
| 4 | PASS | Project、組織、必要API、Billing非接続を表示し、確認前変更0件。 |
| 5 | PASS | `gcloud`の公式性、無料導入、Cloud変更能力、承認後だけ導入、手動fallbackを確認。 |
| 6 | PASS | preflight後だけ正規3コマンド。Billing、既定Project、他API 0件。 |
| 7 | PASS | 未ログイン、複数組織、権限、衝突、部分失敗を区別。重点複合エラーは全件fail-closed。 |
| 8 | PASS | Project指定公式リンク、一操作、「できました」待ちを確認。 |
| 9 | PASS | Browser拡張なしで完結する手動案内。拡張導入要求0件。 |
| 10 | PASS | 許可fieldだけの再開と未完了工程からの再開。secret保存0件。 |
| 11 | PASS | running UIはJSON選択開始。旧Cloud準備画像／重複画面0件。 |
| 12 | PASS | Sprint 019 51/51。明示OAuth、別タブ、SPACE自動進行、全失敗分岐を回帰。 |
| 13 | PASS | Sprint 020 50/50、copy 69/69。一体型確定、手動のみ、部分失敗、追加設定ループ0件。 |
| 14 | PASS | README主導線、手動公式リンク、旧画像／参照0件。 |
| 15 | PASS | 厳格secret、認可URL、固有accountの新規証跡露出0件。 |
| 16 | PASS | 実Cloud／OAuth／Secret／Billing／pushの外部変更0件。 |
| 17 | PASS | desktop／mobile、details keyboard／focus、accessible name、指定CTA、overflow、consoleを確認。 |
| 18 | PASS | Chatwork専用7/7、copy 69/69、running入口に回帰なし。 |
| 19 | PASS | Sprint 019 51/51、Sprint 020 50/50、Sprint 016 2/2。 |
| 20 | PASS | 独立70＋28、wrapper 8、offline 316、online 317が0 FAIL。 |

## バグ一覧

なし。

## 外部変更と後始末

- 実`gcloud`導入、実Cloud Project／API／OAuth Client、実OAuth、Repository Secret、Billing、push: すべて0件。
- Evaluatorが起動した`127.0.0.1:18781`を停止。
- Browser viewportをresetし、評価tabをfinalize。
- 評価前から稼働していた`18783`／`18784`は所有外のため維持。
- pre-existing untracked `docs/evidence/sprint-020-patch-001/evaluator-retry2/`は未変更・stage対象外。

詳細: [evaluator-run.md](../evidence/sprint-020-patch-002/evaluator-retry2-final/evaluator-run.md)

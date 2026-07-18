# Sprint 020 Patch 002 Retry 2 — 独立最終Evaluator実行記録

- 実施日: 2026-07-18
- 評価開始時HEAD: `e745dd4`
- 対象: `sprint-020-patch-002` Retry 2
- 判定: 合格
- 外部変更: 0件。実`gcloud`導入、実Google Cloud Project／API／OAuth Client、実OAuth、Repository Secret、Billing、pushは操作していない。
- 標準評価は合成runnerとローカルfixtureだけで行い、合成結果をlive成功とは扱っていない。

## 独立Cloud負テスト

新規に [independent-cloud-negative-test.mjs](independent-cloud-negative-test.mjs) を作り、製品テストとは別に70件を検証した。

| 対象 | 結果 |
|---|---|
| `403 + 404` | `project-lookup-failed`、確認不可、plan不可、変更runner 0件 |
| `403 + does not exist` | 同上 |
| `PERMISSION_DENIED + NOT_FOUND` | 同上 |
| `forbidden + 404` | 同上 |
| `denied + NOT_FOUND` | 同上 |
| 権限語と不存在語をstdout／stderrへ分離 | 同上 |
| 大文字小文字を混在 | 同上 |
| `not found`だけ | 曖昧なためfail-closed。確認不可、plan不可、変更runner 0件 |
| `does not exist`だけ | 同上 |
| 権限語のない明確な`404` | `preflight-ready` |
| 権限語のない明確な`NOT_FOUND` | `preflight-ready` |

実行結果:

```text
INDEPENDENT_RETRY2_NEGATIVE_PASS=70 FAIL=0
```

Retry 1の独立テストも変更せず再実行した。

```text
INDEPENDENT_CLOUD_NEGATIVE_PASS=28 FAIL=0
```

承認後の実行計画について、別API、別Project、別表示名、余分なcommand、command欠落、重複、並べ替えの7件を、runner 0回で`unsafe-command`として拒否した。正規planだけがProject作成、Google Chat API、People APIの3コマンドを順に実行した。Billing、既定Project変更、無関係API、Policy Troubleshooter API有効化は0件だった。

## 自動回帰

通常sandboxではloopback待受が`EPERM`になるため、同じ読み取り専用コマンドをloopback許可環境で再実行した。製品assertの失敗はなかった。

| コマンド | 結果 |
|---|---|
| `node scripts/sprint-020-patch-002-cloud-setup-test.mjs` | `SPRINT020_PATCH002_PASS=68 FAIL=0` |
| `node docs/evidence/sprint-020-patch-002/evaluator-retry1/independent-cloud-negative-test.mjs` | `INDEPENDENT_CLOUD_NEGATIVE_PASS=28 FAIL=0` |
| `node docs/evidence/sprint-020-patch-002/evaluator-retry2-final/independent-cloud-negative-test.mjs` | `INDEPENDENT_RETRY2_NEGATIVE_PASS=70 FAIL=0` |
| `bash scripts/sprint-020-patch-002-regression.sh` | `SPRINT020_PATCH002_WRAPPER_PASS=8 FAIL=0`。内包: Cloud 68、copy 69、Sprint 019 51、Sprint 020 50、Chatwork 7 |
| `bash scripts/regression-check.sh --offline` | `PASS=316 FAIL=0` |
| `bash scripts/regression-check.sh --online` | `PASS=317 FAIL=0` |
| `bash scripts/check-yasashii-harness-online.sh` | `REFERENCE_OK`、`ONLINE=PASS repo=mtaiseeei/yasashii-harness` |
| `bash scripts/sprint-016-regression.sh` | `SPRINT016_PASS=2 SPRINT016_FAIL=0` |
| `git diff --check` | PASS |

既存OAuth、PKCE＋state、loopback、SPACE限定、DM／group DM／添付本文0件、3時間推奨、一体型確定、手動のみ、部分失敗、再認証、検索、後始末はSprint 019の51件とSprint 020の50件で回帰した。Patch 001のcopy／DOMは69件、Chatwork選択結果は7件で回帰した。

## Browser実操作

Browser skillでrunning UIを操作した。長時間のOS file chooser待機は避け、今回変更された開始境界と近傍UIを実ブラウザで確認し、OAuth以降の機能は上記自動回帰で確認した。

### Google Chat新規設定

- URL: `http://127.0.0.1:18781/`
- Evaluatorが合成fixtureを起動し、評価後に停止した。
- 最初の見出し: `Google Cloudから取得した接続用ファイルを選びます。`
- 最初の行動: AIと準備した接続用JSONをこのPCから選ぶ。
- 旧Google Cloud案内画像／参照: 0件。
- JSON未取得時はsecretを貼らせず、設定を終了してAIへ「Google Chatを設定したい」と伝える。
- `details`はclosedで開始。`summary`へfocus後、Spaceでopen／closeでき、focus outlineは3px。
- primary CTA: `rgb(17, 187, 98)`、前景`rgb(0, 0, 0)`、高さ48px。
- desktop／390×844 mobileとも横overflow 0px。
- accessible region: `Google Chatの設定`。

スクリーンショット:

- [google-chat-json-start-desktop.png](google-chat-json-start-desktop.png)
- [google-chat-json-start-mobile.png](google-chat-json-start-mobile.png)

### Chatwork主要入口

- URL: `http://127.0.0.1:18784/`
- 見出し: `Chatworkの接続情報を用意します。`
- 主説明: Chatwork公式ページで接続情報を発行し、用意できたら「この設定画面へアクセスしてください」。
- `details`はclosedで開始。
- primary CTA: `rgb(240, 55, 71)`、前景`rgb(0, 0, 0)`、高さ48px。
- desktop／390×844 mobileとも横overflow 0px。
- accessible region: `Chatworkの設定`。

スクリーンショット:

- [chatwork-entry-desktop.png](chatwork-entry-desktop.png)
- [chatwork-entry-mobile.png](chatwork-entry-mobile.png)

Browser console errorは0件だった。Retry 2のコード差分はCloud判定moduleとそのテスト／handoffだけで、wizard、README、Chatwork実装の変更は0件。desktop／mobileの近傍実操作と、受入済みPatch 001の全画面証跡・今回のcopy／DOM 69件を合わせ、C8は4/5とした。

## 受入基準20項目

| # | 判定 | 根拠 |
|---:|---|---|
| 1 | PASS | Google Workspace版、`Internal`限定。個人Google、`External`、Test users、公開審査の利用者向け分岐0件。 |
| 2 | PASS | 自然文／`/google-chat`からskillへ段階ロードし、未準備時はCloud準備を先行。 |
| 3 | PASS | repo root／subdirectory／no repo、命名調整、衝突後再照会をCloud 68件で確認。曖昧な照会は安全停止。 |
| 4 | PASS | Project、組織、必要API、Billing非接続を提示し、確認前の変更0件。 |
| 5 | PASS | `gcloud`の公式性、導入自体は無料、Cloud変更能力、承認後だけ導入、手動fallbackを確認。 |
| 6 | PASS | 事前確認後だけ正規3コマンド。Billing、既定Project、他API 0件。 |
| 7 | PASS | 権限・衝突・部分失敗を区別。独立負テストの全複合ケースでfail-closed。 |
| 8 | PASS | Project指定の公式リンク、一操作、「できました」待ちを確認。 |
| 9 | PASS | Browser拡張なしの手動案内を回帰。拡張導入要求0件。 |
| 10 | PASS | 許可fieldだけの再開状態と未完了工程からの再開を回帰。secret保存0件。 |
| 11 | PASS | running UIがJSON選択から開始し、旧Cloud準備画像／重複画面0件。 |
| 12 | PASS | Sprint 019 51/51。明示OAuthボタン、別タブ、SPACE自動進行、拒否・不一致・管理者blockを回帰。 |
| 13 | PASS | Sprint 020 50/50とcopy 69/69。一体型確定、手動のみ、部分失敗、追加設定ループ0件。 |
| 14 | PASS | README主導線、公式リンク、旧案内画像／参照0件をCloud／copy回帰で確認。 |
| 15 | PASS | 厳格secret回帰0件。新規証跡の非画像2ファイルと4画像を確認し、secret値・認可URL・固有account 0件。 |
| 16 | PASS | 実Cloud／OAuth／Secret／Billing／pushの外部変更0件。 |
| 17 | PASS | desktop／mobile実画面、details keyboard／focus、accessible name、CTA色、高さ、overflow、consoleを確認。 |
| 18 | PASS | Chatwork専用7/7、copy 69/69、running入口の指定色・自然なアクセス表現・mobileを確認。 |
| 19 | PASS | Sprint 019 51/51、Sprint 020 50/50、Sprint 016 2/2。 |
| 20 | PASS | 新規独立70、Retry 1独立28、wrapper 8、offline 316、online 317がすべて0 FAIL。 |

## 秘密と外部変更

- 実`gcloud`導入: 0
- 実Google Cloud Project作成: 0
- 実API有効化: 0
- 実OAuth Client／OAuth認可: 0
- Repository Secret: 0
- Billing: 0
- push: 0
- 新規証跡内の厳格secret、実メールアドレス、実Google client ID、認可URL: 0

## 後始末

- Evaluatorが起動したGoogle Chat fixture `127.0.0.1:18781`: STOPPED。
- Browser session: viewport overrideをresetし、agent tabをfinalize。
- 評価開始前から稼働していた`18783`／`18784`は所有外のため停止していない。
- pre-existing untracked `docs/evidence/sprint-020-patch-001/evaluator-retry2/`は未変更・stage対象外。

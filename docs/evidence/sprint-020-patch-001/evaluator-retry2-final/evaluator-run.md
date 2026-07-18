# Sprint 020 Patch 001 — Retry 2 最終Evaluator実行記録

- 実施日: 2026-07-18
- 対象実装commit: `dd5888c`（`[sprint-020-patch-001] 初回取得と自動取得設定を一体化`）
- 評価開始時HEAD: `2d9d29f`
- 判定用証跡: この `evaluator-retry2-final/` だけを新規取得した。中断された `evaluator-retry2/` とGenerator証跡は、今回の合否根拠に使用していない。
- 外部変更: 0件。実Googleアカウント、実Google Cloud、実Chatwork、実OAuth、実Repository Secret、private live workspace、外部commit／pushを操作していない。
- Sprint 020の実API live gateは完了済みであり、本Patchでは再実行していない。今回の機能・UX確認は秘密を含まないlocal synthetic fixtureだけで行った。

## 自動回帰

最初のsandbox内実行では、localhostをlistenする検査が実行環境の制限により `listen EPERM` となった。製品のassert失敗ではないため、同じコマンドを承認済みのローカル環境で再実行し、次の結果を得た。

| コマンド | 結果 |
|---|---|
| `node scripts/sprint-020-patch-001-copy-test.mjs` | `PASS=71 FAIL=0 INVENTORY=54` |
| `node scripts/sprint-020-patch-001-chatwork-result-test.mjs` | `PASS=7 FAIL=0` |
| `node scripts/sprint-019-google-chat-test.mjs` | `SPRINT019_PASS=51 SPRINT019_FAIL=0` |
| `bash scripts/sprint-014-regression.sh` | Chatwork `PASS=59 FAIL=0`、追加静的検査 `PASS=41 FAIL=0` |
| `node scripts/sprint-020-adversarial-test.mjs` | `SPRINT020_ADVERSARIAL_PASS=16 FAIL=0` |
| `bash scripts/sprint-020-patch-001-regression.sh` | `WRAPPER_PASS=7 WRAPPER_FAIL=0` |
| `bash scripts/regression-check.sh --offline` | `PASS=316 FAIL=0` |
| `bash scripts/regression-check.sh --online` | `PASS=317 FAIL=0`、`ONLINE=PASS repo=mtaiseeei/yasashii-harness` |

copy検査は54状態、primary禁止語、必須意味、heading／button／label／accessible name、details、DOM状態、壊したfixtureを検査した。Chatwork結果検査は選択外room混入、部分失敗、全失敗、0件を区別した。Google Chat回帰は、初回取得と自動取得の一体型確定、手動のみのschedule 0件、初回保存後のschedule部分失敗、SPACE限定、DM／グループDM除外、secret非露出を検査した。

## Browser実操作

秘密を含まない4つのlocal fixtureとheadless Chromeを起動し、次を実行した。

```text
node scripts/sprint-020-patch-001-browser-check.mjs \
  --cdp http://127.0.0.1:9331 \
  --chatwork-url http://127.0.0.1:18884/ \
  --google-new-url http://127.0.0.1:18883/ \
  --google-manual-url http://127.0.0.1:18881/ \
  --google-settings-url http://127.0.0.1:18882/ \
  --evidence docs/evidence/sprint-020-patch-001/evaluator-retry2-final
```

結果は `BROWSER_PASS=32 FAIL=0 SCREENS=32`。`browser-evidence.json` にはChatwork 10状態、Google Chat 18状態、responsive 4状態、browser error 0件を記録した。

- Chatwork: 準備、管理者分岐、接続情報登録、0件、取得失敗、対象選択、間隔、確認、選択roomだけの結果、完了、戻る、キャンセルを実操作した。
- Google Chat: 本人管理者を主経路とする3段階準備、実file inputへのテスト専用接続用ファイル設定、接続失敗、space取得失敗の戻る／再試行、SPACE選択、間隔、確認、0件、手動のみ、完了、設定変更を実操作した。
- details: 両サービスともclosedで開始し、Tabでfocus、visible focus、Spaceでopen／close、矢印方向変化、open状態、画像読込を確認した。
- 一体型自動取得: `initialCalls=1`、`settingsCalls=0`、`scheduleEnabled=true`、`automaticPushConsent=true`、`interval=3h`。完了CTAは `設定を終了する` 1件だけだった。
- 手動のみ: 初回取得あり、`scheduleEnabled=false`、`automaticPushConsent=false`、`interval=manual`。完了CTAは `設定を終了する` 1件だけだった。
- 同意前: space取得失敗の戻る／再試行を含め、`configured=false`。戻る後は `oauth=cancelled` となり、設定・履歴・外部保存を行っていない。
- CTA: Chatwork `rgb(240, 55, 71)`、Google Chat `rgb(17, 187, 98)`、前景は黒。desktop／390px mobile／200%相当でCTA高さ44px以上、DOM・視覚・Tab順一致、横overflow 0件。

schedule部分失敗は、サーバー側の実動作を `sprint-019-google-chat-test.mjs` で確認したうえで、browser内の `/api/initial-sync` 応答だけをHTTP 207の合成結果へ差し替え、実画面を追加確認した。

```text
node docs/evidence/sprint-020-patch-001/evaluator-retry2-final/google-chat-partial-browser-check.mjs \
  http://127.0.0.1:9331 http://127.0.0.1:18880/
```

結果は `GOOGLE_CHAT_PARTIAL_BROWSER_PASS=1 FAIL=0`。画面は「最初の取得は保存済み」「自動取得は未設定」「接続先を確認し設定変更から再試行」を分け、全体成功とは表示せず、CTAは `設定を終了する` だけだった。横overflow 0件、detailsはclosedだった。

## 目視確認した画像

- `chatwork-review-desktop.png`: 安全5項目、サービス名、手動のみ、detailsの開閉表示、CTA色と順序。
- `chatwork-result-desktop.png`: 選択した「営業チーム」だけ、0件を正常結果として表示。
- `google-cloud-guide-desktop.png`: 会社所有project、Chat API／People API、Internal、Desktop app、接続用ファイルの順序、本人主経路と管理者依頼の副経路、2026年7月確認表示。
- `google-chat-review-desktop.png`: 安全5項目、3時間推奨、一体型確定の `この設定で始める`。
- `google-chat-manual-initial-result.png`: 初回取得済み、手動のみ、自動取得なし、終了CTAだけ。
- `google-chat-schedule-partial-desktop.png`: 初回保存済み、自動取得未設定、次の行動を分離。
- mobile／200%画像: 両サービスで欠落、重複、横overflowなし。CTA順とfocus ringを確認。
- 接続失敗／space取得失敗画像: 「何が起きたか→次にすること」、診断内容はclosed detailsへ退避。

## 初見理解テスト

各sessionはtechnical detailを開く前の画面情報を使い、次の5問を評価した。

1. 今することは何か。
2. primary CTAのあとに何が起きるか。
3. どのルーム／スペースを読むか。
4. どこへ保存し、誰が見られるか。
5. 自動取得を止めたとき、取得済み履歴はどうなるか。

### Session 1 — ユーザー本人による2026-07-18の手動レビュー

- Chatwork: 5/5、重大誤解0。
- Google Chat: 5/5、重大誤解0。
- これは契約に記録された確認済み事実をそのまま採用し、Evaluatorが回答内容を推測して再採点していない。
- 同じレビューで指摘された「アクセスしてください」、detailsの開閉表示、本人管理者向け画像ガイド、初回取り込みと自動取得の一体化は、今回のbrowser証跡で修正済みと再確認した。

### Session 2 — 実装担当ではない独立AI画面レビュー

- 使用面: 今回のrunning UI、秘密を含まないDOM／画面。
- Chatwork: 5/5、重大誤解0。選択したroomだけを読み、非公開GitHubリポジトリへ保存し共同編集者にも見え、手動のみでも履歴が残ると回答した。
- Google Chat: 5/5、重大誤解0。本人管理者の準備、選択した通常SPACEだけ、1回の確定で初回取得と自動取得、非公開保存と共同編集者可視性、停止後の履歴保持を回答した。
- ファイル編集・外部変更0件。

### Session 3 — 実装担当ではない独立AI画面レビュー

- 使用面: この `evaluator-retry2-final/` のスクリーンショットと `browser-evidence.json` だけ。Generator証跡と古いEvaluator証跡は不使用。
- Chatwork: 5/5、重大誤解0。確認対象、初回取得、選択した「営業チーム」だけ、非公開保存と共同編集者可視性、手動のみでも履歴保持を回答した。
- Google Chat: 5/5、重大誤解0。選択した通常スペース、1回で初回取得＋3時間自動取得、追加設定フローなし、非公開保存と共同編集者可視性、対象解除／手動のみでも履歴保持を回答した。
- ファイル編集・外部変更0件。

集計はChatwork `15/15 = 5.0/5`、Google Chat `15/15 = 5.0/5`。安全項目3〜5の重大な誤解は両サービスとも0件だった。

## 秘密・固有識別値scan

`evaluator-retry2-final/` の非画像ファイルとGoogle Cloud案内SVGを対象に、private key、Google client secret、Google access／refresh token、GitHub token、実メールアドレス、実Google client IDの厳格形式を値を表示せず走査した。対象4ファイル、全形式0件。PNGは値を機械抽出せず、全画像を目視してアカウント情報・secret・固有project識別値0件を確認した。既存のoffline／online回帰でも厳格secret形式の永続物0件だった。

## 結論

- 自動回帰: 全PASS、既知失敗0件。
- Browser／responsive／accessibility: PASS。
- 初見理解: 両サービス平均5.0/5、重大誤解0。
- 外部変更: 0件。
- Retry 2最終判定: PASS。

# Sprint 020 Patch 002 Retry 1 — Evaluator実行記録

## 判定

- 不合格
- classification: `implementation-issue`
- Major bug: 1件

## 実行結果

| 確認 | 結果 |
|---|---|
| 専用wrapper | 8/8 PASS |
| 専用本体 | 62/62 PASS |
| copy | 69/69 PASS |
| Sprint 019 | 51/51 PASS |
| Sprint 020 | 50/50 PASS |
| Chatwork | 7/7 PASS |
| offline | 316/316 PASS、exit 0 |
| online | 317/317 PASS、exit 0、`ONLINE=PASS` |
| Sprint 016 | 2/2 PASS |
| 独立Cloud負テスト | 27/28 PASS、1 FAIL |

## 独立負テストの失敗

入力:

```text
PERMISSION_DENIED 403: project does not exist or caller lacks permission
```

実際:

```text
status: preflight-ready
project.available: true
permission.canCreate: true
```

期待:

```text
permission-needed または読み取り失敗
```

403は、Projectが存在しないことを証明しない。閲覧権限がない場合も同じ応答になり得るため、作成可能として先へ進めてはいけない。

テスト本体: [independent-cloud-negative-test.mjs](independent-cloud-negative-test.mjs)

## 実ブラウザ

- Codex Browser skillのChrome extension backendを使用。
- `http://127.0.0.1:18783/` で設定変更画面の主要DOMを確認。
- `http://127.0.0.1:18781/` でGoogle Chat初回設定画面を確認。
- 初回画面のdesktopスクリーンショットを保存。
- ファイルchooserが待機し続けたため、Retry 1の全導線・mobile・200%・keyboard・console再確認は打ち切り、未確認としてfeedbackに記録。
- Browserセッションは `browser.tabs.finalize({keep:[]})` で終了。

スクリーンショット: [google-chat-desktop.png](google-chat-desktop.png)

## 外部変更

- Google Cloud Project: 0
- API enable: 0
- OAuth Client／OAuth認可: 0
- Repository Secret: 0
- Billing: 0
- push: 0
- `gcloud`導入: 0

## 後始末

- Evaluatorが起動した18781／18782: STOPPED
- Browser session: CLOSED
- 18783／18784: 評価開始前からLISTENしていたため、所有外として維持
- pre-existing untracked `docs/evidence/sprint-020-patch-001/evaluator-retry2/`: 未変更・stage対象外

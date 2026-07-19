# Sprint 027 Generator progress

## 実装したこと

- Chatwork／Google Chat wizard共通shellに、画面遷移時の見出しfocusと`aria-labelledby`を追加した。
- 同じ画面で検索結果や選択肢を再描画しても、入力focusとcaret位置を復元するようにした。
- room／space選択にfocus keyを付け、選択後の再描画でも現在の選択肢へ戻れるようにした。
- button、外部link、summary、checkbox／radio labelの操作領域を44px相当に揃え、長い表示の折り返しと横overflow防止を追加した。
- `.mcp.json`、onboarding、README、`docs/guide`のGoogle Chat／Chatwork、0.7.0、Cloud準備、更新・復元、配布前gate説明を現行仕様へ揃えた。
- `scripts/sprint-027-copy-test.mjs` と `scripts/sprint-027-browser-check.mjs` を追加し、screen copy inventory、accessible name、focus/caret、desktop／mobile／200%の計測を自動化した。
- `scripts/sprint-027-regression.sh`をmaster release gateのoffline／online inventoryへ追加した。

## 回帰結果

- `node scripts/sprint-027-copy-test.mjs`: `SPRINT027_COPY_PASS=66 SPRINT027_COPY_FAIL=0`
- `bash scripts/sprint-027-regression.sh`: `SPRINT027_PASS=4 SPRINT027_FAIL=0`
- `node --check scripts/sprint-027-browser-check.mjs`: PASS（実ブラウザの起動とスクリーンショット取得はEvaluatorで実施）
- browser実行コマンド（fixture serverとCDPを起動した環境で実行）:
  `node scripts/sprint-027-browser-check.mjs --cdp <CDP> --chatwork-url <Chatwork wizard URL> --google-url <Google Chat wizard URL> --screenshots /tmp/sprint-027-browser`

## 対象外・安全境界

- 実Chatwork／Google API、Google OAuth、Repository Secret、GitHub Actions dispatch、remote pushは実行していない。
- `docs/evidence`配下には接触していない。
- 既存の未stage `LICENSE`差分は変更していない。
- テーマ／step再設計、新connector、OAuth scope追加は行っていない。

## Evaluatorへの確認事項

- 両wizardの全画面で、遷移後に`h1`またはmainへfocusされ、画面名とサービス名がaccessible nameで読めること。
- 検索入力へ文字を入力しながら再描画してもcaretが変わらないこと。
- desktop／390px mobile／200%相当で主要操作の高さ、横overflow、隣接hit area重なり、detailsのclosed状態を確認すること。
- `/tmp/sprint-027-browser` のスクリーンショットとbrowser logを評価証跡へ記録すること。

## Retry 1（Evaluator指摘対応）

- `scripts/sprint-027-browser-check.mjs` のDOM観測式を `scripts/sprint-027-browser-expression.mjs` へ分離し、実ブラウザの `Runtime.evaluate` で構文エラーにならない形へ修正した。
- 操作領域の集計は、閉じた `details` 内部、`hidden`／`aria-hidden`／`inert`、非表示CSS、`pointer-events: none`、無効化された要素を除外し、閉じた `details` の `summary` 自体は可視操作として残す。
- `scripts/sprint-027-browser-expression-test.mjs` に、Chromeが解釈する同一式の構文検査と、閉じた `details` 内部linkの誤重なりを除外する独立fixtureを追加した。
- `scripts/regression-check.sh` のM8を、Microsoft 365／Notion公式connectorとChatwork／Google Chat専用wizardを説明する現行 `.mcp.json` の検査へ更新した。

### Retry 1 回帰

- `node scripts/sprint-027-browser-expression-test.mjs`: `SPRINT027_BROWSER_EXPRESSION_PASS=6 SPRINT027_BROWSER_EXPRESSION_FAIL=0`
- `node scripts/sprint-027-copy-test.mjs`: `SPRINT027_COPY_PASS=66 SPRINT027_COPY_FAIL=0`
- `bash scripts/sprint-027-regression.sh`: `SPRINT027_PASS=5 SPRINT027_FAIL=0`
- 実CDP browser（desktop／mobile／200%）とmaster offline／onlineはEvaluatorで再確認する。

### Retry 1 安全境界

- 実Chatwork／Google API、Google OAuth、Repository Secret、GitHub Actions dispatch、remote pushは実行していない。
- `docs/evidence` と明示禁止pathには接触していない。
- 既存の未stage `LICENSE`差分は変更していない。

## Retry 2（Evaluator指摘への限定対応）

- `scripts/sprint-027-browser-check.mjs:94` のGoogle synthetic開始式で、`fetch` options objectに欠けていた閉じ `}` だけを補った。
- ユーザー指定に従い、回帰追加・リファクタリング・実browser／master再評価は行っていない。実browserでの再評価はEvaluatorへ引き渡す。

### Retry 2 回帰

- `node --check scripts/sprint-027-browser-check.mjs`: PASS
- `node scripts/sprint-027-browser-expression-test.mjs`: `SPRINT027_BROWSER_EXPRESSION_PASS=6 SPRINT027_BROWSER_EXPRESSION_FAIL=0`
- `node scripts/sprint-027-copy-test.mjs`: `SPRINT027_COPY_PASS=66 SPRINT027_COPY_FAIL=0`
- `bash scripts/sprint-027-regression.sh`: `SPRINT027_PASS=5 SPRINT027_FAIL=0`

### Retry 2 安全境界

- 製品コード変更は上記1行だけ。実Chatwork／Google API、Google OAuth、Repository Secret、GitHub Actions dispatch、remote pushは0件。
- `LICENSE`、`docs/evidence`、state、feedback、spec、Sprint契約、Git indexには接触していない。git add／commit／pushは0件。
- runtime targetはstrong tierのSol/highだが、role別model／effortの適用とlaunch metadataを確認できないため、実起動modelは`unverified`。

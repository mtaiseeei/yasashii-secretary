# Sprint 020 Patch 001 — Generator handoff

## Retry 2（2026-07-18）

### 修正した内容

- Chatwork初回取得結果は、`sync.results` 全体ではなく、その時点で選択しているルームIDとの積集合だけを表示・集計する。成功、部分失敗、全失敗、0件、取得件数はすべて同じ絞り込み済み結果から判定する。
- 選択外ルームの結果は、ルーム名・ID・件数・成否を完了画面へ出さない。管理者向けの閉じた詳細にも選択外結果を出さない。
- `101` と `102` の結果を入れ替えても選択中ルームだけが残る敵対fixtureを追加した。選択外の失敗が成功表示を汚さないこと、選択内の部分失敗／全失敗／0件を別々に検査する。
- Google Chat初回設定fixtureは、起動時に一時的な `TEST ONLY` のDesktop app形式ファイルを生成し、権限を `0600` にする。実Google OAuth、実API、実Secret、private workspace、commit、pushは使わず、終了時に一時ファイルを削除する。
- browser回帰は `DOM.setFileInputFiles` で実際のfile inputへ一時ファイルを設定し、通常CTA「接続用ファイルを確認する」から次へ進む。製品版wizardのfile検証は迂回していない。合成接続CTAは `SYNTHETIC=1` のテストlauncherでだけ表示される。
- Retry 1のlauncher fixture path、space取得失敗時CTA、mobile／200%相当の `secondary → primary` 順は維持し、同じbrowser回帰で再確認した。

### Google Chat初見評価の手順

各Evaluatorは、前の人の状態を引き継がず、次を1回ずつ実行する。

1. `node scripts/start-sprint-020-patch-001-google-chat-fixture.mjs 18783` を起動する。
2. 標準出力の `TEST ONLY file chooser:` に続く一時ファイルのパスを控え、`http://127.0.0.1:18783/` を開く。
3. 管理者準備 1/3、2/3、3/3 を進み、「Google Cloudから取得した接続用ファイル」のOS標準ファイル選択で、手順2のファイルを選ぶ。
4. 通常CTA「接続用ファイルを確認する」を押す。その後、テストfixtureだけにある「合成データで接続を確認する」を押す。
5. 通常スペースを選び、間隔、保存前確認、初回結果、完了まで進む。実OAuth画面、実API、実Secret、Git操作は発生しない。
6. 評価終了後にlauncherを停止する。一時ファイルはlauncherが削除する。

自動browser検査の再現コマンドは次のとおり。先にChatwork `18784`、Google Chat初回 `18783`、設定変更 `18782`、CDP対応headless Chrome `9231` を起動する。

```bash
node scripts/sprint-020-patch-001-browser-check.mjs \
  --cdp http://127.0.0.1:9231 \
  --chatwork-url http://127.0.0.1:18784/ \
  --google-new-url http://127.0.0.1:18783/ \
  --google-settings-url http://127.0.0.1:18782/ \
  --evidence docs/evidence/sprint-020-patch-001/generator-retry2
```

Generatorの実行結果は `SPRINT020_PATCH001_BROWSER_PASS=30`、`FAIL=0`、`SCREENS=30`。初見理解テスト3回と最終rubric判定は独立Evaluatorの担当であり、Generatorは代替していない。

Retry 2証跡:

- `docs/evidence/sprint-020-patch-001/generator-retry2/browser-evidence.json`
- `docs/evidence/sprint-020-patch-001/generator-retry2/chatwork-result-desktop.png`
- `docs/evidence/sprint-020-patch-001/generator-retry2/google-chat-review-desktop.png`
- 同じディレクトリのmobile、200%相当、0件、失敗、space取得失敗の各PNG

## Retry 1（2026-07-18）

### 再現した問題

1. `node scripts/start-sprint-020-patch-001-google-chat-fixture.mjs 18783` だけでは `/api/spaces` が同梱fixtureを読まず、Google Chat初回導線が通常スペース選択前で停止した。
2. 通常スペース一覧取得に失敗すると、`google-chat-discover-loading` / `loading` のDOMへ共通エラーを追記するだけになり、再試行・終了CTAがなかった。
3. 768px未満の `.actions { flex-direction: column-reverse; }` により、DOM／Tab／読み上げ順の `secondary → primary` と、視覚順の `primary → secondary` が逆転した。

### 修正した内容

- 初回Google Chat launcherは、実行場所ではなくscript自身を基準に同梱 `scripts/fixtures/google-chat-wizard/google-chat.json` を解決し、`YASASHII_GOOGLE_CHAT_FIXTURE` へ渡す。`SYNTHETIC=1`、private test、Secret test、`SKIP_GIT=1` も明示し、実Google／OAuth／Secret／Gitへ接続しない。
- space取得失敗を `google-chat-discover-failure` / `error` の独立状態へ移した。主表示は「通常スペース一覧を取得できなかった→通信と設定を確認」の2段落、CTAは「設定を終了する」「通常スペースをもう一度確認する」の2件、エラー本文と種別は閉じた管理者向けdetailsへ置いた。
- 終了CTAは `/api/cancel` を通して合成接続を後始末し、再試行CTAは設定・履歴を保存せず `/api/spaces` だけを再実行する。
- mobile／200%相当の `.actions` を `column` にし、desktopの `secondary` 左／`primary` 右を維持したまま、両サービスでDOM・視覚・Tab・読み上げ順を `secondary → primary` に揃えた。
- 旧3問題をそれぞれ再混入させた壊したfixture（fixture path欠落、loading追記への逆戻り、`column-reverse`復活）をcopy回帰が検出する。browser回帰は実DOMのstate、CTA数、details、戻る／再試行、同意前 `configured=false`、DOM／視覚／Tab順を検査する。

### Retry 1の実ブラウザ結果

- 初回launcherの同梱fixtureから通常スペース3件を表示し、DM／グループDM 2件を候補から除外した。
- space取得失敗を2回作り、1回目は安全終了後 `oauth=cancelled`、2回目は再試行後 `google-chat-select-spaces` へ到達した。いずれも同意前 `configured=false` だった。
- Chatwork／Google Chatのmobile 390px・200%相当で、DOM／視覚／Tab順はすべて `secondary → primary`、横overflow 0件だった。desktopの左右順も同じDOM順を維持した。
- 初見理解テスト3回とSprint合否は独立Evaluatorの担当であり、Generatorは合格判定していない。

## 実装した内容

- ChatworkとGoogle Chatの設定wizardを、最初に「今すること」が分かる文章へ書き直した。
- 1画面1判断を保つため、Google Chatの管理者準備を「会社所有のGoogle CloudとAPI」「Internal AudienceとDesktop app」「接続用ファイル」の3画面へ分けた。
- API Token、OAuth、Repository Secret、workflow、commit・push等は、画面上の判断に不要な箇所では、既定で閉じた「詳しい説明」「管理者向け」へ移した。正式名称と管理者手順は削除していない。
- 保存前確認は、読む対象、保存先、共同編集者からの可視性、自動取得・保存、履歴保持を5つの短い項目として表示する。
- 0件、手動のみ、失敗、完了、キャンセルを、それぞれ結果と次の行動が先に分かる文章へ揃えた。
- 共通描画に `data-screen` / `data-state` を付け、画面状態、accessible name、必須意味、primary禁止語を完全一致だけに依存せず検査できるようにした。
- sprint-013/014/019の旧copy完全一致チェックは、現行の意味と画面状態を守る検査へ更新した。OAuth、取得、schedule、保存、cleanup等の機能コードは変更していない。

## copy inventory

- 所在: `docs/progress/sprint-020-patch-001-copy-inventory.md`
- 合計: **54状態**（Chatwork 24、Google Chat 30）
- primary禁止語allowlist: **0件**
- 各状態について、サービス、画面／状態、copyの役割、primary文面、primary／technical区分、必ず残す意味、technical detailの扱いを記録した。

## 代表的なBefore / After

| 場面 | Before | After |
|---|---|---|
| Google Chat準備 | OAuth client JSON、scope、loopback等を主説明へ列挙 | `今すること: Google Cloudで、Google Chatとの接続に使うファイルを作ります。` 正式名称と安全機構は管理者向け詳細へ分離 |
| Chatwork接続 | API TokenとRepository Secretを主説明の中心にする | `今すること: Chatworkの公式ページで、接続に使う情報を発行します。` 登録先の正式名称は詳しい説明で確認可能 |
| 保存前確認 | 自動処理を長い同意文へ集約 | 読む対象、保存先、見える人、自動取得・保存、履歴保持を5項目へ分離 |
| 失敗 | 英語エラーや内部状態を先に表示 | 「何が起きたか→次にすること」を主表示にし、生エラーは閉じた詳細へ移動 |
| 完了 | 内部処理結果を複数段落で表示 | 「設定を保存しました→次は検索できます」の順へ整理 |

## 自動検査

| コマンド | 結果 |
|---|---|
| `node scripts/sprint-020-patch-001-copy-test.mjs` | `PASS=67 FAIL=0 INVENTORY=54` |
| `node scripts/sprint-020-patch-001-chatwork-result-test.mjs` | `PASS=7 FAIL=0` |
| `bash scripts/sprint-020-patch-001-regression.sh` | `WRAPPER_PASS=7 WRAPPER_FAIL=0` |
| `node scripts/sprint-020-patch-001-browser-check.mjs --cdp http://127.0.0.1:9231 --chatwork-url http://127.0.0.1:18784/ --google-new-url http://127.0.0.1:18783/ --google-settings-url http://127.0.0.1:18782/ --evidence docs/evidence/sprint-020-patch-001/generator-retry2` | `PASS=30 FAIL=0 SCREENS=30` |
| `bash scripts/regression-check.sh --offline` | `PASS=316 FAIL=0` |
| `bash scripts/regression-check.sh --online` | `PASS=317 FAIL=0`、公開先 `mtaiseeei/yasashii-harness` も `ONLINE=PASS` |
| `git diff --check` | PASS |
| tracked fileの資格情報パターンスキャン | 実値らしき検出0件。Sprint 015の拒否回帰にある明示的なsynthetic値だけを確認 |

copy検査は、54状態のinventory、必須意味、heading／button／label／accessible name、DOMのscreen／state、primary禁止語を確認する。安全項目欠落、画面名変更、primary禁止語混入に加え、Retry 1の3問題とRetry 2の選択外結果混入／実file chooser省略を再現した壊したfixtureも、検査が失敗を検知することを確認した。

全体回帰で判明したSprint 013／014／019／020の旧browser・CSS検査も、mobileの正しいDOM／視覚／Tab順 `secondary → primary`（`flex-direction: column`）へ更新した。旧 `column-reverse` 前提を残さず、offline 316件とonline 317件で再確認した。

## running UIの確認

- Browser実操作: **30状態**。Chatwork／Google Chatの準備、対象、間隔、確認、0件、手動のみ、失敗、完了、戻る、キャンセル、detailsの閉状態を操作した。
- desktop、mobile（390px）、200%相当を確認した。横overflow 0件、CTA高さ44px未満0件、technical detailの意図しない初期展開0件、primary禁止語0件だった。
- Chatwork確認画面とGoogle Chat確認画面はいずれも安全5項目を表示した。
- CTA色はChatwork `#F03747`、Google Chat `#11BB62`、前景 `#000000` をcomputed styleで確認した。
- Browser skillの通常desktop操作を確認した後、現在のChromeウィンドウではviewport overrideが反映されなかったため、responsive証跡はrepo-localのCDP検査で取得した。

証跡:

- `docs/evidence/sprint-020-patch-001/generator/browser-evidence.json`
- `docs/evidence/sprint-020-patch-001/generator/chatwork-review-desktop.png`
- `docs/evidence/sprint-020-patch-001/generator/chatwork-result-desktop.png`
- `docs/evidence/sprint-020-patch-001/generator/chatwork-mobile.png`
- `docs/evidence/sprint-020-patch-001/generator/chatwork-zoom200.png`
- `docs/evidence/sprint-020-patch-001/generator/google-chat-review-desktop.png`
- `docs/evidence/sprint-020-patch-001/generator/google-chat-empty-desktop.png`
- `docs/evidence/sprint-020-patch-001/generator/google-chat-failure-desktop.png`
- `docs/evidence/sprint-020-patch-001/generator/google-chat-discover-failure-desktop.png`
- `docs/evidence/sprint-020-patch-001/generator/google-chat-zero-manual-result.png`
- `docs/evidence/sprint-020-patch-001/generator/google-chat-mobile.png`
- `docs/evidence/sprint-020-patch-001/generator/google-chat-zoom200.png`

## 起動方法

Chatwork fixture:

```bash
bash scripts/start-sprint-014-wizard-fixture.sh 18784
```

Google Chat初回設定fixture:

```bash
node scripts/start-sprint-020-patch-001-google-chat-fixture.mjs 18783
```

Google Chat設定変更fixture:

```bash
node scripts/start-sprint-020-wizard-fixture.mjs 18782
```

開くURLは、それぞれ `http://127.0.0.1:18784/`、`http://127.0.0.1:18783/`、`http://127.0.0.1:18782/`。

## Evaluatorへ渡す確認シナリオ

1. Chatworkで開始→管理者分岐→登録→対象→3時間推奨→確認→結果→完了を操作し、主説明だけで次の行動が分かるか確認する。
2. Google Chatで3つの管理者準備→接続許可→通常スペース→間隔→確認→初回結果→完了を操作する。技術詳細を開かなくても進め、開けば正式名称と管理者手順を確認できることを見る。
3. 両サービスの確認画面で、安全5項目が別々に読め、明示同意前に設定・履歴・commit・pushが0件である既存回帰を確認する。
4. Chatworkのルーム0件／取得失敗、Google Chatの初回0件／接続失敗／選択0件＋手動のみを確認する。0件を失敗扱いせず、停止と履歴保持を混同していないことを見る。
5. 戻る、キャンセル、details、desktop、mobile、200%相当、keyboard focus、読み上げ順、CTA色、横overflowを確認する。
6. copy inventory 54状態を実画面と突き合わせ、未棚卸しの表示文言がないか独立に確認する。
7. 実装担当ではない評価者で最低3回の初見理解テストを行い、契約の5問をヒントなしで記録する。これはGeneratorの自己評価では代替していない。

## 既知事項

- 実Googleアカウント、実Google Cloud、実Chatwork、実private workspace、実OAuth、実Secretは使用していない。すべてsynthetic fixtureで確認した。
- 初見理解テスト3回と最終rubric判定は独立Evaluatorの担当として未判定である。
- Generatorが確認した範囲では既知の自動回帰失敗は0件だが、Sprintの合否はEvaluatorの実操作と理解テスト後に決まる。

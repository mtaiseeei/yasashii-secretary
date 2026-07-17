# Sprint 020 — G9 Google Chat定期運用・実API評価

**ステータス:** 実装完了 - Evaluatorの独立評価待ち

## 着手時の契約

- Google Chatの1時間／3時間（おすすめ・初期値）／6時間／12時間／手動のみを、表示、保存設定、生成workflowで一致させる。Chatworkの3時間推奨・初期値も回帰させない。
- 利用者の明示同意後だけ、非公開workspaceへGoogle Chat設定、取得runtime、GitHub Actions workflowを生成し、commit・pushする。public配布repoには利用者用の実設定・workflow・履歴・Secretを置かない。
- refresh tokenから短命access tokenを取得し、実行時にも `spaceType=SPACE` を再確認する。message resource単位の差分統合、部分失敗、再実行、選択解除後の履歴保持を合成fixtureで検証する。
- `/google-chat search` をpull→local search→確認→dispatch→wait→success→pull→同条件再検索へ接続し、拒否、timeout、失敗、再認証待ちを安全に止める。
- wizardからスペースと間隔を変更でき、確認前0変更、確定後の設定・workflow一致、結果画面の現在値をrunning UIで検証する。
- 実Google Cloud、実OAuth、実Google Chat API、実Repository Secret、実GitHub Actions、実remote pushはexternal live gateとして、このGenerator作業では実行しない。

## 実装内容

- **3時間推奨の定期取得**: Google Chatの1h／3h／6h／12h／手動を、表示、設定、生成workflowで共通定義した。3hは毎時23分起点、30日換算240回のおすすめ・初期値。Chatworkもwizard、設定初期値、README、回帰で3hを維持した。
- **同意後だけprivate workspaceへ生成**: 通常スペース、間隔、保存内容、共同編集者への可視性、GitHub Actions、commit・pushを確認画面へ出し、必要な同意が揃った後だけ `google-chat/config.json`、`spaces.json`、取得runtime、workflowを利用者の非公開repoへ生成する。local bare remoteで実commit・pushまで検証した。
- **自動取得runtime**: Repository Secretのrefresh tokenを短命access tokenへ交換し、各実行で選択spaceを再取得して `spaceType=SPACE` を確認する。space別cursorと24時間の重なりを使い、新規、thread、APIが返した範囲の編集・削除をmessage resource name単位で統合する。
- **冪等性と部分失敗**: 同じ処理を複数回実行しても重複・既存投稿消失が起きないようにした。1space失敗時は成功spaceだけcursorを進め、失敗spaceは前回位置を保持する。0件取得、途中失敗、再実行、選択解除後の履歴保持も回帰で実行した。
- **workflowの失敗記録**: 取得処理が失敗しても状態fileを同じrepoへ記録した後、Actions自体は失敗として終了する。履歴0件でdirectoryが存在しない場合も `git add` が失敗しない。
- **設定変更wizard**: 既存設定の通常スペースと間隔を読み込み、確定前は0変更、確定後だけ設定・workflow・commit・pushを更新する。結果画面は変更後の対象、間隔、schedule、直近結果を表示し、解除spaceの履歴は消さない。
- **確認付き再取得検索**: pull→ローカル検索を先に実行し、0件時だけ「取得して再検索／取得しない／対象space見直し」を返す。承認時だけdispatch→完了待ち→成功確認→pull→同じqueryで再検索し、拒否、timeout、Actions失敗では後続pullを止める。
- **再認証と失敗分類**: refresh token失効、scope不足、管理者block、Audience不一致、API無効、space不明、rate limit、network、GitHub／Git失敗を区別した。再認証では既存選択と履歴を保持し、新しいSecret登録後に一覧を更新する。
- **一時的な管理者チェックリスト**: 必要時だけclient IDと必要scope名を表示し、一度読み出すとserver側状態から破棄する。client secret、認可コード、token、本文は含めない。
- **配布文書と更新経路**: README、公開guide、Google Chat Skill、CHANGELOGを定期運用へ更新し、配布版を `0.6.0` に揃えた。`0.5.0→0.6.0` は既存workspaceを自動変更しないmigration境界とした。

## 自己評価

| 基準 | スコア | 根拠 |
|---|---:|---|
| C1 完成度 | 4/5 | 定期取得、設定変更、検索再取得、再認証は完成。実API live gateだけEvaluator／利用者の許可待ち |
| C2 構文・整合 | 5/5 | 全間隔、設定、workflow、manifest 3面、Skill参照、migration、Node構文が一致 |
| C3 機能の実証 | 4/5 | fixture、running wizard、local bare remoteで実証済み。実Google API／Actionsは未実施 |
| C4 非エンジニア体験 | 5/5 | 現在値、保存範囲、共同編集者への可視性、同意、失敗別の次の操作を画面に明示 |
| C5 安全・規律 | 5/5 | private gate、同意前0変更、SPACE限定、Secret値非保存、public live資産0件を検査 |
| C6 無回帰 | 5/5 | 全offline 314件、全online 315件が0 FAIL |
| C7 やさしさ | 5/5 | OAuthやrefresh token等の正式名称を保ちつつ、利用者が次にする操作を先に説明 |
| C8 wizard体験 | 5/5 | desktop、mobile、200%相当で設定変更、同意、現在値、responsive、browser error 0件を確認 |
| C9 配布チャネル非依存 | 5/5 | single private workspace、MIT、単段クレジット、`forkedFrom`、既存更新経路を維持 |
| C10 負テスト | 5/5 | 無同意、DM改ざん、部分失敗、timeout、認証／管理者／API／rate／network失敗を検証 |
| C11 Google Chat境界 | 4/5 | read-only、SPACE限定、秘密非露出は成立。live secret／Actions／後始末は未評価 |

## 検証結果

- Sprint 020専用挙動: `node scripts/sprint-020-google-chat-test.mjs` → `SPRINT020_PASS=44 SPRINT020_FAIL=0`
- Sprint 020専用wrapper: `bash scripts/sprint-020-regression.sh` → `SPRINT020_WRAPPER_PASS=15 SPRINT020_WRAPPER_FAIL=0`
- Sprint 018更新回帰: `bash scripts/sprint-018-regression.sh` → `SPRINT018_PASS=41 SPRINT018_FAIL=0`
- 全offline回帰: `bash scripts/regression-check.sh --offline` → `PASS=314 FAIL=0`（loopback許可環境）
- 全online回帰: `bash scripts/regression-check.sh --online` → `PASS=315 FAIL=0`（loopback・通信許可環境）
- running wizard: Headless ChromeのDevTools Protocolでdesktop 1440px、mobile 390px、200%相当を操作し、browser error 0件を確認した。
- computed style: primary CTA `rgb(17, 187, 98)`、前景 `rgb(0, 0, 0)`、旧青色0件。3時間が選択済み。
- mobile／200%相当: 横overflowなし、mobile actionsは縦積み、button 44px以上、input labelあり。
- 確認画面: 手動は自動同意欄0件。自動は2つの同意が未選択の間CTA disabled。結果画面は変更後の対象、3時間、自動有効、一部失敗を現在値として表示。
- `git diff --check`、全Node構文、public live資産、strict secret形式、両サービス3時間推奨の横断検査 → PASS。

通常sandboxで全回帰を動かした際はloopback serverが `listen EPERM` となったため、localhostを許可した同じコマンドで再実行して上記0 FAILを確認した。実装由来の失敗ではない。

## browser証跡

- `docs/evidence/sprint-020/browser-evidence.json`: service名、3時間選択、CTA computed style、同意前disabled、結果の現在値、responsive、browser errorの構造化結果。
- `docs/evidence/sprint-020/google-chat-settings-desktop.png`: desktopの既存設定変更画面。
- `docs/evidence/sprint-020/google-chat-settings-result.png`: 変更後の現在値を表示する結果画面。
- `docs/evidence/sprint-020/google-chat-settings-mobile.png`: 390px相当の設定画面。
- `docs/evidence/sprint-020/google-chat-settings-zoom200.png`: 200%相当の設定画面。

証跡にはOAuth認可URL、callback URL、client ID、client secret、認可コード、token、実space名、本文、発言者名、添付名を含めていない。

## 既知の課題・external live gate

- Generatorは実Google Cloud project、実OAuth、実Google Chat API、実Repository Secret、実GitHub Actions、実remote pushを使っていない。受入基準10〜13は未完了であり、ユーザーの明示許可、組織所有test project、非機密test space、専用private test workspaceが揃った場合だけEvaluatorが実行する。
- API差分は `createTime` cursorに24時間の重なりを持たせる。これより古い投稿の編集・削除はAPIが今回返さなければ反映されない。README、guide、wizardに正常仕様として明示した。
- `contacts.readonly` で表示名を取得できない利用者は、安定したresource nameへfallbackする。
- 実API評価を行う場合、終了後にschedule停止、3 Secret削除、test space選択解除、OAuth grant／token revokeが必要。履歴／workspace削除は別の明示確認なしに行わない。

## Evaluatorへの引き渡し

- 専用回帰: `bash scripts/sprint-020-regression.sh`
- 全回帰: `bash scripts/regression-check.sh --offline` と `bash scripts/regression-check.sh --online`
- synthetic設定変更wizard: `node scripts/start-sprint-020-wizard-fixture.mjs --root <temporary-private-root> --port 18766`
- browser再検査: wizardとCDP有効Chromeを起動後、`node scripts/sprint-020-browser-check.mjs --cdp http://127.0.0.1:9225 --google-url http://127.0.0.1:18766/ --evidence <evaluator-owned-path>`

### 確認シナリオ

1. ChatworkとGoogle Chatで3時間が「おすすめ・初期値」であり、Google Chatの1h／3h／6h／12h／手動が生成workflowと一致すること。
2. 対象space、間隔、保存範囲、共同編集者への可視性、Actions、commit・pushへの同意前は、設定・workflow・commit・pushが0件であること。
3. local bare remoteで確定後だけ設定、workflow、runtimeがcommit・pushされ、手動のみではscheduleがないこと。
4. 0件、新規、thread、範囲内の編集・削除、範囲外の古い変更、同日再実行、部分失敗、回復、選択解除で重複・既存履歴消失がないこと。
5. 直編集された設定にDMを入れても、実行時の `SPACE` 再検証で履歴0件になること。
6. not found拒否ではdispatch 0件、承認ではdispatch→wait→success→pull→同条件再検索となり、timeout／失敗時に成功扱いしないこと。
7. token失効、scope不足、管理者block、Audience不一致、API無効、rate limit、networkを区別し、無限再試行しないこと。
8. desktop、mobile、200%相当で戻る、設定変更、同意、結果表示を操作し、秘密値、横overflow、browser errorがないこと。
9. public配布repoに利用者用Google Chat Secret、workflow、設定、履歴がなく、全offline／online回帰が0 FAILであること。
10. live gateを実施する場合、開始許可から後始末まで受入基準10〜13を順に評価し、許可がなければ実行しないこと。

## Scope change detected

- 配布版 `0.6.0` でもSprint 018の安全な更新を壊さないため、`0.5.0→0.6.0` の無変更migration境界を追加した。既存workspace本文の自動変更は0件。
- 利用者の追加要望を受け、ChatworkとGoogle Chatのおすすめ・初期値がどちらも3時間であることを専用回帰と全回帰で固定した。

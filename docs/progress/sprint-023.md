# Sprint 023 進捗 — OAuth callbackとloopback session保護

## 実装結果

Sprint 023の受入基準1〜12に対応する実装と自動回帰を追加した。

- Chatwork／Google Chat wizardへ共通のsession guardを追加した。初回GETでランダムな確認値を`HttpOnly`・`SameSite=Strict` cookieとして払い出し、状態変更requestは同一origin、同一session、`application/json`、正しいHTTP methodを全て満たす場合だけ受け付ける。
- Google Chat OAuth開始を、状態を変えるPOSTと、Googleへ移動する副作用なしGETに分離した。既存の別タブ体験を維持しながら、GETだけではPKCE／stateを作らない。
- OAuth callbackを`authorization-pending`から`callback-processing`へ先に確保する一度限りの処理にした。並行／順次再送、完了後再入は409で拒否し、token交換、Repository Secret登録、初回取得を重複させない。
- Repository Secretは1件ずつ作成済み名を記録し、途中失敗時は作成済み対象だけを削除する。OAuth revoke、Secret削除、両方の失敗は`cleanup-required`とし、残っているSecret名／OAuth grantと再実行操作を表示する。
- OAuth revoke tokenはURL queryへ載せずform bodyへ移した。session確認値、OAuth state、code、callback URL、token、Secret値はAPI本文、DOM、screenshotへ返さない。
- Chatwork／Google Chat serverは引き続き`127.0.0.1`固定で、外部interfaceや公開URLを受け付けない。
- 旧回帰のHTTP requestを新しいcookie／Origin／Content-Type契約へ追従させた。製品挙動を変えず、旧実装文字列に固定されていたOAuth別タブ回帰は、現在のPOST開始→別タブ遷移を確認する形へ更新した。

## 受入基準の対応

1. **callback一度限り**: 同一code/stateの並行2件で成功1件・拒否1件、順次再送は拒否。token交換、Secret 3件、初回取得は各1回以下をcall countで確認。
2. **完了後再入**: connected後のcallbackは409、状態とcall count不変を確認。failed／closedもcallback受付状態へ戻さない。
3. **部分登録cleanup**: Secret 1件目／2件目失敗を合成し、作成済みだけ削除。削除失敗時は対象名だけを`cleanup-required`へ残す。
4. **revoke失敗**: revoke失敗、Secret削除失敗、両方失敗を別々に合成し、成功表示0、残存対象と「後始末をもう一度試す」を確認。
5. **Origin gate**: cross-origin、localhost origin、Origin欠落を全状態変更endpointで拒否し、副作用snapshot不変を確認。
6. **session gate**: cookieなし、不一致、別sessionを全状態変更endpointで拒否し、設定・Secret・OAuth・履歴・Git副作用0を確認。
7. **Content-Type gate**: form、text、不正JSONを拒否。正当な同一sessionのJSON POSTだけ成功することを確認。
8. **GET無副作用**: OAuth開始をPOSTへ移し、静的配信、bootstrap、status、authorize GETは状態を作らない。
9. **loopback限定**: 両serverのbind先と表示URLが`127.0.0.1`だけであることを動的・静的に確認。
10. **秘密非露出**: API本文、DOM、HTML、browser screenshotを検査し、session確認値、OAuth state/code、callback URL、token、Secret値0件。
11. **browser非回帰**: running wizardで別タブ開始、popup拒否、タブ閉鎖、同意拒否、再試行、成功後3 SPACE表示まで完走。
12. **全回帰**: Sprint 013／014／019／020／020-patch-001／002／022とSprint 023 wrapperを実行。master offline／onlineはユーザー所有の保護対象を含めない隔離Git repoで最終確認する。

## 変更した主なファイル

- `plugins/yasashii-secretary/scripts/lib/wizard-session.mjs`
- `plugins/yasashii-secretary/skills/google-chat/scripts/wizard-server.mjs`
- `plugins/yasashii-secretary/skills/google-chat/scripts/oauth-session.mjs`
- `plugins/yasashii-secretary/skills/google-chat/assets/wizard/app.js`
- `plugins/yasashii-secretary/skills/google-chat/assets/wizard/cleanup.mjs`
- `plugins/yasashii-secretary/skills/chatwork/scripts/wizard-server.mjs`
- `plugins/yasashii-secretary/skills/chatwork/assets/wizard/app.js`
- `scripts/sprint-023-security-test.mjs`
- `scripts/sprint-023-browser-check.mjs`
- `scripts/sprint-023-regression.sh`
- `scripts/regression-check.sh`
- 既存のSprint 013／014／019／020-patch-002回帰とGoogle Chat browser fixture

## テスト結果

- `bash scripts/sprint-023-regression.sh`: 専用matrix `SPRINT023_PASS=21 SPRINT023_FAIL=0`、wrapper `SPRINT023_WRAPPER_PASS=15 SPRINT023_WRAPPER_FAIL=0`
- `bash scripts/sprint-013-regression.sh`: Chatwork実動作 `PASS=35 FAIL=0`、wrapper後半 `PASS=33 FAIL=0`
- `bash scripts/sprint-014-regression.sh`: Chatwork実動作 `PASS=59 FAIL=0`、wrapper `PASS=41 FAIL=0`
- `bash scripts/sprint-019-regression.sh`: `SPRINT019_PASS=51 SPRINT019_FAIL=0`、wrapper `12/0`
- `bash scripts/sprint-020-patch-002-regression.sh`: `SPRINT020_PATCH002_PASS=68 FAIL=0`、wrapper `8/0`
- `bash scripts/sprint-022-regression.sh`: `SPRINT022_PASS=69 SPRINT022_FAIL=0`、wrapper `8/0`
- CLI/CDP browser: `SPRINT023_BROWSER_PASS=1`。13 checks全て成功し、browser console error 0。
- master offline: ユーザー所有の保護対象をworking tree／indexに含めず、過去tag／historyだけをlocal fetchした隔離Git repoで`PASS=332 FAIL=0`。
- master online: 同じ隔離Git repoで公開GitHub情報の読み取りを含め`PASS=333 FAIL=0`。外部serviceへの書込み0。
- 変更したNode／shellの構文検査と`git diff --check`: PASS。

## 起動・評価handoff

- 専用回帰: `bash scripts/sprint-023-regression.sh`
- master offline: `bash scripts/regression-check.sh --offline`
- master online: `bash scripts/regression-check.sh --online`。公開GitHub情報の読み取りだけを行い、外部serviceへの書込みは行わない。
- 合成Google Chat wizard: `node scripts/start-sprint-020-patch-001-google-chat-fixture.mjs 18783`
- browser確認URL: `http://127.0.0.1:18783/`
- browser screenshot:
  - `/tmp/sprint-023-browser/google-chat-initial.png`
  - `/tmp/sprint-023-browser/google-chat-spaces.png`
  - `/tmp/sprint-023-browser/google-chat-popup-blocked.png`

評価では、専用matrixのcall countと副作用snapshotを確認した後、running wizardで別タブ、閉鎖、popup拒否、同意拒否、再試行、SPACE選択を確認する。実OAuth、実Google／Chatwork API、実Repository Secret、remote pushは使わない。

## 既知事項

- Chrome拡張経由のfile chooserは、この環境ではfile URLアクセス許可がないため`setFiles`が拒否された。製品serverへbrowser専用optionは追加せず、CLI/CDPと同一originの合成fixtureでrunning wizardを検証した。
- screenshotは一時領域に置いており、恒久的な製品配布物には含めていない。
- 実行hostが起動した実model名／effortはGenerator子sessionから確認できないため`unverified`。stateのtierやresolver値を実起動証拠として扱っていない。
- live repositoryのcommit／push、外部remoteへのpushは行っていない。回帰内のcommit／pushは`/tmp`配下の隔離Git repo／local bare remoteだけ。

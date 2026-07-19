# Sprint 024 進捗 — 履歴markerとActions runの因果整合

## 実装結果

Sprint 024の受入基準1〜10に対応する実装と自動回帰を追加した。

- Google Chat履歴のmessage blockをresource nameごとの開始／終了markerで囲むv2形式にした。本文、発言者、thread、削除情報、添付メタデータは全行をMarkdown引用として保存し、内部marker、HTML comment、見出し、区切り線に見える文字列でも構造を変えない。
- 旧v1履歴を読み込める移行処理を残し、同じmessage resource nameは置換、別messageは保持する。作成時刻とresource nameの安定した順序で再構成し、同条件再取得はbyte差分0になる。
- Google Chat messageのresource nameと時刻を保存前に検証する。不正な時刻を日付へ暗黙変換せず、安全に停止する。
- Chatwork／Google ChatのGitHub Actions dispatchを共通moduleへ集約した。現在branch、dispatch前run ID集合、dispatch時刻、workflow名、branch、一意なcorrelation ID入りrun titleを全て満たす今回runだけを採用する。
- workflowへ任意の`correlation_id`入力と一意な`run-name`を追加した。今回runを確認できない場合は古い成功へfallbackせず、`run-correlation-unconfirmed`で停止する。
- 検索再取得は今回runの成功確認後だけpullと同条件再検索へ進む。今回runの失敗時はそのrun IDだけを確認対象にし、古い成功結果を使わない。
- Chatwork wizardのroom discovery、初回取得、設定変更も同じrun相関を使う。statusへ返す証跡はrun ID、workflow、branch、作成時刻だけで、Secret値、本文、OAuth URLを含めない。
- master regressionへSprint 024 wrapperを追加した。旧回帰はv2 markerと一意run相関の契約へ追従させ、製品挙動を守るassertionへ更新した。

## 受入基準の対応

1. **marker本文**: v2開始／終了marker、旧終了marker、HTML comment、見出し、区切り線を含む複数messageを保存し、開始4件・終了4件・検索可能を確認。
2. **表示名・添付名**: 発言者名と添付名の敵対文字列を引用行へ封じ、block境界数が変わらないことを確認。
3. **既存履歴保持**: 敵対messageの前後、thread、削除metadata、同日既存投稿をresource name単位で保持。削除本文を復元しないことも確認。
4. **冪等再取得**: 初回4件、同条件再実行、編集＋新規＋削除の差分後5件で、重複0、同条件byte差分0を確認。
5. **Chatwork run相関**: discovery、初回、設定変更、手動検索でdispatch前run、時刻欠落／不正、別workflow／branchを拒否し、今回runだけを採用。
6. **Google Chat run相関**: 手動検索と生成workflowでcurrent branch、一意correlation ID、workflow、run IDの一致を確認。
7. **未確認停止**: 対応runなし／時刻欠落ではpull、再検索、成功表示へ進まないevent順を確認。
8. **失敗優先**: 今回失敗runと古い成功runを同時に返すfixtureで、今回失敗を採用し古い成功へfallbackしないことを確認。
9. **live資産非露出**: run結果とエラーをSecret sentinel、message本文、OAuth URLで検査し0件を確認。
10. **全回帰**: Sprint 024 wrapper、master offline、master onlineが全て0 FAIL。

## 変更した主なファイル

- `plugins/yasashii-secretary/scripts/lib/actions-run.mjs`
- `plugins/yasashii-secretary/skills/chatwork/scripts/search-flow.mjs`
- `plugins/yasashii-secretary/skills/chatwork/scripts/wizard-server.mjs`
- `plugins/yasashii-secretary/skills/chatwork/scripts/schedule.mjs`
- `plugins/yasashii-secretary/skills/google-chat/scripts/history.mjs`
- `plugins/yasashii-secretary/skills/google-chat/scripts/search-flow.mjs`
- `plugins/yasashii-secretary/skills/google-chat/scripts/schedule.mjs`
- `plugins/yasashii-secretary/workspace-templates/.github/workflows/chatwork-sync.yml`
- `scripts/sprint-024-data-causality-test.mjs`
- `scripts/sprint-024-regression.sh`
- `scripts/regression-check.sh`
- Sprint 014／019／020の既存回帰fixture

## テスト結果

- `node scripts/sprint-024-data-causality-test.mjs`: `SPRINT024_PASS=43 SPRINT024_FAIL=0`
- `bash scripts/sprint-024-regression.sh`: `SPRINT024_WRAPPER_PASS=15 SPRINT024_WRAPPER_FAIL=0`
- 関連回帰: Sprint 013 `35/0`・`33/0`、Sprint 014 `59/0`・`41/0`、Sprint 019 `51/0`・wrapper `12/0`、Sprint 020 `50/0`・adversarial `16/0`、Patch 001／002、Sprint 023が全てPASS。
- master offline: ユーザー所有の保護対象をworking tree／indexへ含めず、製品と検証に必要な正の対象だけを置いた隔離Git repoで`PASS=334 FAIL=0`。
- master online: 同じ隔離Git repoで公開GitHub情報の読み取りを含め`PASS=335 FAIL=0`。外部serviceへの書込み0。
- 変更したNode／shellの構文検査と`git diff --check`: PASS。

## 起動・評価handoff

- 専用回帰: `bash scripts/sprint-024-regression.sh`
- master offline: `bash scripts/regression-check.sh --offline`
- master online: `bash scripts/regression-check.sh --online`。公開GitHub情報の読み取りだけを行い、外部serviceへ書き込まない。
- UI変更はないためbrowser URL／screenshotはなし。評価は敵対message fixtureの生成Markdown、再実行byte差分、検索結果、run一覧fixtureの採用／拒否、event順を確認する。
- 起動host metadataで実model `gpt-5.6-sol`、effort `high`、reasoning effort `high`を確認済み（launch-verified）。stateのtierやresolver値ではなく、子sessionの最初の`turn_context`を根拠にした。

## 既知事項

- 実Google Chat／Chatwork API、実Repository Secret、実workflow dispatch、remote pushは使っていない。liveでの外部書込み確認は後続Sprintの明示的なlive gateへ委ねる。
- 回帰内のcommit／pushは一時領域の隔離Git repoとlocal bare remoteだけ。製品repoのcommit／pushは行っていない。
- run一覧の反映待ちは既定5秒で安全に未確認停止する。実環境の遅延評価は後続live gateで行う。

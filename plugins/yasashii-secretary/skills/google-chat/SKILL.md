---
name: google-chat
description: Google ChatのOAuth接続、通常スペース選択、初回・定期取得、設定変更、確認付き履歴検索、再認証を行う。ユーザーが「Google Chatにつなぎたい」「GChatで探して」「/google-chat」と依頼したときに使う。
---

# Google Chat（少し高度な設定）

選択した通常スペースだけを、秘書・一般プロジェクト・Chatworkと同じ非公開のGitHubリポジトリへ保存する。
Gmail等の公式Googleコネクタとは別の機能であり、各利用組織が所有するGoogle Cloudプロジェクトと
ユーザーOAuthを使う。OAuthは、Googleのパスワードを渡さず、許可した範囲だけ読み取る認証である。

最初に `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読む。通常報告の形式は同ruleの最終応答serializerだけに任せる。

## 状態を先に示す

- `google-chat/config.json` が無い: `未準備`。管理者準備とOAuthへ進む。
- OAuth client JSON待ち: `管理者作業待ち`。Cloud project、API、Audience、Desktop appを確認する。
- OAuth待ち: `Google認証待ち`。loopbackのwizardへ進む。
- 選択0件: `スペース選択待ち`。通常スペースを選ぶ。
- `google-chat/state/sync.json` が成功: `取得済み`。検索または設定変更へ進める。
- `reauthorization-needed`: `再認証が必要`。既存の選択・履歴を保持してOAuthへ戻す。
- 管理者ブロック、Audience不一致、scope不足、API無効、rate limit、network、部分失敗: `要確認`。原因別の次の行動を示す。

## 初回接続

1. 現在地が非公開のGitHubリポジトリrootであることを確認する。publicまたはremote不明なら起動しない。
2. Google Workspace管理者またはCloud project作成権限者に次を依頼する。
   - 会社のGoogle Workspace組織が所有するGoogle Cloud project
   - Google Chat APIとGoogle People APIの有効化
   - OAuth Audience `Internal`
   - OAuth Client `Desktop app`
3. loopbackのローカルwizardを起動する。

   `node "${CLAUDE_PLUGIN_ROOT}/skills/google-chat/scripts/wizard-server.mjs" --root . --port 0`

4. wizardでOAuth client JSONをローカルファイルとして選ぶ。内容は外部へuploadせず、client secret、認可コード、
   access token、refresh token、client JSON全文を画面、会話、ログ、リポジトリへ出さない。client IDも永続物へ残さない。
5. PKCE＋stateを使うDesktop OAuthをloopbackで完了する。scopeは次の3つだけにする。
   - `https://www.googleapis.com/auth/chat.spaces.readonly`
   - `https://www.googleapis.com/auth/chat.messages.readonly`
   - `https://www.googleapis.com/auth/contacts.readonly`
6. 認証成功後、wizardが現在のprivate repoへ次のRepository Secretを直接登録する。値のコピー＆ペーストを求めない。
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REFRESH_TOKEN_GCHAT`
7. `spaceType=SPACE` の通常スペースだけを選ぶ。DMとグループDMは候補・設定・履歴に入れない。
8. 取得結果の保存とGitのcommit・pushを確認画面で別々に示し、明示同意後だけ初回取得する。

初回取得は同じwizardセッションのメモリ上にあるaccess tokenだけを使い、Repository Secretを読み戻さない。
終了時にtokenを破棄する。初回取得の時点では定期scheduleを起動せず、その後の設定確認で明示同意を得る。

## 取得境界

- 選択時と取得実行時の両方で `spaceType=SPACE` を確認する。
- Google Chat APIと組織の保持設定が返せる全pageを取得する。0件は正常。
- スペース別・Asia/Tokyoの日付別Markdownへ、発言者、本文、スレッド、添付メタデータを保存する。
- 添付本文をダウンロードしない。投稿・編集・削除、reaction、管理者操作を行わない。
- message resource nameで冪等に統合し、API応答から消えただけの保存済み履歴を削除しない。
- 編集・削除の反映は、その取得実行でAPIが返した範囲だけ。過去の差分範囲外は正常仕様として説明する。
- People APIで同僚名を補完できない場合は、安定した「Google Chatユーザー <識別子>」表示を使う。

## 定期取得と設定変更

初回取得後も同じwizardを起動し、対象スペースと間隔を見直せる。

1. 既存の `google-chat/config.json`、`spaces.json`、`state/sync.json` を読み、現在値を先に示す。
2. 1時間／3時間（おすすめ・初期値）／6時間／12時間／手動のみから選ぶ。Chatworkも3時間をおすすめ・初期値とする。
3. 対象、保存内容、共同編集者への可視性、GitHub Actions、commit・pushを確認する。
4. 明示同意後だけ、`config.json`、取得runtime、`.github/workflows/google-chat-sync.yml` を同じprivate workspaceへ生成してcommit・pushする。手動のみではscheduleを生成しない。
5. 確定前、拒否、キャンセル、Git失敗では0変更または変更前へ戻す。対象から外したスペースの既存履歴は削除しない。

継続取得はrefresh tokenから短命access tokenを取得し、開始時にも `spaceType=SPACE` を再確認する。
スペースごとにcursor、成功、失敗を持ち、部分失敗時は成功スペースの履歴とcursorを保持する。
編集・削除はその取得でAPIが返した範囲だけ反映し、`createTime` 差分より古い変更が反映されないことを正常仕様として説明する。

## 保存済み履歴を検索する

通常は確認付きの次の経路を使う。

`node "${CLAUDE_PLUGIN_ROOT}/skills/google-chat/scripts/search-flow.mjs" --root . --query "<キーワード>" [--space "<スペース>"] [--sender "<発言者>"] [--from YYYY-MM-DD] [--to YYYY-MM-DD] --choice ask`

最初にpullしてから保存済み履歴を検索する。`found` はspace、日付、該当箇所を根拠として返す。
`not-found-locally` では構造化質問で「取得して再検索（推奨）／取得しない／対象スペースを見直す」を示す。
承認時だけworkflow dispatch→完了待ち→成功確認→pull→同条件再検索へ進む。拒否、timeout、失敗では先へ進めず、
Google Chatに存在しないと断定しない。

## 再認証

- refresh token失効、同意取消、scope不足はworkflowを繰り返さず、既存選択・履歴を保持して同じloopback OAuthへ戻す。
- 管理者ブロック、Audience不一致、API無効は管理者確認へ進める。client IDと必要scopeだけを一時表示できるが、ログ、スクリーンショット、評価証跡、再読込後のDOMへ残さない。
- rate limitとnetworkは再認証と混同せず、時間を置くか接続確認を案内する。無限再試行しない。
- 新しいrefresh tokenのRepository Secret登録が成功した後だけ接続済みに戻す。取得済み履歴を再認証のために削除しない。

## キャンセルと失敗

- OAuth前: repo、Secret、設定、履歴、commit、pushを変更しない。
- OAuth後: 作成済みGoogle Chat Repository Secretを削除し、OAuth grant／tokenをrevokeする。
- `access_denied`、`state-mismatch`、`callback-mismatch`、`redirect_uri_mismatch`、管理者ブロック、API無効、Secret登録失敗を分けて示す。
- 取得済み履歴やworkspaceの削除は、別の明示確認なしに行わない。

## 公式リンク（2026年7月確認）

- 認証: `https://developers.google.com/workspace/chat/authenticate-authorize`
- ユーザーOAuth: `https://developers.google.com/workspace/chat/authenticate-authorize-chat-user`
- OAuth同意画面: `https://developers.google.com/workspace/guides/configure-oauth-consent`
- Restricted scope: `https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification`
- Desktop app loopback: `https://developers.google.com/identity/protocols/oauth2/native-app`
- Space一覧: `https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces/list`
- Message一覧: `https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces.messages/list`
- 添付メタデータ: `https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces.messages.attachments`

公式情報は2026年7月確認。Google側の画面、scope分類、管理者設定は変更される可能性がある。

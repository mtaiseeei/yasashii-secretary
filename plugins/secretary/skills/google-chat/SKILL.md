---
name: google-chat
description: Google Workspace版Google ChatのCloud準備、OAuth接続、通常スペース選択、初回・定期取得、設定変更、確認付き履歴検索、再認証を行う。ユーザーが「Google Chatを設定したい」「Google Chatにつなぎたい」「GChatで探して」「/google-chat」と依頼したときに使う。
---

# Google Chat（少し高度な設定）

Google Workspace版Google Chatの選択した通常スペースだけを、秘書・一般プロジェクト・Chatworkと同じ非公開のGitHubリポジトリへ保存する。
Gmail等の公式Googleコネクタとは別の機能であり、各利用組織が所有するGoogle Cloudプロジェクト、Audience `Internal`、
利用者本人のOAuthを使う。OAuthは、Googleのパスワードを渡さず、許可した範囲だけ読み取る認証である。

最初に `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読む。通常報告の形式は同ruleの最終応答serializerだけに任せる。

## 状態を先に示す

- `google-chat/config.json` が無い: `未準備`。wizardを開かず、Google Cloud準備の会話へ進む。
- `gcloud` が無い: `導入確認待ち`。公式ツールの説明と実行予定を示し、導入するか確認する。
- Project案の確認前: `作成確認待ち`。repo、Project表示名／ID、組織、API、Billing非接続を示す。
- CLIまたはGoogle画面の途中: `Cloud準備中`。完了済み工程と次の一操作だけを示す。
- OAuth client JSON待ち: `接続用JSON待ち`。Audience `Internal`、Desktop app、JSON取得のうち次の一操作を示す。
- OAuth待ち: `Google認証待ち`。loopbackのwizardへ進む。
- 選択0件: `スペース選択待ち`。通常スペースを選ぶ。
- `google-chat/state/sync.json` が成功: `取得済み`。検索または設定変更へ進める。
- `reauthorization-needed`: `再認証が必要`。既存の選択・履歴を保持してOAuthへ戻す。
- 管理者ブロック、Audience不一致、scope不足、API無効、rate limit、network、部分失敗: `要確認`。原因別の次の行動を示す。

## 初回接続: Google Cloud準備

未設定時はwizardを先に開かない。次の順で、Google Workspace組織が所有するProjectと接続用JSONを準備する。

### 1. repoと変更なしの確認

1. 次の読み取り専用コマンドで、Git repo root、Project案、`gcloud`の有無、ログイン状態を確認する。

   `node "${CLAUDE_PLUGIN_ROOT}/skills/google-chat/scripts/cloud-setup.mjs" inspect --root .`

2. Git repo rootを確認できなければCloudを変更しない。Google Chatを接続するrepoを開くよう案内する。
3. サブディレクトリから開始しても、repo rootのディレクトリ名を使う。repo名が `hogehoge` なら、Project表示名とProject IDの初期案は `hogehoge-google-chat`。
4. Project IDで使えない文字、長さ、全体重複があるときだけ調整し、理由と変更後の値を示す。

### 2. `gcloud`の案内と承認境界

- `gcloud`が無い場合は、Google公式の管理ツールで、インストール自体は無料、非公式ソフトではないと伝える。
- 同時にGoogle Cloudの設定を変更できること、予定している導入方法とコマンドを先に示す。利用者が明示承認するまでインストールしない。
- 会社PCの制限、安全な導入方法を判断できない、または利用者が導入しない場合は、Google公式の直接リンクによる手動支援へ切り替える。行き止まりにしない。
- CLIを使う前に、ログイン中のGoogle Workspaceアカウント、利用できる組織、最終Project IDの使用状況、対象組織でのProject作成権限を、この順で読み取り確認する。未ログインなら本人のログイン完了を待ち、複数組織なら対象を選んでもらう。
- Project IDは `gcloud projects describe` が明確に `NOT_FOUND` を返した場合だけ未使用と扱う。403、通信失敗、結果を読み取れない場合は、Projectが存在するかを推測せず確認不能として止める。
- Project IDが使用済みなら理由つきの候補を作り、その候補も未使用か読み取り確認する。調整前ID、理由、最終IDをもう一度示し、利用者が最終IDを承認するまでProject作成・API変更を行わない。
- Project作成権限はGoogle公式のPolicy Troubleshooterで `resourcemanager.projects.create` を確認する。Policy Troubleshooter APIは無断で有効にしない。API未有効、403、`UNKNOWN_INFO`、`UNKNOWN_CONDITIONAL`、結果field欠落では権限ありと推測せず、管理者確認または手動リンク支援へ切り替える。

### 3. 作成前の一回確認

次をまとめて示し、「この内容で作成してよいですか」と確認する。了承前、拒否、キャンセルではCloud変更を0件にする。

- Git repo root
- Project表示名と最終Project ID
- 対象のGoogle Workspace組織
- 有効にする `Google Chat API` と `People API`
- Billing Accountを自動接続しないこと
- `gcloud config set project` 等の全体設定を変更しないこと

既存Project、作成権限、最終Project IDを確認し、上の最終内容を了承した後だけ `gcloud projects create` と `gcloud services enable ... --project <Project ID>` を実行する。
Google Chat APIとPeople API以外を有効にせず、Billing Accountを接続しない。Project ID衝突、権限不足、Project作成失敗、API片方だけの失敗を区別し、完了済みと未完了を分ける。

### 4. Google画面は一度に一操作

CLI完了後は `cloud-setup.mjs links --project <Project ID>` の公式リンクを使う。CLIを使わない場合はProject作成から同じ形式で進める。
各応答は「今すること」「開くリンク」「押す場所」「完了条件」「できたら『できました』と返信」の5点だけを示す。
「できました」を受けるまで次の画面を案内しない。

1. Projectを作成または選択する。
2. Google Chat APIを有効にする。
3. People APIを有効にする。
4. Google Auth platformのAudienceで「内部（Internal）」を選び、保存する。
5. ClientsでApplication type「Desktop app」を作る。
6. 作成したClientの接続用JSONをダウンロードする。

リンクを開いたら、上部の対象Projectが予定したProject IDであることを先に確認してもらう。画面名が変わった、操作できない、管理者権限がない場合は完了と推測せず、現在画面と不足事項を確認する。Browser Use、Chrome拡張機能、特定ブラウザは必要条件にしない。

### 5. 中断と再開

再開情報に残せるのは、対象repo、Project表示名／ID、Google Workspace組織、完了済み工程、次の工程、確認日時だけ。
client secret、接続用JSON本文、認可URL、認可コード、access token、refresh tokenは保存しない。
「Google Chatの設定の続き」では対象repoとProjectを再確認し、完了済み工程を無条件にやり直さず、次の一操作から再開する。

## 接続用JSON取得後のlocal wizard

利用者が接続用JSONをダウンロードできたと確認してから、次のローカル設定画面を起動する。

`node "${CLAUDE_PLUGIN_ROOT}/skills/google-chat/scripts/wizard-server.mjs" --root . --port 0`

1. wizardは接続用JSON選択から始まる。JSONがまだなければ秘密値を貼らせず、終了してAIへ「Google Chatを設定したい」と伝えるよう案内する。
2. wizardでOAuth client JSONをローカルファイルとして選ぶ。内容は外部へuploadせず、client secret、認可コード、
   access token、refresh token、client JSON全文を画面、会話、ログ、リポジトリへ出さない。client IDも永続物へ残さない。
3. JSON確認後の明示ボタンで、PKCE＋stateを使うDesktop OAuthを別タブに開く。JSON選択だけで自動開始しない。scopeは次の3つだけにする。
   - `https://www.googleapis.com/auth/chat.spaces.readonly`
   - `https://www.googleapis.com/auth/chat.messages.readonly`
   - `https://www.googleapis.com/auth/contacts.readonly`
4. 認証成功後、wizardが現在のprivate repoへ次のRepository Secretを直接登録する。値のコピー＆ペーストを求めない。
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REFRESH_TOKEN_GCHAT`
5. `spaceType=SPACE` の通常スペースだけを選ぶ。DMとグループDMは候補・設定・履歴に入れない。
6. 3時間をおすすめ・初期値にし、取得結果の保存、自動取得、Gitのcommit・pushを確認画面で別々に示す。`この設定で始める` の1回の明示同意後だけ、初回取得と自動取得設定を行う。手動のみでも初回取得し、scheduleは作らない。

初回取得は同じwizardセッションのメモリ上にあるaccess tokenだけを使い、Repository Secretを読み戻さない。
終了時にtokenを破棄する。自動取得を選んだ場合も、初回取得後に別の設定CTAやスペース／間隔の再選択を出さない。

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

- Google Cloud CLI: `https://cloud.google.com/sdk/docs/install`
- Project作成: `https://console.cloud.google.com/projectcreate`
- Google Chat API: `https://console.cloud.google.com/apis/library/chat.googleapis.com?project=<Project ID>`
- People API: `https://console.cloud.google.com/apis/library/people.googleapis.com?project=<Project ID>`
- Audience: `https://console.cloud.google.com/auth/audience?project=<Project ID>`
- Clients: `https://console.cloud.google.com/auth/clients?project=<Project ID>`
- 認証: `https://developers.google.com/workspace/chat/authenticate-authorize`
- ユーザーOAuth: `https://developers.google.com/workspace/chat/authenticate-authorize-chat-user`
- OAuth同意画面: `https://developers.google.com/workspace/guides/configure-oauth-consent`
- Restricted scope: `https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification`
- Desktop app loopback: `https://developers.google.com/identity/protocols/oauth2/native-app`
- Space一覧: `https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces/list`
- Message一覧: `https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces.messages/list`
- 添付メタデータ: `https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces.messages.attachments`

公式情報は2026年7月確認。Google側の画面、scope分類、管理者設定は変更される可能性がある。

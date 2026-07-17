# 外部サービスにつなぐ（コネクタ）

メールや予定表・ファイルなどを秘書が参照できるようにするには、**Claude の設定画面から公式コネクタ**でつなぎます。
むずかしい開発者向けの下準備（管理画面での登録や鍵ファイルの用意）は要りません。ボタン操作だけで完結します。

> つなぐときも、パスワードやトークンを秘書ディレクトリに保存することはありません。ChatworkとGoogle Chatの継続取得用資格情報はGitHub上の安全な保管場所（Repository Secret）へ登録し、値はリポジトリへ保存しません。

## Google（Gmail・カレンダー・ドライブ）

- 呼び方の例: 「Google につなぎたい」「Gmail／カレンダーを見て」
- 流れ: 設定画面 → コネクタ → Google を有効化 → 使うアカウントでログイン・許可 → 「直近の予定を1件」で確認。
- 途中で「再起動してください」と出ても大丈夫です。秘書が続きから案内できるよう、事前に付箋（再起動しおり）を残します。

## Microsoft 365（Outlook・OneDrive・Teams）

- 呼び方の例: 「Microsoft につなぎたい」「Outlook／Teams を見て」
- 流れ: 設定画面 → コネクタ → Microsoft 365 を有効化 → 使うアカウントでログイン・許可 → 「直近の予定を1件」で確認。
- 仕事用と個人用のアカウントがある人は、取り違えに注意してください。

## Notion（任意）

- 呼び方の例: 「Notion につなぎたい」
- **任意**です。使わない人は繋がなくても、他の機能は普通に使えます。
- 流れ: 設定画面 → コネクタ → Notion（`mcp.notion.com`）を有効化 → ログイン・許可 → 「ページを1つ探す」で確認。

## Chatwork（選択ルームだけ）

- 呼び方の例: `/chatwork`、「Chatworkにつなぎたい」「Chatworkで探して」。
- 流れは次の4段階です。
  1. [ChatworkでAPI Tokenを取得する](https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php)か、[API Tokenの発行方法を見る](https://help.chatwork.com/hc/ja/articles/115000172402-API%E3%83%88%E3%83%BC%E3%82%AF%E3%83%B3%E3%82%92%E7%99%BA%E8%A1%8C%E3%81%99%E3%82%8B)へ進みます。Tokenページを使えない場合は、実際にAPIを使うアカウントで[組織契約のAPI利用申請を見る](https://help.chatwork.com/hc/ja/articles/115000169501-API%E3%81%AE%E5%88%A9%E7%94%A8%E7%94%B3%E8%AB%8B%E3%82%92%E6%89%BF%E8%AA%8D-%E5%8D%B4%E4%B8%8B%E3%81%99%E3%82%8B)から申請し、承認後に戻ります。
  2. wizardが現在のGitHubリポジトリから作った「GitHub上の安全な保管場所を開く」でGitHubのSecret追加画面を開きます。
  3. 自分で `CHATWORK_API_TOKEN` として登録し、登録できたことを確認します。API Tokenは有効期限がなくChatwork機能へフルアクセスできるため、第三者には見せません。wizardや会話へToken値を貼る必要はありません。
  4. 登録確認後だけ、自動取得処理（GitHub Actions）でルーム一覧を取得します。
- ルームを選び、30分ごと／1時間ごと／3時間ごと（おすすめ・初期値）／6時間ごと／12時間ごと／手動のみから自動取得の間隔を決めます。30日換算の概算実行回数は、約1,440回／720回／240回／120回／60回／0回です。
- 実行回数とGitHub Actionsの処理時間は別です。GitHub Freeの非公開リポジトリでは2026年7月時点で月2,000分の処理時間が含まれますが、2,000回ではありません。プラン、runner、1回の処理時間で実使用量が変わります。[GitHub Actionsの料金と利用枠を見る](https://docs.github.com/en/billing/concepts/product-billing/github-actions)で最新情報を確認してください。
- 初回は各ルームの最新100件以内です。0件も正常です。確認画面の「取得結果をこのリポジトリへ自動保存します（Gitのcommit・push）」へ同意した後だけ自動実行を有効にします。
- 検索で見つからない場合は3択を示し、承認後だけ自動取得処理（GitHub Actions）を開始して再検索します。

> 公式情報は2026年7月確認。サービス側の変更により手順・料金・利用枠が変わる可能性があります。

## Google Chat（選択した通常スペースだけ・少し高度な設定）

- 呼び方の例: `/google-chat`、「Google Chatにつなぎたい」「Google Chatで探して」。
- Google Workspace管理者またはGoogle Cloudプロジェクト作成権限者に、会社の組織が所有するproject、Google Chat API／People API、Audience `Internal`、Desktop app clientを準備してもらいます。
- OAuth client JSONをローカルwizardで選び、Googleのパスワードを渡さずPKCE＋state付きloopbackで認証します。`chat.spaces.readonly`、`chat.messages.readonly`、`contacts.readonly` 以外は要求しません。
- 認証値は現在のprivate repoのRepository Secretへ直接登録し、利用者へコピー＆ペーストを求めません。OAuth後のキャンセルではSecret削除とGoogle OAuth grant／token取消を案内します。
- `spaceType=SPACE` の通常スペースだけを名前で選びます。DMとグループDMは対象外です。1時間／3時間（おすすめ・初期値）／6時間／12時間／手動のみから選びます。
- 初回取得前に、保存内容、共同編集者への可視性、Gitのcommit・pushを確認し、同意後だけローカル取得・保存します。添付はメタデータだけで本文を取得しません。
- 初回取得後も同じwizardからスペースと間隔を変更できます。3時間がChatworkと共通のおすすめ・初期値です。同意後だけGitHub Actionsのschedule、設定、取得runtimeを非公開リポジトリへcommit・pushし、手動のみではscheduleを作りません。
- 継続取得は実行時にも通常スペースか確認し、スペースごとに取得位置と成功・失敗を持ちます。対象から外しても取得済み履歴は削除しません。
- 編集・削除は、その取得でAPIが返した範囲だけ反映します。差分範囲より古い編集・削除が反映されないことは正常な仕様です。
- People APIで連絡先にない同僚名を補完できない場合は、安定した代替表示を使います。
- 検索で見つからない場合は、確認後だけ取得→完了待ち→pull→同条件再検索へ進みます。refresh token失効、同意取消、scope不足、管理者ブロック、Audience不一致、API無効、rate limit、networkを区別し、再認証後も既存の選択と履歴を保持します。

詳しい管理者向けの順序と公式リンクは、READMEの「Google Chatをつなぐ（少し高度な設定）」を確認してください。

> 公式情報は2026年7月確認。Google側の画面、scope分類、管理者設定は変更される可能性があります。

## うまくいかないとき

- 秘書は英語のエラーをそのまま出しません。「何が起きて・どうすれば直るか」に言い換えて案内します。
- よくある原因: 許可がまだ／別アカウントでログイン／接続の有効期限切れ。設定画面でつなぎ直すと直ることが多いです。
- 「繋がってる？」「診断して」と言えば、どのサービスが繋がっているかを一覧で確認できます。

## 大切な約束

- 外部データは各サービスに置いたまま**都度参照**します。メール本文などの全文をローカルにコピー・保存しません。
- ChatworkとGoogle Chatは選択した対象の読取だけです。投稿・編集・削除は行いません。LINE等は対象外です。

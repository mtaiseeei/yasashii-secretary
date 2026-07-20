# 変更履歴

## [0.8.0] - 2026-07-20

### 対象者

- 2つのeditionへ分かれる前の共通安全基盤を、最初の明示配布候補`0.8.0`として新規導入する方。

### 変わること

- plugin本体の内部pathを`plugins/secretary/`へ統一し、公開識別子と利用者向けのやさしい体験は`yasashii-secretary`のまま維持します。
- workspaceにedition中立のmarkerとedition付き台帳を導入し、反対edition、混在、判定不能な状態では書込み前に停止します。

### 設定・ファイルへの影響

- 新規workspaceにはneutral markerとedition付き台帳を作ります。記憶、一般プロジェクト、Chatwork／Google Chatの履歴・設定、Repository Secretへ勝手に書き込みません。
- 公開済み`0.7.0`のrelease記録、migration、fixture、過去の変更履歴は書き換えません。

### 必要な操作

- `0.8.0`のmarketplace／pluginを新規導入し、オンボーディングで新しいworkspaceを作成します。
- 既存workspaceを更新した実績としてではなく、未配布段階の初回導入candidateとして利用します。

### 互換性上の注意

- 同じ`0.8.0`への再更新と`0.8.0`から`0.7.0`へのdowngradeは開始せず、plugin、workspace、Git、設定、台帳、migrationを変更しません。
- 公開済み`0.7.0`の旧updaterは、Google Chatの標準生成fileをsecret候補として止める既知のblockerがあります。`0.7.0 → 0.8.0`のlive update、rollback、再updateはこのcandidateの配布保証に含めません。

## [0.7.0] - 2026-07-19

### 対象者

- `0.6.0`を利用中の方と、Chatwork／Google Chatを含む安全性改善をまとめて受け取りたい方。

### 変わること

- secretのcommit防止、symlink境界、外部処理timeout、OAuth callbackの一回性、Google Chat履歴marker、GitHub Actions runの取り違えを配布前に検査します。
- `0.6.0`からの更新で、workspaceとpluginを別々に検証・復元し、片方だけ戻った状態を完了と表示しません。

### 設定・ファイルへの影響

- migrationは管理対象のversion台帳だけを`0.7.0`へ進め、記憶、一般プロジェクト、Chatwork／Google Chatの履歴・設定、Repository Secretを置き換えません。
- カスタマイズ済み、または配布時の基準を確認できないファイルは「現状を残す」が既定です。

### 必要な操作

- 「最新版にして」と依頼し、読み取り専用の診断で`0.6.0 → 0.7.0`の影響と戻し方を確認してから実更新を明示了承します。
- plugin更新後は`/reload-plugins`を実行し、dry-runの追加・変更・維持対象を確認してからmigrationを適用します。

### 互換性上の注意

- 更新にはcleanなGit workspaceと、pushしない保護commitが必要です。force push、rebase、filter-repoは行いません。
- pluginを自動復元できない環境では、実行可能な`0.6.0`の退避先、対象scope、起動・確認手順を表示し、未復元のまま完了としません。

## [0.6.0] - 2026-07-17

### 対象者

- 選択したGoogle Chat通常スペースを、3時間ごと等の間隔で継続取得したい方。

### 変わること

- Google Chatの1時間／3時間（おすすめ・初期値）／6時間／12時間／手動のみを、wizardの表示、設定、GitHub Actions workflowで一致させます。
- スペースごとの取得位置と成功・失敗、取得範囲内の編集・削除、部分失敗からの再実行を扱います。
- `/google-chat search` で見つからない場合、確認後だけ取得→完了待ち→pull→同条件再検索へ進めます。
- refresh token失効、同意取消、scope不足、管理者ブロック、Audience不一致、API無効、rate limit、networkを区別します。

### 設定・ファイルへの影響

- 利用者が確認画面で明示同意した場合だけ、private workspaceへGoogle Chat設定、取得runtime、GitHub Actions workflowを生成してcommit・pushします。
- public配布repoには利用者のSecret、workflow、設定、状態、履歴を置きません。対象から外したスペースの取得済み履歴も削除しません。

### 必要な操作

- `/google-chat` のwizardで現在のスペースと間隔を確認し、自動取得とcommit・pushへ同意する場合だけ設定を確定します。
- 再認証が必要と表示された場合は、既存の選択と履歴を残したまま同じDesktop OAuthをやり直します。

### 互換性上の注意

- 編集・削除は、その取得でGoogle Chat APIが返した範囲だけ反映します。`createTime` 差分より古い変更が反映されないことは正常な仕様です。
- Google People APIの `contacts.readonly` では、連絡先にない同僚名を補完できない場合があります。

## [0.5.0] - 2026-07-17

### 対象者

- Google Workspaceの通常スペース履歴を、秘書と同じ非公開リポジトリへ保存したい方。

### 変わること

- 各社所有のGoogle CloudプロジェクトとDesktop OAuthを使う、Google Chatの高度な接続wizardを追加します。
- 選択した通常スペースだけを、Asia/Tokyoの日付別Markdownとして初回取得・検索できます。
- ChatworkとGoogle Chatのwizardを同じ骨格へ揃え、自動取得のおすすめ・初期値を3時間に統一します。

### 設定・ファイルへの影響

- Google Chatを使う場合だけ、private workspaceの `google-chat/` と3つのRepository Secretを利用します。
- DM、グループDM、添付本文、投稿・編集・削除は対象外です。public配布repoへ利用者の設定や履歴は置きません。

### 必要な操作

- Google Workspace管理者またはCloud project作成権限者に、Audience `Internal`、Google Chat API／People API、Desktop app clientの準備を依頼します。
- `/google-chat` の確認画面で、対象、保存内容、Gitのcommit・pushへ同意した後だけ初回取得します。

### 互換性上の注意

- `chat.messages.readonly` は読み取り専用でもRestricted scopeです。管理者設定で許可が必要な場合があります。
- People APIで一部の同僚名を補完できない場合は、安定した代替表示を使います。

## [0.4.0] - 2026-07-17

### 対象者

- 変更点を確認してから、安全にpluginとworkspaceを更新したい方。

### 変わること

- 説明後の明示確認がある場合だけ、pushしない保護commit、plugin更新、dry-run、workspace migration、検証へ順に進めます。
- 変更済みまたは判定できないファイルは「現状を残す」を既定にし、失敗時はpluginとworkspaceを分けて戻し方を案内します。

### 設定・ファイルへの影響

- 更新対象は固定allowlistに限定し、0.3.0からは `secretary/AGENTS.md` に更新時の安全規律を追加します。
- 台帳がない0.2.0は、既知の基準と一致するファイルだけを未変更と判断し、それ以外を上書きしません。

### 必要な操作

- 「最新版にして」と話し、説明後に実更新を選びます。plugin更新後は `/reload-plugins` を実行し、「やさしい秘書の更新を再開」と伝えます。
- migrationのdry-runを確認し、表示されたplan hashを使って本実行を明示了承します。

### 互換性上の注意

- 未commitの変更、資格情報らしき内容、最新版未確認、plugin更新失敗、保護commit不能では更新を止めます。
- 更新処理はpush、remote変更、force pushを行いません。pluginを旧版へ自動復元できない場合は未復元項目と手動確認手順を示します。

## [0.3.0] - 2026-07-17

### 対象者

- すでにyasashii-secretaryを利用している方と、これから導入する方。

### 変わること

- 「最新版にして」「更新ある？」と話すと、現在版・最新版・主な変更・影響を読み取り専用で確認できます。
- 新規導入では、将来の更新時に配布時の状態と利用者の変更を区別するため、本文を含まない最小台帳を作ります。

### 設定・ファイルへの影響

- 診断はplugin、workspace、Git、Claude Code設定を変更しません。
- 最小台帳には許可されたファイルのpath、導入version、SHA-256 hash、非機密の生成変数だけを保存します。

### 必要な操作

- 更新の有無を知りたいときに「更新ある？」と秘書へ話しかけてください。
- 自動更新を使う場合だけ、Claude Codeの `/plugin` 画面から利用者自身で有効にします。

### 互換性上の注意

- 実際のplugin更新やworkspace移行は、この版では実行しません。
- pluginが自動更新されても、workspaceへコピー済みのファイルは自動では置き換わりません。

## [0.2.0] - 2026-07-17

### 対象者

- 一般プロジェクトとChatworkの読取専用同期を使う方。

### 変わること

- 継続する仕事を一般プロジェクトとして整理できるようになりました。
- 選択したChatworkルームの履歴を、同じprivate GitHub repoへ保存して検索できるようになりました。

### 設定・ファイルへの影響

- Chatworkを使う場合だけ、専用設定、GitHub Actions、Repository Secretを利用します。

### 必要な操作

- Chatworkを使う場合は `/chatwork` の確認画面に沿って設定してください。

### 互換性上の注意

- LINE等の未対応チャットは対象外です。
- 開発プロジェクトは別pluginのyasashii-harnessが担当します。

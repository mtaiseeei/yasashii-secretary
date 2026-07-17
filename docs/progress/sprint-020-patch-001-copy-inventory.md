# sprint-020-patch-001 copy inventory

## 数え方

- 1行を、利用者が見分けられる1画面または1状態として数える。
- 共通shellのサービス名、進行表示、外部リンクの「新しいタブで開く」は各行に重複計上せず、全54状態へ共通適用する。
- `primary` は見出し・最初の本文・CTA、`technical` は既定で閉じた「詳しい説明／管理者向け」である。
- accessible nameは、画面領域の `Chatworkの設定`／`Google Chatの設定` と、結果が分かるbutton／linkの `aria-label` を指す。

## 全件inventory（54状態）

| サービス | 画面／状態 | copyの役割 | 修正後のprimary copy | 区分 | 必ず残す意味 | technical detail／修正方針 |
|---|---|---|---|---|---|---|
| Chatwork | prepare-connection | 開始・準備 | 接続情報を公式ページで発行する | primary | Chatworkで取得、画面や会話へ貼らない | API Token、秘密性、公式取扱い |
| Chatwork | admin-approval | 管理者承認 | 組織利用なら管理者承認を確認する | primary | 必要時の管理者承認、承認前は読まない | Chatwork API、契約条件 |
| Chatwork | register-connection | 安全な登録 | 接続情報を非公開GitHubへ登録する | primary | 値をGitHub画面だけで入力 | Repository Secret、登録名 |
| Chatwork | confirm-registration | 登録確認 | GitHubで保存できたことを確認する | primary | 値を読み戻さず登録名だけ照合 | 登録確認の仕組み |
| Chatwork | discover | 取得前確認 | 参加ルームの一覧を取得する | primary | この操作で初めてChatworkを読む | GitHub Actions、本文未保存 |
| Chatwork | discover-loading | loading | 参加ルームを確認中 | primary | 待つ理由 | 技術詳細なし |
| Chatwork | discover-empty | 0件 | 0件は接続失敗ではない | primary | 参加状況確認、再取得 | 技術詳細なし |
| Chatwork | discover-failure | 失敗 | ルームを取得できなかった→登録と通信を確認 | primary | 推測断定しない、再試行 | 生エラー全文 |
| Chatwork | select-rooms | 対象選択 | 保存したいルームだけ選ぶ | primary | 選択ルーム限定、未選択は読まない | ルームID一覧 |
| Chatwork | select-interval | 間隔 | 新しいメッセージを確認する間隔を選ぶ | primary | 3時間推奨、全6選択肢 | 料金、実行時間、GitHub Actions |
| Chatwork | review | 保存前確認 | 読む対象・保存先・自動取得を確認する | primary | 安全5要素、明示同意前0変更 | 最新100件、commit・push、GitHub Actions |
| Chatwork | saving | 処理中 | 選択ルームと間隔を保存中 | primary | 待つ理由 | 技術詳細なし |
| Chatwork | save-failure | 失敗 | 保存中の問題→接続先を確認 | primary | 以前の履歴を失わない | 生エラー全文 |
| Chatwork | result-loading | 処理中 | 保存結果を確認中 | primary | 完了確認まで待つ | 技術詳細なし |
| Chatwork | settings-result | 設定変更完了 | 設定を保存、次は検索 | primary | 現在値、履歴非削除 | GitHub Actions、commit・push、内部結果 |
| Chatwork | settings-result-failure | 設定変更後の取得失敗 | 設定は保存、取得は再試行可能 | primary | 設定保存と取得失敗を区別 | 内部結果、GitHub Actions |
| Chatwork | initial-result-loading | 初回処理中 | 選択ルームを取得中 | primary | 待つ理由 | 技術詳細なし |
| Chatwork | initial-result | 初回完了 | メッセージを保存した | primary | 結果、次は検索 | 内部取得結果 |
| Chatwork | initial-result-empty | 初回0件 | まだ保存対象なし、次回以降に保存 | primary | 0件を正常扱い | 内部取得結果 |
| Chatwork | initial-result-partial | 初回部分失敗 | 成功分を保存、失敗ルームは接続確認 | primary | 選択ルームだけの成功／失敗と件数 | 選択外結果は詳細にも表示しない |
| Chatwork | initial-result-failure | 初回失敗 | 接続を確認して再取得 | primary | 何が起きたか→次の行動 | 内部取得結果 |
| Chatwork | complete | 完了 | 設定完了、次は検索 | primary | 結果→次の一手 | 技術詳細なし |
| Chatwork | cancelled | キャンセル | 変更せず終了 | primary | ルーム・間隔・履歴0変更 | GitHub Actions設定も0変更 |
| Chatwork | bootstrap-failure | 開始失敗 | 現在設定を読めない→開き直す | primary | 利用者の次行動 | root、ローカル起動場所 |
| Google Chat | prepare-cloud | 管理者準備1 | 会社所有Cloudと必要APIを依頼 | primary | 各社所有Cloud、Chat/People API | 共通外部アプリ・サービスアカウント不使用 |
| Google Chat | prepare-access | 管理者準備2 | 社内利用者向け接続を依頼 | primary | Internal、Desktop app | OAuth Audience、OAuth Client、Restricted scope |
| Google Chat | prepare-file | 管理者準備3 | 接続用ファイルをPCから選ぶ | primary | 外部送信なし、画面表示なし | OAuth client JSON、loopback、client secret/ID |
| Google Chat | authorize | 接続許可 | Google画面で読むことを許可 | primary | read-only、投稿・編集・削除なし | OAuth、scope、PKCE、state、loopback、token |
| Google Chat | authorize-waiting | 接続待ち | 新しい画面で許可を進める | primary | 完了後に自動で次へ | 画面を閉じた場合の復帰 |
| Google Chat | authorize-popup-failure | 画面起動失敗 | ポップアップを許可して再度開く | primary | 元画面を保持 | 技術詳細なし |
| Google Chat | authorize-failure | 接続失敗 | 許可失敗→理由を確認し再接続 | primary | 推測断定しない、管理者依頼 | 原文、Audience、API、redirect_uri_mismatch、client ID/scope |
| Google Chat | discover-loading | 対象読込 | 通常スペースを確認中 | primary | DM／グループDMを読まない | 技術詳細なし |
| Google Chat | discover-failure | 対象読込失敗 | 通常スペース一覧を取得できなかった→通信と設定を確認 | primary | 推測断定しない、再試行または安全に終了 | 生エラーとエラー種別 |
| Google Chat | discover-empty | 0件 | 0件は接続失敗ではない | primary | 参加／管理者設定確認、再接続 | Secret／OAuthの後始末 |
| Google Chat | select-spaces | 対象選択 | 保存したい通常スペースだけ選ぶ | primary | SPACE限定、DM／グループDM除外 | space ID一覧 |
| Google Chat | select-interval | 間隔 | 新しいメッセージの確認間隔を選ぶ | primary | 3時間推奨、全5選択肢 | GitHub Actions、初回はPC内メモリ |
| Google Chat | review | 初回保存前確認 | 読む対象・保存先・自動取得を確認 | primary | 安全5要素、読むだけ、明示同意 | API保持範囲、commit・push |
| Google Chat | initial-sync-loading | 初回処理中 | 選択スペースを取得中 | primary | 最後まで確認する待ち理由 | 技術詳細なし |
| Google Chat | initial-sync-failure | 初回保存失敗 | 取得／保存問題→接続先確認 | primary | ローカル保存、GitHub保存、秘密消去を区別 | 生エラー、commit/push状態 |
| Google Chat | initial-result | 初回完了 | 取得内容を保存した | primary | 結果、次は自動取得設定 | token破棄、API範囲 |
| Google Chat | initial-result-empty | 初回0件 | まだ保存対象なし、次回以降に保存 | primary | 0件を正常扱い | token破棄、保持設定、API範囲 |
| Google Chat | initial-result-partial | 初回部分失敗 | 成功分保存、失敗分は確認 | primary | 全成功と誤表示しない | space別内部結果 |
| Google Chat | initial-result-failure | 初回全失敗 | 接続を確認してやり直す | primary | 結果→次の行動 | space別内部結果 |
| Google Chat | settings-select-spaces | 設定対象変更 | 今後読む通常スペースだけ選ぶ | primary | 0件停止、履歴非削除 | space ID、再認証 |
| Google Chat | settings-select-interval | 設定間隔変更 | 取得間隔を選び直す | primary | 3時間推奨、0件は手動のみ | schedule、実行時刻 |
| Google Chat | settings-review | 変更前確認 | 読む対象・保存先・自動取得を確認 | primary | 安全5要素、同意前0変更 | workflow、commit、push、API差分境界 |
| Google Chat | settings-saving | 変更処理中 | 選択スペースと間隔を保存中 | primary | 待つ理由 | 技術詳細なし |
| Google Chat | settings-failure | 変更失敗 | 変更前へ戻した→接続先確認 | primary | 以前の設定・履歴保持 | 生エラー、Git競合、GitHub権限 |
| Google Chat | settings-result | 自動設定完了 | 設定保存、次は検索 | primary | 現在値、履歴非削除 | 技術詳細なし |
| Google Chat | settings-result-manual | 手動のみ | 自動取得停止、必要時だけ取得 | primary | 履歴保持 | 技術詳細なし |
| Google Chat | settings-result-stopped | 対象0件 | 今後の取得停止 | primary | 取得済み履歴非削除 | 技術詳細なし |
| Google Chat | cancelled | キャンセル | 接続情報を後始末して終了 | primary | 接続前0変更／接続後削除／手動確認を区別 | Repository Secret、OAuth grant/token、権限URL |
| Google Chat | complete | 完了 | 設定完了、次は検索 | primary | 結果→次の一手 | 技術詳細なし |
| Google Chat | bootstrap-failure | 開始失敗 | 現在設定を読めない→再試行 | primary | 利用者の次行動 | 生エラー全文 |

## primary禁止語allowlist

primaryの見出し、最初の本文、CTA、結果本文に対するallowlistは **0件**。`wizard`、`workflow`、`commit`、`push`、`Repository Secret`、`loopback`、`runtime`、`scope`、`token`、`OAuth client JSON`、Sprint番号はすべて閉じたtechnical detailへ置いた。API／OAuth／Google Cloud／GitHub Actions等の正式名称は、管理者や設定画面で照合が必要なtechnical detailだけに、役割説明とともに残した。

## 共通accessible copy

- 画面領域: `Chatworkの設定`／`Google Chatの設定`。
- 進行: 接続、対象、取得間隔、確認、結果。
- CTA: 可視文言だけでも結果が分かり、custom button／linkは同じ意味の `aria-label` を持つ。
- details: `詳しい説明: ...` または `管理者向け: ...` のsummaryを持ち、閉じた状態でも目的を判断できる。

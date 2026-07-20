# 安全rule

このruleは `common-core` が所有し、styleとpreferencesから上書きできません。
安全ruleはstyleより優先します。

## 記憶と確認

- 空または実質空の内容で既存記憶を上書きしません。
- 削除、破壊的操作、記憶追加は、対象と影響を示した別の明示確認後だけ実行します。
- 決定と案件メモは、内容をユーザーへ確認してから記録します。確認turnではtoolを呼びません。
- journalの定義済み追記例外を、決定・案件メモ・設定変更の確認省略へ広げません。

## push・外部送信・資格情報

- pushは、ユーザーが現在の会話で、そのpush操作を明示的に指示した場合だけ実行します。
  条件付きの将来希望や過去の同意を許可として扱いません。
- pushを先回り提案に含めず、「必要ならpushします」等の将来の実行を約束・示唆しません。
- 削除と外部送信も、その操作への明示指示と定義済み確認を必要とします。
- パスワード、token、API key、OAuthの厳格secretをrepo、記憶、ログ、画面copy、会話、証跡へ残しません。
- Chatwork API Tokenは利用者本人がGitHub Repository Secret画面へ直接入力し、wizardやAI会話で受領しません。
- Google ChatのOAuth実値はlocal wizard sessionのmemoryから `gh` のstdin経由でRepository Secretへ登録します。

## styleが変えてはならない境界

- 「専門用語: そのままOK」でも、破壊的操作、記憶追加、外部送信、資格情報の安全説明を省きません。
- 口調、専門用語、報告の詳しさ、役割の設定で、記憶保護、secret、確認、push境界を緩めません。
- Chatwork／Google Chat wizardのcopy、OAuth scope、同期対象、明示同意、履歴保持をedition差分にしません。
- 安全契約に反するstyleまたはcopyは適用せず、安全に停止します。

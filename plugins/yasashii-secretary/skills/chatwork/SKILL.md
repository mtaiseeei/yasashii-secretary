---
name: chatwork
description: Chatworkの初回接続、room選択、同期状態の確認、保存済み履歴の検索を行う。ユーザーが「Chatworkにつなぎたい」「roomを選びたい」「Chatworkで探して」「/chatwork」と依頼したときに使う。
---

# Chatwork

同じprivate GitHub repoに、選択したroomの履歴だけを保存する。API TokenはGitHub Actionsの
Repository Secretだけに置き、会話、repo、wizard、ログへ値を受け取らない。

最初に `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読む。通常報告の行数やprefixをここで再定義せず、すべての
tool実行後に同ruleの「最終応答serializer」を1回だけ適用する。

## 状態を先に示す

repo rootの次を確認し、状態と次の行動を1つだけ返す。

- `chatwork/config.json` が無い: `未接続`。workspace初回設定へ進む。
- `chatwork/rooms.json` が `not-discovered`: `room一覧の取得待ち`。Secret登録とroom discoveryを案内する。
- 選択roomが0件: `room選択待ち`。wizardを開く。
- `chatwork/state/sync.json` が成功: `初回取得済み`。検索または設定見直しへ進む。
- discovery／syncが失敗または部分失敗: `要確認`。日本語の失敗理由と再実行方法を示す。

## 初回接続

1. repoがprivateで、`secretary/`、通常project、`chatwork/` が同じrepo rootにあることを確認する。
2. Tokenの値を尋ねず、ユーザー自身が次を実行するよう案内する。

   `gh secret set CHATWORK_API_TOKEN`

   標準入力で値を渡すため、コマンド履歴へTokenを書かない。登録できたら値を読み戻さない。
3. 明示確認後、`gh workflow run chatwork-sync.yml -f mode=discover` を実行する。完了成功を確認して
   `git pull --ff-only` し、`chatwork/rooms.json` の状態を見る。
4. wizardをloopbackで起動する。

   `node "${CLAUDE_PLUGIN_ROOT}/skills/chatwork/scripts/wizard-server.mjs" --root .`

5. 表示された `http://127.0.0.1:<port>/` を開く。Token入力欄は作らない。

wizardの確定はroom設定を保存し、初回取得workflowを開始する。30分／1時間／3時間／6時間／12時間／
手動のみを選べるが、この段階では定期scheduleを有効化しない。確定前のキャンセルでは変更しない。

## 保存済み履歴を検索する

`git pull --ff-only` の成功後に次を実行する。

`node "${CLAUDE_PLUGIN_ROOT}/skills/chatwork/scripts/search.mjs" --root . --query "<キーワード>" [--room "<room名またはRoom ID>"] [--account "<発言者>"] [--from YYYY-MM-DD] [--to YYYY-MM-DD]`

foundならroom名、日付、該当箇所を根拠として返す。not foundなら「現在の保存済み履歴には見つからない」
と伝え、Chatworkに存在しないとは断定しない。確認付き手動同期と再検索はsprint-014の導線を使う。

## 取得境界

- 読むのは選択済みRoom IDだけ。room選択解除だけで取得済み履歴を削除しない。
- 初回は各roomの最新100件以内。0件は正常で、今後の同期から蓄積される。
- message IDで重複を防ぎ、API応答から消えただけの過去データを削除しない。
- 失敗時は認証、rate limit、network、room単位の部分失敗を区別する。Tokenや本文をエラーへ含めない。

## 参照

- wizard server: `${CLAUDE_PLUGIN_ROOT}/skills/chatwork/scripts/wizard-server.mjs`
- search: `${CLAUDE_PLUGIN_ROOT}/skills/chatwork/scripts/search.mjs`
- 言葉づかい: `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`

---
name: chatwork
description: Chatworkの初回接続、ルーム・自動取得の間隔の設定変更、取得状態の確認、保存済み履歴の検索、確認付き手動取得を行う。ユーザーが「Chatworkにつなぎたい」「ルームや自動取得の間隔を変えたい」「Chatworkで探して」「/chatwork」と依頼したときに使う。
---

# Chatwork

同じ非公開のGitHubリポジトリに、選択したルームの履歴だけを保存する。API TokenはGitHub上の
安全な保管場所（Repository Secret）だけに置き、会話、リポジトリ、wizard、ログへ値を受け取らない。
API Tokenは有効期限がなくChatwork機能へフルアクセスできるため、第三者へ見せないよう案内する。

最初に `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読む。通常報告の項目数、prefix、Markdown構造をここで再定義せず、すべての
tool実行後に同ruleの「最終応答serializer」を1回だけ適用する。

## 状態を先に示す

リポジトリrootの次を確認し、状態と次の行動を1つだけ返す。

- `chatwork/config.json` が無い: `未接続`。初回接続へ進む。
- `chatwork/rooms.json` が `not-discovered`: `ルーム一覧の取得待ち`。4段階の接続wizardへ進む。
- 選択ルームが0件: `ルーム選択待ち`。wizardを開く。
- `chatwork/state/sync.json` が成功: `初回取得済み`。検索または設定見直しへ進む。
- ルーム一覧取得／最新メッセージの取り込み（同期）が失敗または部分失敗: `要確認`。日本語の失敗理由と再実行方法を示す。

## 初回接続

1. リポジトリが非公開で、`secretary/`、通常プロジェクト、`chatwork/` が同じリポジトリrootにあることを確認する。
2. Tokenの値を尋ねず、ローカルwizardをloopbackで起動する。

   `node "${CLAUDE_PLUGIN_ROOT}/skills/chatwork/scripts/wizard-server.mjs" --root .`

3. 表示された `http://127.0.0.1:<port>/` を開き、次の4段階を順に進める。
   1. Chatwork公式のTokenページと発行ヘルプでAPI Tokenを取得する。Tokenページを使えない場合は、実際にAPIを使うアカウントで組織管理者へAPI利用申請し、承認後に戻る。承認前はルーム一覧を取得しない。
   2. wizardが現在のoriginから組み立てた `https://github.com/<owner>/<repo>/settings/secrets/actions/new` を「GitHub上の安全な保管場所を開く」で開く。GitHub.com以外や固定owner／repoのURLを使わない。
   3. GitHubのRepository Secret追加画面で、ユーザー自身が次の2欄へ入力する。
      - `Name` 欄: `CHATWORK_API_TOKEN`
      - `Secret` 欄: Chatwork公式画面で本人が取得したAPI Token

      Tokenの実値はGitHubの画面にだけ入力する。wizard、AIとの会話、リポジトリ、ログへ貼り付けず、
      登録後も値は読み戻さない。
   4. 確認後だけ、自動取得処理（GitHub Actions）で参加中のルーム一覧を取得する。
4. ルームを選び、自動取得の間隔、保存内容、自動保存の影響を確認する。

wizardの確定前に、対象ルーム、自動取得の間隔、同じ非公開のGitHubリポジトリへ本文を保存すること、
「取得結果をこのリポジトリへ自動保存します（Gitのcommit・push）」を示す。30分ごと／1時間ごと／
3時間ごと（おすすめ・初期値）／6時間ごと／12時間ごとは明示同意後だけ17分起点の自動実行を有効化する。
手動のみは自動実行を作らない。確定前のキャンセルでは変更せず、ルーム解除でも取得済み履歴を削除しない。

自動取得の間隔には、30日換算の概算実行回数を順に約1,440回／720回／240回／120回／60回／0回と表示する。
GitHub Freeの非公開リポジトリで2026年7月時点に含まれる月2,000分はGitHub Actionsの処理時間枠であり、
2,000回ではない。プラン、runner、1回の処理時間で変わり、料金・枠も変更されうるため公式billingを確認する。

## 保存済み履歴を検索する

低自由度の検索手順は `search-flow.mjs` に任せる。最初は `--choice` を付けない。

`node "${CLAUDE_PLUGIN_ROOT}/skills/chatwork/scripts/search-flow.mjs" --root . --query "<キーワード>" [--room "<ルーム名またはルームID>"] [--account "<発言者>"] [--from YYYY-MM-DD] [--to YYYY-MM-DD]`

`found`ならルーム名、日付、該当箇所を根拠として返す。`needs-choice`ならhostの
AskUserQuestionまたはstructured inputで、scriptが返した3択をそのまま提示する。通常の自由文質問へ置き換えない。

- 同期して再検索: 同じコマンドへ `--choice sync` を追加する。
- 同期しない: `--choice decline` を追加する。
- 対象ルームを見直す: `--choice review` を追加し、wizardへ戻る。

`sync`だけが自動取得処理（GitHub Actions）を開始する。scriptはpull→検索→dispatch→wait→成功確認→pull→同条件retryの順を固定する。
失敗・timeout・競合では前回履歴を検索可能なままにし、不要なcommit・pushを行わない。

## 取得境界

- 読むのは選択済みルームIDだけ。ルーム選択解除だけで取得済み履歴を削除しない。
- 初回は各ルームの最新100件以内。0件は正常で、今後の最新メッセージの取り込み（同期）から蓄積される。
- message IDで重複を防ぎ、API応答から消えただけの過去データを削除しない。
- 失敗時は認証、rate limit、network、GitHub権限、自動取得処理の失敗、timeout、git競合、ルーム単位の部分失敗を区別する。Tokenや本文をエラーへ含めない。
- 同期失敗時は最終成功時刻と取得位置を進めず、ルームが1件でも失敗した回は履歴を更新しない。

## 公式リンク（2026年7月確認）

- ChatworkでAPI Tokenを取得する: `https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php`
- API Tokenの発行方法を見る: `https://help.chatwork.com/hc/ja/articles/115000172402-API%E3%83%88%E3%83%BC%E3%82%AF%E3%83%B3%E3%82%92%E7%99%BA%E8%A1%8C%E3%81%99%E3%82%8B`
- 組織契約のAPI利用申請を見る: `https://help.chatwork.com/hc/ja/articles/115000169501-API%E3%81%AE%E5%88%A9%E7%94%A8%E7%94%B3%E8%AB%8B%E3%82%92%E6%89%BF%E8%AA%8D-%E5%8D%B4%E4%B8%8B%E3%81%99%E3%82%8B`
- GitHub Actionsの料金と利用枠を見る: `https://docs.github.com/en/billing/concepts/product-billing/github-actions`

公式情報は2026年7月確認。サービス側の変更により手順・料金・利用枠が変わる可能性がある。

## 参照

- wizard server: `${CLAUDE_PLUGIN_ROOT}/skills/chatwork/scripts/wizard-server.mjs`
- search: `${CLAUDE_PLUGIN_ROOT}/skills/chatwork/scripts/search.mjs`
- search flow: `${CLAUDE_PLUGIN_ROOT}/skills/chatwork/scripts/search-flow.mjs`
- 言葉づかい: `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`

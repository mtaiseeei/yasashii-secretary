---
name: onboarding
description: >
  秘書の初回セットアップ。やさしい数問だけ伺って、秘書ディレクトリ（secretary/）を作り、
  git で最初の区切りを記録する。初めて /secretary を呼んだときに使う。
---

# オンボーディング（初回セットアップ）

## plugin root（必須）

このSKILL.mdの実ファイル絶対pathを `SECRETARY_SKILL_FILE` に入れ、最初に1回だけ解決する。
空・相対path・未解決placeholderならcommandへ渡さず停止し、cwdやhost固有の環境変数から推測しない。

```bash
SECRETARY_SKILL_FILE="<このSKILL.mdの実ファイル絶対path>"
case "$SECRETARY_SKILL_FILE" in /*/skills/*/SKILL.md) ;; *) exit 2 ;; esac
SECRETARY_PLUGIN_ROOT="$(node "$(dirname "$SECRETARY_SKILL_FILE")/../../scripts/resolve-plugin-root.mjs" --skill-file "$SECRETARY_SKILL_FILE")" || exit 2
```

以後の共通file参照は `${SECRETARY_PLUGIN_ROOT}` を使う。

初めての人に、やさしい数問だけを伺い、その回答で秘書ディレクトリ（`secretary/` フォルダ）を作ります。
最後に作業中フォルダを1つのprivate GitHub repo（GitHub上で、自分や許可した人だけが見られる非公開の保存場所）にし、秘書ディレクトリ、Chatwork／Google Chatの設定とworkflowなど、この初期設定が所有するファイルだけを最初のコミットへ入れて初回pushします。push（手元の変更をGitHubへ送る操作）は、この初回セットアップの必須の仕上げです。作業前からある無関係なファイルは初回コミットへ含めません。
このrepoが秘書、通常のproject、選択したChatworkルームとGoogle Chat通常スペースの履歴をまとめる共通workspaceです。Google ChatのCloud準備と接続用JSON取得は、この初回セットアップとは別に、AIとの会話で一つずつ進めます。

`${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md` と、既存の秘書ディレクトリがある場合は
`secretary/memory/preferences.md` を読む。質問turnと作業結果だけをrouterへ返し、
通常報告を独自に包装しない。最終出力形は同rule入口から解決される「最終応答serializer」だけを正本とする。

## はじめに: 既に秘書ディレクトリがある場合の保護（作り直し）

作業中フォルダに既に `secretary/` があるなら、**いきなり作り直さない**。既存の記憶・成果物を**無確認で上書き・再 `git init` しない**。

1. 既に秘書ディレクトリがあること、作り直すと今の記憶・成果物が置き換わることを日常語で伝える。
2. 念のためのバックアップを提案する（例: `cp -R secretary secretary.backup-YYYY-MM-DD`。トークン等が混じらないか確認する）。
3. 「はい、作り直してください」と**明示的に**言われたときだけ、下のステップ1以降に進む。それ以外は中断する。

`secretary/` が無い（初回）なら、そのまま下の予告 → ステップ1へ進む。

## はじめの一言（予告）

いきなり作り始めず、まず一言だけ予告する。例:

> はじめまして。あなた専属の秘書になります。
> まず6つだけ伺います。最初に私自身の英語名を決め、そのあと秘書ディレクトリ（secretary/）を用意し、private GitHub repoへの初回pushまで進めます。

## ステップ1: やさしい6問（計画）

`AskUserQuestion` などで、1問ずつやさしく尋ねる。専門用語は使わない。各問に具体例を添える。

### Q0: 秘書自身の英語名

> この秘書自身の名前を決めます。どちらにしますか？
>
> - **希望の英語名**（例: Alex。入力した名前を確認します）
> - **おまかせ**（呼びやすい英語名を1つ、短い理由つきで提案します）

希望名は `node "${SECRETARY_PLUGIN_ROOT}/scripts/secretary-name.mjs" validate "<候補>"` で検査する。
おまかせは同scriptの `suggest --seed <workspaceを特定しない非機密の一時seed>` をread-onlyで使う。
空、メール、path／command風、制御文字、汎用bot名、日本語名は保存しない。候補を解決してもまだwriteしない。

利用者の呼び方とは別設定であることを説明し、次を別turnで確認する。

> 保存する秘書名: `<SECRETARY_NAME>`
> あなたの呼び方は別に伺い、ここでは変更しません。この英語名で進めますか？

明示了承までdirectory、identity、marker、registry、user-scope file、journal、commitを変更しない。
了承後にstable `SECRETARY_ID`を1つ生成し、renameで変えない。既存利用者の後付けはname Skillを使う。

### Q1: 呼び方

Claude Codeの `AskUserQuestion`、Codexの構造化ユーザー入力とも、同じ意味の次の4経路を使う。
host UIが「その他」を自動で付ける場合は、明示候補を最初の3件だけにして重複させない。
自動付与がないhostだけ4件目を表示する。

> あなたのことを何とお呼びすればよいですか？
>
> - **あなた**（おすすめ。個人名を使わず始める）
> - **アカウント名**（利用できる表示名候補から選ぶ）
> - **指定の名前**（短い名前を入力する）
> - **その他**（hostが自動付与しない場合だけ表示）

選択への未回答は「あなた」へ解決する。「指定の名前」と「その他」は短い自由入力を1回受け、
空なら「あなた」へ解決する。値を解決しただけでは、まだfileやdirectoryを作らない。

「アカウント名」が選ばれた後だけ、次の共通moduleを使う。他の3経路ではmoduleを呼ばず、
Git／OSを読まない。

```text
node "${SECRETARY_PLUGIN_ROOT}/scripts/name-candidates.mjs"
```

moduleへは現在タスクへhostが既に渡している値だけを標準入力のJSONとして渡す。
`selection` は `account-name`、`hostTaskContext` は利用できる項目だけにする。

- `currentConversationName`: 現在会話で明示された名前
- `personalizationPreferredName`: Personalizationのpreferred name
- `projectUserName`: Project文脈の利用者名
- `memoryName`: 現在タスクへhostが提供済みの過去会話の記憶

任意の過去会話、別task、raw transcript、生session log、memory storeを直接検索しない。
moduleは続けて `git config user.name`、OSユーザー名をread-onlyで確認する。email、remote、
credential、commit history、home path解析、directory列挙は行わない。

候補は値と短い出典だけを示し、最上位の1件へ「おすすめ」を付ける。除外値やraw contextは示さない。
候補0件なら「アカウント名は利用できません」と伝え、「あなた」「指定の名前」「その他」へ戻す。
候補一覧、除外値、出典、推奨順位はfile、journal、設定、decision、logへ保存しない。

どの経路でも `OWNER_NAME` を解決したら、**ステップ2より前の別turn**で次だけを確認する。

> 保存する呼び方: `<OWNER_NAME>`
> この呼び方で秘書の初期設定を作成しますか？

「はい」等の明示了承があるまで、edition guardを含むcommandを呼ばず、directory／file／marker／journal／commitを
作らない。訂正なら新しい値をもう一度表示して確認する。キャンセル、別の話題、保存確認未完了なら副作用0件で終了する。

### Q2: 主に使うサービス

> メールや予定表は、主にどちらをお使いですか？（あとから変えられます）
>
> - 1) **Google**（Gmail・Googleカレンダー・Googleドライブ）
> - 2) **Microsoft**（Outlook・予定表・OneDrive）
> - 3) **まだ決めていない / 特に使っていない**

回答を `PRIMARY_SERVICE` に記録（`Google` / `Microsoft` / `まだ決めていない`）。

### Q3: 秘書に任せたいこと

> どんなことを秘書に任せたいですか？（複数OK・あとで増やせます）
>
> - 1) **今日やることの整理**（予定とTODOの突き合わせ）
> - 2) **調べもの・下書き**（企画書や調査のまとめ）
> - 3) **記憶・メモの管理**（決めたこと・好みを覚えておく）
> - 4) その他（自由に一言）

回答を `TASKS` に記録（選んだ項目を「、」でつないだ文にする）。

### Q4: お仕事・役割

> お仕事や役割を一言で教えてください。提案や例を、実際の仕事に近づけるために使います。
> 例: 「営業」「講師」「会社経営」「地域団体の事務局」。未回答なら「未設定」で始められます。

回答を `OWNER_ROLE` に記録（未回答なら「未設定」）。役割から職歴・案件・数値を推測して足さない。

### Q5: 説明の詳しさ

> 報告の詳しさは、どれで始めますか？
>
> - 1) **みじかく**（おすすめ。内容に必要な要素だけ）
> - 2) **くわしく**（同じ内容に必要な根拠や補足を加える）
> - 3) **おまかせ**（みじかくで開始。あとから変更できます）

回答を `REPORT_DETAIL` に記録（1=`みじかく`、2=`くわしく`、3または未回答=`みじかく`）。
口調は初回に質問しない。丁寧で堅すぎない「丁寧（標準）」で開始する。

## ステップ2: 秘書ディレクトリを作る（道具）

Q1の保存確認を別turnで明示了承された場合だけ、ここへ進む。

<!-- yasashii-secretary:clarity-collaboration:onboarding:v1 -->

Project Clarityは任意機能として案内する。新規workspace作成だけでClarityを初期化せず、Project作成、TODO、memory、
外部connector、Xmind fileを追加しない。Agentic public版のXmind integration既定はOFFであり、ON／OFF設定と
provider接続・capability・verified・課金承認を別に扱う。利用者が後からClarityを明示した場合だけ、
`clarity` Skillのread-only previewから始める。MCP不可時もlocal `.xmind`へ自動writeしない。

「いまは『道具』の段階です。秘書ディレクトリを用意しています」と一言添えてから、次を行う。

最初のdirectory・fileを書き込む前に、必ず共通edition guardを実行する。

```text
node "${SECRETARY_PLUGIN_ROOT}/scripts/edition-guard.mjs" --workspace . --plugin-root "${SECRETARY_PLUGIN_ROOT}" --entry onboarding --prepare-new --json
```

`new` だけが先へ進み、この時点でneutral markerを作る。`same-edition`、`legacy-yasashii`、`opposite-edition`、`mixed`、`unknown` は、
検出した状態、現在のworkspace、実行しなかった操作を示して停止する。ledger、marker、履歴、設定を移動・削除・上書きしない。
既存workspaceの作り直しは、この導線へ混ぜず別の明示的な保護手順として扱う。

**穴埋め変数の対応表**（テンプレートの `{{...}}` をこの値に置き換える）:

| 変数 | 入る値 | 備考 |
|---|---|---|
| `{{SECRETARY_NAME}}` | Q0で確認済みの秘書自身の英語名 | 利用者の呼び方と別 |
| `{{SECRETARY_ID}}` | Q0確認後に生成したUUID | renameで不変 |
| `{{CREATED_AT_ISO}}` | identity作成時刻（ISO 8601） | author identity用 |
| `{{OWNER_NAME}}` | Q1 の利用者の呼び方 | 未回答なら「あなた」 |
| `{{PRIMARY_SERVICE}}` | Q2 の選択（`Google` / `Microsoft` / `まだ決めていない`） | |
| `{{PRIMARY_SERVICE_DETAIL}}` | サービスの中身 | Google→「Gmail / Googleカレンダー / Googleドライブ」、Microsoft→「Outlook / 予定表 / OneDrive」、まだ決めていない→「あとで決める」 |
| `{{TASKS}}` | Q3 の回答（読める文） | 例: 「今日やることの整理、調べもの・下書き」 |
| `{{OWNER_ROLE}}` | Q4 のお仕事・役割 | 未回答なら「未設定」 |
| `{{REPORT_DETAIL}}` | Q5 の詳しさ | `みじかく` / `くわしく`。おまかせは `みじかく` |
| `{{CREATED_DATE}}` | 今日の日付 `YYYY-MM-DD` | |
| `{{CREATED_AT}}` | 今日の日時 `YYYY-MM-DD HH:mm` | |

雛形の置き場所は `${SECRETARY_PLUGIN_ROOT}/templates/` に統一されている。
`SECRETARY_PLUGIN_ROOT` は上の共通規則でこのSKILL.md自身の実pathから解決した値だけを使う。

**生成手順**（`${SECRETARY_PLUGIN_ROOT}/templates/` の雛形を実体化して穴埋めする。同じ回答なら毎回同じ構造になる）:

1. 作業中のフォルダに `secretary/` を作る。
2. `${SECRETARY_PLUGIN_ROOT}/templates/` の中身を `secretary/` にコピーする（雛形の実体化）。
   - `${SECRETARY_PLUGIN_ROOT}/templates/AGENTS.md` → `secretary/AGENTS.md`
   - `${SECRETARY_PLUGIN_ROOT}/templates/CLAUDE.md` → `secretary/CLAUDE.md`
   - `${SECRETARY_PLUGIN_ROOT}/templates/identity.json` → `secretary/identity.json`
   - `${SECRETARY_PLUGIN_ROOT}/templates/inbox/`・`${SECRETARY_PLUGIN_ROOT}/templates/docs/`・`${SECRETARY_PLUGIN_ROOT}/templates/projects/`（`.gitkeep` ごと） → `secretary/` 配下へ
   - `${SECRETARY_PLUGIN_ROOT}/templates/memory/MEMORY.md` → `secretary/memory/MEMORY.md`
   - `${SECRETARY_PLUGIN_ROOT}/templates/memory/preferences.md` → `secretary/memory/preferences.md`
   - `${SECRETARY_PLUGIN_ROOT}/templates/memory/decisions/_first-decision.md` → `secretary/memory/decisions/{{CREATED_DATE}}-decisions.md`（名前を日付にする）
   - `${SECRETARY_PLUGIN_ROOT}/templates/memory/journal/`・`${SECRETARY_PLUGIN_ROOT}/templates/memory/archive/`・`${SECRETARY_PLUGIN_ROOT}/templates/memory/topics/` → 同名のディレクトリ
3. コピーした各ファイルの中の `{{...}}` を、上の対応表の値ですべて置き換える。
4. 秘書ディレクトリの中身が、次の構造になっていることを確かめる:
   ```
   secretary/
   ├── AGENTS.md
   ├── CLAUDE.md
   ├── inbox/
   ├── docs/
   ├── projects/
   └── memory/
       ├── MEMORY.md
       ├── decisions/YYYY-MM-DD-decisions.md
       ├── journal/
       ├── archive/journal/
       ├── topics/
       └── preferences.md
   ```
   `secretary/identity.json` は `display_name`、stable `secretary_id`、`actor_type=ai-secretary`、`aliases` を持つ。
   `secretary/projects/open/<project>/clarity/`はClarityを明示導入したProjectだけに後から作る任意領域であり、
   onboardingでは生成しない。
5. `${SECRETARY_PLUGIN_ROOT}/workspace-templates/` の中身を、`secretary/` の中ではなく作業中フォルダのrootへコピーする。
   これにより `.github/workflows/chatwork-sync.yml` と `chatwork/` が通常project、`secretary/` と同じrepoに並ぶ。Google ChatはCloud準備と接続用JSONの取得後、専用wizardで選んだ通常スペースだけを同じrepoへ追加する。
   既存ファイルと重なる場合は無確認で上書きせず、変更前に対象を示して確認する。
6. **新規導入時だけ**、生成直後の状態をedition中立markerとedition付き最小台帳へ記録する。これは将来の更新診断で、配布時のままか利用者が変更したかを区別するための基準であり、本文は保存しない。
   `${SECRETARY_PLUGIN_ROOT}/scripts/update-ledger.mjs init` を使い、存在する生成物だけを `--managed-path` で指定する。
   `--template-variable` に渡してよいのは `CREATED_DATE`、`CREATED_AT`、`REPORT_DETAIL` だけである。
   氏名、役割、サービス、依頼内容、パスワード、token、API keyは渡さない。

   ```text
   node "${SECRETARY_PLUGIN_ROOT}/scripts/update-ledger.mjs" init --workspace . --plugin-root "${SECRETARY_PLUGIN_ROOT}" --managed-path secretary/AGENTS.md --managed-path secretary/CLAUDE.md --managed-path secretary/identity.json --managed-path secretary/memory/MEMORY.md --managed-path secretary/memory/preferences.md --managed-path secretary/memory/decisions/YYYY-MM-DD-decisions.md --managed-path .github/workflows/chatwork-sync.yml --managed-path chatwork/config.json --managed-path chatwork/rooms.json --managed-path chatwork/scripts/chatwork-sync.mjs --template-variable CREATED_DATE=YYYY-MM-DD --template-variable CREATED_AT="YYYY-MM-DD HH:mm" --template-variable REPORT_DETAIL=みじかく --new-install --confirm
   ```

   `YYYY-MM-DD` 等は実際に使った非機密の値へ置き換える。新規台帳は `schemaVersion` と `edition` を持つ。
   既存workspace、再セットアップ、診断時には台帳やmarkerを新規作成・上書きしない。

> 注意（安全）: 資格情報（パスワード・トークン・APIキー）は書き込まない・コミットしない。
> 外部データ本文は、専用の接続設定で利用者が明示的に選んだ範囲だけを保存する。Chatworkは選択したルーム、Google Chatは選択した通常スペースだけを、それぞれの専用領域へ保存する。

## ステップ3: 1つのprivate repoへ初回pushする（確認）

「いまは『確認』の段階です。保存先と初回pushの内容を確認します」と一言添える。

1. 作業中フォルダのrootに既存remoteがあるか確認する。`secretary/.git` は作らず、nested repoにしない。
2. 既存remoteがある場合は別repoを作らない。remote URLとprivate状態を示し、現在のrepoを使うか明示確認する。
   確認前はcommit、remote変更、pushを行わない。public repoなら中断する。
3. remoteが無い場合は、repo名、privateであること、保存対象（秘書・通常project・Chatwork／Google Chat設定）を示して確認する。
4. 明示確認後だけ、workspace rootで次の決定的スクリプトを実行する。

   `node "${SECRETARY_PLUGIN_ROOT}/scripts/workspace-repo.mjs" publish --root . --repo "<repo名>" --visibility private --confirm`

   既存private remoteを使う確認が取れた場合は `--use-existing-remote` を付ける。API Tokenらしきファイルを検出した場合はcommitせず止める。
5. 完了結果からprivate状態、remote URL、初回push成功を確認する。失敗時は再実行前に、何が起きたかと変更済み範囲を示す。

git の英語エラーが出たら、そのまま見せず「何が起きて・どうすれば直るか」に言い換えてから伝える
（例: 名前を入力してくださいという趣旨のエラーなら、git の名前設定を一緒に案内する）。

## ステップ4: 完了時にrouterへ返す内容

- 秘書ディレクトリ（`secretary/`）を作成したことと、その場所。
- `AGENTS.md`、`MEMORY.md`等を用意し、この初期設定が作成・管理するファイルだけを1つのprivate repoへ初回pushしたこと。作業前からある無関係なファイルは含めていないこと。
- private状態、remote、初回push結果。
- 新規生成workflowのbot名は `secretary[bot]`。既存workspaceのbot名やworkflowは変更しない。
- 秘書名、stable ID、AI種別を設定し、利用者の呼び方とは別であること。別repo呼び出しはname Skillで効果と対象fileを示し、明示確認後だけ有効化できること。
- 次に試せる操作として /chatwork でルーム接続、または「Google Chatを設定したい」でCloud準備へ進めることと、「設定はいつでも『設定変えたい』で変更できます」という案内。
- Project Clarityは任意で、Agentic版のXmind integration既定はOFFであること。使う場合は「クラリティを初期化」と明示し、read-only previewから始めること。

ここでは内容と安全条件だけをrouterへ返す。通常報告の項目数、prefix、Markdown構造、完成例は持たず、
`plain-language.md` から解決される「最終応答serializer」に任せる。

## 参照

- 言葉づかいルール（必読）: `${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md`
- 雛形の置き場所: `${SECRETARY_PLUGIN_ROOT}/templates/`
- 生成物の構造・6規律は、生成される `secretary/AGENTS.md`（雛形: `${SECRETARY_PLUGIN_ROOT}/templates/AGENTS.md`）に記載

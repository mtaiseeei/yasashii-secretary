---
name: onboarding
description: >
  秘書の初回セットアップ。やさしい数問だけ伺って、秘書ディレクトリ（secretary/）を作り、
  git で最初の区切りを記録する。初めて /secretary を呼んだときに使う。
---

# オンボーディング（初回セットアップ）

初めての人に、やさしい数問だけを伺い、その回答で秘書ディレクトリ（`secretary/` フォルダ）を作ります。
最後に作業中フォルダを1つのprivate GitHub repoにし、秘書ディレクトリ、Chatwork／Google Chatの設定とworkflowなど、この初期設定が所有するファイルだけを最初のコミットへ入れて初回pushします。作業前からある無関係なファイルは初回コミットへ含めません。
このrepoが秘書、通常のproject、選択したChatworkルームとGoogle Chat通常スペースの履歴をまとめる共通workspaceです。Google ChatのCloud準備と接続用JSON取得は、この初回セットアップとは別に、AIとの会話で一つずつ進めます。

`${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` と、既存の秘書ディレクトリがある場合は
`secretary/memory/preferences.md` を読む。質問turnと作業結果だけをrouterへ返し、
通常報告を独自に包装しない。最終出力形は同ruleの「最終応答serializer」だけを正本とする。

## はじめに: 既に秘書ディレクトリがある場合の保護（作り直し）

作業中フォルダに既に `secretary/` があるなら、**いきなり作り直さない**。既存の記憶・成果物を**無確認で上書き・再 `git init` しない**。

1. 既に秘書ディレクトリがあること、作り直すと今の記憶・成果物が置き換わることを日常語で伝える。
2. 念のためのバックアップを提案する（例: `cp -R secretary secretary.backup-YYYY-MM-DD`。トークン等が混じらないか確認する）。
3. 「はい、作り直してください」と**明示的に**言われたときだけ、下のステップ1以降に進む。それ以外は中断する。

`secretary/` が無い（初回）なら、そのまま下の予告 → ステップ1へ進む。

## はじめの一言（予告）

いきなり作り始めず、まず一言だけ予告する。例:

> はじめまして。あなた専属の秘書になります。
> まず5つだけ伺います。そのあと秘書ディレクトリ（secretary/）を用意し、private GitHub repoへの初回pushまで進めます。

## ステップ1: やさしい5問（計画）

`AskUserQuestion` などで、1問ずつやさしく尋ねる。専門用語は使わない。各問に具体例を添える。

### Q1: 呼び方

> あなたのことを何とお呼びすればよいですか？
> 例: 「村山さん」「たいせいさん」「社長」など。決めていなければ「おまかせ」でも大丈夫です。

回答を `OWNER_NAME` に記録（未回答なら「あなた」）。

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
> - 1) **みじかく**（おすすめ。やったこと／結果／次の3行）
> - 2) **くわしく**（3行に補足を1つ）
> - 3) **おまかせ**（みじかくで開始。あとから変更できます）

回答を `REPORT_DETAIL` に記録（1=`みじかく`、2=`くわしく`、3または未回答=`みじかく`）。
口調は初回に質問しない。丁寧で堅すぎない「丁寧（標準）」で開始する。

## ステップ2: 秘書ディレクトリを作る（道具）

「いまは『道具』の段階です。秘書ディレクトリを用意しています」と一言添えてから、次を行う。

**穴埋め変数の対応表**（テンプレートの `{{...}}` をこの値に置き換える）:

| 変数 | 入る値 | 備考 |
|---|---|---|
| `{{OWNER_NAME}}` | Q1 の呼び方 | 未回答なら「あなた」 |
| `{{PRIMARY_SERVICE}}` | Q2 の選択（`Google` / `Microsoft` / `まだ決めていない`） | |
| `{{PRIMARY_SERVICE_DETAIL}}` | サービスの中身 | Google→「Gmail / Googleカレンダー / Googleドライブ」、Microsoft→「Outlook / 予定表 / OneDrive」、まだ決めていない→「あとで決める」 |
| `{{TASKS}}` | Q3 の回答（読める文） | 例: 「今日やることの整理、調べもの・下書き」 |
| `{{OWNER_ROLE}}` | Q4 のお仕事・役割 | 未回答なら「未設定」 |
| `{{REPORT_DETAIL}}` | Q5 の詳しさ | `みじかく` / `くわしく`。おまかせは `みじかく` |
| `{{CREATED_DATE}}` | 今日の日付 `YYYY-MM-DD` | |
| `{{CREATED_AT}}` | 今日の日時 `YYYY-MM-DD HH:mm` | |

雛形の置き場所は `${CLAUDE_PLUGIN_ROOT}/templates/` に統一されている（`CLAUDE_PLUGIN_ROOT` はこのプラグインのインストール先を指す変数。開発時のリポジトリ配置でも実インストール先でも解決できる。万一この変数が未設定の場合は、この SKILL.md 自身の場所を起点に `../../templates/` を雛形の置き場所として使う）。

**生成手順**（`${CLAUDE_PLUGIN_ROOT}/templates/` の雛形を実体化して穴埋めする。同じ回答なら毎回同じ構造になる）:

1. 作業中のフォルダに `secretary/` を作る。
2. `${CLAUDE_PLUGIN_ROOT}/templates/` の中身を `secretary/` にコピーする（雛形の実体化）。
   - `${CLAUDE_PLUGIN_ROOT}/templates/AGENTS.md` → `secretary/AGENTS.md`
   - `${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md` → `secretary/CLAUDE.md`
   - `${CLAUDE_PLUGIN_ROOT}/templates/inbox/`・`${CLAUDE_PLUGIN_ROOT}/templates/docs/`・`${CLAUDE_PLUGIN_ROOT}/templates/projects/`（`.gitkeep` ごと） → `secretary/` 配下へ
   - `${CLAUDE_PLUGIN_ROOT}/templates/memory/MEMORY.md` → `secretary/memory/MEMORY.md`
   - `${CLAUDE_PLUGIN_ROOT}/templates/memory/preferences.md` → `secretary/memory/preferences.md`
   - `${CLAUDE_PLUGIN_ROOT}/templates/memory/decisions/_first-decision.md` → `secretary/memory/decisions/{{CREATED_DATE}}-decisions.md`（名前を日付にする）
   - `${CLAUDE_PLUGIN_ROOT}/templates/memory/journal/`・`${CLAUDE_PLUGIN_ROOT}/templates/memory/archive/`・`${CLAUDE_PLUGIN_ROOT}/templates/memory/topics/` → 同名のディレクトリ
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
5. `${CLAUDE_PLUGIN_ROOT}/workspace-templates/` の中身を、`secretary/` の中ではなく作業中フォルダのrootへコピーする。
   これにより `.github/workflows/chatwork-sync.yml` と `chatwork/` が通常project、`secretary/` と同じrepoに並ぶ。Google ChatはCloud準備と接続用JSONの取得後、専用wizardで選んだ通常スペースだけを同じrepoへ追加する。
   既存ファイルと重なる場合は無確認で上書きせず、変更前に対象を示して確認する。
6. **新規導入時だけ**、生成直後の状態を最小台帳へ記録する。これは将来の更新診断で、配布時のままか利用者が変更したかを区別するための基準であり、本文は保存しない。
   `${CLAUDE_PLUGIN_ROOT}/scripts/update-ledger.mjs init` を使い、存在する生成物だけを `--managed-path` で指定する。
   `--template-variable` に渡してよいのは `CREATED_DATE`、`CREATED_AT`、`REPORT_DETAIL` だけである。
   氏名、役割、サービス、依頼内容、パスワード、token、API keyは渡さない。

   ```text
   node "${CLAUDE_PLUGIN_ROOT}/scripts/update-ledger.mjs" init --workspace . --plugin-root "${CLAUDE_PLUGIN_ROOT}" --managed-path secretary/AGENTS.md --managed-path secretary/CLAUDE.md --managed-path secretary/memory/MEMORY.md --managed-path secretary/memory/preferences.md --managed-path secretary/memory/decisions/YYYY-MM-DD-decisions.md --managed-path .github/workflows/chatwork-sync.yml --managed-path chatwork/config.json --managed-path chatwork/rooms.json --managed-path chatwork/scripts/chatwork-sync.mjs --template-variable CREATED_DATE=YYYY-MM-DD --template-variable CREATED_AT="YYYY-MM-DD HH:mm" --template-variable REPORT_DETAIL=みじかく --new-install --confirm
   ```

   `YYYY-MM-DD` 等は実際に使った非機密の値へ置き換える。既存workspace、再セットアップ、診断時には台帳を新規作成・上書きしない。

> 注意（安全）: 資格情報（パスワード・トークン・APIキー）は書き込まない・コミットしない。
> 外部データ本文は、専用の接続設定で利用者が明示的に選んだ範囲だけを保存する。Chatworkは選択したroom、Google Chatは選択した通常スペースだけを、それぞれの専用領域へ保存する。

## ステップ3: 1つのprivate repoへ初回pushする（確認）

「いまは『確認』の段階です。保存先と初回pushの内容を確認します」と一言添える。

1. 作業中フォルダのrootに既存remoteがあるか確認する。`secretary/.git` は作らず、nested repoにしない。
2. 既存remoteがある場合は別repoを作らない。remote URLとprivate状態を示し、現在のrepoを使うか明示確認する。
   確認前はcommit、remote変更、pushを行わない。public repoなら中断する。
3. remoteが無い場合は、repo名、privateであること、保存対象（秘書・通常project・Chatwork／Google Chat設定）を示して確認する。
4. 明示確認後だけ、workspace rootで次の決定的スクリプトを実行する。

   `node "${CLAUDE_PLUGIN_ROOT}/scripts/workspace-repo.mjs" publish --root . --repo "<repo名>" --visibility private --confirm`

   既存private remoteを使う確認が取れた場合は `--use-existing-remote` を付ける。API Tokenらしきファイルを検出した場合はcommitせず止める。
5. 完了結果からprivate状態、remote URL、初回push成功を確認する。失敗時は再実行前に、何が起きたかと変更済み範囲を示す。

git の英語エラーが出たら、そのまま見せず「何が起きて・どうすれば直るか」に言い換えてから伝える
（例: 名前を入力してくださいという趣旨のエラーなら、git の名前設定を一緒に案内する）。

## ステップ4: 完了時にrouterへ返す内容

- 秘書ディレクトリ（`secretary/`）を作成したことと、その場所。
- `AGENTS.md`、`MEMORY.md`等を用意し、この初期設定が作成・管理するファイルだけを1つのprivate repoへ初回pushしたこと。作業前からある無関係なファイルは含めていないこと。
- private状態、remote、初回push結果。
- 次に試せる操作として /chatwork でroom接続、または「Google Chatを設定したい」でCloud準備へ進めることと、「設定はいつでも『設定変えたい』で変更できます」という案内。

ここでは内容と安全条件だけをrouterへ返す。通常報告の行数、prefix、完成例は持たず、
`plain-language.md` の「最終応答serializer」に任せる。

## 参照

- 言葉づかいルール（必読）: `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`
- 雛形の置き場所: `${CLAUDE_PLUGIN_ROOT}/templates/`
- 生成物の構造・6規律は、生成される `secretary/AGENTS.md`（雛形: `${CLAUDE_PLUGIN_ROOT}/templates/AGENTS.md`）に記載

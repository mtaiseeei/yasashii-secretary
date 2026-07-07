---
name: onboarding
description: >
  秘書の初回セットアップ。やさしい数問だけ伺って、秘書ディレクトリ（secretary/）を作り、
  git で最初の区切りを記録する。初めて /secretary を呼んだときに使う。
---

# オンボーディング（初回セットアップ）

初めての人に、やさしい数問だけを伺い、その回答で秘書ディレクトリ（`secretary/` フォルダ）を作ります。
最後に git で最初のコミット（作業の区切りの記録）を作ります。**push（インターネット上の保管先へ送ること）はしません**（ローカルのみ）。

ユーザーに話しかける前に、必ず `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`（言葉づかいルール）を読むこと。
報告は3行以内（やったこと／結果／次に何が起きるか）。一般に通じる技術用語はそのまま使い、馴染みの薄い語だけ初出で簡潔に補足する。進行は「計画→道具→確認→結果」で見せる。

## はじめの一言（予告）

いきなり作り始めず、まず一言だけ予告する。例:

> はじめまして。あなた専属の秘書になります。
> まず3つだけ伺います。そのあと「秘書」フォルダを用意し、最初の区切りを記録します（数十秒で終わります）。

## ステップ1: やさしい3問（計画）

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

## ステップ2: 秘書ディレクトリを作る（道具）

「いまは『道具』の段階です。秘書ディレクトリを用意しています」と一言添えてから、次を行う。

**穴埋め変数の対応表**（テンプレートの `{{...}}` をこの値に置き換える）:

| 変数 | 入る値 | 備考 |
|---|---|---|
| `{{OWNER_NAME}}` | Q1 の呼び方 | 未回答なら「あなた」 |
| `{{PRIMARY_SERVICE}}` | Q2 の選択（`Google` / `Microsoft` / `まだ決めていない`） | |
| `{{PRIMARY_SERVICE_DETAIL}}` | サービスの中身 | Google→「Gmail / Googleカレンダー / Googleドライブ」、Microsoft→「Outlook / 予定表 / OneDrive」、まだ決めていない→「あとで決める」 |
| `{{TASKS}}` | Q3 の回答（読める文） | 例: 「今日やることの整理、調べもの・下書き」 |
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
       └── preferences.md
   ```

> 注意（安全）: 資格情報（パスワード・トークン・APIキー）は書き込まない・コミットしない。外部データの本文はローカルに保存しない。

## ステップ3: 最初の区切りを記録する（確認）

「いまは『確認』の段階です。最初の区切りを記録します」と一言添えてから、`secretary/` の中で git を使う。

1. `secretary/` フォルダの中で `git init` する。
   - すでに親フォルダが git 管理下でも、秘書ディレクトリは `secretary/` 単独で `git init` する。
2. `secretary/` の中身をすべて追加して、日本語のメッセージで**最初のコミット**（作業の区切りの記録）を作る。
   - コミットメッセージ例: `秘書ディレクトリを作成（初回セットアップ）`
3. **push はしない**。リモート（インターネット上の保管先）の設定も、送信もしない。

git の英語エラーが出たら、そのまま見せず「何が起きて・どうすれば直るか」に言い換えてから伝える
（例: 名前を入力してくださいという趣旨のエラーなら、git の名前設定を一緒に案内する）。

## ステップ4: 完了報告（結果・3行型）

3行で伝える。場所は日常語で、次にできることを一言添える。例:

> 秘書ディレクトリ（secretary/）を作成しました。いまいるフォルダの中の「secretary」に、記憶と成果物の置き場を用意しました。
> 中には指示書（AGENTS.md）・記憶の目次（MEMORY.md）・空の受信箱などが入り、最初の区切りも記録済みです（インターネットには送っていません）。
> 次は「今日やること」や「〇〇を調べて」と話しかけてください。準備中の機能は、できあがり次第ご案内します。

## 参照

- 言葉づかいルール（必読）: `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`
- 雛形の置き場所: `${CLAUDE_PLUGIN_ROOT}/templates/`
- （開発者向け・このリポジトリの設計ドキュメント。実インストールには同梱されない）生成物の構造・規律の正本: `docs/spec/domain.md` / `docs/spec/constraints.md`

---
name: connections
description: >
  どのコネクタ（Google / Microsoft / Notion）と読取専用チャット（Chatwork / Google Chat）が繋がっているかを確認して一覧で返す接続診断。
  「繋がってる？」「接続の調子」「診断して」「どれが使える？」等で呼び出す。
---

# 接続診断（connections）

<!-- yasashii-secretary:clarity-collaboration:connector:v1 -->

接続診断は現在の依頼で明示された場合だけ行う。Project Clarityの閲覧、Item作成、Attention、Hookから
connector toolを呼ばず、接続済み・verifiedを推定しない。

## plugin root（必須）

このSKILL.mdの実ファイル絶対pathを `SECRETARY_SKILL_FILE` に入れ、最初に1回だけ解決する。
空・相対path・未解決placeholderならcommandへ渡さず停止し、cwdやhost固有の環境変数から推測しない。

```bash
SECRETARY_SKILL_FILE="<このSKILL.mdの実ファイル絶対path>"
case "$SECRETARY_SKILL_FILE" in /*/skills/*/SKILL.md) ;; *) exit 2 ;; esac
SECRETARY_PLUGIN_ROOT="$(node "$(dirname "$SECRETARY_SKILL_FILE")/../../scripts/resolve-plugin-root.mjs" --skill-file "$SECRETARY_SKILL_FILE")" || exit 2
```

以後の共通file参照は `${SECRETARY_PLUGIN_ROOT}` を使う。

Google・Microsoft・Notionと、明示設定したChatwork・Google Chatのうち、どれが繋がっているかを一目で分かるように確認する案内です。
コネクタは各サービスに置いたまま**都度参照**します（同期・コピーはしません）。

`${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読む。診断結果と安全条件だけをrouterへ返し、
通常報告を独自に包装しない。最終出力形は同rule入口から解決される「最終応答serializer」だけを正本とする。

## 診断の型（大切: 推測で断定しない）

状態を思い込みで決めない。**まず実際に軽く読み取ってみて、返ってきた結果（成功／実際のエラー）で状態を確定**してから案内する（実エラーで原因確定 → 日常語で案内）。

各コネクタについて、次のどれかに分類する。

- **接続済み**: 軽い読み取り（例: 直近の予定を1件）が成功した。
- **未接続**: 実コネクタが not connected / no connector 等の実エラーを返した。
- **エラー**: 繋いだが読めない（許可切れ・別アカウント等）。実エラーの内容を日常語に言い換えて示す。
- **未確認**: 実コネクタを呼べない、呼んでいない、または結果を得ていない。preferencesの「主に使うサービス」は接続証跡にしない。

`未確認`の場合、ユーザー向けの結果には**「接続状態は未確認」だけ**を書く。
他の状態ラベルは、否定や「断定しない」という説明の中にも出さない。実証跡のない状態を
並べるだけでも、確認済みの診断結果に見えるためである。

## ステップ1: 各コネクタを軽く確認する（確認）

推測せず、繋がっていそうなものを1つずつ軽く読んで確かめる。全文は取り込まない（本文はローカルに保存しない）。

| コネクタ | 軽い確認の例 |
|---|---|
| Google | 「Googleカレンダーの直近の予定を1件」/「Gmail の未読の件名を1つ」 |
| Microsoft | 「Outlook の直近の予定を1件」/「未読の件名を1つ」 |
| Notion（任意） | 「Notion のページを1つ探す」 |
| Chatwork | `chatwork/state/sync.json` の状態と選択ルームを確認 |
| Google Chat | `google-chat/state/sync.json` の状態と選択通常スペースを確認 |

## ステップ2: 状態を一覧にする（結果）

分かった状態を一覧で示す。例:

| サービス | 状態 | ひとこと |
|---|---|---|
| Google | 接続済み | 予定を1件読めました |
| Microsoft | 未接続 | まだ繋いでいません |
| Notion | 任意・未接続 | 使う場合だけ繋げば OK |

- **未接続のもの**は、対応する接続案内へ橋渡しする:
  - Google → `${SECRETARY_PLUGIN_ROOT}/skills/setup-google/SKILL.md`
  - Microsoft → `${SECRETARY_PLUGIN_ROOT}/skills/setup-microsoft/SKILL.md`
  - Notion（任意） → `${SECRETARY_PLUGIN_ROOT}/skills/setup-notion/SKILL.md`
  - Chatwork → `${SECRETARY_PLUGIN_ROOT}/skills/chatwork/SKILL.md`
  - Google Chat → `${SECRETARY_PLUGIN_ROOT}/skills/google-chat/SKILL.md`
- **エラーのもの**は、英語エラーをそのまま出さず「何が起きて・どうすれば直るか」に言い換える（各 setup ガイドの「言い換えの型」を使う）。

## ステップ3: 診断結果として返す内容

- 実コネクタの成功または実エラーから確認できた状態。
- 実証跡がないサービスは「接続状態は未確認」だけ。他の状態ラベルを併記しない。
- 気になる点。Notionは任意であることも、必要な場合だけ含める。
- ユーザーが選べる次の接続案内を1つまで。

ここでは内容と安全条件だけをrouterへ返す。通常報告の項目数、prefix、Markdown構造、完成例は持たず、
`plain-language.md` から解決される「最終応答serializer」に任せる。

## 補足

- Notion は**任意**です。未接続でも「今日やること」・記憶・他の接続はそのまま使えます（Notion を必須にしない）。
- LINE等の未対応チャットは準備中です。ChatworkとGoogle Chatは選択した対象だけを読取専用で扱います。

## 参照

- 言葉づかいルール（必読）: `${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md`
- Google 接続: `${SECRETARY_PLUGIN_ROOT}/skills/setup-google/SKILL.md`
- Microsoft 接続: `${SECRETARY_PLUGIN_ROOT}/skills/setup-microsoft/SKILL.md`
- Notion 接続（任意）: `${SECRETARY_PLUGIN_ROOT}/skills/setup-notion/SKILL.md`

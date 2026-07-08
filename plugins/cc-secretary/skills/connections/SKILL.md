---
name: connections
description: >
  どのコネクタ（Google / Microsoft / Notion）が繋がっているかを確認して一覧で返す接続診断。
  「繋がってる？」「接続の調子」「診断して」「どれが使える？」等で呼び出す。
---

# 接続診断（connections）

Google・Microsoft・Notion のうち、どれが繋がっていて、どれがまだかを一目で分かるように確認する案内です。
コネクタは各サービスに置いたまま**都度参照**します（同期・コピーはしません）。

ユーザーに話しかける前に、必ず `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`（言葉づかいルール）を読むこと。
報告は3行以内（状態の要約／気になる点／次にやること）。一般に通じる技術用語はそのまま使い、馴染みの薄い語だけ初出で簡潔に補足する。

## 診断の型（大切: 推測で断定しない）

状態を思い込みで決めない。**まず実際に軽く読み取ってみて、返ってきた結果（成功／実際のエラー）で状態を確定**してから案内する（実エラーで原因確定 → 日常語で案内）。

各コネクタについて、次のどれかに分類する。

- **接続済み**: 軽い読み取り（例: 直近の予定を1件）が成功した。
- **未接続**: まだ設定していない／コネクタが無い。
- **エラー**: 繋いだが読めない（許可切れ・別アカウント等）。実エラーの内容を日常語に言い換えて示す。

## ステップ1: 各コネクタを軽く確認する（確認）

推測せず、繋がっていそうなものを1つずつ軽く読んで確かめる。全文は取り込まない（本文はローカルに保存しない）。

| コネクタ | 軽い確認の例 |
|---|---|
| Google | 「Googleカレンダーの直近の予定を1件」/「Gmail の未読の件名を1つ」 |
| Microsoft | 「Outlook の直近の予定を1件」/「未読の件名を1つ」 |
| Notion（任意） | 「Notion のページを1つ探す」 |

## ステップ2: 状態を一覧にする（結果）

分かった状態を一覧で示す。例:

| サービス | 状態 | ひとこと |
|---|---|---|
| Google | 接続済み | 予定を1件読めました |
| Microsoft | 未接続 | まだ繋いでいません |
| Notion | 任意・未接続 | 使う場合だけ繋げば OK |

- **未接続のもの**は、対応する接続案内へ橋渡しする:
  - Google → `${CLAUDE_PLUGIN_ROOT}/skills/setup-google/SKILL.md`
  - Microsoft → `${CLAUDE_PLUGIN_ROOT}/skills/setup-microsoft/SKILL.md`
  - Notion（任意） → `${CLAUDE_PLUGIN_ROOT}/skills/setup-notion/SKILL.md`
- **エラーのもの**は、英語エラーをそのまま出さず「何が起きて・どうすれば直るか」に言い換える（各 setup ガイドの「言い換えの型」を使う）。

## ステップ3: 3行で返す

「状態の要約／気になる点／次にやること」を一言ずつ。例:

> いま繋がっているのは Google だけです。Microsoft と Notion はまだ繋いでいません。
> Notion は任意なので、使わなければそのままで大丈夫です。
> Microsoft も使うなら「Microsoft につなぎたい」と言ってください。設定画面から3分ほどで繋げます。

## 補足

- Notion は**任意**です。未接続でも「今日やること」・記憶・他の接続はそのまま使えます（Notion を必須にしない）。
- 国内チャット（Chatwork / LINE 等）はまだ対応していません（公式コネクタが無いため）。

## 参照

- 言葉づかいルール（必読）: `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`
- Google 接続: `${CLAUDE_PLUGIN_ROOT}/skills/setup-google/SKILL.md`
- Microsoft 接続: `${CLAUDE_PLUGIN_ROOT}/skills/setup-microsoft/SKILL.md`
- Notion 接続（任意）: `${CLAUDE_PLUGIN_ROOT}/skills/setup-notion/SKILL.md`

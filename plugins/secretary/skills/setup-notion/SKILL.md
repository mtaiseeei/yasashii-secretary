---
name: setup-notion
description: >
  Notion を秘書につなぐ任意の案内。使っている人だけ繋げばよい（未接続でも他の機能は普通に使える）。
  Claude の設定画面から公式コネクタで接続する。「Notion につなぎたい」等で呼び出す。
---

# Notion 接続ガイド（setup-notion・任意）

Notion を秘書が参照できるようにする**任意**の案内です。**使っている人だけ繋げば大丈夫**で、
繋がなくても「今日やること」や記憶、Google / Microsoft の接続はそのまま使えます。
**接続は Claude の設定画面から公式コネクタ（OAuth＝アプリ同士を安全につなぐ仕組み）でつなぎます。**
むずかしい開発者向けの下準備は要りません。設定画面のボタン操作だけで完結します。

`${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読む。案内内容と安全条件だけをrouterへ返し、
通常報告を独自に包装しない。最終出力形は同ruleの「最終応答serializer」だけを正本とする。

## 任意です（使わないなら素通りしてよい）

- Notion を使っていない人は、この案内を飛ばして構いません。他の機能には影響しません。
- 「あとで」でも大丈夫です。必要になったらいつでも「Notion につなぎたい」と言ってください。

## ステップ0: 再起動しおりを書く（中断に備える）

設定は Claude の再起動を挟むことがある。設定に進む前に、しおりで文脈を残す。

```
${CLAUDE_PLUGIN_ROOT}/skills/memory-care/scripts/memory-tools.sh resume-write <secretary> \
  "Notion接続の設定" "設定画面でNotionコネクタを有効化→許可" "どのNotionワークスペースを使うか"
```

## ステップ1: 設定画面から公式コネクタを有効にする

Claude の**設定画面 → コネクタ（Connectors）**を開き、Notion（`mcp.notion.com`）を有効にして、表示に沿ってログイン・許可する。
使いたい Notion ワークスペースを選ぶ。パスワードやトークンを秘書フォルダに保存することはありません。

## ステップ2: つながったかを確認する

- 「Notion のページを1つだけ探して」と試す。1件見つかれば OK。

## ステップ3: うまくいかないときの言い換え（英語エラーをそのまま出さない）

英語エラーはそのまま見せず、「何が起きて・どうすれば直るか」に言い換える（実エラーで原因確定 → 日常語で案内）。

| 実際に起きがちなこと（英語表示の例） | 日常語での言い換えと直し方 |
|---|---|
| まだ許可していない（not authorized） | 「接続の許可がまだのようです。設定画面のコネクタで Notion を有効にし、『許可』を押してください。」 |
| ページを共有していない（no access / not shared） | 「秘書に見せたいページがまだ共有されていないかもしれません。Notion 側で対象ページの共有を確認してください。」 |
| 期限切れ・つなぎ直し（expired / reconnect） | 「接続の有効期限が切れたようです。設定画面でもう一度つなぎ直すと直ります。」 |

## ステップ4: 完了時にrouterへ返す内容

- 実コネクタの読み取りで確認できたNotionの状態。
- 外部データ本文をローカルに保存していないこと。
- Notionが任意であることと、ユーザーが選べる次の操作を1つまで。

実コネクタの成功結果が無ければ接続済みと断定しない。ここでは通常報告を作らず、
内容と安全条件だけをrouterへ返し、出力形は`plain-language.md`の「最終応答serializer」に任せる。

接続が終わったら、しおりを閉じる（`memory-tools.sh resume-clear <secretary>`）。

## 参照

- 言葉づかいルール（必読）: `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`
- 再起動しおり: `${CLAUDE_PLUGIN_ROOT}/skills/memory-care/SKILL.md`
- 接続の状態を確認: `${CLAUDE_PLUGIN_ROOT}/skills/connections/SKILL.md`

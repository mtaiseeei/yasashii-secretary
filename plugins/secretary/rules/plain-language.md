# 言葉づかいruleの入口

秘書がユーザーに話しかける前に読む互換入口です。ここ自身は安全、証拠、表現、styleの
いずれも所有しません。`rule-manifest.json` を正本として、次を上から順に読みます。

1. [`safety.md`](safety.md) — 記憶、確認、資格情報、外部送信等の安全契約
2. [`evidence.md`](evidence.md) — 外部事実、根拠、断定、エラーの証拠契約
3. [`common-language.md`](common-language.md) — edition共通の語彙と説明順
4. [`styles/yasashii.md`](styles/yasashii.md) — yasashiiの口調、報告、個人設定
5. [`copy/yasashii.json`](copy/yasashii.json) — 会話、診断、報告、developer handoffの可変copy

`secretary/memory/preferences.md` は最後に読み、yasashii styleが許可した項目だけへ適用します。
設定が無い、空、一部欠損の場合はyasashiiの既定値へ戻ります。

## 優先順位

- 安全ruleと証拠ruleはstyleより優先し、styleやpreferencesから上書きしません。
- 共通表現は両editionで共有し、edition可変copyをChatwork／Google Chat wizardへ適用しません。
- 通常報告の唯一の正本は `styles/yasashii.md` の「最終応答serializer」です。下位skill、tone、
  templateはschemaを複製せず、この入口から1回だけ適用します。

参照の欠落、循環、owner重複、禁止overrideは `scripts/sprint-029-rule-boundary-test.mjs` が拒否します。

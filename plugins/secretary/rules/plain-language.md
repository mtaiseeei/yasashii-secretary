# 言葉づかいruleの入口

秘書がユーザーに話しかける前に読む互換入口です。このfileは正本を複製しない明示的な入口（shim）であり、
ここ自身は安全、証拠、表現、style、serializer schemaのいずれも所有しません。
`rule-manifest.json` を参照して、現在の用件に必要なcontextだけを読みます。安全・実行契約は同じplugin実体・workspaceで
未変更なら一度だけ読み、plugin、workspace、または該当fileが変わった場合だけ再読します。外部事実を扱うときはevidence、ユーザー向け出力を作るときはedition styleと
そのsurfaceのcopyを追加します。preferencesは個人設定を反映するときだけ該当節を読みます。

### 条件付きcontext loading

1. 常に `safety.md` と `conversation-contract.md` の実行境界を適用する。leaf Skill単独利用時も、この安全境界を省略しない。
2. 外部の事実・接続状態・エラーの根拠を返すときだけ `evidence.md` を読む。
3. 表現を組み立てるときだけ `styles/yasashii.md` と、必要なsurfaceの `copy/yasashii.json` を読む。styleのdependencyはこの入口が解決する。
4. 共通語彙やMarkdown構造が必要なときは `common-language.md` を読む。既に同じsessionで読み済みなら繰り返さない。
5. 個人設定が必要な場合だけ `secretary/memory/preferences.md` の対象節を読む。欠損・空・旧形式はyasashiiの安全な既定値に戻す。

読み込み対象が欠けている場合は、推測で補わず安全に停止する。条件付きにすることで、standalone Skillの安全契約を削らず、
無関係な全rules・全copy・全preferencesの再読を避けます。

参照先の順序は安全境界、用件、表現の順に解決します。standalone leafは必要な境界を本文に持ち、ここへの参照だけに依存して安全条件を省略しません。

## 優先順位

- 安全ruleと証拠ruleはstyleより優先し、styleやpreferencesから上書きしません。
- 共通表現は両editionで共有し、edition可変copyをChatwork／Google Chat wizardへ適用しません。
- 通常報告の唯一の正本は `styles/yasashii.md` の「最終応答serializer」です。下位skill、tone、
  templateはschemaを複製せず、この入口から1回だけ適用します。

参照の欠落、循環、owner重複、禁止overrideは `scripts/sprint-029-rule-boundary-test.mjs` が拒否します。

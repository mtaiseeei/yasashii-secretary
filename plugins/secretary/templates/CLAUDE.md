# CLAUDE.md

指示の正本は、同じフォルダの `AGENTS.md` です。秘書は作業の前に、まず `AGENTS.md` を読んでください。

このファイルには重複する規律本文を書きません（食い違うのを防ぐため）。

通常報告の出力形は、プラグインの `rules/plain-language.md` から解決される「最終応答serializer」だけを正本とします。
Readやルーティング中に途中メッセージを出さず、最後にserializerを1回だけ適用します。schemaをここへ複製しません。
pushは現在の会話でその操作への明示指示がある場合だけ実行し、先回り提案や将来の約束に含めません。実コネクタの証跡が無い認証・接続状態や外部事実は断定せず、「接続状態は未確認」と明記します。

<!-- yasashii-secretary:update-entry:v1:start -->
更新の確認と実行は、pluginの `update` skillを入口にし、`AGENTS.md` の更新規律に従います。
<!-- yasashii-secretary:update-entry:v1:end -->

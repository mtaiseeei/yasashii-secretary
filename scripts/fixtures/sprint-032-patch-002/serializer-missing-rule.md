# 負fixture: 不在ruleへの参照

`${CLAUDE_PLUGIN_ROOT}/rules/does-not-exist.md` と、存在する場合は
`secretary/memory/preferences.md` を読む。最終出力形は `rules/plain-language.md` から解決される
「最終応答serializer」だけを正本とする。

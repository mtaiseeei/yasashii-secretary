# 更新状況を確認する

「更新ある？」「最新版にして」「バージョンを確認して」と秘書へ話しかけます。

秘書は次の順で、読み取れた事実だけを案内します。

1. 現在使っているversion
2. 公開されている最新版
3. 主な変更
4. 設定・ファイルへの影響
5. 必要な操作
6. workspaceで変更済みのファイルと衝突する可能性

診断は読み取り専用です。plugin更新、workspaceの上書き、migration、commit、push、設定変更、reload、restartは行いません。
最新版を確認できないときも推測せず、`latest-unverified` と理由を示して止まります。

変更履歴は [CHANGELOG](../../plugins/yasashii-secretary/CHANGELOG.md) で確認できます。

## 自動更新を使う場合

2026年7月時点では、第三者marketplaceの自動更新は既定で無効です。使う場合は、利用者自身が
`/plugin` → `Marketplaces` → 対象marketplace → `Enable auto-update` を選びます。
診断がこの設定を変更することはありません。

なお、pluginが自動更新されても、初回セットアップでworkspaceへコピーしたファイルは別管理のため、自動では置き換わりません。

- [Claude Code: Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Claude Code: Discover and install plugins](https://code.claude.com/docs/en/discover-plugins)
- [Claude Code: Plugins reference](https://code.claude.com/docs/en/plugins-reference)

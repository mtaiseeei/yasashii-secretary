---
name: update
description: >
  yasashii-secretaryの更新状況を読み取り専用で診断する。「最新版にして」「更新ある？」
  「バージョンを確認して」「自動更新はどうする？」で呼び出せる。
trigger: /update
---

# 更新状況の確認

これは**診断だけ**を行うスキルです。現在版、公開されている最新版、主な変更、設定・ファイルへの影響、
必要な操作、workspaceのカスタマイズ衝突可能性を順に伝えます。

最初に `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読みます。その後、作業中フォルダをworkspaceとして次を実行します。

```text
node "${CLAUDE_PLUGIN_ROOT}/scripts/update-diagnose.mjs" --workspace .
```

診断結果は言い換えず、現在版→最新版→主な変更→影響→必要な操作→衝突可能性の順で示します。
`current-unknown` や `latest-unverified` の場合は推測せず、確認できなかった理由を示して止まります。
最後に `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` の最終応答serializerを1回だけ適用します。

## 絶対に行わないこと

- pluginのinstall/update、marketplaceの更新
- workspaceファイルの上書き、migrationの適用
- 保護commit、rollback、push
- Claude Code設定の変更、reload、restart

利用者が「今回は確認だけ」「今回は見送る」「中止」を選んだ場合は、そのまま終了します。
「実更新へ進む」を選んでも、実更新はSprint 018で対応予定のため、上の操作を一切行わずに停止します。

## 自動更新について

2026年7月時点のClaude Code公式仕様では、第三者marketplaceの自動更新は既定で無効です。
使う場合は利用者自身が /plugin → `Marketplaces` → 対象marketplace → `Enable auto-update` を選びます。
このスキルは設定を変更しません。またpluginが自動更新されても、workspaceへコピー済みのファイルは
別管理のため、自動では置き換わりません。

- [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins)
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference)

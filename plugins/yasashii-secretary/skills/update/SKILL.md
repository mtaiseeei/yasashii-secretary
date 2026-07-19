---
name: update
description: >
  yasashii-secretaryの更新状況を読み取り専用で診断し、明示確認後だけ安全に更新する。
  「最新版にして」「更新ある？」「更新を再開」「バージョンを確認して」「自動更新はどうする？」で呼び出せる。
trigger: /update
---

# 更新状況の確認

最初は**診断だけ**を行います。現在版、公開されている最新版、主な変更、設定・ファイルへの影響、
必要な操作、workspaceのカスタマイズ衝突可能性を順に伝えます。この段階では何も変更しません。

最初に `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読みます。その後、作業中フォルダをworkspaceとして次を実行します。

```text
node "${CLAUDE_PLUGIN_ROOT}/scripts/update-diagnose.mjs" --workspace .
```

診断結果は言い換えず、現在版→最新版→主な変更→影響→必要な操作→衝突可能性の順で示します。
`current-unknown` や `latest-unverified` の場合は推測せず、確認できなかった理由を示して止まります。
最後に `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` の最終応答serializerを1回だけ適用します。

## 読み取り専用診断で絶対に行わないこと

- pluginのinstall/update、marketplaceの更新
- workspaceファイルの上書き、migrationの適用
- 保護commit、rollback、push
- Claude Code設定の変更、reload、restart

利用者が「今回は確認だけ」「今回は見送る」「中止」を選んだ場合は、そのまま終了します。
「実更新へ進む」を選んだ場合も、診断結果を表示した同じ応答では変更しません。次の別ターンで、
更新対象、ファイルごとの判定、pushしない保護commit、pushしないこと、rollback方法をまとめて示します。

## 明示確認後の実更新

`latest-unverified`、`current-unknown`、影響判定不能、未commitの変更、資格情報らしき内容、
commit不能のいずれかなら止めます。拒否、キャンセル、曖昧な返答も了承にしません。

`customized` と `unknown-baseline` はファイルごとに次から選びます。無回答の既定は「現状を残す」です。

- 現状を残す（既定）
- 新版へ置き換える
- 差分を見る（本文やsecretを出さない要約だけ）
- 中止

利用者が次の別ターンで実更新を明示了承した後だけ、固定された引数で次を実行します。

```text
node "${CLAUDE_PLUGIN_ROOT}/scripts/update-apply.mjs" start --workspace . --current-plugin-root "${CLAUDE_PLUGIN_ROOT}" --consent update-approved --scope user
```

Claude Codeの公式更新経路は `claude plugin marketplace update yasashii-secretary` と
`claude plugin update yasashii-secretary@yasashii-secretary --scope user` です。実装はshell文字列を組み立てず、
固定された引数だけを渡します。実行後はClaude Codeの /reload-plugins が必要です。reloadは新しいpluginのskill・scriptへ
切り替えるためで、workspace migrationはまだ始まりません。

plugin更新だけが失敗した場合は、原因を確認後、既存の保護commitを増やさず次で再試行できます。

```text
node "${CLAUDE_PLUGIN_ROOT}/scripts/update-apply.mjs" retry-plugin --workspace .
```

「やさしい秘書の更新を再開」と言われたら、新しい`${CLAUDE_PLUGIN_ROOT}`でversionと再開情報を確認し、dry-runだけを実行します。

```text
node "${CLAUDE_PLUGIN_ROOT}/scripts/update-apply.mjs" resume --workspace . --plugin-root "${CLAUDE_PLUGIN_ROOT}"
```

dry-runの追加・変更・維持対象を示し、利用者がplan hashを含めて明示了承した後だけ、同じplanを本実行します。

```text
node "${CLAUDE_PLUGIN_ROOT}/scripts/update-apply.mjs" resume --workspace . --plugin-root "${CLAUDE_PLUGIN_ROOT}" --apply --plan-hash <表示されたhash>
```

失敗時または利用者が戻したい場合は、pluginとworkspaceを分けて説明してからrollbackします。

```text
node "${CLAUDE_PLUGIN_ROOT}/scripts/update-apply.mjs" rollback --workspace .
```

pluginも同時に復元する場合は、現在読み込まれているplugin rootを明示します。

```text
node "${CLAUDE_PLUGIN_ROOT}/scripts/update-apply.mjs" rollback --workspace . --plugin-root "${CLAUDE_PLUGIN_ROOT}"
```

workspaceは`git reset --hard`を使わず、更新が書いた後から利用者が変更していない管理対象だけを復元します。pluginは更新前の退避物を同じscopeの対象に戻し、versionと主要skillを検証します。自動復元できない場合は、成功と見せず旧版、scope、実行可能な退避先、起動・確認手順を示します。全経路でpushとremote変更は禁止です。

## 自動更新について

2026年7月時点のClaude Code公式仕様では、第三者marketplaceの自動更新は既定で無効です。
使う場合は利用者自身が /plugin → `Marketplaces` → 対象marketplace → `Enable auto-update` を選びます。
このスキルは設定を変更しません。またpluginが自動更新されても、workspaceへコピー済みのファイルは
別管理のため、自動では置き換わりません。

- [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins)
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference)

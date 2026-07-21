---
name: update
description: >
  yasashii-secretaryの更新状況を読み取り専用で診断し、明示確認後だけ安全に更新する。
  「最新版にして」「更新ある？」「更新を再開」「バージョンを確認して」「自動更新はどうする？」で呼び出せる。
trigger: /update
---

# 更新状況の確認

Claude Codeの明示入口は `/update`、Codexは `$update` です。更新面はhostごとに異なるため、
Claude marketplaceのcommandをCodexへ、Codex Plugins Directory／CLIの操作をClaude Codeへ流用しません。
最初に現在のhostを `claude-code` または `codex` として確定します。判定できない場合は `未確認` と伝え、
plugin、workspace、Git、session、backupを変更せず停止します。

## plugin root（必須）

このSKILL.mdの実ファイル絶対pathを `SECRETARY_SKILL_FILE` に入れ、最初に1回だけ解決する。
空・相対path・未解決placeholderならcommandへ渡さず停止し、cwdやhost固有の環境変数から推測しない。

```bash
SECRETARY_SKILL_FILE="<このSKILL.mdの実ファイル絶対path>"
case "$SECRETARY_SKILL_FILE" in /*/skills/*/SKILL.md) ;; *) exit 2 ;; esac
SECRETARY_PLUGIN_ROOT="$(node "$(dirname "$SECRETARY_SKILL_FILE")/../../scripts/resolve-plugin-root.mjs" --skill-file "$SECRETARY_SKILL_FILE")" || exit 2
```

以後の共通file参照は `${SECRETARY_PLUGIN_ROOT}` を使う。

最初は**診断だけ**を行います。現在版、公開されている最新版、主な変更、設定・ファイルへの影響、
必要な操作、workspaceのカスタマイズ衝突可能性を順に伝えます。この段階では何も変更しません。

最初に `${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読みます。その後、作業中フォルダをworkspaceとして次を実行します。

```text
node "${SECRETARY_PLUGIN_ROOT}/scripts/update-diagnose.mjs" --workspace .
```

診断結果は言い換えず、現在版→最新版→主な変更→影響→必要な操作→衝突可能性の順で示します。
`current-unknown` や `latest-unverified` の場合は推測せず、確認できなかった理由を示して止まります。
`same` では「すでに最新版です」、`downgrade-blocked` では「古い版への更新はできません」と現在版・候補版を併記し、
実更新、保護commit、migration、rollback、same-version bridgeの案内を出さずに変更0件で終了します。
`legacy-yasashii` は互換読取した状態と、neutral marker／edition付きledgerへの予定migrationを示します。
`opposite-edition`、`mixed`、`unknown` は検出edition、現在のworkspace、実行しなかった操作を示し、
ledger、marker、履歴、設定、Git、pluginを変更せず停止します。edition切替や削除は案内しません。
最後に `${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md` から解決される最終応答serializerを1回だけ適用します。

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

### Claude Codeでplugin更新を始める

利用者が次の別ターンで実更新を明示了承し、現在のhostがClaude Codeだと確認できた後だけ、
固定された引数で次を実行します。

```text
node "${SECRETARY_PLUGIN_ROOT}/scripts/update-apply.mjs" start --host claude-code --workspace . --current-plugin-root "${SECRETARY_PLUGIN_ROOT}" --consent update-approved --scope user
```

Claude Codeの公式更新経路は `claude plugin marketplace update yasashii-secretary` と
`claude plugin update yasashii-secretary@yasashii-secretary --scope user` です。実装はshell文字列を組み立てず、
固定された引数だけを渡します。実行後はClaude Codeの /reload-plugins が必要です。reloadは新しいpluginのskill・scriptへ
切り替えるためで、workspace migrationはまだ始まりません。

plugin更新だけが失敗した場合は、原因を確認後、既存の保護commitを増やさず次で再試行できます。

```text
node "${SECRETARY_PLUGIN_ROOT}/scripts/update-apply.mjs" retry-plugin --host claude-code --workspace .
```

### Codexでpluginを更新する

Codexでは `update-apply.mjs start` と `retry-plugin` を実行しません。runnerへ `--host codex` を渡した場合も、
Claude CLIを呼ぶ前、かつworkspaceの保護commit、session、backupを作る前に変更0件で安全停止します。

まず `${SECRETARY_PLUGIN_ROOT}/edition.json` の `distribution.marketplaceId` と `distribution.pluginId` を読み、
表示するmarketplace／pluginが現在のeditionと一致することを確認します。値を別hostから推測しません。

- **Codex App:** 現在のPlugins Directoryで対象marketplaceとpluginを開き、その場に表示される公式の
  更新または再導入操作だけを案内します。更新操作を現在の画面で確認できない場合は `未確認` と伝え、
  Claudeの画面名やcommandを案内せず停止します。
- **Codex CLI:** 現行CLIで確認できるmarketplace snapshotの更新は
  `codex plugin marketplace upgrade <marketplace-name>` です。plugin単体の `update` commandは使いません。
  snapshot更新後も再導入が必要な場合だけ、対象と影響を示して別途明示了承を得たうえで、現行CLIの
  `codex plugin remove <plugin@marketplace>`、`codex plugin add <plugin@marketplace>` を順に案内します。
  実行後は `codex plugin list` で対象を確認し、新しいCodex task／sessionを開始します。

これらのCodex操作は本scriptで自動実行しません。更新操作、remove／add、新しいsessionのいずれも確認できない場合は
`未確認` のまま停止します。Codex経路ではClaude用の保護sessionを作らないため、直後に `resume` を実行しません。
新しいsessionで `$update` を再度呼び、まず読み取り専用診断から現在版とworkspaceへの影響を確認します。

「やさしい秘書の更新を再開」と言われたら、新しい`${SECRETARY_PLUGIN_ROOT}`でversionと再開情報を確認し、dry-runだけを実行します。
これは既にClaude Code用runnerが作成した更新sessionを再開する経路です。sessionが無ければ変更せず停止します。

```text
node "${SECRETARY_PLUGIN_ROOT}/scripts/update-apply.mjs" resume --host claude-code --workspace . --plugin-root "${SECRETARY_PLUGIN_ROOT}"
```

dry-runの追加・変更・維持対象を示し、利用者がplan hashを含めて明示了承した後だけ、同じplanを本実行します。

```text
node "${SECRETARY_PLUGIN_ROOT}/scripts/update-apply.mjs" resume --host claude-code --workspace . --plugin-root "${SECRETARY_PLUGIN_ROOT}" --apply --plan-hash <表示されたhash>
```

失敗時または利用者が戻したい場合は、pluginとworkspaceを分けて説明してからrollbackします。

```text
node "${SECRETARY_PLUGIN_ROOT}/scripts/update-apply.mjs" rollback --host claude-code --workspace .
```

pluginも同時に復元する場合は、現在読み込まれているplugin rootを明示します。

```text
node "${SECRETARY_PLUGIN_ROOT}/scripts/update-apply.mjs" rollback --host claude-code --workspace . --plugin-root "${SECRETARY_PLUGIN_ROOT}"
```

workspaceは`git reset --hard`を使わず、更新が書いた後から利用者が変更していない管理対象だけを復元します。pluginは更新前の退避物を同じscopeの対象に戻し、versionと主要skillを検証します。自動復元できない場合は、成功と見せず旧版、scope、実行可能な退避先、起動・確認手順を示します。全経路でpushとremote変更は禁止です。

公開済み`0.7.0`からrelease candidate `0.8.0`へのlive updateは、今回の配布保証に含めません。
旧`0.7.0` updaterはチャット連携の標準生成fileをsecret候補として止める既知のblockerがあるため、
診断結果だけで対応済みと説明したり、external recovery／bootstrapを推測で案内したりしません。
最初の明示配布は`0.8.0`の新規導入として扱います。

## 自動更新について

### Claude Code

2026年7月時点のClaude Code公式仕様では、第三者marketplaceの自動更新は既定で無効です。
使う場合は利用者自身が /plugin → `Marketplaces` → 対象marketplace → `Enable auto-update` を選びます。
このスキルは設定を変更しません。またpluginが自動更新されても、workspaceへコピー済みのファイルは
別管理のため、自動では置き換わりません。

### Codex

Codex CLI 0.144.6で確認できるのはGit marketplace snapshotの明示更新です。このスキルは自動更新を設定せず、
plugin単体の自動更新commandを推測しません。Codex Appは現在のPlugins Directoryに実際に表示される操作だけを案内します。

- [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins)
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference)

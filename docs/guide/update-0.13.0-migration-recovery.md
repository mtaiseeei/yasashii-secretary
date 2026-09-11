# 0.13.0更新でmigrationが止まった場合の回復

公開済み`0.13.0`では、plugin本体の更新が成功しても、`0.10.1`や`0.12.0`などからworkspace管理節を移すversion経路が見つからず、`update-apply.mjs resume`がexit 3で停止する場合があります。「workspace migrationは行っていません」という表示、空の`migration.changedPaths`、falseの`ledgerChanged`／`markerChanged`は未変更sessionの候補を絞る手掛かりです。最終判断は、修正版のrunnerが管理対象file、台帳、marker、保護commit、workspace HEADを照合した結果に従ってください。更新前に作ったpushなしの保護commitとplugin backupは削除しないでください。

修正版は`0.13.1`です。`v0.13.1` Releaseが正式公開されるまでは、公開済み`v0.13.0`のtag、Release、artifactを修正版として扱わず、同じversionを入れ直して回復しようとしないでください。[やさしい秘書 0.13.1 Release](https://github.com/mtaiseeei/yasashii-secretary/releases/tag/v0.13.1)と配布versionの一致を確認した後、新しいpluginを正式な更新機能で同じscopeへ読み込み、同じworkspaceで次を実行します。

`<修正版plugin root>`は、正式更新とreload後にClaude Codeが実際に読み込んだ修正版pluginのrootへ置き換えます。

```text
node "<修正版plugin root>/scripts/update-apply.mjs" resume --host claude-code --workspace . --plugin-root "<修正版plugin root>" --json
```

PowerShellでは、実際のpathを変数へ入れてから実行できます。

```powershell
$PluginRoot = "C:\path\to\the\fixed-plugin"
node "$PluginRoot\scripts\update-apply.mjs" resume --host claude-code --workspace . --plugin-root "$PluginRoot" --json
```

回復可能な未変更sessionなら、元版、旧target、新しいtarget、保護commit、workspace HEAD、edition、scope、管理対象の選択、元版backupのtreeを再検証し、新しいtarget用のdry-runと新しいplan hashを表示します。旧`0.13.0`用plan hashは使えません。表示された追加・変更・維持・衝突を確認し、新しいhashを指定して改めてapplyします。

```text
node "<修正版plugin root>/scripts/update-apply.mjs" resume --host claude-code --workspace . --plugin-root "<修正版plugin root>" --json --apply --plan-hash "<新しいplan hash>"
```

sessionの`changedPaths`に対象がある、台帳またはedition markerが更新済み、保護commit後に別commitがある、管理対象本文が変わった、backupが欠落・複数・改変されている、scope／editionが一致しない場合はtargetを差し替えません。別versionのplanを重ねず、整合した元sessionのrollbackを実行します。

```text
node "<修正版plugin root>/scripts/update-apply.mjs" rollback --host claude-code --workspace . --plugin-root "<修正版plugin root>" --json
```

rollbackは保護commitにある管理対象・台帳・markerと、session開始前versionのplugin backupを別々に検証して戻します。片方でも自動復元できなければ`partial-restoration`で停止するため、表示された未復元pathと旧版起動commandを確認してください。`0.7.0`以前、公開tagのない`0.11.x`、未知版はこの回復経路の対応版ではありません。対応版へ推測変更せず、表示された現在版と次の行動を確認してください。

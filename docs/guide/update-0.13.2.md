# 0.13.2への更新（Codex／Claude Code）

公開版やさしい秘書の正式配布元は `mtaiseeei/yasashii-secretary`、plugin IDは `yasashii-secretary@yasashii-secretary` です。Agentic版やprivate my-vault版へ置き換える更新ではありません。

[公開Release](https://github.com/mtaiseeei/yasashii-secretary/releases/tag/v0.13.2)のtag、manifest、配布内容の一致を確認してから更新します。Releaseが未公開なら変更せず停止します。

## 短い更新依頼

```text
利用中の公開版やさしい秘書（mtaiseeei/yasashii-secretary）を、現在のCodex／Claude Codeが提供する正式な更新手順で0.13.2へ更新してください。導入元とeditionを確認し、既存scope・有効状態・設定とworkspaceの独自変更を保持して、管理節のmigrationはpreview後に承認済み範囲だけ適用してください。成功後は新しいsessionで実際に読み込まれたversionを確認し、本体とworkspaceの更新結果を分けて報告してください。
```

## host別の正式経路

- Claude Code: 対象marketplaceだけを更新し、既存scopeに対して `claude plugin update yasashii-secretary@yasashii-secretary --scope <確認したscope>` を使います。導入hostが提供する再読込、または新sessionで読み込みを確認します。
- Codex: 現在hostのPlugins UIが提供する正式な更新操作、または導入元を確認したCodex CLIの `codex plugin marketplace upgrade <確認したmarketplace>` を使います。インストール済みpluginの更新操作は現hostのhelp／UIで確認し、cacheの生ファイルを編集しません。新しいtask／sessionで版を確認します。

## workspaceにコピーされた指示

plugin本体とworkspaceの更新は別です。update Skillの診断でregistry、edition、root、scope、旧版、backup、保護commitを確認し、新しいplanをpreviewします。`0.13.1→0.13.2`は内容変更migrationで、既知の旧管理節だけが対象です。名前、話し方、記憶、日誌、project本文、自由記述、認証情報や他pluginは上書きしません。customized／unknownな節、不一致やpartialは成功扱いにせず、既存の修復・rollback経路へ戻します。

古い`0.13.0`向けplanは再利用せず、[回復ガイド](update-0.13.0-migration-recovery.md)を参照して現在版で新しいplanを作ります。全marketplace更新、scope変更、無効pluginの自動有効化、実利用者workspaceへの一括適用は行いません。

# 0.13.1への更新依頼文（Claude Code用）

対象repoの`v0.13.1` Release公開を確認してから利用してください。Releaseがなければ、下の依頼文はファイルを変更せず停止します。

公開確認: [やさしい秘書 0.13.1](https://github.com/mtaiseeei/yasashii-secretary/releases/tag/v0.13.1)。

```text
このフォルダで使っている「やさしい秘書」を、私の名前・話し方・記憶・自分で変えた設定を残して0.13.1へ更新してください。この依頼を、安全に変更箇所を確定できる範囲の更新への承認とします。

正規配布元は mtaiseeei/yasashii-secretary、plugin IDは yasashii-secretary@yasashii-secretary です。最初に導入元・版・利用範囲(scope)・有効状態と、作業フォルダのGit変更状態を確認してください。Agentic版やprivate版など別のものなら変更せず教えてください。

公開済みv0.13.1のcommit、manifest、CHANGELOG、配布内容が一致する場合だけ、正式な更新機能を確認したplugin IDと既存scopeへ限定して使ってください。cache直接編集、scope変更、無効pluginの自動有効化、全marketplace更新、削除して入れ直すこと、prune、stash、reset、cleanは行わないでください。

更新前に導入版・source・scope・有効状態と復元元を記録してください。コピー済みの指示は、旧配布原本・現在の編集・0.13.1原本を比べ、製品由来と判断できる部分だけを小さく更新してください。名前、話し方、記憶、日誌、project本文、自由記述、認証情報、他plugin、無関係な変更を保持してください。

0.13.0向けmigrationが停止中なら旧planを再利用せず、0.13.1で新しいdry-runと確認を行ってください。partial、backup、HEAD、scope、editionの不一致は成功扱いにしないでください。

更新後は版・導入元・scope・有効状態を再確認し、新しいsessionで読み込まれるまで完了扱いにしないでください。私の実データを使ったClarity書込み、初期化、同期テストは行わないでください。最後に更新できたこと、migration、保持したもの、残る確認、復元元を短く報告してください。
```

## 0.12.0の図について

既存の[0.12.0更新ガイド](update-0.12.0.md)にある画像は、0.12.0で導入した4つの改善を説明する履歴資料です。0.13.1の現在版表示や、migration回復の画面例ではありません。

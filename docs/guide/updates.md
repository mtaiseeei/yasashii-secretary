# 更新状況を確認する

現在の公開版は`0.7.0`です。`0.6.0`からの更新は、診断→明示確認→保護地点→dry-run→適用→検証の順で行います。

「更新ある？」「最新版にして」「バージョンを確認して」と秘書へ話しかけます。

秘書は次の順で、読み取れた事実だけを案内します。

1. 現在使っているversion
2. 公開されている最新版
3. 主な変更
4. 設定・ファイルへの影響
5. 必要な操作
6. workspaceで変更済みのファイルと衝突する可能性

最初の診断は読み取り専用です。plugin更新、workspaceの上書き、migration、commit、push、設定変更、reload、restartは行いません。
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

## 実更新へ進む場合

診断結果を読んで「実更新へ進む」と選んでも、その応答では変更しません。次の別ターンで、更新対象、
カスタマイズ判定、pushしない保護commit、pushしないこと、失敗時の戻し方を確認します。

明示了承後の順序は次のとおりです。

1. 未commitの変更や資格情報らしき内容がないか確認する
2. 更新直前の状態を、pushしないローカルcommitとして1件残す
3. Claude Code公式のplugin更新経路を固定引数で実行する
4. `/reload-plugins` 後に「やさしい秘書の更新を再開」と伝える
5. migrationのdry-run（変更予定）を確認する
6. もう一度了承した後だけworkspaceへ適用し、version・台帳・主要導線を検証する

変更済みまたは判定できないファイルは「現状を残す」が既定です。無回答や曖昧な返答を上書き同意にせず、
差分を確認するときも私的本文・token・password・secretは表示しません。台帳がない0.2.0も、既知の基準と
一致を証明できるファイルだけを未変更とし、それ以外は残します。

失敗時のworkspace復元は、保護commitから更新が所有する管理対象だけを戻します。保護commit後の利用者commitや追加変更を検出した場合は上書きしません。`git reset --hard`、push、remote変更は行いません。

pluginは更新前の`0.6.0`をGit管理外の保護領域へ退避します。安全に自動復元できる場合は同じscopeへ戻し、versionと主要skillを確認します。権限等で自動復元できない場合は、実行可能な退避先、旧版、scope、起動・確認手順を表示し、`partial-restoration`として停止します。

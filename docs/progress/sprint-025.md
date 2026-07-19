# Sprint 025 進捗 — 0.7.0更新配布と両面rollback

## 実装結果

Sprint 025の受入基準に対応する0.7.0配布整合、0.6.0からの更新、plugin／workspace両面rollback、自動回帰を実装した。

- marketplace、plugin manifest、CHANGELOGを0.7.0へ統一した。Claude pluginのauthor、homepage、repository、licenseと、marketplaceのowner、source、forkedFrom、MIT単段クレジットを配布validatorで検査する。
- 配布validatorは`.git`を必要とせず、最小archive fixtureでも動作する。metadata欠落、source不正、名前不正、version不一致を負テストで拒否する。
- 0.6.0から0.7.0へのmigration定義を追加した。0.7.0は更新安全性の強化が中心のためworkspace本文の自動変更は0件とし、記憶、PJ、Chatwork、Google Chat、設定、Secretを対象外にした。
- 更新開始時に現在のpluginをGit管理外の保護領域へ退避し、version、scope、tree hash、主要skillを記録する。旧0.6.0 codeが開始したsessionでも、reload後に残る旧cacheから退避物を安全に回収できる。
- 適用後はworkspace台帳、plugin version、主要skillを検証する。同じmigrationの再実行は追加変更0件、台帳重複0件になる。
- rollbackは保護commit後の利用者commitや変更を上書きしない。workspaceは所有pathだけ、pluginはstage／quarantine／renameで原子的に戻し、同じscopeの0.6.0と主要skillを実確認する。
- pluginを自動復元できない場合は成功とせず`partial-restoration`を返す。旧version、scope、退避path、`claude --plugin-dir`で起動できる具体的な代替手順を示す。
- README、公開更新ガイド、update skillへ0.7.0の診断、明示確認、保護、dry-run、検証、plugin／workspace rollbackを反映した。

## 受入基準の対応

1. **0.7.0整合**: marketplace、plugin manifest、CHANGELOGの一致と重複versionなしを確認。
2. **配布metadata**: owner、author、MIT、forkedFrom、source、repository、homepageをvalidatorで確認し、欠落／不一致fixtureを拒否。
3. **archive互換**: `.git`なし最小配布物でvalidatorがPASS。
4. **読み取り専用診断**: 0.6.0から0.7.0を`update-available`と判定し、workspace、plugin、Git、外部操作の副作用0件を確認。
5. **安全なmigration**: 明示確認後だけ保護commitとplugin更新を行い、reload後のdry-runとplan hash確認を経て適用。
6. **利用者データ保護**: 記憶、PJ、Chatwork、Google Chatのfixtureがbyte不変。0.6.0→0.7.0 migrationの追加／変更は0件。
7. **冪等性**: 同じmigrationの再実行で追加変更0件、台帳重複0件。
8. **plugin rollback**: 同じscopeの0.6.0、tree、主要skillを退避・復元後に実確認。
9. **workspace rollback**: 所有pathだけを保護commitへ戻し、保護後の利用者commitは上書きしない。
10. **部分復元**: 一方だけ戻った状態を成功にせず、旧版を実行可能な手順つきで表示。

## 変更した主なファイル

- `.claude-plugin/marketplace.json`
- `plugins/yasashii-secretary/.claude-plugin/plugin.json`
- `plugins/yasashii-secretary/CHANGELOG.md`
- `plugins/yasashii-secretary/migrations/0.6.0-to-0.7.0.json`
- `plugins/yasashii-secretary/scripts/update-apply.mjs`
- `plugins/yasashii-secretary/skills/update/SKILL.md`
- `README.md`
- `docs/guide/updates.md`
- `scripts/check-release-integrity.py`
- `scripts/sprint-025-regression.sh`
- `scripts/sprint-018-regression.sh`
- `scripts/regression-check.sh`

## テスト結果

- `bash scripts/sprint-025-regression.sh`: `SPRINT025_PASS=25 SPRINT025_FAIL=0`。
- `bash scripts/sprint-017-regression.sh`: `PASS=32 FAIL=0`。
- `bash scripts/sprint-018-regression.sh`: `SPRINT018_PASS=41 SPRINT018_FAIL=0`。
- `bash scripts/sprint-021-regression.sh`: `PASS=71 FAIL=0`、wrapper `8/0`。
- `bash scripts/sprint-022-regression.sh`: `SPRINT022_PASS=69 SPRINT022_FAIL=0`、wrapper `8/0`。
- `bash scripts/sprint-023-regression.sh`: 専用 `21/0`、wrapper `15/0`。
- `bash scripts/sprint-024-regression.sh`: 専用 `43/0`、wrapper `15/0`。
- master offline: `docs/evidence`全体を含めない隔離コピーへ実装差分を明示コピーし、旧0.2.0 templateだけを`GIT_ALTERNATE_OBJECT_DIRECTORIES`経由でGit objectから参照して、`PASS=336 FAIL=0`。
- master online: 外部APIを使わないという本Sprintの実行制約に従い未実行。online固有のGitHub API検査は未確認であり、PASSとは記録しない。
- `node --check plugins/yasashii-secretary/scripts/update-apply.mjs`、`python3 -m py_compile scripts/check-release-integrity.py`、release validator、report schema、`git diff --check`: PASS。

## 起動・評価handoff

- 専用回帰: `bash scripts/sprint-025-regression.sh`
- 関連回帰: `bash scripts/sprint-017-regression.sh`、`bash scripts/sprint-018-regression.sh`
- master offline: `bash scripts/regression-check.sh --offline`
- 評価では0.6.0診断の副作用0、旧cacheからの退避物回収、記憶／PJ／両チャット履歴のbyte不変、再実行0変更、plugin／workspace両面rollback、利用者commit非上書き、部分復元表示を確認する。
- UI変更はないためbrowser URL／screenshotはなし。
- Generatorは起動host metadataで実model `gpt-5.6-sol`、effort `high`を確認したfresh sessionで実行した。

## 既知事項

- 実Claude plugin更新、実Secret、実GitHub Actions dispatch、remote push、外部APIは使っていない。回帰内のcommit／pushは一時fixtureとlocal bare remoteだけで、製品repoのcommit／pushは0件。
- 旧0.6.0 plugin cacheが0件または複数で一意に決められない場合は、workspace migration前に安全停止する。推測で旧版を選ばない。
- online固有の公開GitHub参照検査は未実行のため、Evaluatorが外部読み取りを許可された場合に別途確認する。

## 検証操作上の逸脱

- 最初の全体回帰用コピーはGit履歴を持たず、Sprint 018が`git show d569fef`で取得する旧0.2.0 templateを解決できなかった。このためmasterは`335/1`となったが、製品FAILではなく隔離fixtureの履歴不足と切り分けた。
- 切り分け時に一時worktree `/tmp/yasashii-s025-master-history-20260719`を作成したため、HEADで追跡される監査記録も一時的にcheckout対象になった。master inventoryへ他の`docs/evidence` pathが出た時点で即時中断し、一時worktreeを削除した。禁止対象の内容を個別に開く操作、外部送信、`git add`、commit、pushは行っていない。
- 以後は`docs/evidence`全体を含めない隔離コピーだけを使用し、必要な旧templateはGit objectからpath指定で解決した。製品合否はこの安全な再実行の`PASS=336 FAIL=0`を根拠とする。

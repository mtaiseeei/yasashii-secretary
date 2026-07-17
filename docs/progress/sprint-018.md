# Sprint 018 — G8後半 確認後だけ行う安全な更新

## 着手時の契約

- 実装対象: Sprint 017の読み取り専用診断から、明示了承、pushしない保護commit、公式plugin更新、reload後の再開、version別migration、更新後検証、rollbackまでをつなぐ。
- 成功条件: `docs/sprints/sprint-018.md` の受入基準1〜14を専用回帰と全回帰で確認し、カスタマイズ・私的内容・secret・既存機能を守る。
- 実装しないもの: silent update、一括上書き、push、remote変更、履歴書換え、管理対象外のmigration、Chatwork設定変更、一般PJ／別repo開発PJの正本変更、Google Chat。

## 実装状況

実装完了。Evaluatorの独立評価待ち。

## 実装内容

- 公開版を `0.4.0` に更新し、marketplace manifest、plugin manifest、CHANGELOGを一致させた。CHANGELOGには利用者向けの変更、影響、操作、戻し方、維持項目を記載した。
- `update-apply.mjs` を追加した。`start`、`retry-plugin`、`resume`、`rollback` の4段階で、確認前の操作とreload後の処理を分離する。
- 実更新の直前にSprint 017の診断を再実行し、現在版、最新版、変更、影響、衝突可能性、対象、pushしない保護commit、rollbackを表示する。明示了承、最新版確認、version確認がそろわなければ変更しない。
- `customized` と `unknown-baseline` はファイルごとに「現状を残す（既定）／新版へ置き換える／差分を見る／中止」を選べる。無応答や曖昧回答は上書き同意にしない。
- Git workspaceが完全にcleanで、追跡ファイルにsecret・資格情報らしき内容や危険な状態がなく、commit可能な場合だけ、pushしない空のローカル保護commitを1件作る。hashと対象を利用者へ示す。
- plugin更新は固定引数を `spawnSync` の `shell: false` で実行する。公式経路は `claude plugin marketplace update yasashii-secretary`、続いて `claude plugin update yasashii-secretary@yasashii-secretary --scope <user|project|local>` とした。任意shell文字列、push、remote変更、force push、`git reset --hard` の経路は持たない。
- plugin更新後は `/reload-plugins` を案内し、再開後にplugin versionを確認してからmigrationのdry-runを作る。dry-runのplan hashと一致する明示確認がある場合だけ本実行する。
- `0.2.0→0.3.0` と `0.3.0→0.4.0` のmigration manifestを追加した。更新対象は `secretary/AGENTS.md` の更新安全性sectionと `secretary/CLAUDE.md` の入口pointerだけで、記憶、PJ、Chatwork、settings、成果物、外部データは変更しない。
- 台帳なし0.2.0では、既知の配布基準hashと一致するファイルだけを確認済みとしてbootstrapする。それ以外は `unknown-baseline` として既定で残す。台帳は許可4fieldだけで、本文や私的内容を保存しない。
- migrationはmarkerとplan hashで冪等性、つまり同じ処理を再実行しても追加変更が発生しない性質を持たせた。途中失敗は同じplanから再開できる。
- 更新後にplugin version、台帳、個別選択、migration、秘書、記憶、settings、Chatwork、一般PJ、別repo開発PJ、buildを検証する。1件でも失敗すれば成功と報告しない。
- workspace rollbackは保護commitの各管理対象を `git show` から戻す。plugin旧版を公式CLIだけで自動復元できない場合は、未復元とコピー可能な手動確認手順を正直に示す。
- README、公開guide、update skillを、新しい安全な実更新の流れに更新した。既存の配布面、MIT、単段クレジット、`forkedFrom`、Chatwork、PJ境界は維持し、Google Chatは追加していない。

## version対応

| 配布面 | version |
|---|---|
| `.claude-plugin/marketplace.json` | `0.4.0` |
| `plugins/yasashii-secretary/.claude-plugin/plugin.json` | `0.4.0` |
| `plugins/yasashii-secretary/CHANGELOG.md` の最新見出し | `0.4.0` |

## 公式仕様の確認

- plugin更新コマンドとscope: <https://code.claude.com/docs/en/plugins-reference>
- marketplace更新、plugin更新、reload: <https://code.claude.com/docs/en/discover-plugins>
- marketplaceのversion解決とcache: <https://code.claude.com/docs/en/plugin-marketplaces>
- 実テストでは外部の実pluginを変更せず、固定引数を記録するテスト専用adapter `claude-fixture` を使った。

## 自己評価

| 基準 | スコア | 根拠 |
|---|---:|---|
| C1 完成度 | 5/5 | 診断、確認、保護commit、plugin更新、reload後再開、migration、検証、rollbackを一続きにした |
| C2 構文・整合 | 5/5 | version 3面、migration経路、plan hash、台帳hashを相互確認した |
| C3 機能の実証 | 5/5 | clean、customized、unknown、途中失敗、plugin失敗、検証失敗、rollbackを実行した |
| C4 非エンジニア体験 | 5/5 | 何が変わるか、残す選択、reload後の言葉、失敗時の次の操作を先に示した |
| C5 安全・規律 | 5/5 | 明示了承前0変更、secret非露出、push／remote変更0件、管理対象限定を確認した |
| C6 無回帰 | 5/5 | 全offline回帰308/308、全online回帰309/309 PASS |
| C7 やさしさ | 5/5 | 正式なコマンド名を保ちながら、段階ごとの目的と停止理由を平易に案内した |
| C8 wizard体験 | 5/5 | wizardは変更せず、Sprint 013／014の実動作回帰を維持した |
| C9 配布チャネル非依存 | 5/5 | 現行配布面、MIT、クレジット、識別子、既存境界の専用検査を維持した |
| C10 負テスト | 5/5 | 拒否、曖昧回答、secret、dirty、commit失敗、plugin失敗、plan不一致、検証失敗を拒否した |

## 既知の課題

- workspaceは保護commitから自動復元できる。plugin旧版は、公式CLIに「直前の版へ戻す」固定操作がないため、自動復元できたとは報告しない。更新前versionと未復元状態を示し、利用者がplugin管理画面で確認・再選択する手順を案内する。
- 実更新にはcleanなGit workspaceが必要。未commitの意図ある変更を秘書が勝手に保護commitへ含めないための安全側の制約である。
- reloadの操作そのものはClaude Code内で利用者が行う。再開時の状態fileは `.git/yasashii-secretary-update/session.json` に置き、本文・secretは保存しない。

## 起動・利用方法

- 秘書経由: `/secretary` に「最新版にして」と依頼し、診断後の最終確認へ進む。
- 開始: `node plugins/yasashii-secretary/scripts/update-apply.mjs start --workspace <workspace> --current-plugin-root <plugin-root> --latest-manifest <marketplace.json> --changelog <CHANGELOG.md> --consent update-approved --scope user`
- plugin更新だけ再試行: `node plugins/yasashii-secretary/scripts/update-apply.mjs retry-plugin --workspace <workspace> --plugin-root <plugin-root>`
- reload後のdry-run: `node plugins/yasashii-secretary/scripts/update-apply.mjs resume --workspace <workspace> --plugin-root <plugin-root>`
- 確認済みplanの適用: 上記へ `--apply --plan-hash <表示されたhash>` を加える。
- rollback: `node plugins/yasashii-secretary/scripts/update-apply.mjs rollback --workspace <workspace>`
- 常設serverや画面はない。対話とCLI機能のため、Sprint 018固有のテストURLはN/A。

## 検証結果

- Sprint 018専用回帰: `bash scripts/sprint-018-regression.sh` → `SPRINT018_PASS=41 SPRINT018_FAIL=0`
- Sprint 017回帰: `bash scripts/sprint-017-regression.sh` → `PASS=32 FAIL=0`
- release整合: `python3 scripts/check-release-integrity.py` → PASS
- 配布面維持: `bash scripts/sprint-016-regression.sh` → `SPRINT016_PASS=2 SPRINT016_FAIL=0`
- serializer: `python3 scripts/check-report-schema.py --plugin-root plugins/yasashii-secretary` → `surfaces=19 conflicts=0`
- 全offline回帰: `bash scripts/regression-check.sh --offline` → `PASS=308 FAIL=0`（loopback許可環境）
- 全online回帰: `bash scripts/regression-check.sh --online` → `PASS=309 FAIL=0`（loopback・通信許可環境）
- sandbox内の初回offline回帰は、既存Chatworkテスト2件だけが `listen EPERM 127.0.0.1` になった。同じcommit候補をloopback許可環境で再実行し、両方PASSした。
- Node構文検査と `git diff --check` → PASS

## Evaluatorへの具体的な確認シナリオ

1. 拒否、キャンセル、曖昧な了承、最新版未確認でplugin／workspace／Git／設定の前後snapshotが一致することを確認する。
2. clean fixtureで保護commitがちょうど1件でき、hashと対象が表示され、push／remote変更が0件であることを確認する。
3. secret疑い、管理対象外の資格情報file、dirty workspace、commit hook失敗では、保護commit／plugin更新／migrationが0件であることを確認する。
4. customized／unknown-baselineの既定が現状維持で、差分確認は本文を表示せず、明示選択したファイルだけが変わることを確認する。
5. 公式plugin更新コマンドが固定引数・`shell: false` で、保護commit後だけ呼ばれること、plugin失敗時migration 0件を確認する。
6. plugin失敗の再試行で保護commitが増えず、plugin成功後もreload前はmigration 0件であることを確認する。
7. reload後に新versionを再確認し、dry-runではworkspace変更0件、plan hash不一致でも変更0件であることを確認する。
8. clean、customizedの部分選択、途中失敗からの再開で、本実行対象がdry-runと一致し、同じmigrationの再実行による追加変更が0件であることを確認する。
9. 台帳なし0.2.0で既知基準一致だけが確認済みとなり、それ以外がunknownとして残り、台帳が許可4fieldだけであることを確認する。
10. syntheticなtoken、password、secret、私的本文がstdout、stderr、台帳、状態file、ログ、commitへ出ないことを確認する。
11. 更新後検証を1件失敗させ、成功報告が出ず、workspaceが保護commitへ戻ることを確認する。plugin未復元は未復元として表示されることも確認する。
12. migration、検証、rollbackの全経路にpush、remote変更、force push、破壊的resetがないことを確認する。
13. 全回帰を実行し、MIT、単段クレジット、`forkedFrom`、記憶、single private workspace、Chatwork、一般PJ、別repo開発PJが維持されることを確認する。
14. Google Chat、OAuth、同期、設定画面に関するskill、script、manifest、wizard、案内の追加が0件であることを確認する。

## Scope change detected

- なし。Google Chat、Chatwork設定変更、PJ正本変更、push、自動releaseは実装していない。

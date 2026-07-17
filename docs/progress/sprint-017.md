# Sprint 017 — G8前半 読むだけで分かる更新基盤

## 着手時の契約

- 実装対象: F30のversion整合、利用者向けCHANGELOG、新規導入時だけ作る最小台帳、完全な読み取り専用診断、自動更新の案内。
- 成功条件: `docs/sprints/sprint-017.md` の受入基準1〜10を専用回帰と全offline回帰で確認し、診断前後のplugin／workspace／Git／設定snapshotが一致すること。
- 実装しないもの: plugin更新、workspace上書き、migration、保護commit、rollback、reload／restart、自動更新設定変更、push、Google Chat。

## 実装状況

実装完了。Evaluatorの独立評価待ち。

## 実装内容

- marketplace、plugin manifest、配布plugin内CHANGELOGを公開版 `0.3.0` に揃えた。
- `check-release-integrity.py` を追加し、manifest不一致、CHANGELOG欠落・重複・逆順・必須説明欠落を配布前に拒否するようにした。
- `update` skillと秘書routerの導線を追加した。「最新版にして」「更新ある？」で、現在版、最新版、変更、影響、必要操作、衝突可能性を順に案内する。
- `update-diagnose.mjs` を追加した。clean、customized、ledgerless、unknown-baseline、same、update-available、current-unknown、latest-unverifiedを区別する。
- 診断scriptは読み取り専用で、ファイル書込API、`child_process`、plugin更新、migration、commit、push、設定変更、reload／restartのコード経路を持たない。
- `update-ledger.mjs` を追加し、新規導入時だけ最小台帳を作れるようにした。保存するのは管理対象path、導入version、SHA-256 hash、形式を固定した非機密変数だけで、本文や私的内容は保存しない。
- onboardingへ新規導入時の台帳初期化を接続した。既存workspace、再セットアップ、診断時には台帳を作成・上書きしない。
- READMEと公開guideへ更新診断、CHANGELOG、自動更新の既定状態と利用者自身による設定方法を追加した。plugin自動更新とworkspaceへコピー済みのファイルが別管理であることも明記した。
- 既存の配布面・serializer検査を14 skill／19 user-facing surfaceへ追従させ、Sprint 017専用回帰を全offline回帰へ接続した。
- MIT、Shin-sibainu/cc-companyへの単段クレジット、`forkedFrom`、一般PJ、別repo開発PJ、Chatwork、既存の安全境界を維持した。Google Chatは追加していない。

## version対応

| 配布面 | version |
|---|---|
| `.claude-plugin/marketplace.json` | `0.3.0` |
| `plugins/yasashii-secretary/.claude-plugin/plugin.json` | `0.3.0` |
| `plugins/yasashii-secretary/CHANGELOG.md` の最新見出し | `0.3.0` |

## 自己評価

| 基準 | スコア | 根拠 |
|---|---:|---|
| C1 完成度 | 5/5 | F30の利用者導線、CHANGELOG、診断、台帳、公開guideを実装した |
| C2 構文・整合 | 5/5 | 3つのversion面を一致させ、不一致・欠落・重複・逆順fixtureを拒否した |
| C3 機能の実証 | 5/5 | 同版、更新あり、現在版不明、最新版未確認、workspace 4状態を実行した |
| C4 非エンジニア体験 | 5/5 | 現在版から衝突可能性まで順に示し、見送り・中止も明示した |
| C5 安全・規律 | 5/5 | 診断の前後snapshot一致、side effect全項目0、秘密値非露出を確認した |
| C6 無回帰 | 5/5 | loopback許可環境で全offline回帰306/306 PASS |
| C7 やさしさ | 5/5 | 正式名称を保ちつつ、利用者が判断できる影響と次の操作を先に示した |
| C8 wizard体験 | 5/5 | wizardは変更せず、Sprint 013／014の実動作回帰を維持した |
| C9 配布チャネル非依存 | 5/5 | 現行配布面の専用検査とMIT・クレジット・識別子の保護を維持した |
| C10 負テスト | 5/5 | 不正release、秘密値、不正台帳、台帳なし、通信なし、全choiceを検証した |

## 既知の課題

- 実際のplugin更新、workspace移行、保護commit、rollbackはSprint 018の対象であり、このSprintでは未実装。利用者が「実更新へ進む」を選んでも診断で停止する。
- public配布repoへ接続できない場合は `latest-unverified` になる。これは安全側の仕様であり、推測で最新版とは報告しない。
- 第三者marketplaceの自動更新は利用者自身がClaude Codeの `/plugin` 画面で有効にする。診断から設定変更はしない。

## 起動・利用方法

- 秘書経由: `/secretary` に「更新ある？」「最新版にして」と依頼する。
- 診断CLI: `node plugins/yasashii-secretary/scripts/update-diagnose.mjs --workspace <workspace>`
- fixtureで最新版を固定する場合: `--latest-manifest <marketplace.json> --changelog <CHANGELOG.md>`
- JSON証跡: 上記に `--json` を追加する。
- 常設serverはない。診断はCLI／会話機能のため、Sprint 017固有のテストURLはN/A。

## 検証結果

- Sprint 017専用回帰: `bash scripts/sprint-017-regression.sh` → `PASS=32 FAIL=0`
- release整合: `python3 scripts/check-release-integrity.py` → PASS
- 配布面維持: `bash scripts/sprint-016-regression.sh` → `SPRINT016_PASS=2 SPRINT016_FAIL=0`
- serializer: `python3 scripts/check-report-schema.py --plugin-root plugins/yasashii-secretary` → `surfaces=19 conflicts=0`
- 全offline回帰: `bash scripts/regression-check.sh --offline` → `PASS=306 FAIL=0`（loopback許可環境）
- sandbox内の初回全回帰は既存Chatworkテスト2件だけが `listen EPERM 127.0.0.1` になった。同じcommit候補をloopback許可環境で再実行し、両方PASSした。
- 差分検査: `git diff --check` → PASS

## Evaluatorへの具体的な確認シナリオ

1. 3つのversion面が `0.3.0` で一致し、不一致・CHANGELOG欠落・重複・逆順fixtureが失敗することを確認する。
2. `0.3.0→0.3.0` はsame、`0.2.0→0.3.0` はupdate-available、現在版欠落はcurrent-unknown、`--no-network` はlatest-unverifiedになることを確認する。
3. clean、customized、ledgerless、unknown-baselineの診断前後で、plugin、workspace、Git、`.claude/settings.json` のsnapshotが一致することを確認する。
4. check-only、decline、cancel、proceed-updateの全choiceでside effectが0件で、proceed-updateも未実装として停止することを確認する。
5. 新規導入の台帳が許可4fieldだけを持ち、本文、氏名・役割等の私的変数、token、password、secretを保存・表示しないことを確認する。
6. README、公開guide、update skillで、自動更新の既定状態、利用者自身の操作、workspace別管理が理解できるか確認する。
7. plugin update、migration、commit、rollback、push、設定変更、reload／restartの実行経路が診断にないことを確認する。
8. 全offline回帰をloopback許可環境で実行し、Chatwork、一般PJ、別repo開発PJ、MIT、単段クレジット、`forkedFrom`が維持されることを確認する。

## Scope change detected

- なし。実更新、workspace migration、自動更新設定変更、Google Chatは実装していない。

# Sprint 017 評価結果

**判定:** 合格  
**失敗分類:** なし  
**評価対象:** Sprint 017 — G8前半 読むだけで分かる更新基盤  
**契約種別:** `Type: main`

version `0.3.0` の整合、利用者向けCHANGELOG、最小台帳、新規導入時だけの台帳初期化、読み取り専用の更新診断、自動更新の案内を独立に操作した。診断は `same`、`update-available`、`current-unknown`、`latest-unverified` と、`clean`、`customized`、`ledgerless`、`unknown-baseline` を区別した。`check-only`、`decline`、`cancel`、`proceed-update` の全選択で、plugin、workspace、Git、`.claude/settings.json` の前後snapshotは一致した。`proceed-update` も実更新を行わず停止した。

## スコア

| 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 5/5 | 4 | PASS | 受入基準10件をすべて実物で確認した |
| C2 構文・整合 | 5/5 | **5** | PASS | 3つのrelease面が`0.3.0`で一致し、負fixture 6件、serializer、online参照導線も成功 |
| C3 機能の実証 | 5/5 | 4 | PASS | 実CLIと独自fixtureで8状態、4選択、台帳生成・拒否経路を操作した |
| C4 非エンジニア体験 | 4/5 | 4 | PASS | 判断に必要な順序と次の操作は明確。利用者向け出力に内部呼称`Sprint 018`が1箇所残り、軽微な改善余地あり |
| C5 安全・規律 | 5/5 | **5** | PASS | 診断副作用、secret露出、境界外書込、設定変更、commit、pushが0件 |
| C6 無回帰 | 5/5 | **5** | PASS | 専用32件、全offline 306件、全online 307件が最終的に0 FAIL |
| C7 やさしさ | 4/5 | 4 | PASS | 確認だけ・見送り・中止・実更新希望を選べ、推測で成功報告しない。内部Sprint名だけ改善余地あり |
| C8 wizard体験・デザイン | N/A | 4 | 対象外 | Sprint 017は常設UIを持たないCLI／会話機能。wizard変更なしのため画像採点対象外 |
| C9 配布チャネル非依存 | 5/5 | **5** | PASS | 現行対象の旧固有表現0件。MIT、単段クレジット、`forkedFrom`、一般利用者向け導線を維持 |
| C10 更新の安全性 | 5/5 | **5** | PASS | Sprint 017の診断は完全な読み取り専用。実更新、migration、保護commit、rollback、workspace上書き、自動pushの実行経路0件 |

## PASS / FAIL集計

- 受入基準: **PASS=10 / FAIL=0**
- Sprint 017専用回帰: **PASS=32 / FAIL=0**
- 独自CLI・snapshot検査: **12ケース、4選択、PASS**
- release独自負fixture: **6ケース、PASS**
- release整合単独検査: **PASS**
- serializer: **surfaces=19 / conflicts=0**
- Sprint 016回帰: **PASS=2 / FAIL=0**
- 全offline回帰: **PASS=306 / FAIL=0**（loopback許可環境での最終結果）
- 全online回帰: **PASS=307 / FAIL=0**
- 既知失敗: **0件**

## 実行コマンドと結果

### 1. Sprint 017専用回帰

```bash
bash scripts/sprint-017-regression.sh
```

- exit 0、`PASS=32 FAIL=0`。
- release整合、台帳field、本文・私的値・secret非保存、4選択の無副作用、8診断状態、symlink拒否、実更新漏出0件を確認した。

### 2. release・serializer・直前Sprint

```bash
python3 scripts/check-release-integrity.py
python3 scripts/check-report-schema.py --plugin-root plugins/yasashii-secretary
bash scripts/sprint-016-regression.sh
```

- release整合: exit 0、`PASS release integrity: manifests and CHANGELOG are consistent`。
- serializer: exit 0、`surfaces=19 conflicts=0`。
- Sprint 016: exit 0、`SPRINT016_PASS=2 SPRINT016_FAIL=0`。

### 3. 全回帰

```bash
bash scripts/regression-check.sh --offline
bash scripts/regression-check.sh --online
```

- sandbox内のoffline初回は `PASS=304 FAIL=2`。失敗2件はSprint 013・014のlocalhost serverが `127.0.0.1` へbindする際の `listen EPERM` だけだった。
- 同じofflineコマンドをloopback許可環境で再実行し、exit 0、`PASS=306 FAIL=0`。環境制限と実装失敗を分離した。
- network許可環境のonline回帰はexit 0、`PASS=307 FAIL=0`。`yasashii-harness` のpublic・`fork=false`・remote manifest整合も成立した。

### 4. 独自の実CLI・snapshot検査

EvaluatorがGeneratorの集計を流用せず、一時plugin／workspaceを作り、次を独立実行した。

```text
CUSTOM_EVAL_PASS cases=12 choices=4 snapshots=plugin+workspace+git+settings
statuses=same,update-available,current-unknown,latest-unverified,clean,customized,ledgerless,unknown-baseline
sideEffects=0 secretExposure=0 traversalWrite=0 symlinkWrite=0
```

snapshotは、fixture plugin、workspace全ファイル、workspace内`.git`、`.claude/settings.json`、台帳、symlinkをpathとSHA-256で保持した。結果は次のとおり。

- `check-only`、`decline`、`cancel`、`proceed-update`: 一括実行前後でsnapshot完全一致。
- `clean`: 配布時hashとの一致を検出し、前後snapshot一致。
- `customized`: `secretary/AGENTS.md`変更後に検出し、診断前後snapshot一致。
- `ledgerless` + `--no-network`: `ledgerless`／`latest-unverified`となり、`.yasashii-secretary/`を新設しない。
- `unknown-baseline`: traversal path、余分field、secret形式の値を含む不正台帳を安全側へ倒し、入力値をstdout／stderrへ出さない。
- `proceed-update`: `selectedOutcome=実更新は未実装のため停止`、side effect counter全7項目0、実snapshotも一致。
- 台帳初期化のpath traversalとsymlink対象は非ゼロで拒否し、台帳・境界外ファイルを作らない。

### 5. release独自負fixture

Evaluatorが一時release treeを作り、次の6ケースを独立実行した。

```text
RELEASE_NEGATIVE_PASS cases=6 current=0.3.0 mismatch+missing-file+missing-section+duplicate+reverse rejected
```

現行releaseは成功し、manifest不一致、CHANGELOGファイル欠落、必須項目欠落、version重複、版の逆順をすべて非ゼロで拒否した。

## version対応

| 配布面 | 観測値 | 判定 |
|---|---|---|
| `.claude-plugin/marketplace.json` | `0.3.0` | PASS |
| `plugins/yasashii-secretary/.claude-plugin/plugin.json` | `0.3.0` | PASS |
| `plugins/yasashii-secretary/CHANGELOG.md` 最新見出し | `0.3.0` | PASS |

CHANGELOGの`0.3.0`には「対象者」「変わること」「設定・ファイルへの影響」「必要な操作」「互換性上の注意」が各1件以上あり、内部script名を知らなくても、読み取り専用であること、台帳の範囲、自動更新時もworkspaceコピーは別管理であることを判断できる。

## 実CLI出力の確認

実repoのplugin、workspace、local marketplace、CHANGELOGを指定し、`--choice proceed-update`を実行した。

```bash
node plugins/yasashii-secretary/scripts/update-diagnose.mjs \
  --workspace . \
  --plugin-root plugins/yasashii-secretary \
  --latest-manifest .claude-plugin/marketplace.json \
  --changelog plugins/yasashii-secretary/CHANGELOG.md \
  --choice proceed-update
```

主要観測値は次のとおり。

```text
現在版: 0.3.0
最新版: 0.3.0
判定: same
カスタマイズ衝突可能性: ledgerless（clean=0 / customized=0 / unknown=0）。台帳がないため、未変更とは判断しません。
選択結果: 実更新は未実装のため停止
```

続けて変更点、設定・ファイルへの影響、必要な操作、互換性上の注意を表示し、plugin自動更新とworkspace側の別管理も明記した。実更新の成功を推測で報告しなかった。

## コード経路の安全確認

`update-diagnose.mjs`を通読し、importと実行経路を確認した。

- filesystemは`existsSync`、`lstatSync`、`readFileSync`、`realpathSync`だけ。workspace・plugin・Git・設定へ書くAPIなし。
- `child_process`、shell起動、plugin install/update、marketplace update、migration apply、commit、push、reload／restart実行なし。
- networkは固定されたpublic marketplace／CHANGELOG URLの`fetch`だけ。失敗時は`latest-unverified`で停止する。
- 台帳のpathは固定allowlist、正規化、workspace外判定、各path要素のsymlink判定を通る。
- 台帳schemaは4field完全一致、semver、SHA-256形式、許可された非機密変数と値形式を検証する。不正台帳は値を表示せず`unknown-baseline`にする。
- `update-ledger.mjs`の書込経路は、`init`、`--new-install`、`--confirm`、管理対象pathの存在、安全な保存先、既存台帳不在がすべて成立した新規導入だけ。temporary fileからrenameし、既存台帳を上書きしない。
- plugin配下に`migrations/`はなく、Sprint 018のapply／rollback実装もない。

## 自動更新案内の公式確認

2026-07-17にClaude Code公式一次資料を確認した。

- [Discover and install plugins — Configure auto-updates](https://code.claude.com/docs/en/discover-plugins#configure-auto-updates) は、第三者・local development marketplaceの自動更新が既定で無効であること、`/plugin` → `Marketplaces` → 対象marketplace → `Enable auto-update`の操作、更新後は`/reload-plugins`または次回起動で反映されることを説明している。README、guide、update skillの案内と一致する。
- [Plugin marketplaces — Version resolution and release channels](https://code.claude.com/docs/en/plugin-marketplaces#version-resolution-and-release-channels) は、`plugin.json`のversionがmarketplace entryより優先され、同じversionでは更新をskipすると説明している。本repoは契約どおり両面を`0.3.0`へ揃え、機械検査で不一致を拒否している。
- pluginの自動更新はplugin cache上の更新であり、yasashii-secretaryが初回セットアップでworkspaceへコピーしたファイルは別管理になる、という注意も製品実装と整合する。

案内を読む操作と診断CLIのどちらも、自動更新設定を変更しなかった。

## 既存境界とスコープ外

- MIT License、Shin-sibainu/cc-companyへの単段クレジット、`forkedFrom`を維持。
- Chatwork、single private workspace、一般PJ、別repo開発PJポインタ、`build`／`yasashii-harness`導線を全回帰で維持。
- 現行対象の旧配布チャネル固有表現は0件。監査記録は変更していない。
- public／配布plugin／guide／READMEに`Google Chat`実装・案内は0件。既存のGoogle・Microsoft・Notion公式コネクタ説明にある一般用語`OAuth`は本Sprint追加ではなく、Google Chat機能ではない。
- plugin update、workspace migration、保護commit、rollback、自動更新設定変更、reload／restart、自動pushは実装していない。

## 受入基準の判定

1. version整合: **PASS**
2. 利用者向けCHANGELOG: **PASS**
3. 最小台帳: **PASS**
4. 現在版／最新版: **PASS**
5. 説明の完全性: **PASS**
6. 診断副作用0件: **PASS**
7. 自動更新は案内のみ: **PASS**
8. 新規配布時の基準情報: **PASS**
9. 既存境界と全回帰: **PASS**
10. 実更新漏出0件: **PASS**

## 軽微な改善余地

利用者向けのCLI出力とupdate skillに「Sprint 018で対応予定」という内部の開発単位が1箇所ずつある。機能判断や安全性は損なわず、閾値未満ではないが、公開版では「実更新機能は今後の版で対応予定」のように言い換えると、一般利用者にはさらに自然になる。これはSprint 017の合否を覆す欠陥ではなく、次回の文言調整候補とする。

## 最終判定

**合格。** C2・C5・C6・C9・C10のゼロ許容基準をすべて5/5で満たし、受入基準10/10、専用32/32、全offline 306/306、全online 307/307が成功した。OrchestratorはSprint 017を`done`へ更新できる。

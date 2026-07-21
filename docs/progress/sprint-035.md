# Sprint 035 — 2版のhost中立化とHarness 0.5.0互換

**ステータス:** Generator実装・local自己検証完了。fresh独立Evaluator待ち

## 実装結果

`agentic-secretary` を共通正本、`yasashii-secretary` を宣言的overlayとして、Claude CodeとCodexの
両hostで同じ15 skillsを配布できる構成へ更新した。Harness本体、agents、commands、hooks、runtimeは
Secretaryへ同梱していない。plugin install、OAuth、Secret、release、push、workflow dispatchは実行していない。

### 1. host中立のplugin root

- 15件すべての `SKILL.md` が、読み込まれたSKILL自身の実ファイル絶対pathから
  `plugins/secretary/` を解決する共通契約へ移行した。
- `scripts/resolve-plugin-root.mjs` は空path、相対path、未解決placeholder、誤ったtreeをexit 2で拒否する。
- `${CLAUDE_PLUGIN_ROOT}`、cwd、host固有環境変数をfallbackに使わない。
- 任意の絶対install pathと異なるcwdを使うfixtureで15 skillsの同梱参照を確認した。

### 2. Claude Code／Codexの正式配布面

- Claude Codeは `.claude-plugin/marketplace.json` と `.claude-plugin/plugin.json`、Codexは
  `.agents/plugins/marketplace.json` と `.codex-plugin/plugin.json` を正式面にした。
- 両hostとも同じ `plugins/secretary/skills/` 15件を参照し、host別skillコピーは作っていない。
- `host-inventory.json` にslash command、`$skill-name`、connector/App、更新・再読込面等のhost差を列挙した。
- 接続案内は、hostが提供する公式connector/Appの有無を確認し、利用不能時は未確認として停止する。

### 3. 2つのHarness 0.5.0

- Agentic版は `mtaiseeei/agentic-harness`、Yasashii版は `mtaiseeei/yasashii-harness` を参照する。
- `edition.json` にversion、repository、確認済みremote commit、Claude Code／Codex別のmarketplace、
  install ID、明示入口を保持した。
- `build`、README、project pointer生成文面はhost別IDを混ぜず、通常会話からの起動も案内する。
- 公開GitHub APIから両Harnessのrepository、main commit、Claude/Codex manifest、README commandを検査する
  `check-harness-compat-online.mjs` を追加した。network unavailableはPASSにしない。

### 4. Harness 0.5.0の進行規則

- `.harness/config.toml` に `max_lineage_dispatches = 10` と `max_spec_issue_returns = 2` を追加した。
- 既存の製品固有規則を残したまま、`verification-scope-issue`、product／verification-infra分類、
  safe harbor、増分再評価、same-candidate evidence再利用、`Spec-Issue Count`、`Lineage Dispatches`、
  `done-by-user-decision` をAGENTS、CLAUDE、guidanceへ追記した。
- active Sprintの受入基準、閾値、証拠形式をユーザー承認なく変更しない規則を維持した。

### 5. Yasashii overlay

- 上流baseを `f1fddea77db823c2b1826ac11c1d3eedf6770cf9` として610 filesを再記録した。
- Codex marketplace／manifestをmetadata overlayへ追加し、Yasashii identityと同じ15 skillsを保持した。
- Harnessのrepository、observed commit、Claude/Codex IDをYasashii版の値へ置換した。
- overlay managed filesは225件。二回適用の2回目は `secondChanged=0` で、repo-owned digestも不変だった。

## 実装commit

- Agentic共通正本: `f1fddea77db823c2b1826ac11c1d3eedf6770cf9`
  (`[sprint-035] Harness 0.5.0とhost中立参照へ対応`)
- Yasashii overlay実装: `f0108127a5a3c9bd0e551afd61f72820dfeccd59`
  (`[sprint-035] 2版のhost整合とHarness 0.5.0を反映`)

本progressは上記実装commitの後にGenerator handoffとして別commitする。

## 主な変更file

- 共通: `plugins/secretary/scripts/resolve-plugin-root.mjs`、15件の `skills/*/SKILL.md`
- 共通: `plugins/secretary/host-inventory.json`、`edition.json`、`scripts/project-tools.mjs`
- 共通: `scripts/{sprint-035-test,check-harness-compat-online}.mjs`、`scripts/lib/harness-compat.mjs`
- 配布: `.agents/plugins/marketplace.json`、`plugins/secretary/.codex-plugin/plugin.json`
- Harness規則: `.harness/config.toml`、`AGENTS.md`、`CLAUDE.md`、`docs/harness-guidance.md`
- Yasashii overlay: `secretary-overlay/{upstream-base,upstream-tree,mapping,anchors,metadata-overrides}.json`
- 公開案内: `README.md`、`plugins/secretary/skills/build/SKILL.md`

## 自動テスト結果

| 対象 | コマンド | 最終結果 |
|---|---|---:|
| Agentic edition／host配布 | `node scripts/sprint-033-test.mjs` | 20 PASS / 0 FAIL |
| Agentic Sprint 035 | `node scripts/sprint-035-test.mjs` | 12 PASS / 0 FAIL |
| Agentic Harness remote | `node scripts/check-harness-compat-online.mjs` | PASS、commit `aafdf97d...`、version 0.5.0 |
| Yasashii overlay | `node scripts/sprint-034-test.mjs /Users/taisei/workspace/agentic-secretary` | 11 PASS / 0 FAIL |
| Yasashii Sprint 035 | `node scripts/sprint-035-test.mjs` | 12 PASS / 0 FAIL |
| project pointer／一般PJ | `TMPDIR=/private/tmp bash scripts/sprint-015-regression.sh` | 68 PASS / 0 FAIL |
| overlay exact check | `node scripts/sync-secretary-overlay.mjs --check --candidate /Users/taisei/workspace/agentic-secretary` | PASS、managed 225 |
| overlay二回適用 | `node scripts/sync-secretary-overlay.mjs --reapply --candidate /Users/taisei/workspace/agentic-secretary` | PASS、secondChanged 0 |
| Yasashii Harness remote | `node scripts/check-harness-compat-online.mjs` | PASS、commit `8f9eb4c1...`、version 0.5.0 |
| 構文・差分 | `bash -n scripts/regression-check.sh`、`git diff --check` | PASS |

合計123 assertions（Sprint 033、034、035、project pointer）が0 FAIL。これとは別にoverlay check／reapplyと
両remote互換gateがPASSした。

旧master `scripts/regression-check.sh` はAgentic版でYasashii identityを期待する既存項目と、restricted
sandbox内でlocalhost listenが `EPERM` になるfixtureがあり、全体green gateとしては使っていない。
Sprint 035の変更面は上表の専用回帰で分離検証した。`sprint-015` は `/var` のsymlinkを安全境界が拒否するため、
実pathである `TMPDIR=/private/tmp` を指定した最終実行を正式結果とした。

## 起動・確認方法

常駐アプリやmanual test URLはない。repo rootで次を実行する。

```bash
node scripts/sprint-035-test.mjs
node scripts/check-harness-compat-online.mjs
```

Yasashii overlayは追加で次を実行する。

```bash
node scripts/sync-secretary-overlay.mjs --check --candidate /Users/taisei/workspace/agentic-secretary
node scripts/sprint-034-test.mjs /Users/taisei/workspace/agentic-secretary
TMPDIR=/private/tmp bash scripts/sprint-015-regression.sh
```

## Evaluatorの確認シナリオ

1. 15 skillsそれぞれを実plugin pathから選び、異なるcwdでも同梱rule／script／template参照が解決する。
2. 空、相対path、未解決placeholder、誤ったSKILL pathが副作用0で拒否される。
3. Claude CodeとCodexのformal manifestが同じ15 skillsを参照し、edition identityを混ぜない。
4. Agentic／YasashiiそれぞれのbuildとREADMEが、対応するHarness 0.5.0のhost別IDだけを案内する。
5. online checkerが誤version、誤ID、manifest欠落、network unavailableをPASSにしない。
6. overlayを二回適用し、2回目変更0、repo-owned docs／spec／evidence不変を確認する。
7. AGENTS、CLAUDE、guidance、configに0.5.0のcounter・分類・safe harborが揃い、既存製品規則を保持する。

## 外部gateと残余リスク

1. 公開GitHub上の両Harness repository／manifest／READMEは確認済みだが、Claude Code／Codexの実hostでの
   marketplace登録、plugin install、install後のskill discoveryと起動は実行していない。
2. Yasashii overlayの実remote `origin`／`upstream` 契約は変更していない。`external-live-gate-unavailable` の
   ままであり、remote設定変更、fetch、pushは再承認なしに行わない。
3. plugin release、archive、公開、実利用者workspaceの更新移行は本Sprintの実行対象外。
4. UI変更はないためBrowser確認とURL証跡は対象外。Evaluatorは配布・root・remote互換の実動作を優先する。

## Generator自己評価

受入対象の2版、2host、15 skills、Harness 0.5.0、overlay冪等性は専用回帰とremote読取で確認した。
実hostへのinstall／discoveryは外部gateとして残す。完了判定はfresh独立EvaluatorとOrchestratorへ委ねる。

# Sprint 022 Retry 2 評価結果

**製品判定:** 合格（PASS）
**評価対象:** Sprint 022 — 0.7.0安全性2: symlink境界と有限時間の外部処理
**評価ラウンド:** Retry 2
**Escalation Recommendation:** none

## 結論

Retry 1で残っていた2件は、製品fixtureを流用しない `/tmp` の独立fixtureでも修正を確認した。

- Shellの作業root入力に途中symlinkがある場合、通常writeと確認済み通常deleteはともにexit 3で副作用前に拒否された。外部sentinel、削除対象、入力linkの内容・hash・metadataは不変だった。
- `update-apply.mjs`のworkspace入力に途中symlinkがある場合、exit 3で拒否された。外部一時Git repoのHEAD、index、worktree、cached／unstaged diff、tracked sentinel、update session、入力linkはすべて不変だった。

Node共通guard、link-only削除、通常削除の2段階確認、外部repoを実pathから直接扱う正常系、macOS標準 `/tmp -> /private/tmp` alias、CLI／HTTP timeout、process tree cleanup、関連回帰も合格した。Sprint 022の実装不具合は今回確認していない。

ただし、評価操作には1件の逸脱があった。master offline suiteが対象面一覧を出力した際、明示的に列挙禁止とされた `docs/evidence/sprint-020-patch-001/evaluator-retry2/` 配下のファイル名を結果として列挙した。内容の読取り・表示・変更は行っていない。この逸脱は製品合否とは分離して記録するが、Evaluatorの手順遵守としては不合格である。

## 採点

| 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 5/5 | 4 | PASS | AC1〜AC11を専用回帰と独立fixtureで確認。Retry 1の2件も閉じた。 |
| C2 構文・整合 | 5/5 | 5 | PASS | 専用suiteのNode／shell構文、関連wrapper、master内のmanifest／参照整合が成功。 |
| C3 機能の実証 | 5/5 | 4 | PASS | 独立fixture 30/30、Sprint 022専用69/69、Sprint 018 41/41。 |
| C4 非エンジニア体験 | 5/5 | 4 | PASS | 対象はCLI安全処理。拒否は非0終了し、既存の日本語エラーと確認手順を維持。 |
| C5 安全・規律 | 5/5 | 5 | PASS | 外向きsymlink経由のwrite／delete／update副作用0。link-only削除と実path正常系を両立。 |
| C6 無回帰 | 5/5 | 5 | PASS | Sprint 022 69/69＋wrapper 8/8、Sprint 018 41/41、sandbox由来で失敗したSprint 019／Patch 001は権限付き個別再実行で0 FAIL。master集約の残り1件は現行Sprint契約のprotected-record基準差分で、製品動作回帰ではない。 |
| C7 やさしさ | 5/5 | 4 | PASS | 削除確認と安全停止の説明を維持し、安全規律を緩めていない。 |
| C8 wizard体験・デザイン | 対象外 | 4 | N/A | UI変更のないCLI／filesystem Sprint。URL、browser、screenshot採点は対象外。 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | 今回変更による配布チャネル依存の追加なし。関連静的検査成功。 |
| C10 更新の安全性 | 5/5 | 5 | PASS | update-applyは途中symlink workspaceをsession作成前に拒否し、外部Git状態不変。Sprint 018 41/41。 |
| C11 Google Chat境界 | 5/5 | 5 | PASS | 対象変更で境界回帰なし。Sprint 019は権限付き再実行で51/51、wrapper 12/12。 |
| C12 0.7.0配布準備 | 5/5 | 5 | PASS | Sprint 022保証範囲のsymlink越境とtimeout欠陥0件。これはSprint 028の正式release ready判定ではない。 |

1軸でも閾値未達なら不合格だが、対象Sprintの全採点軸は閾値を満たした。C8は非UI Sprintのため対象外とした。

## 受入基準

| AC | 判定 | 証跡 |
|---|---|---|
| AC1 Node書込み境界 | PASS | 独立Node fixtureで途中symlink rootを拒否し、外部作成0件。専用suiteでroot／途中／最終も成功。 |
| AC2 未作成path境界 | PASS | 専用suiteで最深既存ancestorを使う拒否と部分生成0件。 |
| AC3 shell導線非回帰 | PASS | 独立Shell fixtureで途中symlink rootの通常writeをexit 3で拒否。macOS `/tmp` alias正常writeは成功。 |
| AC4 symlink削除 | PASS | 独立file／directory symlink削除でlinkのみ消え、参照先内容・hash・metadata不変。 |
| AC5 通常削除 | PASS | 独立fixtureで無確認deleteは拒否・対象不変、確認済みdeleteだけ成功。途中symlink rootでは確認済みでも拒否。 |
| AC6 rollback境界 | PASS | update入口が途中symlink workspaceをsession前に拒否。Sprint 018更新・rollback 41/41。 |
| AC7 CLI timeout | PASS | `git`／`gh`／`claude`／`gcloud`のhang、後続副作用0、再試行成功を専用69件内で確認。 |
| AC8 HTTP timeout | PASS | 共通HTTP、Chatwork、Google Chat API、OAuth、header後body停止をtimeoutとして確認。 |
| AC9 process後始末 | PASS | 親先行終了後の子SIGKILL、maxBuffer、listener／timer解放、残process 0を専用suiteで確認。 |
| AC10 別repo開発PJの正常系 | PASS | symlink経由を拒否し、実pathをrootにした独立Node create／rename／deleteは成功。 |
| AC11 既存全回帰 | PASS | 対象・関連suiteはすべて0 FAIL。master集約の環境／protected-record要因は下記に分離。 |

## 実行証跡

### 1. 提供baseline

```bash
bash scripts/sprint-022-regression.sh
```

- exit 0
- `SPRINT022_PASS=69 SPRINT022_FAIL=0`
- `SPRINT022_WRAPPER_PASS=8 SPRINT022_WRAPPER_FAIL=0`
- CLI／HTTP timeout、process cleanup、link-only削除、macOS alias、Node／Shell／update境界を含む。

### 2. 独立fixture

```bash
bash -n /tmp/sprint022-retry2-evaluator.sh
bash /tmp/sprint022-retry2-evaluator.sh
```

- 構文: exit 0
- 実行: exit 0、`INDEPENDENT_SUMMARY pass=30 fail=0 shell_write_rc=3 shell_delete_rc=3 update_rc=3 node_rc=0 alias_rc=0`
- 安全な一時directoryは `/tmp/yss-s022-retry2-evaluator.XXXXXX`。終了時に削除し、repo内fixture残存0件。
- Shell外部sentinelと削除対象は、content、SHA-256、mode、size、mtime、inodeの前後snapshotが一致。
- update外部一時Git repoは、HEAD、`.git/index` SHA-256、`status --porcelain -uall`、unstaged／cached binary diff、tracked sentinel、session有無、入力link snapshotがすべて一致。
- 一時Git repoのHEAD比較用にfixture内だけでbaseline commitを1件作成。製品repo・外部serviceへのcommit／pushは0件。

### 3. 関連回帰

```bash
bash scripts/sprint-018-regression.sh
```

- exit 0、`SPRINT018_PASS=41 SPRINT018_FAIL=0`

```bash
bash scripts/sprint-019-regression.sh
```

- sandbox内ではloopback bindが `EPERM` となったため、ローカル127.0.0.1待受だけを許可して再実行。
- exit 0、`SPRINT019_PASS=51 SPRINT019_FAIL=0`、wrapper `12/0`。

```bash
bash scripts/sprint-020-patch-001-regression.sh
```

- 同じloopback制約を権限付きで再実行。
- exit 0、copy `69/0`、Chatwork result `7/0`、Chatwork `59/0`、Google Chat `51/0`、Sprint 020 `50/0`、wrapper `7/0`。

### 4. master offline

```bash
bash scripts/regression-check.sh --offline
```

- exit 1、集約 `PASS=325 FAIL=5`。
- うち4件はsandboxの `listen EPERM: 127.0.0.1` による派生失敗で、上記2つの個別suiteを権限付き再実行して0 FAILを確認した。
- 残る1件はSprint 016 protected-record検査が現worktreeの `docs/sprints/sprint-022.md` を基準差分として検出したもの。Sprint 022製品動作の回帰ではない。
- masterの対象面一覧出力が禁止対象配下のファイル名を列挙したため、このmaster出力は製品合格の単独根拠には採用しない。
- online masterは外部service禁止のため実行していない。Generator引き渡しには隔離cloneでoffline 330/330・online 331/331の記録があるが、今回の独立実行結果には数えていない。

## UI／browser

対象はCLI／filesystem安全性で、常駐アプリ、test URL、DOM、レスポンシブ、視覚品質の変更はない。したがってbrowser操作とscreenshotはN/A。UI採点を行っていないため、スクリーンショット必須条件にも該当しない。

## 残課題

- Sprint 022の実装不具合: なし。
- 評価操作の手順逸脱: master suiteにより、列挙禁止対象配下のファイル名が出力された。内容読取り・変更は0件だが、今後このworktreeで同じmasterを実行する前に対象一覧の出力範囲を確認する必要がある。
- master offlineのprotected-record基準差分は、製品コードとは別の回帰基準整合課題として残る。Evaluator権限ではspec／contract／test基準を変更しない。
- 実外部service書込み、project commit、pushは0件。online回帰も未実施。

## Evaluator自己レビュー

- Retry 1の2件を製品fixtureだけで合格扱いしていないか: yes。独立 `/tmp` fixtureで再現した。
- Shell write／confirmed deleteの拒否前後をhash・metadataまで比較したか: yes。
- updateのHEAD／index／worktree／session／入力linkを比較したか: yes。
- link-only削除と実path正常系を壊していないか: yes。
- timeout成功を空結果・成功へ誤分類していないか: yes。専用suiteで確認した。
- baseline成功で独立不具合を相殺していないか: yes。独立fixtureも30/30。
- UIを不必要に採点したか: no。C8、browser、screenshotはN/A。
- 製品合否と評価操作の列挙逸脱を分離したか: yes。
- 禁止対象の内容を読んだ、または変更したか: no。ただしファイル名の列挙は発生したため逸脱として記録した。
- 実装、spec、state、progress、Git正本、外部serviceを変更したか: no。書込みは本feedbackと自動削除済み一時fixtureだけ。

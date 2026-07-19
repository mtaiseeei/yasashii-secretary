# Sprint 025 評価結果

**製品判定:** 合格（PASS）
**評価対象:** Sprint 025 — 0.7.0更新配布: version整合とplugin／workspace完全復元
**評価ラウンド:** 初回
**Failure Classification:** none
**Escalation Recommendation:** none
**Harness:** Agentic Harness 0.4.4 / fresh Evaluator
**実model / effort:** unverified（親dispatchでLuna xHigh指定との引渡しは受けたが、このEvaluator作業単位からhost側の実起動metadataを取得できないため、設定値を実起動証拠として扱わない）

## 結論

Sprint 025は合格と判定する。

- marketplace、plugin manifest、CHANGELOG、診断、migration、公開説明のversionは `0.7.0` で整合した。
- 0.6.0相当workspaceで、読み取り専用診断、確認前副作用0、保護commit、dry-run、apply、検証、再実行の冪等性を確認した。
- 利用者が変更した `AGENTS.md`、記憶、一般PJ、Chatwork履歴、Google Chat履歴は更新後もbyte単位で不変だった。
- 検証失敗時はworkspaceとpluginを別々に0.6.0へ復元し、pluginのversion、scope、主要skillを確認した。
- 更新後の利用者commitがある場合はworkspaceを上書きせず、pluginだけを戻した `partial-restoration` と未解決操作を表示した。
- 製品fixtureとは別の独立fixture 25件で、validator正負、0.6.0診断、同意、dry-run／apply／retry、カスタマイズ保護、完全復元、部分復元を確認した。
- 専用回帰25/25、master offline 336/336、master online 337/337。既知失敗を合格扱いしていない。
- 実API、実Secret、実workflow dispatch、remote pushは0件。onlineの外部操作は公開情報の読み取りだけだった。

UI変更はないためbrowser／screenshotはN/Aとした。C8は関連wizard回帰による無回帰確認に限定し、視覚品質を新規採点していないため4/5とする。

## 採点

| 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 5/5 | 4 | PASS | AC1〜AC12を専用25件、独立25件、master offline／onlineで確認。 |
| C2 構文・整合 | 5/5 | 5 | PASS | 全version面、manifest、CHANGELOG、migration、archive互換validatorが整合し、負例を拒否。 |
| C3 機能の実証 | 5/5 | 4 | PASS | 別workspace、別カスタマイズ、別validator負例で診断からapply、retry、rollbackまで直接実行。 |
| C4 非エンジニア体験 | 5/5 | 4 | PASS | 変更内容と影響を先に示し、部分復元時は未完了、旧版、scope、次の操作を明示。 |
| C5 安全・規律 | 5/5 | 5 | PASS | 確認前更新0、私的データ不変、後続commit非上書き、実外部write 0、禁止対象接触0。 |
| C6 無回帰 | 5/5 | 5 | PASS | 専用25/25、master offline 336/336、online 337/337。すべて0 FAIL。 |
| C7 やさしさ | 5/5 | 4 | PASS | 更新失敗や片側だけの復元を成功と見せず、実行可能な回復手順を短い日本語で案内。 |
| C8 wizard体験・デザイン | 4/5 | 4 | PASS | UI変更なし。関連wizard自動回帰は成功したが、browser／screenshotで視覚品質を再採点していない。 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | `.git` なしarchive validatorが成功し、source／metadata不正を拒否。online配布面回帰も成功。 |
| C10 更新の安全性 | 5/5 | 5 | PASS | 読取診断、同意、保護、dry-run、カスタマイズ保護、冪等性、plugin／workspace別復元を実証。 |
| C11 Google Chat境界 | 5/5 | 5 | PASS | Google Chat履歴をmigration対象外としてbyte不変を確認し、既存Google Chat回帰も0 FAIL。 |
| C12 0.7.0配布準備 | 5/5 | 5 | PASS | 0.7.0整合、必須metadata、CHANGELOG、0.6.0移行・復元、全回帰が合格。 |

合計59/60。全軸が閾値を満たす。C2・C5・C6・C9・C10・C11・C12のゼロ許容軸に違反は確認していない。

## 受入基準

| AC | 判定 | 独立証跡 |
|---|---|---|
| AC1 version一致 | PASS | marketplace、plugin manifest、CHANGELOG先頭、診断最新版、migration到達版、公開説明を0.7.0として確認。 |
| AC2 CHANGELOG | PASS | 対象者、変わること、設定・ファイルへの影響、必要な操作、互換性上の注意が各1節で存在し、validatorが順序と内容を検査。 |
| AC3 0.6.0診断 | PASS | 0.6.0→0.7.0を検出。診断前後のworkspace snapshot一致、side effects全項目0。 |
| AC4 migration dry-run | PASS | plan hashを返し、本実行前に計画を固定。記憶、一般PJ、両チャット履歴は適用後もbyte不変。 |
| AC5 カスタマイズ保護 | PASS | 0.6.0 baselineから利用者が追記した `AGENTS.md` のローカル方針をapply後も保持。 |
| AC6 冪等性 | PASS | 同じworkspaceで2回目のresumeはmigration 0件、workspace snapshot不変。専用回帰では台帳path重複0も確認。 |
| AC7 plugin rollback | PASS | 同じscopeへ0.6.0を復元し、manifest versionと `secretary`／`update` の主要skillを実確認。 |
| AC8 workspace rollback | PASS | 検証失敗fixtureでは保護地点へ全復元。更新後の利用者commitがあるfixtureではworkspace復元を拒否し、そのcommitを保持。 |
| AC9 部分復元表示 | PASS | pluginだけ戻った場合を `partial-restoration` とし、未解決項目を返す。専用回帰で旧版、scope、実行可能commandも確認。 |
| AC10 validator | PASS | 正常archiveを許可。独立負例としてowner不一致、小文字license、絶対source、prerelease version、CHANGELOG必須節欠落をすべて拒否。専用回帰のauthor、MIT、credit、forkedFrom、name、source、version負例も合格。 |
| AC11 archive互換準備 | PASS | `.git` なしの配布fixtureで `check-release-integrity.py --root` がexit 0。 |
| AC12 全回帰 | PASS | 専用25/25、master offline 336/336、online 337/337。Sprint 017／018、更新、安全、両チャットを含め0 FAIL。 |

## 実行証跡

### 1. Sprint 025専用回帰

```bash
bash scripts/sprint-025-regression.sh
```

- exit 0
- `SPRINT025_PASS=25 SPRINT025_FAIL=0`
- version／validator、診断、確認、plugin退避、dry-run、apply、台帳、私的データ保護、再実行、旧session回収、完全rollback、後続commit保護、手動fallbackを確認。

### 2. 独立fixture

製品の `scripts/sprint-025-regression.sh` の期待値を判定根拠として流用せず、Evaluatorが一時領域へ別の0.6.0 workspace、別のローカル変更、別のvalidator負例、fake Claude CLIを作成した。

```bash
python3 /tmp/s025-independent-evaluator.py
```

最終結果:

```text
INDEPENDENT_PASS=25 INDEPENDENT_FAIL=0
```

確認した内容:

- `.git` なしarchiveの正例と、Generator fixtureとは異なるvalidator負例5件。
- 0.6.0→0.7.0診断、診断副作用0、明示同意前plugin更新0。
- user scopeを保持したplugin更新、0.6.0 plugin backup、plan hash、apply後検証。
- customized `AGENTS.md`、記憶、一般PJ、Chatwork／Google Chat履歴の保持。
- 同じmigrationの再実行0件。
- workspace／plugin完全復元と0.6.0主要skill再確認。
- 更新後の利用者commit非上書き、plugin単独復元、未解決項目表示。

独立fixtureの初回はmacOS一時pathの `/var` symlinkをfilesystem guardが拒否した。実pathへ正規化して最初から再実行し、25/25となった。これは境界guardの正常動作であり、製品assertのFAILへ含めていない。また、確認なしの `start` はexit codeではなく「更新commandを一度も起動しない」ことを副作用で判定した。

### 3. 隔離master offline／online

製品repoを直接master fixtureとして使わず、`docs/evidence` を全除外した一時Git repoで実行した。旧Sprint fixtureに必要な既存Git objectはread-onlyのalternate object storeで参照し、working tree／indexへ `docs/evidence` を生成・列挙・コピーしていない。

```bash
bash scripts/regression-check.sh --offline
bash scripts/regression-check.sh --online
```

- offline: exit 0、`PASS=336 FAIL=0`
- online: exit 0、`PASS=337 FAIL=0`
- onlineの追加操作は公開GitHub情報の読み取りだけ。
- 実API、実Secret、実workflow dispatch、remote pushは0件。

最初の隔離master試行はsandboxのGit／loopback制限による環境失敗を検出した時点で中断した。必要なローカル実行権限だけで最初から再実行し、offline／onlineを完走した。途中の環境失敗を製品FAILや合格件数へ含めていない。

### 4. cleanup

- 独立fixture、独立検証script、隔離Git repoは削除済み。`TEMP_CLEANUP=PASS`。
- 評価で生成された未追跡Python cacheも削除済み。
- 最終process確認: `SPRINT025_PROCESS_COUNT=0`。
- 製品repoの実装、spec、state、contract、progress、Git、外部serviceは変更していない。
- 書き込みは本 `docs/feedback/sprint-025.md` のみ。

## Browser／screenshot

N/A。Sprint 025はversion／配布metadata、更新CLI、migration、rollbackの変更で、UI／responsive／視覚品質の変更を含まない。関連wizardの自動回帰はmasterで成功したが、今回の視覚品質の合格証拠として再利用していない。browser操作とscreenshotを新規実施しなかったため、C8は4/5とした。

## Generator一時worktree逸脱の扱い

Generator handoffには、最初の一時worktree作成時に追跡済みaudit fileを含めたため直ちに停止・削除し、そのfileを個別に開かず、外部送信、stage、commit、pushを行わなかったとの記録がある。以後は `docs/evidence` を除外し、必要なGit objectだけを使う方式へ変更されている。

これはGenerator工程上の逸脱として記録する。Evaluatorは同じ操作を再実行せず、禁止対象directoryを参照、列挙、コピー、materialize、stage、変更していない。現行製品の受入基準と安全回帰は独立fixtureおよび隔離masterで全件合格したため、今回の製品判定をFAILへ変更する実装不具合とは分類しない。

## 残課題

- Sprint 025の実装不具合: なし。
- 実Claude marketplace更新、実利用者workspace、実Secret、実workflow、remote pushは未実施。Sprint 025では安全な合成fixtureと公開情報読取だけを使用した。
- 今回の合格はSprint 025の完了判定であり、0.7.0全体の正式公開判定ではない。Sprint 026〜028のportable回帰、UX、正式live gateと後始末が残る。
- 評価用fixture、隔離repo、対象processの残存0件。

## Evaluator自己レビュー

- Generatorの自己評価をそのまま判定根拠にしたか: no。専用回帰を再実行し、別workspace／別負例の独立25件を作成した。
- 0.6.0診断を読取専用としてsnapshotで確認したか: yes。
- 同意前にplugin更新commandが起動しないことを確認したか: yes。
- dry-run、apply、post-verify、retry、version、台帳を確認したか: yes。
- customized／unknown-baselineの既定保持を確認したか: yes。独立fixtureでcustomizedを、専用回帰で対象外／台帳挙動を確認した。
- 記憶、一般PJ、Chatwork／Google Chat履歴をbyte単位で保護したか: yes。
- pluginとworkspaceを別々に復元し、0.6.0 version／scope／主要skillを確認したか: yes。
- 更新後の利用者commitをrollbackが上書きしないことを確認したか: yes。
- 部分復元を成功扱いせず、未解決項目と回復手順を確認したか: yes。
- validatorの正例、負例、`.git` なしarchiveを確認したか: yes。
- UI変更なしなのにbrowser／screenshotを実施済みと主張したか: no。N/A理由とC8減点を記録した。
- 実API、実Secret、実workflow dispatch、remote pushを実行したか: no。
- 明示禁止の `docs/evidence` 対象を参照、列挙、コピー、materialize、stage、変更したか: no。
- 一時fixture、cache、processを残したか: no。
- 実装、spec、state、contract、progress、Git、外部serviceを変更したか: no。書込みは本feedbackだけ。
- 実model／effortを設定値から推定してlaunch-verifiedと書いたか: no。host metadata非表示のためunverifiedとした。

# Sprint 030 評価（Retry 1）

- 判定: **PASS**
- failure kind: なし
- 評価対象: `sprint-030`
- 評価日: 2026-07-20（Asia/Tokyo）
- 外部状態を変える操作: **0件**

## 結論

Sprint 030 Retry 1は合格と判定する。前回のCriticalだった「EditionConfigの宣言値と実更新経路の分裂」は解消された。

製品fixtureとは異なるplugin ID、marketplace ID、ledger path、legacy ledger path、session directory、保護commit prefixを使った独立fixtureで、`start`、`retry-plugin`、`resume`、`rollback`がすべて宣言値だけを使うことを確認した。canonical schema 2 ledgerを更新・検証し、legacy pathへは新規書込みを行わない。canonical-onlyの同一edition、canonical＋legacy共存、不正schema、反対edition、矛盾した共存、ledger／session symlinkも検査し、安全停止時はworkspace、Git index、履歴、marker、ledger、session、外部sentinelがbyte単位で不変だった。

さらに6状態×4入口の独立matrix、既存0.6.0→0.7.0更新・rollback、master offline、`.git`なしarchive gate、Chatwork／Google Chatの実画面を確認した。全必須gateは0 FAILである。

## 前回Criticalの再検証

独立fixtureの設定値は次のとおり。製品既定値との偶然一致を避けた。

| 項目 | 独立値 |
|---|---|
| plugin ID | `indigo-helper@cobalt-store` |
| marketplace ID | `cobalt-catalog` |
| canonical ledger | `.matrix-ledger/v2.json` |
| legacy ledger | `.old-matrix/ledger.json` |
| session directory | `matrix-run-a7` |
| 保護commit prefix | `[matrix-safe-point]` |

結果は `INDEPENDENT_SPRINT030_PASS=23 INDEPENDENT_SPRINT030_FAIL=0`。

- `start`はGit directory配下の`matrix-run-a7`だけへsessionとbackupを保存した。
- 保護commitは`[matrix-safe-point]`を使った。
- plugin commandは`indigo-helper@cobalt-store`と`cobalt-catalog`を使った。
- canonical-only sessionから`retry-plugin`、`resume`、`rollback`が成功した。
- schema 2 `{ schemaVersion, edition, records }`をcanonical ledgerとして更新・検証した。
- `.old-matrix/ledger.json`は全経路でbyte不変だった。
- canonical＋legacyが同じeditionで有効な場合はcanonicalを正本として使い、legacyを変更しなかった。
- canonical不正schema、反対edition、canonical／legacy矛盾、ledger symlinkは全更新入口がexit 3で停止した。
- session directory symlinkは外部sentinelを変更せず停止した。
- 停止時にworkspace worktree、Git index、履歴、marker、ledger、session、外部参照先の変更は0件だった。

この結果から、前回Criticalは再現しない。`update-apply.mjs`はEditionConfigをguardだけで読み捨てず、実更新のdistribution ID、ledger、session、保護commit、rollbackまで一貫して使っている。

## 受入基準

| AC | 判定 | 根拠 |
|---|---|---|
| AC1 6状態がdomainと一致 | PASS | 独立6状態×4入口は58/58、製品専用edition guardは54/54。`new`、`same-edition`、`legacy-yasashii`、`opposite-edition`、`mixed`、`unknown`の許可／停止が一致した。 |
| AC2 危険3状態はbyte不変で停止 | PASS | `opposite-edition`、`mixed`、`unknown`はonboarding／diagnose／update／migrationで安全停止し、ファイル、Git、marker、ledger、sessionの変更0件。停止理由は検出状態と次の行動を示した。 |
| AC3 legacyは一意時だけ認識 | PASS | legacy単独だけを`legacy-yasashii`として扱い、canonical共存ではcanonicalを優先した。反対marker、矛盾、symlinkはlegacyとして取り込まず停止した。 |
| AC4 設定欠落・未知値でfallback禁止 | PASS | missing／unknown EditionConfigを拒否し、既定値へのfallback、marker作成、session作成、更新開始は0件。 |
| AC5 新規だけneutral marker／新bot、既存不変 | PASS | `new × onboarding`だけneutral markerを作成。新規workflowだけ`secretary[bot]`を使い、既存workflowのbot名・schedule・履歴はrenderer経由で保持した。 |
| AC6 既存更新、rollback、両wizard、全安全回帰 | PASS | Sprint 018 41/41、Sprint 025 25/25、master offline 430/430、archive 92/92。独立canonical-only start／retry／resume／rollbackも23/23。両wizardの実画面とresponsiveもPASS。 |

## Rubric採点

| 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 5/5 | 4 | PASS | AC1〜AC6を独立fixture、full gate、実画面で確認。未完の必須scopeなし。 |
| C2 構文・整合 | 5/5 | 5 | PASS | config／edition／更新入口の構文、schema 2 ledger、宣言値と実行値が一致。`git diff --check`を含む全gateが成功。 |
| C3 機能の実証 | 5/5 | 4 | PASS | 製品fixtureに依存しない23件と58件の敵対fixture、実コマンド、実Git repo、実Browser／CDPで確認。 |
| C4 非エンジニア体験 | 5/5 | 4 | PASS | wizardは「今すること」、保存先、見える人、履歴保持、停止後の行動を先に示し、詳細は閉じたdetailsへ分離。 |
| C5 安全・規律 | 5/5 | 5 | PASS | 危険状態、不正config、schema不正、symlinkで副作用前に停止。実Secret、外部API、Actions、push、plugin更新は0件。 |
| C6 無回帰 | 5/5 | 5 | PASS | Sprint 018、025、029、030、master offline、archiveがすべて0 FAIL。前回見逃したcanonical-only経路を独立fixtureで追加確認。 |
| C7 やさしさ | 5/5 | 4 | PASS | 通常文面は専門用語を必要箇所に限定し、初出補足と次の操作を維持。危険状態も黙って切替・削除しない。 |
| C8 wizard体験・デザイン | 5/5 | 4 | PASS | 両サービスでdesktop、390px、pageScale 2の200%を確認。横overflow 0、CTA 48px、details初期closed、完了CTAは1件。 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | Sprint 029 rule boundary 25/25、copy inventory 69/69、schema owner、wizard digestが成功。 |
| C10 更新の安全性 | 5/5 | 5 | PASS | EditionConfig駆動のstart／retry／resume／rollback、schema 2 ledger、保護commit、legacy非書込み、0.6.0／0.7.0復元を確認。 |
| C11 Google Chat境界 | 5/5 | 5 | PASS | master内のGoogle Chat／OAuth／session／callback安全回帰が0 FAIL。focused CDPは合成fixtureだけを使い、実OAuth／APIを呼ばなかった。 |
| C12 0.7.0配布準備 | 5/5 | 5 | PASS | marketplace／plugin／CHANGELOG 0.7.0、validator、master offline、`.git`なしarchiveがすべて成功。 |
| C13 edition分離・互換 | 5/5 | 5 | PASS | 反対設定値でも全更新経路がconfigに追従。legacy一意認識、canonical優先、危険共存停止、fallback禁止を独立確認。 |

合計 **65/65**。全基準が閾値を満たす。

## 実行証跡

### 1. 独立canonical-only更新fixture

```text
env TMPDIR=/private/tmp node /private/tmp/sprint030-independent-evaluator.mjs
INDEPENDENT_SPRINT030_PASS=23 INDEPENDENT_SPRINT030_FAIL=0
```

対象は`start`、`retry-plugin`、`resume`、`rollback`、schema 2 ledger、legacy非書込み、反対設定値、canonical／legacy共存、schema不正、反対edition、矛盾、ledger／session symlink、Git／外部sentinel不変。

### 2. 独立6状態×4入口matrix

```text
env TMPDIR=/private/tmp node /private/tmp/sprint030-independent-matrix.mjs
INDEPENDENT_MATRIX_PASS=58 INDEPENDENT_MATRIX_FAIL=0
```

6状態は`new`、`same-edition`、`legacy-yasashii`、`opposite-edition`、`mixed`、`unknown`。4入口は`onboarding`、`diagnose`、`update`、`migration`。`new × onboarding`以外の書込み禁止、dangerous stateの説明、legacy migration案内を独立に確認した。

### 3. Sprint／更新回帰

```text
env TMPDIR=/private/tmp node scripts/sprint-030-update-config-test.mjs
SPRINT030_UPDATE_CONFIG_PASS=10 SPRINT030_UPDATE_CONFIG_FAIL=0

env TMPDIR=/private/tmp bash scripts/sprint-030-regression.sh
edition guard 54/0
反対設定fixture 10/0
Sprint 029 rule boundary 25/0
copy inventory 69/0 INVENTORY=52
wrapper 7/0

env TMPDIR=/private/tmp bash scripts/sprint-018-regression.sh
SPRINT018_PASS=41 SPRINT018_FAIL=0

env TMPDIR=/private/tmp bash scripts/sprint-025-regression.sh
SPRINT025_PASS=25 SPRINT025_FAIL=0
```

### 4. 正式release gate

```text
env TMPDIR=/private/tmp bash scripts/master-release-gate.sh --mode offline --timeout-ms 600000
RELEASE_GATE mode=offline status=pass suites=6 required=6 passed=6 failed=0 skipped=0 assertions=430 pass=430 fail=0
```

最初のsandbox内実行ではlocalhost listenが`EPERM`となったため、製品FAILとは分離して中断した。同じgateをlocalhost fixtureが使える環境で最初から再実行し、上記のexit 0だけを正式証拠に採用した。

```text
test ! -e <archive-fixture>/.git
env TMPDIR=/private/tmp node scripts/master-release-gate.mjs --mode archive --root <archive-fixture>
RELEASE_GATE mode=archive status=pass suites=11 required=5 passed=5 failed=0 skipped=0 assertions=92 pass=92 fail=0
```

archive fixtureはcurrent worktreeを`.git`なしで`/private/tmp`へ複製した。0.7.0 metadata、validator、Sprint 030 edition guard、rule／copy／focus boundaryを含めて成功した。

## Browser／CDP実画面証跡

### Chatwork

Browser skillのChrome実ブラウザで次を操作した。

1. 接続情報の準備
2. GitHub登録確認
3. 参加ルーム取得
4. `営業チーム`だけを選択
5. `3時間ごと（おすすめ・初期値）`
6. 保存先・見える人・履歴保持を確認
7. 明示同意
8. 初回取得0件
9. `設定を終了する`だけの完了画面

結果画面は`営業チーム — 成功・0件`だけを表示し、未選択roomを混ぜなかった。確認／結果とも横overflow 0、CTA 48px、details初期closed。

GitHubの外向きlinkを開かずに全フローを実操作するため、`/private/tmp`の評価専用copyだけで次の1行を変更した。

```text
production: link.href = state.repository.secretUrl
temporary evaluator copy: link.href = "#"
```

製品ファイルは変更していない。productionの実URL生成とaccessible nameはSprint 013／014／020 Patch 001／029の静的・動的回帰で別に成功している。temporary copyは外向きnavigationだけを抑止し、以降の製品DOM、state、API、選択、同意、結果表示は同じ実装を使った。

focused CDPでresponsiveを追加確認した。

```text
CHATWORK_CDP_PASS=3 CHATWORK_CDP_FAIL=0 SCREENS=3
desktop: 1440px
mobile: 390px
200%: 720px + pageScaleFactor 2
```

3状態とも横overflow 0、CTA 48px、details初期closed、browser exception 0件。

### Google Chat

file chooserのネイティブUIには依存せず、既存合成desktop client JSONをCDPの`DOM.setFileInputFiles`で実file inputへ設定した。実OAuthは呼ばず、製品が提供するsynthetic接続経路だけを使った。

```text
GOOGLE_CDP_PASS=5 GOOGLE_CDP_FAIL=0 SCREENS=5
```

確認内容:

- desktop 1440px、mobile 390px、720px＋pageScale 2の200%。
- 全responsive状態で横overflow 0、CTA 48px、details初期closed。
- `空のスペース`だけを選び、3時間推奨を選択。
- reviewは読む対象、保存先、共同編集者にも見えること、履歴保持、read-onlyを表示。
- 3つの同意後、`configured=true`、`interval=3h`、`scheduleEnabled=true`、`automaticPushConsent=true`。
- 結果は`まだ保存するメッセージはありません`、`空のスペース — 成功・0件・0日分`、完了CTAは`設定を終了する`1件。
- browser exception 0件。

保存した主な証跡:

- `/Users/taisei/.codex/visualizations/2026/07/19/019f7bdd-35b3-7871-b89d-05e980661728/sprint-030-chatwork-review.png`
- `/Users/taisei/.codex/visualizations/2026/07/19/019f7bdd-35b3-7871-b89d-05e980661728/sprint-030-chatwork-result.png`
- `/Users/taisei/.codex/visualizations/2026/07/19/019f7bdd-35b3-7871-b89d-05e980661728/sprint-030-chatwork-focused/chatwork-responsive-evidence.json`
- `/Users/taisei/.codex/visualizations/2026/07/19/019f7bdd-35b3-7871-b89d-05e980661728/sprint-030-chatwork-focused/chatwork-mobile-390.png`
- `/Users/taisei/.codex/visualizations/2026/07/19/019f7bdd-35b3-7871-b89d-05e980661728/sprint-030-chatwork-focused/chatwork-zoom-200.png`
- `/Users/taisei/.codex/visualizations/2026/07/19/019f7bdd-35b3-7871-b89d-05e980661728/sprint-030-google-focused/google-focused-evidence.json`
- `/Users/taisei/.codex/visualizations/2026/07/19/019f7bdd-35b3-7871-b89d-05e980661728/sprint-030-google-focused/google-mobile-390.png`
- `/Users/taisei/.codex/visualizations/2026/07/19/019f7bdd-35b3-7871-b89d-05e980661728/sprint-030-google-focused/google-zoom-200.png`
- `/Users/taisei/.codex/visualizations/2026/07/19/019f7bdd-35b3-7871-b89d-05e980661728/sprint-030-google-focused/google-review.png`
- `/Users/taisei/.codex/visualizations/2026/07/19/019f7bdd-35b3-7871-b89d-05e980661728/sprint-030-google-focused/google-result.png`

既存の総合browser scriptは、前の中断fixture状態と現行cleanup状態の期待差で2回、約4秒で停止した。これは製品FAILへ数えず、状態を新規化したfocused CDPで必要画面を独立に再検証した。focused検査は両方exit 0である。

## Bugs

なし。前回Criticalは解消済みで、今回の独立再現では再発しなかった。

## 未検証／除外

安全境界により、次は実行していない。

- 実Chatwork API
- 実Google OAuth／Google Chat API
- 実Repository Secretの入力・登録・読取
- 実GitHub Actions dispatch
- external remote push／remote変更／repo作成／公開
- 実plugin install／update
- online release gate

これらは本Sprintのoffline合成fixtureによる受入範囲外であり、PASSへ読み替えていない。今回の必須ACとrubricはoffline gate、合成API、local bare remote、独立Git fixtureで満たした。

## External operations／cleanup

- 実Chatwork API: 0件
- 実Google OAuth／Google Chat API: 0件
- 実Secretの入力・登録・読取: 0件
- GitHub Actions dispatch: 0件
- external remote push／remote変更／repo作成／公開: 0件
- plugin install／update: 0件
- Browserで外部GitHub／Google URLを開いた回数: 0件
- 一時Git repo、archive fixture、browser copy、独立script、focused CDP script、Chrome profile、合成client file: 削除済み
- Chatwork／Google Chat fixture server、headless Chrome、master gate process: 停止済み
- Browser viewport: reset済み
- Browser tab／session: finalize済み
- `/private/tmp`の`eval030-*`、`sprint030-*`、`test-eval-log`: 残存0件
- repoへの書込み: 本feedbackのみ。実装、scripts、spec、state、contract、progress、Git indexは変更していない

## Evaluator自己レビュー

- Generatorの自己評価を判定根拠として再利用したか: no
- Current IDとSprint 030 Retry 1だけを評価したか: yes
- 前回Criticalを最初にcanonical-only／反対設定fixtureで再検証したか: yes
- 製品fixtureと異なるID、path、prefix、session directoryを使ったか: yes
- 6状態×4入口を独立に検査したか: yes
- canonical／legacy、schema不正、反対edition、矛盾、symlinkをbyte不変まで確認したか: yes
- 既存0.6.0／0.7.0更新・rollbackを再実行したか: yes
- master offlineと`.git`なしarchiveを完走したか: yes
- 両wizardをdesktop／390px／200%で実画面確認したか: yes
- temporary copyの差分とproduction実URL検査を分離したか: yes
- 危険な外部操作、実plugin update、実Secretを使ったか: no
- 実装または他roleの正本を変更したか: no
- temporary process／fixtureを残したか: no

## Orchestratorへの申し送り

Sprint 030は`done`へ進めてよい。前回Criticalは独立fixtureで解消確認済みであり、必須gateと全rubric閾値を満たす。

# Sprint 031 — neutral plugin pathと旧CHANGELOG互換

**ステータス:** Retry 1 実装完了・評価待ち

## 実装したこと

- プラグイン本体を `plugins/yasashii-secretary/` から `plugins/secretary/` へ移した。旧directoryには完全な `CHANGELOG.md` だけを残し、新旧2ファイルをbyte単位で一致させた。
- marketplace manifestの配布元を `./plugins/secretary` に変更し、plugin manifest、EditionConfig、スクリプト、回帰、README、公開guide、設計文書の現行参照をneutral pathへそろえた。
- 外部plugin IDはEditionConfigの `distribution.pluginId` / `distribution.marketplaceId` から読むまま維持した。内部path名を外部IDへ流用しない。
- 更新診断の既定URLをコードから除き、EditionConfigの `distribution.repository` / `distribution.changelogUrl` または明示fixtureからだけ決まるようにした。
- 旧0.7.0が参照する `plugins/yasashii-secretary/CHANGELOG.md` のraw URLをEditionConfigへ維持した。mock fetchで、そのURLから最新版、変更点、影響を最後まで診断できるfixtureを追加した。
- release integrity validatorへ、neutral source、旧directoryの1ファイル限定、新旧CHANGELOGのbyte一致、version entry一致を追加した。既存のname、version、source、author、MIT、単一credit、`forkedFrom`検査も維持した。
- 旧sourceを戻す、neutral sourceを壊す、CHANGELOGを不一致にする、旧directoryへ実装を複製する4つの負fixtureを追加した。
- checkoutと `.git` なしarchiveのmaster gateへSprint 031を登録し、archive側にも旧directory限定とbyte一致を追加した。
- Sprint 018の `git show d569fef:...` は0.2.0時点の履歴を読む固定入力なので、そこだけ当時の旧pathを維持した。

## 主な変更ファイル

- `.claude-plugin/marketplace.json`
- `plugins/secretary/**`
- `plugins/yasashii-secretary/CHANGELOG.md`
- `scripts/check-release-integrity.py`
- `scripts/check-distribution-channel.py`
- `scripts/archive-release-gate.mjs`
- `scripts/master-release-gate.mjs`
- `scripts/sprint-031-plugin-path-test.mjs`
- `scripts/sprint-031-regression.sh`
- `scripts/sprint-017-regression.sh`
- `scripts/sprint-018-regression.sh`
- `scripts/sprint-025-regression.sh`
- `scripts/sprint-026-release-gate-test.mjs`
- `scripts/fixtures/sprint-029/yasashii-copy-baseline.json`
- `README.md`
- `CLAUDE.md`
- `docs/DESIGN.md`
- `docs/guide/updates.md`

## 回帰結果

| コマンド | 結果 |
|---|---|
| `node scripts/sprint-031-plugin-path-test.mjs` | `SPRINT031_PATH_PASS=13 SPRINT031_PATH_FAIL=0` |
| `bash scripts/sprint-031-regression.sh` | `SPRINT031_PASS=6 SPRINT031_FAIL=0` |
| `bash scripts/sprint-030-regression.sh` | edition guard `54/0`、反対設定fixture `10/0`、wrapper `7/0` |
| `bash scripts/sprint-025-regression.sh` | `SPRINT025_PASS=25 SPRINT025_FAIL=0` |
| `bash scripts/sprint-018-regression.sh` | `SPRINT018_PASS=41 SPRINT018_FAIL=0` |
| `bash scripts/sprint-017-regression.sh` | `SPRINT017_PASS=33 SPRINT017_FAIL=0` |
| `node scripts/sprint-026-release-gate-test.mjs` | `SPRINT026_GATE_PASS=21 SPRINT026_GATE_FAIL=0` |
| `claude plugin validate .claude-plugin/marketplace.json` | PASS。requiredな `forkedFrom` がClaude validatorでは未知fieldというwarning 1件 |
| `claude plugin validate --strict plugins/secretary` | PASS |
| `TMPDIR=/private/tmp bash scripts/master-release-gate.sh --mode offline --timeout-ms 600000` | `RELEASE_GATE mode=offline status=pass`、7 suite、`436 PASS / 0 FAIL` |
| `.git`なしfixtureで `TMPDIR=/private/tmp node scripts/master-release-gate.mjs --mode archive --root <fixture> --timeout-ms 600000` | `RELEASE_GATE mode=archive status=pass`、6 required suite、`99 PASS / 0 FAIL` |
| `git diff --check` | PASS |

macOSでは通常の`TMPDIR`が `/var/folders` と `/private/var/folders` の別表記になるため、path guardを含むmaster gateは `TMPDIR=/private/tmp` を明示した。archive初回試行はこの表記差を安全に拒否したが、同条件へ直した正式再実行は99/0で通った。外部network、実API、remote、OAuth、Repository Secret、GitHub Actions、実plugin更新、公開操作は0件。

`claude plugin validate --strict .claude-plugin/marketplace.json` は、Sprint契約で必須の `forkedFrom` をClaude CLIが未知fieldとしてwarningにするため非0となる。`forkedFrom`を削除せず、通常の公式marketplace validation、strictなplugin本体validation、repository validatorの3つで補完した。

## 自己評価

| 観点 | 評価 | 根拠 |
|---|---:|---|
| 完成度 | 5/5 | neutral path移行、旧CHANGELOG互換、外部ID分離、旧URL診断、validator、負fixture、両gateまで実装した |
| 安定性 | 5/5 | 既存更新系回帰、checkout master、git-free archive masterが0 FAIL |
| 設計 | 5/5 | 内部path、外部plugin ID、公開CHANGELOG URLの役割をEditionConfigで分離した |
| 独自性 | 4/5 | 長期互換を1ファイルへ限定し、移行後の実装複製を自動検出する構成にした |
| エラー処理 | 5/5 | path欠落、不一致、旧source復活、実装重複、設定欠落を負fixtureで拒否する |
| 非回帰 | 5/5 | 旧0.7.0診断、更新rollback、edition guard、release metadataを重ねて検査した |

## 技術上の判断

- `plugins/secretary/` は内部の実装pathであり、利用者が指定する外部plugin IDではない。インストール／更新CLIは引き続きEditionConfigの `yasashii-secretary@yasashii-secretary` を使う。
- 旧pathのraw URLは既存0.7.0からの直接更新に必要なので変更しない。ただし旧directoryへ実装は残さず、完全なCHANGELOG 1ファイルだけに制限する。
- CHANGELOGは内容比較ではなくbyte比較にした。改行や空白だけがずれても、旧クライアントと新クライアントの見える更新情報が分岐しないため。
- 公式Claude validatorとrepository validatorは役割が異なる。前者はClaudeが読む構造、後者は本product固有の長期互換、credit、EditionConfig整合を検査する。

## 起動方法・テストURL

Sprint 031は配布pathと診断境界の変更であり、新しい常設serverや画面はない。固有のテストURLはN/A。

既存wizardの非回帰を目視する場合は、次の合成fixtureを使える。

- Chatwork: `bash scripts/start-sprint-014-wizard-fixture.sh 18784` → `http://127.0.0.1:18784/`
- Google Chat初回: `node scripts/start-sprint-020-patch-001-google-chat-fixture.mjs 18783` → `http://127.0.0.1:18783/`
- Google Chat設定変更: `node scripts/start-sprint-020-wizard-fixture.mjs 18782` → `http://127.0.0.1:18782/`

## Evaluatorへの確認事項

1. `TMPDIR=/private/tmp bash scripts/sprint-031-regression.sh` を実行し、neutral path、旧directory 1ファイル、新旧byte一致、外部ID分離、旧URLfixture、4つの負fixtureが0 FAILであること。
2. `claude plugin validate .claude-plugin/marketplace.json` と `claude plugin validate --strict plugins/secretary` が通り、repository validatorがMIT、author、単一credit、`forkedFrom`、name、source、versionを通すこと。
3. 旧0.7.0形式のworkspace fixtureでdiagnoseを行い、最新版、変更点、影響が欠けず、workspace／Git／plugin／ledger／sessionの副作用が0件であること。
4. checkoutのoffline masterと `.git` なしarchive masterを `TMPDIR=/private/tmp` で再実行し、0 FAILを確認すること。
5. 実Claude local pluginまたは同等のisolated環境で `plugins/secretary/` を読み、`/secretary` → update diagnoseが動作すること。既存wizardをdesktop、390px mobile、200%相当で確認し、スクリーンショットを証跡へ残すこと。
6. `rg -n "plugins/yasashii-secretary" .claude-plugin plugins scripts README.md CLAUDE.md docs/DESIGN.md docs/guide` を確認し、残る参照が旧CHANGELOG互換、旧URL、移行validator、またはSprint 018の履歴固定入力だけであること。

## 対象外・既知事項

- UI copy、DOM、OAuth scope、Chatwork／Google Chatの動作仕様は変更していない。Generatorではブラウザ証跡を再取得しておらず、実画面とスクリーンショットはEvaluatorへ引き渡す。
- `--online` release gateと旧raw URLへの実network接続は実行していない。旧URLの読取はmock fetchで検査した。
- 実Chatwork／Google API、実Google OAuth、Repository Secret、GitHub Actions dispatch、remote push、実plugin install/updateは実行していない。
- `docs/spec/constraints.md` section 7には旧pathを正本とする過去文が残るが、より新しいsection 15、`docs/spec/editions.md`、Sprint 031契約がneutral pathを指定する。Planner所有fileのためGeneratorは変更していない。
- Planner／Orchestrator／Evaluator所有のspec、Sprint契約、`docs/sprints/state.md`、`docs/feedback`は変更していない。
- git add、commit、pushは0件。
- runtime targetはstate上strong tierだが、子host metadataで実起動model／effortを確認できないためlaunchは `unverified`。

## Retry 1 — Google Chat接続用JSONの操作領域

Evaluator feedbackの1件だけを修正した。Google Chat初期画面の可視 `input[type="file"]` 自身へ48pxの実操作領域とvisible focusを設定し、不可視overlay、透明label、pointer-onlyの代替操作は追加していない。

### 修正内容

- 共通wizard CSSの `#client-json` に `width: 100%`、`min-height: 48px`、padding、border、pointer cursorを設定した。`:focus-visible` は既存UIと同じ3px outlineを表示する。
- HTML／DOM、画面copy、`app.js`、file selection処理、Google OAuth scopeは変更していない。移行前HEADとの比較でも、wizard CSS差分は上記2 ruleだけであり、Google Chat `app.js` と `oauth-session.mjs` のSHA-256は移行前HEADと一致した。
- `scripts/sprint-031-google-chat-file-input-browser.mjs` を正式なCDP回帰として追加した。表示中かつ有効なcontrolだけを測り、実file inputの高さ、中心hit target、AX accessible name、Tab focus、visible outline、synthetic JSON選択、次buttonの有効化、detailsのkeyboard開閉、横overflow、`console.error`／runtime exceptionをdesktop／390px／200%で検査する。
- Sprint 029のwizard asset保護baselineを新しいCSS hashへ更新し、`scripts/sprint-031-regression.sh` に専用browser scriptの構文検査を追加した。

### 専用browser実測

| 条件 | file input | 幅 | focus | file selection | overflow | console/runtime error |
|---|---:|---:|---|---|---:|---:|
| desktop 1440×900 | 48px | 896px | Tab focus＋3px outline | 1 file、次button有効 | 0 | 0 |
| mobile 390×844 | 48px | 310px | Tab focus＋3px outline | 1 file、次button有効 | 0 | 0 |
| 200%相当 640×800 | 48px | 545px | Tab focus＋3px outline | 1 file、次button有効 | 0 | 0 |

全条件でaccessible nameは「Google Cloudから取得した接続用ファイル」、`opacity: 1`、`pointer-events: auto`、file input中央の `elementFromPoint` はinput自身だった。H1からTabでfile inputへ移り、file選択後はTab→summary→Enterでdetailsを開けた。

実行手順:

1. `node scripts/start-sprint-020-patch-001-google-chat-fixture.mjs 28783`
2. 一時profileのChromeをCDP有効で起動する。
3. `node scripts/sprint-031-google-chat-file-input-browser.mjs --cdp http://127.0.0.1:29331 --google-url http://127.0.0.1:28783/ --test-client <手順1が表示したTEST ONLY JSON path>`

結果: `SPRINT031_FILE_INPUT_BROWSER_PASS=3 SPRINT031_FILE_INPUT_BROWSER_FAIL=0`

### Retry 1 回帰結果

| コマンド | 結果 |
|---|---|
| `TMPDIR=/private/tmp bash scripts/sprint-031-regression.sh` | `SPRINT031_PASS=7 SPRINT031_FAIL=0`、path専用 `13/0` |
| `TMPDIR=/private/tmp bash scripts/master-release-gate.sh --mode offline --timeout-ms 600000` | `RELEASE_GATE mode=offline status=pass`、7 suite、`437/0` |
| `.git`なしcurrent worktree copyでarchive master | `RELEASE_GATE mode=archive status=pass`、required 6 suite、`101/0` |
| `claude plugin validate .claude-plugin/marketplace.json` | PASS。既知の `forkedFrom` unknown field warning 1件 |
| `claude plugin validate --strict plugins/secretary` | PASS |
| `python3 scripts/check-release-integrity.py --root .` | PASS |
| `git diff --check` | PASS |

master内でChatwork接続／運用、Google Chat接続／OAuth read-only 3 scope／運用、wizard copy／DOM、Sprint 029 digest、neutral path、旧CHANGELOG byte一致、validatorを0 FAILで再確認した。

### Retry 1 自己評価

| 観点 | 評価 | 根拠 |
|---|---:|---|
| 完成度 | 5/5 | feedbackの44px欠陥を実input自身の48px操作領域で修正し、3表示条件を実測した |
| 安定性 | 5/5 | file選択、focus、keyboard、overflow、consoleを専用CDP回帰で保護した |
| 設計 | 5/5 | DOMやcopyを増やさず、既存native file controlへ直接適用した |
| 独自性 | 4/5 | AX treeと中心hit targetまで専用回帰で確認した |
| エラー処理 | 5/5 | disabled controlを計測対象から除外し、実console/runtime errorを別検査した |
| 非回帰 | 5/5 | master `437/0`、archive `101/0`、validator、OAuth scope、Chatworkを維持した |

### Retry 1 対象外・安全境界

- 実Chatwork／Google API、実OAuth、Repository Secret、GitHub Actions、remote、commit、push、install、update、公開は0件。
- `docs/spec*`、`docs/sprints/state.md`、Sprint契約、`docs/feedback/sprint-031.md`はRetry 1では変更していない。
- 追加したfixtureはsyntheticかつTEST ONLYで、外部Google／GitHubへ接続していない。

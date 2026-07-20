# Sprint 031 Retry 1 評価

- 判定: **PASS**
- 評価対象: `sprint-031`
- 評価日: 2026-07-20（Asia/Tokyo）
- Escalation Recommendation: **none**
- 外部状態を変える操作: **0件**

## 結論

前回の不合格原因だったGoogle Chat接続用file inputは、desktop、390px、200%相当の3条件すべてで、可視かつ有効な `input[type="file"]` 自身が **48px** になった。中心hit targetもinput自身で、透明overlayやpointer-onlyの代替操作ではない。AX name、Tab focus、3pxの `:focus-visible`、実synthetic JSON選択、次buttonの有効化、detailsのkeyboard開閉、横overflow、page console／runtime errorも独立CDPで3/3合格した。

配布path、旧CHANGELOGのbyte一致、旧0.7.0診断、独立負例、validator、checkout master、`.git`なしarchiveもすべて0 FAILだった。前回の27px Criticalは解消され、AC1〜AC6とRubric全閾値を満たすためSprint 031 Retry 1を合格とする。

## 前回Criticalの独立再評価

### Browser実測

Generatorとは別のlocal port、Browser sessionで `http://127.0.0.1:31783/` を開き、full-page screenshotを3条件で取得・目視した。

| 条件 | input自身の高さ | 幅 | center hit | focus | overflow |
|---|---:|---:|---|---|---:|
| desktop `1440×900` | 48px | 896px | input自身 | Tab、3px solid outline | 0 |
| mobile `390×844` | 48px | 295px | input自身 | Tab、3px solid outline | 0 |
| 200%相当 `640×800` | 48px | 545px | input自身 | Tab、3px solid outline | 0 |

全条件で `opacity: 1`、`pointer-events: auto`、`visibility: visible`、`disabled: false`、label textは「Google Cloudから取得した接続用ファイル」だった。BrowserのOS file chooser操作はhost側で120秒を超えて停止したため中断し、その結果を証拠から除外した。Browser sessionはその時点でfinalizeした。

### 専用CDPの正式結果

別一時profileのheadless Chromeを `127.0.0.1:32331` で起動し、repo付属の専用scriptを1回だけ実行した。

```text
node scripts/sprint-031-google-chat-file-input-browser.mjs \
  --cdp http://127.0.0.1:32331 \
  --google-url http://127.0.0.1:31783/ \
  --test-client <TEST_ONLY_SYNTHETIC_DESKTOP_CLIENT.json>

exit 0
SPRINT031_FILE_INPUT_BROWSER_PASS=3 SPRINT031_FILE_INPUT_BROWSER_FAIL=0
```

独立観測値:

- desktop／mobile／200%の高さ: 48px／48px／48px
- 幅: 896px／310px／545px
- AX accessible name: 全条件「Google Cloudから取得した接続用ファイル」
- 初期focus: H1。Tab後のactive element: `#client-json`
- `:focus-visible`: true、outline: `solid 3px`
- input自身: visible enabled、center hit自身、`opacity: 1`、`pointer-events: auto`
- 実file selection: 全条件で `fileCount=1`、synthetic JSON名一致、次buttonがdisabledからenabledへ変化
- keyboard: file inputからTabでsummaryへ移り、Enterでdetailsがopen
- 横overflow: 0、page `console.error`: 0、runtime exception: 0

headless Chrome processのstderrにはChrome自身のGCM `DEPRECATED_ENDPOINT` warningが出たが、製品pageのconsole／runtime errorではなく、製品から外部APIを呼んだ証拠でもない。正式CDP reportの `browserErrors` は空だった。

## 受入基準

| AC | 判定 | 根拠 |
|---|---|---|
| AC1 plugin本体は新pathの1系統 | PASS | marketplace sourceは `./plugins/secretary`。旧pathの実fileは `CHANGELOG.md` 1件だけ。repo validatorと独立負例が旧source復元・旧path実装重複を拒否した。 |
| AC2 旧CHANGELOGが完全内容・byte一致 | PASS | `cmp` exit 0。独立に末尾へ1 byte相当の空白を加えるとvalidatorがbyte mismatchでexit 1。 |
| AC3 旧0.7.0 diagnose互換 | PASS | legacy markerだけの独立workspaceで `currentVersion=latestVersion=0.7.0`、`status=same`、`workspaceEdition=legacy-yasashii`、変更点・影響あり、全side effect 0、前後SHA-256一致。 |
| AC4 回帰・release scriptが新pathで動き、破損を検出 | PASS | Sprint 031専用path 13/13、wrapper 7/7。独立負例4/4も非0終了で拒否。 |
| AC5 checkoutと`.git`なしarchiveでmaster gate 0 FAIL | PASS | checkout offline 437/437、current worktreeの`.git`なし複製でarchive 101/101。 |
| AC6 validator、MIT、author、credit、manifest整合 | PASS | Claude marketplace validator PASS（既知warning 1件）、plugin strict PASS、repo validator PASS。`forkedFrom`は変更していない。 |

## Rubric採点

| 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 5/5 | 4 | PASS | AC1〜AC6と前回Criticalの修正をすべて実証。 |
| C2 構文・整合 | 5/5 | 5 | PASS | manifest、source、version、外部ID、CHANGELOG、validatorが整合。 |
| C3 機能の実証 | 4/5 | 4 | PASS | running UI、実file input、path、diagnose、負例、checkout、archiveを実行。実Claude local commandは未検証。 |
| C4 非エンジニア体験 | 4/5 | 4 | PASS | 3表示条件で初期画面の説明、操作、focus、横切れなしを確認。 |
| C5 安全・規律 | 5/5 | 5 | PASS | 実API、OAuth、Secret、Actions、remote、install、update、公開0件。diagnose副作用0。 |
| C6 無回帰 | 5/5 | 5 | PASS | master offline 437/437、archive 101/101、専用・独立負例が0 FAIL。 |
| C7 やさしさ | 4/5 | 4 | PASS | 「今すること」、安全な扱い、次の操作が初期画面だけで理解できる。 |
| C8 wizard体験・デザイン | 5/5 | 4 | PASS | 実input自身48px、center hit、AX、keyboard、focus、file selection、details、overflow、screenshotが3条件で合格。 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | plugin本体はneutral path、外部IDとlegacy URLはEditionConfig側に分離。 |
| C10 更新の安全性 | 5/5 | 5 | PASS | 旧0.7.0診断はread-onlyで、全side effect 0、前後digest一致。 |
| C11 Google Chat境界 | 5/5 | 5 | PASS | master内のOAuth read-only 3 scope、SPACE限定、secret非露出、接続・運用回帰が全PASS。今回のCDPはsynthetic fileだけで外部接続0。 |
| C12 0.7.0配布準備 | 5/5 | 5 | PASS | 前回の44px欠陥を解消し、master、archive、validator、cleanupがすべて成立。 |
| C13 edition分離・互換 | 5/5 | 5 | PASS | neutral path、legacy CHANGELOG、旧diagnose、外部ID分離、反対path負例が成立。 |

合計 **62/65**。全基準が閾値以上。

## path・CHANGELOG・独立負例

```text
TMPDIR=/private/tmp bash scripts/sprint-031-regression.sh
SPRINT031_PATH_PASS=13 SPRINT031_PATH_FAIL=0
SPRINT031_PASS=7 SPRINT031_FAIL=0
```

Generatorの負fixtureを判定根拠にせず、current worktreeを別一時directoryへ複製し、Evaluatorが4件を個別に破損した。

| 独立負例 | validatorの観測結果 |
|---|---|
| marketplace sourceを旧pathへ変更 | exit 1 `marketplace plugin source is missing or invalid` |
| `plugins/secretary/` を一時的に欠落 | exit 1 `release surface unreadable` |
| legacy CHANGELOG末尾へ1 byte相当の空白追加 | exit 1 `differs byte-for-byte` |
| 旧pathへ `skills/secretary/SKILL.md` を複製 | exit 1 `legacy plugin path must contain only CHANGELOG.md` |

baseline validatorは同じ一時copyで先にPASSした。負例copyはcleanup済み。

現行参照の `plugins/yasashii-secretary` は、旧CHANGELOG URL／長期互換検査／負fixture／Sprint 018の履歴固定入力だけだった。旧pathの実fileは `plugins/yasashii-secretary/CHANGELOG.md` 1件で、canonicalとの `cmp` はexit 0。

## 旧0.7.0診断

```text
node plugins/secretary/scripts/update-diagnose.mjs \
  --plugin-root plugins/secretary \
  --workspace <legacy-workspace> \
  --latest-manifest <copied-marketplace.json> \
  --changelog plugins/yasashii-secretary/CHANGELOG.md \
  --choice check-only --json
```

観測結果:

- `mode=diagnosis-read-only`
- `currentVersion=latestVersion=0.7.0`
- `status=same`
- `workspaceEdition.state=legacy-yasashii`
- 「変わること」2件、「設定・ファイルへの影響」2件
- `pluginUpdate`、`workspaceWrite`、`migration`、`commit`、`push`、`settingsChange`、`reloadOrRestart`: 全0
- fixtureの唯一のtracked相当file SHA-256: 前後とも `1f7564efad07f057d216b49449d304ee22dfbca54c181061a74934eef3ddcc4b`

## validator

```text
claude plugin validate .claude-plugin/marketplace.json
PASS with warning: plugins[0].forkedFrom is an unknown field and ignored at load time

claude plugin validate --strict plugins/secretary
PASS

python3 scripts/check-release-integrity.py --root .
PASS release integrity: manifests and CHANGELOG are consistent

git diff --check
PASS
```

`forkedFrom` warningはSprint契約のNon-scopeと整合する。validatorは変更を要求せずPASSしているため、値を推測変更しなかったことを合格とする。

## master／archive

```text
TMPDIR=/private/tmp bash scripts/master-release-gate.sh --mode offline --timeout-ms 600000
RELEASE_GATE mode=offline status=pass suites=7 required=7 passed=7 failed=0 skipped=0 assertions=437 pass=437 fail=0
```

master内でSprint 015、020 Patch 002、027、029、030、031と全回帰339/339を実行した。Chatwork接続35/35、UI／構文33/33、運用41/41、共通copy 69/69、結果7/7、Google Chat接続51/51、運用50/50、OAuth／session境界、edition guard、neutral pathが0 FAILだった。

current worktreeをEvaluator所有の一時directoryへ複製し、`.git`が存在しないことを `test ! -e` で確認してから実行した。

```text
TMPDIR=/private/tmp node scripts/master-release-gate.mjs \
  --mode archive --root <git-free-current-worktree-copy> --timeout-ms 600000

ARCHIVE_RELEASE_PASS=10 ARCHIVE_RELEASE_FAIL=0
RELEASE_GATE mode=archive status=pass suites=12 required=6 passed=6 failed=0 skipped=0 assertions=101 pass=101 fail=0
```

## Browser／Chatwork補足

Google Chat初期画面はBrowser screenshot 3枚と専用CDP 3/3で合格した。

既存 `sprint-027-browser-check.mjs` を同じCDP Chromeで追加実行したが、起動したChatwork fixtureがscript想定のroom選択済み状態ではなく、`#room-search` 待機でtimeoutした。その後の最小Chatwork CDPも同じfixture状態不一致で `prepare-connection` を確認できなかった。この2件は正式証拠から除外し、製品PASSへ読み替えていない。

Chatworkは今回のRetryでDOM／app.jsを変更対象にしておらず、正式master内の接続、運用、copy、session、secret非入力の動的回帰がすべてPASSしたため非回帰と判断した。ただし、Retry 1でのChatwork running screenshot再取得は **未検証** として残す。

## 未検証／除外

- 実Claudeセッションでのlocal plugin command／skill launch: 実行せず **unverified**
- Retry 1でのChatwork running screenshot再取得: fixture状態不一致で **unverified**
- 実Chatwork API、実Google OAuth／Google Chat API
- Repository Secretの実入力・登録・読取
- GitHub Actions dispatch、online gate、remote raw URLのlive read
- external remote変更／push／repo作成／公開
- 実plugin install／update

これらを成功扱いしていない。Sprint 032以降のlive範囲も先取りしていない。

## External operations／cleanup

- 製品からの実Chatwork／Google API: 0件
- 実OAuth、Secret、Actions dispatch: 0件
- external remote変更、push、repo作成、公開: 0件
- plugin install／update: 0件
- 外部URLへの製品browser navigation: 0件
- Git stage／commit: 0件
- Browser session: finalize済み
- Google Chat fixture、Chatwork fixture、headless Chrome: 停止済み
- ports `31783`、`32784`、`32331`: LISTEN 0件
- CDP profile、synthetic JSON、独立負例copy、legacy diagnose workspace、git-free archive copy、追加browser script、screenshot temp: 削除済み
- repoへのEvaluator書込み: 本feedbackのみ

## Evaluator自己レビュー

- 前回27pxをGenerator結果から独立して再測定したか: yes
- visible enabledなfile input自身を測ったか: yes
- center hit、opacity、pointer、AX、Tab、focus-visible、実file selection、details keyboard、overflow、consoleを確認したか: yes
- Browser停止操作をPASSへ読み替えていないか: yes
- Chatwork fixture mismatchをPASSへ読み替えていないか: yes
- path／CHANGELOG負例をGenerator fixtureなしで作ったか: yes
- 旧diagnoseの前後不変を確認したか: yes
- checkout masterとgit-free archiveを完走したか: yes
- 未検証項目をPASS扱いしていないか: yes
- 実装、spec、state、contract、progress、scriptsを変更していないか: yes
- 閾値と合否は一致しているか: yes

## Orchestratorへの申し送り

Sprint 031 Retry 1は合格。`docs/sprints/state.md` の遷移はOrchestratorが行う。次のSprint 032では、契約どおり実0.7.0旧URLからのdiagnose／直接update／plugin・workspace rollbackを、明示許可されたlive gateだけで評価する。

# Sprint 035 Patch 001 評価結果

**判定:** 合格
**評価対象:** Sprint 035 Patch 001 — 共通チャットwizardの下流同期とIME安全な検索
**Yasashii candidate:** `44066b9b4b834c4b5bfa24fa59fb08ebd2719b68`
**固定Agentic candidate:** `1cf2ae690a39ef822d204624d53ee183b386f715`
**Escalation Recommendation:** none

## 結論

受入基準1〜10をすべて満たしたため、Sprint 035 Patch 001を **PASS** と判定する。

固定したAgentic candidateからのoverlayは、managed 229 path、未分類0件、upstream-only漏出0件、
missing downstream 0件だった。隔離cloneで `--check`、`--apply`、`--reapply` を順に実行し、
`changed=0`、`secondChanged=0`、共有wizard 3 assetのbyte一致を確認した。

ChatworkとGoogle Chatをdesktop、390px mobile、200%相当の6条件でheadless Chromeから実DOM操作した。
各条件でcheckbox 2件を実際に解除して再選択した後、日本語IMEの
`compositionstart → 複数input → compositionend → 同値input` を発火した。
composition中は結果DOM mutation 0件、画面全体mutation 0件、確定後は結果DOM mutation 1件、
同値input後の追加mutation 0件だった。入力node、focus、caret、入力値を保持し、確定後だけ一覧を更新した。

英数字、Backspace、途中挿入、途中削除、全削除でも入力値、caret、表示結果IDが一致した。
選択IDは検索で一時非表示になった後、全件再表示、次へ／戻るを経ても同じ2件を保持した。
6条件で横overflow、操作不能、未処理例外、製品console errorは0件だった。

Yasashii固有の会話copy、identity、manifest／marketplace、README、`key=value` 表現改善、
repo-owned docsはoverlay適用前後の独立digestが一致した。OAuth／session／Secret／SPACE限定／cancelと、
Yasashii会話／host-neutral回帰も0 FAILだった。

実Chatwork API、Google OAuth／API、Repository Secret、GitHub Actions、upstream／origin remote write、
releaseは契約どおりすべて `not-run` である。local／synthetic成功をlive接続成功へ読み替えていない。

## スコア

本Patchは `Type: regular patch` のため全rubricを確認した。Patch外の面は、実差分、byte／digest不変、
引き渡し回帰、専用安全回帰で開始時点の契約を維持したことを採点した。

| ID | 基準 | スコア | 閾値 | 判定 | 主な根拠 |
|---|---|---:|---:|---|---|
| C1 | 完成度 | 5/5 | 4 | PASS | 受入基準1〜10をすべて確認 |
| C2 | 構文・整合 | 5/5 | 5 | PASS | 3 asset構文、固定candidate、inventory、digest一致 |
| C3 | 機能の実証 | 5/5 | 4 | PASS | 6条件の実DOM、IME、結果ID、選択IDを記録 |
| C4 | 非エンジニア体験 | 5/5 | 4 | PASS | 検索、選択、戻る／進むを全条件で完走 |
| C5 | 安全・規律 | 5/5 | 5 | PASS | session／OAuth 21/21、Secret安全71/71、外部write 0 |
| C6 | 無回帰 | 5/5 | 5 | PASS | Patch統合11/11、既存wizard、overlay、会話が0 FAIL |
| C7 | やさしさ | 5/5 | 4 | PASS | Yasashii copy／style digest不変、1画面1判断を維持 |
| C8 | wizard体験・デザイン | 5/5 | 4 | PASS | screenshot 6枚、overflow 0、操作高44px以上、Tab移動成立 |
| C9 | 配布チャネル非依存 | 5/5 | 5 | PASS | README／配布copy不変、Yasashii identityを維持 |
| C10 | 更新の安全性 | 5/5 | 5 | PASS | 更新／migration path変更0、差分は共有検索面に限定 |
| C11 | Google Chat境界 | 5/5 | 5 | PASS | read-only scope、SPACE限定、DM拒否、cleanup負例が合格 |
| C12 | 0.8.0配布準備 | 5/5 | 5 | PASS | version／manifest／marketplace不変、archive対象bytesの境界を維持 |
| C13 | edition分離・互換 | 5/5 | 5 | PASS | overlay managed 229、未分類0、Yasashii固有面不変 |
| C14 | 会話のMarkdown可読性 | 5/5 | 5 | PASS | Yasashii 28/28、host-neutral 32/32、edition差を維持 |
| C15 | 正式ホスト配布面 | 5/5 | 5 | PASS | Claude／Codex manifest・marketplace byte不変、host-neutral回帰0 FAIL |

## 証跡

### 1. fixed upstream／overlay

隔離対象:

- Yasashii: `/private/tmp/yasashii-s035p001-eval.fvDjQO/downstream` を `44066b9` にdetach
- Agentic: `/private/tmp/yasashii-s035p001-eval.fvDjQO/upstream` を `1cf2ae6` にdetach

実行command:

```bash
node scripts/sync-secretary-overlay.mjs --check \
  --candidate /private/tmp/yasashii-s035p001-eval.fvDjQO/upstream
node scripts/sync-secretary-overlay.mjs --apply \
  --candidate /private/tmp/yasashii-s035p001-eval.fvDjQO/upstream
node scripts/sync-secretary-overlay.mjs --reapply \
  --candidate /private/tmp/yasashii-s035p001-eval.fvDjQO/upstream
```

結果:

```text
OVERLAY_CHECK_PASS base=1cf2ae690a39ef822d204624d53ee183b386f715 managed=229
OVERLAY_APPLY_PASS base=1cf2ae690a39ef822d204624d53ee183b386f715 changed=0 managed=229
OVERLAY_REAPPLY_PASS secondChanged=0
fixedUpstream=1cf2ae690a39ef822d204624d53ee183b386f715
managed=229
unclassified=0
upstreamOnlyLeak=0
missingDownstream=0
```

共有wizard assetは `cmp -s` でもAgentic candidateと一致した。

| path | SHA-256 |
|---|---|
| `plugins/secretary/skills/chatwork/assets/wizard/common.js` | `486479597dd497ffce85a41005ec4f6173c5da2ffaa51fa2df128fd83b762908` |
| `plugins/secretary/skills/chatwork/assets/wizard/app.js` | `e8e31880b67953b0acdb364c74d18728938867c42c69a43b725874b4d5b83d3e` |
| `plugins/secretary/skills/google-chat/assets/wizard/app.js` | `c8d71dac2faca9caad5eaa63b7d63370bc6f368f7bf3dcf7cb5a86c84b2a185f` |

### 2. Yasashii固有surface／repo-owned docs不変

overlay適用前後で次が一致した。

- Yasashii固有surface 10 filesの合成digest: `1f1a4e77b5a46d6231fc712243230e6a9edae23ae14f9cb354b02dafd25840b5`
- tracked repo-owned docs 360 filesの合成digest: `238b92c3df9b6767dd521640536c7231578cc6348f8bc200a26737a8ebeb27d5`
- overlay script自身のrepo-owned digest: `e9433f6a6852b50af82ec722e2310e0f8d0d52494298951155a345c23a5412e6`

主要surface:

| surface | SHA-256 |
|---|---|
| `README.md` | `8f700f487e5050af71f1ec534c1490e6f55bfba195e7d1b64d3422e22a17de74` |
| `plugins/secretary/rules/copy/yasashii.json` | `628142e5e46d26440f72c8ae04aaa5a2c728a459be8e328bd8a30bad8bc2f909` |
| `plugins/secretary/rules/styles/yasashii.md` | `b19b324e1a804a39b25091bdf91d16f3cb0729885be019c2ab574de1219da792` |
| `plugins/secretary/rules/plain-language.md` | `d4c74037a8ec1cafd7a1d11ad9c5f8d3b0f9d6675628b763382fd6128e5463b7` |
| `plugins/secretary/edition.json` | `2ec4b3c72cf03170642efc52d00ae0ab4ba7874b73087b6bb444d04522bf9271` |
| `.claude-plugin/marketplace.json` | `959855c3cc3f61705913937d86c780b41fd6b04683efe9dc428706384daae7db` |
| `.agents/plugins/marketplace.json` | `7494527ed68e9340c51bcd2c94a66ed08a341b3d7b92f2c51010e31c28ffac94` |
| `plugins/secretary/.claude-plugin/plugin.json` | `670604e4eab9f01f775bd2e774a09710d49291f799aeecd4b7ad17a0b858907d` |
| `plugins/secretary/.codex-plugin/plugin.json` | `47dae70a86bc8d65ca1899dd4df8987f435dd6009ce9aa76e02150249844c6c3` |
| `plugins/secretary/skills/settings/SKILL.md` | `11e4c76b9e2e6ac5cbec7c2f8742eeb7c94e7b8cf9d02567ede9ceac2fda8117` |

`settings/SKILL.md` は `<変更項目>=<値>` と `設定を変更: <変更項目>=<値>` を含まず、
「変更する項目」「内部の正式key」「値は表示しません」と `言葉遣い.報告の詳しさ` の表形式を維持した。

対象repoで開始前から存在したPlanner／Orchestrator差分も保持した。評価終了前のdigestは次のとおり。

- `docs/spec.md`: `10b9047c59582ebacec8c510f2abf6127701b7c85acf572b7dc80720d3261303`
- `docs/spec/editions.md`: `5736d93269f1ecd118866c2badfc49525a3d2ce7be9d53ac678d5cf39a195140`
- `docs/spec/ui.md`: `5c130a7f32b860b128c02b9cced4db8399df0b1f9fccca4f5d31a580fce5b5e8`
- `docs/sprints/state.md`: `654a3ff61989ca7b99d7faa0b254d7f146af270e6b9dc57dd1b26fb20b03201e`
- `docs/sprints/sprint-035-patch-001.md`: `7cbf25b952d1ac6656a98a08de4d2d49859e37c0e26abec961fad77245128518`

### 3. 統合・安全・会話回帰

引き渡しbaseline:

```bash
TMPDIR=/private/tmp \
AGENTIC_SECRETARY_CANDIDATE=/private/tmp/yasashii-s035p001-eval.fvDjQO/upstream \
bash scripts/sprint-035-patch-001-regression.sh
```

loopback許可面での最終結果:

```text
SPRINT035_PATCH001_IME_PASS=29 SPRINT035_PATCH001_IME_FAIL=0
PASS=35 FAIL=0                         # Chatwork実動作
PASS=33 FAIL=0                         # Chatwork wrapper
SPRINT019_WRAPPER_PASS=12 SPRINT019_WRAPPER_FAIL=0
SPRINT034_PASS=11 SPRINT034_FAIL=0
SPRINT032_PATCH002_REGRESSION_PASS=8 SPRINT032_PATCH002_REGRESSION_FAIL=0
SPRINT035_PATCH001_REGRESSION_PASS=11 SPRINT035_PATCH001_REGRESSION_FAIL=0
REGRESSION_EXIT=0
```

追加の独立回帰:

```bash
TMPDIR=/private/tmp node scripts/sprint-023-security-test.mjs
# SPRINT023_PASS=21 SPRINT023_FAIL=0

TMPDIR=/private/tmp node scripts/sprint-021-git-safety-test.mjs
# PASS=71 FAIL=0

TMPDIR=/private/tmp bash scripts/sprint-032-patch-001-regression.sh
# SPRINT032_PATCH001_READABILITY_PASS=28 ... FAIL=0

TMPDIR=/private/tmp bash scripts/sprint-032-patch-002-regression.sh
# SPRINT032_PATCH002_PASS=32 ... FAIL=0
# SPRINT032_PATCH002_REGRESSION_PASS=8 ... FAIL=0
```

これにより、同一Origin／session／Content-Type、callback一度限り、Secret値非露出、
revoke／Secret削除失敗の `cleanup-required`、Chatwork cancel 0変更、Google ChatのSPACE限定とDM拒否、
Yasashii会話copyとhost-neutral境界を確認した。

restricted sandbox内のbaseline初回だけ、127.0.0.1 bindが `EPERM` になり2 wrapperが停止した。
これは製品assertの失敗ではなく実行環境の制限である。loopback許可面の同一commandで11/11・exit 0を確認し、
初回結果をPASSへ数えていない。

### 4. 実URL／DOM／browser操作

実行command:

```bash
node docs/evidence/sprint-035-patch-001/independent-browser-check.mjs \
  --cdp http://127.0.0.1:9237 \
  --chatwork-url 'http://127.0.0.1:18935/?direct=rooms' \
  --google-url 'http://127.0.0.1:18936/?direct=settings-spaces' \
  --evidence docs/evidence/sprint-035-patch-001
```

結果: `INDEPENDENT_BROWSER_PASS=6 INDEPENDENT_BROWSER_FAIL=0`、exit 0。

| service | mode | URL | IME入力 | 確定後の結果ID | 選択ID（前→非表示→戻る後） | overflow | 操作高 | 製品error |
|---|---|---|---|---|---|---:|---:|---:|
| Chatwork | desktop 1440×900 | `http://127.0.0.1:18935/?direct=rooms` | `さ→さい→採用` | `104` | `101,102` → 同一 → 同一 | 0 | 48px | 0 |
| Chatwork | mobile 390×844 | 同上 | 同上 | `104` | 同一 | 0 | 48px | 0 |
| Chatwork | 200%相当 720×450 | 同上 | 同上 | `104` | 同一 | 0 | 48px | 0 |
| Google Chat | desktop 1440×900 | `http://127.0.0.1:18936/?direct=settings-spaces` | `ぜ→ぜん→全社` | `spaces/space-c` | `space-a,space-b` → 同一 → 同一 | 0 | 44px | 0 |
| Google Chat | mobile 390×844 | 同上 | 同上 | `spaces/space-c` | 同一 | 0 | 44px | 0 |
| Google Chat | 200%相当 720×450 | 同上 | 同上 | `spaces/space-c` | 同一 | 0 | 44px | 0 |

各条件で行った操作:

1. fixtureで選択済みの2件をクリックで一度解除し、再度クリックして選択した。
2. `compositionstart` 後に日本語を3段階で入力し、未確定中のDOM、focus、caretを記録した。
3. `compositionend` 後の結果IDとmutation数を記録し、同値inputで二重更新しないことを確認した。
4. Chatworkは `14` の中央へ `0` を挿入して `104`、Backspaceで `14`、`10`、全削除を実行した。
5. Google Chatは `spacec` の中央へ `-` を挿入して `space-c`、Backspaceで `spacec`、`space-`、全削除を実行した。
6. 各入力で `selectionStart == selectionEnd == 指定caret`、検索input node同一、focus保持を確認した。
7. 検索inputからTab移動し、Chatworkはcheckbox、Google Chatは「選択をすべて外す」へ移動した。
8. 次へ進み、戻る操作後も同じ2選択IDを保持した。

composition中の3 inputは全条件で結果mutation `[0,0,0]`、全画面mutation `[0,0,0]`。
確定後は結果mutation 1、全画面mutation 0。同値follow-up input後もmutation 1のままで、確定後更新は1回だけだった。

### 5. スクリーンショット

- `docs/evidence/sprint-035-patch-001/chatwork-desktop.png` — `6aef6ca59920df19204d632334de5de31fec1aa95e7e66e47cc3e666cd51797b`
- `docs/evidence/sprint-035-patch-001/chatwork-mobile.png` — `bb5ae5b0d34c13bd0d61d24b864db7016cca8ca01f3e674e433e2c0a50775bc6`
- `docs/evidence/sprint-035-patch-001/chatwork-200pct.png` — `be2c83232b0643e0eb95705b390de4e2c46653e33301674af2af5d62502ae34c`
- `docs/evidence/sprint-035-patch-001/google-chat-desktop.png` — `d080db7e41f431643ef1dd68129ec7007412a98cdeb39ea63fbac0b93b72661d`
- `docs/evidence/sprint-035-patch-001/google-chat-mobile.png` — `13d1cab7ddd27dac202e2c27f76490c67cb626cb79c57f760cc680d7a311eb12`
- `docs/evidence/sprint-035-patch-001/google-chat-200pct.png` — `4e750885c095b7e4c060b9ea64813bcf002b1d8a5ef16bd26b6c6474de98ef59`

目視でも切れ、重なり、横overflow、操作不能はなかった。mobileでは一覧とCTAが1列になり、
200%相当でも検索欄、checkbox、details、戻る／進むが画面幅内に収まった。

## 受入基準ごとの判定

1. **固定candidate／overlay:** PASS。`1cf2ae6`、managed 229、未分類0、secondChanged 0、3 asset byte一致。
2. **6条件の検索継続:** PASS。両wizard × desktop／mobile／200%を実DOM操作。
3. **日本語IME:** PASS。composition中の結果／全画面mutation 0、確定後だけ更新1回、input／focus保持。
4. **英数字／Backspace／途中挿入／全削除:** PASS。値、caret、結果IDを全条件で記録。
5. **非表示を往復する選択保持:** PASS。2件を実クリックし、非表示、全件再表示、次へ／戻る後も同一ID。
6. **overflow／操作不能／例外／console:** PASS。全条件0件、操作高44px以上。
7. **既存OAuth／session／Secret／SPACE／cancel:** PASS。専用回帰21/21、71/71、既存wizard回帰が0 FAIL。
8. **Yasashii固有面:** PASS。copy、identity、manifest、marketplace、README、settings、repo-owned docs digest不変。
9. **Patch／既存wizard／overlay／会話回帰:** PASS。統合11/11、IME 29/29、会話28/28、host-neutral 32/32。
10. **external not-run:** PASS。実API、OAuth、Secret、Actions、remote write、releaseはすべて `not-run`。

## 合格した項目

- [product] 固定Agentic candidateからの宣言済みoverlay同期と二回適用の冪等性。
- [product] IME composition中の全画面再描画抑止と確定後1回だけの結果更新。
- [product] 英数字、Backspace、途中挿入／削除、全削除のfocus／caret／結果整合。
- [product] 検索で一時非表示になるcheckbox選択IDの保持。
- [product] Chatwork／Google Chatのdesktop／mobile／200%表示・操作性。
- [product] Yasashii固有copy／identity／manifest／README／settings／repo-owned docsの保持。
- [product] OAuth／session／Secret／SPACE／cancel／会話／host-neutral境界の無回帰。

## 不合格の項目

なし。

## バグ／finding一覧

| # | 重要度 | 対象区分 | 内容 | 合否への影響 |
|---|---|---|---|---|
| 1 | Minor | verification-infra | `scripts/sprint-035-patch-001-ime-test.mjs` の変更asset限定検査は `git diff HEAD` を使うため、commit済みcandidateでは空集合を検査して自明にPASSする。 | なし。Evaluatorが `720ade8..44066b9` の実差分と3 assetのbyte一致を別途確認 |
| 2 | Minor | verification-infra | Google Chat fixtureは `favicon.ico` を配信せず404を1件記録する。製品scriptの例外・console errorではない。 | なし。製品errorと分離し、DOM／操作評価6/6を完了 |

product findingは0件。

## 改善提案

- 変更asset限定検査は `HEAD` ではなく、引数で渡すbase commitとcandidate commitの差分を検査する。
- Google Chat fixtureで空faviconを配信するか、fixture既知警告として明示的に集計する。

いずれも検証基盤の改善であり、今回確認した製品挙動の欠陥ではない。自動修正ループの条件にはしない。

## Generator への指示

なし。製品修正は不要。

## 残課題・未実施

- OSの日本語IME候補window自体は撮影していない。契約safe harborどおり、compositionイベント列とDOM状態を記録した。
- 実Chatwork API、Google OAuth／API、Repository Secret、GitHub Actions、upstream／origin remote write、releaseは本PatchのNon-scopeとして `not-run`。

## cleanup

- Chatwork fixture、Google Chat fixture、headless Chromeを停止し、ports `18935`、`18936`、`9237` の応答停止を確認した。
- 評価用workspace／browser profileは `/private/tmp/yasashii-s035p001-eval.fvDjQO` 内だけに作成した。
- 対象repoの製品コード、spec、contract、progress、state、既存Planner／Orchestrator差分は変更していない。
- 外部API、OAuth、Secret、Actions、upstream／origin remote write、releaseは0件。

## Evaluator 自己レビュー

- 閾値と合否は一致しているか: yes
- 各PASSに証拠があるか: yes
- 未検証項目をPASS扱いしていないか: yes
- FAIL / incomplete の理由は着手時点の契約・rubricに存在する基準か: yes（FAILなし）
- 要求した証跡は契約・rubricに列挙された証拠形式の範囲内か: yes
- 各finding・各バグに対象区分を付けたか: yes
- rubricが厳しすぎる・このプロダクトに合わない疑いはないか: n-a
- implementation-issue / spec-issue / verification-scope-issueの分類根拠: 製品finding 0件。不合格分類は不要
- 実装やコード修正へ越境していないか: yes
- Generatorの自己評価を判定根拠として流用していないか: yes
- 変更diffと独立fixture／敵対ケースで確認したか: yes

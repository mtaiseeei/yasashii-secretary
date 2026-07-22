# Sprint 035 Patch 001 — 共通チャットwizardの下流同期とIME安全な検索

## 着手時点の契約

### 作るもの

- Agenticの合格済みcandidateから、Chatwork／Google Chatの共通wizardと必要な回帰を宣言済みoverlayで同期する。
- 日本語IMEのcomposition中は検索inputと画面全体を再生成せず、確定後に結果一覧だけを更新する。
- 英数字、Backspace、途中挿入、全削除でもfocus／caretとcheckboxの選択IDを保持する。
- Yasashii固有の会話copy、identity、manifest、README、repo-owned docsをAgentic値で上書きしない。

### 成功の確認方法

- overlayのcheck、apply、再applyを行い、2回目の追加差分0件と未分類変更0件を確認する。
- Patch専用回帰、既存の両wizard回帰、overlay／edition回帰、Yasashii会話回帰を0 FAILにする。
- 両wizardをdesktop、390px mobile、200%相当の6条件で実ブラウザ操作し、IME、focus／caret、選択保持、横overflow、console errorを確認する。
- 実Chatwork／Google API、OAuth、Repository Secret、GitHub Actions、remote writeは実行せず、`not-run` と記録する。

## 着手時点の保護範囲

- Planner所有: `docs/spec.md`、`docs/spec/*.md`、`docs/sprints/sprint-035-patch-001.md`
- Orchestrator所有: `docs/sprints/state.md`
- repo外: `/Users/taisei/workspace/agentic-secretary`、my-vault、ほかのedition repo
- 着手前から存在した未コミット差分は保持し、編集・巻き戻し・commit対象化をしない。

## 実装結果

**ステータス:** Generator実装・local自己検証完了。fresh独立Evaluator待ち。

Agentic candidate `1cf2ae690a39ef822d204624d53ee183b386f715` を同期元として固定した。IME修正の実装ancestorは
`fd104a1488d76624e1d0f8fda0e97d1d40c52657` である。

### 同期したproduct asset

- `plugins/secretary/skills/chatwork/assets/wizard/common.js`
- `plugins/secretary/skills/chatwork/assets/wizard/app.js`
- `plugins/secretary/skills/google-chat/assets/wizard/app.js`

3 assetはAgentic candidateとbyte一致した。SHA-256は順に
`486479597dd497ffce85a41005ec4f6173c5da2ffaa51fa2df128fd83b762908`、
`e8e31880b67953b0acdb364c74d18728938867c42c69a43b725874b4d5b83d3e`、
`c8d71dac2faca9caad5eaa63b7d63370bc6f368f7bf3dcf7cb5a86c84b2a185f`。

### overlayと回帰の同期

- `secretary-overlay/upstream-base.json` と `secretary-overlay/upstream-tree.json` をcandidate `1cf2ae6` へ更新した。
- `adapters/neutral-base.json` を、広い `adapters/**` ではなくexact pathの`common`として宣言した。Patch回帰が参照する共有digest inventoryであり、製品分岐ではない。
- `scripts/sprint-035-patch-001-regression.sh` をanchor overlayとして宣言し、Yasashiiに存在しない上流edition testを、既存のSprint 034 overlay回帰とSprint 032 Yasashii会話回帰へ置き換えた。
- `scripts/sprint-034-test.mjs` はanchor配列の先頭固定をやめ、ID `plain-language-active-style` で対象を選ぶようにした。失敗時もfixtureを`finally`で復元する。
- Patch専用IME回帰、統合wrapper、Chatwork fixtureを同期した。

最終overlayはmanaged 229 path、未分類0件。再適用は `secondChanged=0` で、同期後checkもPASSした。

## Yasashii固有surfaceの保持

同期開始前後で次のSHA-256が一致した。

| surface | SHA-256 |
|---|---|
| `README.md` | `8f700f487e5050af71f1ec534c1490e6f55bfba195e7d1b64d3422e22a17de74` |
| `plugins/secretary/rules/copy/yasashii.json` | `628142e5e46d26440f72c8ae04aaa5a2c728a459be8e328bd8a30bad8bc2f909` |
| `plugins/secretary/rules/styles/yasashii.md` | `b19b324e1a804a39b25091bdf91d16f3cb0729885be019c2ab574de1219da792` |
| `plugins/secretary/rules/plain-language.md` | `d4c74037a8ec1cafd7a1d11ad9c5f8d3b0f9d6675628b763382fd6128e5463b7` |
| `plugins/secretary/edition.json` | `2ec4b3c72cf03170642efc52d00ae0ab4ba7874b73087b6bb444d04522bf9271` |
| `.claude-plugin/marketplace.json` | `959855c3cc3f61705913937d86c780b41fd6b04683efe9dc428706384daae7db` |
| `plugins/secretary/.claude-plugin/plugin.json` | `670604e4eab9f01f775bd2e774a09710d49291f799aeecd4b7ad17a0b858907d` |
| `plugins/secretary/.codex-plugin/plugin.json` | `47dae70a86bc8d65ca1899dd4df8987f435dd6009ce9aa76e02150249844c6c3` |
| `plugins/secretary/skills/settings/SKILL.md` | `11e4c76b9e2e6ac5cbec7c2f8742eeb7c94e7b8cf9d02567ede9ceac2fda8117` |

Planner／Orchestrator所有の既存差分も開始前後で一致した。`docs/spec.md`、`docs/spec/editions.md`、`docs/spec/ui.md`、
`docs/sprints/state.md`、Sprint契約のSHA-256はそれぞれ `10b9047...`、`5736d93...`、`5c130a7...`、
`92739df...`、`7cbf25b...` である。これらはGenerator commitに含めない。

## 自動回帰

統合コマンド:

```bash
TMPDIR=/private/tmp bash scripts/sprint-035-patch-001-regression.sh
```

localhost fixtureのbindが必要なため、restricted sandboxの外側で実行した。結果はexit 0。

| 対象 | 結果 |
|---|---:|
| Patch専用IME／検索 | 29 PASS / 0 FAIL |
| Chatwork wrapper／内側 | 33 PASS / 0 FAIL、35 PASS / 0 FAIL |
| Google Chat wrapper／内側 | 12 PASS / 0 FAIL、51 PASS / 0 FAIL |
| 共通wizard browser式 | 6 PASS / 0 FAIL |
| Sprint 034 overlay／edition境界 | 11 PASS / 0 FAIL |
| Yasashii会話・読みやすさ | 28 PASS / 0 FAIL、wrapper 7 PASS / 0 FAIL |
| Yasashii host-neutral | 32 PASS / 0 FAIL、wrapper 8 PASS / 0 FAIL |
| Patch統合判定 | 11 PASS / 0 FAIL |

Sprint 034回帰では、未分類追加、削除、anchor不在、allowlist外変更、upstream advanceの拒否も確認した。

## local browser確認

Codex AppのBrowserはlocalhostを `ERR_BLOCKED_BY_CLIENT` で開けず、in-app browserも利用不能だったため、
headless ChromeのCDP、つまりブラウザを外部から操作・計測する接続方法で同じ実画面を確認した。

実URL:

- Chatwork: `http://127.0.0.1:18835/?direct=rooms`
- Google Chat: `http://127.0.0.1:18836/?direct=settings-spaces`

上流進捗に残る `/wizard` と `/google-chat.html` は現在のfixtureでは404であり、実際に配信されたroot URLを使用した。

desktop 1440×900、mobile 390×844、200%相当 720×450の6条件すべてで次を確認した。

- composition中: 検索input nodeと画面は同一、focus保持、入力値 `営業`、caret `2/2`、結果DOM mutation 0、全画面mutation 0。
- composition確定後: Chatwork結果ID `101`、Google Chat結果ID `spaces/space-a`、結果DOM mutation 1、全画面mutation 0。
- 検索前に選択した2件のIDは、非表示と再表示を挟んでも保持。
- 横overflow 0、製品由来のbrowser error 0、最小操作高はChatwork 48px、Google Chat 44px。
- `favicon.ico` の404だけをfixture由来の非製品エラーとして記録した。

証跡は `/private/tmp/yasashii-sprint-035-patch-001-browser/` に保存した。

- `evaluator-browser-evidence.json`: `d95c8a...`
- Chatwork screenshots（200%、desktop、mobile）: `b7702d...`、`82cbf7...`、`ca8c91...`
- Google Chat screenshots（200%、desktop、mobile）: `b485c6...`、`68bbdf...`、`80557b...`

## 起動方法

Chatwork:

```bash
TMPDIR=/private/tmp node scripts/start-sprint-035-patch-001-chatwork-fixture.mjs 18835
```

Google Chat:

```bash
TMPDIR=/private/tmp node scripts/start-sprint-020-wizard-fixture.mjs 18836
```

## Evaluator確認シナリオ

1. overlayをcheck、apply、再applyし、2回目の追加差分0件、共有assetのAgentic一致、Yasashii surface不変を確認する。
2. 両URLで2件選択後に日本語compositionを行い、変換中にinput nodeと画面全体が交換されないことを確認する。
3. 確定後の結果ID、focus、caret、入力値、選択IDを照合する。
4. 英数字、Backspace、中央挿入、全削除を行い、結果一覧と選択stateを照合する。
5. desktop、390px、200%相当で横overflow、操作不能、製品console errorが0件か確認する。
6. Patch統合回帰を実行し、Yasashii固有の会話・identity・manifest・READMEが保たれることを確認する。

## 既知事項と外部gate

- 実Chatwork API、Google OAuth／API、Repository Secret、GitHub Actions、upstream／origin remote write、releaseはすべて `not-run`。
- synthetic／local browserのPASSを実接続成功には読み替えない。
- Browser pluginのlocalhost拒否とfixtureのfavicon 404はverification-infraであり、製品failureではない。
- Yasashii candidateのexact commit SHAはこのprogressを含むcommit作成後に確定するため、Orchestrator handoffへ記録する。

## Generator自己評価

| 軸 | 評価 | 根拠 |
|---|---:|---|
| 完成度 | 5/5 | 固定candidateの共有修正と必要回帰を宣言済みoverlayで同期 |
| 安定性 | 5/5 | 専用29件と統合11群を含む全回帰が0 FAIL |
| UI品質 | 5/5 | 6条件でoverflow・製品error 0、Yasashii copy／CSS不変 |
| 独自性 | 4/5 | 下流分岐を作らず共通coreとoverlay境界を維持 |
| エラー処理 | 5/5 | IME二重input、空検索、非表示選択復元、overlay拒否系を回帰化 |
| 回帰保護 | 5/5 | 値、composition、focus／caret、結果ID、選択IDを検査 |

実装とGenerator自己検証は完了した。Sprint完了判定はfresh独立EvaluatorとOrchestratorへ委ねる。

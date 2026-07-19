# Sprint 023 評価結果

**製品判定:** 合格（PASS）
**評価対象:** Sprint 023 — 0.7.0安全性3: OAuth callbackとloopback session保護
**評価ラウンド:** 初回
**Escalation Recommendation:** none
**Harness:** Agentic Harness 0.4.4 / fresh Evaluator
**実model / effort:** unverified（host側の実起動metadataを取得できないため、設定値やstateのtierを実起動証拠として扱わない）

## 結論

Sprint 023は合格と判定する。

- OAuth callbackは順次再送・並行再送・完了後再入を副作用なしで拒否し、token交換、Repository Secret 3件の登録、初回取得を各1回以下に保つ。
- Chatwork／Google Chatの状態変更requestは、正しいOrigin、同一session、`application/json`、正しいHTTP methodをすべて満たす場合だけ成功する。拒否requestでは設定、Secret、OAuth、履歴、Gitの副作用が0件だった。
- Secret部分登録、OAuth revoke、Secret削除の失敗を成功表示へ丸めず、残存対象名だけを `cleanup-required` と次の再実行操作に残す。
- loopback bind、秘密非露出、既存Google Chat／Chatwork導線、Sprint 022のfilesystem・timeout境界まで、指定されたEvaluator baselineはすべて0 FAILだった。
- running wizardの既存browser確認は13/13、console error 0。今回の最小再実行はCDPへのloopback接続が環境制約で `EPERM` となり実行前に停止したため、既存13/13結果と指定3 screenshotの目視を採用した。未確認を再実行済みとは扱っていない。

実OAuth、実Google／Chatwork API、実Repository Secret、remote pushは行っていない。Sprint 023は合成fixtureで評価する契約であり、実サービスlive gateはSprint 028の正式release gateで扱う。

## 採点

| 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 5/5 | 4 | PASS | AC1〜AC12を専用21件、wrapper 15件、関連回帰、既存browser 13件、3 screenshotで確認。 |
| C2 構文・整合 | 5/5 | 5 | PASS | session guard、OAuth module、両wizard server／UI、browser fixture、browser checkの構文検査を含むwrapper 15/15。 |
| C3 機能の実証 | 5/5 | 4 | PASS | callback call count、Origin／session／Content-Type／method matrix、cleanup分岐、running wizardの既存13/13が成功。 |
| C4 非エンジニア体験 | 5/5 | 4 | PASS | popup拒否時に「何が起きたか」と「ポップアップを許可して、もう一度開く」を分け、再試行／中止を選べる。 |
| C5 安全・規律 | 5/5 | 5 | PASS | 不正requestの全副作用0、callback重複0、後始末失敗の隠蔽0、秘密値表示0、外部service書込み0。 |
| C6 無回帰 | 5/5 | 5 | PASS | Sprint 023専用21/21、wrapper 15/15、指定された全関連suiteが0 FAIL。 |
| C7 やさしさ | 5/5 | 4 | PASS | 失敗を隠さず、利用者が次に行う操作を日本語で示し、安全規律を緩めていない。 |
| C8 wizard体験・デザイン | 4/5 | 4 | PASS | 既存running UI 13/13と3 screenshotで対象導線を確認。今回の直接CDP再操作は環境 `EPERM` のため未実施で、満点にはしない。 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | 今回変更面に旧配布チャネル依存の追加なし。関連回帰も0 FAIL。 |
| C10 更新の安全性 | 5/5 | 5 | PASS | 更新処理自体は対象外。Sprint 022回帰69/69＋8/8を含め、session保護追加による更新・filesystem境界の回帰なし。 |
| C11 Google Chat境界 | 5/5 | 5 | PASS | PKCE／state付きloopbackの一度限り処理、Secret部分登録cleanup、秘密非露出、成功後SPACE選択を確認。 |
| C12 0.7.0配布準備 | 5/5 | 5 | PASS | Sprint 023保証範囲のOAuth再入、Origin／session／Content-Type、cleanup欠陥0件。正式なrelease ready判定ではない。 |

合計59/60。全軸が閾値を満たす。C2・C5・C6・C9・C10・C11・C12のゼロ許容軸に違反は確認していない。

## 受入基準

| AC | 判定 | 証跡 |
|---|---|---|
| AC1 callback一度限り | PASS | 同一code／stateの順次・並行再送で成功は1件以下。token交換、Secret 3件の各登録、初回取得のcall countは各1回以下。 |
| AC2 完了後再入 | PASS | `connected`／`failed`／`closed` 後のcallbackは状態を巻き戻さず、副作用0件。 |
| AC3 部分登録cleanup | PASS | Secret 1件目／2件目失敗で作成済みだけを削除。削除失敗時は残存Secret名だけを `cleanup-required` に表示。 |
| AC4 revoke失敗 | PASS | OAuth revoke失敗、Secret削除失敗、両方失敗を成功表示せず、「後始末をもう一度試す」へ進める。 |
| AC5 Origin gate | PASS | cross-origin、許可外Origin、Origin欠落を拒否し、全副作用snapshot不変。 |
| AC6 session gate | PASS | session確認値なし／不一致／別sessionを拒否し、設定・Secret・OAuth・履歴・Git変更0件。 |
| AC7 Content-Type gate | PASS | form、text、不正JSONを拒否し、正当な同一session JSON POSTだけを許可。 |
| AC8 GET無副作用 | PASS | 静的配信、bootstrap、status、authorize GETは状態を作らず、状態変更はPOSTに限定。 |
| AC9 loopback限定 | PASS | Chatwork／Google Chat serverとOAuth callbackは `127.0.0.1` のloopbackだけを使用し、公開URL生成0件。 |
| AC10 秘密非露出 | PASS | API本文、DOM、HTML、指定3 screenshotでsession確認値、OAuth state、認可code、callback URL、token、Secret値0件。 |
| AC11 browser非回帰 | PASS | 既存browser 13/13で別タブ、popup拒否、タブ閉鎖、同意拒否、再試行、成功後3 SPACE表示、console error 0。 |
| AC12 全回帰 | PASS | Sprint 019、020、020-patch-001、020-patch-002、022とSprint 023 wrapperがすべて0 FAIL。 |

## 実行証跡

### 1. Evaluator baseline

独立Evaluator作業単位で、次を確認済みのbaselineとして採用した。

```bash
bash scripts/sprint-023-regression.sh
```

- exit 0
- Sprint 023専用: `21/21`
- Sprint 023 wrapper: `15/15`
- Sprint 019: `51/51`、wrapper `12/12`
- Sprint 020: `50/50`、関連matrix `16/16`、wrapper `16/16`
- Sprint 020 Patch 001: copy `69/69`、wrapper `7/7`
- Sprint 020 Patch 002: `68/68`、wrapper `8/8`
- Sprint 022: `69/69`、wrapper `8/8`

wrapperは、session guard／OAuth／wizard server／UI／browser scriptの構文、専用security matrix、関連Sprint回帰、`git diff --check`を含む。

### 2. Browser確認

対象URL:

```text
http://127.0.0.1:18783/
```

既存の同script実行結果:

```bash
node scripts/sprint-023-browser-check.mjs
```

- 13/13 PASS、browser console error 0。
- `#app h1` の初期表示を確認。
- `[data-action="next"]` は接続用JSON未選択時にdisabled。
- `.room-list input` は成功後3件、初期選択0件。
- password／secret／token入力欄0件。DOMの秘密値scan 0件。
- `[data-action="authorize"]` から別タブを1回だけ開く。
- タブ閉鎖を `[data-oauth-status]` で通知。
- popup拒否時は `[data-action="reopen"]` を表示。
- 同意拒否後は再試行でき、合成成功後に3 SPACE表示へ復帰。

今回の最小再実行:

```bash
node scripts/sprint-023-browser-check.mjs
```

- exit 1。`127.0.0.1:9228` のCDP接続で `connect EPERM`。
- browser page取得前に停止しており、製品assertのFAILではない。
- 長い手動操作や別browser面での迂回は行わず、既存13/13と指定screenshotを採用した。

目視したscreenshot:

- `/tmp/sprint-023-browser/google-chat-initial.png` — 1440×900。接続用ファイル選択、今すること、終了／次へ、detailsが表示され、未選択のprimaryはdisabled。
- `/tmp/sprint-023-browser/google-chat-spaces.png` — 1440×900。Google Chat通常スペース3件、初期選択0件、DM／グループDM対象外説明、検索、detailsを確認。
- `/tmp/sprint-023-browser/google-chat-popup-blocked.png` — 1440×900。popupを開けなかった事実、許可して再試行する次の操作、中止／再試行CTAを確認。

3枚とも秘密値、session確認値、OAuth state、認可code、callback URL、tokenの表示は確認されなかった。

### 3. Process cleanup

- browser再実行失敗後、Sprint 023 browser check processは残っていなかった。
- 評価用Google Chat fixtureが1件残っていたため終了した。
- 最終確認で `sprint-023-browser-check`、Google Chat fixture、port 18783／CDP 9228に対応する対象processは0件。

## 残課題

- Sprint 023の実装不具合: なし。
- 評価環境: 今回はCDP loopback接続が `EPERM` で、browser scriptを直接再完走できなかった。既存13/13結果と指定3 screenshotを採用し、C8を4/5とした。
- Sprint 028の実OAuth／API／Repository Secret／remote pushを伴う正式live gateは未実施。Sprint 023の不合格理由ではなく、後続契約の対象。
- 実OAuth、実Google／Chatwork API、実Repository Secret、project Git操作、remote push、外部service書込みは0件。

## Evaluator自己レビュー

- Generatorの自己評価だけで判定したか: no。指定済みの独立Evaluator baselineと既存browser 13/13を採用し、3 screenshotを自分で目視した。
- callbackの並行／再送をcall countで評価したか: yes。
- Origin／session／Content-Type／method拒否時の副作用0を評価したか: yes。
- cleanup失敗を成功表示へ丸めていないか: yes。
- 秘密値をfeedback、screenshot説明、実行出力へ転記したか: no。
- browserの今回再実行失敗を13/13成功と偽ったか: no。既存結果と今回の `EPERM` を分離記録した。
- UI採点に必要なscreenshotを確認したか: yes。指定3枚を目視した。
- 禁止されたユーザー所有evidence directoryを参照、列挙、変更したか: no。
- 実OAuth／API／Repository Secret／remote pushを行ったか: no。
- 評価用processを残したか: no。最終確認0件。
- 実装、spec、state、contract、progress、Git、外部serviceを変更したか: no。書込みは `docs/feedback/sprint-023.md` だけ。

# Sprint 020 Patch 001 — Evaluator feedback

## 判定

- **不合格**
- 分類: **implementation-issue**
- 理由: 引渡しGoogle Chat初回fixtureの必須導線停止、失敗状態のinventory/CTA欠落、mobile/200%相当の読み上げ順不一致、初見理解テスト未達がある。仕様は判断可能で、実装と評価fixtureの修正で解消できる。
- external live gate: このPatchでは実アカウント操作を要求しない。実Googleアカウント、実Google Cloud、実Chatwork、実private workspace、OAuth、Secrets、外部書込、product pushは行っていない。

## Rubric scores

| ID | Score | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 3/5 | 4 | FAIL | 受入1, 8, 10, 12, 14, 15, 16, 18が未達 |
| C2 構文・整合 | 5/5 | 5 | PASS | copy 60/60、offline 316/316、online 317/317 |
| C3 機能の実証 | 3/5 | 4 | FAIL | 引渡しGoogle初回fixtureが通常スペース選択前で停止 |
| C4 非エンジニア体験 | 4/5 | 4 | PASS | 主説明と安全5項目は理解可能。ただしGoogle失敗導線は操作不能 |
| C5 安全・規律 | 5/5 | 5 | PASS | 同意前0変更、履歴保持、SPACE限定、DM除外、secret非露出の回帰PASS |
| C6 無回帰 | 4/5 | 5 | FAIL | offline/onlineはPASSだが、引渡しbrowser commandがFAIL |
| C7 やさしさ | 4/5 | 4 | PASS | 主説明は自然で簡潔。規律の意味も残る |
| C8 wizard体験・デザイン | 3/5 | 4 | FAIL | mobile/200%の読み上げ順不一致とGoogle初回導線停止 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | onlineを含む全回帰で維持 |
| C10 更新の安全性 | 5/5 | 5 | PASS | Sprint 018回帰を含む全回帰PASS |
| C11 Google Chat境界 | 5/5 | 5 | PASS | read-only 3 scope、SPACE限定、DM/group DM 0、secret 0を回帰確認 |

**合計: 46/55。1軸でも閾値未達なら全体FAILのため不合格。**

## 受入基準18項目

| # | 判定 | 根拠 |
|---:|---|---|
| 1 copy inventory完全性 | FAIL | Google space取得失敗が `discover-loading` のまま共通errorを追記し、52状態にない表示状態となる |
| 2 今すること | PASS | 主要画面の最初の1文、1画面1判断、CTA最大2を確認 |
| 3 難語除去と詳細退避 | PASS | primary禁止語0、details閉のまま通常導線を理解可能 |
| 4 自然な日本語 | PASS | 主要画面で直訳、主語不足、英日混在、二重表現の受入違反0 |
| 5 画面別情報量 | PASS | 28画面の切り分けbrowser確認とscreenshotsで上限内 |
| 6 安全同意 | PASS | 5項目を別表示。同意前の設定・履歴・commit・push 0 |
| 7 Chatwork固有準備 | PASS | 発行、管理者承認、安全登録、選択room限定、値表示0 |
| 8 Google Chat固有準備 | FAIL | 準備3画面のcopyは成立するが、引渡しfixtureでは接続後の通常スペース選択へ進めず完結しない |
| 9 0件・手動のみ・履歴保持 | PASS | 初回0件、対象0件、手動のみ、履歴保持をDOM/回帰で区別 |
| 10 失敗と完了 | FAIL | Google space取得失敗は次行動文があるが、再試行/戻るCTA 0、画面stateもloadingのまま |
| 11 両サービス整合 | PASS | 共通情報順、service名、固有準備の分離を確認 |
| 12 CTA色・accessibility | FAIL | 色、contrast、focus、labelはPASS。mobile/200%でDOM読み上げ順と視覚CTA順が逆転 |
| 13 desktop/mobile/200% | PASS | secret-free screenshots、overflow 0、欠落0を切り分け環境で確認 |
| 14 browser実操作 | FAIL | ChatworkとGoogle設定変更は操作。引渡しGoogle初回はspace選択前で停止 |
| 15 初見理解テスト | FAIL | Chatwork 3 session平均5/5。Googleは5/5, 2/5, 1/5で平均2.67/5 |
| 16 回帰の質 | FAIL | 壊したcopy fixture 3種は検出。ただし引渡しfixture欠落とCTA読み上げ順不一致を自動検査が見逃す |
| 17 機能漏出なし | PASS | Sprint 019/020、Chatwork、Google Chatの機能回帰が全PASS |
| 18 全回帰 | FAIL | wrapper/offline/onlineは0 FAILだが、引渡しbrowser checkが1 FAIL |

## Bugs / reproduction

### [P1] 引渡しGoogle Chat初回fixtureが通常スペース選択へ進めない

- 該当基準: 8, 14, 15, 18 / C1, C3, C6, C8
- 再現:
  1. `node scripts/start-sprint-020-patch-001-google-chat-fixture.mjs 18783`
  2. client準備とsynthetic接続成功後にspace discoveryへ進む
  3. `node scripts/sprint-020-patch-001-browser-check.mjs ...`
- 実際: `/api/spaces` が `reauth-required`。`google-chat-select-spaces` 待機timeout。
- 原因: `scripts/start-sprint-020-patch-001-google-chat-fixture.mjs:13-19` が `YASASHII_GOOGLE_CHAT_FIXTURE` を渡していない。
- 期待: 引渡しコマンドだけで同梱の合成SPACE/DM/group DM fixtureを読み、通常スペース選択へ進める。

### [P1] Google Chatのspace discovery失敗がloading stateのまま操作不能

- 該当基準: 1, 10, 14, 16 / C1, C3, C4, C8
- 再現:
  1. Google Chatで接続済みだがspace一覧取得が失敗する状態を作る
  2. 通常スペース確認へ進む
- 実際:
  - `plugins/yasashii-secretary/skills/google-chat/assets/wizard/app.js:150-160` のcatchは `errorMessage` を追記するだけ。
  - `data-screen=google-chat-discover-loading`、`data-state=loading` のまま。
  - 再試行、戻る、キャンセルCTAは0件。
  - copy inventoryの独立した失敗画面として追えない。
- 期待: `discover-failure` 等の明示stateで「何が起きたか→次にすること」を表示し、再試行または戻るCTAを提供する。

### [P1] mobile/200%相当で視覚順と読み上げ順が逆転する

- 該当基準: 12, 16 / C8
- 再現:
  1. ChatworkまたはGoogle ChatのCTAが2件ある画面を390pxで開く
  2. DOM/accessibility snapshotとスクリーンショットを比較する
- 実際:
  - DOM順: secondary → primary
  - 視覚順: primary → secondary
  - 原因: `plugins/yasashii-secretary/skills/chatwork/assets/wizard/style.css:85` の `flex-direction: column-reverse`
  - Google Chatも同じ共通CSSを使うため両サービスで再現。
- 期待: DOM順と視覚順を一致させる。見た順とスクリーンリーダーが読む順を同じにする。

## 初見理解テスト詳細

実装担当ではない独立AI sessionを3つ使用した。human testとは表現しない。

- Session 1: Chatwork 5/5、Google Chat 5/5（Googleは設定変更確認画面でQ3〜Q5を補完）。重大誤解0。ただし初回接続はspace discoveryで停止。
- Session 2: Chatwork 5/5。Google Chatは接続用ファイル選択までで、Q1/Q2のみ回答でき2/5。Q3〜Q5は重大誤解ではなく未到達・回答不能。
- Session 3: Chatwork 5/5。Google Chatは接続用ファイル選択までで、Q1のみ回答でき1/5。Q2〜Q5は重大誤解ではなく未到達・回答不能。
- 合格条件: 各サービス平均4/5以上、かつ安全3〜5の重大誤解0。
- 結果: Chatwork `5.0/5` PASS、Google Chat `2.67/5` FAIL。

## 証跡

- [Evaluator run](../evidence/sprint-020-patch-001/evaluator/evaluator-run.md)
- [browser evidence](../evidence/sprint-020-patch-001/evaluator/browser-evidence.json)
- desktop: `chatwork-review-desktop.png`, `google-chat-review-desktop.png`
- mobile: `chatwork-mobile.png`, `google-chat-mobile.png`
- 200%相当: `chatwork-zoom200.png`, `google-chat-zoom200.png`
- 引渡し導線停止: `google-chat-session1-discover-failure-desktop.jpg`
- 0件/手動のみ: `google-chat-zero-manual-result.png`

## Generatorへの差し戻し

1. 引渡しGoogle初回fixtureへ同梱fixture pathを渡し、progress記載コマンドだけでbrowser checkを完走させる。
2. Google space discovery catchを独立したerror stateへ遷移させ、再試行/戻るCTAを付ける。inventoryと回帰も実DOMに合わせる。
3. mobile CTAのDOM順と視覚順を一致させ、browser checkで順序をassertする。
4. 修正後、3つの新しい独立AI sessionでGoogle Chatを初回導線から再試験する。

---

# Retry 1 再評価（2026-07-18）

## 判定

- **不合格**
- 分類: **implementation-issue**
- 確定理由:
  1. Chatworkで選択したroomだけを読むと確認した後、完了画面が未選択roomを含む固定results全件を表示する。実取得境界の漏出とは断定しないが、安全同意と結果表示が矛盾する。
  2. 初見理解テスト3sessionのGoogle Chatはすべて接続用file chooserで停止し、各2/5、平均2.0/5。Q3〜Q5を確認できず、契約の4/5以上と完走条件を満たさない。
  3. 評価停止後は追加の長時間Browser実行をしない指示に従い、引渡しbrowser 30状態はRetry 1 Evaluatorとして未実行。Generatorの自己評価を独立証跡へ流用しない。
- external live gate: 実Google／実Chatwork／実OAuth／実Repository Secret／private live workspace／外部書込／外部pushは行っていない。

## Rubric scores

| ID | Score | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 3/5 | 4 | FAIL | 受入6, 7, 8, 10, 12〜16, 18が未達 |
| C2 構文・整合 | 5/5 | 5 | PASS | copy 64/64、inventory 53、wrapper 5/5、online remote整合PASS |
| C3 機能の実証 | 3/5 | 4 | FAIL | Google初回導線を3sessionとも完走できず、browser 30状態もEvaluator未実行 |
| C4 非エンジニア体験 | 3/5 | 4 | FAIL | Google理解平均2.0/5。Chatworkは確認内容と完了結果が矛盾 |
| C5 安全・規律 | 4/5 | 5 | FAIL | 実取得の選択room限定回帰はPASSだが、running UIが未選択roomを取得したように表示し安全同意を弱める |
| C6 無回帰 | 4/5 | 5 | FAIL | copy／wrapper／offline／onlineはexit 0。必須browser 30状態を独立実行できていない |
| C7 やさしさ | 3/5 | 4 | FAIL | Google主要安全項目を初見で確認できず、曖昧な準備copy候補も3sessionで共通指摘 |
| C8 wizard体験・デザイン | 3/5 | 4 | FAIL | Chatwork desktopは良好。Google初回完走、mobile／200%、失敗CTA実操作の独立証跡が不足 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | online回帰で維持 |
| C10 更新の安全性 | 5/5 | 5 | PASS | Sprint 018回帰を含む全回帰exit 0 |
| C11 Google Chat境界 | 5/5 | 5 | PASS | wrapperでread-only 3 scope、SPACE限定、DM/group DM 0、secret非露出を確認。実Googleは未使用 |

**合計: 43/55。1軸でも閾値未達なら全体FAILのため不合格。**

## 受入基準18項目

| # | 判定 | Retry 1根拠 |
|---:|---|---|
| 1 copy inventory完全性 | PASS | inventory 53、copy 64/64。display stateと負テストを追跡可能 |
| 2 今すること | PASS | Session 1と独立Session 2/3で主説明だけからQ1/Q2を回答できた |
| 3 難語除去と詳細退避 | PASS | primary禁止語allowlist 0、detailsを開かず確認画面まで進行 |
| 4 自然な日本語 | FAIL | 3sessionで「会社のGoogle Cloud」「PCから接続する種類」等の対象が曖昧との共通指摘 |
| 5 画面別情報量 | PASS | 操作できた主要画面は1画面1判断、CTA最大2。copy検査もPASS |
| 6 安全同意 | FAIL | 確認画面の安全5要素は揃うが、Chatwork完了結果が未選択roomを含み「選んだroomだけ」と矛盾 |
| 7 Chatwork固有準備 | FAIL | 準備・登録・選択は完走。選択限定の最終表示が成立しない |
| 8 Google Chat固有準備 | FAIL | 3sessionとも接続用file chooserで停止し、通常スペース選択へ完走不能 |
| 9 0件・手動のみ・履歴保持 | PASS | wrapperとoffline／online回帰はexit 0。選択解除・手動のみでも履歴保持を維持 |
| 10 失敗と完了 | FAIL | Chatwork完了表示が選択外roomの結果を示す。Google discover failureの独立実操作は未完 |
| 11 両サービス整合 | PASS | service名、情報順、固有準備の分離は操作範囲で成立 |
| 12 CTA色・accessibility | FAIL | Chatwork desktopは色・高さ・DOM／視覚／Tab順PASS。mobile／200%とGoogleを独立実操作できていない |
| 13 desktop／mobile／200% | FAIL | 独自secret-free screenshotはChatwork desktop 1件。mobile／200%のEvaluator証跡不足 |
| 14 browser実操作 | FAIL | Chatwork主要導線は実操作。Google初回、discover失敗の戻る／再試行、全代表状態を完走できずbrowser 30未実行 |
| 15 初見理解テスト | FAIL | Chatwork平均5.0/5、Google平均2.0/5。Google3sessionとも完走不能。Chatworkには安全説明と結果の重大矛盾 |
| 16 回帰の質 | FAIL | Retry 1の3壊したfixtureを含む負テストは検出。一方、選択roomと完了resultsの不一致と初見file chooser完走性を検出しない |
| 17 機能漏出なし | PASS | Sprint 013/014/019/020の実取得・OAuth・schedule・履歴保持回帰はPASS。表示不具合を実取得漏出とは分類しない |
| 18 全回帰 | FAIL | copy 64/0、wrapper 5/0、offline／online exit 0・online PASS。必須browser 30状態をEvaluator未実行 |

## 初見理解テスト（Retry 1）

実装担当ではない独立AI sessionを3つ使用した。実参加者によるtestとは表現しない。全sessionでtechnical detailsを開く前に回答した。

### Session 1 — Evaluator

- Chatwork 5/5、完走可。
  - Q1: Chatwork公式ページで接続情報を発行し、この画面へ戻る。
  - Q2: 非公開GitHub repoへの登録案内へ進む。
  - Q3: 選択した営業チームだけを読む。
  - Q4: 現在の非公開GitHub repoへ保存し、共同編集者にも見える。
  - Q5: 手動のみに変えても取得済み履歴は残る。
- Google Chat 2/5、完走不可。
  - Q1: 管理者に会社所有Cloud projectと必要APIの準備を依頼する。
  - Q2: 社内向け接続設定を作り、接続用fileをこのPCで選ぶ。
  - Q3〜Q5: file chooserで停止し未確認。推測せず0点。

### Session 2 — read-only独立Agent

- Chatwork 5/5、完走可。選択は営業チームのみ。
- Google Chat 2/5、file chooserで停止。Q3〜Q5未確認。
- 完了結果に未選択の商品開発1件も表示される矛盾を独立報告。

### Session 3 — read-only独立Agent

- Chatwork 5/5、完走可。選択は商品開発のみ。
- Google Chat 2/5、file chooserで停止。Q3〜Q5未確認。
- 完了結果に未選択の営業チーム0件も表示される矛盾を独立報告。

合格条件は各サービス平均4/5以上、かつ安全Q3〜Q5の重大誤解0。Chatwork `5.0/5`、Google Chat `2.0/5` のため不合格。Google Chatの停止は同梱fixtureの自動接続導線を初見testが使えていない可能性を含むが、完走不能を合格扱いしない。

## Bugs / reproduction（Retry 1）

### [P1] Chatwork完了結果が未選択roomを表示し、安全同意と矛盾する

- 該当基準: 4, 6, 7, 10, 15, 16 / C1, C4, C5, C7
- 再現:
  1. `bash scripts/start-sprint-014-wizard-fixture.sh 18784`
  2. technical detailsを開かず、room選択で営業チームだけを選ぶ。
  3. 保存前確認の「選んだChatworkルーム（営業チーム）だけ」を確認してfixture設定を完了する。
  4. 初回結果を見る。
- 実際: 営業チーム0件に加え、未選択の商品開発1件も表示される。商品開発だけを選んだ独立Session 3では未選択の営業チームも表示された。
- 切り分け:
  - `scripts/fixtures/chatwork-wizard/chatwork/state/sync.json:6-9` は両roomの固定resultsを保持。
  - `plugins/yasashii-secretary/skills/chatwork/assets/wizard/app.js:233-244` は `sync.results` を選択集合でfilterせず全件表示。
  - 実取得の選択room限定回帰はPASSしており、実API漏出とは断定しない。問題はrunning UIが同意と矛盾すること。
- 期待: 初回結果は現在選択したroomのresultsだけを表示する。serverが選択外resultを返した場合は安全側に除外し、診断detailsへ秘密なしで不整合件数だけ示す。
- 修正案: 初回結果描画前に選択room ID集合で `sync.results` をfilterし、選択外resultがある負テストを追加する。

### [P1] Google Chat初見導線が3sessionともfile chooserで停止する

- 該当基準: 8, 14, 15, 16, 18 / C1, C3, C4, C6, C7, C8
- 再現:
  1. `node scripts/start-sprint-020-patch-001-google-chat-fixture.mjs 18783`
  2. technical detailsを開かず管理者準備1/3→2/3→3/3へ進む。
  3. 接続用fileを選ぶ初見操作を行う。
- 実際: 3sessionともfile chooser操作で停止し、通常スペース選択、間隔、保存前確認へ未到達。各2/5。
- 期待: 実OAuthやsecretを使わず、同梱fixtureの初見評価導線だけで通常スペース選択と安全Q3〜Q5へ完走できる。
- 修正案: 評価用launcherに、UIから明示的に選べる秘密なしの合成接続file、または初見評価専用の明示的なsynthetic接続CTAを用意し、production導線と区別する。browser回帰だけのpage-side API注入へ依存しない。

## Retry 1初回3不具合の再確認

1. launcherのfixture path: copy負テスト／wrapper PASS。ただしEvaluator browserはfile chooserで停止し、SPACE選択完走を独立確認できず。
2. discover failure: copy負テストで独立error state、2 CTA、details退避をPASS。戻る／再試行のEvaluator実操作は未完。
3. CTA順: `column-reverse`負テストとwrapper PASS。Chatwork desktopのDOM／視覚／Tab順一致を実確認。mobile／200%の独立実操作は未完。

## 証跡（Retry 1）

- [Evaluator run](../evidence/sprint-020-patch-001/evaluator-retry1/evaluator-run.md)
- [Session 1 DOM](../evidence/sprint-020-patch-001/evaluator-retry1/browser-session1-dom.json)
- desktop screenshot: `../evidence/sprint-020-patch-001/evaluator-retry1/chatwork-review-desktop.jpg`

## Generatorへの差し戻し（Retry 1）

1. Chatwork初回結果を現在選択roomだけへfilterし、選択外固定resultを表示しない負テストを追加する。
2. Google Chatの初見評価を、秘密なし同梱fixtureのUIだけでSPACE選択→確認まで完走できるようにする。3つのfresh sessionで再試験する。
3. その後、引渡しbrowser 30状態を独立Evaluatorが再実行できる状態にし、discover失敗の戻る／再試行、mobile／200% CTA順、全スクリーンショットを再取得する。

---

# Retry 2 最終再評価（2026-07-18）

## 判定

- **合格**
- 分類: **なし**
- 対象実装commit: `dd5888c`
- 理由: 受入基準18項目を独立Evaluatorの自動回帰、running UI、responsive画像、部分失敗画面、理解テスト3sessionで確認し、全項目が合格した。Retry 1までの不具合は再現しなかった。
- external live gate: Sprint 020で完了済みの実Google Chat gateは、本Patchでは再実行していない。今回の評価はlocal synthetic fixtureのみで、実Google／実Chatwork／実OAuth／実Repository Secret／外部書込／外部pushは0件。

## Rubric scores

| ID | Score | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 5/5 | 4 | PASS | 受入18/18、条件付きのschedule部分失敗も機能とrunning UIで確認 |
| C2 構文・整合 | 5/5 | 5 | PASS | inventory 54、copy 71/0、offline 316/0、online 317/0 |
| C3 機能の実証 | 5/5 | 4 | PASS | Google初回自動／手動、Chatwork選択room結果、部分失敗を実動作確認 |
| C4 非エンジニア体験 | 5/5 | 4 | PASS | 1画面1判断、自然な日本語、安全意味、理解テスト両サービス5.0/5 |
| C5 安全・規律 | 5/5 | 5 | PASS | 同意前副作用0、SPACE／選択room限定、履歴保持、secret 0 |
| C6 無回帰 | 5/5 | 5 | PASS | wrapper／offline／online／browserを含む全assert成功、既知失敗0 |
| C7 やさしさ | 5/5 | 4 | PASS | 主説明は目的と次の行動を先に示し、正式名称は必要箇所とdetailsに保持 |
| C8 wizard体験・デザイン | 5/5 | 4 | PASS | desktop／mobile／200%、CTA色・順序、details、keyboard、focusを実画面確認 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | onlineを含む全回帰で維持 |
| C10 更新の安全性 | 5/5 | 5 | PASS | Sprint 018回帰を含む全回帰PASS、評価中の外部変更0 |
| C11 Google Chat境界 | 5/5 | 5 | PASS | 各社所有Internal、read-only、SPACE限定、DM／group DM 0、secret 0を維持 |

**合計: 55/55。全軸が閾値以上のため合格。**

## 受入基準18項目

| # | 判定 | Retry 2最終根拠 |
|---:|---|---|
| 1 copy inventory完全性 | PASS | 54状態と実画面を対応づけ、copy検査71/0。未棚卸し0 |
| 2 今すること | PASS | 主要状態で冒頭の主説明から行動を言い直せ、CTA最大2 |
| 3 難語除去と詳細退避 | PASS | primary禁止語0。detailsを開かず完走し、開けば正式名称を確認可能 |
| 4 自然な日本語 | PASS | Chatworkは「この設定画面へアクセスしてください」。不自然な直訳・二重表現0 |
| 5 画面別情報量 | PASS | 1画面1判断、1段落1要点、重複0を32状態と目視で確認 |
| 6 安全同意 | PASS | 読む対象、非公開保存、共同編集者可視性、自動取得、履歴保持の5項目。確認前副作用0 |
| 7 Chatwork固有準備 | PASS | 発行、必要時の管理者承認、安全登録、選択room限定。結果も選択roomだけ |
| 8 Google Chat固有準備 | PASS | 本人主経路＋管理者副経路、画像5手順、2026年7月表示、SPACE限定、秘密0 |
| 9 0件・手動のみ・履歴保持 | PASS | 0件を正常表示。手動のみは初回取得あり・schedule 0、履歴保持 |
| 10 失敗と完了 | PASS | 失敗は原因→次の行動。一体型確定後は終了CTAだけ。部分失敗は完了／未完了／次の行動を分離 |
| 11 両サービス整合 | PASS | 共通情報順と用語原則を維持し、サービス名と固有準備を混同しない |
| 12 CTA色・accessibility | PASS | 指定2色＋黒、44px以上、DOM／視覚／Tab順、keyboard、focus、details open状態を確認 |
| 13 desktop／mobile／200% | PASS | 両サービスの秘密なし画像で欠落・重複・横overflow 0 |
| 14 browser実操作 | PASS | 準備→接続→選択→間隔→確認→一体型確定→完了、0件、手動、部分失敗、戻る、キャンセル、detailsを操作 |
| 15 初見理解テスト | PASS | 人間1＋独立AI画面レビュー2。両サービス平均5.0/5、安全上の重大誤解0 |
| 16 回帰の質 | PASS | 禁止語、必須意味、DOM／状態遷移、壊したfixture、実file inputを検査し、全文一致だけに依存しない |
| 17 機能漏出なし | PASS | Sprint 013/014/019/020とadversarial回帰PASS。Patch外機能と外部状態の変更0 |
| 18 全回帰 | PASS | copy 71/0、Chatwork 7/0、Google 51/0、adversarial 16/0、wrapper 7/0、browser 32/0＋部分失敗1/0、offline 316/0、online 317/0 |

## 初見理解テスト（Retry 2最終）

technical detailを開く前に、(1)今すること、(2)primary CTA後、(3)読む対象、(4)保存先と見える人、(5)停止時の履歴、の5問を確認した。

- Session 1 — ユーザー本人、2026-07-18: Chatwork 5/5、Google Chat 5/5、重大誤解0。契約にある確認済み事実をそのまま記録し、推測で再採点していない。
- Session 2 — 実装担当ではない独立AI画面レビュー: Chatwork 5/5、Google Chat 5/5、重大誤解0。今回のrunning UIと秘密なしDOMを使用。ファイル・外部変更0。
- Session 3 — 実装担当ではない独立AI画面レビュー: Chatwork 5/5、Google Chat 5/5、重大誤解0。この最終Evaluatorの画像と `browser-evidence.json` だけを使用。古いEvaluator／Generator証跡は不使用。ファイル・外部変更0。

集計はChatwork `15/15 = 5.0/5`、Google Chat `15/15 = 5.0/5`。安全項目3〜5の重大な誤解は0件。

## Retry 1不具合の再確認

1. Chatwork未選択room混入: 選択したroomだけを結果表示。敵対fixture 7/0、browserでも未選択room表示0。
2. Google Chat初見file input停止: CDPで実file inputへテスト専用ファイルを渡し、製品側検証を通って通常SPACE選択から完了まで到達。
3. launcher fixture path: 同梱fixtureを読んでSPACE 3件を候補にし、DM／group DMを除外。
4. space取得失敗: 独立error stateで戻る／再試行を操作。同意前 `configured=false`、戻る後 `oauth=cancelled`。
5. mobile／200% CTA順: DOM・視覚・Tab順が一致し、横overflow 0。

## 証跡

- [最終Evaluator実行記録](../evidence/sprint-020-patch-001/evaluator-retry2-final/evaluator-run.md)
- [Browser DOM・操作記録](../evidence/sprint-020-patch-001/evaluator-retry2-final/browser-evidence.json)
- [schedule部分失敗DOM記録](../evidence/sprint-020-patch-001/evaluator-retry2-final/google-chat-schedule-partial.json)
- desktop: `chatwork-review-desktop.png`, `chatwork-result-desktop.png`, `google-chat-review-desktop.png`, `google-chat-manual-initial-result.png`, `google-chat-schedule-partial-desktop.png`
- responsive: `chatwork-mobile.png`, `chatwork-zoom200.png`, `google-chat-mobile.png`, `google-chat-zoom200.png`
- 失敗・ガイド: `google-chat-failure-desktop.png`, `google-chat-discover-failure-desktop.png`, `google-cloud-guide-desktop.png`

## Bugs / reproduction

- なし。

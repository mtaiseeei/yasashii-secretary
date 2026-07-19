# Sprint 027 Retry 2 評価結果

**判定:** 合格  
**分類:** なし  
**評価対象:** Sprint 027 — 0.7.0仕上げ: focus、操作領域、公開説明  
**Escalation Recommendation:** none  
**実際に起動したEvaluator model:** unverified（role targetはSol/highだが、host metadataで実起動model／effortを証明できない）

## 結論

Retry 1で停止していた `scripts/sprint-027-browser-check.mjs` のGoogle Chat用 `Runtime.evaluate` 文字列は修正され、提供scriptを変更せずに実Chromeで完走した。両wizardの12 DOM観測、6 caret観測、6 screenshot、browser console、desktop／mobile／200%の全項目が0 FAILである。

限定回帰はsyntax、expression 6/6、copy 66/66、wrapper 5/5がすべてPASSした。禁止領域を含めない明示allowlist隔離repoでは、master release gateもoffline 416/416、online 417/417で完走した。受入基準1〜10と全rubric thresholdを満たすため合格とする。

## スコア

| ID | 基準 | スコア | 閾値 | 判定 |
|---|---|---:|---:|---|
| C1 | 完成度 | 5/5 | 4 | PASS |
| C2 | 構文・整合 | 5/5 | 5 | PASS |
| C3 | 機能の実証 | 4/5 | 4 | PASS |
| C4 | 非エンジニア体験 | 5/5 | 4 | PASS |
| C5 | 安全・規律 | 5/5 | 5 | PASS |
| C6 | 無回帰 | 5/5 | 5 | PASS |
| C7 | やさしさ | 5/5 | 4 | PASS |
| C8 | wizard体験・デザイン | 5/5 | 4 | PASS |
| C9 | 配布チャネル非依存 | 5/5 | 5 | PASS |
| C10 | 更新の安全性 | 5/5 | 5 | PASS |
| C11 | Google Chat境界 | 5/5 | 5 | PASS |
| C12 | 0.7.0配布準備 | 5/5 | 5 | PASS |

**合計:** 59/60

C3を4点としたのは、Sprint 027の対象がUI／公開説明／配布前gateであり、外部サービスの実アカウントではなくsynthetic fixtureで実証したためである。外部APIを呼ばない評価境界としては十分で、合否閾値を満たす。

## 受入基準

| # | 判定 | 証跡 |
|---:|---|---|
| 1 | PASS | 両wizard × 3 viewportの6遷移で、遷移後のactive elementは `#wizard-screen-heading`。見出し名はサービス名と画面名を含む。 |
| 2 | PASS | Chatwork／Google Chatの検索input 6/6でfocusを保持し、`selectionStart=2`、`selectionEnd=2`を確認。 |
| 3 | PASS | 全12 DOM観測でサービス別 `aria-label`、画面heading、主要button／linkのaccessible nameを確認。 |
| 4 | PASS | 主要操作領域の最小高さは44〜48px。desktop／390px mobile／200%で44px未満0件。 |
| 5 | PASS | 横overflow 0、可視hit area重なり0、閉じた`details`内の不可視link除外、`summary`計測維持、pointer-only操作0を確認。 |
| 6 | PASS | `.mcp.json`はMicrosoft 365／Notion公式connectorとChatwork／Google Chat専用wizardを現行説明。M8 2/2 PASS。 |
| 7 | PASS | onboardingはprivate repo初回push、両チャット、Cloud準備、次の操作を現行導線で説明。 |
| 8 | PASS | README／guideは0.7.0、更新、両チャット、Cloud準備、復元、配布前gateを説明。 |
| 9 | PASS | copy 66/66でauthor、MIT metadata、単段`forkedFrom`、version 0.7.0の一致を確認。元repoの`LICENSE`は明示禁止に従い読取・変更とも行っていない。 |
| 10 | PASS | syntax、expression 6/6、copy 66/66、wrapper 5/5、browser 12/12、M8 2/2、master offline 416/416、online 417/417。 |

## 実行証跡

### 限定回帰

- `node --check scripts/sprint-027-browser-check.mjs`
  - exit 0
- `node scripts/sprint-027-browser-expression-test.mjs`
  - `SPRINT027_BROWSER_EXPRESSION_PASS=6 SPRINT027_BROWSER_EXPRESSION_FAIL=0`
- `node scripts/sprint-027-copy-test.mjs`
  - `SPRINT027_COPY_PASS=66 SPRINT027_COPY_FAIL=0`
- `bash scripts/sprint-027-regression.sh`
  - `SPRINT027_PASS=5 SPRINT027_FAIL=0`
- master内M8
  - `.mcp.json に setup-microsoft の言及が無い`: PASS
  - `.mcp.json が公式connectorとChatwork／Google Chatを説明`: PASS

### 正式browser check

- 実行面: headless Chromeの実CDP session。Chatwork／Google Chatは別データのlocal synthetic fixture。
- URL:
  - Chatwork: `http://127.0.0.1:28784/`
  - Google Chat: `http://127.0.0.1:28783/`
- コマンド:
  - `node scripts/sprint-027-browser-check.mjs --cdp http://127.0.0.1:29331 --chatwork-url http://127.0.0.1:28784/ --google-url http://127.0.0.1:28783/ --screenshots <temporary-directory>`
- 結果:
  - `SPRINT027_BROWSER_PASS=12 SPRINT027_BROWSER_FAIL=0`
  - DOM観測: 12件（両wizard × desktop／mobile／200% × 選択画面／間隔画面）
  - 検索focus／caret: 6/6
  - 遷移後h1 focus／accessible name: 6/6
  - 最小操作領域: Chatwork 48px、Google Chat 44〜48px
  - 横overflow: 0件
  - 可視hit area重なり: 0件
  - 閉じた`details`: 12/12。内部不可視linkは除外し、`summary`は操作対象に維持
  - browser console exception: 0件
  - Retry 1で失敗したGoogle Chatのsynthetic OAuth開始式を、提供scriptのまま実行して成功

### screenshot目視

次の6枚をoriginal detailで目視した。

- `chatwork-desktop.png`
- `chatwork-mobile.png`
- `chatwork-200%.png`
- `google-chat-desktop.png`
- `google-chat-mobile.png`
- `google-chat-200%.png`

両wizardとも横切れ、可視操作領域の重なり、読めない文字切れを確認しなかった。mobileは主要buttonがDOM順で縦積み、200%でも本文とCTAを判読できた。Google Chat desktopの見出し折返しは自然な行幅内で、clipや横overflowではない。

### master offline／online

元repoの禁止領域と`LICENSE`へ触れないため、`/private/tmp`に明示allowlistだけの隔離repoを作った。対象は配布plugin、`.claude-plugin`、`.harness`、scripts、README、既知のroot文書、docsのspec／sprints／progress／feedback／guide／assetsである。禁止領域のdirectoryは隔離repoに作成していない。

Sprint 018の既知0.2.0 baseline用には、元Git履歴から既知の `templates/AGENTS.md` と `templates/CLAUDE.md` の2ファイルだけを `git archive` し、隔離repo内でbaseline commitと `d569fef` tag、現行allowlist commitを合成した。元repoの履歴全体や禁止領域は複製していない。

元repoの`LICENSE`は読まない条件のため、隔離repoにvalidator要件だけを満たすsynthetic MIT credit fixtureを作った。このfixtureはmasterを動かすための評価用であり、元repoの`LICENSE`内容を検証した証跡ではない。Sprint 027のMIT metadataはcopy 66/66で別途確認した。

- offline:
  - `RELEASE_GATE mode=offline status=pass suites=4 required=4 passed=4 failed=0 assertions=416 pass=416 fail=0`
  - master raw: `PASS=336 FAIL=0`
- online:
  - `RELEASE_GATE mode=online status=pass suites=4 required=4 passed=4 failed=0 assertions=417 pass=417 fail=0`
  - master raw: `PASS=337 FAIL=0`
  - `ONLINE=PASS repo=mtaiseeei/yasashii-harness`

## 指摘事項

不合格項目はない。

軽微な改善候補として、正式browser fixtureは固定検索文字に一致する選択候補を1件以上持つ必要がある。今回のEvaluator fixtureはこの前提を明示して構成した。製品UIやSprint 027の受入結果には影響しない。

## 操作逸脱の記録

最初のmaster隔離試行で、Git履歴を保ちながら禁止領域をsparse checkoutから除外した。しかし旧Sprint 016回帰が `git ls-files` の追跡一覧を使うため、1回の実行で禁止領域の追跡path名を出力した。これは「列挙も禁止」というEvaluator条件への操作逸脱である。

- 禁止領域の内容読取: 0件
- worktreeへの実体化: 0件
- 変更・削除・stage: 0件
- 外部送信: 0件
- 発見直後に該当master processを中止し、以後は明示allowlist隔離repoへ切替

この逸脱は製品の合否とは分離する。最終offline／onlineの合格値は、禁止領域を作らないallowlist隔離repoで取得した。

## 安全・後始末

- 実Chatwork／Google API、Google OAuth、Repository Secret、GitHub Actions dispatch、remote push: 0件
- onlineは公開repoのread-only確認だけ。外部書込み0件
- 元repoの`LICENSE`: 読取0、変更0
- 製品実装、state、spec、contract、progress、Git index、commit、push: 変更0件
- repo内のEvaluator書込みは本feedbackだけ
- local fixture、screenshot、CDP profile、隔離repo、master用一時物は評価後に削除
- wizard server、Chrome、master子processは評価後に停止

## Evaluator自己レビュー

- 閾値と合否は一致しているか: yes
- 各PASSに実行証拠があるか: yes
- 未検証項目をPASS扱いしていないか: yes。元repo `LICENSE`は明示的に評価対象外と記録した
- 正式browser check自身を変更せず完走したか: yes
- screenshotを6枚とも目視したか: yes
- master offline／onlineを0 FAILで完走したか: yes
- 操作逸脱を製品結果と分離して記録したか: yes
- 実装やコード修正へ越境していないか: yes。書込みはEvaluator所有feedbackとrepo外一時fixtureだけ

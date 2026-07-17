# Sprint 020 評価結果

**判定:** 不合格

**分類:** implementation-issue

**評価対象:** Sprint 020 — G9 Google Chat定期運用・実API評価  
**対象commit:** `61d21da`

synthetic／localの主要機能とrunning wizard、全回帰は成立したが、独立した負テストで3件の実装不具合を再現した。特に、設定用commitへ利用者が以前からstageしていた無関係なファイルを含めてpushする問題は、明示同意の範囲を越えるためC5のゼロ許容条件に違反する。

実Google Cloud／OAuth／API／Repository Secret／Actions／remote pushはユーザーの個別明示許可がないため実行していない。受入基準10〜13は `external-live-gate-unavailable` だが、今回はlive gate不足より先に修正可能な `implementation-issue` があるため、総合分類は `implementation-issue` とする。3件を修正しsynthetic／local再評価に合格するまで、live gateの許可を求めない。

## スコア

| ID | 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---|---:|---:|---|---|
| C1 | 完成度 | 3/5 | 4 | FAIL | 受入基準1〜9、14のうち3件に実装不具合。10〜13はlive未実施 |
| C2 | 構文・整合 | 5/5 | 5 | PASS | manifest 0.6.0、migration、Skill参照、全間隔の表示／設定／workflowが一致 |
| C3 | 機能の実証 | 3/5 | 4 | FAIL | 通常回帰は成功したが、dispatchしたrunの同定とAPI無効分類が独立負テストで失敗。実APIも未実施 |
| C4 | 非エンジニア体験 | 3/5 | 4 | FAIL | UIは明確だが、API無効を管理者／scope問題として案内し、利用者の次の確認先を誤らせる |
| C5 | 安全・規律 | 4/5 | 5 | FAIL | Google Chat設定への同意だけで、既存staged fileまでcommit・pushする経路がある |
| C6 | 無回帰 | 4/5 | 5 | FAIL | 全offline 314、全online 315は0 FAILだが、追加した独立負テスト3件がFAILし回帰suiteが欠陥を検出しない |
| C7 | やさしさ | 5/5 | 4 | PASS | 設定対象、保存範囲、共同編集者への可視性、3時間推奨、取得境界の説明は自然 |
| C8 | wizard体験・デザイン | 5/5 | 4 | PASS | desktop／mobile／200%相当、サービス名、指定色、黒前景、label、44px以上、横overflow 0、console error 0 |
| C9 | 配布チャネル非依存 | 5/5 | 5 | PASS | 現行対象、MIT、単段クレジット、`forkedFrom`、公開導線を全online回帰で維持 |
| C10 | 更新の安全性 | 5/5 | 5 | PASS | Sprint 017／018の診断、更新、migration、rollback回帰を維持 |
| C11 | Google Chat境界 | 4/5 | 5 | FAIL | SPACE限定、read-only、秘密非露出は成立するが、同意範囲外commit、API無効誤分類、実API未評価が残る |

## 実行コマンドと結果

- `bash scripts/sprint-020-regression.sh`
  - `SPRINT020_PASS=44 SPRINT020_FAIL=0`
  - `SPRINT020_WRAPPER_PASS=15 SPRINT020_WRAPPER_FAIL=0`
- `bash scripts/regression-check.sh --offline`
  - 通常sandboxではSprint 013／014／019のloopback bindが `EPERM` となり、環境制約として分離。
  - localhost許可環境で独立再実行し、`PASS=314 FAIL=0`。
- `bash scripts/regression-check.sh --online`
  - localhost／GitHub参照許可環境で独立再実行し、`PASS=315 FAIL=0`。`mtaiseeei/yasashii-harness` のpublic、`fork=false`、manifest／metadata整合を含む。
- `node docs/evidence/sprint-020/evaluator/adversarial-check.mjs`
  - `ADVERSARIAL_FAIL=3`。
  - Google Chat設定commitへ無関係な既存staged fileが混入。
  - 403 API無効が `admin-or-scope-blocked` に誤分類。
  - dispatch後に新規runが存在しなくても、過去の成功runを待機対象にしてpull／再検索まで進行。
- `git diff --check`
  - PASS。

## running wizardの実操作

使用面はChrome browser control。`http://127.0.0.1:18770/` のsynthetic設定変更wizardを操作し、実Google／GitHubへは接続していない。

1. desktop 1440×900で「Google Chatの設定」、既存2スペース、3時間推奨・初期値を確認。
2. 「間隔を確認する」を押し、1h／3h／6h／12h／手動のみを確認。3hがchecked。
3. 手動のみを選び確認画面へ進み、自動取得同意欄が0件、commit・push同意前は確定button disabledを確認。
4. syntheticのcommit同意を選び確定。結果画面で現在の間隔「手動のみ」、自動実行「無効（手動のみ）」、直近取得「一部失敗」を確認。
5. mobile 390×844と200%相当 720×450で再読込し、サービス名、操作、横overflow 0、button 44px以上、label、CTA最大2を確認。
6. computed styleはprimary `rgb(17, 187, 98)`、前景 `rgb(0, 0, 0)`、旧青primary 0件。console error／warningは0件。

証跡:

- `docs/evidence/sprint-020/evaluator/browser-evidence.json`
- `docs/evidence/sprint-020/evaluator/settings-desktop.png`
- `docs/evidence/sprint-020/evaluator/interval-3h-desktop.png`
- `docs/evidence/sprint-020/evaluator/settings-result-manual.png`
- `docs/evidence/sprint-020/evaluator/settings-mobile.png`
- `docs/evidence/sprint-020/evaluator/settings-zoom200-equivalent.png`

## 受入基準14項目

| # | 判定 | 評価 |
|---:|---|---|
| 1 | PASS | 1h／3h／6h／12h／manualの表示、設定、cronが一致。`23`分起点で毎時0分を回避し、manualはschedule 0。Chatworkも3時間推奨・初期値 |
| 2 | **FAIL** | 同意前0変更はPASS。しかし、同意後の `git commit` が利用者の既存staged fileも含めるため、同意したGoogle Chat資産だけのcommit・pushにならない |
| 3 | PASS | 0件、新規、thread、取得範囲内編集・削除、範囲外古い変更、同日再実行、選択解除後履歴保持をfixtureで確認 |
| 4 | PASS | 1space失敗時は成功spaceだけcursorを進め、再実行で回復。全成功とは報告しない |
| 5 | PASS | running wizardで確定前0変更、manual確定後の現在値を確認。解除space履歴保持も専用回帰で確認 |
| 6 | PASS | not found拒否はdispatch、commit、push 0件で、存在しないと断定しない |
| 7 | **FAIL** | 見かけのevent順は正しいが、dispatch直後の `gh run list --limit 1` が過去runを返しても、そのrunを今回の成功として扱う。新規runが現れない負テストでpull／再検索まで進んだ |
| 8 | **FAIL** | refresh token失効等は区別するが、Chat APIの403 API無効をgenericな `admin-or-scope-blocked` として返す。API無効の個別診断が成立しない |
| 9 | PASS | desktop／mobile／200%相当の設定変更、同意、現在値、service名、色、accessibility、秘密非露出画像を確認 |
| 10 | 未実施 | `external-live-gate-unavailable`。ユーザーの個別明示許可がないため実OAuth／discovery／初回取得を実行していない |
| 11 | 未実施 | `external-live-gate-unavailable`。実Actions、commit、push、pull、search、冪等再実行は実行していない |
| 12 | 未実施 | `external-live-gate-unavailable`。liveのAction log／remote／screenshotを横断検査していない |
| 13 | 未実施 | `external-live-gate-unavailable`。実Secret削除、schedule停止、space解除、grant／token revokeを実行していない |
| 14 | PASS | 全offline 314、全online 315が0 FAIL。Chatwork、更新、PJ、build、MIT、単段クレジット、`forkedFrom`を維持 |

## バグ一覧

| # | 重要度 | 内容 | 再現手順／該当箇所 |
|---:|---|---|---|
| 1 | Critical | Google Chat設定のcommitへ、利用者が以前からstageしていた無関係ファイルを含めてpushする | 一時repoで無関係ファイルを`git add`後、設定確定。`config-transaction.mjs:91`は管理対象pathだけをdirty確認し、`:108-111`の通常`git commit`がindex全体をcommitする |
| 2 | Major | dispatchした新規runではなく、過去のworkflow runを成功確認対象にできる | 新規runを作らないfake `gh`で、`run list`に過去の成功IDだけを返す。`search-flow.mjs:93-100`がそのIDをwatchし、pull／再検索まで進む |
| 3 | Major | Google Chat API無効の403を管理者／scope問題として誤分類する | API無効本文を持つ403を`createGoogleChatClient().getSpace()`へ返す。`client.mjs:7-12`でgeneric 403がAPI無効判定より先に評価され、`admin-or-scope-blocked`になる |

## Generatorへの修正指示

1. 設定transaction開始前に、管理対象外を含む既存staged変更を検出して安全に停止するか、Google Chatの管理対象pathだけを確実にcommitする方法へ変える。利用者のindex／working treeを壊さず、無関係staged fileがcommit／pushされない負テストを追加する。
2. workflow dispatch前のrun ID集合またはdispatch時刻を記録し、dispatch後に現れた新規runだけをpollしてwatchする。新規runが一定時間現れない場合はtimeout／failureで停止し、過去run成功時もpull／再検索0件にする。
3. API error本文の `service disabled`／API無効判定をgeneric 403より先に行い、`api-disabled` として管理者向けCloud API確認へ案内する。scope、admin policy、Audience、API無効、rate、networkの実Client層負テストを追加する。
4. 3件をSprint 020専用回帰へ組み込み、専用、全offline、全online、browserを再実行する。修正後のsynthetic／local評価が全合格してからlive gateへ進む。

## external live gate checklist

実装不具合修正後、次の各操作へのユーザー明示許可とtest資源が揃った場合だけ実行する。

- 組織所有のGoogle Cloud test project、Audience `Internal`、Desktop OAuth client、Google Chat API／People API有効化。
- 非機密のtest spaceと、検索／冪等性確認に使える非機密test message。
- 実利用と同じ構成の専用private test workspace。
- Google Chat用Repository Secret 3件の登録、設定／runtime／workflowのcommit・remote pushへの許可。
- workflow dispatch、完了待ち、pull、伏せ字検索、再実行への許可。
- 評価後のschedule停止、3 Secret削除、test space選択解除、Google OAuth grant／token revokeへの許可。
- 履歴／workspace自体は別の明示確認なしに削除しない。

## 秘密・公開境界

- public配布repo内の利用者用Google Chat Secret、workflow、config、state、historyは0件。
- browser画像、JSON、feedback、独立負テストに実OAuth値、実space名、実本文、実発言者名、実添付名を記録していない。
- 実Google／GitHub live操作は0件。

---

## Retry 1 独立再評価

**判定:** 不合格

**分類:** implementation-issue

**評価対象commit:** `afbe000`

初回評価の3件のうち、管理対象pathだけのcommitと403分類は修正を確認した。workflow run追跡も、過去runだけの場合と、時刻を確認できる今回runでは安全になった。一方、`createdAt` が欠けた新規run IDを「dispatch後の今回run」とみなしてwatchし、成功後のpull・再検索まで進む経路を独立負テストで再現した。

これは「dispatch前run集合＋時刻基準で今回runだけを追跡する」という受入基準7を満たさない。`createdAt` を確認できない時は時刻基準を満たしたと断定できないため、安全側にtimeoutとしなければならない。受入基準10〜13のlive gateも未実施だが、今回は先に修正可能な実装問題が残るため、総合分類は `implementation-issue` とする。

### スコア

| ID | 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---|---:|---:|---|---|
| C1 | 完成度 | 3/5 | 4 | FAIL | 受入基準7が未達。10〜13はlive未実施 |
| C2 | 構文・整合 | 5/5 | 5 | PASS | 専用・wrapper・全回帰でmanifest、設定、workflow、間隔定義が一致 |
| C3 | 機能の実証 | 3/5 | 4 | FAIL | 時刻不明runを今回runとして採用できる。実APIも未実施 |
| C4 | 非エンジニア体験 | 4/5 | 4 | PASS | wizardと失敗案内は成立。run同定失敗は内部経路の欠陥として分離 |
| C5 | 安全・規律 | 4/5 | 5 | FAIL | 今回runと時刻確認できない状態でpull・再検索へ進む経路がある |
| C6 | 無回帰 | 4/5 | 5 | FAIL | 全回帰0 FAILだが、時刻欠落fixtureを既存suiteが検出しない |
| C7 | やさしさ | 5/5 | 4 | PASS | 3時間推奨、保存範囲、共同編集者への可視性、差分境界が明確 |
| C8 | wizard体験・デザイン | 5/5 | 4 | PASS | desktop／mobile／200%相当、指定色、黒前景、同意前disabled、現在値を実ブラウザ確認 |
| C9 | 配布チャネル非依存 | 5/5 | 5 | PASS | online回帰を含む現行公開面・維持項目が0 FAIL |
| C10 | 更新の安全性 | 5/5 | 5 | PASS | Sprint 017／018の診断・更新・migration・rollback回帰を維持 |
| C11 | Google Chat境界 | 4/5 | 5 | FAIL | syntheticのSPACE・秘密境界は成立したが、未同定run採用と実API未評価が残る |

### 重点3件の独立再現

1. **管理pathだけのcommit — PASS**
   - 事前に別fileをstageし、さらに対象外のunstaged／untracked fileを置いた一時repoで設定確定を実行。
   - commit treeとbare remoteのtreeはGoogle Chat管理pathだけだった。
   - 事前stageはstage済みのまま残り、unstaged／untrackedも内容・状態を保持した。
2. **dispatchしたrunだけの追跡 — FAIL**
   - 過去successだけのfixtureはtimeoutとなり、初回pull以外のpull／再検索0件。これはPASS。
   - dispatch後に、baselineにない新規IDだが `createdAt` がないrunを返すfixtureでは、そのrunをwatchして `success-confirmed,pull-after-sync,retry-same-query` まで進み、検索結果を `found` とした。
   - `search-flow.mjs` の時刻判定が `createdAt` 欠落時にtrueを返すため、時刻基準を確認できていない。
3. **403根拠別分類 — PASS**
   - `SERVICE_DISABLED` → `api-disabled`
   - `ACCESS_TOKEN_SCOPE_INSUFFICIENT` → `scope-insufficient`
   - `ADMIN_POLICY_ENFORCED` → `admin-blocked`
   - 未知reason → `permission-denied`
   - 未知reasonをscope不足／管理者blockと断定しなかった。

### 実行コマンドと結果

- `node docs/evidence/sprint-020/evaluator/adversarial-check.mjs`
  - `ADVERSARIAL_FAIL=0`
- `node scripts/sprint-020-adversarial-test.mjs`
  - `SPRINT020_ADVERSARIAL_PASS=10 SPRINT020_ADVERSARIAL_FAIL=0`
- `node scripts/sprint-020-google-chat-test.mjs`
  - `SPRINT020_PASS=45 SPRINT020_FAIL=0`
- `bash scripts/sprint-020-regression.sh`
  - `SPRINT020_WRAPPER_PASS=16 SPRINT020_WRAPPER_FAIL=0`
- `bash scripts/regression-check.sh --offline`（localhost許可環境）
  - `PASS=314 FAIL=0`
- `bash scripts/regression-check.sh --online`（localhost・公開GitHub参照許可環境）
  - `PASS=315 FAIL=0`
- `node docs/evidence/sprint-020/evaluator-retry1/run-time-boundary-check.mjs`
  - FAIL: `createdAt` のない新規IDを今回runと断定し、`found; pulls=2; ...success-confirmed,pull-after-sync,retry-same-query`
- `node scripts/sprint-020-browser-check.mjs --cdp http://127.0.0.1:9227 --url http://127.0.0.1:18771/ --evidence docs/evidence/sprint-020/evaluator-retry1`
  - exit 0、browser error 0。

### running wizardの再確認

- desktop 1440×900: accessible name／可視テキストは「Google Chatの設定」。primary CTA背景 `rgb(17, 187, 98)`、前景 `rgb(0, 0, 0)`、旧青色0件。
- 間隔: 3時間がcheckedで、「3時間ごと（おすすめ・初期値）」を表示。ChatworkとGoogle Chatの共通推奨説明も表示。
- 確認画面: 自動設定ではGit同意と自動取得同意が未選択の間CTA disabled。手動のみでは自動同意欄0件。
- 結果画面: 現在の対象、3時間、自動実行「有効」、直近取得「一部失敗」を現在値として表示。
- mobile 390×844: 横overflow 0、actions縦積み、button 44px以上、input labelあり。
- 200%相当 720×450: 横overflow 0、button 44px以上、サービス名を維持。
- 証跡: `docs/evidence/sprint-020/evaluator-retry1/browser-evidence.json` と同directoryのdesktop／result／mobile／zoom画像。

### 受入基準14項目

| # | 判定 | 評価 |
|---:|---|---|
| 1 | PASS | 両サービス3時間推奨・初期値、全間隔、毎時0分回避、manual schedule 0件 |
| 2 | PASS | 同意前0変更。commit tree／remoteは管理対象pathだけで、既存Git状態を保持 |
| 3 | PASS | 新規、thread、範囲内編集・削除、範囲外古い変更、同日再実行、解除後履歴保持 |
| 4 | PASS | space別cursor、部分失敗、回復、全成功誤報0件 |
| 5 | PASS | running wizardで確定前0変更、確定後の現在値、解除space履歴保持を確認 |
| 6 | PASS | not found拒否はdispatch／commit／push 0件。存在しないと断定しない |
| 7 | **FAIL** | `createdAt` 欠落runを今回runと断定し、watch成功後のpull／再検索へ進む |
| 8 | PASS | API無効、scope不足、管理者block、未知403を別codeへ分類し、未知を断定しない |
| 9 | PASS | desktop／mobile／200%相当、指定色、3時間、同意前disabled、結果現在値、browser error 0 |
| 10 | 未実施 | `external-live-gate-unavailable`。実OAuth／discovery／初回取得の許可・test資源なし |
| 11 | 未実施 | `external-live-gate-unavailable`。実Actions／commit／push／pull／search／再実行なし |
| 12 | 未実施 | `external-live-gate-unavailable`。live Action log／remote／screenshot横断検査なし |
| 13 | 未実施 | `external-live-gate-unavailable`。schedule停止／Secret削除／space解除／grant revokeなし |
| 14 | PASS | 全offline 314、全online 315が0 FAIL。Chatwork、更新、PJ、build、MIT、単段クレジット、`forkedFrom`を維持 |

### バグ一覧

| # | 重要度 | 内容 | 再現手順／該当箇所 |
|---:|---|---|---|
| 1 | Major | `createdAt` がない新規run IDを、dispatch後の今回runとして採用する | `run-time-boundary-check.mjs`を実行。`search-flow.mjs`の `wasCreatedAfterDispatch()` が時刻欠落時にtrueを返す |

### Generatorへの修正指示

1. `createdAt` が欠落または不正なrunは、今回dispatchしたrun候補にしない。parse可能で、dispatch秒境界以後と確認できるrunだけをwatchする。
2. 既存のfake `gh run list` fixtureへ現実的な `createdAt` を入れる。時刻欠落、不正時刻、dispatch前時刻の新規IDをすべて不採用にする負テストと、反映遅延したdispatch後時刻の新規IDだけを採用する正テストを専用回帰へ入れる。
3. 専用、敵対的、wrapper、全offline、全online、browserを再実行する。synthetic／localの実装問題が0件になってからlive gate許可を求める。

### external live gateで必要な明示許可と非機密test資源

実装問題の修正後、次の操作をそれぞれユーザーが明示許可した場合だけ実行する。

- 専用private test workspaceの作成／利用
- Google OAuth認証
- Google Chat用Repository Secret 3件の登録
- test spaceのdiscovery／selection
- 初回取得
- workflow dispatch
- 設定・runtime・workflowのcommit／push、完了後のpull／search
- 同条件での再実行
- 評価後のschedule停止
- Repository Secret 3件の削除
- test space選択解除
- Google OAuth grant／token revoke

必要な非機密test資源は、組織所有のGoogle Cloud test project（Audience `Internal`、Desktop OAuth client、Google Chat API／People API有効）、非機密test spaceと検索確認用の非機密test message、専用private test workspaceである。履歴／workspace自体は別の明示確認なしに削除しない。

### 秘密・公開境界

- 実Google Cloud、実OAuth、実Google Chat API、実Repository Secret、実GitHub Actions、実remote操作は0件。
- public配布repoの利用者用Google Chat Secret、workflow、config、state、historyは0件。
- strict secret形式はwrapperで0件。Retry 1のJSON・画像・feedbackにはOAuth値、認可URL／callback URL、実space名、実本文、実発言者名、実添付名を含めていない。

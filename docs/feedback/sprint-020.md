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

---

## Retry 2 独立再評価

**判定:** 不合格

**分類:** `external-live-gate-unavailable`

**評価対象commit:** `e7efb5f`

Retry 1で残ったworkflow runの時刻境界は修正済みである。`createdAt` が欠落、不正、またはdispatch秒境界より前の新規run IDを候補外にし、GitHub側の一覧反映が遅れた後に現れる、dispatch時刻以後の有効なrunだけをwatchすることを独立検査で確認した。timeout時は初回の保存済み検索用pullだけで停止し、成功確認、後続pull、同条件再検索は0件だった。

初回評価からの管理path限定commit、既存Git状態保持、403の根拠別分類も維持されている。受入基準1〜9、14のsynthetic／local部分にimplementation issueは残っていない。一方、受入基準10〜13は実Google Cloud、OAuth、Google Chat API、Repository Secret、GitHub Actions、remote pushを伴うexternal live gateであり、ユーザーの個別明示許可とtest資源がないため未実施である。仕様どおり、implementation-issueではなく `external-live-gate-unavailable` としてSprint全体は不合格にする。

### スコア

| ID | 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---|---:|---:|---|---|
| C1 | 完成度 | 3/5 | 4 | FAIL | synthetic／localは5/5相当だが、必須の実API受入10〜13が未実施 |
| C2 | 構文・整合 | 5/5 | 5 | PASS | manifest、interval、workflow、runtime、実行時刻境界が一致 |
| C3 | 機能の実証 | 3/5 | 4 | FAIL | 境界・差分・失敗分岐は実証済み。実OAuth／API／Actionsは未実施 |
| C4 | 非エンジニア体験 | 5/5 | 4 | PASS | 3時間推奨、設定対象、同意、失敗案内、現在値が明確 |
| C5 | 安全・規律 | 4/5 | 5 | FAIL | localの同意・commit・秘密境界は成立。live secret非露出と後始末は未評価 |
| C6 | 無回帰 | 5/5 | 5 | PASS | 専用・敵対的・wrapper・全offlineが0 FAIL。公開remoteも独立read-only検査で整合 |
| C7 | やさしさ | 5/5 | 4 | PASS | 保存範囲、共同編集者への可視性、差分範囲外の正常仕様を平易に表示 |
| C8 | wizard体験・デザイン | 5/5 | 4 | PASS | UI asset差分0。既存browser証跡のサービス名、指定色、黒前景、responsive、accessibilityを再確認 |
| C9 | 配布チャネル非依存 | 5/5 | 5 | PASS | public `yasashii-harness` のrepoと5 manifest／overrideをGitHub APIで再確認 |
| C10 | 更新の安全性 | 5/5 | 5 | PASS | Sprint 017／018の診断、migration、rollback回帰を維持 |
| C11 | Google Chat境界 | 4/5 | 5 | FAIL | syntheticのOAuth／SPACE／秘密／run境界は成立。実APIとlive後始末は未評価 |

### 実行コマンドと結果

- `node docs/evidence/sprint-020/evaluator-retry1/run-time-boundary-check.mjs`
  - PASS。`createdAt` 欠落runは不採用、`pulls=1`、`success-confirmed`／`pull-after-sync`なし。
- `node docs/evidence/sprint-020/evaluator/adversarial-check.mjs`
  - `ADVERSARIAL_FAIL=0`。
- `node scripts/sprint-020-adversarial-test.mjs`
  - `SPRINT020_ADVERSARIAL_PASS=13 SPRINT020_ADVERSARIAL_FAIL=0`。
  - 時刻欠落、不正、dispatch前の3経路を不採用。反映遅延後の有効時刻runだけを採用。
- `node scripts/sprint-020-google-chat-test.mjs`
  - `SPRINT020_PASS=45 SPRINT020_FAIL=0`。
- `bash scripts/sprint-020-regression.sh`
  - `SPRINT020_WRAPPER_PASS=16 SPRINT020_WRAPPER_FAIL=0`。
- `bash scripts/regression-check.sh --offline`
  - 通常sandboxではloopback bindが `EPERM` となるため環境制約として分離し、localhost許可環境で再実行。`PASS=314 FAIL=0`。
- `bash scripts/regression-check.sh --online`
  - sandbox実行ではlocalhost bindとGitHub APIが制限され `UNVERIFIED`。同じlocal部分は上記offline 314件で0 FAIL、online固有部分は次のread-only GitHub API検査へ分離した。
- `gh api` による公開remoteの独立read-only検査
  - `mtaiseeei/yasashii-harness`: public、`fork=false`、既定branch `main`。
  - Claude marketplace、Claude plugin、Codex marketplace、Codex plugin、`gentle-overlay/metadata-overrides.json` の5件はすべて期待するname／repository／source／overrideと一致。
- `git diff --quiet afbe000..e7efb5f -- .../google-chat/assets .../chatwork/assets`
  - exit 0。Retry 2のUI asset変更0件。
- `git diff --check`
  - PASS。

### workflow run境界の独立確認

| 経路 | 判定 | 観測結果 |
|---|---|---|
| dispatch後の新規ID、`createdAt`欠落 | PASS | watchせずtimeout。後続pull／再検索0件 |
| dispatch後の新規ID、不正時刻 | PASS | watchせずtimeout。後続pull／再検索0件 |
| baseline外の新規ID、dispatch前時刻 | PASS | watchせずtimeout。後続pull／再検索0件 |
| list反映遅延後、dispatch時刻以後の有効時刻 | PASS | そのrunだけをwatchし、成功後だけpull／同条件再検索 |
| 過去の成功runだけ | PASS | 今回runの代用にせずtimeout。後続pull／再検索0件 |

### 初回評価3件の維持確認

1. **管理path限定commit — PASS**: 設定commitとbare remoteにGoogle Chat管理pathだけが含まれ、利用者の既存staged／unstaged／untracked状態は保持された。
2. **今回dispatchしたrunだけの追跡 — PASS**: baseline ID集合とdispatch秒境界の両方を満たすrunだけを採用した。
3. **403根拠別分類 — PASS**: API無効、scope不足、管理者policy、未知403を別codeへ分類し、未知理由を断定しない。

### running wizard証跡との整合

Retry 2はUI assetを変更していない。`docs/evidence/sprint-020/evaluator-retry1/browser-evidence.json` とdesktop画像を再確認し、次を維持している。

- 可視テキスト／accessible nameは「Google Chatの設定」。
- primary CTAは `rgb(17, 187, 98)`（`#11BB62`）、前景は `rgb(0, 0, 0)`、旧青色0件。
- 3時間がcheckedで「3時間ごと（おすすめ・初期値）」を表示。Chatworkとの共通推奨説明もある。
- desktop／mobile／200%相当で横overflow 0、button 44px以上、labelあり、browser error 0。
- 確認前のCTAはdisabledで、結果画面は変更後の現在値を表示する。

### 受入基準14項目

| # | 判定 | 評価 |
|---:|---|---|
| 1 | PASS | 両サービス3時間推奨・初期値、全間隔、毎時0分回避、manual schedule 0件 |
| 2 | PASS | 同意前0変更。commit／remoteは管理対象pathだけで、既存Git状態を保持 |
| 3 | PASS | 新規、thread、取得範囲内編集・削除、範囲外古い変更、同日再実行、解除後履歴保持 |
| 4 | PASS | space別cursor、部分失敗、回復、全成功誤報0件 |
| 5 | PASS | 確定前0変更、確定後の現在値、解除space履歴保持 |
| 6 | PASS | not found拒否はdispatch／commit／push 0件。存在しないと断定しない |
| 7 | PASS | baseline外かつdispatch時刻以後の有効runだけを追跡。時刻不明／不正／古いrunでは後続pull／再検索0件 |
| 8 | PASS | API無効、scope不足、管理者block、未知403を区別し、未知を断定しない |
| 9 | PASS | UI asset差分0。既存browser証跡のdesktop／mobile／200%相当、指定色、3時間、同意、現在値を維持 |
| 10 | 未実施 | `external-live-gate-unavailable`。実OAuth／discovery／初回取得の個別許可とtest資源なし |
| 11 | 未実施 | `external-live-gate-unavailable`。実Actions／commit／push／pull／search／冪等再実行なし |
| 12 | 未実施 | `external-live-gate-unavailable`。live Action log／remote／screenshot横断検査なし |
| 13 | 未実施 | `external-live-gate-unavailable`。schedule停止／Secret削除／space解除／grant revokeなし |
| 14 | PASS | 全offline 314件、専用・敵対的・wrapperが0 FAIL。online固有remote 6面もread-only APIで一致 |

### バグ一覧

synthetic／local implementation issueは0件。

### external live gate開始前に必要なユーザーの明示許可

次の各操作は一括で推定せず、ユーザーが対象を理解して明示許可した場合だけ実行する。

1. 専用private test workspaceの作成または利用。
2. 組織所有Google Cloud test projectのDesktop OAuth clientを使う実OAuth認証。
3. private test workspaceへのRepository Secret 3件（`GOOGLE_OAUTH_CLIENT_ID`、`GOOGLE_OAUTH_CLIENT_SECRET`、`GOOGLE_OAUTH_REFRESH_TOKEN_GCHAT`）の登録。
4. 非機密test spaceのdiscovery、選択、初回取得。
5. Google Chat同期workflowのdispatchと完了待ち。
6. 設定・runtime・workflow・取得結果のcommit／remote push、完了後のpull／伏せ字search。
7. 同条件での再実行と、message重複0件の確認。
8. 評価後のschedule停止、Repository Secret 3件削除、test space選択解除、Google OAuth grant／token revoke。

履歴またはprivate test workspace自体の削除はこの許可に含めず、対象と影響を示した別の明示確認後だけ行う。

### 必要な非機密test資源

- 組織所有のGoogle Cloud test project。
- OAuth Audience `Internal` のDesktop app client。
- Google Chat APIとPeople APIの有効化。
- `SPACE`型の非機密test space。
- pull後検索と冪等性確認に使える非機密test message。
- 実利用と同じsingle-repo構成の専用private test workspace。

### 秘密・公開境界

- 実Google Cloud、実OAuth、実Google Chat API、実Repository Secret、実GitHub Actions、実remote pushは0件。
- public配布repoの利用者用Google Chat Secret、workflow、config、state、historyは0件。
- Retry 2のコマンド出力、feedback、既存browser証跡にはOAuth値、認可URL／callback URL、実space名、実本文、実発言者名、実添付名を含めていない。

---

## Retry 3 — 実API live gate 独立評価

**判定:** 不合格

**分類:** `implementation-issue`

**評価対象commit:** `7758fbc`

受入基準10〜12は、明示許可された組織所有test環境と専用private test workspaceで成立した。OAuth接続、通常スペース候補の取得、専用test space 1件の初回取得、3時間設定、2回の実workflow、commit／push／pull、伏せ字検索found、同条件再実行の重複0件を独立に確認した。Actionsログ、public配布repo、Evaluator証跡へのlive値・OAuth値の混入も0件だった。

一方、受入基準13の最後に必要な「test space選択解除」を、配布版と同じwizardで完了できない。選択を0件にすると次へ進むCTAがdisabledになり、内部の `POST /api/settings` も `space-required` で拒否する。実live後始末ではschedule停止とRepository Secret 3件削除までは完了したが、選択は1件のままである。履歴とprivate workspaceは削除していない。

これは外部環境の準備不足ではなく、必要な後始末を製品の正規導線が拒否する実装欠陥である。最終PASSにはせず、0件選択を「今後の取得をすべて停止し、既存履歴は残す」有効な設定として扱えるようGeneratorへ差し戻す。

### スコア

| ID | 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---|---:|---:|---|---|
| C1 | 完成度 | 3/5 | 4 | FAIL | 実接続・Actions・検索は成立したが、必須のlive後始末を正規導線で完了できない |
| C2 | 構文・整合 | 5/5 | 5 | PASS | manifest、間隔、workflow、private repo、実remoteが整合 |
| C3 | 機能の実証 | 5/5 | 4 | PASS | 初回取得、2回の実workflow、検索found、冪等性、部分失敗等を実物と回帰で確認 |
| C4 | 非エンジニア体験 | 4/5 | 4 | PASS | 接続・設定説明は迷いにくいが、全選択解除後に進めない欠陥がある |
| C5 | 安全・規律 | 4/5 | 5 | FAIL | schedule停止とSecret削除は成立。選択解除を完了できず、live後始末が未完了 |
| C6 | 無回帰 | 4/5 | 5 | FAIL | offline 314件／online 315件は0 FAILだが、必須の全選択解除を回帰suiteが検出していない |
| C7 | やさしさ | 5/5 | 4 | PASS | 保存範囲、共同編集者への可視性、Actions、commit・push、現在値を平易に表示 |
| C8 | wizard体験・デザイン | 5/5 | 4 | PASS | desktop／mobile／200%相当、指定色、黒前景、同意前disabled、browser error 0 |
| C9 | 配布チャネル非依存 | 5/5 | 5 | PASS | public配布面・online参照導線・維持項目が全回帰で成立 |
| C10 | 更新の安全性 | 5/5 | 5 | PASS | Sprint 017／018の診断・更新・rollback回帰を維持 |
| C11 | Google Chat境界 | 4/5 | 5 | FAIL | 実OAuth、read-only、SPACE限定、secret非露出は成立。選択解除だけ未完了 |

### 実API・Actions・Git・検索の独立証跡

- private test workspaceは `PRIVATE`、既定branchは `main`。live取得完了時のlocal HEADとupstreamは `3c06083` で一致した。
- 実行前はGoogle Chat用Repository Secret名3件が存在した。値は取得していない。
- workflow run `29612407301` と `29612495601` は、どちらも `workflow_dispatch`、`completed`、`success`。それぞれ今回の設定／取得commitをheadにしていた。
- private workspaceのlive状態は3時間、schedule有効、自動push同意済み、選択1件。履歴file 1件、伏せ字本文の完全一致出現1件、保存済み検索 `found` 1件、stateは `success`、成功1／失敗0／cursor 1だった。
- 2つのActionsログを、値を表示しない `docs/evidence/sprint-020/evaluator-live-gate/scan-action-log.mjs` へ直接渡した。実対象resource／表示名／本文／発言者、Google client ID／secret形式、access／refresh token形式、認可URL／callback codeはすべてhit 0。
- public配布repoのtracked 288件を `scan-public-repo.mjs` で検査し、実live値の完全一致hit 0。root直下の利用者用Google Chat設定／state／history／workflowも0件。

### 配布版wizardの機能・UX証跡

実live画面はactual space名を含むため撮影せず、配布版と同じ `wizard-server.mjs` を非機密fixtureで `http://127.0.0.1:18773/` に起動して実操作した。

- 全画面に「Google Chatの設定」を可視表示し、regionのaccessible nameにも保持。
- 1h／3h／6h／12h／manualの5値を表示し、3hがchecked。「ChatworkとGoogle Chatは、どちらも3時間ごとがおすすめ・初期値」と説明。
- primary CTAは背景 `rgb(17, 187, 98)`（`#11BB62`）、前景 `rgb(0, 0, 0)`、高さ48px。
- 確認画面は対象、間隔、保存内容、同じ非公開repo、共同編集者への可視性、GitHub Actions、commit・push、古い編集・削除の範囲を表示。
- 2つの同意前は確定CTA disabled、両方同意後だけenabled。結果画面は「現在の対象／現在の間隔／自動実行／直近の取得」を現在値として表示。
- desktop 1440×900、mobile 390×844、200%相当720×450で横overflow 0、button 44px以上、サービス名維持。browser error 0。
- 画像: `wizard-confirm-desktop.png`、`wizard-confirm-mobile.png`、`wizard-confirm-zoom200.png`、`wizard-result-desktop.png`（すべて同directoryのsynthetic証跡）。

### 回帰結果

- `bash scripts/sprint-020-regression.sh` → 本体 `45/45`、敵対的 `13/13`、wrapper `16/16`、FAIL 0。
- `bash scripts/regression-check.sh --offline` → `PASS=314 FAIL=0`。
- `bash scripts/regression-check.sh --online` → `PASS=315 FAIL=0`。public `yasashii-harness` のremote／manifest検査もPASS。

### live後始末の独立再現

- 実private workspaceは後始末途中のcommit `4ea42a7` でlocal HEADとupstreamが一致。
- intervalはmanual、scheduleは無効、自動push同意false。Repository Secret名は0件。選択は1件残存。
- synthetic running wizardで「選択をすべて外す」を押すと「選択中: 0スペース」になるが、「間隔を確認する」はdisabled。
- 同じserverへ空の `selectedSpaceNames`、manual、commit同意済みで `POST /api/settings` するとHTTP 400、`space-required`。設定は変更されない。
- 画像: `docs/evidence/sprint-020/evaluator-live-gate/cleanup-empty-selection-blocked.png`。
- Google OAuth grant／token revokeは、選択解除修正後に受入13全体として再確認する。履歴・private workspaceは削除していない。

### バグ一覧

| # | 重要度 | 内容 | 再現手順／該当箇所 |
|---:|---|---|---|
| 1 | Major | 全スペースの選択解除を正規wizardで保存できず、live後始末を完了できない | 設定変更step 1で「選択をすべて外す」→次へdisabled。空配列の `/api/settings` も `config-transaction.mjs` の `space-required` で拒否 |

### Generatorへの修正指示

1. 既存接続の設定変更では、選択0件を有効にする。これは「今後の全space取得を停止し、既存履歴を保持する」設定であり、初回接続の0件拒否とは分ける。
2. 0件選択時はscheduleを必ず無効にし、選択、config、workflow、commit／pushを1 transactionで整合させる。既存履歴は削除しない。
3. wizardのstep 1から0件でも次へ進め、確認画面で「対象なし」「自動取得は停止」「既存履歴は保持」を明示する。必要な同意条件をmanual／停止状態に合わせる。
4. 専用回帰へ、全選択解除→manual／schedule 0→commit／push→再読込後も0件→履歴保持、空配列API受理、初回接続だけ0件拒否、再選択で復帰、を追加する。
5. 修正後、同じprivate test workspaceで選択0件、schedule停止、Secret 0件、grant／token revoke、履歴／workspace保持を独立Evaluatorが再確認する。

### 秘密・公開境界

- Retry 3のfeedback、Evaluator scripts、synthetic画像には、OAuth値、認可URL／callback、actual space resource／表示名、actual本文、actual発言者、actual添付名を含めていない。
- 実Actionsログ全文は保存・転記していない。安全なscannerのhit件数だけを記録した。
- public配布repoの利用者用Google Chat live資産は0件。private履歴とworkspaceは削除していない。

---

## Retry 3 修正後再評価 — OAuth解除待ち

**判定:** 不合格（残条件1件）

**分類:** `external-live-cleanup-pending`

**評価対象commit:** `21f5168`

Generatorの2段階修正により、全選択解除の保存と、Repository Secretsを先に削除した場合の停止保存が成立した。配布版と同じ実live wizardで、対象0件、手動のみ、明示同意、保存、commit、pushを完了し、Evaluatorがprivate test workspaceを読み取り専用で再確認した。

実live状態は、選択0件、manual、schedule無効、自動push同意false、Repository Secret 0件で整合している。local HEADとupstreamは一致し、worktreeはcleanである。履歴Markdown 1件、message marker 1件、state 1件は保持され、停止処理による履歴削除はなかった。

実装・回帰・live停止状態には、現時点でimplementation issueを認めない。ただし受入基準13はGoogle OAuth grant／token revokeまでを必須としており、これはユーザー確認待ちで未実施である。この1件が完了するまでSprint全体をPASSにはしない。

### 修正後スコア

| ID | 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---|---:|---:|---|---|
| C1 | 完成度 | 4/5 | 4 | PASS | 製品機能とlive停止は完了。OAuth解除だけ外部確認待ち |
| C2 | 構文・整合 | 5/5 | 5 | PASS | 0件、manual、schedule無効、同意false、remoteが一致 |
| C3 | 機能の実証 | 5/5 | 4 | PASS | 実OAuth、初回取得、2回のActions、検索、冪等性、停止を実証 |
| C4 | 非エンジニア体験 | 5/5 | 4 | PASS | 0件＋manualへ実UIで進め、対象なし・停止・履歴保持を確認 |
| C5 | 安全・規律 | 4/5 | 5 | FAIL | Secret削除、schedule停止、秘密非露出は成立。OAuth解除が未完了 |
| C6 | 無回帰 | 5/5 | 5 | PASS | 専用50、敵対的16、wrapper16、offline 314、online 315が0 FAIL |
| C7 | やさしさ | 5/5 | 4 | PASS | 停止結果と履歴保持が平易に表示される |
| C8 | wizard体験・デザイン | 5/5 | 4 | PASS | 既存browser証跡に加え、0件＋manualの実操作が成立 |
| C9 | 配布チャネル非依存 | 5/5 | 5 | PASS | 公開repoのlive資産0件、全体online回帰PASS |
| C10 | 更新の安全性 | 5/5 | 5 | PASS | Sprint 017／018回帰を維持 |
| C11 | Google Chat境界 | 4/5 | 5 | FAIL | read-only、SPACE限定、停止、Secret削除は成立。OAuth解除待ち |

### 追加修正の独立回帰

- `bash scripts/sprint-020-regression.sh`
  - Sprint 020本体 `50/50`、敵対的 `16/16`、wrapper `16/16`、FAIL 0。
  - Secret 0件でも対象0件＋manualをcommit／pushできる。
  - 対象が残るmanualまたは自動取得は、従来どおりSecret 3件がなければ変更0件で拒否する。
- clean cloneで `bash scripts/regression-check.sh --offline`
  - 初回sandbox実行はloopback bindの `EPERM` だったため製品失敗と分離し、localhost許可環境で再実行。`PASS=314 FAIL=0`。
- clean cloneで `bash scripts/regression-check.sh --online`
  - `PASS=315 FAIL=0`。
- `git diff --check`
  - PASS。

### live停止状態の独立確認

| 項目 | 結果 |
|---|---|
| private test repository | privateのまま |
| local／upstream | 同一commit、worktree clean |
| 選択対象 | config上0件 |
| 間隔 | manual |
| schedule | config false、workflow schedule 0件 |
| 自動push同意 | false |
| Repository Secret | 名前一覧0件。値は取得していない |
| 履歴 | Markdown 1件、message marker 1件を保持 |
| state | 1件を保持 |
| OAuth grant／token | 未解除。ユーザー確認待ち |

非機密の集計証跡は `docs/evidence/sprint-020/evaluator-live-gate/fix2-live-cleanup-summary.json` に保存した。actual space名、resource、本文、発言者、添付名、OAuth値は含めていない。

### 漏えい再検査

- public配布repoのtracked 297件: live／OAuth保護値の完全一致hit 0、root live資産0件。
- Sprint 020 feedback／evidence 34件: actual本文、発言者、message resource、OAuth client値の完全一致hit 0。
- OAuth値、認可URL／callback、actual space名、actual本文、actual発言者、actual添付名は、feedback、画像、JSONへ記録していない。

### 最終PASSに必要な残作業

1. ユーザーの明示確認後、test用Google OAuth grant／tokenをrevokeする。
2. revokeの成功を、秘密値を記録しない形でEvaluatorが確認する。
3. 受入基準13、C5、C11をPASSへ更新し、最終判定を記録する。

履歴とprivate test workspaceの削除は受入条件に含めず、実施しない。

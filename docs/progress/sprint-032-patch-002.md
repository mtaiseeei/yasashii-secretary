# Sprint 032 Patch 002 — 会話改善の完成、実会話回帰の安全化、4環境対応の土台

**ステータス:** 実装完了 - 評価待ち

## スプリント契約（着手時の宣言）

- 何を作るか: PR #2（commit `6605b98`）の会話可読性修正を本Patchの一部として引き継ぎ、
  (1) 実会話runnerの安全化（env allowlist・Bashなし・workspace内境界・cleanup・サニタイズ証跡）、
  (2) 完了報告テストの誤合格解消（固定3項目の存在と順序の必須化＋negative fixture）、
  (3) wizard進捗の一貫性（後戻り0・欠番0・progress強調一致）、
  (4) yasashii onboardingのGitHub用語初出説明、(5) serializer正本参照の解決、
  (6) yasashiiユーザー向け `room` → `ルーム`、(7) 会話・テスト層のホスト非依存化と
  対応対象／検証済みホストの別集計、を完成させる。
- 成功の検証: 専用回帰（新規 `sprint-032-patch-002-test.mjs` 24件）、readability回帰28件、
  Sprint 029〜032回帰、offline master gate、Gitなしarchive gate、実会話smoke（安全条件下）が
  0 FAILで、未検証ホストがunverifiedとして別集計されること。

## 実装内容

### 1. 実会話runnerの安全化（`scripts/sprint-032-patch-001-conversation-smoke.mjs` 全面改修）

- 子プロセスenvを**allowlist方式**へ変更。`process.env` 全体の複製を廃止し、明示列挙した
  変数だけを渡す（名前は下記）。`GITHUB_TOKEN`／`GH_TOKEN`／`CHATWORK_API_TOKEN`／
  `GOOGLE_OAUTH_CLIENT_SECRET`／`ANTHROPIC_API_KEY` 等の合成credentialを親環境へ注入しても
  子envへ渡らないことをテストで固定した。
- **Bash・WebFetch・WebSearchを全scenarioで不許可**にし、読むだけのscenarioはWrite/Editも
  渡さない最小ツール許可へ変更。scenarioごとの許可ツール一覧を証跡JSONへ記録する。
- 保存不能テストの対象を `/System/...` から**一時workspace内の管理対象fixture**
  （`locked/` を `chmod 0555` した読み取り専用ディレクトリ）へ変更。promptから
  workspace外の絶対pathを排除した。
- 子プロセスは cwd=一時workspace、TMPDIR=workspace内 `.tmp` で起動する。
- 成功・失敗を問わず `try/finally` で一時workspaceを削除する（`locked/` は削除前に
  権限を戻す）。
- 実行前後で**workspace外の管理対象が無変更**であることをrunner自身が検査する
  （plugin dirの全fileハッシュ一覧と、workspace外に置いたguard sentinelの前後比較。
  結果は `OUTSIDE_WORKSPACE_CHECK` として出力・証跡化）。
- 証跡は**サニタイズ済み構造化JSON**のみ（workspace／guard／evidence pathの置換、
  home pathの `<home>` 化、`/private/tmp/...` の `<tmp-path>` 化、token様文字列のredact）。
- 安全な実行環境を用意できない場合は **unverified（exit 2）** としてPASS／FAILと別集計する。
  CLI不在に加え、「子セッションが未認証」（資格情報を渡さない契約のため認証できない）も
  unverifiedへ分類する。判定は `Not logged in` の明示メッセージだけに限定し、
  実際の会話品質FAILをunverifiedへ逃がさない。

### 2. 完了報告テストの誤合格解消

- 共通validator（`scripts/lib/sprint-032-patch-001-conversation.mjs`）の
  `validateScenario("completion-report", ...)` に `fixed === true`（固定3項目schemaの使用）を
  必須条件として追加。存在・順序・許可ラベル・物理分離・非圧縮と合わせて検査する。
- 層C（実会話smoke）の完了報告判定を層B共通契約 `validateScenario("completion-report", ...)`
  へ**統一**（緩和なし）。一般scenarioは実セッションのゆらぎを考慮して層Bの細部
  （nested数等）を要求しない緩和を残すが、固定3項目の不強制・非圧縮・構造化は必須のまま。
  緩和内容はrunner内コメントに明記した。
- negative fixtureを追加し、readability testで検出されることを固定:
  - `scripts/fixtures/sprint-032-patch-001/conversations/completion-report.unlabeled.bad.md`
    （固定ラベルなしの任意3項目 → `usesFixedThreeSchema` が false で不合格）
  - `scripts/fixtures/sprint-032-patch-001/conversations/completion-report.out-of-order.bad.md`
    （ラベル順序違い → 順序検査で不合格）
- 一般回答に固定3項目を要求しないこと、圧縮された一般回答が不合格のままであることも
  checkとして追加した。

### 3. wizard進捗の一貫性（表示文字列とprogress呼び出しのみ変更）

- Chatwork（`plugins/secretary/skills/chatwork/assets/wizard/app.js`）:
  設定フェーズの eyebrow を `STEP N / 4` → **`設定 N / 4`** へ変更し、接続フェーズ
  （`接続 1〜4 / 4`）と別系列であることをフェーズ名で明示。保存中画面（設定 4 / 4）に
  progress(4) を追加し、本文番号とprogress強調の不一致を解消。
- Google Chat（`plugins/secretary/skills/google-chat/assets/wizard/app.js`）:
  接続フェーズを実画面数に合わせ **`接続 1〜3 / 3`** へ再採番（旧 `接続 3 / 4` の欠番を解消）。
  discover系3画面の progress(1) を progress(0)（=「接続」強調）へ修正し、
  設定フェーズは `設定 N / 4`、既存の `設定変更 N / 3` はそのまま。
- DOM骨格・screen id・flow・認証方式・OAuth scope・Secret名・同期処理・CTA色
  （`#F03747`／`#11BB62`）は不変。`sprint-027-copy-test.mjs` のscreen inventoryは
  screen id基準のため期待値変更は不要で、66/66 PASSのまま。
- 進捗後戻り検出の回帰を追加（`checkWizardProgress`）: フェーズ名のない汎用系列
  （STEP等）の拒否、系列内の欠番検出、分母不一致検出、progress()強調と本文番号の
  一致検査。負fixture 3種（generic-step／gap／mismatch）付き。
- `scripts/fixtures/sprint-029/yasashii-copy-baseline.json` のwizard digest 2件を
  実態へ更新（wizard文言変更はこのPatch契約の明示スコープ。安全案内・copy境界の
  検査自体は不変で、sprint-029回帰は25/25 PASS）。

### 4. GitHub用語の初出説明（`plugins/secretary/skills/onboarding/SKILL.md`）

- 初出の「private GitHub repo」へ「GitHub上で、自分や許可した人だけが見られる非公開の保存場所」、
  「push」へ「手元の変更をGitHubへ送る操作」の1文補足を追加。正式名称は維持。
- yasashii固有説明がagentic表現面（`rules/common-language.md`・`safety.md`・`evidence.md`・
  `docs/spec/editions.md`）へ漏れていないことを検査するassertを追加。

### 5. serializer正本の参照解決

- `rules/plain-language.md` を「正本を複製しない明示的な入口（shim）」と自己宣言させ、
  serializer schemaを所有しないことを明文化（正本は `rules/styles/yasashii.md`）。
- skills／templates／tonesの「`plain-language.md` の／にある『最終応答serializer』」という
  **所在誤記**を「`plain-language.md` から解決される」「同rule入口から解決される」へ統一
  （20 user-facing surface全て）。`check-report-schema.py` の必須文字列
  （`plain-language.md`＋`最終応答serializer`、surfaces=20）とは両立し、SCHEMA_OK を維持。
- 参照切れ検出テストを追加（`checkSerializerReferences`）: 不在rule file参照と所在誤記を
  検出。負fixture（`serializer-missing-rule.md`／`serializer-mislocated.md`）付き。
  shim内のMarkdown link先が実在することも検査。

### 6. room表記（ユーザー向け自然言語のみ、機械的全置換なし）

- `skills/secretary/SKILL.md`: 「roomを選びたい」→「ルームを選びたい」、
  「room設定」→「ルーム設定」。
- `skills/onboarding/SKILL.md`: 「選択したroom」→「選択したルーム」、「room接続」→「ルーム接続」。
- API正式名・コード識別子・設定key・fixture名（`rooms.json`、`--room`、`roomId`、
  `selectedRoomIds` 等）は不変。inline code・fenced codeを除外した残存scanを回帰へ追加。

### 7. ホスト非依存化と別集計

- 新設 `scripts/lib/sprint-032-patch-002-hosts.mjs`:
  正式対象4ホスト（`claude-code-desktop-app`／`claude-code-cli`／`codex-app`／`codex-cli`）の
  宣言、runner登録欄（未実装ホストは `runner: null` のまま。推測実装しない）、
  `summarizeHostVerification()` による**対応対象と検証済みの別集計**
  （record無しホストは常にunverified、実行済みはpass/failのみ、重複・未知ホスト・
  不正statusは例外）。`allHostsVerified` は4ホスト個別PASSのときだけtrue。
- 実会話runnerをClaude Code CLI専用のhost adapterと明示し（`HOST_ID`／`RUNNER_ID`／
  `EXECUTION_SURFACE`）、証跡の全recordへhost・runner・実行面を記録。
  `host-verification.json` を証跡へ出力する。
- 共通validator（層B）と会話fixtureにClaude固有形式・command（`/secretary `、
  `--plugin-dir`、`claude` 起動等）の前提が0件であることを回帰で固定。
  共通rules（common-language／safety／evidence）へのClaude CLI呼び出し混入も検査。
- 1ホストPASSの全ホスト昇格が起きないことのnegative testを追加。

### 8. テスト環境の移植性修正（スコープ内のtest infrastructure）

- `scripts/sprint-013-regression.sh` が特定ホスト付属の `apply_patch` コマンドへ依存し、
  本環境（Claude Code CLI実行面）で fake-gh／負fixtureを生成できず3件FAILしていた。
  POSIX標準のheredocとawkへ置換（**検査内容・期待値は不変**。baseline commitでも
  同一FAILを再現済みで、本Patchの機能変更とは無関係の移植性問題）。
- `plugins/secretary/rules/styles/yasashii.md` の1箇所を「serializerを1回適用する」→
  「serializerを**1回だけ**適用する」へ復元。commit `6605b98` がsprint-011回帰の必須句
  `serializerを1回だけ適用する` を落としており、決定的FAILになっていた
  （6605b98は本Patch契約の一部。テスト側を弱めず正本側を復元した）。

## 主要変更ファイル

- `plugins/secretary/skills/chatwork/assets/wizard/app.js` — 設定フェーズ系列・progress(4)
- `plugins/secretary/skills/google-chat/assets/wizard/app.js` — 接続 /3 再採番・progress修正・設定系列
- `plugins/secretary/skills/onboarding/SKILL.md` — GitHub用語説明・ルーム表記
- `plugins/secretary/skills/secretary/SKILL.md` — ルーム表記・serializer参照
- `plugins/secretary/skills/*/SKILL.md`、`templates/AGENTS.md`／`CLAUDE.md`／`tones/*.md` — serializer参照解決
- `plugins/secretary/rules/plain-language.md` — shim自己宣言
- `plugins/secretary/rules/styles/yasashii.md` — 「1回だけ適用」の復元（1語）
- `scripts/sprint-032-patch-001-conversation-smoke.mjs` — 安全化・host adapter化・unverified分類
- `scripts/lib/sprint-032-patch-001-conversation.mjs` — completion-reportの `fixed` 必須化
- `scripts/lib/sprint-032-patch-002-hosts.mjs` — 新設（4ホスト宣言・別集計）
- `scripts/sprint-032-patch-002-test.mjs`／`sprint-032-patch-002-regression.sh` — 新設（24 checks）
- `scripts/fixtures/sprint-032-patch-002/`（負fixture 5件）、
  `scripts/fixtures/sprint-032-patch-001/conversations/completion-report.{unlabeled,out-of-order}.bad.md` — 新設
- `scripts/sprint-032-patch-001-readability-test.mjs` — negative case 3 check追加（28件へ）
- `scripts/fixtures/sprint-029/yasashii-copy-baseline.json` — wizard digest更新（2 file）
- `scripts/master-release-gate.mjs` — `sprint-032-patch-002-conversation-safety` suiteを
  checkout／archive両方へ追加
- `scripts/sprint-013-regression.sh` — `apply_patch` 依存の除去（移植性のみ）

## 変更しなかった範囲

- `docs/spec/**`、`docs/sprints/**`、`docs/feedback/**`、既存 `docs/evidence/**`、
  LICENSE、CHANGELOG、marketplace、version、migration。
- OAuth scope、Secret名（`CHATWORK_API_TOKEN`）、同期処理、Chatwork／Google Chat認証方式、
  wizardのDOM骨格・screen id・flow・CTA色。
- `key=value` 表現（Sprint 034延期のまま）。sprint-032-patch-001の契約・progress・feedback。
- 会話fixtureの正式名称・機械可読出力・コード識別子のroom表記。
- Chatwork Secret案内（`Name`＝`CHATWORK_API_TOKEN`、`Secret`＝本人取得Token、実値の
  GitHub UI直接入力・非貼付）は無回帰（readability test＋実browserで確認）。

## 自己評価（Evaluatorと同じ6軸。`docs/spec/rubric.md` の基準）

| 基準 | スコア(1-5) | コメント |
|------|------------|---------|
| 機能完全性 | 4 | 契約の主眼1〜8を実装。実会話の会話品質そのものはClaude Code CLI実行面でも未認証のためunverified（安全条件を守った正直な結果） |
| 動作安定性 | 4 | 全自動回帰0 FAIL。環境要因（後述のNode crash）を根本特定し回避条件を明記 |
| デザイン性 | 4 | 進捗を「接続→設定」の明示的な2系列に整理し、実DOMで後戻り0を確認 |
| 独自性 | 3 | フェーズ名つき進捗系列・unverified三値集計は契約要件からの素直な設計 |
| エラーハンドリング | 4 | runnerはCLI不在／未認証／FAILを三値で区別し、cleanupと外部変更0件検査をfinallyで保証 |
| 回帰なし | 5 | offline master gate 10/10 suites・456/456、archive gate 8/8・116/116、Sprint 029〜032・patch-001回帰すべて0 FAIL |

## 技術的な判断

1. 進捗表記は番号リセットを許す代わりに**フェーズ名を系列キー**にした（契約の例示に従い
   eyebrowを「接続 N/M」「設定 N/M」の別系列へ）。進捗barのDOMは不変。
2. unverifiedはPASS／FAILと並ぶ**第三の状態**とし、exit code 2で区別。未認証判定は
   `Not logged in` の明示文字列だけに絞り、品質FAILの逃げ道にしない。
3. workspace外変更0件の検査は「全filesystemの走査」ではなく、子プロセスが到達し得る
   **管理対象面（plugin dir全ハッシュ＋workspace外guard sentinel）の前後比較**で実装。
   到達性自体はcwd固定・最小ツール・acceptEdits境界で制限する。
4. 完了報告は層Bへ完全統一し、一般scenarioだけ層Cで細部を緩和（緩和はコード上に明記）。
5. serializer所在の表現は「〜から解決される」に統一し、shim（plain-language.md）と
   正本（styles/yasashii.md）の関係を複製なしで固定した。

## 既知の問題・環境メモ

1. **実行環境のNode crash**: 本環境は `NODE_USE_SYSTEM_CA=1` が設定されており、
   Node v24.7.0がmacOS Keychainの証明書読込（`ReadMacOSKeychainCertificates` →
   `X509_get_subject_name`）でプロセス終了時に約10〜15%の確率でSIGSEGVする
   （出力は正常完了後にexit 139へ化ける）。**製品不具合ではない**。crash reportで根本特定し、
   検証は `NODE_USE_SYSTEM_CA=0` を付けて実行した（baseline commitでも同一現象を再現済み）。
2. **実会話smokeはunverified**: 本環境のClaude Code CLIは資格情報env経由で動いており、
   allowlist環境の子セッションは `Not logged in` になる。契約どおり資格情報を渡さず、
   全scenarioをunverifiedとして記録した（FAIL=0, UNVERIFIED=5, exit 2）。
   通常のログイン済み端末（credential store認証）では同runnerがそのまま実会話を検証できる。
3. sprint-024等の一部動的テストはfake CLI起動に120ms級の時間予算を使っており、
   高負荷時にはNode起動遅延で不安定になり得る（今回は1.の回避後、全suite 0 FAILで通過）。

## 起動方法・確認方法

- リポジトリ自体の常駐プロセスはない（会話rule・wizard・テスト層のPatch）。
- Chatwork wizardローカル確認: `TMPDIR=/private/tmp bash scripts/start-sprint-013-wizard-fixture.sh 18765`
  → `http://127.0.0.1:18765/`
- Google Chat wizardローカル確認: `TMPDIR=/private/tmp node scripts/start-sprint-020-patch-001-google-chat-fixture.mjs 18783`
  → `http://127.0.0.1:18783/`
- 実DOMでの進捗確認（今回の実測記録）: Chatworkは
  `接続 1/4 → 2/4 → 3/4 → 4/4`（progress強調は常に「接続」）→
  `設定 1/4（1 ルーム）→ 2/4（2 自動取得の間隔）→ 3/4（3 確認）` で後戻り0。
  Google Chat初期画面は `接続 1 / 3`＋「接続」強調。

## テストコマンド（実行結果つき。環境条件: `NODE_USE_SYSTEM_CA=0 TMPDIR=/private/tmp`）

| 検査 | コマンド | 結果 |
|---|---|---:|
| Patch専用 | `node scripts/sprint-032-patch-002-test.mjs` | 24 PASS / 0 FAIL |
| Patch専用wrapper | `bash scripts/sprint-032-patch-002-regression.sh` | 7 PASS / 0 FAIL |
| 会話可読性（negative含む） | `node scripts/sprint-032-patch-001-readability-test.mjs` | 28 PASS / 0 FAIL / 32 surfaces |
| Patch 001回帰 | `bash scripts/sprint-032-patch-001-regression.sh` | 7 PASS / 0 FAIL |
| schema唯一owner | `python3 scripts/check-report-schema.py --plugin-root plugins/secretary` | SCHEMA_OK surfaces=20 |
| Sprint 027 copy | `node scripts/sprint-027-copy-test.mjs` | 66 PASS / 0 FAIL |
| Sprint 029 | `node scripts/sprint-029-rule-boundary-test.mjs` | 25 PASS / 0 FAIL |
| Sprint 030 | `node scripts/sprint-030-edition-guard-test.mjs` | 54 PASS / 0 FAIL |
| Sprint 013（移植性修正後） | `bash scripts/sprint-013-regression.sh` | 35+33 PASS / 0 FAIL |
| **master regression** | `node scripts/master-release-gate.mjs --mode offline --root <repo root> --timeout-ms 600000` | pass 10/10 suites, 456/456 |
| **archive相当回帰** | `node scripts/master-release-gate.mjs --mode archive --root <candidate> --timeout-ms 600000` | pass 8/8 required, 116/116 |
| **実会話smoke** | `node scripts/sprint-032-patch-001-conversation-smoke.mjs` | FAIL=0 / UNVERIFIED=5（exit 2） |
| Chatwork実browser | `node scripts/sprint-032-patch-001-chatwork-browser.mjs --cdp http://127.0.0.1:29331 --chatwork-url http://127.0.0.1:18765/` | 3 PASS / 0 FAIL（desktop/mobile/200%） |

Gitなしarchive candidate: `/private/tmp` 配下へ `.git`・`docs/evidence`・`.DS_Store`・
`.harness/config.local.*`・`.env*`・`*.pem`・`*.key` を除外してrsyncで固定。
file数 368、bytes合計 3,777,541、一覧SHA-256
`d9eddeb39e1c8d73c6dd9eb8905c6b905ce701d5ac9d9f2d8d3a88d0b30316e7`。

## 実会話runnerの安全条件（証跡にも同内容を記録）

- 子プロセスへ渡す環境変数名（**値は渡された場合のみ親から複製。ここに値は書かない**）:
  `PATH`、`HOME`、`SHELL`、`TERM`、`LANG`、`LC_ALL`、`LC_CTYPE`。
  `TMPDIR` のみ一時workspace内 `.tmp` の値で毎回上書き。これ以外は一切渡さない。
- 許可したツール:
  - complex-question／diagnosis／search-results: `Read,Glob,Grep,LS,Skill,TodoWrite`
  - partial-failure／completion-report: 上記＋`Write,Edit`
  - `Bash`・`WebFetch`・`WebSearch` は全scenario不許可。permission modeは `acceptEdits`。
- 一時workspaceの範囲: `TMPDIR`（既定 `/private/tmp`）配下の `yasashii-smoke-*`。
  合成データのみをseedし、境界fixtureはworkspace内 `locked/`（chmod 0555）。
  guard sentinelは `yasashii-smoke-guard-*`、証跡は `sprint-032-patch-002-smoke-evidence-*`。
- cleanup方法: scenarioごとに `try/finally` で `locked/` の権限復帰 → workspaceを
  `rmSync(recursive, force)`。guard dirも終了時に削除。証跡dirだけを残す。
- 外部変更0件検査: 実行前後で plugin dir 全fileハッシュとguard sentinelを比較し、
  `OUTSIDE_WORKSPACE_CHECK plugin=unchanged guard=unchanged` を確認（今回の実行で確認済み）。

## Evaluatorへの引き渡し事項

- 回帰チェック（推奨の一括実行）:
  `NODE_USE_SYSTEM_CA=0 TMPDIR=/private/tmp bash scripts/sprint-032-patch-002-regression.sh`
  と、上表のmaster／archive gate。
- 確認すべきnegative case:
  1. `completion-report.unlabeled.bad.md`（ラベルなし3項目）と
     `completion-report.out-of-order.bad.md`（順序違い）がreadability testで不合格になること。
  2. `complex-question.bad.md` 等の圧縮一般回答が不合格のままであること。
  3. `scripts/fixtures/sprint-032-patch-002/wizard-progress-*.js`（汎用STEP系列・欠番・
     progress不一致）が `checkWizardProgress` で検出されること。
  4. `serializer-missing-rule.md`／`serializer-mislocated.md` が参照検査で検出されること。
  5. 合成credentialを親環境へ注入しても `buildChildEnv` の出力へ現れないこと。
  6. `summarizeHostVerification` が1ホストPASSを全ホストへ昇格させないこと
     （unknown host・不正status・重複recordは例外）。
- browser確認: 上記fixture URLでdesktop／mobile（<768px）／200%相当の進捗表示遷移を確認
  （screenshot保存が必要な場合は `docs/evidence/sprint-032-patch-002/` を新設して
  Evaluator所有で保存。既存evidenceは不変）。
- 実会話smoke: ログイン済みClaude Code CLI端末では
  `NODE_USE_SYSTEM_CA=0 TMPDIR=/private/tmp node scripts/sprint-032-patch-001-conversation-smoke.mjs`
  が実検証になる。未認証環境では全scenarioがunverified（exit 2）になることが正しい挙動。

## 各ホストの検証状態（対応対象と検証済みの別集計）

| ホスト | 実行面 | runner | 状態 |
|---|---|---|---|
| Claude Code Desktop App | app | 未実装（Sprint 033） | **unverified** |
| Claude Code CLI | cli | `sprint-032-patch-001-conversation-smoke` | **unverified**（runnerは安全条件下で実行済み。子セッションが本環境で未認証のため、会話内容の実検証は未成立。層A／層Bの静的・契約検査28＋24件は合格） |
| Codex App | app | 未実装（Sprint 033） | **unverified** |
| Codex CLI | cli | 未実装（Sprint 033） | **unverified** |

1ホストのPASSを他ホストへ流用しない。「4環境対応済み」とはどこにも表示していない。

## Sprint 033へ残した事項

- `agentic-secretary` の別directory・別repo作成と4環境への実導入・実manifest対応。
- Claude Code Desktop App／Codex App／Codex CLI用のhost adapter（実会話runner・導入・更新）
  実装と、各ホストでの実環境検証（`hosts.mjs` の `runner: null` を埋める）。
- ログイン済み端末でのClaude Code CLI実会話smokeの実検証（今回はunverified）。
- Codex系のskills読込（`.agents/skills`）とCLI／Appの一致検証（契約でunverified扱いのまま）。

## 外部操作

外部write 0件。commit・push・remote変更・plugin install・Repository Secret・Actions・
OAuth・実API・公開操作は行っていない（commitはOrchestratorが実施する）。
検証に使ったlocal fixture・headless Chrome・一時workspaceは停止・削除済み。

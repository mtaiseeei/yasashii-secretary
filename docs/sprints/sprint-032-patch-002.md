# Sprint 032 Patch 002 — 会話改善の完成、実会話回帰の安全化、4環境対応の土台

## 種別

Patch Sprint

## Type

patch（通常Patch）。変更が実会話runner、共通validator、wizard進捗、serializer正本、
onboarding文言、ホスト非依存構造の複数導線にまたがるため、microの条件を満たさない。

## Base Sprint

sprint-032

## Risk

**high**。理由は次のとおりで、rubricのゼロ許容基準（C5・C6・C12・C13・C14）に直結する。

1. 実会話runnerが子プロセスを起動し、現状は親の `process.env` をほぼそのまま引き継ぐため、
   API Token・GitHub認証・Chatwork Token・Google認証情報等の漏えい経路になり得る。
2. 現状のrunnerは子セッションへ `Bash`・`Write`・`Edit` を含む強い権限を許可し、
   一時workspace外（`/System/...`）を読み取り拒否テストの対象にしている。workspace外アクセスと
   外部副作用のリスクがある。
3. 完了報告テストが固定ラベルなしの任意3行でも合格しうる誤合格状態にあり、放置すると
   「誤合格する回帰テスト」が安全・品質保証を偽装する。
4. 対応対象ホストと検証済みホストの表示を扱うため、未検証環境を「対応済み」と誤表示する
   リスクがある。

## 改訂（2026-07-21 Retry 1: ユーザーレビュー差し戻しの反映）

2026-07-21のユーザーレビューで、初回PASSに対し2件の差し戻しが確定した。本改訂はこの契約だけを
正本として反映する。過去のfeedback・progress・stateの記述は遡って書き換えない（訂正は新しい
記録で行う）。

- **P1（封じ込め不足）**: 初版契約Scope 2-5「cwd固定・許可ツール制限・書込み先の検証で
  一時workspace外へ書き込めない条件を成立させる」は、封じ込めの定義として不十分だった。
  現行runnerは子のcwdとTMPDIRを一時workspaceへ向けるだけで、実HOMEを子へ渡し、Write/Editを許可し、
  `--permission-mode acceptEdits` で動くため、絶対pathや `../` によるworkspace外書き込みと
  HOME内の認証情報・個人ファイル読み取りを技術的に防いでいない。前後比較が証明するのは
  「plugin dirとguard sentinelが変わらなかった」ことだけで、「workspace外への書き込みを禁止した」
  ことの証明にならない。→ Scope 2を改訂（合成HOME・plugin read-only・sandbox／path-scoped
  permission・canary拒否実証・隔離未実証時のWrite/Edit禁止・検査範囲の限定表現）。
- **P2（実会話が回帰に未組み込み）**: `sprint-032-patch-002-regression.sh` はrunnerを
  `node --check` で構文確認するだけで、master release gateも実会話0件のまま通る。
  live scenario 5件は全てunverified（認証できないこと自体は安全条件を守った正しい判断）だが、
  元指摘「自作fixtureではなく実plugin sessionの会話出力を回帰確認する」は未解消であり、
  解消済み・回帰保証としてPASS扱いにしない。→ Scope 7とAcceptance 13を新設
  （live conversation gateの分離、未実行の「未完了（incomplete）」表示、合格条件の改訂）。

## 依存と実施体制

- 依存: sprint-032-patch-001 done。sprint-033（agentic別directory／別repo作成）より前に完了する。
- 既存差分の位置付け: branch `fable/conversation-markdown-review` 上のcommit `6605b98`
  （`git diff codex/sprint-032-patch-001-baseline...HEAD`）にあるFableの会話可読性修正
  （一般回答を固定3項目へ押し込まない層の分離、実会話smoke runner、会話fixture群）は、
  本Patch契約の実装の一部として扱う。遡ってsprint-032-patch-001の契約・progress・feedbackを
  改変しない。
- 実施体制: Fableが実装と独立評価まで行い、同じDraft PR #2を更新する。**マージしない。**
  Sprint 033は本Patchでは開始しない。

## ユーザー決定（確定済み。聞き直さない・変更しない）

- 将来の `agentic-secretary` は技術者向けにそのまま配布できる完成品にする。
- 正式な必須対象環境は4つ: **Claude Code Desktop App / Claude Code CLI / Codex App / Codex CLI**。
- その他のコーディングエージェントは「共通本体を再利用しやすくする設計対象」に含めるが、
  公式受入対象・配布保証・実環境検証必須対象には含めない。
- 共通機能（安全性、wizard、OAuth、同期境界等）は二重実装しない。共通本体はホスト非依存にし、
  manifest・導入・更新・plugin root・実会話runner等のホスト固有部分だけをadapterとして分ける。
  同じ機能を4コピーしない。
- Claude CodeでのPASSを4環境PASSとして扱わない。未検証環境を「対応済み」と表示しない。
  対応対象と検証済みを別集計する。
- PR #2の会話改善を完成させ、必須レビュー指摘2件（実会話runnerの安全性、完了報告テストの誤合格）を修正する。
- wizard進捗の後戻り修正、GitHub用語の初出説明、serializer正本参照の明確化、
  yasashii向け `room` → `ルーム` 統一（機械的全置換は禁止）を本Patchで行う。
- 設定確認の `key=value` 表現改善はSprint 034へ延期する（今回変更しない）。

## 主眼

1. 一般回答を固定3項目へ押し込まない（完了・状態報告だけがyasashii固有の固定3項目）。
2. 実会話回帰を安全かつ誤合格しないものにする。
3. wizard進捗表示の一貫性（後戻りゼロ）。
4. yasashii向けGitHub用語の短い初出説明。
5. serializer正本の明確化と参照切れ解消。
6. yasashii向け `room` 表記整理。
7. 共通会話・テスト層を4環境対応へ拡張可能なホスト非依存構造にする。
8. 対応対象ホストと検証済みホストの区別を正本化する。
9. Sprint 033の4環境対応契約を確定する（実装はしない）。

## Scope

### 1. 一般回答と固定3項目の分離

- yasashiiの固定3項目（`やったこと`／`結果`／`次に何が起きるか`）は、作業完了報告と状態報告
  だけに適用する。一般的な質問への回答、複雑な説明、診断、検索結果、部分失敗の詳細は、
  内容に応じた段落・箇条書きで返し、固定3項目schemaへserializeしない。
- `plugins/secretary/rules/styles/yasashii.md` が「serializerを適用する場面」と「適用しない場面」を
  正本として区別し、テストはこの正本から適用場面を導出する（テスト側で模範文面を持たない）。
- 圧縮された一般回答（複数論点の改行なし平文）は不合格にする。1要点の短い回答は
  1段落のままでよく、過剰なbullet化を要求しない。

### 2. 必須修正1: 実会話runnerの安全性（2026-07-21改訂）

対象: `scripts/sprint-032-patch-001-conversation-smoke.mjs`（および分離後のClaude用runner）。
初版のenv allowlist・最小ツール・workspace内fixture・cleanup・サニタイズは実装済みだが、
ユーザーレビュー（P1）により、cwd／TMPDIRの誘導は**ファイルアクセスの封じ込めではない**ことが
確定した。次を必須にする（1・3〜5・8〜10は既存要件の維持、2・6・7・9は改訂・新設）。

1. 子プロセスenvは**allowlist方式**にする。`process.env` 全体を複製せず、実行に必要な
   最小の変数だけを明示的に列挙して渡す。認証情報・APIキー・GitHub Token・Chatwork Token・
   Google認証情報（`*_TOKEN`、`*_KEY`、`*_SECRET`、`GH_*`／`GITHUB_*` 資格情報、OAuth値等）を
   子プロセスへ渡さない。
2. **合成HOME**: 子プロセスへ実HOMEを渡さない。個人ファイル・認証情報・ユーザーデータを
   含まない合成HOMEディレクトリ（一時領域内にrunnerが作成）を `HOME` として渡し、
   CLI起動に必要な最小の設定ファイルだけを合成HOME内へ明示的に配置する。
   合成HOMEの内容（配置したファイルの一覧）を証跡へ記録する。
3. 原則 `Bash` を許可しない。各scenarioの検証に必要な最小ツールだけを許可し、
   scenarioごとの許可ツール一覧を証跡へ記録する。
4. 読み取り拒否・保存不能のテストは、一時workspace内に作成した管理対象fixture
   （読み取り専用化したファイル／ディレクトリ等）で行う。`/System`、user home、
   その他workspace外の実パスをテスト対象にしない。
5. **plugin本体のread-only参照**: 子セッションが実plugin本体（`plugins/secretary/`）へ
   書き込めない構成にする（read-onlyにしたコピーの参照、または権限による書込み不能化）。
   plugin dirのハッシュ前後比較は補助検査として維持してよいが、「書き込めない」保証は
   事後のハッシュ比較ではなく構成側で成立させる。
6. **書込み先の技術的封じ込め**: OS sandbox、またはホストが保証するpath-scoped permission
   （例: Claude Codeのpermission deny/allowルールによる書込み先限定）で、子セッションの
   書込み先を一時workspaceへ限定する。cwd・TMPDIRの誘導、許可ツールの絞り込み、
   `acceptEdits` の組合せだけを封じ込めの根拠にしない。
7. **canary検査**: 実行のたびに、runnerが用意した**制御されたworkspace外ファイル**への
   書き込みを実際に試み、sandbox／permissionによって**拒否されたこと**を確認して証跡へ
   記録する。canary拒否を実証できない構成を「封じ込め成立」と表現しない。
8. **隔離未実証時のWrite/Edit禁止**: canary拒否を実証できないホスト・構成では、
   Write/Editを使うscenario（partial-failure、completion-report等）を自動実行しない。
   該当scenarioは未実行として記録し、live conversation gate上は「未完了（incomplete）」に
   集計する（Scope 7）。
9. **検査範囲の正直な表現**: 無限定の「workspace外変更0件」「workspace外への書き込みを
   禁止した」という主張をしない。実際に検査できた対象（例: canary拒否、plugin dirハッシュ、
   guard sentinel）を証跡・出力・報告で列挙し、「検査対象の範囲で変更0件」と範囲を限定して
   表現する。
10. `try/finally` 等で、成功・失敗を問わず一時workspace・合成HOME・証跡外の生成物を
    cleanupする。証跡は秘密情報を含まないサニタイズ済みの構造化結果だけとし、stderr等を
    保存する場合も環境変数値・token様文字列・ユーザー固有パスをサニタイズする。
    安全な実行環境を用意できない項目（CLI不在・未認証・隔離未実証等）は `unverified` と
    記録し、安全条件を弱めてPASSにしない。skipはPASSと区別して集計する。

### 3. 必須修正2: 完了報告テストの誤合格

現在の完了報告判定（層Cのsmoke checks）は、固定ラベルなしの任意3行でも合格しうる。次を必須にする。

1. 完了報告scenarioでは、固定3項目（`やったこと`／`結果`／`次に何が起きるか`）の
   **存在と順序**を必須にする。
2. 固定schema判定 `fixed === true` を合格の必須条件にし、`fixed === false` のまま
   行数・bullet数だけで自動合格させない。
3. 可能な範囲で判定を `validateScenario("completion-report", ...)`（層B共通契約）へ統一し、
   層Cが層Bより緩い独自判定で二重管理しない。実セッションゆらぎのため緩和が必要な項目は、
   緩和内容と理由をコード上とfeedbackで明示する。
4. negative caseを追加する: 固定ラベルなしの任意3行、ラベル順序違いは不合格になること。
5. 一般回答scenarioには固定3項目を要求しない。同時に、圧縮された一般回答
   （複数論点の改行なし平文）は不合格になることをnegative caseで固定する。

### 4. 承認済み改善

#### 4a. wizard進捗の一貫性

- Google Chat・Chatworkの両wizardで、1つの導線内で進捗番号を後戻りさせない。
- 接続と設定が別フェーズの場合は、フェーズの切り替わりを画面上で明示し、同じ「1/4」等の
  表記を別フェーズで曖昧に使い回さない。
- Google Chatの番号不一致（progress強調と本文「接続 3/4」のずれ、接続4/4の欠番）を解消する。
- desktop・mobile・200%相当で確認する。
- 認証方式、OAuth scope、Secret名、同期処理、edition対象差は不変とする。
- 進捗後戻り（後の画面で小さい進捗番号が強調される状態）を検出する回帰テストを追加する。

#### 4b. GitHub用語の初出説明（yasashii）

- yasashii onboardingで「private GitHub repo」に初出時1文程度の短い説明
  （GitHub上で自分や許可した人だけが見られる非公開の保存場所）を付ける。
- 「push」に初出時1文程度の短い説明（手元の変更をGitHubへ送る操作）を付ける。
- 正式名称は残す。過度な平易化・言い換えはしない。
- agenticの簡潔さへ影響させない。yasashii固有説明がagentic表現面へ漏れないことを検査する。

#### 4c. serializer正本の明確化

- 責務を正本上で明確化する: `rules/common-language.md` = 一般回答を含む全会話の共通原則、
  `rules/styles/yasashii.md` = yasashii文体と完了・状態報告の固定3項目serializer。
- skills／templates／tones等の `rules/plain-language.md`・「最終応答serializer」参照が、
  実在する正本へ一意に解決できる状態にする。現状の「`plain-language.md` にあるserializer」等、
  実体と異なる場所を指す記述は参照切れとして扱い是正する。
- 互換が必要な場合、正本を複製しない明示的なshim（入口file）または直接参照とする。
  同じschemaを複数fileで二重所有しない。
- 正本参照の誤り（不在file参照、serializer所在の誤記）を検出するテストを追加する。

#### 4d. room表記整理（yasashii）

- yasashiiのユーザー向け自然言語のみ `room` を `ルーム`（識別子箇所は `ルームID`）へ統一する。
- **機械的全置換は禁止**。Chatwork API正式名、コード識別子、設定key、fixtureの正式名称、
  機械可読出力は変更しない。
- 既存のconstraints §8.8／ui.mdの表示用語規約を正本とし、それに対する残存違反を0件にする。

### 5. ホスト非依存化（今回のPRの範囲）

4環境の実導入・実manifest・実pluginセッション対応はSprint 033で行う。本Patchでは
共通会話・テスト層の構造だけを4環境対応可能にする。

- 共通会話validator（層B契約）がClaude固有の応答形式・呼び出し形式を前提にしない。
- 共通会話fixtureがClaude専用command（`/secretary` 等のhost slash形式）を前提にしない。
  host固有の起動方法はrunner側の責務にする。
- Claude実会話runner（層C）を共通validatorから分離し、runnerはhost固有・validatorは共通とする。
- テスト結果の証跡へ、host名、runner名、実行面（CLI／App等）を必ず記録する。
- 未実行ホストを `unverified` と表現でき、実行済みホストとの区別が集計上崩れない構造にする。
- 1ホストのPASSを全ホストPASSへ昇格させない。
- ホスト別runnerを後から追加できるinterfaceまたはデータ構造を用意する。
- 共通rules（`common-language.md`、`safety.md`、`evidence.md` 等）へClaude固有commandを
  新規追加しない。
- 対応対象ホストと検証済みホストを別集計し、総合結果の表示で未検証環境を明示する。
- 過度な抽象化、存在しないホストAPIの推測実装は禁止。現時点で確認できる公式仕様
  （Claude Code plugin／skill、Codexのconfig.toml／AGENTS.md／skills）だけを根拠にする。

### 6. Chatwork Secret案内の無回帰

- `Name` 欄=`CHATWORK_API_TOKEN`、`Secret` 欄=本人がChatwork公式画面で取得したAPI Token、
  Token本文を会話・repoへ貼らない、GitHub UIへ本人が直接入力する、という
  sprint-032-patch-001合格時の案内を維持する。
- Google Chatの既存Secret案内・OAuth scopeも無回帰とする。

### 7. 必須修正3: live conversation gateの分離（2026-07-21新設）

元指摘（Draft PR #2レビュー）は「自作fixtureではなく、実plugin sessionの会話出力を
回帰確認する」こと。offline回帰・構文チェック・master gateの合格は、この元指摘の解消根拠に
ならない。次を必須にする。

1. 実会話出力の回帰確認を **live conversation gate** として、通常のoffline回帰・
   master release gateから分離した明示的なgateにする。gateはscenarioごとの実行結果を
   pass／fail／incomplete（未実行・未認証・隔離未実証を含む）の三値で独立に集計・表示する。
2. live conversation gateが未実行・未認証の場合、その項目を「未完了（incomplete）」として
   集計・表示する。offline回帰のPASS、runnerの構文チェック（`node --check`）、
   master gateの合格を、実会話の回帰保証として数えない。
3. master release gate等の総合表示は、live conversation gateがincompleteのままの状態を
   「実会話回帰も保証済み」と表示しない。incompleteはFAIL・0点にはしないが、
   完了済みの回帰保証としても数えない（第三状態のまま可視化する）。
4. **文言規律**: 「解消済み」「回帰保証あり」という主張は、実際に実行された検証だけに
   限定する。未実行の検証は「未完了」「未解消」と表現する。この規律はrunner出力・証跡・
   progress・feedback・PR説明のすべてに適用する。
5. 過去のfeedback・progress・stateの記述は遡って書き換えない。訂正が必要な場合は
   新しい記録（新しいentry・新しい評価）で行う。

## 前提（Plannerが置いた前提）

- 「Claude Code Desktop App」は、Anthropic公式のClaude desktop app内のClaude Code実行面
  （公式desktop quickstartの対象）を指す。MCPコネクタ中心の一般Claude Desktop chat面とは
  実行面として区別し、混同しない。
- 「Codex App」はOpenAI公式のCodex macOSアプリを指す。Codex CLIとは別の実行面として扱う。
- 本Patchのhost非依存化は構造・記録・集計の準備であり、Codex系runnerの実装・実環境検証は
  要求しない（Sprint 033の対象）。

## Non-scope

- Sprint 033の実装（agentic-secretaryの別directory・別repo作成、4環境への実導入）。
- remote変更、push（PR #2 branchの更新を除く）、実plugin install、公開release。
- edition switching、OAuth scope変更、同期境界変更、Secret名変更。
- 設定確認の `key=value` 表現変更（Sprint 034へ延期済み）。
- Codex App／Codex CLI用の実会話runner実装と、その実環境検証。
- PR #2のマージ。

## 受け入れ基準（Evaluatorが検証する）

1. **一般回答の分離**: 一般質問・複雑な説明・診断・検索結果・部分失敗の各scenarioで、
   固定3項目schemaが強制されず、複数論点の改行なし平文が0件である。完了・状態報告だけが
   固定3項目になる。適用場面の正本は `styles/yasashii.md` から導出される。
2. **runner env安全と合成HOME**: 実会話runnerの子プロセスenvがallowlist方式であり、合成の
   credential様変数（token・key・secret・GH系）を親環境へ注入しても子プロセスへ渡らないことが
   テストで確認できる。子プロセスへ渡る `HOME` は実HOMEではなく、個人ファイル・認証情報を
   含まない合成HOMEであり、その内容一覧が証跡に記録されている。
3. **runner封じ込め（改訂）**: 子セッションは原則Bashなしの最小ツール許可で動き、読み取り拒否
   テストは一時workspace内fixtureで行われ、`/System` やuser home等のworkspace外パスが
   テスト対象・書込み対象に0件である。plugin本体はread-only参照で子から書込み不能であり、
   書込み先はOS sandboxまたはpath-scoped permissionで一時workspaceへ限定されている。
   制御されたworkspace外canaryへの書込み試行が**実際に拒否された**証跡があり、
   canary拒否を実証できない構成ではWrite/Editを使うscenarioが自動実行されず
   incompleteとして記録されることがテストで確認できる。
4. **runner後始末・証跡・検査範囲の表現（改訂）**: 成功・失敗の両方で一時workspaceと
   合成HOMEがcleanupされ、証跡はサニタイズ済み構造化結果だけである。安全に実行できない項目は
   `unverified` としてPASSと別集計される。runner出力・証跡・報告に無限定の
   「workspace外変更0件」という主張がなく、検査対象（canary・plugin dirハッシュ・
   guard sentinel等）を列挙した範囲限定の表現になっている。
5. **完了報告の誤合格解消**: 完了報告判定が固定3項目の存在と順序を必須にし、
   `fixed === false` で合格しない。固定ラベルなしの任意3行・順序違いのnegative caseが不合格になり、
   一般回答には3項目が要求されない。判定は共通契約（`validateScenario`）へ統一されているか、
   緩和差分が明示されている。
6. **wizard進捗**: 両wizardの全導線で進捗番号の後戻りが0件、フェーズ切替が明示され、
   Google Chatの番号不一致が解消されている。desktop・mobile・200%相当で確認され、
   進捗後戻りを検出する回帰テストが追加されている。認証方式・OAuth scope・Secret名・
   同期処理・edition対象差は不変である。
7. **GitHub用語**: yasashii onboardingで「private GitHub repo」「push」の初出に1文程度の
   短い説明があり、正式名称が残る。agentic表現面へyasashii固有説明が漏れていないことが
   検査で確認できる。
8. **serializer正本**: common-language.md／styles/yasashii.mdの責務が正本上で明確で、
   `rules/plain-language.md`・serializer参照がすべて実在正本へ解決できる（shimは複製なし）。
   正本参照の誤りを検出するテストが追加され、負ケースで失敗する。
9. **room表記**: yasashiiのユーザー向け自然言語で `room` 単独表記が0件（`ルーム`／`ルームID`）。
   API正式名・コード識別子・設定key・fixture正式名称は不変である。
10. **ホスト非依存構造**: 共通validator・fixtureにClaude固有形式・commandの前提が0件で、
    Claude用runnerが分離されている。証跡にhost・runner・実行面が記録され、未実行ホストは
    `unverified`、対応対象と検証済みが別集計で、1ホストPASSの昇格が0件である。
    ホスト別runner追加のinterfaceまたはデータ構造が存在する。
11. **Chatwork／Google Chat無回帰**: Secret案内（`Name`／`Secret`）、Token非露出、
    OAuth scope、同期境界、wizard flow・DOM骨格がsprint-032-patch-001合格状態から回帰していない。
12. **全必須回帰**: Patch専用回帰、sprint-032-patch-001回帰、Sprint 029〜032関連回帰、
    master offline、Gitなしarchive gateが0 FAILである。
13. **live conversation gate（2026-07-21新設）**: 実会話出力の回帰確認が、offline回帰・
    master gateから分離された明示的なgateとして存在し、scenarioごとに
    pass／fail／incompleteの三値で集計・表示される。未実行・未認証・隔離未実証の項目は
    「未完了（incomplete）」と表示され、offline回帰のPASSやrunnerの構文チェックが
    実会話の回帰保証として集計・表現されていない。さらに、(a) 安全に隔離された
    （canary拒否実証済みの）認証済みホストで少なくとも1件の実会話検証がPASSしているか、
    (b) 未完了がstate・progress・feedback・PR #2の説明で明示され、元指摘
    （実plugin sessionの会話出力の回帰確認）が未解消として保持され、実会話検証の完了が
    Sprint 033へ引き継がれている（引き継ぎ先はsprint-033受入基準6の
    「4環境それぞれの検証」で、実会話runner検証を含む）、のどちらかを満たす。

## 回帰保護

- 実会話runnerのenv allowlist・合成HOME・plugin read-only・ツール制限・境界・cleanupを
  検査する専用テスト（合成credential注入、canaryによるworkspace外書込み試行と拒否確認、
  隔離未実証時のWrite/Edit scenario自動実行抑止、cleanup検証を含む）。
- live conversation gateの集計検査（incompleteがpassへ数えられないこと、構文チェックや
  offline PASSが実会話回帰の保証として集計されないこと、総合表示がincompleteを隠さないこと）。
- 完了報告のnegative case（ラベルなし3行、順序違い）と一般回答のnegative case（圧縮平文）。
- wizard進捗の後戻り検出回帰（両wizard、全導線）。
- serializer正本参照の解決検査（不在参照・所在誤記の負fixture）。
- yasashii表示用語scan（`room` 残存検出。対象外パスは理由つきで除外）。
- 会話surface inventory・禁止圧縮指示scan（sprint-032-patch-001の既存回帰）を維持。
- ホスト非依存の集計検査（unverifiedホストが総合PASSへ数えられないこと）。
- Sprint 029〜032、master offline、Gitなしarchive、secret／Git安全suite。

## 手動・browser証跡

- 両wizardをdesktop／mobile（768px未満）／200%相当で実操作し、進捗表示の遷移
  （後戻り0件、フェーズ切替表示）をscreenshotで記録する。
- yasashii onboardingのGitHub用語説明の表示を確認する。
- 実会話runnerを安全条件下で1回以上実行し、host・runner・実行面が記録された
  サニタイズ済み証跡と、canary書込みが拒否された記録を確認する。claude CLIを利用できない・
  未認証・隔離未実証の場合はlive conversation gateを「未完了（incomplete）」として記録する。
  層A／層Bの静的・契約検査はoffline部分の合格根拠にとどめ、実会話の回帰保証として数えない。

## 評価・証跡

- **必須回帰一覧と合格条件**（rubric準拠、2026-07-21改訂）: 機能完全性（C1）4/5以上、
  動作安定性（C3相当）4/5以上、エラーハンドリング3/5以上、回帰なし（C6）5/5必須、
  安全性ゼロ許容（C2・C5・C12・C13・C14）全合格。受け入れ基準1〜13のうち1件でも未達なら不合格。
- **live conversation gateの合格条件（Patch合格条件の改訂）**: offline部分
  （受け入れ基準1〜12でoffline検証可能な範囲）が全PASSであることに加え、
  live conversation gateについて次のどちらかを満たすこと。
  - (a) 安全に隔離された（canary拒否を実証済みの）認証済みホストで、少なくとも1件の
    実会話検証を実行してPASSする。
  - (b) 未実行を「未完了（incomplete）」としてstate・progress・feedback・PR #2の説明に明示し、
    元指摘（実plugin sessionの会話出力の回帰確認）を未解消として保持する。この場合、
    実会話検証の完了はSprint 033の受入条件（受入基準6の4環境別検証）へ明示的に引き継ぎ、
    Sprint 033はこの項目の完了なしに該当ホストを検証済みへ数えない。
  incompleteを0点・FAILとして扱わない一方、実行していない検証を完了済みの回帰保証として
  数えることも禁止する。
- 実会話テスト結果には必ずhost・runnerを記録し、Claude Code上の結果は
  「Claude Code実行面の証拠」に限定して表現する。他ホストへの読み替えは不合格。
- **Patch専用証跡場所**: UI評価で新規screenshotをcommitする必要がある場合は
  `docs/evidence/sprint-032-patch-002/` を新設して保存する。既存 `docs/evidence` 配下の
  ファイルは上書き・編集・移動禁止。秘密情報・アカウント名・固有IDを含むscreenshotは
  commit禁止（必要なら伏せ字化するか、repo外一時領域だけに置く）。
- Fableが実装と独立評価を行う場合も、実装証跡と評価証跡を分離して記録する。

## External live gate

実Token、Repository Secret、Actions、OAuth、実API、remote変更、push（PR #2 branch更新を除く）、
plugin install、公開は不要かつ対象外。実会話runnerはローカルの合成workspaceだけを使い、
封じ込め（canary拒否）と検査対象を列挙した範囲限定の無変更確認を証跡化する
（無限定の「外部書込み0件」とは表現しない）。追加の外部操作が必要になった場合は、
対象と副作用を示してユーザーの新しい明示許可を得るまで実行しない。

## 公式仕様確認（本契約作成時の根拠）

- 確認済み（公式）: Claude Code pluginはmarketplace.json＋plugin.json（`.claude-plugin/`）を正本とし、
  skills／commands／agents等を同梱できる（code.claude.com公式docs、anthropics公式repo）。
  Claude Codeのdesktop実行面は公式desktop quickstartが存在する。
  OpenAIはCodex App（macOS）を公式提供し、Codexはconfig.toml／AGENTS.md／skills
  （`.agents/skills`、open agent skills標準）を公式のカスタマイズ面とする（developers.openai.com）。
- unverified: Claude Code Desktop AppでのpluginのCLI同等導入経路、Codex Appでのskills読込の
  CLIとの完全一致は、実環境検証まで `unverified` として扱う。Sprint 033で検証する。
- 公式に提供されていない機能（例: Codexのplugin marketplace相当）を存在する前提で設計しない。

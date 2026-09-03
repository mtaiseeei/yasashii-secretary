# Sprint 042 — Project Clarity Yasashii full integration

- Type: main
- Risk: high（新しいproject状態モデル、Hook、Xmind、link／sync、overlay、Yasashii保護面を扱う）
- 依存: `sprint-041` fresh Evaluator PASSと検証可能なYasashii prewrite receipt
- 含む機能: F60〜F76
- 重点評価: C2, C5, C6, C7, C13, C14, C15, C16, C17, C18, C19, C20, C21, C22, C23, C24, C25（C1／C3／C7／C21／C24は4以上、他は5/5必須）
- UI: 対話出力、Markdown／Mermaid／Xmind preview。Web UIなし

## 目的

公開F64〜F80の17機能／62 behaviorをYasashii F60〜F76へ一対一で適応し、generic Secretary storage、既存Skills、command-only Hook、Xmind provider、link／sync／Drift、Yasashii overlayと一体で動くcandidateを作る。public／privateのblind copy、既存正本の乗っ取り、Yasashii identityの消失を許さない。

## 固定前提

- Sprint 041の固定tuple、prewrite receipt、path role、protected beforeだけを入力にする。
- Yasashii baseは`c6cfb40a6026c5447a8ec4729f517adb4cc51031`、public productは`5f08d454c05576fcff8ab32c10c00887b4c15a96`、private candidateは`d5598226213004d55781ca033985589907ae7b5d`である。
- publicは`evaluatorPass=false`、Yasashii candidateはfresh Evaluator PASS前まで`candidate-unverified`である。
- prewrite receiptはこのSprintの製品applyだけを許し、release、cache、public／private write、external liveを許可しない。

## 外から見える成果

- open projectの決定、実行、検証、注意、ずれを別状態で確認でき、固定4象限で次の判断が分かる。
- Clarityは`secretary/projects/open/<project>/clarity/`に保存され、PROJECT、TODO、memory、closed project、外部Repo正本を侵さない。
- daily／weeklyは根拠つきAttention／Portfolioだけを限定表示する。
- Xmindは既定OFF。ON時はMCP-firstで、local fallbackはpreview後の明示承認なしに書かれない。
- 外部projectは相互handshake、pull-only、authority付きで接続し、conflictやDriftを上書きせず示す。

## Scope

### A. Clarity状態と操作

- stable ID、4 mode、append-only Event、最小Evidence、再構築Stateを提供する。
- Decision、Execution、Validation、Alignmentを独立させ、固定4象限へ決定的に分類する。
- init、review、doctor、migrationを分け、診断はread-only、writeは確認後の許可rootだけとし、retryを同じ状態へ収束させる。
- Attentionはreasonと根拠を持ち、推定だけでconfirmed／implemented／passedへ進めない。

### B. generic storageと既存所有者

- 正本は`secretary/projects/open/<project>/clarity/`だけに置く。
- Projectsはlifecycle／`canonicalRepo`、ClarityはDecision／Execution／Validation／Attention／Driftを所有する。
- Clarity Itemを自動task化しない。明示依頼時だけ既存TODO／task導線へ委譲する。
- private `05/02/10_sources/Notion`、private値、private Skillsを同梱しない。

### C. Skill、Hook、collaboration

- `clarity` Skill、CLI、host adapter、manual fallback、router、collaboration inventory、manifest／release inventoryを整合させる。
- 固定public Hook 3 pathをbyte-syncし、Project Clarity専用のhost `type: command` router 1組として使う。
- initialized／linked rootのSessionStart／PostToolUse／PreCompact／Stop／SessionEndとEdit／Write／test候補をboundedに観測する。通常Bash／他Skill payloadはruntime-only nonmaterial observationを許すが、canonical／external write、semantic routeを行わず、`material=false`のStop checkpointを要求しない。
- projects、daily、weekly、memory-care、update等へ独立Hookを追加しない。task／memory候補の意味判定、Hook内network／LLM／Xmind／全scan／connector／updateを0件にする。
- secretary、projects、daily、weekly、task collaboration、memory-care、build、update、onboarding、templates、rules、host／release inventory、edition handoffの責務を実内容inventoryで固定する。

### D. Markdown／Mermaid／Xmind

- 同じStateをMarkdown／Mermaidへ決定的に投影する。
- TL緑、TR青、BL黄、BR赤、上「決まっている」／下「まだ決まっていない」、emoji／label／意味文を固定する。
- Xmindは既定OFF。ON時はcapable Xmind MCPを第1優先、local `.xmind`を明示承認後の第2優先とする。
- MCP／localともproposal／preview／確認境界を持ち、localへの自動fallback、無承認write、fakeのverified昇格を0件にする。

### E. link／sync／Drift／安全性

- linkはprepare／accept／finalizeのreciprocal handshakeを必須にする。
- syncはpull-onlyで各projectが自己rootだけへ書き、Primary／Reference／Shared derivedのauthorityを守る。
- conflictをlast-write-winsで解消せず、Driftは双方のEvidenceを示す。
- root、symlink／junction、traversal、dirty／stage、Secret、concurrency、partial、retryを安全に扱う。

### F. Yasashii adaptation

- `byte-sync`はpublicとmode／bytes一致、`adapted`はYasashii責務とtransform根拠、`supporting`は製品差分0の実利用、`excluded`／`protected`は非変更を示す。
- adapter／overlay／copy／style／edition／manifest／marketplace／repository／`harness@yasashii-harness`をYasashii値へ整合させる。
- downstream-ownedとHarness role-ownedを製品syncから除外し、protected before／afterの許可外変化を0件にする。
- `clarity.md`の17／62 matrixを実action、scenario、結果へ一度だけ対応づける。

## Non-scope

- public／private source、実利用者workspace、実HOME、実Xmind MCP／local `.xmind`、実host live、external connector。
- release、push、tag、GitHub Release、Marketplace、installed cache、new session、Mac mini。
- Projects lifecycle、TODO正本、memory意味判定、private Notion／vault仕様の変更。
- 新しいcollector／統一attestation。

## Acceptance Criteria

1. public F64〜F80とYasashii F60〜F76が17/17の一対一matrixを持ち、全62 behaviorがIDで一度だけ実装／adaptation／scenarioへ対応する。欠落、重複、未分類、未検証の偽PASSが0件である。
2. stable ID、4 mode、Event／Evidence／State、Decision／Execution／Validation／Alignment、固定4象限が正負fixtureで成立する。
3. init／review／doctor／migrationのread／write境界、再構築、retry冪等性、partialの正直な状態が成立する。
4. `secretary/projects/open/<project>/clarity/`だけが新規Clarity write先となり、PROJECT／TODO／memory／closed／外部Repo正本への自動writeが0件である。
5. Projects lifecycleを変更せず、自動task化0件、明示委譲だけが既存task導線へ進む。
6. Hook 3 pathが固定public bytes／modeと一致し、Clarity専用router 1組以外のHookが0件である。
7. initialized／linked rootのbounded lifecycle観測が成立する。通常Bash／他Skill payloadのcanonical／external write 0、semantic route 0、`material=false` checkpoint 0、未初期化／未linked／disabled／trust未承認no-op、Hook内network／LLM／Xmind／全scan／connector／update 0件である。
8. daily／weeklyはbounded Attention／Portfolioを根拠つきで表示し、予定／TODO／journal／memoryの正本変更が0件である。
9. Markdown／Mermaid／Xmind proposalの4象限位置、色、label、意味、上下軸が固定値と一致する。
10. Xmind既定OFF、ON時MCP-first、MCP／localとも確認前write 0、local自動fallback 0、拒否／無回答write 0が成立する。
11. reciprocal handshake不足、authority conflict、相手root write、push sync、last-write-winsを負例で拒否し、possible／confirmed Driftを根拠つきで再現できる。
12. path／symlink／dirty／stage／Secret／concurrency／partial／retryを安全に扱い、Event／projection／checkpoint重複が0件である。
13. path role、actual read／copy／adapt／write／execute／protect、actual diff、before／after digestが一致し、unknown、overlap、未分類、unused、staleが0件である。
14. Yasashii文体、copy、style、edition、overlay、manifest／marketplace、repository、`harness@yasashii-harness`、README、LICENSE、AGENTS、repo-owned docs、release履歴の許可外変化が0件である。
15. private実装混入、public／private write、release／push／tag／cache／new session、実workspace／Xmind／host／connector操作が0件である。

## Verification scope（着手時に固定）

- 対象: Yasashii実source、Sprint 041固定入力から作る隔離candidate、synthetic Secretary workspace／external project／Xmind provider fixture。
- 必須: AC1〜15、C20〜C25、模擬会話42〜45、17／62 matrix、path actual action／diff、collaboration inventory、protected before／after、既存回帰。
- UI: 対話Markdown／Mermaid／Xmind previewの構造と可読性。Web browser screenshotは要求しない。
- 外部操作: remote、release、install、cache、new session、実workspace、実Xmind、実host live、実connectorは0件。

### Evidence safe harbor

- command、exit code、source root、開始／終了HEAD、candidate identity、`git status --short`。
- 17機能／62 behavior matrixのID、scenario、期待／観測、実行面、PASS／FAIL／NOT-RUN。
- path role、actual action／diff、mode、before／after digest、intersection／未分類件数。
- 4象限、Attention、storage、task delegation、Hook、daily／weekly、Xmind、link／sync／Driftのcase IDと副作用snapshot。
- collaboration surfaceとprotected対象の名前つきbefore／after、各回帰suiteのcommand／assert数／exit code。

上記で十分とし、新しいcollector／統一attestation、実Xmind、実host live、release、cacheを追加条件にしない。

## 完了条件

Generatorは同一candidate、17／62 matrix、actual action／diff、collaboration inventory、protected before／after、全回帰を`docs/progress/sprint-042.md`へ引き渡す。Evaluatorは隔離fixtureで実操作し、`docs/feedback/sprint-042.md`へC20〜C25を含む採点とVerdictを書く。fresh Evaluator PASSとOrchestratorのstate更新前にSprint 043へ進まない。

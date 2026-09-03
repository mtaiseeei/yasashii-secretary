# Sprint 043 — Project Clarity Yasashii final source evaluation

- Type: main
- Risk: high（exact candidate、source／clean／Git-free、全case matrix、fresh verdict、source receiptを扱う）
- 依存: `sprint-042` fresh Evaluator PASS
- 含む機能: F60〜F76の最終保証、F75／F76のsource handoff
- 重点評価: C1, C2, C3, C5, C6, C7, C13, C14, C15, C16, C17, C18, C19, C20, C21, C22, C23, C24, C25（C1／C3／C7／C21／C24は4以上、他は5/5必須）
- UI: Clarity対話／Markdown／Mermaid／Xmind previewの最終回帰。Web UIなし

## 目的

Sprint 042のexact same Yasashii candidateを、実source、clean checkout、同一bytesのGit-free archiveで独立評価する。17機能／62 behavior、primary 250、CLX 20、XV 4、E2E 4と全既存回帰を閉じ、fresh Evaluator PASS後だけYasashii source handoff／receiptを生成する。source PASSとrelease／cache／workspace／liveを混同しない。

## 固定candidate

- Sprint 042 Evaluatorが評価したcandidate commit／tree／product digestを一意に固定し、Sprint 043中に別candidateへ差し替えない。
- source、clean checkout、Git-free archiveは同じ製品bytes／modeを持つ。
- Sprint 042 feedback、Generator自己評価、publicのユーザー判断、private PASSをSprint 043のfresh verdictへ流用しない。
- public statusは`evaluatorPass=false`、実Xmind／host／connector、release／cacheはNOT-RUNのまま保つ。

## Scope

### A. source／clean／Git-free identity

- 同一candidateについて製品対象bytes／mode、path role、actual diff、protected digestを3実行面で照合する。
- Git-free archiveはGit metadata、元worktree、Harness評価履歴に依存せずClarityとportable regressionを実行できる。
- archiveへ`.git`、absolute source path、private値、評価artifact、資格情報を混入させない。

### B. full Acceptance Matrix

- public17→Yasashii17の17行と62 behaviorについて、実行面、正例、負例、期待副作用、観測結果を同一candidateへ束縛する。
- primary 250、CLX 20、XV 4を単一割当のまま全再実行し、case本文、Severity、期待副作用、conditional NOT-RUNを変えない。
- E2E 4本をinit→Event／Evidence→review／4象限／Attention→doctor→Markdown／Mermaid／Xmind preview→daily／weekly→link／pull sync／Driftまで完走する。
- generic storage、Projects責務、task委譲、Hook command-only、Xmind承認、authority conflict、retry、Yasashii overlayを一連の操作中も保つ。

### C. full regressionとfresh評価

- Sprint 041／042専用suite、既存Yasashii master／safety／edition／overlay／release-integrity／portable gateを同じcandidateで実行する。
- PASS、FAIL、conditional NOT-RUN、別phase NOT-RUN、verification-infra findingを分離して集計する。
- EvaluatorはGeneratorから独立したfresh作業単位で実操作し、C20〜C25を含むrubricと全matrixを採点する。

### D. source handoff／receipt

fresh PASS後だけ、次を同一candidateへ束縛する。

- fixed public handoffとprivate PASS receiptのidentity／digest
- Yasashii base、candidate commit／tree／product digest
- Sprint 043 feedback path／SHA-256／Verdict `PASS`／candidate
- 17／62、primary 250、CLX20、XV4、E2E4、全回帰の集計
- path role、actual action／diff、protected before／after、downstream-owned／Harness-owned intersection 0
- public `evaluatorPass=false`、release／push／tag／Marketplace／cache／new session／workspace／host／Xmind／connectorがNOT-RUNであること
- rollbackと、次工程がsourceのrelease判断に必要な別承認であること

PASS以外、feedback未確定、candidate不一致、case欠落、feedback改変、protected不一致、NOT-RUN偽記載ではreceiptを生成しない。Evaluatorはfeedback以外の正本を編集せず、Orchestratorがfeedback確定後にreceiptをfinalizeする。

## Non-scope

- release、push、tag、GitHub Release、Marketplace、installed plugin／cache、new session、loaded version確認。
- 実利用者workspace migration、Mac mini、実Xmind MCP／local `.xmind` write、実Claude／Codex host live、external connector。
- public／private source変更、public statusのPASS化、private実装の同梱。
- 新しい統一attestation／collector。

## Acceptance Criteria

1. exact candidateのcommit／tree／product digestと製品bytes／modeがsource、clean checkout、Git-free archiveで一致する。
2. archiveはGit metadata、元worktree、評価履歴、absolute source path、private値に依存せず必須Clarity／portable gateを0 FAILで完走する。
3. public17→Yasashii17が17/17、62 behaviorが62/62で一度だけ対応し、各行に実行面、正負case、期待／観測、副作用、結果がある。欠落、重複、未分類、NOT-RUNのPASS集計が0件である。
4. primary 250／250、CLX 20／20、XV 4／4を同じcandidateで全再実行し、意味・Severity・期待副作用を維持する。conditional NOT-RUNをPASSへ数えない。
5. E2E 4／4がinitからDriftまで完走し、状態、generic storage、Projects／task／Hook／Xmind／sync境界を途中でも維持する。
6. path role、actual action／diff、before／after digestがfinal candidateと一致し、unknown、overlap、未分類、unused、staleが0件である。
7. collaboration inventoryとYasashii protected surfaceが名前つきで一致し、downstream-owned／Harness-ownedへの製品sync intersectionと許可外変化が0件である。
8. Sprint 041／042専用回帰と既存Yasashii回帰が全て0 FAILで、known failureを隠さない。
9. fresh Evaluatorが同じcandidateを実操作し、C20〜C25を含む対象閾値を満たした`PASS` feedbackを記録する。
10. feedback確定後のsource receiptがfixed upstream／private inputs、Yasashii candidate、feedback SHA／PASS、17／62、250＋20＋4＋4、protected、rollback、NOT-RUNを同一candidateへ束縛する。
11. feedback FAIL／未確定、candidate差替え、case欠落、feedback digest不一致、protected不一致、NOT-RUN偽記載の負例でreceipt生成を拒否する。
12. release／push／tag／cache／new session／workspace／host／Xmind／connector操作が0件で、未実施を未実施のまま表示する。

## Verification scope（着手時に固定）

- 対象: exact same Yasashii candidateのsource、clean checkout、Git-free archive、隔離synthetic workspace／external project／Xmind provider fixture、確定したSprint 043 feedback。
- 必須: AC1〜12、C20〜C25、模擬会話42〜45、17／62、primary 250、CLX20、XV4、E2E4、全回帰、protected before／after、receipt正負fixture。
- UI: 対話Markdown／Mermaid／Xmind preview。実host live、実Xmind、既存Web wizardのbrowser／screenshotは要求しない。
- 外部操作: remote、push、tag、release、install、cache、new session、実workspace、実Xmind、実host、connectorは0件。

### Evidence safe harbor

- source／clean／archiveのroot、candidate commit／tree／product digest、mode、開始・終了`git status`、archive非依存証跡。
- 17行／62 behavior matrix、primary／CLX／XV／E2E case ID、入力、期待／観測、before／after、PASS／FAIL／NOT-RUN。
- path role／actual action／actual diff、collaboration inventory、protected before／after digest。
- 全suiteのcommand、exit code、assert数、失敗／未実施／verification-infraの分離集計。
- feedback path／SHA-256／Verdict／candidate、source receiptの全binding、verifierと負fixture結果。

上記で十分とし、新しい統一attestation、release／cache確認、実host／Xmind／workspace／connector操作を追加条件にしない。

## 完了条件

Generatorはexact candidate、source／clean／archive、全matrix／E2E、source receipt finalizationに必要な検証面を`docs/progress/sprint-043.md`へ引き渡す。Evaluatorは`docs/feedback/sprint-043.md`だけへfresh verdict、candidate、証拠、findings、採点を書く。PASS確定後にOrchestratorがreceiptをfinalizeし、stateへ結果を記録する。receiptが検証可能になるまでrelease／liveへ進まない。

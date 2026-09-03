# Sprint 043 Patch 003 — Yasashii Harness包括scanとWindows native互換

- Type: regular
- Risk: high（bounded filesystem scan、Harness正本意味、Repo identity、Windows native、inventory、外部CIを横断する）
- Base Sprint: `sprint-043`
- 依存: `sprint-043-patch-002` done
- Yasashii開始HEAD: `9009f892f678fbcbde9978e0bceb803d3f1ad7d5`
- Yasashii開始tree: `de744087388b60d0f0f2db221b204c57a0c31bcf`
- 開始状態: clean、branch `codex/sprint-041-project-clarity`、既存PR `#12`
- 対象機能: F77
- Target Case: `yasashii-HS-001〜016`
- 重点評価: C1は4以上、C2／C5／C6／C20／C22／C23／C25／C26は5/5、C21／C24は4以上
- UI: CLI JSON／Markdownの意味表示だけ。Web UI変更はなくbrowser screenshotを要求しない

## 背景と固定判断

Project Clarityはpublic→private→Yasashiiの順で展開する。publicとprivateのPatch 004は、一般scanが2 MiB上限へ達するとHarnessのstate、Current contract／progress／feedbackが候補から落ちる問題を修正し、Windows nativeを含むfresh独立評価でPASSした。Yasashiiは同じClarity coreを持つが、generic storage、Xmind既定OFF、17 Skills／62 behavior、やさしいcopy／style／identity、既存0.9.2 Windows workflowを独自に持つ。上流source、test、workflowをblind copyしてはならない。

本Patchでいう「包括的」は全Repoを無制限に読むことではない。一般scanと独立したreserved laneで現在判断に必要な正本を先にbounded readし、読めた範囲と読めなかった理由を正直に返すことである。

stateはOrchestrator execution truth、contractはrequirements、progressはGenerator self-report、feedbackはEvaluator validationである。progressの「完了」からEvaluator PASSを推測せず、同じCurrent SprintをDecision／Execution／ValidationとEvidence参照へ一つに束ねる。過去Sprint文書を1 file 1 Itemで大量化しない。

Windows対応はWindows風文字列のportable testだけで完了にしない。native filesystemと既存Yasashii workflowでdrive、path、CRLF、collision、capability、安全境界を直接検証し、SKIP／NOT-RUNをPASSへ数えない。

## 固定上流入力

### public

- accepted product／test candidate: `fe3eab06d4fbd0b5b26d995129156f2fb2537dd2`
- candidate tree: `2dd956ed987360781e2fccafb2ddbf52245219df`
- fresh PASS feedback: `348cb1825a7f7e228e71e3799e2fdff0ea9b464e`
- final HEAD／state: `4c37eaba23ace106b02709637ec7cde7cbf8bafc`

### private

- accepted product／test candidate: `a980208db3728fc2d12e61435b03cd4b33e79a29`
- candidate tree: `a77fda7cbb1ea6536b4228a9002e3edcea6a7f1c`
- fresh PASS feedback: `b0c2138b8dcf96c144344e96307a22d38b4af349`
- final state: `ed4068e57e1da32e4fc1d4bfa2680393e2e00eb3`

public／privateのPASS、Windows run、Fable review、Generator自己評価はYasashii PASSの代わりにならない。上流のspec／state／progress／feedbackは設計根拠であり、Yasashii製品bytesへcopyしない。

## 外から見える成果

- 2 MiBを超えるHarness Repoでも、state、spec、Current contract／progress／feedbackの確認状況が先に分かる。
- 実行状態、要件、Generator自己報告、Evaluator検証を混ぜず、現在Sprintの一つの束として読める。
- valid／TBD／missing／invalid／巨大state、feedback未作成／読めない、Secret／binary／symlink／permission／missing、truncated／partialを理由つきで区別する。
- authoritative lane後の残余budgetで一般file候補も取得し、非Harness Repoの既存generic scanは変わらない。
- Windowsのdrive letter、backslash、空白、日本語、CRLFでもpreview／identityが動き、危険なcollision／invalid pathは副作用0件で止まる。
- Windowsのsymlink／junctionを別capabilityとして扱い、未実行や権限不足を対応済みに見せない。

## Scope

### A. Harness検出とauthoritative reserved lane

1. `docs/sprints/state.md`と関連構造から`harness / non-harness / partial / invalid`を安全に検出し、partial／invalidを完全Harnessへ昇格しない。
2. Harness時だけgeneric scanと独立したauthoritative reserved laneを使う。genericのbyte／file／entry上限が先に達しても予約枠を消費しない。
3. stateをbounded readし、declared／resolved Current ID、status、Next Planned、該当section、fallback source、`inferred`を得る。valid／TBD／missing／invalid／巨大stateを固有状態にする。
4. Current解決後、`docs/spec.md`とそこから必要な`docs/spec/*.md`、Current contract／progress／feedback、`AGENTS.md`、`CLAUDE.md`、実在するpackage manifestを一般`src/`／`scripts/`より先に扱う。
5. feedback不存在は`evaluation-not-yet-recorded`とし、存在するがSecret-like／binary／symlink／permission／上限等で読めない状態と分ける。
6. CurrentがTBD／missing／invalidの場合、state内に明示されたNext Plannedまたは直近completion等のbounded fallbackだけを根拠つき・`inferred=true`・`partial=true`で使う。filename順／mtimeだけで確定しない。
7. 巨大stateは上限を単純拡大せず、bounded metadata／該当sectionで扱う。解決不能ならpartialで停止する。
8. authoritative lane後だけ、残余budgetでgeneric scanを行う。非Harness Repoの候補、上限、順序、安全意味を維持する。

### B. Harness正本の意味とClarity候補

1. state=`orchestrator-execution-truth`、contract=`requirements`、progress=`generator-self-report`、feedback=`evaluator-validation`を固定roleとする。
2. progressの実装完了をEvaluator PASSへ昇格しない。feedbackのFAIL／verification-scope-issue／未作成／未確認をstateやprogressで上書きしない。
3. Currentのstate／contract／progress／feedbackをDecision／Execution／ValidationとEvidence locatorへ一つのbundleとして束ねる。全過去contract／progress／feedbackをItem化しない。
4. tracked Clarity dataへ本文全文、absolute local path、Secret、顧客識別子を複製しない。repo-relative locator、digest、短いsummary、観測時刻を使う。
5. authoritative／generic laneごとにlimits、used bytes／files／entries、`inspected / excluded / uninspected / not-found`、partial reasons、coverage digestを返す。
6. 同一inputのpreview／apply retryは候補、Item、Event、Evidence、Stateを重複させず決定的に収束する。

### C. 安全性とPatch 002回帰

1. `.env`／credential／Secret-like content、binary、root内symlink／junction、path traversal、absolute path injectionの既存除外を維持する。
2. preview／cancelは`changed:false`で、filesystem、runtime、journal、Git、network、external provider write 0件とする。
3. applyはsynthetic fixtureだけで評価し、物理Repo内の宣言済みClarity所有path以外を変更しない。実利用者Repoへのapplyは行わない。
4. dirty／staged／untracked、HEAD、branch、remote、既存file、external canaryを全positive／negative経路で保持する。
5. ancestor alias／physical pathは同じRepo identity、候補ID／意味／順序、coverage digestを返す。Patch 002の一般root既定拒否、Clarity限定opt-in、root自身／root内symlink、alias差替え、TOCTOU拒否を維持する。

### D. Windows native互換

1. scanner、candidate resolver、init preview、identity、安全pathはNode-nativeとplatform path APIで動き、POSIX separator、Bash、`/tmp`固定を前提にしない。
2. drive letter、backslash、空白、日本語、CRLFを含むfixtureをWindows native filesystem上で直接扱う。
3. case-insensitive collision、reserved名、invalid path表現、前方一致する別root、nested／親子／兄弟rootを安全側へ分類し、文字列prefix containmentへ緩和しない。
4. Windowsの同一Git rootはexact filesystem identityで判定し、identity取得不能／0から一致を推測しない。
5. symlinkとjunctionを別々にcapability probeする。実行可能ならpositive／negativeを直接評価し、作成不能なら種類別SKIP／NOT-RUN reasonを記録する。片方の権限理由を他方へ流用しない。
6. host固有home、drive、volume、利用者名をsource、fixture expectation、tracked artifactへhard-codeしない。
7. `.github/workflows/windows-recording-regression.yml`の既存`windows-native` jobへYasashii suiteを実在pathで結線する。Node 22、既存0.9.2回帰、`timeout-minutes: 10`を壊さない。
8. macOS／portable suite、Sprint 041〜043、Patch 001／002、Secret／path／inventory／Git-free回帰を同じcandidateで再実行する。platform固有caseを別OSのPASSへ流用しない。

### E. path roleと版境界

固定上流差分とYasashii開始treeを実bytesで比較し、次の候補roleをactual action／diff／digest／modeにより排他的に確定する。候補であることを理由に、実際に変わらないpathをchangedと記録しない。

public固定base `90a13fcc0f78472abe7566c0aad3fdf783d7ec3e`からaccepted candidateまでの製品／test差分9 pathは、次のYasashii roleへ漏れなく対応づける。

| public actual path | Yasashii initial role／actual path |
|---|---|
| `plugins/secretary/scripts/clarity.mjs` | byte-sync candidate／同path |
| `plugins/secretary/scripts/lib/clarity-core.mjs` | byte-sync candidate／同path |
| `plugins/secretary/scripts/lib/clarity-harness-scan.mjs` | byte-sync candidate／同path new |
| `plugins/secretary/collaboration-inventory.json` | adapted candidate／同path |
| `scripts/lib/sprint-049-inventory.mjs` | adapted candidate／同path |
| `scripts/sprint-049-test.mjs` | adapted candidate／`scripts/sprint-042-collaboration-test.mjs` |
| `scripts/sprint-050-patch-003-test.mjs` | protected Patch 002回帰＋new Patch 003 supporting suiteへ意味を適応 |
| `scripts/sprint-050-patch-004-test.mjs` | supporting new `scripts/sprint-043-patch-003-test.mjs` |
| `.github/workflows/windows-recording-regression.yml` | adapted candidate／同pathの既存Yasashii workflow |

publicのHarness docs（spec／contract／state／progress／feedback）はread-only requirements／evidence inputであり、製品同期roleには含めない。

**public common byte-sync候補**

- `plugins/secretary/scripts/clarity.mjs`
- `plugins/secretary/scripts/lib/clarity-core.mjs`
- `plugins/secretary/scripts/lib/clarity-harness-scan.mjs`（new）

**Yasashii adapted候補**

- `plugins/secretary/collaboration-inventory.json`
- `scripts/lib/sprint-049-inventory.mjs`
- `scripts/sprint-042-collaboration-test.mjs`
- `.github/workflows/windows-recording-regression.yml`

**Yasashii supporting候補**

- `scripts/sprint-043-patch-003-test.mjs`（new）
- `scripts/sprint-043-patch-003-regression.sh`（必要な場合だけnew）
- `scripts/fixtures/sprint-043-patch-003/**`（Yasashii Case registry、actual action report、sanitized fixture）
- 既存`scripts/sprint-043-patch-002-test.mjs`／`scripts/sprint-043-patch-002-regression.sh`、Sprint 041〜043 suiteは原則protectedな直接回帰として使い、実依存がある場合だけactual roleを再分類する

**protected／excluded**

- generic `secretary/projects/open/<project>/clarity/`、Yasashii copy／style／identity、`edition.json`、overlay、manifest／marketplace、repository／install ID
- Xmind既定OFF、MCP-first、local fallback毎回preview＋明示承認、固定4象限色／配置／軸
- 17 Skills／62 behavior、Hook／Projects／daily／weekly／task／memory-care／build／update、既存Primary 250／CLX20／XV4／E2E4、CF／AR Case
- `README.md`、`LICENSE`、`AGENTS.md`、repo-owned`docs/**`、state／progress／feedback、release履歴、`secretary-overlay/**`
- private `vault/05_secretary`、`02` fallback、`vault/10_sources`、Notion TaskDB／relation、private root guidance、private値／顧客内容
- public／private state、spec、progress、feedback、workflow path、test番号はread-only入力でありblind copyしない

collaboration inventoryは`clarity-harness-scanner`相当のsurfaceを一つ追加し、既存19 surface＋新規1、既存41 assigned case＋HS 16の計57を排他的に検査する。17 Skills／62 behaviorの件数は変えない。overlay record／apply／check／reapplyの二回目追加差分は0件とする。

### F. source／clean／Git-freeとprotected surface

1. 同一candidateをYasashii source、detached clean checkout、Git-free archiveで評価し、それぞれの実行可能gateとNOT-RUN理由を分ける。
2. actual action reportはpath、role、action、before／public／private／after digest、mode、actual diffを実bytesから導出する。unknown、role重複、missing、extra、stale、unused、unclassified mutationを0件にする。
3. LF／CRLF portabilityは連続CRLFだけをLFへ正規化し、実content、path、mode、marker、missing／extra tamper検出を残す。expected digestだけの書換えやdigest検査無効化でgreenにしない。
4. tracked source、fixture、evidence、action reportへSecret、absolute利用者path、private内容、顧客識別子を混入させない。
5. protected surface、Clarity storage、Xmind policy、17／62、0.9.2、overlay、release integrityをcandidate前後で検査する。

### G. Windows external live gate

1. offline／synthetic／source／clean／archiveはnetwork／external write 0件を維持する。外部操作はexact candidate固定後だけに分離する。
2. 許可されたpushはbranch `codex/sprint-041-project-clarity`から既存`origin`同名PR #12 branchへの通常pushだけとし、candidate SHA、branch、remote、対象commit集合を記録する。force、remote URL変更、別branch、mergeを行わない。
3. 通常pushで既存PRのWindows workflowが起動する場合はそのrunを待つ。起動しない場合だけ、同じcandidate SHAを対象に既存workflowを`workflow_dispatch`できる。別SHA、別workflow、過去runを流用しない。
4. run未発火、認証／runner／timeoutは`windowsVerified=false`のverification-infra／`external-live-gate-unavailable`とする。runner内のClarity assertion failureはproduct／`implementation-issue`へ分ける。どちらもSprint PASSへ数えない。
5. run証拠はworkflow path／job、PR、run ID／URL、candidate SHA、OS／Node、command、PASS／FAIL／SKIP／NOT-RUN、capability、external write／network件数に限定する。

## Feature／Case単一割当

`yasashii-HS-001〜016`をすべてF77へ一度だけ割り当てる。既存F60〜F76、17機能／62 behavior、Primary 250、CLX 20、XV 4、E2E 4、`yasashii-CF-*`、`yasashii-AR-*`の意味、Severity、初回割当を変更しない。

| ID | Severity | 必須の観測 |
|---|---|---|
| yasashii-HS-001 | Critical | 2 MiB超でもauthoritative laneがstate、spec、Current正本群をgenericより先に確保 |
| yasashii-HS-002 | Critical | non-Harness／partial／invalidを分離し完全Harnessへ誤昇格しない |
| yasashii-HS-003 | Critical | 4 roleを意味分離し一つのCurrent bundleへ統合 |
| yasashii-HS-004 | Critical | feedback absentを`evaluation-not-yet-recorded`へ分離 |
| yasashii-HS-005 | Critical | valid／TBD／missing／invalidを維持し安全fallbackだけを根拠つき使用 |
| yasashii-HS-006 | Critical | 巨大stateをboundedに扱い解決不能をpartialへ分類 |
| yasashii-HS-007 | Critical | Secret-like／binary／symlink／permission／missingを本文非露出で分類 |
| yasashii-HS-008 | High | lane別budget、coverage、partial reasonを表示 |
| yasashii-HS-009 | High | 過去文書をItem化せずCurrent bundle一件、rerun digest安定 |
| yasashii-HS-010 | Critical | alias／physicalでidentity、候補意味／順序、coverage digest一致 |
| yasashii-HS-011 | Critical | preview／cancel／synthetic apply／failureで所有pathとGit／external安全を保持 |
| yasashii-HS-012 | Critical | Windows drive／backslash／空白／日本語／CRLFをnative実行 |
| yasashii-HS-013 | Critical | Windows collision／reserved／invalid／prefix siblingをfail closed |
| yasashii-HS-014 | Critical | symlink／junction capabilityを別観測し実行／SKIP／NOT-RUNを正直に集計 |
| yasashii-HS-015 | Critical | Yasashii workflow／PR #12／exact candidate／Node／timeout／commandを因果固定 |
| yasashii-HS-016 | Critical | portable inventory、source／clean／Git-free、既存Clarity／0.9.2回帰を同じcandidateで維持 |

## Acceptance Criteria

1. 固定public／private tupleとYasashii開始HEAD／tree／clean／branchを照合し、Yasashii product／test candidateを一意なcommit／treeへ固定する。
2. `yasashii-HS-001〜016`が同一candidateで全件PASSし、Critical未実行、duplicate／missing／extra、feature多重割当が0件である。High 2件のSeverityを弱めない。
3. 2 MiB超Harness fixtureでgeneric sourceが上限へ達しても、state、spec、Current contract／progress／feedback、guidance／packageのreserved laneを確保する。
4. state／contract／progress／feedbackを意味分離し、progressだけからPASSを推測せず、一つのCurrent bundle／Evidenceへ統合する。
5. Current valid／TBD／missing／invalid、feedback absent、巨大state、Secret／binary／symlink／permission／missingを固有coverageとreasonで扱う。unsafe fallback、無制限read、完全coverage誤表示は0件である。
6. authoritative／generic laneのlimits、usage、coverage、partial reasonsを返し、非Harness generic候補／上限／順序／安全意味を回帰させない。
7. alias／physicalでRepo identity、候補意味／順序、coverage digestが一致し、Patch 002のancestor alias／TOCTOU境界が0 FAILである。
8. preview／cancelは`changed:false`、synthetic applyは物理Repo内の宣言済みClarity所有pathだけを変更し、dirty／staged／untracked、HEAD、branch、remote、canary、networkを保持する。
9. Windows nativeでdrive／backslash／空白／日本語／CRLFのscanner／preview／identityがPASSする。
10. Windows nativeでcase collision、reserved／invalid、prefix sibling、別root／親子／兄弟／nested root、identity不明を固有reasonでfail closedにする。
11. Windows symlink／junctionを別capabilityで観測し、実行可能caseと理由付きSKIP／NOT-RUNを別集計する。別OS文字列模擬をWindows PASSへ数えない。
12. 既存Yasashii workflowの`windows-native`、Node 22、0.9.2回帰、10分timeoutを維持し、PR #12のexact candidateに因果するrunが0 product FAILである。
13. inventoryは20 surface、57 assigned case、17 Skills／62 behavior不変、duplicate／missing／extra 0で、LF／CRLF portabilityと実tamper検出を両立する。
14. public product／test差分、private adaptation、Yasashii actual diffをpath role、action、before／public／private／after digest、modeで排他的に説明し、unknown／stale／unused／unclassified mutationが0件である。
15. common byte-sync pathは固定public candidateとbytes／mode一致し、adapted pathはYasashii semanticsを維持し、supporting pathは実suiteから参照される。
16. generic storage、Xmind OFF／MCP-first／local承認、固定visual、17 Skills／62 behavior、Hook／Projects／daily／weekly／task／memory／build／update、overlay／identityに許可外変化が0件である。
17. private `05/02/10_sources/Notion`、private root guidance、Secret、absolute local path、private content、顧客識別子のYasashii source／tracked evidence混入が0件である。
18. 同一candidateのsource、detached clean checkout、Git-free archiveでTarget、Patch 001／002、Sprint 041〜043、inventory、0.9.2、protected／release回帰が0 product FAILである。Git必須面をGit-free PASSへ偽装しない。
19. overlayのrecord／apply／check／reapplyは二回目追加差分0件で、protected surfaceとexcluded pathを変更しない。
20. public／private／Fable PASSとYasashii verdict、source PASS、Windows live、release、install、cache、loaded／new session、実Xmindを別状態で表示する。
21. external writeは許可済みのexact branch通常pushと因果Windows CIだけである。force、merge、tag、Release、Marketplace、install／cache、実顧客apply、実Xmind、private writeは0件である。

## 必須negative control／fixture

- `src/`／`scripts/`だけで2 MiB超となるHarness Repo、同サイズnon-Harness、partial marker、invalid structure。
- Current valid／TBD／missing／注釈付きinvalid、安全fallback／unsafe fallback／fallback absent、feedback absent、巨大state／section unresolved。
- authoritative sourceごとのSecret-like、binary、内部symlink、permission、missing、case mismatch、path traversal／absolute injection。
- 多数の過去contract／progress／feedbackと一つのCurrent bundle。progressにPASS風表現がありfeedbackがFAIL／未作成のfixture。
- ancestor alias／physical、root自身、root内symlink、alias差替え、TOCTOU、dirty／staged／untracked、branch／remoteあり。
- Windows drive、backslash、空白、日本語、CRLF、8.3／long path、case-only collision、reserved／invalid参照、prefix sibling、親子／兄弟／nested root、identity unknown。
- Windows symlinkとjunctionのavailable／unavailableを別々に観測するfixture。
- workflow未起動、認証不能、runner timeoutと、runner内Clarity assertion failureの分類negative。
- public／private run、過去run、別SHA、macOS上のWindows風文字列から`windowsVerified=true`へ昇格する誤実装。
- action reportのrole overlap、unknown、missing／extra path、digest／mode／marker tamper、CRLF-only positiveと意味ある1 byte変更negative。
- private literal、absolute path、Secret canary、protected file変更、overlay二回目差分。

各negative fixtureは期待reason、PASS／FAIL／SKIP／NOT-RUN分類、`changed:false`または宣言済みsynthetic write、filesystem／Git／external operation／network件数を持つ。固定summary、source文字列scan、別OS模擬だけで成功できない。

## Verification scope（safe harbor）

- macOS／portableでは`yasashii-HS-001〜011`と016をOS一時directoryのsynthetic Git／non-Git Repoで実行し、Windows専用012〜015を理由付きNOT-RUNにできる。applyはsynthetic fixtureだけに限定する。
- Windowsでは既存`.github/workflows/windows-recording-regression.yml`の`windows-native` jobで012〜015を含む全16 Caseを実行する。Node 22、0.9.2 command、10分timeoutを維持する。
- case ID、feature、severity、fixture kind、OS／Node、command、exit、PASS／FAIL／SKIP／NOT-RUN、reason。
- lane別limits／usage／coverage／partial reason、Current／fallback、4 role、candidate bundle／Evidence locator、rerun digest。
- before／after filesystem tree、Clarity-owned diff、Git worktree／index／HEAD／branch／remote、external canary、network／external operation log。
- Windows capability、native path characteristics、workflow path／job／run、candidate SHA、PR、command、case totals、`windowsVerified`。
- actual path／role／action／digest／mode、inventory count／digest、overlay secondChanged=0、source／clean／Git-freeと既存回帰結果。

上記で十分とする。新しいcollector、統一attestation、実顧客data、実Repo apply、外部provider、browser screenshot、release／installを追加条件にしない。

## External live gate

candidate固定前はexternal write 0件。固定後に既存PR #12の同branchへ通常pushし、そのcandidateに因果するWindows CIを待つことはユーザーの既存承認範囲である。push／dispatchの主体はOrchestratorであり、Generator／Evaluatorは自分の自己評価をlive verdictへ流用しない。Windows gate未完了は`windowsVerified=false`のままSprint PASS不可とする。

## Non-scope

- 全Repo全文index、全Git履歴読込、全過去Sprint文書のItem化、global／per-file上限撤廃。
- 実顧客Repo、利用者workspace、Mac mini対象Repoへのinit／link apply、migration。
- private `05/02/10_sources/Notion`、private customer data、private source／spec／state変更。
- 新しいXmind provider挙動、実Xmind MCP、実local `.xmind` write、外部connector。
- Windows network share全般、全UNC変種、WSL／Windows任意path変換、Developer Mode／権限変更。
- version、manifest version、CHANGELOG、tag、GitHub Release、Marketplace、installed cache、new session、loaded version。
- force push、remote URL変更、別branch push、merge、実顧客apply、許可済みcandidate branch／因果Windows CI以外のexternal write。

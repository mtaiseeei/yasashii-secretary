# Sprint 043 Patch 002 — Yasashii正本repo freshnessとClarity限定ancestor alias

- Type: regular
- Risk: high（外部正本の現在判断、filesystem root identity、複数aliasのrequest lifecycle、全Clarity入口、Yasashii overlay境界を横断する）
- Base Sprint: `sprint-043`
- 依存: `sprint-043-patch-001` done
- Yasashii開始HEAD: `0763010ecc654091c3caa456eee7e18671311bda`、tree `4ae64d5194cec20bc8720c7910a143299736a41b`、開始時clean
- 対象機能: F60、F64、F69、F70、F71、F73、F74、F76
- 関連入口: F65のCLI、F66のHook、F72のprojectionを含むが、新しいFeature IDは増やさずF74／F76の安全・統合保証へ割り当てる
- 重点評価: C1は4以上、C2／C5／C6／C20／C22／C23／C25は5/5、C21／C24は4以上とする既存rubricをそのまま使う
- Target Case: public `CF-001〜CF-007`／`AR-001〜AR-014`のYasashii適応21件。global rubricや既存caseを増やさず、本契約内で`yasashii-CF-*`／`yasashii-AR-*`として区別する
- UI: status／daily／weekly／Portfolio／Clarity JSON・Markdownの状態表示。Web UI変更はなくbrowser screenshotは要求しない

## 目的

public Sprint 050 Patch 003でfresh独立評価PASSし、private版でも独立評価PASSした次の機能を、Yasashii版へ欠落なく適応する。

1. development-pointerの利用可能なlocal正本repoをstatus、daily、weekly、Portfolioで毎request boundedかつread-onlyに再観測し、古いworkspace snapshotだけで現在状態を断定しない。
2. Clarity指定入口だけがRepoより上のancestor symlink aliasを物理rootへ固定し、alias／physicalで同じidentityと結果を返す。root自身／内部／broken／file-target／差替えはfail-closedにする。
3. 同一physical rootの複数alias観測を一つのguardで上書きせず、request中は全live observationを保持する。成功／例外終了後はrequest所有handleをcleanupし、次requestへstale guardを残さない。

public／privateのbytesをblind copyせず、generic storage、17 Skills、62 Clarity behavior、やさしいcopy／style／identity、Projectsと周辺Skillの責務、Xmind default OFF、host別Hook manifestを保ったYasashii candidateとして独立評価する。

## 固定入力

### public

| 入力 | 固定値 |
|---|---|
| public product／test candidate | `51329fc05ea0e9e66f64aa5c3bf2ee2db168ed58` |
| public candidate Git tree | `c0b82e802389450b774fa9b4a433e94e19e87028` |
| public Patch開始HEAD | `e75a3f27ec894b03f705eff09b6e5f3f06b37cd7` |
| fresh Evaluator PASS feedback commit | `0f0407758f854633814b485b84e46af8a508044c` |
| final state commit | `68b77d0b557d34840c8b68916a2877e1a5d7b7a3` |

### private

| 入力 | 固定値 |
|---|---|
| private verification candidate | `5abad512ec415d0e6ca832653dd66eb90f8b2c45` |
| private candidate Git tree | `6399832d094f8f5e4bdf0e2237a3712454bc813c` |
| private Patch開始HEAD | `3277bbe75a1066afb3cea7d9261cc9cb0c18b9a3` |
| private product commit | `c92dfe53ba7345db57ac0e625e2d6ded8bc0bc38` |
| private product Git tree | `cbead854425a1485b546e62908fa8aaa2e31f0e6` |
| fresh Evaluator PASS feedback commit | `54e61975cecdc79bbbf54fa203a35528db0da8df` |
| final state commit | `5eec49fa5418b0fc612dd230420370ce68bb591e` |

public／privateのcontract、progress、feedback、stateはread-onlyの判断・証拠入力であり、Yasashii Harness正本または製品fileへcopyしない。各固定commitの現在branch、別candidate、working tree、後続commitへ暗黙追随しない。

public fresh PASSとして採用するのはPatch 003のCF 7件／AR 14件、複数alias guard、正常／例外request cleanupである。元Sprint 050の`done-by-user-decision`と残余を維持し、元SprintをEvaluator PASSへ書き換えない。private PASSはprivate版の適応を証明するが、Yasashii candidateのPASSではない。Fableの静的PASSは契約の意味・Severity・case割当・scopeを確認する助言証拠に限り、製品PASS、Evaluator証拠、state遷移へ数えない。

## 外から見える成果

- development-pointerのstatus、daily、weekly、Portfolioは、利用可能なlocal正本repoの最初に読むfile、Repo／Git／Clarity identity、revision、observed at、freshnessを現在根拠として示す。
- workspace snapshotと正本観測を分け、missing、unsafe、unreadable、stale、remote-onlyでは理由を表示し、「最新」「問題なし」「Driftなし」と断定しない。
- workspace ancestorだけがsymlinkのRepoは、利用者向けflagなしでClarity指定入口からphysical pathと同じ結果へ到達する。
- root自身／内部／broken／file-target／差替えは`changed:false`と固有理由を返し、旧／新rootを変更しない。
- alias／physicalのpreviewは`changed:false`で、applyのwriteは物理Repo内の宣言済み`.clarity/**`だけである。
- request中のalias差替えは重要read／writeの両方で停止し、request終了後はstale guardが残らず、次の正当なrequestを誤停止させない。

## Scope

### A. development-pointer canonical observation

1. `projectType: development-pointer`とProjects正本の`canonicalRepo`／「正本repo」参照を解決する。安全に利用できるlocal `canonicalRepo`があるrequestでは必ず読む。
2. local checkoutが実在する通常directoryなら、Project status、daily morning／evening、weekly、Portfolioで毎request自動的にbounded readする。
3. 最低限、pointerにある「最初に読むfile」、物理root基準のRepo identity、Git current state、Clarity canonical／stateの有無を確認する。
4. 観測はsource kind、availability、observed at、source revision、freshness、inspected／excluded／uninspected、理由を返す。workspace snapshotは履歴的要約として別に保つ。
5. 最初に読むfileは物理root内の安全な相対pathにある通常fileだけを対象とする。absolute path、traversal、symlink、missing、directory、上限超過を理由つきで除外する。
6. Secret／credential候補、binary、巨大file、transcript、顧客本文、root内symlinkを読まず、正本本文をworkspace、Clarity、log、Evidenceへ複製しない。
7. remote-onlyではclone／fetch／pull／checkout／networkを行わない。現在requestへ許可済みread-only provider evidenceが明示供給された場合以外は`unavailable`とする。

### B. Clarity限定ancestor aliasとphysical containment

1. 一般`workingRoot(value)`はoption省略／falseの両方でancestor symlinkを従来どおり拒否する。利用者向けallow flag、設定、環境変数を追加しない。
2. Clarity専用root resolverだけがrequest内で内部opt-inする。対象入口はCLI Repo root、core公開操作、link local Repo root、projection Repo root、Drift Repo root、Secretary adapterのlocal canonical／Clarity root、Hook cwd／Repo discoveryである。
3. 許可するのはRepoより上のancestor aliasだけである。working root自身、root内部の`.clarity`／write target、broken ancestor、通常file向きancestor、Drift Decision／implementation locator symlinkは従来どおり拒否する。
4. aliasをphysical rootへ固定し、filesystem identity、Repo identity、Git top-levelを一致させる。重要read、各write／rename直前にalias chainとidentityを再確認し、差替えは旧／新rootの双方へ副作用0件で停止する。
5. macOSの既存platform alias `/var`→`/private/var`、`/tmp`→`/private/tmp`を維持し、利用者のhome、workspace、volume pathをhard-codeしない。
6. alias／physicalは同じRepo identity、Git top-level、Clarity Project IDを返す。Event、Evidence、link bundle、projection等のtracked dataへalias／physicalのabsolute local pathを保存しない。

### C. 複数alias guardとrequest lifecycle

1. 同一physical rootを指す異なるaliasは別live observation tokenを持ち、後のresolveが先のguardを上書きしない。
2. 同一request内の同一観測はtokenへdedupeし、追加leaseを無制限に残さない。別alias tokenは独立に保持する。
3. root guardはrequest中に残る全live observationのrequested path、alias chain、physical root、Repo／Git identityを重要read／write直前に再確認する。
4. alias 1が差し替わった場合、alias 2が同じphysical rootを観測中でもalias 1 handleのread／writeを`changed:false`で拒否し、alias 2の観測を消さない。
5. CLI、core、link、projection、Drift、Secretary adapter、Hookの実入口はrequest scopeへ参加し、result renderまたは例外処理直前までhandleを保持する。
6. 正常returnとthrowの双方で、request scopeが所有するhandleだけを逆順解放する。timeout、process global clear、次request開始時の掃除に依存しない。
7. request終了後は旧guardを次requestへ残さず、旧physical rootを正当な新requestで再利用できる。root文字列による全clearを製品request lifecycleに使わない。

### D. write／Git／portable metadata境界

1. status、daily、weekly、Portfolio、preview、link identity、canonical observationはwrite 0件である。
2. apply positiveはOS一時directoryのsynthetic fixtureだけで行い、宣言済みの物理Repo内`.clarity/**`だけを変更する。workspace側PJ、alias別tree、peer Repo、外部canaryへwriteしない。
3. dirty／staged／untracked、HEAD、branch、remoteをpositive／negativeの前後で保持する。fetch、pull、push、checkout、branch／remote変更、network callを行わない。
4. Git-free archiveではGit依存を起動せず、利用不能なGit情報を正直に示したまま必須Patch suiteを実行できる。

### E. Yasashii実分類と保護

固定public Patchの実製品差分とprivate product適応を、Yasashii開始HEADに対する実candidate差分へ次のseamで適応する。これは予定分類であり、Generatorはactual path、actual action、before／public／private／after digestから再計算し、未変更pathを`changed`と手書きしない。

**public byte-sync候補 9件（edition非依存）**

1. `plugins/secretary/scripts/clarity-hook.mjs`
2. `plugins/secretary/scripts/clarity.mjs`
3. `plugins/secretary/scripts/lib/clarity-core.mjs`
4. `plugins/secretary/scripts/lib/clarity-drift.mjs`
5. `plugins/secretary/scripts/lib/clarity-hook.mjs`
6. `plugins/secretary/scripts/lib/clarity-link.mjs`
7. `plugins/secretary/scripts/lib/clarity-projection.mjs`
8. `plugins/secretary/scripts/lib/clarity-root.mjs`（Yasashiiでは新規）
9. `plugins/secretary/scripts/lib/safe-fs.mjs`

**Yasashii adapted候補 3件**

1. `plugins/secretary/collaboration-inventory.json`
2. `plugins/secretary/scripts/clarity-secretary.mjs`
3. `plugins/secretary/scripts/lib/clarity-secretary.mjs`

adapted 3件はgeneric storage、Yasashii Projects／daily／weekly／Portfolio、copy、source marker、inventory digestを保つ。public／private adapterをblind copyせず、publicのbytesと一致する必要もない。

**supporting／read-only入力**

- public Patch 003 contract／progress／feedback／state、Target 21件のtest／inventory wrapperと実装本体
- private Patch 002 contract／progress／feedback／state、product classification／actual action／root policy inventory
- Yasashiiの既存Clarity regression、fixtures、overlay definition、protected inventory、Patch 001のhost manifest negative
- supporting fileはbehavior、case、入口、digestの照合にだけ使い、product mutationまたはbyte-sync候補へ数えない

**protected／excluded**

- `secretary/projects/open/<project>/clarity/`のgeneric storage。private `vault/05_secretary/`、02 fallback、`vault/10_sources/`、Notion-specific route、private 4 extensions、private identity／固有値を同梱しない
- 17 Skills、62 Clarity behavior、Projects／task／daily／weekly／collaboration／Hookの既存責務。Projectsはlifecycle／`canonicalRepo`、ClarityはDecision／Execution／Validation／Attention／Driftを所有し、task化は明示委譲だけとする
- memory二重保存0、Harness state非置換、自動update／connector 0、build／settings／onboarding／templates／rulesの責務維持
- やさしいcopy／style／identity／edition／overlay／protected marker、README、LICENSE、AGENTS、CLAUDE、accepted済みspec／contract／progress／feedback／receipt履歴
- Claude manifestの`hooks` fieldなし、Codex manifestの共通Hook参照あり、共通`hooks/hooks.json`とHook event／matcher／command／timeout／router semantics
- Xmind default OFF、MCP優先、local fallbackは毎回preview後の明示承認、固定4色・位置・軸
- release／host inventoryの未実施状態、public／private source、Harness role-owned `docs/**`

actual diff／digestでpublic byte-sync 9件、Yasashii adapted 3件、supporting、protected、Harness docsを一つの最新manifestとactual action reportへ排他的に分類する。unknown、stale、unused、unclassified、role overlap、未分類mutationをすべて0件にする。既存のaccepted overlay receiptや旧snapshot wrapperを現在candidateへ書き換えず、現在candidateを理解する隔離fixtureでoverlay／protectedの再適用と二回目no-extra-diffを検証する。

## Feature／Caseの単一割当

- CF-001／002／004／005相当 → F69
- CF-003／006相当 → F70
- CF-007相当 → F76
- AR-002相当 → F60
- AR-003相当 → F64
- AR-009相当 → F71
- AR-011相当 → F73
- AR-001／004〜008／010／012／013相当 → F74
- AR-014相当 → F76

各Yasashii Target Caseは本契約に一度だけ現れ、Yasashii featureを一つだけ持つ。public caseの意味とSeverityを弱めず、既存rubric、既存17機能／62 behavior matrix、既存case ID／履歴を再採番・再定義しない。

## Target Case 21件

| ID | Severity | Yasashiiで必須の観測 |
|---|---|---|
| yasashii-CF-001 | Critical | alias配下を含むlocal canonical repoをstatusがbounded readする |
| yasashii-CF-002 | Critical | stale workspace snapshotとcurrent canonical evidenceを分離する |
| yasashii-CF-003 | Critical | daily／weekly／Portfolioがstatusと同じ観測意味を使う |
| yasashii-CF-004 | Critical | remote-onlyからnetwork／Git operation 0、truthful unavailable |
| yasashii-CF-005 | Critical | Secret／binary／large／symlink本文read 0 |
| yasashii-CF-006 | Critical | missing／unsafe／unreadable／staleを固有理由で表示する |
| yasashii-CF-007 | Critical | canonical observation前後のfilesystem／Git／generic正本が不変 |
| yasashii-AR-001 | Critical | 一般`workingRoot`省略／falseは拒否し、Clarityだけ内部opt-in |
| yasashii-AR-002 | Critical | alias／physicalの未初期化時の次判定と初期化済み結果が一致 |
| yasashii-AR-003 | Critical | Repo／Git／Clarity identityが一致 |
| yasashii-AR-004 | Critical | preview `changed:false`、synthetic applyは物理`.clarity/**`だけ |
| yasashii-AR-005 | Critical | root自身symlinkを固有理由で拒否 |
| yasashii-AR-006 | Critical | root内部`.clarity`／write target symlinkを追わない |
| yasashii-AR-007 | Critical | broken ancestorをinspection／write前に拒否 |
| yasashii-AR-008 | Critical | 複数alias token／lease、request中read／write fail-closed、段階cleanup／reuse |
| yasashii-AR-009 | Critical | tracked link／Event／Evidence／projectionにabsolute local path 0 |
| yasashii-AR-010 | Critical | dirty／staged／untracked、HEAD、branch、remoteを保持 |
| yasashii-AR-011 | Critical | Drift locator symlinkをread-onlyで拒否しEvidence／Git変更0 |
| yasashii-AR-012 | Critical | macOS `/var`／`/tmp`回帰、利用者path hard-code 0 |
| yasashii-AR-013 | Critical | file-target ancestorを固有理由で拒否 |
| yasashii-AR-014 | Critical | 正常／例外request cleanupとCLI／core／link／projection／Drift／Secretary adapter／Hook実入口。全入口の結果からroot policy sourceが`clarity-internal-root-resolver`等のClarity internal opt-in由来と識別できる |

全21件をCritical扱いとする。うちyasashii-AR-008とyasashii-AR-014は、共有helperのunit test、source scan、固定summaryだけではPASSにせず、さらに独立した実入口操作証拠を必須とする。

## Yasashii protection negative

Target 21件に加えて次の負例を既存Yasashii回帰で確認する。新しいrubric case IDは増やさない。

1. generic storage以外へのClarity write、private 05／02／10_sources／Notion-specific／private 4／private identityの流入。
2. Clarity ItemからTODO／TaskDBの自動作成、Projects lifecycleの奪取、daily／weeklyの全scan、memory二重保存、Harness state置換、自動update／connector。
3. 17 Skills／62 behavior、やさしいcopy／style／identity／edition／overlay／protected markerの欠落・public化・private化。
4. Xmind default ON化、MCP優先順位変更、local fallback承認の再利用、固定色／位置／軸変更、実Xmind write。
5. Claude manifestへ`hooks`を再追加、Codex manifestから共通Hook参照を削除、共通Hook二重登録、Hook event／matcher／command／timeout／router semantics変更。
6. accepted済みHarness docs、state、progress、feedback、receipt、release／host metadataを製品同期として上書き。

固定Xmind visualは、左上「定着・検証」緑`#16A34A`、右上「実行待ち」青`#2563EB`、左下「暫定実装・要再確認」黄`#D97706`、右下「設計・意思決定」赤`#DC2626`、上「決まっている」、下「まだ決まっていない」である。

## Non-scope

- release、version bump、CHANGELOG、release inventory、tag、push、PR、GitHub Release、Marketplace publication／snapshot。
- install、cachebuster、installed plugin／cache、reinstall、new session、loaded version、Claude Code／Codex live host検証。
- 実Yasashii workspace、実顧客repo、Mac mini対象repoへのread／write／apply。
- 実顧客repoの`init --apply`。Yasashii fresh Evaluator PASS後も、対象、write予定、rollbackを示した別の明示確認gateを必要とする。
- 実Xmind MCP／local `.xmind`、Notion、Chatwork、Google Chat、connector／provider、remote、networkへのread／write。
- public／private source、spec、state、progress、feedbackの変更、remote downstream。
- 一般filesystemのancestor symlink許可、利用者向けallow flag、clone／fetch manager、background polling、全Repo全文index。
- 既存rubricの基準／閾値、CF 7／AR 14の意味、Yasashii F60〜F76、17機能／62 behavior、accepted履歴の再定義。

release、install、cache、live、実workspace、実顧客repo、public／private source、実Xmind、外部serviceへの操作は0件である。

## Acceptance Criteria

1. 固定public／private tuple、Yasashii開始HEAD／tree、開始clean状態が一致し、別candidate／branch先端／改変feedbackを入力として受け入れない。
2. yasashii-CF-001〜007、yasashii-AR-001〜014の21件が同一Yasashii candidateで全件PASSし、Critical未実行、Target case重複、未割当、余分なcaseが0件である。
3. local development-pointerのstatus、daily、weekly、Portfolioが、最初に読むfile、Repo／Git／Clarity identity、observed at、revision、freshness、inspected／excluded／uninspectedを毎request bounded readする。
4. remote-only、missing、unsafe、unreadable、staleは理由を表示し、snapshotだけからcurrent／aligned／no driftを断定しない。clone／fetch／pull／checkout／network／Git writeは0件である。
5. Secret／credential候補、binary、上限超file、root内symlinkの本文readと、正本本文のworkspace／Clarity／log／Evidenceへの複製が0件である。
6. 一般`workingRoot()`はoption省略／falseでancestor aliasを拒否する。Clarity指定入口だけが利用者操作なしでphysical rootへ到達し、一般filesystem／他Skillへ許可を伝播させない。
7. alias／physicalの未初期化判定、初期化済み結果、Repo／Git／Clarity identityが一致し、tracked metadataへのabsolute local pathが0件である。
8. alias／physicalのpreviewは`changed:false`で同じ対象を示す。apply fixtureのwriteは物理Repo内の宣言済み`.clarity/**`だけで、workspace、alias別tree、peer Repo、外部canaryは不変である。
9. root自身、root内部、broken、file-target、Drift source locatorを固有理由で拒否し、全対象へ副作用0件である。macOS `/var`／`/tmp`回帰も成立する。
10. 同一physical rootの複数alias token／leaseを上書きせず、request中の差替えは重要read／writeの双方で`changed:false`となり、旧／新Repo bytesとGitが不変である。
11. 正常完了と例外終了の双方でrequest所有handleだけをcleanupし、別aliasのlive guardを消さず、次requestへstale guardを残さない。cleanup後は正当な旧physical／現在alias rootを再利用できる。
12. CLI、core、link、projection、Drift、Secretary adapter、Hookの実入口が同じrequest lifecycle／physical containmentを使い、各結果からroot policy sourceが`clarity-internal-root-resolver`等のClarity internal opt-in由来と識別できる。共有helperの存在だけで全入口PASSにしない。
13. positive／negative fixtureのdirty／staged／untracked、HEAD、branch、remoteが不変で、宣言済みsynthetic `.clarity/**` apply以外のfilesystem／Git／external writeとnetwork callが0件である。
14. 固定public実diffのbyte-sync 9件、Yasashii adapted 3件、supporting、protected、Harness docsがactual action reportへ排他的に反映され、actual diff、before／public／private／after digest、mode、実行回帰がcandidateと一致する。unknown、stale、unused、unclassified、role overlap、未分類mutationは0件である。
15. generic storage、Projects／task／daily／weekly／collaboration／Hook責務、17 Skills／62 behavior、やさしいcopy／style／identity／edition／overlay／protectedに許可外変化が0件で、private 05／02／10_sources／Notion-specific／private 4／private identityを同梱しない。
16. Claude manifestは`hooks` fieldなし、Codex manifestは共通Hook参照あり、共通Hook／router semanticsは維持され、Duplicate hooksを再発させない。
17. Xmind default OFF、MCP優先、local fallback毎回承認、固定4色／位置／軸を維持し、実Xmind writeは0件である。
18. 現在candidateを理解する隔離fixtureでoverlay／protected分類と二回目no-extra-diffが成立し、accepted済みreceipt／旧snapshot wrapper／downstream-owned fileを改変しない。
19. 同一candidateのYasashii source、clean checkout、Git-free archiveでTarget 21件、Yasashii protection negative、関連回帰が0 product FAILとなる。環境／verification-infraの未完走を製品PASSへ偽装しない。
20. Fable静的review、public PASS、private PASS、Generator自己評価、別candidateの証拠をYasashii製品PASSまたはEvaluator証拠へ数えない。
21. release、install、cache、loaded／live、実workspace、実顧客repo、public／private source、remote、実Xmind、外部serviceへの操作0件を未実施のまま表示する。

## 必須negative control／fixture

- 一般`workingRoot`のoption省略／falseと、同じancestor aliasに対するClarity内部opt-in。
- root自身symlink、root内部`.clarity`／write target symlink、broken ancestor、file-target ancestor、Drift locator symlink。
- 同じphysical Repoを指すalias 1／alias 2、同一alias反復、alias 1だけのretarget、同path inode差替え、request中／request後のread／write。
- 正常request反復後のalias retargetと旧physical別request、例外request後の同じ再利用。
- remote-only、local missing、unsafe root、unreadable、missing first file、Secret、binary、上限超file、内部symlink、scan limit。
- dirty／staged／untracked、branch／remoteを持つsynthetic Git Repoと、`.git`なしGit-free archive。
- link bundle／Event／Evidence／projectionへのalias／physical absolute path混入。
- Claude／Codex manifestのhost別期待を逆転または重複させたfixture。
- generic storage、17 Skills／62 behavior、Projects／task／daily／weekly／collaboration／Hook、copy／style／identity／edition／overlay／protected、Xmind、private exclusionのcanary。

各negativeは期待error／availability reason、非0 exitまたはtruthful unavailable、`changed:false`、filesystem／Git／external operation 0を持つ。

## Verification scope（着手時に固定）

- 対象: exact Yasashii source candidate、clean checkout、同一bytesのGit-free archive、OS一時directory内のsynthetic generic workspace／development-pointer／Git Repo／ancestor alias fixture。
- 必須: AC1〜21、Target 21件、Yasashii protection negative、実入口matrix、actual classification、Patch 001 manifest negative、既存Yasashii Clarity／storage／inventory／overlay回帰。
- 増分評価: 実git diffで変更面を直接再評価し、未変更面は同一candidateかつclean／green条件で既存証拠を再利用できる。未完走suiteを実行済みPASSと表示しない。
- UI: JSON／Markdownのsource、freshness、reason、`changed:false`を確認する。Web browser screenshot、実host live、実Xmindは要求しない。
- 外部操作: release、install、cache、new session、実workspace、実顧客repo、実Xmind、実host、public／private source、remote、provider／connector、networkは0件。

### Evidence safe harbor

- 固定public／private tupleのcommit／tree、Yasashii開始HEAD／tree、source／clean／archiveのcandidate identity、開始／終了`git status --short`。
- case ID、fixture root識別子、command、exit code、期待／観測error codeまたはavailability reason。absolute pathは一時評価証拠だけに置き、tracked product dataへ残さない。
- status／daily／weekly／Portfolioのsource kind、observed at、revision、freshness、inspected／excluded／uninspected、read件数／bytes上限。
- requested alias／physical root、filesystem／Repo／Git／Clarity identityの一致、token／lease／ownership handle、request中guard、正常／例外cleanup、次request reuse。
- yasashii-AR-008の複数alias／lease／read-write guard／正常・例外cleanup実入口記録と、yasashii-AR-014の全実入口matrix。後者は各結果の既存field／出力からroot policy sourceが`clarity-internal-root-resolver`等のClarity internal opt-in由来と識別できる記録を含む。
- before／after filesystem tree digest、`.clarity/**` diff、external canary、Git worktree／index／HEAD／branch／remote snapshot。
- pathごとのrole、actual action、actual diff、mode、before／public／private／after digest、role intersection、unknown／stale／unused／unclassified件数。
- generic storage、17 Skills／62 behavior、Projects／task／daily／weekly／collaboration／Hook、copy／style／identity／edition／overlay／protected、Xmind、host別manifest、private exclusionの名前つきbefore／after。
- suite command、assert数、exit code、product／verification-infra／NOT-RUNの分離、external operation log、Secret canary非露出。

上記で十分とし、新しいcollector、統一attestation、証拠schema、global rubric case、実顧客data、実provider／network、release、install、cache、実host、実Xmind、実workspace、public／private操作を追加条件にしない。Fable静的reviewは助言証拠に限り、Yasashii PASS証拠ではない。

## 完了条件

Generatorは本Patchだけを実装し、同一Yasashii candidate、public／private→Yasashii実分類、Target 21件、Yasashii protection negative、source／clean／Git-free、実入口lifecycle、回帰、NOT-RUN、external write 0を`docs/progress/sprint-043-patch-002.md`へ引き渡す。

Evaluatorはfreshな別作業単位でcandidateを実操作し、`docs/feedback/sprint-043-patch-002.md`だけへ全Acceptance Criteria、C1／C2／C5／C6／C20／C21／C22／C23／C24／C25、case 21件、findings、証拠、Verdictを書く。C21／C23を含む基準と閾値は既存rubricの値をそのまま使い、新しい基準、case、証拠schemaを作らない。Generator自己評価、Fable静的review、public／private PASS、別candidateの証拠をYasashii PASSへ流用しない。

fresh Evaluator PASSとOrchestratorの`docs/sprints/state.md`更新後だけ完了とする。実顧客repo `init --apply`、release／install／cache／live、workspace migration、public／private source、remote、実Xmindへ進まない。

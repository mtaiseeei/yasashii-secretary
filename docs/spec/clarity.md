# Project Clarity Yasashii展開

## 目的

Project Clarity（クラリティ）は、プロジェクトで決まっていること、進めたこと、確かめたこと、今人が考える必要があること、前提とのずれを分けて見せる。Projectsはプロジェクトの作成・更新・完了・再開というlifecycleを引き続き所有し、ClarityはDecision／Execution／Validation／Attention／Driftを所有する。

Yasashii版は、公開版の全機能を欠落なく取り込みながら、平易で読みやすい文体、Yasashiiのedition identity、`harness@yasashii-harness`、宣言済みoverlay、repo-owned正本を上流値で上書きしない。

## 固定入力と判定の意味

| 項目 | 固定値 |
|---|---|
| Yasashii base | `c6cfb40a6026c5447a8ec4729f517adb4cc51031` |
| public product candidate | `5f08d454c05576fcff8ab32c10c00887b4c15a96` |
| public tree digest | `1fbffe636565355b875dcde35ff05d26cd7e15f00710c1c88a563866749037c5` |
| public common digest | `4aa6e8d4b21aa9e0020cfaa6edefd5ff0e6640fd2e8f937db00478190142f849` |
| public ready handoff | `/private/tmp/project-clarity-handoff-20260829/ready-handoff.json` |
| public ready handoff file SHA-256 | `09c3fa1289fa0af4d31c084a74ab108ce5cf85bcf3b3e7c9320cab72758d83c0` |
| public status | `public-user-decision-risk-accepted`、`evaluatorPass=false` |
| private product candidate | `d5598226213004d55781ca033985589907ae7b5d` |
| private product tree | `920aea5d09b1aa51fcb5ebe23ab242a538c50445` |
| private final PASS feedback commit | `556c80117c7a1db8f2dd4eabb997277d47e02a51` |
| private feedback SHA-256 | `aa502ca0b3b53ece16822edc39b60b9a587b93c15f701ce1ad6578c2b9f47774` |
| private PASS receipt | `/private/tmp/agentic-secretary-my-vault-clarity/scripts/fixtures/sprint-050/private-pass-receipt.json` |
| private receipt file SHA-256 | `bf6893f3891b10b9b86669308e123008f09eae05d6d8330a477eb1614a456745` |
| private receipt internal SHA-256 | `0aac84a3d1beadcc7820a495205f292c4491e1758c5c9349a8ee523e68e82122` |

公開版はEvaluator PASSではない。元の`verification-scope-issue`と`evaluatorPass=false`を保ち、ユーザーが受容したhost live残余だけを`public-user-decision-risk-accepted`として扱う。private版のfresh Evaluator PASSはprivate版だけの判定であり、public host live、実Xmind、release、cache、新sessionを昇格させない。

private receiptの検証とprewrite検査はexit 0で、次に許される操作は`yasashii-prewrite-only`、`writesAuthorized=false`である。これはSprint 041でYasashii用prewrite receiptを作る許可であり、製品適用、release、push、public/private書換えの許可ではない。

## 公開17機能とYasashii 17機能の一対一対応

| 公開版 | Yasashii版 | 挙動数 | 主題 |
|---|---|---:|---|
| F64 | F60 | 3 | identityと4モード |
| F65 | F61 | 3 | Event／Evidence／State |
| F66 | F62 | 3 | Decision×Executionの4象限 |
| F67 | F63 | 3 | Attention |
| F68 | F64 | 3 | init／review／doctor／migration |
| F69 | F65 | 3 | Skill／CLI／manual fallback |
| F70 | F66 | 5 | command-only lifecycle Hook |
| F71 | F67 | 4 | Markdown／Mermaid |
| F72 | F68 | 8 | Xmind provider projection |
| F73 | F69 | 4 | generic Secretary-local統合 |
| F74 | F70 | 3 | daily／weekly／Portfolio |
| F75 | F71 | 3 | reciprocal link |
| F76 | F72 | 3 | pull sync／authority／conflict |
| F77 | F73 | 3 | Drift Detection |
| F78 | F74 | 3 | 安全性／競合安全性／冪等性 |
| F79 | F75 | 4 | public-first downstream適用 |
| F80 | F76 | 4 | collaboration inventory |
| **計** | **17機能** | **62** | 欠落・重複・未分類0件 |

## 62 behaviorの単一割当

固定public candidateのF64〜F80にある全behavior bulletを、次のIDで一度だけYasashiiへ割り当てる。GeneratorとEvaluatorは見出しの存在ではなく、この62 IDの実装面・scenario・結果を機械照合する。

| Behavior ID | 対応 | Yasashiiで必ず保つ挙動 |
|---|---|---|
| PC-F60-B01 | public F64-1 | 正式名称Project Clarity、日本語表示クラリティ、namespace `clarity` |
| PC-F60-B02 | public F64-2 | Standalone Repo／Secretary-local Project／Linked External Repo／Portfolioを同じcoreで扱う |
| PC-F60-B03 | public F64-3 | immutableなProject IDを持ち、後からlinkしてもIDと履歴を変えない |
| PC-F61-B01 | public F65-1 | 状態遷移Event、本文を複製しないEvidence、再構築可能なStateを分離する |
| PC-F61-B02 | public F65-2 | Evidenceは最小locatorと短い要約だけを持ち、Secret／全文／顧客本文を保存しない |
| PC-F61-B03 | public F65-3 | Markdown／Mermaid／Xmindは再生成可能なprojectionで、手編集を正本にしない |
| PC-F62-B01 | public F66-1 | DecisionとExecutionから`stabilize`／`execute`／`validate`／`decide`を常に再計算する |
| PC-F62-B02 | public F66-2 | AI推定は`proposed`／`inferred`に留め、明示正本や人間確認なしに`confirmed`へ進めない |
| PC-F62-B03 | public F66-3 | `idea`、期限前`deferred`、`rejected`／`superseded`を現在AttentionとActive Matrixから適切に分ける |
| PC-F63-B01 | public F67-1 | 無承認実装、決定済み未実行、Drift、validation失敗、stale、conflict、Evidence不足を理由つきで抽出する |
| PC-F63-B02 | public F67-2 | 起動時とdailyは最大3件程度、結論→理由→根拠→選択の順で示し、残りを畳む |
| PC-F63-B03 | public F67-3 | 単一進捗率や不透明なAI scoreを主要価値にせず、件数、lag、freshness、解消時間を使う |
| PC-F64-B01 | public F68-1 | 未導入Repoをbounded／read-onlyで解析し、予定、候補、競合、除外、未確認範囲をpreviewする |
| PC-F64-B02 | public F68-2 | 明示確認後だけ初期化し、retryでItem／Event／commitを重複させない |
| PC-F64-B03 | public F68-3 | doctorはmode／schema／Hook／link／projection／lockを診断し、migration／cleanupはpreviewとapplyを分ける |
| PC-F65-B01 | public F69-1 | `clarity` Skill 1つでstatus／init／scan／review／checkpoint／decide／validate／drift／map／xmind／link／sync／portfolio／history／doctor／migrateを扱う |
| PC-F65-B02 | public F69-2 | 反復処理はsafe path、atomic write、JSON output、partial failure、idempotent retryを持つ決定的CLIへ分ける |
| PC-F65-B03 | public F69-3 | Hook未信頼／無効／失敗でも自然言語またはSkillからstatus／review／checkpointを完遂できる |
| PC-F66-B01 | public F70-1 | plugin rootの`hooks/hooks.json`と軽量command router 1組でhost payload差を正規化する |
| PC-F66-B02 | public F70-2 | SessionStart／PostToolUse／PreCompact／compact後再開／Stop／SessionEndをboundedに扱い、Hook内network／LLM／Xmind／全scanを0件にする |
| PC-F66-B03 | public F70-3 | 未初期化／未linkedは高速no-op、同時発火でもevent破損／重複checkpointを0件にする |
| PC-F66-B04 | public F70-4 | Codex trust未承認／無効とClaude plugin無効をdegradedとして表示し、host結果を相互昇格しない |
| PC-F66-B05 | public F70-5 | routerはClarity専用とし、他Skill独立Hookやmemory候補の意味判定を追加しない |
| PC-F67-B01 | public F71-1 | overview／Attention／4象限とmatrix／structure／dependency／state flowのMermaidを生成する |
| PC-F67-B02 | public F71-2 | 同じ入力はbyte安定し、Item ID由来のstable配置で重なりを軽減する |
| PC-F67-B03 | public F71-3 | Mermaid描画不能でもraw `.mmd`とMarkdownを残し、Clarity本体を失敗にしない |
| PC-F67-B04 | public F71-4 | q1右上青、q2左上緑、q3左下黄、q4右下赤を固定し、emoji／label／意味を併記する |
| PC-F68-B01 | public F72-1 | `xmind.enabled`とprovider capabilityを分け、Yasashii既定OFF、明示ON／OFFを可能にする |
| PC-F68-B02 | public F72-2 | ON時はcapableなXmind MCPを第1優先、local `.xmind`を明示承認後の第2優先にする |
| PC-F68-B03 | public F72-3 | `mcp-selected`／`fallback-approval-required`／`local-selected-after-approval`／`stopped`とreasonを区別し、未接続等をverifiedへしない |
| PC-F68-B04 | public F72-4 | cloud／external／network／creditとlocal fallbackを対象・影響preview後の明示承認だけでwriteし、拒否／無回答は0件にする |
| PC-F68-B05 | public F72-5 | matrixとproject structureの2 Sheet相当、stable Item IDを生成し、固定visual capability不足は停止する |
| PC-F68-B06 | public F72-6 | TL緑`#16A34A`、TR青`#2563EB`、BL黄`#D97706`、BR赤`#DC2626`、上=決まっている、下=まだ決まっていないを厳密に守る |
| PC-F68-B07 | public F72-7 | Xmind nodeとClarity Itemをstable IDで対応づけ、既存無関係Sheet／branchを保持する |
| PC-F68-B08 | public F72-8 | Xmind編集はproposalへ戻し、人間確認前に状態を確定せず、Hook内provider呼出しを0件にする |
| PC-F69-B01 | public F73-1 | `secretary/projects/open/`、`PROJECT.md`、Decision／memory、project resolverを再利用し、Clarity Item本文をPROJECTへ埋め込まない |
| PC-F69-B02 | public F73-2 | open／closed、作成／完了／再開、PJ Decisionを置換せず、mode／Attention／最重要項目／link healthだけを短く加える |
| PC-F69-B03 | public F73-3 | private `05/02`、`vault/10_sources`、Notion routingの実装を同梱せず、公開adapter seamだけを保つ |
| PC-F69-B04 | public F73-4 | Projectsはlifecycle／`canonicalRepo`、ClarityはDecision／Execution／Validation／Attention／Driftを所有し、所有権を交換しない |
| PC-F70-B01 | public F74-1 | daily morningは予定／TODO／中断点と分けた「今日の要確認」を最大3件程度示す |
| PC-F70-B02 | public F74-2 | eveningはDecision／実装観測／候補／Drift／持越しを分け、weeklyは増減／lag／解消Drift／staleを扱う |
| PC-F70-B03 | public F74-3 | Portfolioはopen projectの最小projectionだけを集め、closedと全Item本文を通常読込しない |
| PC-F71-B01 | public F75-1 | prepare／accept／finalizeで双方のProject ID／Repo identity／link ID／digest／authorityを相互確認する |
| PC-F71-B02 | public F75-2 | Link metadataへSecret／資格情報／absolute local path／顧客本文を保存しない |
| PC-F71-B03 | public F75-3 | 既存Standalone IDを維持し、duplicate／tamper／target不一致を副作用0件で拒否する |
| PC-F72-B01 | public F76-1 | 相手exportをread-only取得し、自Repoのimport projectionだけをpreview後に更新し、cross-root write／暗黙pushを0件にする |
| PC-F72-B02 | public F76-2 | fieldごとにPrimary／Reference／Shared derivedを持ち、Primary重複とlast-write-winsを拒否する |
| PC-F72-B03 | public F76-3 | stale／schema不一致／削除／authority違反を隠さず、resolutionを新Eventとして残す |
| PC-F73-B01 | public F77-1 | Decision／spec／ADR／顧客合意とcode／commit／test／成果物Evidenceを比較する |
| PC-F73-B02 | public F77-2 | 根拠が弱ければ`possible_drift`、両側根拠が揃えば`drift`とし、双方の根拠を示す |
| PC-F73-B03 | public F77-3 | Decision変更／実装修正／例外承認のどれでも履歴を消さず、解消後だけActive Attentionから外す |
| PC-F74-B01 | public F78-1 | root／symlink／junction／traversal／dirty／stage／Secret／schema／lockを安全側に扱う |
| PC-F74-B02 | public F78-2 | concurrent Hookは危険な共有JSON read-modify-writeへ依存せず、atomic write／lock／一意eventで破損と重複を防ぐ |
| PC-F74-B03 | public F78-3 | apply／migration／sync／checkpoint失敗は利用者差分を巻き戻さず、partialとretryで一状態へ収束する |
| PC-F75-B01 | public F79-1 | Skill／Hook／host inventory／manifest／marketplace metadata／archive／clean checkoutをYasashii editionとして整合させる |
| PC-F75-B02 | public F79-2 | Claude Code／Codex、Desktop／CLIのsupported／verifiedを分け、1 surfaceのPASSを他へ昇格しない |
| PC-F75-B03 | public F79-3 | 固定public handoffとprivate PASS receiptを前提に、共通path、adaptation、除外・保護path、rollbackをYasashii別Harnessで固定する |
| PC-F75-B04 | public F79-4 | push／tag／Release／marketplace／cache／実downstream反映をこの3 Sprintの対象外にする |
| PC-F76-B01 | public F80-1 | secretary／projects／daily／weekly／task collaboration／memory-care／build／update／onboarding／templates／rules／host／release／edition handoffをinventoryする |
| PC-F76-B02 | public F80-2 | 各surfaceのread／write／delegate／no-touch、manual／Hook入口、外部操作、正本、edition、回帰を明示する |
| PC-F76-B03 | public F80-3 | task化は明示委譲のみ、memory二重保存0、Harness state非置換、自動update／connector 0を負検査する |
| PC-F76-B04 | public F80-4 | file名だけで合格にせず、実内容marker、routing fixture、前後snapshot、inventory digestで漏れと旧契約再流入を検出する |

## Yasashii所有境界

- Clarityの保存先はgenericな`secretary/projects/open/<project>/clarity/`だけとする。private版の`05/02`、`vault/10_sources`、Notion property／relation、private root guidance、実顧客dataを持ち込まない。
- `plugins/secretary/hooks/hooks.json`、`plugins/secretary/scripts/clarity-hook.mjs`、`plugins/secretary/scripts/lib/clarity-hook.mjs`の3 pathは固定public productからbyte-syncする。Hookの意味をYasashii向けに改変しない。
- Yasashii adapter、edition metadata、copy、style、overlay、manifest／marketplace、repository／install ID、`harness@yasashii-harness`はadaptedまたはprotectedとして扱う。
- `README.md`、`LICENSE`、`AGENTS.md`、repo-owned `docs/**`、`secretary-overlay/**`、既存progress／feedback／state／release履歴を製品同期で変更しない。Harness roleが所有する新規文書は製品同期actionと別inventoryで扱う。
- `secretary-overlay/downstream-owned.json`と`downstream-files.json`の宣言を守り、未分類path、role重複、blind copy、stale declarationを0件にする。
- Project Clarity以外のSkill Hookを作らない。projects／daily／weekly／memory-care／update等は既存router／Skill入口で協働し、通常Bash／他Skill payloadのruntime-only nonmaterial observationを新Hookへ数えない。

## 状態、Hook、表示

Eventはappend-only、Evidenceは最小参照、Stateは決定的にrebuildできるprojectionとする。Decision、Execution、Validation、Alignmentを独立状態として持ち、4象限を派生させる。AI推定、draft、古いproposalは人間確認なしに確定しない。

`command-only`はhostの`type: command`で動くClarity専用router 1組という意味であり、Clarity CLIのpayloadだけを受け付ける意味ではない。初期化／linked済みrootではSessionStart、PostToolUse、PreCompact、compact後再開、Stop、SessionEndをboundedに観測できる。通常Bash／他Skill payloadはruntime-only nonmaterial observationを許すが、canonical／external write 0、semantic route 0、`material=false`ならStop checkpoint 0とする。Hook内network／LLM／Xmind／全scan／connector／updateは0件とする。

XmindはYasashiiで既定OFF。ON時はcapableなXmind MCPを第1優先、local `.xmind`を第2優先とする。local fallbackは対象、path、create／update、既存fileへの影響、auth／credit見込みを示した明示承認後だけ実行する。Mermaidで色を使える場合も同じ4色・配置・軸・文字情報を使う。

## 検証面の固定

最終candidateは、固定public productに含まれるprimary 250 case、Clarity collaboration extension CLX 20 case、visual provider追加 XV 4 case、E2E 4本を同じ意味と単一割当でYasashii sourceへ対応づける。

| 検証群 | 件数 | Yasashiiでの扱い |
|---|---:|---|
| Primary | 250 | 全件を同じcandidateで再実行し、PASS／FAIL／conditional NOT-RUNを分離する |
| CLX | 20 | collaboration surface、Hook非拡張、task／memory／build／update境界を実内容で検査する |
| XV | 4 | MCP-first、local承認、fixed visual、provider statusの最新決定を検査する |
| E2E | 4 | initからAttention／projection／link／sync／driftまでの一連の操作を検査する |

62 behaviorはPrimary／CLX／XV／E2Eの少なくとも1つへ割り当てるが、同じpublic behaviorを複数のYasashii behaviorへ複製しない。case本文の意味、Severity、期待副作用、conditional NOT-RUNを勝手に緩和しない。実Xmind MCP、実host live、外部connector、release／cacheはnot-runでも、adapter／provider／確認境界とoffline caseは必須である。

## Sprint 043 Patch 003 — Harness包括scanの固定入力とCase

固定上流はpublic accepted product／test candidate `fe3eab06d4fbd0b5b26d995129156f2fb2537dd2`、fresh PASS feedback `348cb1825a7f7e228e71e3799e2fdff0ea9b464e`、final state `4c37eaba23ace106b02709637ec7cde7cbf8bafc`と、private accepted product／test candidate `a980208db3728fc2d12e61435b03cd4b33e79a29`、fresh PASS feedback `b0c2138b8dcf96c144344e96307a22d38b4af349`、final state `ed4068e57e1da32e4fc1d4bfa2680393e2e00eb3`である。Yasashii開始点はHEAD `9009f892f678fbcbde9978e0bceb803d3f1ad7d5`、tree `de744087388b60d0f0f2db221b204c57a0c31bcf`。上流のstate／contract／progress／feedbackは設計根拠であり、Yasashii製品bytesやPASSではない。

publicのHS-001〜016は意味とSeverityを維持し、Yasashii固有IDとしてF77へ一度だけ割り当てる。

| ID | Severity | 不変の観測意味 |
|---|---|---|
| yasashii-HS-001 | Critical | 2 MiB超Harnessでもauthoritative reserved laneが現在判断の正本を確保する |
| yasashii-HS-002 | Critical | non-Harness／partial／invalidを分け、完全Harnessへ誤昇格しない |
| yasashii-HS-003 | Critical | state／contract／progress／feedbackを意味分離し一つのCurrent bundleへ統合する |
| yasashii-HS-004 | Critical | feedback absentを`evaluation-not-yet-recorded`として別状態にする |
| yasashii-HS-005 | Critical | Current valid／TBD／missing／invalidを維持し、安全なbounded fallbackだけを根拠つきで使う |
| yasashii-HS-006 | Critical | 巨大stateをboundedに扱い、解決不能をpartialへ分類する |
| yasashii-HS-007 | Critical | Secret-like／binary／symlink／permission／missingを本文非露出で分類する |
| yasashii-HS-008 | High | authoritative／generic別budget、coverage、partial理由を正直に示す |
| yasashii-HS-009 | High | 過去文書を1 file 1 Item化せずCurrent bundleを決定的に生成する |
| yasashii-HS-010 | Critical | ancestor alias／physicalでidentity、候補、coverage digestを一致させる |
| yasashii-HS-011 | Critical | preview／cancel／synthetic apply／failureで所有pathとGit／external安全を守る |
| yasashii-HS-012 | Critical | Windows drive／backslash／空白／日本語／CRLFをnative filesystemで扱う |
| yasashii-HS-013 | Critical | Windows case collision／reserved／invalid／prefix siblingをfail closedにする |
| yasashii-HS-014 | Critical | symlink／junction capabilityを別々に観測しSKIP／NOT-RUNをPASSへ数えない |
| yasashii-HS-015 | Critical | 既存Yasashii Windows workflowとexact candidate／PR runを因果固定する |
| yasashii-HS-016 | Critical | portable inventoryと既存Clarity／0.9.2／Git-free回帰を同じcandidateで守る |

既存F60〜F76、17機能／62 behavior、Primary 250、CLX 20、XV 4、E2E 4、`yasashii-CF-*`、`yasashii-AR-*`の意味・Severity・初回割当は変更しない。Patch 003の16 CaseはF77の受入拡張であり、62 behaviorへ重複加算しない。

## Project Clarity展開のNon-scope

- release、push、tag、GitHub Release、Marketplace snapshot、installed plugin／cache、new session、loaded version確認。
- 実Xmind MCP、実local `.xmind` write、実Claude／Codex host live、外部connector。
- public／private sourceの変更、private実装の同梱、利用者workspace migration、Mac mini同期。
- Project lifecycle、Notion property／relation、TODO正本、memory意味判定の新しい所有権。
- 新しい統一attestation、collector、実外部dataを必須化すること。
- Sprint 043 Patch 003では、force push、merge、tag、GitHub Release、Marketplace、install／cache、実Xmind、実顧客Repo apply、privateの`05/02/10_sources/Notion`実装を含めない。通常pushと因果Windows CIはexact candidate固定後の外部live gateだけに限定する。

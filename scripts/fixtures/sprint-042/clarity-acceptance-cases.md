---
title: Project Clarity 受け入れテストマトリクス
version: 1.0
createdAt: 2026-08-28
targetRepository: mtaiseeei/agentic-secretary
owner: Planner（case定義正本。実行・判定はEvaluator）
---

## 変換来歴と公開境界

- 元文書SHA-256: `4e33f971db499811e6dc4cb604d7c8df10e07f87d178482f1d5b3f4d8d7a3f7e`
- 変換方針: target repositoryをpublic `mtaiseeei/agentic-secretary`へ変更し、実顧客名を同構造の「匿名CRM導入PJ」へ匿名化した。
- case semantic不変: 250 caseのID、Severity、Scenario、Expected、EvidenceとE2E手順の意味は変更しない。
- public評価では匿名fixtureを使う。実顧客fixture、提供PDF、提供Xmindはpublic repoへcopyしない。
- 実顧客fixtureによる再実行はprivate my-vault版の別Harness、別state、別Evaluatorで行い、public PASSを流用しない。

# Project Clarity 受け入れテストマトリクス

## 0. 評価原則

この文書は、Project Clarityの実装完了を判定するEvaluator向けの受け入れ正本である。

- コードが存在するだけでは合格にしない。
- 実際のSkill、CLI、Hook、生成物を動かす。
- 1つのhostの合格を別hostへ流用しない。
- 自動テストだけでなく、生成されたMarkdown、Mermaid、Xmind、Git差分を確認する。
- product findingとverification-infra findingを分ける。
- current user dirtyを含む本番Repoを破壊的fixtureとして使わない。
- synthetic fixtureと安全なtemporary Repoを使う。
- Evidence formatはSprint contractとrubricに定義されたsafe harborを用いる。
- Xmind integration ON時は、connected／availableかつ必要capabilityを満たすXmind MCPを第1優先にする。MCP不可／失敗でもlocal `.xmind`へ自動writeせず、理由／対象path／create-update／既存影響／auth／credit見込みのpreviewと明示承認を必須にする。
- Xmind MCP、承認済みlocal `.xmind`、利用可能なMermaid styleは、左上 🟢 定着・検証 `#16A34A`、右上 🔵 実行待ち `#2563EB`、左下 🟡 暫定実装・要再確認 `#D97706`、右下 🔴 設計・意思決定 `#DC2626`を使う。上軸は「決まっている」、下軸は「まだ決まっていない」とし、emoji／ラベル／意味文を併記する。

合格には、全Criticalケースと各Sprint対象ケースの合格が必要である。

Severity。

| Severity | 意味 |
|---|---|
| Critical | 失敗すると製品の正本、安全性、主要価値が壊れる |
| High | 主要利用経路またはhost parityが壊れる |
| Medium | 補助機能、可視化、診断品質が不十分 |
| Low | polish、説明、軽微な操作性 |

---

# 1. Standalone初期化

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| ST-001 | Critical | `.clarity/`もSecretaryもないGit Repoで`init preview` | write 0件。検出内容、作成予定path、Item候補、競合を表示 | before／after tree、git status、stdout |
| ST-002 | Critical | previewをキャンセル | file、commit、journal、runtimeを含め副作用0件 | git diff、find結果 |
| ST-003 | Critical | confirm後に初期化 | `.clarity/`が作られ、空テンプレでなく実Repo由来のItemを持つ | generated files、state、event |
| ST-004 | High | Git remoteなしRepo | local identityで初期化でき、remote不明を明示 | manifest、doctor output |
| ST-005 | High | non-git directory | 対応可能範囲を明示。Git機能なしでも安全に初期化するか、理由付き停止 | output、tree |
| ST-006 | High | 巨大Repo | bounded scanとなり、除外／未確認範囲を表示 | timing、scan report |
| ST-007 | Critical | `.env`、credential fixtureあり | 値を読取結果、Evidence、logへ露出しない | secret scanner、output inspection |
| ST-008 | Critical | root外へ向くsymlinkあり | symlink先を読まず、対象を拒否または除外 | negative test |
| ST-009 | High | 既存`CLARITY.md`あり | 無断上書きしない。managed block可否をpreview | diff |
| ST-010 | High | 既存ADR規約あり | Decision正本候補として検出し、独自Decision本文を重複生成しない | state refs、tree |
| ST-011 | High | specはあるがDecision未確定 | `proposed`または`exploring`となり、`confirmed`にならない | state |
| ST-012 | High | Accepted ADRあり | 有効性を確認してEvidence付きDecision候補となる | Evidence、state |
| ST-013 | Medium | binary中心Repo | binaryを無理に解析せず、確認範囲を明示 | scan report |
| ST-014 | Critical | initを同じ入力で再実行 | duplicate Item、Event、commitが増えない | byte diff、event count |
| ST-015 | High | 初期化途中でwrite失敗 | partialを明示し、retryで一状態へ収束 | failure injection、retry result |

---

# 2. 状態モデルと4象限

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| QM-001 | Critical | confirmed + implemented | `stabilize`、表示「定着・検証」 | state、matrix |
| QM-002 | Critical | confirmed + not_started | `execute`、表示「実行待ち」 | state、matrix |
| QM-003 | Critical | proposed + implemented | `validate`、表示「暫定実装・要再確認」 | state、matrix |
| QM-004 | Critical | unknown + not_started | `decide`、表示「設計・意思決定」 | state、matrix |
| QM-005 | High | confirmed + in_progress | `execute`かつ進行中badge | output |
| QM-006 | High | unknown + verified | `validate` | output |
| QM-007 | High | execution rolled_back | 実行済み扱いにしない | state |
| QM-008 | Critical | quadrantを手で改ざん | rebuildでstateから正しい象限へ戻る | before／after |
| QM-009 | High | Decision superseded | Active Matrixから旧Itemを除外し履歴保持 | state、history |
| QM-010 | High | disposition idea | Matrixには任意表示できるが今日のAttention既定除外 | attention output |
| QM-011 | High | deferred期限前 | Attention除外 | attention output |
| QM-012 | High | deferred期限到来 | 再評価対象になる | time-fixed test |
| QM-013 | Medium | unknown state | 無理に決定済み扱いせず不確実性を表示 | state |
| QM-014 | High | state rebuild | eventsと参照正本からbyte安定したprojectionを生成 | repeated hashes |

---

# 3. Decision確定とEvidence

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| DE-001 | Critical | AIが「決まっていそう」と推定 | `proposed`、`humanConfirmed=false` | state |
| DE-002 | Critical | ユーザーが「これで確定」と明示 | 既存Decision seam、PROJECT更新、Clarity Eventが一体成功 | affected files、event |
| DE-003 | Critical | Decision書込み成功、Clarity更新失敗 | partialを明示し、retryで重複なしに完了 | failure injection |
| DE-004 | Critical | Clarity更新成功、Decision正本書込み失敗 | confirmedと表示しない。rollbackまたはpartial | state、error |
| DE-005 | High | draft ADR | confirmedにしない | Evidence |
| DE-006 | High | superseded ADR | current Decisionとして使わない | output |
| DE-007 | Critical | transcript全文がある | Clarityへ全文保存せず、短いref／digestだけ | repo scan |
| DE-008 | High | meeting reference | path／ID／日付をEvidenceに残し、本文複製なし | evidence |
| DE-009 | High | Git commit Evidence | repository、SHA、pathsが残る | evidence |
| DE-010 | High | test run Evidence | command、status、time、bounded summaryを保持 | evidence |
| DE-011 | Critical | EvidenceがSecretを含む | redactionまたは保存拒否 | negative test |
| DE-012 | High | Decision変更 | 過去Decisionを消さずsuperseded履歴を追加 | event history |
| DE-013 | Medium | Evidence source unreachable | stateを捏造せず`source_unreachable` | attention |
| DE-014 | High | humanConfirmed field改ざん | schema／rebuildで不整合検知 | doctor output |

---

# 4. Attention Engine

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| AT-001 | Critical | implemented without confirmed decision | High Attention、理由を日本語表示 | attention.md |
| AT-002 | High | confirmed but not executed | Medium以上のAttention | output |
| AT-003 | Critical | decision implementation drift | Critical Attention、両方の根拠 | output |
| AT-004 | High | possible drift | driftと断定せずpossible表示 | output |
| AT-005 | Critical | validation failed | Critical Attention | output |
| AT-006 | High | validation pending stale | High Attention | fixed-time test |
| AT-007 | High | undecided stale | Medium Attention | fixed-time test |
| AT-008 | Critical | authority conflict | Critical Attention | sync fixture |
| AT-009 | High | sync conflict | High Attention | sync fixture |
| AT-010 | High | evidence missing | Medium Attention | output |
| AT-011 | High | dependency blocked | dependencyを示す | output |
| AT-012 | Medium | decision owner missing | 誰が決めるか不明と表示 | output |
| AT-013 | Critical | idea item | 既定の今日の要確認から除外 | output |
| AT-014 | High | human priority override | deterministic priorityへ反映 | state、output |
| AT-015 | High | Attention最大件数 | SessionStartは重要3件程度に制限 | hook output |
| AT-016 | Medium | 同点項目 | stable tie-breakで順番が揺れない | repeated run |
| AT-017 | High | 解消済みAttention | active一覧から消え、historyへ残る | before／after |
| AT-018 | Medium | Clarity score未実装 | 件数と理由だけで主要価値が成立 | UX verification |

---

# 5. Claude Code Hook

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| HC-001 | Critical | Claude Code plugin load | Clarity SkillとHookが認識される | validator、live output |
| HC-002 | High | SessionStart startup | 短いAttention contextを注入 | transcript／hook evidence |
| HC-003 | High | SessionStart resume | 最新projectionを再読込 | output |
| HC-004 | High | compact後 | Clarity contextが再注入 | compact live test |
| HC-005 | Critical | PostToolUse複数同時 | runtime eventが破損しない | event count、JSON parse |
| HC-006 | High | PostToolUse Edit／Write | touched pathだけを観測 | runtime event |
| HC-007 | High | PostToolUse test command | test実行候補を観測 | event |
| HC-008 | Critical | Stop material change + no checkpoint | 1回だけcheckpoint継続を要求 | live test |
| HC-009 | Critical | Stop 2回目 | 無限継続せず停止可能 | live test |
| HC-010 | High | no material change | Stopが不要なreviewを要求しない | live test |
| HC-011 | High | PreCompact | flush／pending checkpoint／resume生成 | files |
| HC-012 | High | SessionEnd | 制限時間内に軽量flush | timing |
| HC-013 | Critical | Hook command failure | Repo正本を壊さずmanual fallback案内 | failure injection |
| HC-014 | High | Hook無効 | Skill手動利用が完全動作 | live test |
| HC-015 | High | plugin root from subdirectory | cwd依存せず正しいplugin scriptを解決 | live test |
| HC-016 | Critical | Hook内networkなし | network call 0件 | instrumentation |
| HC-017 | High | large Attention state | context注入がbounded | token／size evidence |

---

# 6. Codex Hook

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| HX-001 | Critical | Codex plugin load | `$clarity`とHookが認識される | plugin list、live output |
| HX-002 | Critical | Hook trust前 | Hookを勝手に実行せず、review案内。Skill手動は動く | `/hooks` evidence |
| HX-003 | High | trust後SessionStart | 追加developer contextを注入 | live output |
| HX-004 | High | source compact | immediate continuationへcontext | compact live test |
| HX-005 | Critical | command-only | prompt／agent hookへ依存しない | manifest inspection |
| HX-006 | Critical | PostToolUse同時 | runtime event破損なし | parse test |
| HX-007 | Critical | Stop block | 新しいcontinuationとしてcheckpointを1回促す | live test |
| HX-008 | Critical | stop_hook_active true | 2回目継続なし | live test |
| HX-009 | High | SessionEnd 3秒以内 | lightweight flushのみ | timing |
| HX-010 | High | subdirectory起動 | git root／plugin rootを正しく解決 | live test |
| HX-011 | High | Hook disable config | Skill fallback | live test |
| HX-012 | High | PLUGIN_ROOT／compat env | common scriptが動く | environment evidence |
| HX-013 | Critical | transcript format変更想定 | transcript parserを主要正本に依存しない | code inspection、fixture |
| HX-014 | High | large output | bounded additionalContext | output size |

---

# 7. Host共通性

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| HP-001 | Critical | common core inventory | Claude／Codexで同じSkill semanticを参照 | inventory check |
| HP-002 | Critical | hooks source | 可能な限り共通`hooks.json`。差分がある場合は単一生成元 | tree、generator test |
| HP-003 | High | host input normalization | 同一fixtureから同一Clarity Event | fixture hashes |
| HP-004 | High | host output serializer | host固有記法以外の意味内容が一致 | golden tests |
| HP-005 | Critical | 1hostのみlive PASS | 他hostを検証済み表示しない | status output |
| HP-006 | High | Desktop／CLI差 | supportedとverifiedを別表示 | host gate |
| HP-007 | High | natural language invocation | Claude／Codex双方でClarity Skillが選ばれる | live conversation |

---

# 8. Secretary-local統合

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| SL-001 | Critical | 05 open PJへClarity追加 | 正しいPJ内にのみ生成 | tree |
| SL-002 | Critical | 02 legacy only PJ | 既存resolver規則どおり参照し、無断二重writeなし | tree、resolver output |
| SL-003 | Critical | 05／02 conflict | 05採用＋conflict報告 | output |
| SL-004 | Critical | closed未明示 | closedを探索しない | instrumentation |
| SL-005 | High | closed明示 | 指定範囲だけ参照 | output |
| SL-006 | Critical | Decision確定 | existing project Decision seamへ委譲 | affected files |
| SL-007 | Critical | Clarity Itemをタスク化 | 自動TODO生成せず、明示時だけnotion-tasksへroute | live test |
| SL-008 | Critical | vault/10_sources | read-onlyを維持 | negative test |
| SL-009 | High | PROJECT表示 | Clarity mode／Attention／link healthを短く表示 | output |
| SL-010 | High | PROJECTへ全Item埋込みなし | pointer／summaryのみ | diff |
| SL-011 | High | PJ完了 | Clarityを伴ってclosedへ整合移動または参照維持 | completion test |
| SL-012 | High | PJ再開 | 過去Clarity履歴を失わない | reopen test |

---

# 9. Linked External Repo

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| LK-001 | Critical | link prepare | SecretなしLink Request生成 | JSON inspection |
| LK-002 | Critical | expected target不一致 | accept拒否、副作用0件 | negative test |
| LK-003 | Critical | link accept | targetにreciprocal manifest | files |
| LK-004 | Critical | link finalize | 両Project ID／Repo identity／digest照合 | files、output |
| LK-005 | Critical | external RepoにClarityなし | accept時にpreview後初期化可能 | live fixture |
| LK-006 | High | 既存Standalone Clarityあり | ID維持してlink追加 | before／after IDs |
| LK-007 | Critical | cross-root write監視 | 一方のprocessが他Repoを変更しない | filesystem canary |
| LK-008 | Critical | remote pushなし | linkだけでpushしない | git log、remote evidence |
| LK-009 | High | local checkout mapping | absolute pathはgitignored local configだけ | repo scan |
| LK-010 | High | GitHub read-only取得 | 明示許可時だけread | command log |
| LK-011 | High | bundle manual transfer | networkなしでlink可能 | fixture |
| LK-012 | Critical | duplicate link | idempotent、重複なし | rerun |
| LK-013 | High | link解除 | 履歴保持、Standalone継続 | state |
| LK-014 | High | link先unreachable | stale／unreachable表示、local機能継続 | output |
| LK-015 | Critical | linkId改ざん | sync拒否 | negative test |
| LK-016 | Critical | repository identity改ざん | sync拒否 | negative test |

---

# 10. SyncとAuthority

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| SY-001 | Critical | sync preview | write 0件、変更候補とconflict表示 | diff |
| SY-002 | Critical | sync apply | 自Repoのimports／projectionだけ更新 | filesystem evidence |
| SY-003 | Critical | Secretary Primary field conflict | authority conflictとして停止／Attention | output |
| SY-004 | Critical | Repo Primary implementation update | Secretary projectionへ反映候補 | output |
| SY-005 | Critical | same field both Primary | schema validation拒否 | negative test |
| SY-006 | Critical | last-write-wins禁止 | conflictが消えない | fixture |
| SY-007 | High | stale remote revision | stale表示 | output |
| SY-008 | High | schema newer than reader | 安全停止またはread-only degradation | output |
| SY-009 | High | unknown fields | readerが保持／無視し、破壊しない | roundtrip test |
| SY-010 | Critical | retry | duplicate import／eventなし | rerun |
| SY-011 | High | remote item deletion | tombstone／conflictとして扱い、黙って削除しない | state |
| SY-012 | High | item split resolution | 新Item relationとhistoryを保持 | resolution test |
| SY-013 | High | authority変更 | previewと人間確認が必要 | output |

---

# 11. Drift Detection

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| DR-001 | Critical | Decision email first、code customer_id first | driftまたはpossible driftを検出 | Decision ref、code ref |
| DR-002 | High | 同義実装 | false positiveを抑えalignedまたはunknown | output |
| DR-003 | High | Evidence不足 | drift断定せずpossible | output |
| DR-004 | Critical | confirmed drift | Critical Attention | attention |
| DR-005 | High | Decision変更で整合 | drift解消、history保持 | before／after |
| DR-006 | High | 実装修正で整合 | drift解消、history保持 | before／after |
| DR-007 | High | 例外承認 | waiver Evidence付きでAttention調整 | state |
| DR-008 | High | 古いcommitのみ | current implementationと誤認しない | git fixture |
| DR-009 | High | generated code | source authorityを区別 | output |
| DR-010 | Critical | Secret含むcode fixture | EvidenceへSecret非露出 | scan |

---

# 12. Mermaid

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| MM-001 | High | 4象限生成 | 軸・象限の配置が仕様どおり | `.mmd` |
| MM-002 | High | item座標 | stateに対応 | golden test |
| MM-003 | Medium | 同じ入力を再生成 | byte安定 | hashes |
| MM-004 | Medium | point重複 | stable jitter | output |
| MM-005 | High | 日本語label | syntaxを壊さず表示 | render evidence |
| MM-006 | High | Mindmap failure | Markdown／flowchart fallback | failure fixture |
| MM-007 | Medium | project structure | area treeが安定 | generated map |
| MM-008 | Medium | dependencies | dependency relationが表示 | generated map |
| MM-009 | Medium | state flow | transitionsが表示 | generated map |
| MM-010 | High | Mermaidなし環境 | raw `.mmd`とMarkdownは生成 | live test |

---

# 13. Xmind

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| XM-001 | High | Xmind CLI未導入 | Clarity本体は成功し、導入案内またはfallback | output |
| XM-002 | High | Xmind CLI利用可能 | native `.xmind`生成とvalidation成功 | file、CLI result |
| XM-003 | High | multi-sheet | クラリティマトリクス／プロジェクト構造を持つ | Xmind inspection |
| XM-004 | Medium | 追加Sheet | Attention／Decision履歴等が要件どおり | Xmind inspection |
| XM-005 | Critical | credential | Repoへ保存されない | repo scan |
| XM-006 | High | Xmind MCP未接続 | cloud機能だけdegrade、local／Mermaid継続 | output |
| XM-007 | High | Xmind MCP接続済み | cloud map create／read／updateの少なくとも1経路 | live evidence |
| XM-008 | Critical | Xmindでstatus変更 | 直接state変更せずproposal生成 | before／after |
| XM-009 | High | proposal承認 | Clarity Eventへ反映 | event |
| XM-010 | High | proposal拒否 | state変更なし | diff |
| XM-011 | High | stable Item ID | Xmind nodeとClarity Itemを再対応可能 | map／mapping |
| XM-012 | High | 匿名CRM導入PJ fixture | 元文書と同構造の匿名マップで4象限と将来アイデアを再現 | screenshot／file |
| XM-013 | Medium | Xmind file既存編集 | 無関係Sheet／branchを保持 | before／after validation |
| XM-014 | Medium | map open中編集 | refresh注意または安全な扱いを説明 | UX output |
| XM-015 | High | 有料credit必要 | 実消費前に明示確認 | interaction evidence |

---

# 13A. Visual Provider user decision追加case

XV-001〜004はprimary 250とCLX 20のID／意味／割当を変更せず、2026-08-28の最新user decisionを検証する追加caseである。

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| XV-001 | Critical | integration ONで(a) MCP connected／available／capable、(b) MCP未接続／無効／capability不足、(c) MCP実行失敗／外部操作未承認、(d) local fallback承認／拒否／cancel、(e) 最初からlocal指定を実行 | (a) `mcp-selected`、(b)(c)(e) preview中は`fallback-approval-required`・local write 0、(d)承認後だけ`local-selected-after-approval`、拒否／cancelは`stopped`・write 0。常にprovider status／selected／reasonが実状態と一致 | resolver JSON／stdout、provider capability fixture、approval前後tree／map snapshot、external／local write log |
| XV-002 | Critical | Xmind MCPのcloud map create／updateを隔離adapterと、明示承認された場合のreal liveで評価 | 左上 🟢 定着・検証／安定している／`#16A34A`、右上 🔵 実行待ち／あとは進めるだけ／`#2563EB`、左下 🟡 暫定実装・要再確認／注意して確認する／`#D97706`、右下 🔴 設計・意思決定／人間の判断が必要／`#DC2626`。上軸=決まっている、下軸=まだ決まっていない。実tool schemaが不足なら要件を弱めずverifiedにしない | adapter request／response、tool schema capability report、map screenshot／style inspection、live未承認時はNOT-RUN理由／external write 0 |
| XV-003 | Critical | local `.xmind`のcreate／updateを承認前、承認後、拒否／cancel、既存無関係Sheet／branchありで実行 | previewは対象file／path、create／update、既存影響、sign-in／credit見込みを示す。承認前／拒否／cancelはwrite 0。承認後だけcreate／updateし、XV-002と同じ位置・4色・emoji／ラベル／意味文・軸と無関係Sheet／branch保持を満たす | preview応答、before／after file hash／Sheet／branch inventory、native validation、screenshot／style inspection |
| XV-004 | High | Mermaid quadrantをstyle利用可／不可の両fixtureで生成し、スクリーンリーダー相当の文字情報を検査 | `q1=右上 🔵 実行待ち`、`q2=左上 🟢 定着・検証`、`q3=左下 🟡 暫定実装・要再確認`、`q4=右下 🔴 設計・意思決定`。style可能なときは同じ4 hex color、style不可でもemoji／ラベル／意味文／軸が残り、色だけに依存しない | raw `.mmd`、render screenshot／DOMまたはSVG text／style inspection、accessibility review |

---

# 14. Daily／Weekly／Portfolio

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| PF-001 | High | open PJ複数 | Portfolio rollup生成 | rollup.json |
| PF-002 | Critical | closed PJ | 通常rollupから除外 | output |
| PF-003 | High | daily morning | `今日の要確認`を独立sectionで表示 | live output |
| PF-004 | High | TODO／Attention同内容 | 自動重複タスク化しない | output、Notion check |
| PF-005 | High | most critical | 理由付き最優先Item | output |
| PF-006 | High | no Attention | 「現在判断不要」と簡潔表示 | output |
| PF-007 | Medium | evening | Decision／実装／候補／Driftを分離 | output |
| PF-008 | Medium | weekly | Attention増減とDrift解消を表示 | output |
| PF-009 | High | link stale project | Portfolioにstale表示 | output |
| PF-010 | High | source failure | 取得できた範囲と未確認範囲を分離 | output |
| PF-011 | Medium | project counts | 全Item数ではなくAttention中心 | UX review |
| PF-012 | High | Context size | dailyが全stateを読み上げない | output size |

---

# 15. Notion／既存機能回帰

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| RG-001 | Critical | Clarity Item作成 | Notion Task自動作成0件 | adapter log |
| RG-002 | Critical | 「これをタスク化」 | 既存notion-tasksへ委譲し確認境界維持 | live test |
| RG-003 | Critical | projects create／complete／reopen | 既存回帰合格 | suite |
| RG-004 | Critical | daily既存予定／TODO | Clarity追加後も回帰なし | suite |
| RG-005 | Critical | weekly | 既存集計回帰なし | suite |
| RG-006 | Critical | memory authorization | Clarity scopeへ漏れない | suite |
| RG-007 | Critical | Chatwork | config／workflow／history境界不変 | suite |
| RG-008 | Critical | Google Chat | OAuth／SPACE／history境界不変 | suite |
| RG-009 | Critical | vault-search | 10_sources read-only不変 | suite |
| RG-010 | Critical | identity／rename | Clarityで回帰なし | suite |
| RG-011 | Critical | plugin update | migration／version gate回帰なし | suite |
| RG-012 | High | Harness connection | SecretaryへHarness本体を同梱しない | tree check |

---

# 16. Git／Filesystem／Security

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| GS-001 | Critical | preexisting unstaged change | 内容と状態を保持 | before／after diff |
| GS-002 | Critical | preexisting staged change | stage状態を保持 | index diff |
| GS-003 | Critical | Clarity commit | owned pathsだけを含む | commit diff |
| GS-004 | Critical | failed apply | user dirtyへrollback作用なし | failure injection |
| GS-005 | Critical | unexpected push | 実行しない | remote log |
| GS-006 | Critical | branch／remote／visibility | 変更しない | before／after |
| GS-007 | Critical | root外symlink | 拒否 | negative test |
| GS-008 | Critical | `..`／absolute path injection | 拒否 | negative test |
| GS-009 | Critical | concurrent hooks | JSON破損なし | stress test |
| GS-010 | High | lock残骸 | doctor／recovery可能 | failure fixture |
| GS-011 | Critical | Secret scanner | Clarity managed filesにSecret 0件 | scanner |
| GS-012 | Critical | Xmind credential | Repo 0件 | scanner |
| GS-013 | Critical | transcript path absolute | committed metadataへ保存しない | repo scan |
| GS-014 | High | generated overwrite | plugin-owned generatedだけ再生成 | diff |
| GS-015 | Critical | schema corruption | safe stop、正本破壊なし | negative test |

---

# 17. Idempotency／Migration／Doctor

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| IM-001 | Critical | same checkpoint retry | Event／Evidence重複0件 | counts |
| IM-002 | Critical | same sync retry | import／event重複0件 | counts |
| IM-003 | Critical | same link finalize retry | link重複0件 | links.json |
| IM-004 | High | state rebuild retry | byte同一 | hash |
| IM-005 | High | map render retry | byte同一 | hash |
| IM-006 | Critical | migration preview | write 0件 | diff |
| IM-007 | Critical | migration apply | schema更新、history保持 | before／after |
| IM-008 | Critical | migration failure | old schemaを利用可能なまま保持 | failure injection |
| IM-009 | High | newer unknown fields | roundtripで不要破壊しない | fixture |
| IM-010 | High | doctor healthy | mode、schema、Hook、link、Xmind状態を表示 | output |
| IM-011 | High | doctor broken link | 原因と修復候補を表示 | output |
| IM-012 | High | doctor hook untrusted | trust確認方法を示す | output |
| IM-013 | High | doctor stale runtime | 安全なcleanup preview | output |
| IM-014 | Critical | cleanup apply | owned runtimeだけ削除 | tree |

---

# 18. Packaging／Release

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| PK-001 | Critical | Claude manifest | version／description／hooks／skills整合 | validator |
| PK-002 | Critical | Codex manifest | version／skills／hooks整合 | validator |
| PK-003 | High | marketplace manifests | source／version／metadata整合 | tests |
| PK-004 | Critical | host inventory | Clarity追加とhost差分が記録 | file、test |
| PK-005 | Critical | skill inventory count | actual treeと一致 | inventory test |
| PK-006 | High | CHANGELOG | 利用者向けに日本語で説明 | file |
| PK-007 | Critical | existing release regression | 全suite green | command results |
| PK-008 | High | Git-free archive | pluginが動く／validator合格 | archive gate |
| PK-009 | High | clean checkout |同一candidateで合格 | clean gate |
| PK-010 | Critical | live status | 未検証hostをverifiedにしない | status artifact |
| PK-011 | Critical | public upstream | 明示許可なしにwrite／pushしない | remote evidence |
| PK-012 | High | private candidate | current repo方針に従ってversion一貫 | manifests |

---

# 19. UX／日本語

| ID | Severity | シナリオ | 期待結果 | 必須証拠 |
|---|---|---|---|---|
| UX-001 | High | 日本語UI | Clarity、象限、Attentionを日本語で自然に表示 | outputs |
| UX-002 | High | 重要項目あり | 結論、理由、根拠、次の選択が分かる | UX review |
| UX-003 | Medium | 情報多数 | 重要項目を先にし、全件を押し付けない | output |
| UX-004 | High | AI推定 | 推定であることを明示 | output |
| UX-005 | High | 未検証 | 未検証を断定しない | output |
| UX-006 | Medium | technical handoff | command、path、error、証拠、残課題を保持 | final report |
| UX-007 | Medium | matrix label | 「決定×実行クラリティマトリクス」で統一 | repo search |
| UX-008 | Medium | old English labels | user-facingへ不要に露出しない | repo search |
| UX-009 | High | no Attention | 安心できる短い表示 | output |
| UX-010 | Medium | error | 何が起きたか、変更有無、次の一手が分かる | output |

---

# 20. 最終E2Eシナリオ

## E2E-001: StandaloneからSecretary連携

1. Clarity無しのsynthetic code Repoを作る。
2. Codexでinit previewを実行する。
3. confirmして初期化する。
4. Itemを4象限に配置する。
5. Mermaidを生成する。
6. Claude Codeで同じRepoを開き、SessionStart Briefを確認する。
7. 実装変更を行い、Stop checkpointを確認する。
8. Agentic Secretary PJでlink prepareを実行する。
9. code Repoでacceptする。
10. Secretary側でfinalizeする。
11. 双方でsync preview／applyする。
12. daily PortfolioへAttentionが出ることを確認する。
13. integration ONでprovider resolverを実行し、capable Xmind MCPならexternal preview／明示承認後にcloud map、MCP不可／失敗ならlocal preview／明示承認後にlocal `.xmind`を生成する。未承認ではwrite 0件とする。
14. Xmindで状態を動かし、proposalになることを確認する。
15. proposalを承認し、両側のprojectionへ反映する。

期待結果。

- Clarity Project IDは初期化時から不変
- cross-root write 0件
- Decision推定は人間確認まで未確定
- Hook loopなし
- dailyで最重要Attentionが表示
- Git／Secret／既存機能回帰なし

## E2E-002: 匿名CRM導入PJFixture

repo内の実行正本である「匿名CRM導入PJ」合成fixtureから、外部添付・実顧客file・absolute pathに依存せずmapを生成する。最低限次のbranchを持つ。

- 左上 🟢 定着・検証／安定している／`#16A34A`
- 右上 🔵 実行待ち／あとは進めるだけ／`#2563EB`
- 左下 🟡 暫定実装・要再確認／注意して確認する／`#D97706`
- 右下 🔴 設計・意思決定／人間の判断が必要／`#DC2626`
- 将来アイデア

上軸は「決まっている」、下軸は「まだ決まっていない」に固定し、「赤=判断、黄=確認、青=実行、緑=安定」を色だけでなくemoji／ラベル／意味文でも読めるようにする。各branchに複数areaとItemを配置し、Itemの状態遷移でbranch移動と構造Sheetのbadge更新が同期すること。

## E2E-003: Driftキラー体験

1. Decisionとして「メールアドレスを第一キー」と確定する。
2. 実装fixtureは`customer_id`優先にする。
3. reviewを実行する。
4. Critical Driftを検出する。
5. Decisionと実装の両根拠を表示する。
6. 実装修正後にDriftを解消する。
7. 履歴を保持する。

## E2E-004: Morning Brief

複数PJに次を作る。

- 実装済み・未決定 2件
- 決定済み・未実行 1件
- Drift 1件
- idea 5件
- 正常 20件

morning outputは、ideaや正常20件を詳細表示せず、判断が必要な4件と最優先Driftを示すこと。

---

# 21. PASS判定

Project Clarity全体をPASSにする条件。

- Critical項目が全件PASS
- High項目に未解決の主要機能欠落がない
- Claude CodeとCodexを別々に実検証
- Standalone、Secretary-local、Linked、Portfolioの全モードがPASS
- Drift E2EがPASS
- Hook無限ループ負例がPASS
- dirty worktree／Secret／path guardがPASS
- 既存master regressionがPASS
- Xmind MCP未接続時の`fallback-approval-required`／承認／`stopped`／write 0境界がPASS
- Xmind integration ONでMCP-first provider resolverがPASSし、MCP不可／失敗からlocalへの切替は承認前write 0となる
- Xmind MCPのexternal liveが承認済みならreal create／updateとfixed visualを実検証する。未承認ならadapter contract／isolated fakeとtruthful NOT-RUNを証拠化し、fakeでverifiedにしない
- 承認済みlocal `.xmind`とMermaidがfixed visual／accessibilityを満たす
- current candidateのmanifest、inventory、versionが整合
- 証拠がfeedbackに記録
- state.mdをOrchestratorが更新

条件未達を`done`にしない。ユーザーが記録済み短所を明示的に受け入れた場合だけ、既存規則に従って`done-by-user-decision`を使用する。

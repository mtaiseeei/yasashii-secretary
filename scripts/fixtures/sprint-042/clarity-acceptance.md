# Project Clarity Acceptance Registry

## 目的

[clarity-acceptance-cases.md](clarity-acceptance-cases.md)のprimary 250 case IDと意味を失わず、各caseを最初に評価するmain Sprintへ
ちょうど1回だけ割り当てる正本である。CLX 20も既存のID／意味／割当を変えない。最新user decisionのvisual provider追加caseはXV-001〜004とし、`sprint-043`へ初回割当する。case本文とE2E手順のrepo内実行正本は同文書とし、外部添付やabsolute pathを実行正本にしない。`sprint-050`は新しい割当を持たず、ここにある`primaryCaseIds`全件、`collaborationCaseIds`全件、`visualProviderCaseIds`全件、E2E-001〜004、既存master回帰を再実行する。

機械検査は、下の`clarity-acceptance-registry` JSONだけを入力とする。Markdown本文やSprint契約に再掲されたIDは
割当重複の入力にしない。

## 添付仕様との衝突解決

- 元文書のprivate targetは現在のユーザー決定で上書きされ、public `agentic-secretary`を先に完成させる。
- 250 caseのID、狙い、severityは保持する。private固有pathを含むSL／RG／PK caseはpublic stageでgeneric seam、
  private literal非混入、fixed handoffを評価し、実private pathはprivate版の別Harnessで再実行する。
- `XM-012`／`E2E-002`のpublic評価は、4象限＋将来アイデア、同等のbranch／area／Itemを持つ
  「匿名CRM導入PJ」fixtureを使う。実顧客fixture、提供PDF、提供Xmindはpublic repoへcopyせず、
  private my-vault版の別Harness、別state、別Evaluatorで再実行する。
- `AT-003`／`AT-004`／`AT-008`／`AT-009`はSprint 042で合成canonical State／Evidence fixtureから
  Attention reasonとrankingだけを評価する。実Drift comparatorはSprint 047、実sync／authority conflictは
  Sprint 046で直接回帰として再評価し、primary caseの初回割当は増やさない。
- `XM-007`はXmind MCP adapterのcaseとしてID／意味を保持する。integration ON時はconnected／availableかつ必要capabilityを満たすMCPが第1優先で、cloud map create／read／update、network、credit、external writeはprovider／対象／予想影響を示した別確認を必要とする。未承認のreal external-liveはadapter contract／isolated fakeで確認境界を評価できるが、live verifiedの代替にしない。
- MCP未接続／無効／capability不足／失敗／外部操作不承認ではlocal nativeへ自動切替・自動writeしない。理由、local代替、対象file／path、create／update、既存file影響、auth／credit見込みをpreviewし、明示承認後だけlocal writeする。拒否／cancel／無回答はwrite 0件。
- `PK-011`／`PK-012`はplanning中のexternal writeやprivate candidate作成を求めない。public sourceの無断write 0と、
  public PASS後だけ固定handoffを作る境界を評価する。

## 機械可読な単一割当

<!-- clarity-acceptance-registry:start -->
```json
{
  "schemaVersion": 1,
  "expectedPrimaryCaseCount": 250,
  "expectedCollaborationCaseCount": 20,
  "expectedVisualProviderCaseCount": 4,
  "primaryCaseIds": {
    "sprint-041": [
      "ST-001", "ST-002", "ST-003", "ST-004", "ST-005", "ST-006", "ST-007", "ST-008", "ST-009", "ST-010", "ST-011", "ST-012", "ST-013", "ST-014", "ST-015",
      "QM-001", "QM-002", "QM-003", "QM-004", "QM-005", "QM-006", "QM-007", "QM-008", "QM-009", "QM-010", "QM-011", "QM-012", "QM-013", "QM-014",
      "DE-001", "DE-002", "DE-003", "DE-004", "DE-005", "DE-006", "DE-007", "DE-008", "DE-009", "DE-010", "DE-011", "DE-012", "DE-013", "DE-014"
    ],
    "sprint-042": [
      "AT-001", "AT-002", "AT-003", "AT-004", "AT-005", "AT-006", "AT-007", "AT-008", "AT-009", "AT-010", "AT-011", "AT-012", "AT-013", "AT-014", "AT-016", "AT-017", "AT-018",
      "IM-001", "IM-004", "IM-006", "IM-007", "IM-008", "IM-009", "IM-013", "IM-014",
      "UX-001", "UX-002", "UX-003", "UX-004", "UX-005", "UX-006", "UX-007", "UX-008", "UX-009", "UX-010"
    ],
    "sprint-043": [
      "MM-001", "MM-002", "MM-003", "MM-004", "MM-005", "MM-006", "MM-007", "MM-008", "MM-009", "MM-010",
      "XM-001", "XM-002", "XM-003", "XM-004", "XM-005", "XM-006", "XM-007", "XM-008", "XM-009", "XM-010", "XM-011", "XM-012", "XM-013", "XM-014", "XM-015",
      "IM-005"
    ],
    "sprint-044": [
      "HC-001", "HC-002", "HC-003", "HC-004", "HC-005", "HC-006", "HC-007", "HC-008", "HC-009", "HC-010", "HC-011", "HC-012", "HC-013", "HC-014", "HC-015", "HC-016", "HC-017",
      "HX-001", "HX-002", "HX-003", "HX-004", "HX-005", "HX-006", "HX-007", "HX-008", "HX-009", "HX-010", "HX-011", "HX-012", "HX-013", "HX-014",
      "HP-001", "HP-002", "HP-003", "HP-004", "HP-005", "HP-006", "HP-007",
      "AT-015", "IM-012"
    ],
    "sprint-045": [
      "SL-001", "SL-002", "SL-003", "SL-004", "SL-005", "SL-006", "SL-007", "SL-008", "SL-009", "SL-010", "SL-011", "SL-012",
      "PF-001", "PF-002", "PF-003", "PF-004", "PF-005", "PF-006", "PF-007", "PF-008", "PF-010", "PF-011", "PF-012",
      "RG-001", "RG-002", "RG-003", "RG-004", "RG-005", "RG-006", "RG-007", "RG-008", "RG-009", "RG-010", "RG-011", "RG-012"
    ],
    "sprint-046": [
      "LK-001", "LK-002", "LK-003", "LK-004", "LK-005", "LK-006", "LK-007", "LK-008", "LK-009", "LK-010", "LK-011", "LK-012", "LK-013", "LK-014", "LK-015", "LK-016",
      "SY-001", "SY-002", "SY-003", "SY-004", "SY-005", "SY-006", "SY-007", "SY-008", "SY-009", "SY-010", "SY-011", "SY-012", "SY-013",
      "IM-002", "IM-003", "IM-010", "IM-011", "PF-009"
    ],
    "sprint-047": [
      "DR-001", "DR-002", "DR-003", "DR-004", "DR-005", "DR-006", "DR-007", "DR-008", "DR-009", "DR-010",
      "GS-001", "GS-002", "GS-003", "GS-004", "GS-005", "GS-006", "GS-007", "GS-008", "GS-009", "GS-010", "GS-011", "GS-012", "GS-013", "GS-014", "GS-015"
    ],
    "sprint-048": [
      "PK-001", "PK-002", "PK-003", "PK-004", "PK-005", "PK-006", "PK-007", "PK-008", "PK-009", "PK-010", "PK-011", "PK-012"
    ]
  },
  "collaborationCaseIds": {
    "sprint-049": [
      "CLX-001", "CLX-002", "CLX-003", "CLX-004", "CLX-005", "CLX-006", "CLX-007", "CLX-008", "CLX-009", "CLX-010",
      "CLX-011", "CLX-012", "CLX-013", "CLX-014", "CLX-015", "CLX-016", "CLX-017", "CLX-018", "CLX-019", "CLX-020"
    ]
  },
  "visualProviderCaseIds": {
    "sprint-043": [
      "XV-001", "XV-002", "XV-003", "XV-004"
    ]
  },
  "finalRecheck": {
    "sprint": "sprint-050",
    "primary": "ALL_PRIMARY_CASE_IDS",
    "collaboration": "ALL_COLLABORATION_CASE_IDS",
    "visualProvider": "ALL_VISUAL_PROVIDER_CASE_IDS",
    "e2e": ["E2E-001", "E2E-002", "E2E-003", "E2E-004"],
    "existingRegression": "FULL_EXISTING_MASTER_REGRESSION"
  }
}
```
<!-- clarity-acceptance-registry:end -->

## 割当件数

| Sprint | Group | 件数 |
|---|---|---:|
| sprint-041 | ST 15 + QM 14 + DE 14 | 43 |
| sprint-042 | AT 17 + IM 8 + UX 10 | 35 |
| sprint-043 | MM 10 + XM 15 + IM 1 | 26 |
| sprint-044 | HC 17 + HX 14 + HP 7 + AT 1 + IM 1 | 40 |
| sprint-045 | SL 12 + PF 11 + RG 12 | 35 |
| sprint-046 | LK 16 + SY 13 + IM 4 + PF 1 | 34 |
| sprint-047 | DR 10 + GS 15 | 25 |
| sprint-048 | PK 12 | 12 |
| **合計** | **repo内case定義** | **250** |
| sprint-049 | CLX追加 | 20 |
| sprint-043 | XV visual provider追加 | 4 |

## CLX追加case

| ID | Severity | 期待結果 |
|---|---|---|
| CLX-001 | Critical | secretary routerがClarity intentを選べるが、現在の別用件を横取りしない。 |
| CLX-002 | Critical | projects作成は既存確認境界とproject正本を維持し、Clarityを無断初期化しない。 |
| CLX-003 | High | projects表示はmode、Attention、link healthをpointer／summaryで示し、全Itemを埋め込まない。 |
| CLX-004 | Critical | project completeでClarity履歴を失わず、closedの通常探索禁止を維持する。 |
| CLX-005 | Critical | project reopenで既存Clarity ID／履歴を保持し、再作成しない。 |
| CLX-006 | Critical | `canonicalRepo`はlink候補となるが、相手Repoへの直接write／fetch／pushを行わない。 |
| CLX-007 | High | dailyは予定／TODOと別の`今日の要確認`をbounded表示し、connectorをClarityから自動実行しない。 |
| CLX-008 | High | weeklyは既存journal集計を回帰させず、Attention増減／Drift解消を別集計する。 |
| CLX-009 | Critical | Clarity ItemからNotion Taskを自動作成せず、明示依頼時だけ既存notion-tasks確認境界へ委譲する。 |
| CLX-010 | Critical | Clarity Itemからlocal TODOを自動作成せず、明示依頼時だけ既存TODO seamへ委譲する。 |
| CLX-011 | Critical | memory-careはPJ Decision／Clarity Eventを一般memoryへ重複保存せず、自然会話選択をHookへ移さない。 |
| CLX-012 | Critical | buildはClarity contextを参照できるがHarnessのspec／Sprint／state／評価を置き換えない。 |
| CLX-013 | Critical | updateはClarity Hookから起動せず、毎session通信、自動更新、確認なしmigrationを行わない。 |
| CLX-014 | High | onboarding／workspace templatesがClarity optional状態とXmind edition defaultを正しく説明する。 |
| CLX-015 | High | rules／serializerがClarity出力の結論→理由→根拠→選択、最大3件程度、自然な日本語を維持する。 |
| CLX-016 | Critical | host inventoryがSkill／Hookのsupportedとverified、trust／disabled／manual fallbackを別表示する。 |
| CLX-017 | Critical | edition handoffがpublic common pathとprivate／Yasashii protected pathを分離し、private literalをpublicへ混ぜない。 |
| CLX-018 | Critical | Chatwork、Google Chat、Google／Microsoft／Notion等connectorをClarityが暗黙実行しない。 |
| CLX-019 | Critical | Project Clarity以外のSkill Hookが0件で、Clarity Hookにmemory候補の意味判定が0件である。 |
| CLX-020 | Critical | tracked inventoryが全関連surfaceの実path、役割、edition、marker、digest、回帰を列挙し、漏れ／stale／旧契約0件である。 |

## XV visual provider追加case

caseの完全な手順と必須証拠は[clarity-acceptance-cases.md](clarity-acceptance-cases.md)を正本とする。

| ID | Severity | 期待結果 |
|---|---|---|
| XV-001 | Critical | integration ONかつMCP connected／available／capableで`mcp-selected`。MCP不可／失敗は自動local writeせず`fallback-approval-required`、承認後だけ`local-selected-after-approval`、拒否／cancelは`stopped`・write 0件になる。 |
| XV-002 | Critical | Xmind MCPが左上 🟢 定着・検証／安定している／`#16A34A`、右上 🔵 実行待ち／あとは進めるだけ／`#2563EB`、左下 🟡 暫定実装・要再確認／注意して確認する／`#D97706`、右下 🔴 設計・意思決定／人間の判断が必要／`#DC2626`の固定配置、上軸「決まっている」／下軸「まだ決まっていない」を保つ。実tool schemaで不可ならverifiedにせずcapability不足を示す。 |
| XV-003 | Critical | 明示承認後のlocal `.xmind`がMCPと同じ固定配置・4色・文字情報を持つ。local明示指定を含む承認前はwrite 0件で、sign-in／credit見込みをpreviewする。 |
| XV-004 | High | Mermaidは`q1=右上実行待ち`、`q2=左上定着・検証`、`q3=左下暫定実装・要再確認`、`q4=右下設計・意思決定`で、style可能な範囲は同じ4色、必ずemoji／ラベル／意味文を併記する。 |

## PASS判定

- sprint-041〜048は、自Sprintへ割り当てたcaseと対象rubric、直接回帰だけを合格条件にする。
- sprint-043はprimary 26件に加え、XV-001〜004を初回評価する。XVはprimary 250に数えず、既存primary割当を変更しない。
- sprint-049はCLX-001〜020と直接回帰だけを合格条件にする。
- sprint-050は全250件、CLX全20件、XV全4件、E2E 4件、既存master回帰を同一public candidateで実行する。
- `XM-007`等の許可・接続依存external caseは、adapterと確認境界が成立し、未実行理由を正直に記録すれば
  conditional NOT-RUNにできる。ただしMCP-first resolver、承認前local write 0、固定4象限はadapter contract／isolated fake／承認済みlocal fixtureで必ず評価し、fakeでreal external-liveをverifiedにしない。Hook両host、Critical安全caseも省略できない。
- Fable静的レビューはPlanner正本完成後、最初のGenerator前にOrchestratorが行う。製品要件、case、追加Evidence format、PASS条件にはしない。

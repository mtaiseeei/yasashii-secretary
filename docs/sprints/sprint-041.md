# Sprint 041 — Project Clarity Yasashii prewrite gate

- Type: main
- Risk: high（固定handoff、private PASS receipt、path分類、protected snapshot、下流適用権限を扱う）
- 依存: `sprint-040-patch-001` done、Yasashii base `c6cfb40a6026c5447a8ec4729f517adb4cc51031`
- 含む機能: F75のprewrite部分
- 重点評価: C2, C5, C6, C13, C15, C16, C17, C18, C19, C25（すべて5/5必須）
- UI: なし

## 目的

固定public handoffとprivate PASS receiptが、指定Yasashii baseに対するprewrite入力として正しいことを、製品適用より先に判定する。common path、Yasashii adaptation、downstream-owned、protected surface、予定actionを機械照合可能にし、不一致時はClarity製品pathへのwriteを0件にする。成功時は製品適用を行わず、Yasashii prewrite receiptだけを作る。

## 固定入力

| 項目 | 固定値 |
|---|---|
| Yasashii base | `c6cfb40a6026c5447a8ec4729f517adb4cc51031` |
| public product | `5f08d454c05576fcff8ab32c10c00887b4c15a96` |
| public tree digest | `1fbffe636565355b875dcde35ff05d26cd7e15f00710c1c88a563866749037c5` |
| public common digest | `4aa6e8d4b21aa9e0020cfaa6edefd5ff0e6640fd2e8f937db00478190142f849` |
| public handoff／file SHA | `/private/tmp/project-clarity-handoff-20260829/ready-handoff.json`／`09c3fa1289fa0af4d31c084a74ab108ce5cf85bcf3b3e7c9320cab72758d83c0` |
| public status | `public-user-decision-risk-accepted`、`evaluatorPass=false` |
| private candidate／tree | `d5598226213004d55781ca033985589907ae7b5d`／`920aea5d09b1aa51fcb5ebe23ab242a538c50445` |
| private feedback commit／SHA | `556c80117c7a1db8f2dd4eabb997277d47e02a51`／`aa502ca0b3b53ece16822edc39b60b9a587b93c15f701ce1ad6578c2b9f47774` |
| private receipt／file SHA | `/private/tmp/agentic-secretary-my-vault-clarity/scripts/fixtures/sprint-050/private-pass-receipt.json`／`bf6893f3891b10b9b86669308e123008f09eae05d6d8330a477eb1614a456745` |
| private receipt internal SHA | `0aac84a3d1beadcc7820a495205f292c4491e1758c5c9349a8ee523e68e82122` |

private receipt verifier／prewriteの既存結果はexit 0、`nextPermission=yasashii-prewrite-only`、`writesAuthorized=false`である。既存結果だけを再実行の代替にはせず、同じ入力を現在のSprintで検証する。

## Scope

### A. identity／authorization gate

- public handoff、private receipt、public／private candidate、tree／common／feedback digest、Yasashii baseを照合する。
- public statusと`evaluatorPass=false`、private feedbackの`PASS`、private→Yasashii順序を別状態のまま確認する。
- `nextPermission=yasashii-prewrite-only`と`writesAuthorized=false`を保持し、製品apply、public／private write、release、push、cache、liveへ権限を広げない。
- unknown、欠落、不一致、空値、falseであるべき値のtruthy化、trueであるべき値のfalsy化、順序逆転、receipt tamperをfail-closedで拒否する。

### B. path roleとplanned action

- public common pathとprivate candidate追加pathを、Yasashii base上の`byte-sync`／`adapted`／`supporting`／`excluded`／`protected`へ一意に分類する。
- public Hook 3 pathは`byte-sync`へ固定する。Yasashii adapter／overlay／copy／style／edition／manifest／marketplace／Harness IDはadaptedまたはprotectedへ分類する。
- 各pathにread／copy／adapt／write／execute／protectの予定action、before digest、適用後条件を対応づける。
- role overlap、unknown、未分類、unused、stale declaration、downstream-ownedへの製品write予定を0件にする。

### C. protected snapshotとprewrite receipt

- Yasashii固有文体、`copy/yasashii.json`、`styles/yasashii.md`、`edition.json`、`secretary-overlay/**`、README、LICENSE、AGENTS、repo-owned docs、既存progress／feedback／state／release履歴を名前つきでsnapshotする。
- dirty／staged／unstaged／untrackedがある場合、許可されたPlanner文書を製品差分と混同しない。製品適用対象のdirty、予定actionと衝突する利用者差分、候補treeの不一致では停止する。
- prewrite receiptは固定入力、role manifest digest、protected before、製品write count 0、次に許すSprint 042 applyだけを束縛する。Evaluator verdictを先書きしない。

## Non-scope

- Clarity製品機能、Skill、Hook、storage、projectionの適用。
- public／private source、実利用者workspace、実HOME、実Xmind、実host、external connectorへのread／write。
- release、push、tag、GitHub Release、Marketplace、installed cache、new session。
- state.md、progress、feedbackのPlanner編集。

## Acceptance Criteria

1. 固定public／private／Yasashii入力が全て一致し、各identity／digest／pathの不一致を製品write前に非0で拒否する。
2. public status=`public-user-decision-risk-accepted`、`evaluatorPass=false`、private feedback=`PASS`を分離し、public Evaluator PASSへ書き換えない。
3. private receiptの`nextPermission=yasashii-prewrite-only`、`writesAuthorized=false`、private→Yasashii順序を保持し、apply／release／public Patch権限へ拡張しない。
4. unknown、missing、mismatch、falsy／truthy違反、dirty conflict、receipt／handoff tamperの負fixtureが全てfail-closedとなる。
5. public common pathと必要なprivate追加pathが排他的roleへ一意分類され、role overlap、unknown、未分類、unused、staleが0件である。
6. Hook 3 pathがbyte-sync、Yasashii adapter／overlay／style／identity／`harness@yasashii-harness`がadapted／protectedとして明示される。
7. 各pathの予定action、before digest、適用後条件が機械可読に対応し、blind copyとdownstream-ownedへの製品write予定が0件である。
8. protected snapshotが固定baseから再計算でき、不一致時は製品write 0件で停止する。Planner所有文書差分は製品同期actionと別inventoryになる。
9. prewrite検査の前後でClarity製品path write、public／private／remote／external writeが0件である。
10. Yasashii prewrite receiptが上記binding、protected before、role manifest、製品write 0、Sprint 042だけを次工程として固定し、tamper時は検証不能になる。

## Verification scope（着手時に固定）

- 対象: 固定Yasashii base、public handoff、private PASS receipt、固定candidateのread-only archive、隔離fixture。
- 必須: AC1〜10、C25、identity／digest／authorization／order／falsy／dirty／tamper負fixture、path全件表、protected before。
- UI: 対象なし。browser、screenshot、実host liveを要求しない。
- 外部操作: remote write、push、tag、release、install、cache、new session、実workspace、実Xmind、実connectorは0件。

### Evidence safe harbor

- command、exit code、入力path／SHA-256、開始HEAD／tree、`git status --short`。
- path、mode、digest、比較結果、role、理由、予定action、role intersection、未分類件数。
- protected対象とbefore digest、Yasashii identity／overlay／Harness IDの観測値。
- 負fixtureごとの期待／観測code、製品path write count、PASS／FAIL／NOT-RUN集計。
- prewrite receipt path／digest／bindingと、release／cache／workspace／liveのnot-run一覧。

上記で十分とし、新しい統一attestation、live cache、実host、実Xmind、release証跡を追加条件にしない。

## 完了条件

Generatorはprewrite gate、path role、protected before、製品write count 0、Yasashii prewrite receiptを`docs/progress/sprint-041.md`へ引き渡す。Evaluatorは別作業単位で固定入力と負例を再実行し、`docs/feedback/sprint-041.md`へC25を含む採点とVerdictを書く。fresh Evaluator PASSとOrchestratorのstate更新前にSprint 042へ進まない。

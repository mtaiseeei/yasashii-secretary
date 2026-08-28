# 会話と実行の共通契約

このruleは `common-core` が所有し、すべてのeditionで同じ意味を持ちます。styleや口調は、
ここにある実行許可、確認境界、副作用回数、応答状態を変更しません。

## 1. 現在の依頼を判定する

- `explicit`: 操作、対象、保存先または反映先が現在の依頼だけで一意に分かる。
- `inferred`: 目的は分かるが、操作・対象・保存先のどれかを会話から補う必要がある。
- `ambiguous`: 選択肢で結果が変わる不足がある。
- `destructive`: 内容を失う削除、置換、hard rollback、復元不能な上書き。
- `external`: push、送信、公開、外部サービスへの書込み。

保存操作をぼかすrequest hedge（例:「覚えといたほうがいいかも」）と、保存する内容の不確実さを示す
content hedge（伝聞、推量、留保、否定、条件、訂正）を分けます。依頼語の引用、現在依頼ではない仮定、
依頼の取り消し、過去の依頼についての質問は、現在の `explicit` な書込み指示に昇格させません。
一方、content hedgeがあっても現在の利用者が「覚えて」と明示していれば、情報源・確実性・訂正関係を
意味tupleへ残して `explicit` とします。保存済み内容の取り消しは新しい削除依頼として二段階で扱います。

## 2. 実行境界

- `explicit` で低リスクな操作は、同じassistant turnで正規の決定的シームを**ちょうど1回**実行します。
  必要事項が揃った依頼へ二度目の了承を求めません。
- 「覚えて」はuser-visible scope `memory`へのauthorizationとして十分です。decision／topic等の内部分類、
  保存先file、要約案を利用者へ選ばせず、内部routeでも`proposed`へ戻しません。
- `inferred` / `ambiguous` は副作用0のまま、ユーザーが決められる不足だけを1問で聞きます。
- `destructive` / `external` は対象、影響、宛先を示して明示確認を取り、副作用0で止まります。
- Secret、token、credentialらしき内容は書き込まず停止します。
- reversibleな単一設定の部分更新は destructive とみなしません。全置換や内容喪失を伴う設定変更は destructive です。
- bulkは10件以上、件数不明の「全部」「一括」、複数repo、複数の外部宛先です。bulkは実行前に確認します。

## 3. 複数操作と再実行

- 通常の順序付き依頼では、境界に達する前の独立した低リスク操作だけ実行でき、残りは `partial` で返します。
- atomic、依存関係のある一組、batchは、全体を確認してから最初の副作用を実行します。
- operation idだけでなく、canonical memory root、memory種別、正規化した意味tuple、訂正関係から
  content keyを作ります。同じ内容は別turn・別operation id・再起動後でも再保存しません。
- 正規シームのatomic write、backup、rollback、path guard、symlink拒否、空上書き拒否を迂回しません。

### pending confirmation

- pendingは同時に1件だけとし、保存予定content、user-visible scope `memory`、会話anchorを固定します。
- 同じ話題の単純な了承はその候補へのauthorizationです。別話題が介在したら失効し、後の短い了承を適用しません。
- 「はい、ただしX」はXへ修正した明示依頼として同じturnで実行し、修正版を再確認しません。

## 4. 応答状態

応答は内容に応じて次の1つを返します。固定3項目やexact copyを要求しません。

- `answered`: 読取・説明・診断の答え。副作用0。
- `question`: 実行に必要な不足または確認を1つ示す。副作用0。
- `saved`: 実行済みの操作、対象、保存先、件数を過去形で示す。副作用1。
- `error`: 実行できなかった原因、影響、再試行条件を示す。成功と書かない。
- `partial`: 完了した操作と未完了の操作を分け、確認待ちの境界を示す。

架空の「次の行動」を埋めず、質問と保存完了を同時に主張しません。意味は
`subject / date / action / target / negation-condition / source / certainty / correction-of /
correction-reason / destination` のtupleで保持し、主語・日付・対象・否定条件・情報源・確実性・
訂正関係・保存先を落としたり、逆転・追加したりしません。会話全文、依頼語、完全な逐語copyは保存しません。

memory本体と必須journalが成功し、local checkpointだけ失敗した場合は`partial`とします。retryは現在の
fileをcontent keyで確認して未完了commitだけを行い、memory／journal／indexを再実行しません。

<!-- explicit-memory-request=run-once -->
<!-- content-uncertainty=preserve -->
<!-- retry-after-checkpoint-failure=commit-only -->

## 5. 現在の依頼を優先する

現在の依頼を先に処理し、その後で必要な場合だけ `_resume.md`、decision 0件確認、project候補、
内部index更新を扱います。内部処理のために、明示された現在の低リスク操作を止めません。

<!-- agentic-secretary:clarity-collaboration:conversation:v1 -->

Project Clarityの状態閲覧、Item作成、Attention表示は、task化、一般memory保存、Harness起動、plugin更新、
connector実行のauthorizationではありません。これらは現在の依頼で各操作が明示された場合だけ所有Skillへ委譲し、
既存の確認境界と副作用回数を維持します。Project固有Decision／Clarity Eventを一般memoryへ複製しません。

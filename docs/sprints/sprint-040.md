# Sprint 040 — 明示memory authorizationのYasashii実source反映

- Type: main
- Risk: high（会話authorization、memory／journal／local checkpoint、共通core、Yasashii overlayの書込み境界を扱う）
- 依存: `sprint-039-patch-001` done
- 含む機能: F44, F49, F51, F59
- 重点評価: C2, C5, C6, C13, C14, C19（すべて5/5必須）
- UI: なし

## 承認済み前提と固定入力

ユーザーは、公開Agentic、Yasashii、private my-vaultの3版反映と既存修正の統合を承認済みである。
本SprintはYasashii版だけを扱い、追加質問を行わない。公開Agenticの正本とhandoffはread-only入力、
Yasashiiのローカルsource反映とoffline独立評価は承認範囲である。

| 項目 | 値 |
|---|---|
| 公開製品candidate commit | `9acea13477cd7730bf064a32c170b752586fa116` |
| 公開candidate ID | `36a5c5f5482fcd510e5b361bdf9e24620be696046e248fb29b3b557800cc083d` |
| Yasashii固定base | `3c472dd9a2b5299f27741ae2c418094486b7d035` |
| Yasashii隔離product candidate ID | `4bc87169d87baf90f9681f7ba07d3154c71df34eac78bad15b435732e876faf2` |
| handoff | 公開版 `scripts/fixtures/sprint-040/downstream-handoff.json` schema 3、SHA-256 `e515842b147393ac77dddfb94d000188916d4aa837fda17d7e8fb4015f844982` |
| inventory | 公開版 `plugins/secretary/conversation-core-inventory.json` schema 1、17 unique surface |

公開版はfresh独立Evaluator PASS済みだが、そのPASSをYasashii版へ昇格しない。
公開repoの最終docs／state HEADはPASSの参照記録に限り、Yasashiiへ適用する製品bytesは上記commitだけを正本とする。
隔離candidate IDは固定baseへhandoffの製品・回帰pathだけを適用した識別であり、
Yasashiiが所有するspec、state、progress、feedback、overlay記録を含む最終repo全体IDではない。

## 外から見える成果

- 「これ覚えて」「Rokunabeだと思う。覚えて」は、memory種別や要約案を聞き返さず同じturnで1回保存される。
- 「覚えといたほうがいいかも」は保存前に確認されるが、明示保存された推量・伝聞は情報源と確実性を保つ。
- 保存提案への「はい、ただしX」は修正版を同じturnで1回保存する。別話題後の短い了承は古いpendingへ適用しない。
- topic訂正は旧内容を残す追記となり、同じ意味内容のretryではmemory／journal／checkpointが増えない。
- memoryとjournal成功後にlocal commitだけ失敗した場合は`partial`となり、retryはcommitだけを完了する。
- memory専用scope gateはTODO／Notion TaskDB／projectへの漏洩を止めつつ、既存6操作を再質問へ回帰させない。
- Yasashiiの言葉遣い、copy、style、identity、README、LICENSE、overlay、repo-owned履歴を保った実sourceで新契約が動く。

## Scope

### A. handoff検証と限定適用

1. 公開製品commit、公開candidate ID、Yasashii固定base、隔離candidate ID、handoff／inventory schemaとdigestを適用前に照合する。不一致ではwrite前に停止する。
2. schema 3 manifestの`sharedParity`とYasashii editionの`parity`／`adapted`／`supporting`を、同一edition内で排他的な3役として扱う。declared input union、各intersection、builderのread／copy／write／execute／protect、固定baseからのactual diffを同じbuilder runから機械導出し、manifestの固定件数を書き写して合否を決めない。
3. parityは公開candidateとのpath／mode／bytes一致、adaptedは宣言transformer、入力anchorの出現回数、実変換の適用回数、最終digest一致、supportingは製品差分0かつ実read／execute／protectを要求する。copy後にadaptするpathはcopyとwriteの両actionをtraceへ記録しつつadaptedへ一度だけ分類する。`scripts/sprint-038-test.mjs`はYasashiiのadaptedでありparityへ二重計上しない。
4. builderの実actionまたはactual diffに対する未分類、role重複、未利用宣言、stale path、未収載mutationを0件にする。`publicWholeTree`のroot／exclusions、存在しない・複数出現・実変換点でないanchor、transformer不一致、copy後adaptのtrace欠落を負fixtureで検出し、下流write前に停止する。
5. 一回適用後の`check`、二回目の`reapply`で追加差分0件とし、fixed inputから隔離product candidate ID `4bc87169...`を再現する。repo-owned docsを含む最終treeへ同IDを要求しない。

公開PASS runで観測されたYasashiiの集計はparity 29、adapted 3、supporting 5、declared union 37、
actual diff 28、copy action 31である。この集計は入力の取り違えを診断する参照値であり、固定件数そのものを
合格正本にしない。合否は上記manifest／実action／actual diffから同じrunで再算出した集合と関係で決める。

### B. memory authorizationのrun-once

- 低リスクの明示memory依頼は、現在発話をauthorizationとして同じassistant turnに正規保存シームを1回だけ実行する。
- `memory`は利用者に見える十分なscopeであり、decision／topic等の内部分類、保存先file、要約案は内部routeとする。
- authorizationはrouter、`secretary`、`memory-care`、保存シーム、journal、checkpointへ一方向に引き継ぎ、内部routeで`proposed`へ戻さない。
- Secret、記憶削除、destructive、external、10件以上または件数不明の一括、memory外scope変更は既存の強い安全分類を優先する。

### C. request hedgeとcontent hedge

- 保存操作自体をぼかすrequest hedgeは`proposed`として質問前の副作用0件を守る。
- 伝聞、推量、留保、否定、条件、訂正等のcontent hedgeは、現在利用者が保存を明示していればauthorizationを取り消さない。
- 保存要点は情報源・確実性・訂正関係を保持し、確定事実への反転、入力にない因果・担当・期限の追加をしない。
- 会話全文、依頼語、完全verbatim copyは保存しない。依頼語の引用、現在依頼ではない仮定、取消、過去照会はwrite 0件とする。

### D. pending、append-only訂正、content dedupe

- pendingは同時に1件だけとし、保存予定content、user-visible scope、会話anchorを固定する。別話題が介在したら失効する。
- 「はい、ただしX」は修正済みcontentへの明示依頼として同じturnで実行し、修正版を再確認しない。
- topic訂正は旧内容を編集・削除せず、新しい訂正eventを1件追記する。訂正前後と理由または不確実性を追跡できるようにする。
- dedupeはoperation idだけでなく、canonical memory root、memory種別、正規化した意味tuple、訂正関係で判定する。
- 表記違い、別turn、別operation id、再起動後retryの同一内容は追加0件とし、否定、条件、情報源、確実性、訂正関係が異なる内容は別件とする。

### E. checkpoint partial

- memory本体と必須journalが成功し、local checkpoint commitだけ失敗した状態を`partial`として区別する。
- retryは現在の実fileとGit状態を確認し、未完了commitだけを行う。memory、journal、索引を再実行しない。
- commit成功後の再retryはfile差分、journal追加、追加commitが0件となる。

### F. memory scope gateと既存6操作

- `explicitMemoryRequest`と旧互換`explicit + operation:"save-memory"`の両方をmemory専用scope gateへ通す。
- destinationがTODO／Notion TaskDB／projectなら`scopeChange`がtrue／false／未指定の全状態で`question / 0`、memory／decision／topicなら同3状態で`saved / 1`とする。
- decision保存、設定変更、Notion Task作成、TODO完了、TODO持越し、現在用件の文書作成は一般の低リスク明示操作として各`explicit / saved / 1`を維持する。

### G. 実runtime goldenと17/17 inventory

- Sprint 038の全goldenは`classifierInput`と`execution`を必須とし、実runtime `executeConversation`から`classifyIntent`、`requiresConfirmation`、安全planを経た観測結果で実file副作用を制御する。
- `classifierInput`欠落、runtime判定tamper、既存6操作を`save-memory`限定へ狭める再注入は負fixtureで失敗し、手書きoracleだけではgreenにならない。
- inventoryは17 unique surfaceの実path、役割、edition、実本文digest、entryごとのrequired marker、禁止旧marker／phrase、tracked性を検査する。
- `settings`／`daily`／`projects`／templates／runtime classifier／memory保存シーム／golden fixture／Sprint 010を含め、global markerの寄せ集め、公開root流用、16件へのfilter、stale digestを拒否する。

## Yasashii保護境界

- Yasashii固有の文体、`copy/yasashii.json`、`styles/yasashii.md`。
- `edition.json`、rule manifest、Claude／Codex manifest／marketplace、repository／install ID／Harness ID。
- `README.md`、`LICENSE`、`AGENTS.md`、repo-owned `docs/`、既存progress／feedback／state、過去release／CHANGELOG履歴。
- `secretary-overlay/`の正本、mapping、anchors、metadata、downstream-owned／files、upstream-base／tree。変更はSprint 040 handoffの分類・base・markerを記録する必要最小限に限定し、既存の安全基準を削らない。
- 空上書き拒否、記憶削除2段階、path guard、Secret非表示・非保存、所有path限定commit、既存stage保持、push禁止。

Yasashii適応対象では、公開版の技術的表現を無条件にbyte copyして文体を失わせない。一方、やさしい言い換えを理由にauthorization、意味保存、安全条件を弱めない。

## Non-scope

- push、tag、GitHub Release、marketplace更新、version公開、remote変更。
- installed plugin／cache更新、利用者workspace migration、Mac mini同期、new session、loaded version確認。
- private my-vault版の適用・評価。別repoの次Sprintとする。
- 会話全文の逐語保存、汎用embedding／semantic search、memory schema全体の再設計。
- TODO／Notion TaskDB／projectへの新しい自動routing、Notion property／relation変更。
- 記憶削除、archive、外部送信、一括操作、Secret保存の確認境界緩和。
- UI、wizard、Chatwork／Google ChatのOAuth・同期・履歴仕様変更。
- 新しい統一attestation、collector、live cache検査基盤。

## Acceptance Criteria

1. 固定入力5点を適用前に照合し、公開commit／candidate、Yasashii base／candidate、handoff／inventoryの不一致ではwrite 0件で停止する。
2. schema 3 manifestと同じrunからYasashiiのparity／adapted／supporting、declared input union、各intersectionを機械算出でき、3役の重複、未利用宣言、stale pathが0件である。観測件数の固定値だけではPASSにしない。
3. builderのread／copy／write／execute／protect集合とrole actionが一致し、actual diffはparityまたはadaptedだけ、supportingとのintersectionと未分類mutationは空集合である。parityのmode／bytes、adaptedのtransformer／anchor occurrence／実application／final digest、copy後adaptのtraceが全件一致し、`scripts/sprint-038-test.mjs`の二重分類が0件である。
4. `publicWholeTree`のroot／exclusions、anchor不存在／複数出現／実変換点不一致、transformer不一致、copy後adapt trace欠落の各負fixtureがwrite前に非0で停止する。overlayの`record`、`apply`、`check`、`reapply`はすべて成功し、二回目の変更0件、隔離product candidate ID `4bc87169...`再現となる。最終repo全体IDへ同値を誤要求しない。
5. 「これ覚えて」をdecision相当／topic相当で実行し、内部分類、file、要約案の質問0件、同じassistant turnの保存各1件となる。
6. request hedgeは質問前write 0件、推量／伝聞を含む明示保存は同じturnで各1件となり、情報源・確実性・否定・条件・訂正関係の欠落・反転・入力にない追加が0件である。
7. 依頼語の引用、現在依頼ではない仮定、取消、過去照会はwrite 0件で、保存済み取消は削除2段階を維持する。
8. pendingは同時に1件、同じ話題の了承は1件保存、別話題後の了承は旧候補0件、「はい、ただしX」は修正版1件・再確認0件となる。
9. topic訂正は旧内容byte不変、新しい訂正event 1件となり、同じ訂正retryは追加0件である。
10. 同じ意味内容の表記違い、別turn、別operation id、再起動後retryはtopic／decision／journal／commit追加0件で、意味の異なる内容を誤dedupeしない。
11. checkpoint failureは`partial`、memory／journal／commit=`1/1/0`、retry=`0/0/1`、再retry=`0/0/0`となる。
12. Secret、削除、destructive、external、一括とmemory外scope変更は確認前副作用0件で、両memory表現×6 destination×scopeChange 3状態を満たす。
13. 既存6操作は各`explicit / saved / 1`で、scopeChange 3状態を付けてもmemory専用gateへ巻き込まれない。
14. Sprint 038 goldenの全caseが実runtimeを通り、`classifierInput`欠落、runtime tamper、旧限定実装再注入の負fixtureが各非0で失敗する。
15. inventoryはYasashii実sourceの17/17 unique entryについて実path、本文、digest、entry marker、禁止旧marker／phrase、tracked性を検査し、漏れ、stale、public root流用、global marker偽PASSが0件である。
16. Yasashii実sourceで専用Sprint 040が15/15、Sprint 038、Sprint 010、安全回帰、release integrity、Git-free archiveがすべて0 FAILとなる。公開版の結果を流用しない。
17. Yasashii固有文体、copy、style、edition、manifest／marketplace、overlay正本／metadata、README、LICENSE、AGENTS、repo-owned docs、Harness履歴の許可外変化が0件である。
18. push、tag、Release、marketplace、cache、利用者workspace、Mac mini、new session、loaded version、external service、private版への変更が0件である。
19. 結果報告はYasashii source／offline PASS、公開入力PASS、release未実行、cache未反映、new session未確認、private版未実施を分ける。
20. fresh独立Evaluatorが同じ実Yasashii candidateを評価し、AC1〜19とC2／C5／C6／C13／C14／C19をすべて満たす。

## Verification scope（着手時に固定）

- 対象環境: Yasashii実source、固定baseから作る同一bytes隔離candidate、同candidateのGit-free archive。
- 必須シナリオ: AC1〜20、rubricの必須模擬会話35〜41、既存Secret／削除／external／一括負例。
- 対象surface: schema 3 handoffのparity／adapted／supportingと実action／actual diff、conversation-core inventory 17 entry、実memory／journal／checkpointシーム、Yasashii保護surface。
- 必須offline gate: 専用15/15、Sprint 038／010、安全回帰、overlay record／apply／check／reapply、release integrity、Git-free archive、inventory 17/17。
- UI: 対象なし。browser操作・screenshotを合格条件にしない。
- 外部操作: remote fetch／push、tag、Release、marketplace、install／update、workspace migration、Mac mini同期、external serviceは0件。

### Evidence safe harbor

- 固定入力のcommit／candidate ID／schema／digest照合、source root、開始・終了HEAD、`git status --short`。
- manifest／runから機械導出したparity／adapted／supporting／declared union、各intersection、builderのread／copy／write／execute／protect、fixed base→candidateのactual diff、mode／before-after digest、未分類件数。
- parity byte／mode一覧、adapted pathのtransformer／anchor occurrence／実application／final digest、copy後adapt trace、supportingの実利用、overlay `record`／`apply`／`check`／`reapply`結果、`secondChanged=0`、隔離candidate ID。
- `publicWholeTree`のroot／exclusions、anchor不存在／複数出現／実変換点不一致、transformer不一致、copy後adapt trace欠落を拒否する負fixture結果。
- 実行command、exit code、PASS／FAIL／NOT-RUN件数、失敗内容。suite名とassert数を分ける。
- case ID、入力、期待／観測authorization、meaning tuple、response state、memory／decision／topic／journal／commitの前後件数とdigest。
- pendingのcontent／scope／anchor／失効、topic訂正の旧内容digestと新event、content keyの同一／差異。
- checkpoint failure injection前後、partial応答、retry／再retryのfile／journal／Git snapshot。
- inventory 17 entryの実path、本文digest、required／forbidden marker、tracked性、漏れ／stale／旧marker件数。
- Yasashii保護surfaceの開始前後digestまたは宣言値検査、release integrity、Git-free archiveの集計。
- external対象限定snapshotと、公開入力PASS／Yasashii独立結果／private未実施／release・cache・new session未反映の分離報告。

上記で十分とし、自然文byte一致、完全verbatim保存、live cache、新session、実利用者workspace、external service、
新しいcollector／統一attestationを追加の合格条件にしない。Evaluatorが検証中に見つけた実製品欠陥は、
既存の動作安定性・回帰なし・安全性に対する`product` findingとして扱える。

## 完了条件

Generatorは本Sprintだけを実装し、Yasashii実source、宣言overlay、回帰を固定して `docs/progress/sprint-040.md` に
起動不要／URLなし、全実行command、candidate識別、保護digest、具体的評価scenario、未実施外部面を引き渡す。
Evaluatorは別作業単位で同じcandidateを実行評価し、`docs/feedback/sprint-040.md` に証拠、各findingの
`product / verification-infra`分類、C19を含む採点、合否を書く。公開版のfeedbackやGenerator自己評価をVerdictへ流用しない。
Evaluator PASSとOrchestratorの`state.md`更新前に完了扱いにしない。

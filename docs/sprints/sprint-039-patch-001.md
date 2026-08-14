# Sprint 039 Patch 001 — 既存workspaceの名前オンボーディング完全移行

## 種別

- Type: patch
- Base Sprint: sprint-039
- Risk: high
- Candidate version: `0.10.1`

既存利用者のidentity、workspace内guidance、更新台帳、Git履歴を一transactionで扱い、
固定Agentic共通コアの同期とYasashii overlay保護を同時に行うため、microにはしない。

## 固定入力

- accepted upstream candidate HEAD: `ba4fe4de39df483b984fef5045bb1e21fdde1373`
- Agentic product commit: `3ef792819a4a445df089f70aa74ca09176762e5e`
- common tree digest: `a7d74a7a9bb42ea67815a75132acf588fe312314f98b7f9685cef97fdfca59c9`
- handoff inventory: 20 `commonPaths`
- path classification: 16 byte parity + 4 declared anchors（`name`／`secretary`／`settings`／`update` Skills）

後続のAgentic docs／state／feedbackだけのcommit、moving checkout、dirty treeへ読み替えない。
Agenticの正本、Sprint、progress、feedback、state、release記録は同期しない。

## 理由

公開済みYasashii Secretary `0.10.0`は、Plugin更新により新しい名前Skillを読めるが、
既存workspaceを自動で新規導入相当へ揃えない。現行の名前Skillを直接起動しても、
`secretary/identity.json`だけが作られ、既存のAGENTS／CLAUDE identity管理節と最小台帳が
未移行のまま残る可能性がある。

Plugin更新済みと、秘書名がworkspace全体へ安全に導入済みであることは別状態である。
本Patchは、既存利用者向け名前オンボーディングを完全なローカルmigrationとして成立させる。
ユーザー方針は確定済みであり、追加質問は不要である。

## 外から見える成果

Plugin更新後の新session、または名前Skillの直接起動から、秘書は既存workspaceの状態を変更せず診断する。
未導入または部分適用なら、何が残っているか、どのローカルfileを変更するか、local checkpointと
失敗時の戻し方を先に説明する。

英語名の確認とは別にmigrationの実行確認を取り、了承後だけidentity、製品所有のAGENTS／CLAUDE管理節、
最小台帳を`0.10.1`新規導入相当へ揃える。利用者が書いた本文と既存Git状態は守る。
別repoから名前で呼ぶuser-scope routingは任意のままで、さらに別の確認後だけ有効になる。

## Scope

### A. 固定handoffからAgentic共通安全挙動を同期する

- 固定HEAD／製品commitのhandoff inventoryとcommon digestを検証してから同期する。
- 20 commonPathsを、16 byte parityと4宣言anchorへ全件分類する。新しいidentity migration、
  `update-ledger`、`update` Skill、CLAUDE templateを共通対象から外さない。
- 現在のYasashii baseから固定candidateまでの追加・変更・削除を、common、anchor、upstream-only、
  repo-owned、downstream-ownedへ分類し、未分類を0件にする。
- overlayはreview後にcheck／apply／reapplyし、二回目の追加差分を0件にする。
- Yasashii固有の文体、copy、style、rule manifest、README、配布identity、repository、marketplace、
  overlayの下流所有field、repo-owned正本、Sprint／progress／feedback／evidence、LICENSEを保護する。

### B. 更新後のnew-session handoff

- Plugin更新完了、reload／新session開始、ローカルidentity migration完了を別状態として扱う。
- 新sessionでcanonical workspaceをread-only診断し、未導入または部分適用なら
  「Pluginは更新済みだが、秘書名のローカル設定が残っている」と説明して名前オンボーディングへ案内する。
- Claude Code、Codex、名前Skill直接起動で同じ意味を保ち、host固有の更新操作名を混同しない。
- 見送りではwrite 0件で終了し、完全移行済みと表示しない。

### C. 既存状態のread-only診断

- canonical workspace、edition marker、必要正本、実体path、正確なGit rootを再検証する。
  cwdだけを根拠に新規onboardingを始めない。
- 次を区別する。
  1. identity未作成。
  2. `0.10.0`の名前Skillでidentityだけ作成済み。
  3. identity、AGENTS／CLAUDE identity管理節、台帳が`0.10.1`新規導入相当。
  4. 利用者編集、marker重複、所有不明、edition／path／Git境界不一致により安全に自動移行できない。
- identityが無い場合だけ、希望の英語名またはおまかせ候補を提示する。不適格な名前は保存しない。
- 正当なidentityがある場合はdisplay name、stable ID、`ai-secretary`種別、created timeを保持し、再生成しない。

### D. migration previewと別確認

- previewはread-onlyとし、対象pathごとに追加、更新、維持、衝突を示す。
- preview対象は次に限定する。
  - `secretary/identity.json`
  - `secretary/AGENTS.md`内の製品所有identity管理節
  - `secretary/CLAUDE.md`内の製品所有identity管理節
  - editionが定める最小台帳のidentity関連record
- 対象path、短い理由、local checkpoint、rollback、非対象を示す。利用者本文、秘書名やstable IDの
  証拠用複製、Secret、file全文を大量表示しない。
- 英語名の保存確認とmigration apply確認を分ける。名前の了承だけでworkspaceを変更しない。
- migration確認にはuser-scope registry／routing、rename、過去author、利用者コンテンツ、
  既存文書のGrep置換、pushを含めない。

### E. 新規導入相当へのatomic migration

- 別の明示確認後だけ、identity、AGENTS／CLAUDE identity管理節、最小台帳を一transactionで揃える。
- AGENTS／CLAUDEは一意な製品所有marker間だけを追加・更新し、利用者自由記述、他managed block、
  周辺行、改行、file modeを保持する。全面上書きとblind replacementは禁止する。
- identityは英語display name、stable ID、`ai-secretary`種別、aliases、created timeの整合を保つ。
  AI author表示と構造化author metadataが同じidentityを参照できる状態にする。
- 最小台帳は管理対象path、適用version、基準hash等の更新判断metadataだけを扱う。
  秘書名、stable ID、利用者本文、顧客名、記憶、Secretを保存せず、既存の無関係recordを保持する。
- `0.10.1`新規オンボーディングも同じidentity関連完成状態を作り、既存workspace移行後と意味を揃える。

### F. local checkpoint、rollback、retry、rerun

- 変更前に実体path、edition marker、Git top-levelが同じcanonical rootを指すことを再確認する。
- local checkpointは今回変更した製品所有pathだけを1 commitへ含める。開始前のstage／unstaged／untracked、
  対象外path、別repo、利用者自由記述以外の変更を混ぜず、push／fetch／remote／branch／tagを操作しない。
- file write、構文／identity整合、台帳、stage、commit、commit後確認のいずれかが失敗したら、
  今回のworkspace変更とHEAD／index／working treeを開始前へ戻す。開始前の利用者変更を失わない。
- 部分file、identityだけの部分成功、部分stage、部分commit、backup、一時fileを残さない。
  rollbackが完了しなければ成功表示しない。
- failure後retryは一度の完全transactionとして成功できる。成功後rerunと完全適用済みworkspaceの再実行は、
  file差分、marker／台帳重複、stable ID変化、追加commitを0件にする。
- target所有pathの開始前dirty、正確なGit root不明、target workspace自体がGit-free等、
  安全なcheckpointを作れない場合はwrite 0件で停止する。

### G. `0.10.1` candidateと運用gate

- Yasashii `0.10.1` candidateのClaude／Codex manifest、marketplace、edition metadata、
  正本／旧raw CHANGELOG、README、current release gateを整合させる。
- 公開済み`0.10.0`以前のCHANGELOG entry、migration、fixture、tag／artifact、評価記録を変更しない。
- Generatorはcandidateを作れるが、fresh独立Evaluator PASS前にrelease済み、accepted private入力、
  Mac mini同期済み、受講者対応済みと表示しない。
- Agentic、Yasashii、privateの3版すべての独立PASS後だけ、`0.10.1` release、Mac mini同期、
  受講者向け更新プロンプトと使い方文へ進む。

## Non-scope

- user-scope registry／routingの自動有効化、確認統合、実HOMEへの書込み。
- rename、過去authorの書換え、利用者コンテンツ変更、既存文書のGrep一括置換。
- identity以外の会話契約、記憶、project、TODO、Chatwork／Google Chat、Notion、Secretのmigration。
- 反対editionの切替、workspace統合、Git repo新規初期化、Git-free targetのcheckpoint代替。
- private my-vault版の実装・評価・対応済み表示。
- 実installed cache、実利用者workspace、Mac mini、remote、tag、GitHub Release、marketplace公開。
- 受講者向け更新プロンプトと使い方文の作成・配布。
- 統一attestation、専用collector、証拠schema等の検証基盤開発。

## Acceptance Criteria

1. 同期入力がfixed upstream HEAD `ba4fe4de39df483b984fef5045bb1e21fdde1373`、product commit `3ef792819a4a445df089f70aa74ca09176762e5e`、common digest `a7d74a7a9bb42ea67815a75132acf588fe312314f98b7f9685cef97fdfca59c9`へ固定され、後続docs-only commitやmoving checkoutへ読み替えていない。
2. handoff inventoryの20 `commonPaths`を16 byte parity＋4宣言anchorへ全件分類し、identity migration、update-ledger、update Skill、CLAUDE templateを含む。未分類0、overlay check／apply／reapply成功、二回目追加差分0である。
3. Yasashii固有の文体、copy、style、rule manifest、README、配布identity、repository、marketplace、overlay下流所有field、repo-owned正本、LICENSEの開始前後digestが不変。Agentic docs／state／release記録の同期0件である。
4. `0.10.0` plugin更新済みのidentity未導入、identityだけ導入済み、完全適用済み、衝突workspaceをread-only診断し、状態、canonical root、edition、未完了理由を正しく区別する。診断前後のworkspace／Git／合成HOME変更0件である。
5. Plugin更新後の新sessionはPlugin更新とローカルmigrationを別状態で示す。未導入／部分適用では名前オンボーディングを案内し、見送りを完全移行済みと表示しない。Claude Code、Codex、名前Skill直接起動で意味が一致する。
6. identity未導入では希望名、おまかせ、取消、不適格名が契約どおり動く。正当な既存identityではdisplay name、stable ID、`ai-secretary`種別、created timeを再生成せず保持する。
7. previewはidentity、AGENTS／CLAUDE製品所有identity管理節、最小台帳を追加／更新／維持／衝突へ分類し、対象path、checkpoint、rollback、非対象を示す。preview前後snapshotが一致する。
8. 英語名確認後もmigrationの別確認前はwrite 0件である。拒否、取消、無回答ではidentity、guidance、ledger、Git、registry、user-scopeが変わらない。
9. 明示確認後はidentity、AGENTS／CLAUDE製品所有identity管理節、最小台帳が`0.10.1`新規導入相当へ揃い、表示名、stable ID、AI種別、AI author参照、管理対象recordが相互に整合する。
10. AGENTS／CLAUDEの利用者自由記述、他managed block、周辺行、改行、modeが保持される。管理節以外のblind replacement、全面上書き、無関係path変更0件である。
11. 最小台帳はidentity関連pathを一意に持ち、適用version／基準metadataが整合する。秘書名、stable ID、利用者本文、顧客名、記憶、Secretの保存と、無関係recordの削除・重複0件である。
12. 成功caseのlocal checkpointは正確なGit rootから今回変更した所有pathだけを1 commitへ含める。開始前のstage／unstaged／untracked、対象外path、remote状態を保持し、push／fetch／remote／branch／tag操作0件である。
13. file write、整合確認、台帳、stage、commit、commit後確認の代表failureは失敗として停止し、workspace tree、HEAD、index、working treeが開始前snapshotと一致する。部分file／stage／commit、backup、一時file0件である。
14. failure後retryは1回の所有checkpointで正常完了し、成功後rerunと完全適用済みfixtureはfile差分、marker／ledger重複、stable ID変化、追加commit 0件である。
15. marker重複、利用者編集衝突、所有不明、edition不一致、symlink／junction、read-only、別Git root、target dirty、Git-free targetは理由を示して副作用0件で停止する。部分成功を全体成功と表示しない。
16. ローカルmigrationの確認ではuser-scope file、registry、routing enabled stateが変わらない。別repo routingは、移行完了後も効果と対象を示した別確認でだけ有効化される。
17. `0.10.1`が公開済み`0.10.0`から一意に得られる後方互換patch candidateとして、manifest、marketplace、正本／旧raw CHANGELOG、edition metadata、README、release gateで整合する。`0.10.0`以前の履歴bytesは不変である。
18. clean checkoutと同一candidate bytesのGit-free archiveでPatch専用回帰、関係回帰、対象archive masterが0 FAILとなる。Windows native未実行項目は別OSの結果で解消済みにしない。
19. fresh独立EvaluatorがC2／C5／C6／C9／C10／C13／C14／C16／C17／C18を各5/5、product finding 0、blocking verification-infra 0、未検証必須内部項目0と判定する。
20. 実HOME、実利用者workspace、installed cache、private版、Mac mini、remote、external service、releaseへのwrite 0件である。3版PASS前にtag、Release、marketplace公開、Mac mini同期、受講者向け配布を行わない。

## 必須回帰

- 固定HEAD／product commit／handoff inventory／common digest／20 path分類／overlay check・apply・reapply。
- `0.10.0`既存workspace4状態のread-only診断、更新後new-session handoff、名前Skill直接起動。
- 希望名／おまかせ／取消／不適格名、既存identity保持、previewとapplyの別確認。
- identity、AGENTS／CLAUDE管理節、台帳の新規導入相当整合。
- 自由記述、他block、改行、mode、無関係record、開始前Git状態の保持。
- 所有path限定checkpoint、file／整合／台帳／stage／commit／post-commit failure、完全rollback。
- failure後retry、成功後rerun、完全適用済みrerun。
- marker重複、利用者編集、edition、symlink／junction、read-only、別root、target dirty、Git-free target。
- user-scope routing不変と別確認導線。
- name／onboarding／secretary／update、identity／author、serializer、ledger、resolver／routing／rename、
  Windows保存互換、safe Git／secret scan、formal Skill／manifest、report schema、release integrity。
- clean checkout、Git-free archive、`git diff --check`。

## Evidence safe harbor

- fixed upstream HEAD、product commit、common digest、Yasashii開始HEAD／candidate SHA。
- 全path分類、overlay check／apply／reapply、byte parity、anchor適用、保護surface前後digest。
- 合成HOME／隔離Git workspaceのcase ID、command、exit、preview／apply結果、前後snapshot、commit path一覧。
- failure matrix、rollback、retry、rerunの結果。
- clean checkoutとGit-free archiveのPatch回帰、関係回帰、formal／schema／release、対象archive master集計。
- 実行OS、Windows native not-run、実HOME／workspace／cache／private／Mac mini／remote／releaseのwrite 0記録。

上記が揃えば十分である。契約にない統一attestation、専用collector、追加証拠schema、実HOME操作、
実private反映、実release、Mac mini接続を追加の合否条件にしない。UI画面の追加はないため、
browser操作とscreenshotは必須にしない。

## External gate

本PatchのGenerator／EvaluatorはYasashii repo内のcandidateと独立評価だけを扱う。
origin／upstream remote、push、PR、merge、tag、GitHub Release、marketplace、installed plugin／cache、
実利用者workspace、private版、Mac mini、外部serviceを操作しない。

Agentic、Yasashii、privateの3版がそれぞれfresh独立PASSした後だけ、オーケストレーターがrelease、
Mac mini同期、受講者向け更新プロンプトと使い方文を別工程として扱う。

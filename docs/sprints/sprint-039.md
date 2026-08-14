# Sprint 039 — 秘書identityと安全な別repo呼び出しのYasashii同期

- Type: main
- Risk: high（user-scope guidance、複数workspace routing、作者identity、利用者コンテンツを候補に含むrename、下流overlay境界を同時に扱うため）
- 主眼: 独立評価PASS済みAgentic共通コアの固定製品candidateから、秘書自身の英語名、stable identity、AI author、名前Skill、canonical resolver、別repo routing、安全なrenameをhandoff manifest経由で同期し、Yasashii固有のやさしい体験と配布identityを保つ。
- 依存: sprint-038-patch-002完了。public `sprint-039-patch-001` のAgentic製品candidate `3fa8d97e5dbfb2afa314f4ad179f17401b76d320` はfresh独立Evaluatorでproduct finding 0件、blocking verification-infra 0件としてPASS済み。handoffのcommon digestは `c810f60c3664ca331338e34680eec9bb6d21f8d850b97a39eef29f1a24f58557`。
- UI差分: browser画面の追加はない。会話Skill、設定、file管理、routingの変更である。
- 公開version: 本Sprintでは固定しない。

## ユーザー決定とmain Sprint判定

- 初回利用者はonboarding、既存利用者は名前Skillから、秘書自身の英語名を指定または提案で決める。利用者の呼び方とは別設定にし、後から変更できる。
- 別repoでも「Alex、…」「Alexに聞いて」のように同じ秘書を呼べる体験を、canonical workspaceとuser-scope managed blockで提供する。user-scope設定は効果を説明したうえで明示確認後だけ有効にする。
- 改名ではGrep相当のread-only scanで候補を分類して先に見せる。無条件の全置換はせず、現行設定、利用者コンテンツ、履歴／author、所有不明を別扱いにする。
- identity、routing、複数host、rename、overlayを横断し、既存回帰だけに閉じないためmicroではなく新メインSprint、Risk highとする。
- ユーザーは方針を承認し、詳細を委ねているため追加質問は不要である。

## 外から見える成果

Yasashii Secretaryは初回または名前Skillで英語の秘書名を決め、同じ秘書を別repoから名前で呼び出せる。
文書の作者はAI Secretaryだと分かり、改名しても同じstable identityと過去の作者記録がつながる。
同名の取引先や著者について話しているだけなら秘書へ誤routingせず、曖昧な場合だけ一度確認する。

名前変更前には、どこが自動変更対象か、どこが個別確認か、どこを履歴として残すかをやさしく説明する。
拒否または途中失敗では変更を残さない。Yasashii固有の文体、説明、製品名、配布面は従来どおりである。

## Scope

### A. 固定handoff manifestからcommonPathsだけを同期する

- 同期元はAgentic製品candidate `3fa8d97e5dbfb2afa314f4ad179f17401b76d320` に固定する。後続のAgentic docs／feedback／stateだけのcommitへ読み替えない。
- 固定candidateの `adapters/downstream-identity-handoff.json` をhandoff正本とし、manifestのcandidate、common digest `c810f60c3664ca331338e34680eec9bb6d21f8d850b97a39eef29f1a24f58557`、16 `commonPaths`、必要な保護情報を検証する。
- 16 commonPathsは13件のbyte parityと `name`／`secretary`／`settings` の3宣言anchorである。`external-ops.mjs` と `safe-git.mjs` はaccepted patchで追加された共通安全pathとして含め、同期対象外や下流overrideへ分類しない。
- 現在のYasashii baseから固定candidateまでのtreeとpathを、commonPaths、既存metadata／anchor overlay、upstream-only、repo-owned、downstream-ownedへ分類し、未分類を0件にする。
- review後だけoverlayをcheck／apply／reapplyし、commonPathsは固定Agentic candidateとbyte一致、二回目の追加差分0件とする。
- Yasashii固有copy、style、rule manifest、README、identity、host別manifest／marketplace、repo-owned docs、LICENSEの開始前後digestを保護する。overlay metadataはaccepted candidate、digest、16 commonPaths、13 parity／3 anchor分類を記録するhandoff所有fieldだけを更新でき、その他のfield、anchor、安全基準を保護する。
- Agenticの `docs/spec/**`、`docs/sprints/**`、`docs/progress/**`、`docs/feedback/**`、`docs/sprints/state.md`、release記録を同期しない。

### B. 秘書自身の英語名とstable identityを成立させる

- 初回onboardingで「英語名を指定する」「おまかせで提案」の両方を提供し、保存する値を確認してからidentityを作る。利用者の呼び方設定とは混同しない。
- 既存利用者は名前Skillから未設定identityの作成、現在名の確認、renameへ進める。設定済みでも同じSkillを使える。
- display name、stable identity、AI種別、aliases、author metadataを一貫させる。改名してもstable identityと過去author主体は変えず、旧名をaliasとして追跡する。
- 秘書作成文書と記録は、人の作者と見分けられる英語名付きAI Secretary表現を持つ。Yasashiiの本文説明は平易にし、内部識別子を利用者へ不要に露出しない。

### C. canonical resolverとuser-scope managed blockを安全に扱う

- registryは確認済みcanonical secretary workspaceを指す。別repo cwdからはそのworkspaceへ接続し、cwdに `secretary/`、ledger、commit、pushを作らない。
- registry欠落、移動、重複、反対edition、symlink／junction、read-only、破損では安全に停止し、別workspaceの自動onboardingを始めない。
- CodexとClaude Codeについて、効果、対象host／file、managed block、無効化方法を示し、明示確認後だけuser-scope routingを有効にする。拒否／取消は変更0件とする。
- Codexは有効な `AGENTS.override.md` の優先を扱い、読まれない `AGENTS.md` だけを変更して成功表示しない。Claude Codeはuser-scope `CLAUDE.md` を扱う。
- managed blockのcreate／update／disableは既存の手書き内容、別製品block、改行、modeを保ち、atomic、rollback可能、再実行差分0件とする。

### D. routingとrenameでAgentic P1〜P4の修正を維持する

- routingは文頭の直接呼びかけと明示的な「Xに聞いて」を正caseとする。依頼本文に「顧客」「取引先」「author」等が含まれていても、文頭の有効な直接呼びかけを落とさない（P3）。
- 人間、顧客、取引先、author／作者、引用、code、file本文に同名があるだけのcaseはroutingしない。曖昧caseは副作用0件で一度だけ確認する。
- rename previewはA=current config、B=user content、C=historical author、D=unknown conflictに分類し、対象、件数、推奨処理、非対象、rollbackを示す。previewはread-onlyである。
- Aでもfile全体を置換せず、製品所有field／managed blockだけを変更する。AGENTS／CLAUDE等にある顧客名、自由記述、codeはDまたは適切な非自動対象として保持する（P2）。
- rename applyはAを一体更新、明示選択されたBだけ更新、Cを保持してalias追加、Dを変更しない。blind replacement、path traversal、所有不明fileの自動変更を禁止する。
- renameは現在有効なmanaged blockだけを更新する。managed block未作成またはdisabledのroutingを改名確認だけで有効化せず、対象file bytesとdisabled状態を保つ（P1）。
- 名前Skillを含む正式surface inventoryとreport-schema validatorを一致させる。未知surfaceへの差替えはunexpectedとmissingの両方を検出し、総数だけ一致する誤合格を防ぐ（P4）。
- 同名rename、alias衝突、途中失敗、path guard、symlink／junction、read-only、commit失敗では全対象とGit状態を開始前へrollbackする。retryで追加差分を作らない。

### E. portableな独立評価と下流版の保持

- 合成HOMEと隔離workspaceだけで、onboarding、名前Skill、identity／author、resolver、Codex／Claude managed block、routing、rename、rollbackを実動作検証する。実HOMEは読み書きしない。
- checkoutとGit archive相当の同一candidateでSkill／manifest validator、secret scan、identity、resolver、rename、overlay、master回帰を実行する。
- 既存Windows native 12 labelsを回帰対象として維持する。ただし本identity面のWindows nativeが未実行なら、portable code review、既存suite、Darwin／Linux等で実行した証拠、残余リスクを分け、Windows解消済みと表示しない。
- Yasashiiのやさしいcopy、説明順、正式identity、repository、marketplace、README、LICENSE、Harness導線をAgentic値へ戻さない。

## Non-scope

- private `agentic-secretary-my-vault`、my-vault版への反映・対応済み表示。
- 実HOMEの `AGENTS.md`／`AGENTS.override.md`／`CLAUDE.md`、installed plugin／cache、実利用workspace、Mac miniへの変更。
- origin／upstream remoteの追加・変更・fetch・push、branch、PR、merge、tag、GitHub Release、marketplace公開、plugin install／update。
- 公開versionの決定、CHANGELOG／manifestのrelease version更新、release実行。
- Agenticのdocs、progress、feedback、state、release記録の同期。
- 人間と秘書を完全自動で判別する一般固有表現認識、任意の過去履歴の一括改名、所有不明文書の自動編集。
- 新しいcollector、統一attestation、approval manifest、外部署名、実host全環境に共通する追加証拠schema。
- Windows native未実行を埋めるための推測、別OS結果による全環境PASSへの昇格。

## Acceptance Criteria

1. 同期入力がAgentic製品candidate `3fa8d97e5dbfb2afa314f4ad179f17401b76d320` に固定され、fresh独立PASS、handoff candidate、common digest `c810f60c3664ca331338e34680eec9bb6d21f8d850b97a39eef29f1a24f58557` が対応する。後続docs-only commitへ読み替えていない。
2. handoff manifestの16 `commonPaths` だけを同期対象とし、13 pathのbyte parity、`name`／`secretary`／`settings` の3宣言anchor、`external-ops.mjs`／`safe-git.mjs` の共通安全path、全path分類の未分類0件が成立する。overlay check／apply／reapplyが成功し、二回目追加差分0件である。
3. Yasashii固有copy、style、rule manifest、README、identity、Claude／Codex manifest／marketplace、repo-owned docs、LICENSEと、handoff所有field以外のoverlay metadataのdigestが開始前後で不変。handoff所有fieldはaccepted candidate／digest／16-path分類と一致し、Agentic docs／progress／feedback／state／release記録の同期0件である。
4. 初回onboardingで指定／提案の両経路が英語名へ解決し、保存前確認、拒否時変更0、利用者の呼び方との分離、不適格名拒否が成立する。既存利用者は名前Skillから設定・確認・renameへ進める。
5. display name、stable identity、AI種別、aliases、AI authorが一貫し、改名前後でstable identityと過去author主体が不変。人の作者と秘書の作者を識別できる。
6. user-scope enableは効果、対象host／file、managed block、無効化を示した明示確認後だけ行い、拒否／取消は変更0件。Codexのoverride優先とClaude Codeのuser-scope fileを正しく扱う。
7. managed blockのcreate／update／disableはatomic、rollback可能、再実行差分0。手書き内容、別block、改行、modeを保ち、routing disableがidentityや履歴を削除しない。
8. 別repoからcanonical workspaceへ接続し、cwdへのonboarding、`secretary/`、ledger、commit、pushが0件。registry欠落／移動／重複、反対edition、symlink／junction、read-onlyは部分変更0で停止する。
9. routing正caseは直接呼びかけと明示委譲で成立し、依頼本文に人間文脈語があっても落とさない。人間／顧客／取引先／author／作者／引用／code／file本文の負caseはrouting 0、曖昧caseは一度だけ確認する。
10. rename previewはA〜D分類、対象、件数、推奨処理、非対象、rollbackを示し、preview前後snapshotが一致する。AGENTS／CLAUDE等のfile全体をAとしてblind replacementする経路は0件である。
11. rename applyはAの製品所有fieldだけ、選択Bだけを更新し、Cを保持してalias追加、Dを不変とする。managed block未作成／disabled時はuser-scope bytesとdisabled状態が不変で、rename承認をrouting enable承認へ拡張しない。
12. 同名rename、alias衝突、traversal、symlink、read-only、部分書込み、commit失敗で全対象とGit状態が開始前へrollbackし、backup、一時file、旧名／新名混在、retry追加差分が0件である。
13. 名前Skill追加後の正式surface inventory／report-schema validatorが一致し、正式candidateはPASS。既知surfaceをunknownへ差し替え総数を保った負caseはunexpectedとmissingを検出してFAILする。
14. 合成HOME、隔離workspace、checkout、Git archive相当でidentity、author、resolver、managed block、routing、rename、overlay、secret scan、Skill／manifest validator、既存master回帰が0 FAILである。
15. Yasashii固有のやさしい説明、製品identity、repository、marketplace、README、LICENSE、Harness導線が維持され、Agentic identity混入、private／my-vault対応済み表示は0件である。
16. Windows既存suiteの結果、identity面のportable code review、実際に実行したOS証拠、not-run項目、残余リスクを分離する。Windows native未実行を全環境PASSまたは解消済みと表示しない。
17. fresh独立Evaluatorが同一candidateをC2／C5／C6／C9／C10／C13／C14／C16／C17を各5/5、product finding 0、blocking verification-infra 0、未検証の必須内部項目0と判定する。
18. private版、実HOME、cache、実workspace、Mac mini、remote、release、Secret、Actions、OAuth、実APIへのwriteは0件。公開versionを固定せず、push／PR／merge／tag／Release／marketplace／install／updateを行わない。

## 必須回帰

- 固定Agentic candidate、handoff manifest、common digest、current base、tree、全path分類。
- overlay check／apply／reapply、未分類0、二回目差分0、common byte parity、Yasashii保護surface digest。
- onboardingの指定／提案／拒否／不適格名、既存利用者の名前Skill、stable identity、AI author、aliases。
- canonical resolverの正case、registry欠落／移動／重複、反対edition、symlink／junction、read-only、cwd副作用0。
- Codex／Claude managed blockのenable／update／disable／拒否／冪等／rollback、override優先、既存本文／改行／mode保持。
- routingの直接呼びかけ／委譲の正case、人間／顧客／取引先／author／作者／引用／code／file本文の負case、曖昧一度確認。
- rename A〜D preview、選択B、C保持＋alias、D不変、P1未作成／disabled保持、P2製品field限定、途中失敗、rollback、retry。
- P4 surface inventory／report-schemaの正式PASSとunknown差替えFAIL。
- checkout、Git-free archive、既存master／edition／release-integrity／Windows関連suite、`git diff --check`。

Generatorは実行command、exit、assert／suite集計、固定Agentic SHA、handoff digest、Yasashii開始HEAD／candidate SHA、変更path、common parity、保護surface digest、実行OS、Windows not-run／残余、外部操作 `not-run` をprogressへ記録する。

## Evidence safe harbor

- 固定Agentic製品SHA、fresh独立PASS、handoff manifest／common digest、Yasashii開始HEAD／candidate SHA。
- path分類、overlay check／apply／reapply、common parity、保護surface前後digest。
- 合成HOME／隔離workspaceのidentity、author、resolver、managed block、routing、rename、rollbackのcommand、exit、snapshot、assert集計。
- P1〜P4の独立caseと、checkout／Git archive相当のSkill／manifest／secret／master回帰結果。
- 実行OS、Windows既存suite、identity面のportable review、Windows native not-run、残余リスクを分けた記録。
- UI変更はないためbrowser操作とscreenshotを必須にしない。
- 上記で十分とし、新しいcollector、統一attestation、approval manifest、外部署名を追加の合格条件にしない。

## External gate

本SprintはYasashii repo内の同期、実装、独立評価候補までを対象とする。ユーザーは全体方針として後続releaseとMac mini同期を承認済みだが、このSprintのGenerator／Evaluatorはprivate版、実HOME／cache、Mac mini、remote、releaseを操作しない。独立PASS後のversion決定、公開、private版反映、Mac mini同期は、各対象の別工程と正本に従ってオーケストレーターが行う。

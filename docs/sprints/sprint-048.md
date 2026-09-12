# Sprint 048 — Astra改善の限定downstream適応とYasashii `0.13.2` 公開

- Type: standard
- Risk: high（正式downstream sync、edition migration、Windows native CI、remote main、tag、Release、artifactを扱う）
- Candidate version: `0.13.2`（Phase A着手前のremote tag実測で`v0.13.1`がlatestの場合）
- 開始remote main: `4bf0552200d432320b1ccd8f7365c158970062a2`
- 依存: public `sprint-059` Phase Aのfresh独立Evaluator PASS済み完全SHA／tree／変更分類
- 関連rubric: C1、C2、C3、C5、C6、C7、C10、C12、C13、C14、C15、C18、C25（既存thresholdを維持）

## ゴール

public Agenticで固定したAstra向けinstruction改善、必要なHarness root guidance、managed workspace更新を、公開済みYasashii `0.13.1`の実sourceへ限定差分として適応する。17 Skills、Project Clarity、やさしい会話、edition固有identityとoverlay所有を保ち、内容変更migrationを持つ`0.13.2`として公開する。Agenticや旧Yasashii監査のPASSをYasashii current candidateのPASSへ流用せず、公開前と公開後を別々のfresh独立Evaluatorが判定する。

## 固定前提と許可

- 利用者は、current Yasashiiへの意味移植、deferred／保留／禁止事項の再確認、root guidance／overlay／migration／checkpointの必要修正、candidate commit、対象branchへの通常push、通常main統合、新tag、GitHub Release、artifact公開を明示承認済みである。同じ許可を再質問しない。
- Phase A前に`origin`の対象branch、`main`、tag、latest Releaseを再実測する。`v0.13.1`がlatestで、`v0.13.2`が未使用の場合だけ`0.13.2`を採番する。新しい公開版または同名tagを検出した場合は上書きせずOrchestratorへ返す。
- この隔離cloneの開始正本は公開`0.13.1`／17 Skills／Project Clarityを含む`4bf0552200d432320b1ccd8f7365c158970062a2`である。Sprint 047の旧`0.10.3`候補に対する独立PASSは監査知見としてだけ使い、current `0.13.1`のPASSやsync入力とは扱わない。
- root既存dirtyと別workerの関連編集を消さず、必要差分だけ重ねる。force push、reset、rebase、無断cleanup、tag移動、既存Release／artifactの差替え・削除、公開範囲変更は行わない。
- private my-vaultとconsulting slidesは別ownerであり非該当の理由を保持する。private固有Skill／値／routing／workspaceをYasashiiへ転記しない。
- Harnessのmodel／effort、Yasashii固有Harness identity／marketplace、利用者設定は現在の正本を保持し、Agentic値やinstalled版から推測変更しない。
- root guidanceの大幅短縮はautomatic approval reviewに2回拒否されている。拒否理由は、重要な運用・安全ガイダンスの一括削除が「必要な差分だけ」「既存規則を保持」の承認範囲を越え、安全・role・counter境界を持続的に弱めるためである。この結果を隠さず、大幅短縮の再試行や同じ結果を得るworkaroundを行わない。
- 利用者は、必要な具体的矛盾をすべて局所修正できれば全面短縮は不要と明示承認した。既存境界を保つ小patchによるcanonical pointer追加、`CLAUDE.md`の古いpath一律禁止と固定`0.5.0`案内の局所修正はapproval reviewを通過済みであり、その安全な差分を開始入力として保持する。

## Phase A — fixed public差分のedition適応とcandidate validation

1. public Sprint 059 Phase A PASSの完全SHA／tree、変更path、common-content digest、canonical Harness PASS receiptを開始時に固定する。publicのPASSをYasashii PASSへ昇格せず、Yasashii current source自身を評価する。
2. 正式syncは固定public candidateの限定差分だけを入力にし、common pathはbyteまたは宣言済み意味変換、edition pathは局所adaptation、repo-owned／protected pathは不変として一意に分類する。未分類pathは0件にし、二回適用後の追加差分を0件にする。
3. `secretary-overlay/upstream-base.json`の`0.12.0`／`767a7f3ecb15c0ffe6d2d8f71529c74bf671c154`はhistorical baseとして保持し、最新public sourceへ全量更新して過去同期を作り直さない。current handoff／source metadataは今回の固定candidate、共通hash、限定差分、protected snapshotを記録できる既存の正式fieldだけ更新し、accepted history／provenanceを偽装しない。
4. Sprint 047の15 seedと追加findingをcurrent 17 Skillsへ全件再照合する。5／7／9／10／14はHarness担当のfresh独立PASS済みcanonical最新版をYasashii rootへ意味適応し、verification-infra分類、role所有、micro判定、必要正本の再読、root guidance所有を維持する。6／15等のprivate my-vault／slides別ownerは非該当のまま理由を残す。
5. root `AGENTS.md`、`CLAUDE.md`、`docs/harness-guidance.md`は既存の運用、安全、role ownership、counter、model／effort、承認、Mac mini低並列規則を全文保持し、今回の実行を妨げる局所矛盾だけを最小差分で直す。canonical pointerは既存規則を削除・置換しない条件付き補足としてだけ追加できる。`<user-home>/workspace/agentic-harness`へのreadを含む一律接触禁止は、今回承認済みのowner連携とread-only canonical参照を許すscope／ownership境界へ局所適応し、未承認write／Git操作は禁止のまま維持する。
6. root `AGENTS.md`、`CLAUDE.md`、`docs/harness-guidance.md`と必要な既存configは、currentのproject制約、Yasashii Harness identity、model／effort、既存利用者変更を保持した局所適応にする。固定されたHarness `0.5.0`等の古い案内、Secretaryが記録する互換baseline、read-onlyで観測したcanonical／実導入版を分け、観測版を互換宣言へ自動昇格しない。Agentic rootの全量copyや古いYasashii rootへの巻戻しを行わない。
7. current-first、resume、setup／read／接続診断、条件付きcontext、run-once、partial、Windows-safe root解決をAgentic固定candidateと同じ意味へ揃える。Yasashiiの平易な表現、identity、copy、README／LICENSE、17 Skills、Project Clarity、Secretary Voice、Hook、既存安全境界を保ち、旧`0.10.3`candidateで最新機能を戻さない。
8. `0.13.1→0.13.2`は管理指示の内容変更を伴うため空hopにしない。Yasashiiの正式workspace registry／forward解決、edition guard、preview、別の明示確認、所有範囲限定apply、検証、local checkpoint、rollback／partial／retryを用いる。利用者の自由記述、設定、他managed block、改行、mode、unrelated dirty／stage／untracked、Secretを保持する。
9. 公開済みYasashii tag由来のAGENTS／CLAUDE等の管理節old asset／hash／markerを根拠にknown旧版を分類し、製品所有節だけを置換する。特にYasashii固有`0.10.3`を含む既存対応版とcurrent `0.13.1`から有限に到達できることを確認する。customized／unknown／競合、stale plan、wrong root／edition／scope、backup不一致は副作用0で停止する。
10. Claude／Codex manifest、marketplace、edition、migration graph／assets／supported source、release inventory、正本・互換CHANGELOG、README／更新guide、archive metadataをcandidateへ揃える。過去tag／Release／artifact／migration／fixture／overlay historyを変更しない。
11. current-content inventory、overlay／handoff metadata、migration／checkpoint hashは、今回の実bytesに直接因果するcurrent fieldだけ更新する。共通hashとprotected snapshotでYasashii固有surface、private非混入、historical base不変を検査する。
12. 既存の成功証拠は依存bytesが変わらない面だけ引き継ぐ。変更したroute、Yasashii表現、root guidance、overlay、managed migration、checkpoint、release／archiveを比例した既存入口と現実的fixtureで0 FAILにする。Generic PyYAMLの依存不足は`INCOMPLETE`としてRuby／Psychの17 Skills型PASSと分ける。
13. Windowsへ影響するmigration／path／改行面は、既存Yasashii workflowの対象jobをexact candidateで実行する。Windows native、macOS、別OS文字列fixture、public結果、過去Yasashii runを区別する。無関係なfull Sprint 044／050、Clarity stress、全suite、全host matrix、新runner／collector／attestationは追加条件にしない。
14. candidate完全SHA／tree、開始状態、public入力、変更path分類、common hash、protected snapshot、Mac／Windows結果、Git-free archiveを固定し、対象branchへ通常pushする。fresh独立EvaluatorがPhase AをPASSする前にmain統合、tag、Releaseを行わない。

## Phase B — publication and post-publication verification

1. Phase A PASS済みYasashii treeだけを対象branchから通常Git手順でremote mainへ統合し、新しい`v0.13.2` tag、GitHub Release、通常配布artifactを作成する。public Agentic版とYasashii版の公開状態を別々に扱う。
2. Phase A担当とは別のfresh独立Evaluatorが、remote main、tag、Release metadata、ダウンロードした実Git-free artifactをread-onlyで照合する。candidate／tag／artifactのbytes、version、edition、17 Skills、Clarity、Yasashii表現、overlay保護、release integrity、代表instruction route、代表managed migration／checkpointを確認する。
3. Phase Bの実artifact PASS後、tag、Release URL、candidate／main／tag SHAとtree、asset digest、実行した検証と結果、Windowsの実測範囲、未検証・残件を版別に報告する。root guidanceについては、拒否された全面短縮の対象と理由、安全な局所代替で解消した具体的矛盾、今回依頼に実害がある未修正の有無を明示する。利用者がCodexまたはClaude Codeへ貼る次のYasashii用更新promptを1〜3文で添える。promptは「Yasashii Secretaryを現在hostの正規手順で最新版へ更新」「既存設定とworkspaceの独自変更を保持」「成功後に実際に読み込まれたversionを確認」を含み、存在未確認のCLI commandを作らない。

## Acceptance Criteria

1. public fixed input、Yasashii開始HEAD、限定差分、common hash、edition adaptation、protected snapshotの関係を説明できる。public／Sprint 047／Generator自己評価／過去runをYasashii current PASSへ流用していない。
2. current 17 Skills、Project Clarity、Secretary Voice、Yasashii固有copy／identity／README／LICENSE／Harness identity／overlay／repo正本が維持され、Agentic／private／旧`0.10.3`bytesによる退行と未分類差分が0件である。
3. 15 seedと追加findingがcurrent sourceで全件再分類され、5／7／9／10／14はfresh独立PASS済みHarness canonicalへ意味追随する。rootは既存の安全・role・counter規則を削除せず、局所矛盾の修正と条件付きcanonical pointerだけで整合する。全面短縮を必須にせず、承認済みread-only owner参照を古い絶対path禁止が妨げず、未承認write／Git操作を許可へ広げない。互換baselineと実導入版を混同せず、別owner項目を修正済みと表示せず、今回依頼に実害がある未修正矛盾が0件である。
4. historical overlay base `0.12.0`／`767a7f3...`と既存provenanceは不変で、current同期記録だけがfixed public candidateとYasashii適応結果を正直に指す。二回適用後の追加差分は0件である。
5. `0.13.1→0.13.2`は内容変更migrationである。`0.10.3`を含む対応版の実tag管理節から安全に更新でき、利用者編集・設定を保持し、preview／cancel write 0、apply／rollback／partial retry／rerunが実状態に一致する。
6. manifest／marketplace／edition／migration／inventory／CHANGELOG／guide／archive metadataが採番versionで一致し、過去の公開bytes・履歴・固定provenanceは不変である。
7. 変更面のMac回帰、必要なYasashii Windows native job、Git-free archive、release integrity、protected snapshotが0 FAILである。別版・別OS・未実行host、generic PyYAML `INCOMPLETE`をPASSへ数えない。
8. fresh独立EvaluatorがPhase AをPASSし、その完全treeだけが通常main、tag、Release、artifactへ進む。公開後は別fresh Evaluatorが実artifactをPASSするまで完了扱いにしない。
9. force push、reset、rebase、tag移動、既存asset上書き、履歴削除、公開範囲変更、private転記、installed cache直接編集、実利用者workspaceの一括更新は0件である。

## 検証スコープ（着手時に固定）

- 対象: fixed public差分、Sprint 047監査意味のcurrent 17 Skillsへの適応、root guidanceの5／7／9／10／14、overlay current handoff、Yasashii内容変更migration、registry／edition guard／checkpoint、distribution metadata、release／archive。
- 証拠形式: remote preflight、開始HEAD、public入力、candidate／main／tagの完全SHA・tree、変更path分類、common hash、protected snapshot／digest、canonical Harness参照元とPASS receipt、実command・exit・件数、Windows workflow／run／jobと環境、archive inventory／digest、Release URL／asset名／digest、代表更新prompt。
- 既存の小さいedition／overlay／migration／release／archive／instruction／checkpoint入口を優先する。無関係な全量suiteや新しい検証基盤を要求しない。

## 運用制約

- heavy処理は共通lock `/private/tmp/astra-audit-heavy-20260912.lock` を取得した1系統だけで実行する。開始前Node数は40以下、実行中60超で直ちに中断する。他のheavy処理と同時実行せず、他projectのprocessへ触れない。
- 自分が起動したserver、browser、watcher、child processを終了時に残さない。既存lockを削除・横取りしない。

## Non-scope

- private my-vault版、consulting slides、利用者全workspaceの一括migration、installed cacheの手編集。
- historical overlay baseの全量更新、Agentic／旧0.10.3 sourceの盲目的copy、Clarity再設計、Harness本体開発、検証基盤刷新、公開範囲変更。
- root guidanceの大幅削除・短縮、安全・role・counter規則の除去、approval review拒否と同じ結果を得る回避策。
- force push、reset、rebase、無断cleanup、tag移動、既存Release／artifact差替え、過去migration／安全assertの削除・緩和。

## 完了条件

Phase Aのfresh独立Evaluator PASS、許可済みの通常公開、別fresh独立Evaluatorによる実artifact PASSが揃い、Orchestratorがstateへ実SHA／tag／URL／digest／検証／残件を記録した場合だけ完了する。

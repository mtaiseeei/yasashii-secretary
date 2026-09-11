# Sprint 046 — 更新migration修正のYasashii適応と `0.13.1` 公開

- Type: standard
- Risk: high（版固有migration、Windows native CI、remote main、tag、Release、artifactを扱う）
- Candidate version: `0.13.1`
- 開始HEAD: `37a1c55a2e80c3d36d8295e753dee8e951077ca5`
- 依存: public `sprint-057` Phase Aのfresh独立Evaluator PASS済み完全SHA／tree
- 関連rubric: C1、C2、C3、C5、C6、C10、C12、C13、C15、C25（既存thresholdを維持）

## ゴール

publicで固定した更新migrationの到達性、`0.10.1`中断session回復、Windows CRLF互換をYasashiiの実際のrelease履歴とtemplateへ差分適応し、やさしい版の境界を保った`0.13.1`として公開する。publicのPASSをYasashii PASSへ流用せず、公開前candidateと公開後artifactを別々に独立評価する。

## 固定前提と許可

- Yasashii remote latestは`v0.13.0`で、`v0.10.3`も公開履歴に存在する。`v0.10.2`と`v0.10.3`のAGENTS／CLAUDE templatesは同内容だが、両tagを履歴として保持する。
- current templateの版固有差はClarityのedition markerである。Yasashiiの会話copy、identity、voice、README／LICENSE／mapping、overlay、repo正本をpublic内容で一括置換しない。
- 既存overlay baseの`0.12.0` historical pinは今回の同期対象ではなく、そのまま保護する。
- 利用者はYasashii版への適応とreleaseを明示許可済みである。必要なcandidate commit、通常push、PR、mainへの通常統合、新しいtag／Release／artifactは同じ許可で進め、再質問しない。

## Phase A — edition adaptation and candidate validation

1. public Phase A PASSの更新runtime／validatorの意味を固定入力にし、Yasashiiの実tagにある旧AGENTS／CLAUDE templates、marker、release履歴から版固有migration／asset／fingerprintを構成する。publicのtemplate hash、marker、migration metadataを盲目的にcopyしない。
2. 対応元はpublicと共通の8版（`0.8.0`、`0.9.0`、`0.9.1`、`0.9.2`、`0.10.0`、`0.10.1`、`0.10.2`、`0.12.0`）にYasashii固有の公開`0.10.3`と現行`0.13.0`を加える。各版から`0.13.1`へ有限で有効な経路を持ち、`0.13.0→0.13.1`はcontent write 0とする。
3. current manifest／marketplace、正本・互換CHANGELOG、release inventory、案内、archive metadataを`0.13.1`へ揃える。直接因果するversion、hash、config、fixtureだけを更新し、過去tag／Release／artifact／migration／安全assertを削除・緩和しない。
4. Yasashii固有のhistorical fixtureで旧template由来の管理節更新、前後の利用者bytes、版固有marker、content差分のないhop、改ざん拒否、pending回復、rollbackを検証する。
5. Macでfocused migration `46 PASS以上／0 FAIL`、release `13 PASS以上／0 FAIL`、Sprint 032 `16 PASS以上／0 FAIL`、Sprint 038 Patch 003 `9 PASS以上／0 FAIL`、release integrity、既存の小さいGit-free archive gate、変更したinventory／edition保護面を確認する。これらは既存最低件数であり、Yasashii固有source／hopのassertに伴う増加を許す。
6. exact candidateを通常pushし、既存Yasashii Windows workflowの対象update jobをNode 22／Python UTF-8 modeで実行する。public runや過去のYasashii runをPASSへ流用しない。
7. fresh独立Evaluatorがexact Yasashii candidate SHA／tree、Mac／Windows結果、Git-free archive、protected surfaceを評価する。Phase A PASS前にmain統合、tag、Releaseを行わない。

## Phase B — publication and post-publication verification

1. Phase A PASS済みYasashii treeだけをPR経由または同等の通常Git手順でremote mainへ統合し、新しい`v0.13.1` tag、Release、通常の配布artifactを作成する。
2. main／tag／Release／artifactのsourceと配布bytesを固定し、public版の公開状態とYasashii版の状態を別々に報告する。
3. Phase A担当とは別のfresh独立Evaluatorが、remote main、tag、Release metadata、ダウンロードしたGit-free artifactをread-onlyで照合する。artifact上でrelease integrity、archive gate、Yasashii historical migrationの代表入口、edition marker／protected surfaceを確認する。

## Acceptance Criteria

1. public fixed inputとの共通runtime意味と、Yasashii adapted migration／asset／fingerprintの関係が説明できる。一版のPASS、Generator自己評価、過去runをYasashii PASSへ昇格していない。
2. 対応10版すべてから`0.13.1`へ到達できる。`0.10.3`は実Yasashii tag／templateを根拠に扱い、`0.13.0→0.13.1`は管理fileのbytes／mtime、`changedPaths`、content適用件数を変えない。
3. `0.10.1`等の旧template fixtureでは必要な製品所有節だけが更新され、Yasashii marker、前後の利用者bytes、対象外block、改行、modeを保持する。customized／unknown、marker異常、改行以外のasset改ざん、stale plan、Secret、root外path、scope／edition不一致は副作用0件で拒否される。
4. pending sessionの新target回復、別plan／別確認、検証、開始前版へのrollbackが成立する。partial、backup／HEAD不一致を成功扱いしない。
5. current manifest／marketplace／CHANGELOG／inventory／案内／archive metadataが`0.13.1`で一致し、`0.13.0`以前のtag、Release、artifact、fixture、migration、評価履歴が変更されていない。
6. current edition marker、やさしい会話copy、identity／voice、README／LICENSE／mapping、overlay、`0.12.0` historical pin、spec／state／progress／feedbackを保護し、未分類同期差分とprivate固有値混入が0件である。
7. Macでmigration `46 PASS以上／0 FAIL`、release `13 PASS以上／0 FAIL`、Sprint 032 `16 PASS以上／0 FAIL`、Sprint 038 Patch 003 `9 PASS以上／0 FAIL`、release integrity、archive gate、変更inventory／edition保護が0 FAILである。追加source／hopのassertによるPASS件数増加は許す。
8. exact Phase A candidateに因果するYasashii Windows native update jobがNode 22で必須対象を0 FAILとする。別jobは実結果とcandidate因果を分けて記録する。
9. fresh独立EvaluatorがPhase AをPASSし、その完全SHA／treeだけがremote main、`v0.13.1` tag、Release source、artifactへ使われる。force push、tag移動、既存asset上書き、履歴削除は0件である。
10. freshな公開後Evaluatorが実Release artifactを取得し、candidate／tagとの配布bytes一致、version、release integrity、archive gate、代表migration、edition境界をPASSするまで完了扱いにしない。
11. private my-vault、installed plugin／cache、実利用者workspace、実`.clarity/**`／`CLARITY.md`、利用者本文・記憶・自由設定への変更・操作は0件である。

## 検証スコープ（着手時に固定）

- 必須: public fixed receipt、Yasashii実tag／templateからのhistorical migration、`0.10.3`、`0.13.0`空hop、`0.10.1` pending回復、Macの46／13／16／9回帰、release integrity、Git-free archive、変更inventory／protected surface、exact candidateのWindows update job。
- 証拠形式: public入力とYasashii candidate／main／tagの完全SHA・tree、実tag由来template hash、変更path分類、protected digestまたは同等snapshot、実command／exit／件数、Windows workflow／run／job IDと環境、archive inventory／digest、Release URL／asset名／digest。
- 上記で十分とする。full Sprint 044／050、Clarity stress、全Yasashii suite、全host matrix、新runner／collector／統一schema／attestationは追加条件にしない。既存CIの他jobは結果と因果を正直に分ける。

## Non-scope

- public版の再評価・公開判断、private版、installed plugin／cache、実workspaceへの適用。
- overlay base historical pinの更新、public guide／identity／voiceによるYasashii surfaceの一括置換、無関係なClarity修正。
- force push、tag移動、既存Release／artifact差替え、過去migration／安全assertの削除・緩和。

## 完了条件

Phase Aのfresh独立Evaluator PASS、許可済みPhase B公開、別のfresh独立Evaluatorによる公開後artifact PASSが揃い、OrchestratorがYasashii固有の実結果をstateへ記録した場合だけ完了する。

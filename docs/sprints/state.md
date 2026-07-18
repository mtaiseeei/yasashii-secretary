# Sprint State

<!-- オーケストレーターだけが書く進行状態の正本 -->

- Current ID: sprint-020-patch-001
- Retry Count: 2
- Next Planned: TBD

<!-- 2026-07-08: sprint-001 は再評価で合格（初回はクレジット方針の spec/実装不一致で不合格 →
     ユーザー確認で単段クレジットに正本改訂、回帰assert強化のうえ合格）。
     合格時の残課題「templates/ のインストール後パス解決」を sprint-001-patch-001 として処理してから sprint-002 へ。 -->

## スプリント一覧
| ID | Status | Contract | Progress | Feedback |
|----|--------|----------|----------|----------|
| sprint-001 | done | [contract](sprint-001.md) | [progress](../progress/sprint-001.md) | [feedback](../feedback/sprint-001.md) |
| sprint-001-patch-001 | done | [contract](sprint-001-patch-001.md) | [progress](../progress/sprint-001-patch-001.md) | [feedback](../feedback/sprint-001-patch-001.md) |
| sprint-002 | done | [contract](sprint-002.md) | [progress](../progress/sprint-002.md) | [feedback](../feedback/sprint-002.md) |
| sprint-002-patch-001 | done | [contract](sprint-002-patch-001.md) | [progress](../progress/sprint-002-patch-001.md) | [feedback](../feedback/sprint-002-patch-001.md) |
| sprint-003 | done | [contract](sprint-003.md) | [progress](../progress/sprint-003.md) | [feedback](../feedback/sprint-003.md) |
| sprint-001-patch-002 | done | [contract](sprint-001-patch-002.md) | [progress](../progress/sprint-001-patch-002.md) | [feedback](../feedback/sprint-001-patch-002.md) |
| sprint-003-patch-001 | done | [contract](sprint-003-patch-001.md) | [progress](../progress/sprint-003-patch-001.md) | [feedback](../feedback/sprint-003-patch-001.md) |
| sprint-004 | done | [contract](sprint-004.md) | [progress](../progress/sprint-004.md) | [feedback](../feedback/sprint-004.md) |
| sprint-005 | done | [contract](sprint-005.md) | [progress](../progress/sprint-005.md) | [feedback](../feedback/sprint-005.md) |
| sprint-006 | done | [contract](sprint-006.md) | [progress](../progress/sprint-006.md) | [feedback](../feedback/sprint-006.md) |
| sprint-007 | superseded | `backup/sprint-007-010-plan` | - | - |
| sprint-008 | done | [contract](sprint-008.md) | [progress](../progress/sprint-008.md) | [feedback](../feedback/sprint-008.md) |
| sprint-009 | done | [contract](sprint-009.md) | [progress](../progress/sprint-009.md) | [feedback](../feedback/sprint-009.md) |
| sprint-010 | done | [contract](sprint-010.md) | [progress](../progress/sprint-010.md) | [feedback](../feedback/sprint-010.md) |
| sprint-011 | done | [contract](sprint-011.md) | [progress](../progress/sprint-011.md) | [feedback](../feedback/sprint-011.md) |
| sprint-012 | done | [contract](sprint-012.md) | [progress](../progress/sprint-012.md) | [feedback](../feedback/sprint-012.md) |
| sprint-012-patch-001 | done | [contract](sprint-012-patch-001.md) | [progress](../progress/sprint-012-patch-001.md) | [feedback](../feedback/sprint-012-patch-001.md) |
| sprint-013 | done | [contract](sprint-013.md) | [progress](../progress/sprint-013.md) | [feedback](../feedback/sprint-013.md) |
| sprint-014 | done | [contract](sprint-014.md) | [progress](../progress/sprint-014.md) | [feedback](../feedback/sprint-014.md) |
| sprint-014-patch-001 | done | [contract](sprint-014-patch-001.md) | [progress](../progress/sprint-014-patch-001.md) | [feedback](../feedback/sprint-014-patch-001.md) |
| sprint-015 | done | [contract](sprint-015.md) | [progress](../progress/sprint-015.md) | [feedback](../feedback/sprint-015.md) |
| sprint-016 | done | [contract](sprint-016.md) | [progress](../progress/sprint-016.md) | [feedback](../feedback/sprint-016.md) |
| sprint-017 | done | [contract](sprint-017.md) | [progress](../progress/sprint-017.md) | [feedback](../feedback/sprint-017.md) |
| sprint-018 | done | [contract](sprint-018.md) | [progress](../progress/sprint-018.md) | [feedback](../feedback/sprint-018.md) |
| sprint-019 | done | [contract](sprint-019.md) | [progress](../progress/sprint-019.md) | [feedback](../feedback/sprint-019.md) |
| sprint-020 | done | [contract](sprint-020.md) | [progress](../progress/sprint-020.md) | [feedback](../feedback/sprint-020.md) |
| sprint-020-patch-001 | active | [contract](sprint-020-patch-001.md) | [progress](../progress/sprint-020-patch-001.md) | [feedback](../feedback/sprint-020-patch-001.md) |

## Deferred / Superseded
- sprint-007: superseded — 2026-07-15 製品方針転換により白紙化、`backup/sprint-007-010-plan` に退避

## Completion
- 2026-07-16: sprint-008〜012 と `sprint-012-patch-001` はすべて独立Evaluator評価に合格。Next Planned は `TBD`。
- 2026-07-16: single-repo Git-first + Chatwork 方針を承認。sprint-013を開始し、sprint-014を次に計画。
- 2026-07-16: sprint-013 初回評価はimplementation-issueで不合格。wizardがBufferをJSON化して配信する欠陥と回帰不足をGeneratorへ差し戻し（Retry 1）。
- 2026-07-16: Retry 1の最初のGeneratorは親ディレクトリ探索で保護対象repo配下のファイル名を列挙したため、内容読取・編集・実装修正前に停止。ユーザーへ報告し、承認後に対象repo内だけを読むfresh Generatorで再開。
- 2026-07-16: sprint-013 Retry 1は独立Evaluatorで合格。Buffer配信修正後、desktop/mobile/200%・400・部分失敗を実ブラウザ確認し、sprint-014を開始。
- 2026-07-16: sprint-014 Generatorが定期schedule、設定transaction、確認付きmanual sync、失敗分類、配布導線を実装。専用回帰77件・全offline回帰298件が0 FAILのため独立Evaluatorへ引き渡し。
- 2026-07-16: sprint-014 初回評価はspec-issueで不合格。実装回帰・browser・online参照導線は合格したが、public配布repoとprivate workspaceの実API live gate配置が未定義で、対象repoはSecret 0件・workflow 0件のため実APIが未検証。Plannerへ正本整理を差し戻し（Retry 1）。
- 2026-07-16: sprint-014 Retry 1でPlannerがlive gateを専用private test workspaceへ正本化し、Generatorが設定変更後の旧初回結果再表示を修正。専用回帰80件・全offline回帰298件が0 FAILのため再評価へ引き渡し。
- 2026-07-16: sprint-014 Retry 1再評価で表示修正・browser・専用回帰80件・全offline 298件・online 299件は合格。専用private test workspace、外部操作許可、test用token、非機密test roomが未準備のため `external-live-gate-unavailable` で不合格（Retry 2）。実装問題は残っておらず、live gateの準備待ち。
- 2026-07-17: ユーザーの明示許可により専用private test workspaceを作成。Repository Secret経由の実room discovery、選択room 1件の初回同期100件、workflow成功、commit/push、pull後の伏せ字検索foundまで成立したため、Sprint 014 Retry 2の独立再評価へ引き渡し。
- 2026-07-17: sprint-014 Retry 2は独立Evaluatorで39/40合格。専用34件・合成46件・offline 298件・online 299件が0 FAIL、実API live gateも伏せ字証跡で成立。評価後にschedule停止、room選択解除、Repository Secret削除を完了し、Sprint 008〜014の全計画を完了。
- 2026-07-17: 完成版 `89376b2` までpublic mainへpush。ユーザーからChatwork設定wizardの非エンジニア向け文言、GitHub Actions処理時間、API Token取得・組織管理者申請・Secret直接導線の改善依頼を受け、`sprint-014-patch-001`（Type: micro）を開始。
- 2026-07-17: sprint-014-patch-001 GeneratorがToken取得・組織管理者申請・動的Secret登録導線と非エンジニア向け表示を実装。全offline回帰298件・専用回帰100件・browser回帰が0 FAILのため独立Evaluatorへ引き渡し。
- 2026-07-17: sprint-014-patch-001は独立Evaluatorで合格。受入基準12/12、専用回帰41件（内包合成59件）・全offline回帰298件が0 FAIL、desktop・mobile・200%相当と安全・accessibility gateも違反0件で完了。
- 2026-07-17: ユーザーがGoogle Chatを除く改善を承認。開発以外の継続業務を同じprivate workspace内でプロジェクト管理し、別repo開発PJは参照ポインタで接続する `sprint-015` を計画。
- 2026-07-17: sprint-015 Generatorが候補確認、ライト／フル運用、正本境界、別repo開発PJポインタ、完了／再開を実装。専用回帰58件・全offline回帰298件が0 FAILのため独立Evaluatorへ引き渡し。
- 2026-07-17: sprint-015 初回評価はimplementation-issueで不合格。GitHub PAT形式の資格情報拒否、completed PJの同一案件候補除外、候補外JSONの `eligible: false` の3点をGeneratorへ差し戻し（Retry 1）。
- 2026-07-17: sprint-015 Retry 1で資格情報の共通拒否、既存PJ照合route、`eligible`のboolean固定を修正。専用回帰68件・全offline回帰298件が0 FAILのため独立Evaluatorへ再引き渡し。
- 2026-07-17: sprint-015 Retry 1は独立Evaluatorで合格。受入基準16/16、独立候補6件・資格情報31件、専用68件・全offline 298件が0 FAIL。Chatwork画像のREADME掲載も別枠で表示・秘密非露出を確認し、Google Chatは対象外のまま完了。
- 2026-07-17: 主対象をClaude Codeを使う非エンジニア一般へ広げ、現行正本・公開面・配布物から特定の教育サービス前提を外すsprint-016を開始。MIT、Shin-sibainu/cc-companyの単段クレジット、forkedFrom、既存実装、過去監査記録、Git履歴は維持する。sprint-017は更新体験を扱う候補として予約するが、sprint-016完了後に停止し、Fableレビュー前には着手しない。
- 2026-07-17: sprint-016 Generatorが一般の非エンジニア向け公開面、決定的な対象分類、監査記録の除外理由、再混入を検知する負テストを実装。専用2件、sprint-015回帰68件、全offline回帰300件が0 FAILのため独立Evaluatorへ引き渡し。
- 2026-07-17: sprint-016は独立Evaluatorで合格。受入基準10/10、専用2件、sprint-015回帰68件、全offline回帰300件が0 FAIL。現行対象78件で旧配布チャネル固有表現0件、README画像も固有表現・秘密情報0件を確認した。MIT、Shin-sibainu/cc-companyの単段クレジット、forkedFrom、version 0.2.0、過去監査記録、Git履歴を維持。ユーザー指示によりここで停止し、sprint-017はFableレビュー後まで着手しない。
- 2026-07-17: Claudeレビューとユーザー承認を反映し、更新機能を読み取り専用の診断基盤 `sprint-017` と、明示確認後の更新実行 `sprint-018` に分割して契約化。両Sprintともplannedで、実装は未着手。
- 2026-07-17: sprint-017は独立Evaluatorで合格。受入基準10/10、専用32/32、release負fixture 6/6、独自CLI 12ケース＋4選択、全offline 306/306、全online 307/307が成功。診断前後のplugin／workspace／Git／設定snapshotは一致し、実更新・migration・commit・push・設定変更の副作用0件を確認。公開versionは0.3.0。sprint-018はplannedのまま未着手。
- 2026-07-17: ユーザーの明示指示でsprint-018を開始。説明と明示確認後だけ、pushなし保護commit、カスタマイズ保護、plugin更新、冪等migration、検証、rollbackを行う実装へ進む。Google Chatと自動pushは対象外。
- 2026-07-17: sprint-018は独立Evaluatorで合格。受入基準14/14、専用41/41、Sprint 017回帰32/32、Sprint 016回帰2/2、全offline 308/308、全online 309/309が成功。確認前0変更、pushなし保護commit、固定された公式plugin更新経路、reload後再開、dry-run一致、冪等migration、0.2.0台帳なしbootstrap、検証失敗時のworkspace rollback、push・remote変更0件、secret・私的本文露出0件を一時Git repoで確認。公開versionは0.4.0で、sprint-017〜018の更新計画を完了。
- 2026-07-17: ユーザーがGoogle Chat方針 `1A`（各社所有Cloud project）、`2A`（選択した通常スペースだけ）、`3A`（同じprivate workspace＋GitHub Actions）を承認。`my-vault` のユーザーOAuth、日付別Markdown、初回全pageを基準に、DM、未使用scope、サービスアカウント、資格情報表示を除外したsprint-019／020をPlannerが契約化。Fableレビューを反映し、OAuth秘密境界、初回ローカル取得、PKCE＋state、SPACE再検証、grant revokeを明確化。Chatwork／Google Chatの共通wizard、サービス名表示、指定色CTA、3時間推奨・初期値への統一を追加し、sprint-019を開始。
- 2026-07-17: sprint-019 GeneratorがGoogle ChatのPKCE＋state付きDesktop OAuth、通常スペース限定選択、同一wizard session内の初回全page取得、日付別Markdown保存、基本検索、Chatworkとの共通wizardを実装。両サービスの3時間推奨・初期値と指定CTA色も反映し、専用37件・wrapper 11件・全offline 310件・全online 311件が0 FAIL。実Google Cloud／OAuth／API／Repository Secret／pushは行わず、独立Evaluatorへ引き渡した。
- 2026-07-17: sprint-019初回評価は受入基準11/15で不合格（implementation-issue）。OAuth認証が同一タブ遷移で元wizardのpollingを失う、cleanup-required／revoke失敗を成功断定する、初回0件時に存在しないhistory pathのgit addがexit 128になる3件をGeneratorへ差し戻し（Retry 1）。専用37件・wrapper 11件・全offline 310件・全online 311件は0 FAIL。
- 2026-07-17: sprint-019 Retry 1でOAuth別タブ＋元wizard polling、cleanup成功／失敗の正直な分岐表示、初回0件のlocal Git保存を修正。local bare remoteの0件／1件／push失敗を含む専用48件・wrapper 12件・全offline 310件・全online 311件が0 FAILのため、独立Evaluatorへ再引き渡した。
- 2026-07-17: sprint-019 Retry 1は独立Evaluatorで合格。受入基準15/15、C1〜C11全閾値、専用48/48、wrapper 12/12、全offline 310/310、全online 311/311、browser error 0。通常OAuth別タブ、cleanup全分岐、0件／1件local Git保存、push失敗時token破棄を独立確認し、sprint-020を開始。
- 2026-07-17: sprint-020 Generatorが3時間推奨の定期取得、設定変更、確認付き再取得、再認証、space別cursor・部分失敗回復を実装。専用44件・wrapper 15件・全offline 314件・全online 315件、desktop／mobile／200%相当が0 FAIL。実Google Cloud／OAuth／API／Repository Secret／Actions／remote pushはexternal live gateのため未実施で、独立Evaluatorへ引き渡した。
- 2026-07-17: sprint-020初回評価はlive gate前のimplementation-issueで不合格。既存staged fileが設定commitへ混入する、dispatch直後に過去runを今回の成功と誤認する、API無効403をadmin／scope blockへ誤分類する3件をGeneratorへ差し戻し（Retry 1）。専用44件・wrapper 15件・全offline 314件・全online 315件・browser評価は0 FAIL。
- 2026-07-17: sprint-020 Retry 1で管理path限定commitと既存Git状態保持、今回dispatch後の新規runだけの追跡、403 ErrorInfo reason別分類を修正。Evaluator敵対的検査0 FAIL、新規敵対的10件・本体45件・wrapper 16件・全offline 314件・全online 315件が0 FAILのため独立Evaluatorへ再引き渡した。
- 2026-07-17: sprint-020 Retry 1再評価は、管理path限定commitと403分類は合格したが、`createdAt` 欠落の新規run IDを今回runとして採用するimplementation-issueで不合格。時刻欠落／不正／dispatch前runをfail-closedで除外する修正をRetry 2へ差し戻した。専用45件・敵対的10件・wrapper 16件・全offline 314件・全online 315件・browserは0 FAIL。
- 2026-07-17: sprint-020 Retry 2で `createdAt` 欠落／不正／dispatch前runを候補外にし、dispatch後の有効時刻runだけを追跡するfail-closed判定へ修正。Evaluator時刻境界検査、専用45件・敵対的13件・wrapper 16件・全offline 314件・全online 315件が0 FAILのため、独立Evaluatorへ再引き渡した。
- 2026-07-17: sprint-020 Retry 2再評価はsynthetic／localのimplementation-issue 0件。受入1〜9・14は合格し、実OAuth／Google Chat API／Repository Secret／Actions／remote操作を伴う受入10〜13だけがユーザー明示許可と非機密test資源未準備のため `external-live-gate-unavailable`。Retry Count 3としてユーザーへlive gate許可を依頼する。
- 2026-07-18: sprint-020は専用private test workspaceで実Google Chat API、OAuth、Repository Secret、GitHub Actions、remote push、検索、同条件再実行を検証し、後始末まで完了。全スペース選択解除で今後の取得を停止し、Repository Secret 0件、workflow schedule 0件、OAuth連携削除、取得済み履歴保持を確認。専用50件・敵対的16件・wrapper 16件・全offline 314件・全online 315件が0 FAILで独立Evaluator合格。Chatwork／Google Chat共通の非エンジニア向け文章改善 `sprint-020-patch-001` を開始する。
- 2026-07-18: sprint-020-patch-001初回評価はimplementation-issueで不合格。Google Chat初回fixtureのデータ未設定、space取得失敗時の操作不能、mobile／200%相当での視覚順と読み上げ順の逆転をGeneratorへ差し戻す（Retry 1）。copy 60件、wrapper 5件、全offline 316件、全online 317件は0 FAILだが、引渡しどおりのbrowser完走とGoogle Chat初見理解平均が閾値未達。
- 2026-07-18: sprint-020-patch-001 Retry 1は初回3不具合の自動回帰を解消したが、独立初見セッションでChatwork完了画面が未選択roomの固定結果も表示する安全説明との矛盾と、Google Chatの合成接続用ファイル選択を完了できず3セッションとも未到達になる評価導線不備を確認。implementation-issueとしてRetry 2へ差し戻す。
- 2026-07-18: sprint-020-patch-001 Retry 2の最終評価中、ユーザー本人の手動UXレビューを受けて同じRetry 2をactiveへ戻した。Chatworkの自然なアクセス表現、detailsの開閉 affordance、Google Chat本人管理者向け画像ガイドに加え、Chatworkと同じく1回の確定で初回取り込みと自動取得設定を完了する一体型フローを正本化した。手動のみでは初回取り込みを行いscheduleは作らない。Retry Countは中断評価のため増やさない。

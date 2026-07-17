# Sprint State

<!-- オーケストレーターだけが書く進行状態の正本 -->

- Current ID: sprint-017
- Retry Count: 0
- Next Planned: sprint-018

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
| sprint-017 | active | [contract](sprint-017.md) | - | - |
| sprint-018 | planned | [contract](sprint-018.md) | - | - |

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

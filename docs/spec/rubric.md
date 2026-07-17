# Evaluation Rubric

## プロジェクト種別

Claude Codeプラグイン（Markdownのskills、templates、rules、安全なシーム）、一般PJのライト→フル運用、別repo `yasashii-harness` と開発PJ正本への参照導線、
およびChatwork専用のローカル設定wizard。静的整合、スクリプト化した実動作、模擬会話、外部repo境界に加え、
wizardはrunning UIをbrowserで操作し、desktop／mobileのスクリーンショットを証跡にする。

## 合格の基本条件

- Evaluatorは対象スプリントの実物を動かし、実行コマンド、結果、対象ファイル／repo、模擬会話の入力と観測結果を feedback に残す。
- C2・C5・C6 は5/5必須。1件でも構文欠陥、secret露出、安全違反、新規回帰があれば不合格。
- 1軸でも閾値を下回ればスプリント全体を不合格にする。
- やさしさの得点で安全・規律・回帰の欠陥を相殺しない。

## 検証方法

1. **manifest・参照整合**: marketplace / plugin JSON、SKILL frontmatter、name一意、参照先実在、改名後の識別子一致を検査する。
2. **回帰スイート**: Generatorの引き渡しコマンドを実行し、終了コードとassert数、失敗内容を記録する。既知失敗を合格扱いしない。
3. **シームのドライラン**: 一時 `secretary/` で記憶保護、path guard、journal追記、TODO、settings、reindex、timelineを実行する。文字列の存在だけでなく、構造と副作用をassertする。
4. **固定時刻**: `CC_SECRETARY_NOW` を与え、日付ファイル、期間境界、逆時系列、同一入力の同一出力を確認する。
5. **模擬会話**: LLM規律に関わる導線はgrepだけで合格にしない。Evaluatorが実際の指示・応答を記録する。
6. **リポジトリ境界**: `~/workspace/agentic-harness` をコマンド対象・参照元・複製元にせず、編集、checkout、commit、branch、remote変更、生成物作成を行っていないことを実装経路と作業ログから確認する。`yasashii-secretary` に同梱ハーネスが無く、`yasashii-harness` はpublic・`fork=false`の独立downstreamで、GitHubのorigin/upstream remote、fb9c303到達性、yasashii見出しoverlay、宣言的metadata allowlistが成立することを確認する。
7. **参照導線のoffline / online分離**: offline回帰はローカルの案内、`harness@yasashii-harness` を含む3コマンド、同梱不在、壊したfixtureの検出を評価する。online検査はGitHub APIで `mtaiseeei/yasashii-harness` の実在、`private=false`、`fork=false`、owner/name、marketplace `name` / `repository`、plugin `name` / `source` / `repository` / `homepage`、必要なCodex marketplace識別子と3コマンドの整合を評価する。ネットワーク不可をremote健全性のPASSとして数えず、`UNVERIFIED` 等でoffline結果と分離する。Sprint合格にはEvaluatorのonline証跡が必須。
8. **downstream差分境界**: `gentle-overlay/metadata-overrides.json` の対象ファイル・field・期待値がremote manifestsと完全一致し、allowlist外のmetadata変更、スキル本文・agents・runtimeロジック・その他上流由来の実装行の書換・削除が0件であることを、upstream fb9c303との差分と独自回帰で確認する。`yasashii` 見出しの追加は従来どおり許可する。
9. **手動ライブ確認**: サインイン済みClaude環境が利用可能ならプラグインを実際に導入して主要対話を確認する。利用不可なら、未実施項目を明示し、スクリプト＋模擬会話をゲートとする。
10. **wizard browser確認**: running wizardをdesktop幅とmobile幅（768px未満）で操作する。room選択、頻度選択、戻る、キャンセル、確定、0件、エラーを確認し、各幅のスクリーンショットをfeedbackへ残す。HTML/CSS文字列のgrepだけでは合格にしない。
11. **secret非漏洩**: synthetic tokenを使ったfixtureで、tracked files、git差分・履歴、Actionログ、wizard DOM、エラー、スクリーンショットを検索し、token値0件を証明する。実token値はEvaluatorの証跡へ出さない。
12. **GitHub Actions検証**: 30分／1h／3h／6h／12h／手動のみの各選択でscheduleが実際に変わり、17分起点、手動のみschedule無効、workflow_dispatch、失敗・timeout、競合時の安全な終了を確認する。
13. **Chatwork API境界**: 合成fixtureで0／1／100件、重複message ID、room部分失敗、API100件より前が無い状態を検証する。Sprint 014の実APIは、ユーザーが明示許可した専用private test workspace、Repository Secret、非機密test roomを使い、room一覧取得と1回の同期を確認する。合成fixtureは実API gateの代替にならない。
14. **single-repo境界**: private repo作成、初期commit、初回push、同じrepo内のpluginの利用設定・生成物、秘書、project、Chatwork設定／workflow／履歴を確認する。実API用test workspaceも同じ構成とし、Chatwork専用repo、永続ローカル専用正本、public remoteを検出した場合は不合格。public配布ソース自体の複製は要求しない。
15. **external live gate**: private test workspace作成、Repository Secret設定、workflow dispatch、push、Chatwork API送信は、それぞれのユーザー明示許可とtest用token・非機密test room準備を確認してから行う。準備不足は `external-live-gate-unavailable` としてSprint不合格にし、implementation-issueへ誤分類しない。実行後はschedule停止、Secret削除、test room選択解除を確認する。
16. **live gate証跡**: private状態、Secret名の存在、workflow run ID／状態、件数、commit hash、push／pull、検索状態を記録する。token値、不要なroom名、Chatwork本文は記録しない。public配布repoにSecret、Chatwork workflow、room設定、履歴が0件であることも確認する。
17. **プロジェクト境界**: 一時 `secretary/` で候補承認／拒否、一般PJライト作成、決定と状態の同時更新、フル昇格、完了／再開、成果物版管理、別repo開発PJポインタを実行する。確認前副作用0件、正本重複0件、path guard、既存build導線を構造とデータでassertする。

## 必須の模擬会話

対象機能が未実装のスプリントでは該当項目を評価対象外とし、実装された時点から回帰シナリオへ追加する。

1. **決定3本**: 異なる言い回しで決定を含む会話3本を行い、原文を保った節目確認が出ることを確認する。
2. **decidedゼロの日**: 決定を含むが記録されていない会話を締め、拾い漏れ確認が走ることを確認する。
3. **相談文脈**: 結論のない相談を一区切りし、topic追加前の1行確認と要点だけの保存を確認する。
4. **settings 3設定**: 同一タスクを、既定、フランク＋そのままOK、きっちり敬語＋ことば添え＋くわしくで行い、許可された範囲だけ挙動が変わることを確認する。
5. **先回り提案**: 報告3行目が適切なときだけ1提案となり、無断着手しないことを確認する。
6. **Chatwork検索found**: pull後の保存済み履歴から該当メッセージを見つけ、room・日付・該当箇所を根拠として返す。
7. **Chatwork検索not found→拒否**: 見つからない時に3択の構造化質問を出し、「同期しない」でworkflow・commit・pushが0件である。
8. **Chatwork検索not found→承認**: 「同期して再検索」でdispatch→完了待ち→成功確認→pull→同条件再検索となる。開始前同期や成功未確認のpullをしない。
9. **同期後もnot found**: 導入前／100件制約／未選択room／keyword／編集・削除／workflow失敗を区別し、「存在しない」と断定しない。
10. **一般PJ候補→拒否**: 複数行動・複数セッションの相談で理由つき確認を出し、「今回はまとめない」でファイル・journal・commitが0件である。
11. **一般PJ候補→承認**: 営業・マーケティング・新規事業の各例で、確認後だけ実内容入りのライト `PROJECT.md` が作られ、現在状況と次の入口から再開できる。
12. **PJ決定とTODO**: 確認済みPJの決定を承認すると当該PJの判断と状態が同時更新され、一般memoryへの本文重複がない。実行項目は既存TODO正本にPJ参照つきで入り、PJ内 `TODO.md` は作られない。
13. **ライト→フル**: 昇格トリガー到達時に理由つき確認を出し、拒否では不変、承認では指示・状態・判断・事実へ分離され、索引と関連リンクが整合する。
14. **別repo開発PJ**: 開発依頼はbuildへ進み、別repo正本を選んだ場合は作成・接続・公開範囲の確認後だけポインタを作る。workspace側に仕様・判断・Sprint状態・成果物を複製しない。
15. **一般PJ完了→再開**: 完了確認後だけcompletedになり、完了日・結果・残件を残して進行中一覧から外れるが検索できる。新作業では自動再開せず、再開確認後だけactiveに戻り、過去の完了記録を保持する。

個人化された文面の完全一致はassertしない。設定の読込、許可された分岐、既定へのフォールバック、確認フローを評価する。

## 採点基準と閾値

| ID | 基準 | 見るもの | 閾値 |
|---|---|---|---|
| C1 | 完成度 | 対象スプリントの受入基準と外から見える成果 | ≥4 |
| C2 | 構文・整合 | JSON/frontmatter/name/パス/識別子/参照先 | **5** |
| C3 | 機能の実証 | シーム、固定時刻、模擬会話、実データ構造 | ≥4 |
| C4 | 非エンジニア体験 | **既定値**での3行報告、標準語彙、進行、エラー説明 | ≥4 |
| C5 | 安全・規律 | 記憶保護、封じ込め、single private repo、Chatwork同期例外、secret非漏洩、push同意 | **5** |
| C6 | 無回帰 | 既存＋新規の全回帰が成功 | **5** |
| C7 | やさしさ | 言葉遣い、報告、先回り提案が、規律を緩めず機能する | ≥4 |
| C8 | wizard体験・デザイン | 添付デザイン言語、操作性、responsive、accessibility | ≥4 |

## スコアアンカー

### C1 完成度

- 5: 受入基準をすべて実物で確認し、条件付き項目の判断記録も明確。
- 4: 必須成果はすべて成立。任意の補助面だけ未実施で理由がある。
- 3以下: 必須成果、依存、条件付き判断、または必須external live gateのいずれかが欠ける。→不合格。live gate準備不足は実装不具合と区別する。

### C2 構文・整合【ゼロ許容】

- 5: manifest、SKILL、参照パス、改名後識別子、別repo導線が全て整合し、`harness@yasashii-harness`、remote manifestのname / source / repository / homepage、metadata allowlistの完全一致をonline証跡で確認できる。
- 4以下: JSON破損、name重複、デッドリンク、PJ正本の二重化、PROJECT／DECISIONS／MEMORY／AGENTS索引の不整合、旧名の実害ある残存、参照先不在、remote manifest不整合、metadata allowlist外変更、schedule表示とworkflow不一致、またはonline未検証のいずれかがある。→不合格。

### C3 機能の実証

- 5: 固定時刻ドライランと該当する模擬会話が全て成功し、PJ候補確認・ライト／フル・別repoポインタを含むデータと副作用の証跡がある。
- 4: 主要シームと模擬会話が成功。補助ケースのみ手動確認で理由がある。
- 3以下: grepや目視だけ、固定時刻未検証、模擬会話未実施、実API必須Sprintでlive gate未実施、またはassert失敗。→不合格。合成fixtureだけで実APIを合格にしない。

### C4 非エンジニア体験

- 5: 既定設定で3行型、一般技術用語、初出補足、進行表示、エラー説明が一貫する。
- 4: 軽微な表現差が1〜2箇所あるが、迷わず次の行動を選べる。
- 3以下: 過度な平易化、長すぎる報告、生英語エラー、進行不明が複数ある。→不合格。

### C5 安全・規律【ゼロ許容】

- 5: 記憶保護、純追加、journal限定例外、path guard、single private repo境界、Chatwork以外の外部同期禁止、token非漏洩、選択room限定、同意済みschedule／確認付きmanual pushに違反ゼロ。
- 4以下: token・credential露出、未確認のPJ作成／昇格／完了／再開／別repo接続、完了時の自動移動・削除、一般PJの無断repo分離、別repo開発PJ正本のworkspaceへの複製、public配布repoへのSecret／Chatwork workflow／room設定／履歴配置、Chatwork専用test repo、未選択room取得、確認なしexternal live gate、同意なしschedule push、未確認の破壊操作、または `~/workspace/agentic-harness` を編集・checkout・commit・branch・remote変更・生成物作成・複製元・コマンド対象のいずれかに使った事実が1件でもある。→不合格。

### C6 無回帰【ゼロ許容】

- 5: 既存・追加の全assertが成功し、既知の失敗も残らない。
- 4以下: 新規失敗、既知失敗の放置、回帰コマンド未実行のいずれか。→不合格。

### C7 やさしさ

- 5: 3行目の提案が1つ・根拠つき・選択権を残し、言葉遣いと進行表示が自然。規律の省略ゼロ。
- 4: 大筋は守るが、提案や説明の自然さに軽微な改善余地がある。
- 3以下: 押しつけ、無断着手、過度な幼稚化、またはやさしさを理由に検証・役割分離を省く。→不合格。

### C8 wizard体験・デザイン

- 5: desktop／mobileの実画面で、1 step 1 message、CTA最大2、余白中心の階層、指定palette・4px radius・14px中心が一貫し、keyboard／focus／label／contrastを含む主要操作が迷いなく完了する。Tesla商標・写真・gradient・shadow・scale hoverは0件。
- 4: 必須フローとresponsive・accessibilityは成立し、余白やtypographyに軽微な改善余地が1〜2点ある。
- 3以下: screenshot未取得、running UI未操作、mobile崩れ、操作不能、指定外の装飾、primary blue乱用、またはaccessibility欠陥がある。→不合格。

## スプリント別の重点

| Sprint | 重点 |
|---|---|
| 008 | 改名整合、独立downstream/origin/upstream境界、参照導線、section 12のonline実在検査、全回帰 |
| 009 | journal純追加、シーム副作用、topics/TODO/reindex、固定時刻、記憶保護 |
| 010 | timeline決定性、節目・締め・相談文脈の模擬会話、daily統合 |
| 011 | 先行規約の整合、preferences v2、settings確認、3設定の模擬会話 |
| 012 | journal原本からの週次、索引退避確認、条件付き機能の判断記録 |
| 013 | single private repo初回push、secret案内、room wizard、初回0/100件、基本検索、desktop/mobile screenshot |
| 014 | schedule全選択、同意済み自動push、確認付きmanual sync、wait/pull/retry、専用private test workspaceの実API、設定変更結果の現在値、配布状態、全回帰 |
| 015 | PJ候補検出と確認前副作用0件、一般PJのライト→フル・完了・再開、決定・状態・TODO・成果物の正本境界、別repo開発PJポインタ、build・Chatworkを含む全回帰 |

## 差し戻し分類

- `implementation-issue`: 実装が仕様を満たさない。Generatorへ戻す。
- `spec-issue`: 契約・仕様が矛盾または不足。Plannerへ戻す。
- rubric変更はEvaluatorが提案できるが、適用はPlannerだけが行う。

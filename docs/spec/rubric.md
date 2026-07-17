# Evaluation Rubric

## プロジェクト種別

Claude Codeプラグイン（Markdownのskills、templates、rules、安全なシーム）、一般PJのライト→フル運用、別repo `yasashii-harness` と開発PJ正本への参照導線、
およびChatwork／Google Chat専用のローカル設定wizard。静的整合、スクリプト化した実動作、模擬会話、外部repo境界に加え、
wizardはrunning UIをbrowserで操作し、desktop／mobileのスクリーンショットを証跡にする。

## 合格の基本条件

- Evaluatorは対象スプリントの実物を動かし、実行コマンド、結果、対象ファイル／repo、模擬会話の入力と観測結果を feedback に残す。
- C2・C5・C6・C9・C10・C11 は5/5必須。1件でも構文欠陥、secret露出、安全違反、新規回帰、現行面の配布チャネル依存、無確認の更新副作用、またはGoogle ChatのOAuth／選択スペース境界違反があれば不合格。
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
10. **wizard browser確認**: running wizardをdesktop幅とmobile幅（768px未満）で操作する。Chatwork roomまたはGoogle Chat spaceの選択、間隔、戻る、キャンセル、確定、0件、エラーを確認し、各幅のスクリーンショットをfeedbackへ残す。全画面に対象サービス名が可視かつaccessible nameとして存在し、primary CTA背景がChatwork `#F03747`／Google Chat `#11BB62`、前景が `#000000`、contrast ratio 4.5:1以上であることをcomputed styleで確認する。HTML/CSS文字列のgrepだけでは合格にしない。
11. **secret非漏洩**: synthetic token／OAuth credentialを使ったfixtureで、厳格secret（client secret、認可コード、access token、refresh token、OAuth client JSON全文）がtracked files、Git差分・履歴、Actionログ、journal、fixture、再読込後も残るwizard DOM、エラー、スクリーンショット、評価証跡に0件であることを証明する。client IDは識別子として一時的な認可URLと管理者チェックリストだけ表示可とし、それ以外の永続物では0件にする。認可URL／callback URL自体を証跡へ記録しない。
12. **GitHub Actions検証**: Chatworkの30分／1h／3h／6h／12h／手動のみと、Google Chatの1h／3h／6h／12h／手動のみでscheduleが実際に変わり、両サービスで3hが推奨・初期値、毎時0分回避、手動のみschedule無効、workflow_dispatch、失敗・timeout、競合時の安全な終了を確認する。
13. **Chatwork API境界**: 合成fixtureで0／1／100件、重複message ID、room部分失敗、API100件より前が無い状態を検証する。Sprint 014の実APIは、ユーザーが明示許可した専用private test workspace、Repository Secret、非機密test roomを使い、room一覧取得と1回の同期を確認する。合成fixtureは実API gateの代替にならない。
14. **single-repo境界**: private repo作成、初期commit、初回push、同じrepo内のpluginの利用設定・生成物、秘書、project、Chatwork／Google Chat設定・workflow・履歴を確認する。実API用test workspaceも同じ構成とし、チャット専用repo、永続ローカル専用正本、public remoteを検出した場合は不合格。public配布ソース自体の複製は要求しない。
15. **external live gate**: private test workspace作成、Repository Secret設定、OAuth認可、workflow dispatch、API送信、pushは、それぞれのユーザー明示許可とtest資格情報・非機密test room／space準備を確認してから行う。準備不足は `external-live-gate-unavailable` としてSprint不合格にし、implementation-issueへ誤分類しない。実行後はschedule停止、Secret削除、test対象選択解除を確認し、Google ChatではOAuth grant／tokenのrevokeまで確認する。
16. **live gate証跡**: private状態、Secret名の存在、workflow run ID／状態、件数、commit hash、push／pull、検索状態を記録する。token／OAuth client値、不要な対象名、チャット本文は記録しない。public配布repoにSecret、チャットworkflow、対象設定、履歴が0件であることも確認する。
17. **プロジェクト境界**: 一時 `secretary/` で候補承認／拒否、一般PJライト作成、決定と状態の同時更新、フル昇格、完了／再開、成果物版管理、別repo開発PJポインタを実行する。確認前副作用0件、正本重複0件、path guard、既存build導線を構造とデータでassertする。
18. **配布チャネル非依存**: `git ls-files` を母集団にし、現行正本・公開面・配布物・project guidance・新規Sprint文書で旧配布チャネル固有表現が0件であることを機械検査する。過去のprogress／feedback／評価証跡は監査記録として対象外パスを明示し、無条件のrepo全体grepを合格根拠にしない。画像等の非テキストは表示内容を確認する。
19. **維持項目の正負検査**: 一般化後もMIT、Shin-sibainu/cc-companyの単段クレジット、`forkedFrom`、配布識別子が残ることを確認する。対象外パスへ誤って旧表現を置くだけでは合格しない負テストと、現行対象へ旧表現を再混入させた際に失敗する負テストを行う。
20. **更新診断の無副作用**: clean／customized／台帳なし／最新版確認不能のfixtureで診断し、plugin、workspace、Git、設定、migration、reload／restart実行が0件であることを前後snapshotで確認する。
21. **version・CHANGELOG・台帳**: marketplace／plugin／CHANGELOGのversion整合、不一致検出、最小台帳のfield allowlistを検査する。台帳にファイル本文、差分本文、記憶、会話、外部データ、secret、資格情報が0件であることをsynthetic値で確認する。
22. **実更新の安全境界**: 承認／拒否／キャンセル、clean／customized／unknown-baseline／台帳なし0.2.0、commit不能、migration失敗を操作し、確認前0変更、現状維持の既定、push 0件、dry-run一致、冪等性、検証後だけ成功報告を確認する。
23. **rollback**: plugin更新後、migration途中、検証失敗の各fixtureで、workspaceとpluginの変更範囲を区別し、直前commitと更新前versionから復元または正確な手動手順へ進めることを確認する。
24. **Google Chat OAuth境界**: synthetic OAuth clientでPKCE＋stateを使うloopback成功／拒否／state不一致／callback不一致／Secret登録失敗を操作し、要求scopeのallowlist、厳格secret非露出、認可コード即時交換、確認前副作用0件、再認証時の既存履歴維持、OAuth後キャンセル時のSecret削除とgrant revoke案内を確認する。
25. **Google Chatデータ境界**: `SPACE`／`DIRECT_MESSAGE`／`GROUP_CHAT` を含むfixtureで候補が通常スペースだけになること、初期選択0件、取得実行時のspace type再検証、0件／複数page／thread／同日差分／取得範囲内の編集・削除／添付メタデータ／部分失敗を検証する。DM、group DM、添付本文、未選択spaceは0件でなければならない。差分範囲外の古い編集・削除が反映されない正常仕様も確認する。
26. **Google Chat実API**: Sprint 020ではユーザーが明示許可した組織所有test Cloud project、`Internal` OAuth、専用private test workspace、非機密test spaceで、接続、候補選択、初回取得、3時間schedule相当のworkflow、commit、push／pull、検索を確認する。合成fixtureは実API gateの代替にならない。
27. **wizard copy理解性**: Chatwork／Google Chatの全画面copy inventoryを取り、heading、primary body、label、CTA、details、empty／loading／error／successを画面と状態へ対応づける。primary pathの内部用語scan、必須意味要素、button／heading、DOM構造の自動検査を行い、全文一致だけを合格根拠にしない。running UIをdesktop／mobile／200%相当で初見操作し、「今すること」「次に起きること」「読む範囲」「保存先」「共同編集者への可視性」「自動取得・保存」「履歴保持」を画面だけから答えられるか、非エンジニア想定の理解テストで確認する。

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
16. **更新確認だけ**: 「最新版にして」で現在版、最新版、変更点、影響、衝突可能性を説明し、「今回は確認だけ」でplugin／workspace／Git／設定が0変更となる。
17. **customized更新**: 変更済みと不明判定のファイルは「現状を残す」が既定で、明示選択したファイルだけ更新される。無応答・拒否は0変更となる。
18. **台帳なし0.2.0**: 既知基準一致だけを未変更と判断し、それ以外を安全側へ倒してdry-runを示す。再実行では追加変更0件となり、失敗時は復元方法が分かる。
19. **Google Chat未接続**: 「Google Chatにつなぎたい」で高度な設定であること、管理者に依頼する事項、`Internal`／Desktop app／必要APIを順に示し、資格情報を会話へ貼るよう求めない。
20. **Google Chatスペース選択**: 通常スペース、DM、グループDMが存在する状態で、通常スペースだけを0件初期選択から選べる。確定前キャンセルではSecret、設定、workflow、履歴、commitが0件である。
21. **Google Chat検索not found→拒否／承認**: 拒否ではworkflow・commit・push 0件、承認ではdispatch→待機→成功確認→pull→同条件再検索となり、保持設定や未選択の可能性を残す。
22. **Google Chat再認証**: refresh token失効状態で取得を繰り返さず、原因を日本語で示してloopback再認証へ戻る。成功後も既存スペース選択と履歴が維持される。
23. **チャット設定の初見理解**: ChatworkとGoogle Chatを1回ずつ、技術詳細を開かずに開始→準備→選択→間隔→確認→完了または失敗までたどる。各画面で「今すること」を一文で言い直せ、0件／手動のみでは停止と履歴保持の両方を説明でき、安全同意の意味を落とさない。

個人化された文面の完全一致はassertしない。設定の読込、許可された分岐、既定へのフォールバック、確認フローを評価する。

## 採点基準と閾値

| ID | 基準 | 見るもの | 閾値 |
|---|---|---|---|
| C1 | 完成度 | 対象スプリントの受入基準と外から見える成果 | ≥4 |
| C2 | 構文・整合 | JSON/frontmatter/name/パス/識別子/参照先 | **5** |
| C3 | 機能の実証 | シーム、固定時刻、模擬会話、実データ構造 | ≥4 |
| C4 | 非エンジニア体験 | **既定値**での3行報告、標準語彙、進行、エラー説明 | ≥4 |
| C5 | 安全・規律 | 記憶保護、封じ込め、single private repo、承認済みチャット同期例外、secret非漏洩、push同意 | **5** |
| C6 | 無回帰 | 既存＋新規の全回帰が成功 | **5** |
| C7 | やさしさ | 言葉遣い、報告、先回り提案が、規律を緩めず機能する | ≥4 |
| C8 | wizard体験・デザイン | 添付デザイン言語、操作性、responsive、accessibility | ≥4 |
| C9 | 配布チャネル非依存 | 現行正本・公開面・配布物の固有表現0件、一般利用者だけで理解できること、維持項目 | **5** |
| C10 | 更新の安全性 | 診断無副作用、説明後の明示確認、カスタマイズ保護、冪等migration、rollback、push禁止 | **5** |
| C11 | Google Chat境界 | 各社所有Internal OAuth、最小read-only scope、通常スペース限定、秘密非露出、同意済み同期 | **5** |

## スコアアンカー

### C1 完成度

- 5: 受入基準をすべて実物で確認し、条件付き項目の判断記録も明確。
- 4: 必須成果はすべて成立。任意の補助面だけ未実施で理由がある。
- 3以下: 必須成果、依存、条件付き判断、または必須external live gateのいずれかが欠ける。→不合格。live gate準備不足は実装不具合と区別する。

### C2 構文・整合【ゼロ許容】

- 5: manifest、SKILL、参照パス、改名後識別子、別repo導線が全て整合し、`harness@yasashii-harness`、remote manifestのname / source / repository / homepage、metadata allowlistの完全一致をonline証跡で確認できる。現行の製品説明に旧配布チャネル固有表現がなく、一般の非エンジニア向けに整合する。
- 4以下: JSON破損、name重複、デッドリンク、PJ正本の二重化、PROJECT／DECISIONS／MEMORY／AGENTS索引の不整合、旧名の実害ある残存、現行対象への旧配布チャネル固有表現の残存、参照先不在、remote manifest不整合、metadata allowlist外変更、schedule表示とworkflow不一致、またはonline未検証のいずれかがある。→不合格。

### C3 機能の実証

- 5: 固定時刻ドライランと該当する模擬会話が全て成功し、PJ候補確認・ライト／フル・別repoポインタを含むデータと副作用の証跡がある。
- 4: 主要シームと模擬会話が成功。補助ケースのみ手動確認で理由がある。
- 3以下: grepや目視だけ、固定時刻未検証、模擬会話未実施、実API必須Sprintでlive gate未実施、またはassert失敗。→不合格。合成fixtureだけで実APIを合格にしない。

### C4 非エンジニア体験

- 5: 既定設定で3行型、一般技術用語、初出補足、進行表示、エラー説明が一貫する。Chatwork／Google Chat wizardは最初の1文で今することが分かり、1画面1判断・1段落1要点、結果が分かるCTA、失敗時の「何が起きたか→次にすること」が全画面で成立する。非エンジニア想定の初見理解テストで安全上の誤解が0件。
- 4: 軽微な表現差が1〜2箇所あるが、迷わず次の行動を選べ、読む範囲・保存先・可視性・自動取得・履歴保持を誤解しない。
- 3以下: 過度な平易化、長すぎる報告、生英語エラー、進行不明、内部用語が主説明を占める、不自然な直訳、CTA後の結果が分からない、または安全上の意味を説明できない画面が複数ある。→不合格。

### C5 安全・規律【ゼロ許容】

- 5: 記憶保護、純追加、journal限定例外、path guard、single private repo境界、Chatwork／Google Chat以外の外部同期禁止、token非漏洩、選択対象限定、同意済みschedule／確認付きmanual pushに違反ゼロ。
- 4以下: token・credential露出、未確認のPJ作成／昇格／完了／再開／別repo接続、完了時の自動移動・削除、一般PJの無断repo分離、別repo開発PJ正本のworkspaceへの複製、public配布repoへのSecret／チャットworkflow／対象設定／履歴配置、チャット専用test repo、未選択対象取得、確認なしexternal live gate、同意なしschedule push、未確認の破壊操作、または `~/workspace/agentic-harness` を編集・checkout・commit・branch・remote変更・生成物作成・複製元・コマンド対象のいずれかに使った事実が1件でもある。→不合格。

### C6 無回帰【ゼロ許容】

- 5: 既存・追加の全assertが成功し、既知の失敗も残らない。
- 4以下: 新規失敗、既知失敗の放置、回帰コマンド未実行のいずれか。→不合格。

### C7 やさしさ

- 5: 3行目の提案が1つ・根拠つき・選択権を残し、言葉遣いと進行表示が自然。規律の省略ゼロ。
- 4: 大筋は守るが、提案や説明の自然さに軽微な改善余地がある。
- 3以下: 押しつけ、無断着手、過度な幼稚化、またはやさしさを理由に検証・役割分離を省く。→不合格。

### C8 wizard体験・デザイン

- 5: desktop／mobile／200%相当の実画面で、1 step 1 message、1画面1判断、CTA最大2、画面別の最大情報量、technical detailの段階表示、余白中心の階層、指定palette・4px radius・14px中心が一貫し、keyboard／focus／label／contrastを含む主要操作が迷いなく完了する。Tesla商標・写真・gradient・shadow・scale hoverは0件。
- 4: 必須フローとresponsive・accessibilityは成立し、余白やtypographyに軽微な改善余地が1〜2点ある。
- 3以下: screenshot未取得、running UI未操作、mobile／200%崩れ、操作不能、copy inventoryの欠落、対象サービス名の欠落、指定背景色・黒前景・4.5:1 contrastの不一致、指定外の装飾、青色primary CTAの残存、またはaccessibility欠陥がある。→不合格。

### C9 配布チャネル非依存【ゼロ許容】

- 5: 対象パスを明示した機械検査で旧配布チャネルの固有名称・英字名が0件。期数、授業回、教育課程、参加者であることを利用前提にする説明も目視で0件で、一般の非エンジニアが公開面だけで導入・利用を理解できる。MIT、Shin-sibainu/cc-companyの単段クレジット、`forkedFrom`、既存機能、Git履歴は維持される。
- 4以下: 対象面に固有表現または参加者前提が1件でも残る、一般化で導入手順や機能説明が欠落する、監査記録を改変する、維持対象を削除する、または検査の対象・除外理由が不明確。→不合格。

### C10 更新の安全性【ゼロ許容】

- 5: 診断は完全な読み取り専用。実更新は説明と明示確認後だけで、pushなしの復元地点、現状維持を既定にした個別選択、secret非保存、dry-run一致、migration冪等性、検証、plugin／workspaceを区別したrollbackがすべて成立する。
- 4以下: 診断中の副作用、了承前変更、customized／unknownファイルの既定上書き、secretや私的本文の台帳保存、保護commitなしの更新、push、dry-runと本実行の不一致、migration再実行差分、検証前の成功報告、rollback不能の隠蔽のいずれかが1件でもある。→不合格。

### C11 Google Chat境界【ゼロ許容】

- 5: 組織所有Cloud projectと `Internal` Audience、Desktop appのPKCE＋state付きloopback、最小read-only scope、Repository Secret直接登録、厳格secret非露出、`SPACE`限定、DM／group DM／添付本文0件、選択対象だけの冪等保存、同意済み3時間推奨scheduleがすべて成立する。
- 4以下: ShigApps共通External app、サービスアカウント／JSON鍵、write／admin／未使用scope、厳格secretの表示・保存、client IDの永続物保存、DM／group DM／未選択space取得、同日既存投稿消失、添付本文取得、確認前の履歴保存／commit／push、public repo保存、実API未検証のいずれかが1件でもある。→不合格。live gate準備不足は `external-live-gate-unavailable` と区別する。

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
| 016 | 現行正本・公開面・配布物の旧配布チャネル固有表現0件、一般の非エンジニア向け整合、MIT・単段クレジット・forkedFrom維持、監査記録例外、全回帰 |
| 017 | manifest／CHANGELOG version整合、最小台帳、更新案内、最新版確認不能、診断中の全副作用0件、全回帰 |
| 018 | 説明後の明示確認、pushなし保護commit、customized個別選択、台帳なし0.2.0、冪等migration、検証、rollback、全回帰 |
| 019 | README高度設定、共通wizard、サービス名明示、サービス別CTA色、両サービス3時間推奨、各社所有Internal OAuth、PKCE＋state、初回ローカル取得、`SPACE`限定選択、日付別Markdown、thread／添付メタデータ、基本検索、desktop／mobile、全回帰 |
| 020 | 3時間推奨schedule、取得範囲内の差分統合、同意済みcommit・push、設定変更、確認付き再取得、再認証、Google Chat実API live gate、OAuth revokeを含む後始末、全回帰 |
| 020-patch-001 | Chatwork／Google Chat全画面copy inventory、primary pathの難語除去、1画面1判断、technical detail退避、0件／手動のみ／失敗／完了copy、desktop／mobile／200%、初見理解テスト、安全意味の欠落0件、全回帰 |

## 差し戻し分類

- `implementation-issue`: 実装が仕様を満たさない。Generatorへ戻す。
- `spec-issue`: 契約・仕様が矛盾または不足。Plannerへ戻す。
- rubric変更はEvaluatorが提案できるが、適用はPlannerだけが行う。

# Constraints

横断制約・禁止事項・安全方針。ここに書く条件は、受け入れ済み機能を含め**回帰させてはならない不変条件**。

## 1. 製品とリポジトリの境界

1. `~/workspace/agentic-harness` は全面操作禁止。ファイル編集、checkout / switch、commit、branch作成・変更、remote変更、生成物作成、複製元としての利用、当該checkoutを対象にしたコマンド実行をすべて禁止する。上流参照はGitHub上の `mtaiseeei/agentic-harness` だけを使う。
2. やさしいハーネスの正本は別リポジトリ `yasashii-harness`。`yasashii-secretary` に `harness/` のコピーや planner / generator / evaluator の agents を同梱しない。
3. `yasashii-secretary` は `yasashii-harness` のインストール案内・存在確認・接続導線だけを持つ。参照先が無い、リンクが切れる、同梱コピーが復活する状態を回帰として扱う。
4. `mtaiseeei/yasashii-harness` は独立public downstream repoとして、GitHub API上 `private=false`、`fork=false` でなければならない。初期基点は `mtaiseeei/agentic-harness` の fb9c303 とする。
5. `yasashii-harness` の本文・スキル・agents・runtimeロジックの差分は、**見出しに `yasashii` を含む追加セクションだけ**。上流由来の実装行の書換・削除は禁止。上流変更は本作業のスコープ外であり、将来あらためて明示承認された場合だけ上流側の別branch / PR手順に分離する。
6. remoteは `origin=https://github.com/mtaiseeei/yasashii-harness.git` と、読取専用の `upstream=https://github.com/mtaiseeei/agentic-harness.git` を分離する。上流追随はGitHubの `upstream/main` から行い、ローカル `~/workspace/agentic-harness` を参照元・複製元・書込先・検査対象にしない。
7. 親repo `mtaiseeei/agentic-harness` は移管・改名・変更しない。GitHubのfork badge／parent relation／同じforkから上流へPRする導線は非ゴール。上流変更は本作業では行わず、将来あらためて明示承認された場合だけ `agentic-harness` 側の別branch / PR手順に分離する。
8. 上流由来行を変更できる機械的例外は、独立downstreamの配布識別metadataだけ。`.claude-plugin/marketplace.json` のmarketplace `name=yasashii-harness` / `repository=mtaiseeei/yasashii-harness`、plugin `name=harness` / `source=./plugins/harness`、plugin manifestの `repository` / `homepage=https://github.com/mtaiseeei/yasashii-harness`、必要なCodex marketplace識別子をdownstream向けに揃える。
9. metadata例外は `gentle-overlay/metadata-overrides.json` に対象ファイル・JSON field・期待値を宣言し、これをoverlay兼allowlistの唯一の正本とする。sync後に完全一致を検査し、allowlist外のmetadata変更と上流由来行の書換・削除は0件でなければならない。

## 2. 外部データ・プライバシー・Git

1. Gmail / Calendar / Drive / Microsoft 365 / Notion等は公式リモートコネクタで都度参照し、同期層や `10_sources` 型の汎用複製を作らない。**同期例外は、選択したChatwork roomとGoogle Chat通常スペースを同じprivate repoへ保存する承認済みGitHub Actions**に限定する。
2. コネクタ由来の本文を記憶やjournalへ複製しない。Chatwork／Google Chat本文はサービス別の履歴領域だけに保存し、取得件数・対象・時刻等の同期状態もjournalではなく各サービス専用の状態記録に分ける。
3. Chatwork API Tokenを含む資格情報、パスワード、APIキーを保存・コミットしない。Chatwork API Tokenの正本はGitHub上の安全な保管場所（Repository Secret）だけであり、repo本文、設定、ログ、エラー、fixture、スクリーンショット、会話、wizardに値を出さない。Tokenは有効期限がなくChatwork機能へフルアクセスできる資格情報として扱い、第三者へ開示しない。
4. ユーザーワークスペースはprivate GitHub repoでなければならない。public repoへの初回pushまたはチャット保存を拒否し、privateからpublicへ変更されたことを検出した場合は同期を止める。
5. private repoの共同編集者は保存されたChatwork／Google Chat本文を読める。wizardは対象選択確定前にこの影響を表示し、ユーザーは所属組織の情報管理方針に従う。
6. 初回オンボーディングはrepo作成、初期commit、初回pushを完了条件とする。既存remoteがある場合は現在のrepoを使う確認を行い、Chatwork専用repoを黙って作らない。
7. scheduleによるChatwork／Google Chatの自動commit・pushは、対象・間隔・保存内容を示して同意を得た後だけ許可する。検索不成立等から開始する予期しない手動同期は、実行直前に構造化質問で確認する。
8. 通常の秘書・一般プロジェクト成果のpushは同じworkspace repoのGit運用に従う。別repoを正本にした開発PJはそのrepoのGit運用に従い、workspace側へ履歴や正本を複製しない。チャットを別repoへ分離したり、秘書の記憶・成果物だけを永続的なローカル専用正本にしたりしない。
9. Chatworkの取得は選択roomだけに限定し、message ID単位で冪等、つまり同じ取得を繰り返しても重複しない。API応答に無いことだけを理由に取得済み履歴を削除しない。
10. Chatwork APIの最新100件制約をユーザーへ明示する。導入前履歴の欠落、初回0件、100件より古い履歴を取得できない状態をエラーや「存在しない」の根拠にしない。
11. コミットメッセージは、何をしたかが分かる日本語1行とし、可能な範囲で固有名詞を含める。`git log` を予備のタイムラインとして使える粒度を保つ。
12. public / MIT と Shin-sibainu/cc-company の単段クレジットを維持する。中間フォークを必須クレジットとして追加しない。
13. public配布repo `yasashii-secretary` へChatwork／Google ChatのRepository Secret、同期workflow、対象設定、同期状態、履歴を置かない。これらは利用者ごとのsingle private workspaceだけに置く。
14. 実API評価は専用private test workspaceで行う。test workspaceもpluginの利用設定・生成物、秘書、通常project、Chatwork／Google Chat設定・workflow・履歴を同じrepoに置き、チャット専用repoへ分離しない。public配布ソース自体の複製は要求しない。
15. private test workspaceの作成、Repository Secret設定、workflow dispatch、remote push、Chatwork／Google Chat API送信はexternal live gateとする。各操作へのユーザー明示許可と、サービス別のtest資格情報・非機密test room／spaceの準備が揃う前に実行しない。
16. external live gateの準備が無い場合、合成fixtureで実APIを代替せずSprintを不合格とする。ただし理由は `external-live-gate-unavailable` と明記し、実装不具合としてGeneratorへ誤分類しない。
17. live gateの権限は、専用private test workspaceと非機密test room／spaceの読取・同期に必要な範囲へ限定する。証跡にはSecret名の存在、workflow run状態、件数、commit、push／pull、検索状態だけを残し、token値、不要な対象名、チャット本文を残さない。
18. live gate完了後はscheduleを停止し、Repository Secretを削除し、test room／spaceの選択を解除する。Google ChatではGoogle側のOAuth grant／tokenもrevokeし、アプリ権限の取消を確認する。test workspaceと取得済み履歴を削除・archiveする場合は対象と影響を示し、ユーザーの明示確認後だけ行う。

## 3. 記憶保護と封じ込め

1. 空内容・実質空で既存記憶を上書きしない。
2. 削除は、対象を示す警告とユーザーの明示確認を分ける2段階にする。
3. 記憶の増減時は `MEMORY.md` 索引を追従させ、200行以内を保つ。
4. `secretary/` の記憶・成果物に対する読み書き・削除・ディレクトリ作成は path guard を先に通し、symlink解決後も `secretary/` 内である場合だけ許可する。基点自体が外部を指す symlink の場合も拒否し、拒否前に副作用を出さない。
5. 境界外、空・`.`・親方向への脱出を非ゼロで拒否する。境界外 symlink は `exit 3` とし、文字列の前方一致だけで判定しない。
6. 再セットアップは既存 `secretary/` のバックアップ提案と明示確認を先に行い、無確認で上書き・再初期化しない。

### journal の限定例外

- journal は追記専用の事実ログ。定義済みシームが成功した事実だけは、ユーザー確認なしで副作用として追記してよい。
- 無確認追記を許すシームは `save-deliverable`、`todo-add`、`todo-done`、`todo-carry`、`remember-decision`、`topic-add`、確認済みPJに対する定義済みproject操作、settings の設定変更に限定する。
- `journal-add` は末尾appendのみ、空本文拒否、既存行の書換・削除機能なし。会話全文・逐語ログ・未確認の推測は書かない。
- `decided` と `topics` は、シームを呼ぶ前に節目プロトコルの確認を受ける。journal自体の副作用で確認を省略してよいという意味ではない。

### 決定の純追加

- 過去の decision 行を書き換えない。変更・撤回は新しい日付ファイルに、元の決定・日付・新しい決定・理由を追記する。
- 表示時は新しい決定を優先する。週次で矛盾を統合するときもユーザー確認を挟む。
- 確認済みPJ固有の決定はライト `PROJECT.md` またはフル `DECISIONS.md` を正本とする。決定本文を一般memoryにも複写せず、timeline用記録はプロジェクト名と参照先を含む短い記録に留める。

## 4. 既定値＋opt-in 上書き

1. 共有規律と既定の体験を第1部、個人設定による上書きを第2部として分ける。
2. `preferences.md` が無い・空・該当項目未設定なら既定値で動く。暗黙推測で設定を変えない。
3. 既定値は、丁寧で堅すぎない口調、専門用語「ふつう」、報告「みじかく（3行）」、決定確認「都度」。
4. 報告は**既定3行**。3つの意味を物理的にも別行または別項目で表示し、1行の平文へ連結しない。`preferences.md` で「くわしく」が明示された場合だけ、3行＋補足1つへ拡張できる。憲章テンプレの規約も同じ形にする。
5. 一般技術用語は常にそのまま使う。「ことば添え」のopt-inでも語彙を置換せず、馴染みの薄い語またはユーザーの役割から未知と思われる語に短い補足を足すだけにする。
6. パーソナライズされた文面の完全一致は回帰対象にしない。rubricは既定値を採点し、設定分岐は構造・適用・安全なフォールバックと模擬会話で確認する。
7. 自発的な `秘書のメモ` 追記、口調・呼び方・詳しさ等の変更は、適用前に1行確認する。

## 5. やさしさと規律

1. やさしさは、言葉遣い、報告、進行の見せ方、次の一手の先回り提案に適用する。
2. 6規律（スコープ・根拠・出力・記憶保護・自動コミット・報告）、封じ込め、Planner / Generator / Evaluator の分離、書込責務、評価閾値、回帰ゼロ許容は削らず、緩めない。
3. 一般技術用語はそのまま使う。過度な平易化、幼稚なメタファー、生の英語エラーの放置は禁止。
4. 先回り提案は報告3行目を標準とし、1つまで、根拠を一言、着手はユーザーが決める。提案が無ければ無理に作らない。
5. 口調や詳しさの違いを、C2・C5・C6のゼロ許容基準とトレードオフにしない。

## 6. データと実行の決定性

1. 日付を使う処理は `CC_SECRETARY_NOW` で時刻を注入でき、未指定時だけ現在時刻を使う。
2. 回帰では固定時刻を与え、ファイル名・日付境界・並び順を決定的に検証する。ロケール依存の曜日表示はしない。
3. `timeline` はLLMを介さず、同一入力から同一Markdownを返す。
4. reindex が200行を超える場合は、既存の終了コード契約 0/2/3 を壊さず、`exit 0` と stderr 警告で退避提案へつなぐ。

## 7. 配布構成

1. 配布物は改名後の `plugins/yasashii-secretary/` 配下に置き、manifest・marketplace・README・インストールコマンドの名前を一致させる。
2. 配布SKILLは同梱されない開発docsを参照しない。必要な規律は配布 `rules/` やテンプレに含める。
3. 同梱スクリプトの実行権限と案内する実行方法を一致させる。
4. 薄いルーターと段階ロードを維持し、部署制・自動case生成・patterns自動統合・hooksを追加しない。
5. `yasashii-secretary` から同梱ハーネス、agents、ハーネスベースラインを撤去し、section 12 は参照導線の健全性を検査する。

## 8. Chatwork設定wizard

1. wizardはloopbackだけで利用するローカル設定画面とし、外部公開サーバーや常設サービスにしない。
2. 画面へAPI Token入力欄を作らず、会話にもToken値を貼らせない。接続順は、(1) ChatworkでTokenを取得または組織管理者へ利用申請、(2) 現在のGitHub repoのSecret追加画面を開く、(3) GitHub画面の `Name` 欄へ `CHATWORK_API_TOKEN`、`Secret` 欄へ本人がChatwork公式画面で取得したAPI Tokenを入力、(4) 登録確認後にルーム一覧取得、とする。Token実値はGitHub画面だけへ入力する。
3. Chatwork公式のTokenページ、発行ヘルプ、組織契約のAPI利用申請ヘルプへ直接案内する。パーソナルプランを除き組織管理者への申請が必要であり、実際にAPIを利用するアカウントで申請する。承認前はルーム一覧取得へ進めない。Tokenページが利用できない状態では「組織管理者へAPI利用申請→承認後にこの設定画面へアクセスする」を示し、設定途中の選択を保持する。
4. Secret追加画面は `https://github.com/<owner>/<repo>/settings/secrets/actions/new` を現在のrepo情報から組み立て、CTAを「GitHub上の安全な保管場所を開く」とする。固定owner／repo pathを使わず、外部リンクは新しいタブで開き、行き先と目的が分かる日本語ラベルを付ける。
5. 変更は確認画面まで副作用を出さず、確定後だけルーム設定・自動取得の間隔・scheduleへ一貫して反映する。キャンセル時は0変更。
6. 「30分ごと」「1時間ごと」「3時間ごと（おすすめ・初期値）」「6時間ごと」「12時間ごと」「手動のみ」を選べる。scheduleは17分起点とし、選択値と実際の動作を一致させる。
7. 30日換算の概算実行回数1,440／720／240／120／60／0回を表示する。実行回数と処理時間を区別し、GitHub Freeの非公開リポジトリに含まれる月2,000分は2,000回ではなくGitHub Actionsの処理時間枠であることを明記する。2026年7月確認の参考情報であり、プランや1回の処理時間で実使用量が変わり、料金・枠は変更されうることと、GitHub公式billingページへのリンクを併記する。
8. ユーザー向け表示では `room` を原則「ルーム」、識別子が必要な箇所を「ルームID」、`頻度` を「自動取得の間隔」、`runs` を「実行回数」とする。`schedule` は「自動実行」、`workflow` は「自動取得処理（GitHub Actions）」、`private repo` は「非公開のGitHubリポジトリ」、`Repository Secret` は初出で「GitHub上の安全な保管場所（Repository Secret）」とする。内部コード、設定key、CLI、正式なAPI名は対象外。
9. GitHub Actionsの初出には「決めた間隔で自動取得を動かすGitHubの仕組み」と短く補足する。`同期` の初出は「最新メッセージの取り込み（同期）」とし、commit・pushは正式名称を保ったまま「取得結果をこのリポジトリへ自動保存します（Gitのcommit・push）」と目的を先に示す。
10. wizard本文は決定に必要な情報へ絞り、料金・実行時間などの補足は「料金と実行時間について」のdetailsまたは短いhelpへ置く。1 step 1 primary message、CTA最大2、既存デザイン言語を維持する。
11. ChatworkとGoogle Chatは同じwizard骨格、step構造、responsive・accessibility基準を使う。全画面で「Chatworkの設定」または「Google Chatの設定」を可視見出しとaccessible nameに明示し、取り違えを防ぐ。
12. primary CTAの背景色はChatwork `#F03747`、Google Chat `#11BB62` に固定し、前景は両方とも `#000000` とする。背景色を変えてコントラスト不足を隠さず、文字・アイコンとのcontrast ratio 4.5:1以上を満たす。青色primary CTAはこの2サービスのwizardに残さない。
13. UIは4px radius、8px spacing、400/500 weight、14px中心、headline最大40pxを守る。hoverは0.33秒のcolor／border変化だけで、scale／translateを使わない。
14. 768px未満は1 column・CTA縦積みとし、desktopは中央寄せの広い余白を持つ。keyboard操作、visible focus、可視ラベル、accessible name、エラー関連付け、十分なcontrast、200% zoomでの非欠落を必須にする。日本語化で折返しや横overflowを増やさない。

### 公式情報の確認基準（2026年7月）

- Chatwork API Token: `https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php`
- Chatwork公式発行ヘルプ: `https://help.chatwork.com/hc/ja/articles/115000172402-API%E3%83%88%E3%83%BC%E3%82%AF%E3%83%B3%E3%82%92%E7%99%BA%E8%A1%8C%E3%81%99%E3%82%8B`
- Chatwork組織契約の申請・承認ヘルプ: `https://help.chatwork.com/hc/ja/articles/115000169501-API%E3%81%AE%E5%88%A9%E7%94%A8%E7%94%B3%E8%AB%8B%E3%82%92%E6%89%BF%E8%AA%8D-%E5%8D%B4%E4%B8%8B%E3%81%99%E3%82%8B`
- Chatwork API Tokenの取扱い: `https://developer.chatwork.com/docs/endpoints`
- GitHub Actions billing: `https://docs.github.com/en/billing/concepts/product-billing/github-actions`

公開ガイドには「公式情報は2026年7月確認。サービス側の変更により手順・料金・利用枠が変わる可能性がある」と明記する。

## 9. プロジェクト管理

1. プロジェクト候補の検出と作成を分ける。候補を検出しても、ユーザーが了承する前にディレクトリ、ファイル、journal、commit、remoteを変更しない。
2. 候補提案は、少なくとも2つの候補シグナルがあり、そのうち1つが複数行動または複数セッションである場合に限る。単発成果物、同じ会話で完了する作業、一つだけのTODOを形式的にプロジェクト化しない。
3. 一般PJの正本は `secretary/projects/<project>/` 内に置く。path guard、symlink拒否、空上書き禁止、削除2段階、資格情報禁止を既存の記憶・成果物と同じ強さで適用する。
4. ライト運用は `PROJECT.md` 1枚から開始し、空テンプレだけを生成しない。既存情報があれば、ユーザーが指定した最小範囲の根拠から概要・現状・要確認事項を起こす。
5. フル昇格は、Decisions 10件超、メモ10件超または状態以外で読みにくい、PJ固有ガードレールが必要、PJ直下10ファイル超のいずれかと、ユーザー承認の両方を必要とする。トリガー到達だけで自動昇格しない。
6. フル運用の役割は `AGENTS.md`=指示、`PROJECT.md`=状態、`DECISIONS.md`=判断、`MEMORY.md`=事実とし、`CLAUDE.md` は `AGENTS.md` へのポインタだけにする。別の `INDEX.md` を作らず、索引は `AGENTS.md` に内包する。
7. PJ固有の決定はユーザー確認後だけ記録し、同じ操作で `PROJECT.md` の現在状況と日付を更新する。未確定の判断はDecisionsへ入れず、要確認事項に置く。
8. 実行タスクは `secretary/inbox/todo.md` または接続済みサービスを正本とし、PJ内に生きた `TODO.md` を作らない。プロジェクト文書は状態・待ち・次の入口を示し、同じタスク本文を複数の正本へ置かない。
9. 一般PJの確定成果物は `outputs/`、旧版・backup・superseded文書は `archive/` に置く。フル運用でファイルを移動・追加・削除したときは、同じ操作で `AGENTS.md` の索引と関連リンクを更新する。最新版を判断できない場合は移動せず確認する。
10. 開発PJは既存の `build` と `yasashii-harness` 導線を維持する。別repo化は作成・接続・公開範囲を確認した後だけ行い、workspace側には `AGENTS.md` と概要スナップショットの `PROJECT.md` を参照ポインタとして置く。正本repoの仕様、判断ログ、進行状態、成果物を二重管理しない。
11. 一般PJを外部repoへ黙って分離せず、別repo開発PJの正本を `secretary/projects/` へ黙って複製しない。正本がどこかを各PJの `PROJECT.md` で一意に示す。
12. 一般PJの完了・再開はユーザー確認後だけ行う。完了は `status: completed`、再開は `status: active` とし、確認前・拒否・失敗ではPROJECT、journal、commitを変更しない。status欠落をcompletedと推定しない。
13. 完了時は完了日・結果・残件を `PROJECT.md` に残し、進行中一覧から外すが、検索・timeline・明示参照から除外せず、ディレクトリを自動移動・削除しない。再開時も過去の完了記録を削除・上書きしない。

## 10. 配布チャネルからの独立

1. 主対象はClaude Codeを使う非エンジニア一般とし、特定の講座・期・教材への参加経験、年齢層、そこでGit / GitHubを学んだことを利用前提にしない。
2. README、公開ガイド、配布物、project guidance、現行spec、現行Sprint契約を対象に、旧配布チャネル固有の名称、英字表記、期数、学習段階、教材導線、その参加者向けとする見出し・説明を残さない。
3. 過去の `docs/progress/`、`docs/feedback/`、対応する評価証跡、Git commitは監査記録として改変しない。これらは現在の製品説明の検査対象から除外し、新しく作るprogress／feedbackには旧配布チャネル固有表現を書かない。
4. 一般化は文章の意味を薄めず、一般の非エンジニアがREADMEと配布物だけで導入・利用を始められる状態を保つ。
5. MIT表記、Shin-sibainu/cc-companyの単段クレジット、`forkedFrom`、配布識別子は削除・変更しない。元リポジトリからの独立実装化やGit履歴書換えも行わない。
6. 文言整理を理由に機能、既存の安全境界、Chatwork、プロジェクト管理、ハーネス参照導線、回帰assertを弱めない。
7. 正本の書き手を越境しない。Plannerはspec・Sprint契約とPlanner文書、Generatorは実装・公開文書・Generator文書、EvaluatorはEvaluator文書、オーケストレーターはstateをそれぞれ扱う。

## 11. 更新の安全境界

1. marketplaceとplugin manifestのversionは同一でなければならず、不一致の配布を機械検査で拒否する。利用者向けCHANGELOGの対象版も同じversionと整合させる。
2. 更新診断と更新実行を分ける。「最新版にして」の最初の応答では現在版、最新版、変更点、影響、必要操作、カスタマイズ衝突可能性を説明するだけとし、plugin、workspace、Git、設定へ副作用を出さない。
3. 読み取り専用診断ではplugin更新、workspace書込み、migration、commit、push、reload／restartの実行、設定変更を0件とする。自動更新は案内だけとし、利用者の設定を変更しない。
4. 実更新はF30の説明後にユーザーが明示了承した場合だけ行う。了承前、拒否、キャンセル、説明不能、影響判定不能では変更しない。
5. 更新直前の保護はpushを伴わないローカルcommitとする。commitの対象と結果を示し、secretや資格情報らしきファイルを含めない。commitを安全に作れない場合は更新を止める。
6. 管理対象ファイルが配布時の基準hashから変わっている場合は、ファイルごとに選択を求め、既定を「現状を残す」とする。無応答を上書き同意とみなさず、一括置換を既定にしない。
7. 最小台帳が保持できるのは管理対象path、配布版、配布時の基準hash、明示的に許可した非機密のテンプレート変数だけ。私的内容になり得る変数値は保存せず、ファイル本文、差分本文、記憶、会話、外部データ、Chatwork／Google Chat本文、API Token、OAuth token、password、secret、資格情報も保存しない。
8. migrationは対象versionと予定変更をdry-runで示し、明示確認後だけ実行する。同じversionのmigrationを複数回実行しても追加変更が出ない冪等性を必須とし、実行済み状態を安全に判定する。
9. 台帳無し0.2.0は正常な既存利用者として扱う。現状ファイルを未変更とも全変更とも決めつけず、上書きしない側へ倒したbootstrap判定を行う。
10. 更新後はversion、管理対象ファイル、主要導線を検証し、失敗を成功と報告しない。失敗時は更新直前commitを基準にrollbackできる手順と影響を示す。
11. 更新に伴うpushは自動で行わない。private workspace、記憶保護、一般PJ／別repo開発PJ、Chatwork／Google Chatのsecret・同期同意、配布チャネル非依存の境界を変更理由で緩めない。
12. Google Chat、OAuth、Google Chat同期、Google Chat設定画面はF30/F31の対象外とし、更新導線へ混在させない。

## 12. Google Chat OAuth・同期境界

1. 各利用組織が所有するGoogle Cloudプロジェクトを使い、同じGoogle Workspace組織の利用者だけを対象にOAuth Audienceを `Internal` とする。ShigApps共通の `External` OAuth app、サービスアカウント、Domain-Wide Delegationへ自動的に切り替えない。
2. OAuth Clientは `Desktop app` とし、利用者本人によるユーザーOAuth、PKCE、state検証、loopbackのローカル受付を使う。外部公開callback serverや常設Webアプリを作らない。認可コードは受領直後にtokenへ交換し、記録しない。
3. 必須scopeは `https://www.googleapis.com/auth/chat.spaces.readonly`、`https://www.googleapis.com/auth/chat.messages.readonly`、発言者表示名補完用の `https://www.googleapis.com/auth/contacts.readonly` の3つだけ。未使用のChat scope、write scope、管理者scopeを要求しない。People APIで一部の同僚表示名を取得できない可能性をREADMEで説明し、取得不能時は安定した代替表示にして、追加scopeへ黙って拡張しない。
4. 厳格secretはclient secret、認可コード、access token、refresh token、OAuth client JSON全文であり、tracked file、設定、Git差分・履歴、ログ、会話、journal、fixture、スクリーンショット、評価証跡、再読込後も残るDOMへ表示・保存しない。client IDは識別子として、一時的なOAuth認可リクエストURLと管理者向けチェックリストには表示できるが、同じ永続物へ保存しない。
5. 一時的なOAuth認可リクエストURLとloopback callback URLは漏えいゼロ検査の対象外だが、URL自体をログ、スクリーンショット、評価証跡へ記録しない。callbackの認可コードは即時交換し、エラー表示にも含めない。
6. `GOOGLE_OAUTH_CLIENT_ID`、`GOOGLE_OAUTH_CLIENT_SECRET`、`GOOGLE_OAUTH_REFRESH_TOKEN_GCHAT` の値はRepository Secretを継続取得の正本とする。OAuth client JSONはローカル設定中だけ読み、通常導線では厳格secretを表示・コピーさせずRepository Secretへ直接登録する。登録できない場合は値を会話へ貼らせず、安全に停止して管理者向けの不足事項を示す。
7. 初回取得はOAuth完了直後の同じwizardセッションで、メモリ上のtokenだけを使ってローカル実行する。tokenはセッション終了時に破棄し、以後の取得はGitHub Actionsが担う。初回取得結果の保存とGitのcommit・pushは、実行前の確認画面で明示同意を得た場合だけ行う。
8. 同期対象は利用者が選択した `spaceType=SPACE` だけ。`DIRECT_MESSAGE`、`GROUP_CHAT`、未選択スペース、全スペース自動選択を禁止する。候補表示時だけでなく初回・継続取得の実行時にもspace typeを再確認し、不正な設定値では取得しない。
9. Google Chatは読取専用。メッセージ、reaction、space、membershipの作成・更新・削除を行わない。添付ファイルは名前、種類、参照先等のメタデータだけを保存し、本文をダウンロードしない。
10. 初回はAPIと組織の保持設定が返せる範囲を取得し、0件を正常として扱う。取得不能な過去履歴を「存在しない」と断定せず、保持設定、権限、未選択、検索条件の可能性を示す。
11. message resource name単位で冪等に統合し、再取得で重複・同日既存投稿の消失を起こさない。編集・削除の反映は、その取得実行でAPIが返した範囲に限る。`createTime` 差分の範囲外にある過去メッセージの編集・削除が反映されないことを正常仕様として説明し、削除済み本文を復元せず、API応答から消えたことだけを理由に保存済み履歴を削除しない。
12. scheduleによるcommit・pushは、選択スペース、間隔、保存内容、共同編集者への可視性を示した後の明示同意でだけ許可する。既定推奨・初期値はChatworkと同じ3時間ごとで、手動のみを選べる。
13. public配布repoにはGoogle ChatのSecret、workflow、スペース設定、同期状態、履歴を置かない。実APIは専用private test workspaceと非機密test spaceでだけ評価し、ユーザー許可前にCloud project作成、Secret設定、OAuth認可、workflow dispatch、API送信、pushを行わない。
14. OAuth後のキャンセルとlive gate後始末では、schedule停止、Google Chat用Secret削除、test space選択解除に加えて、Google側のOAuth grant／tokenをrevokeする。アプリ権限ページからの取消手順を示し、取得履歴やtest workspaceの削除は別の明示確認を必要とする。
15. Google Cloud準備はGoogle Chat skillの会話が担当する。local wizardとREADMEへCloud準備の説明画像を置かず、wizardは接続用JSON選択から始める。READMEはAIへ設定を依頼する入口と、AIを使わず進める場合の公式リンクを持つが、同じ長い手順をwizardへ重複させない。
16. Google ChatはGoogle WorkspaceのGoogle Chatだけを正式サポートする。OAuth Audienceは `Internal` に固定し、無料の個人Googleアカウント、`External`、Test users、公開審査へ分岐・fallbackしない。利用者向けREADME、skill会話、wizardに個人アカウント向け説明を出さない。
17. Cloud projectのProject表示名は、Git repo rootのディレクトリ名へ `-google-chat` を付けた値とする。Project IDの初期案も同じ値とし、Googleの命名制約または全体重複で使えない場合だけ調整する。調整後を含む表示名、Project ID、Google Workspace組織、API、Billing非接続を作成前に示し、明示確認を得る。Git repo rootを確認できない場合はprojectを作らない。
18. `gcloud`はGoogle公式の管理ツールで、インストール自体に料金は発生しないと案内できる。ただしCloud設定を変更できるため、インストール内容と実行予定を先に示し、利用者の明示承認後だけ導入・変更を行う。Billing Accountを自動接続せず、有料サービスを勝手に有効化しない。`gcloud`を導入できない、利用者が断る、権限がない場合は直接リンクの手動支援へ切り替え、行き止まりにしない。
19. CLIでproject作成とGoogle Chat API／People API有効化を行う前に、ログイン中のアカウント、利用可能な組織、対象project、権限を確認する。未ログイン、複数組織、権限不足、Project ID衝突、CLI途中失敗を推測で越えず、完了済み工程と未完了工程を分けて表示する。同じ操作を無条件に繰り返さない。
20. Google画面で必要な `Internal` Audience、`Desktop app`、接続用JSON取得は、Project IDを指定した公式の直接リンク、押す場所、完了条件を一画面一操作で案内し、利用者の「できました」を受けて次へ進む。Browser Use、Chrome拡張機能、特定ブラウザを必須にしない。手動工程が中断しても、厳格secretを保存せず、repo、Project案、組織、完了工程、次の工程だけで再開できる。

### Google公式情報の確認基準（2026年7月）

- Google Cloud CLI install: `https://cloud.google.com/sdk/docs/install`
- `gcloud projects create`: `https://cloud.google.com/sdk/gcloud/reference/projects/create`
- `gcloud services enable`: `https://cloud.google.com/sdk/gcloud/reference/services/enable`
- Google Cloud project management: `https://docs.cloud.google.com/resource-manager/docs/creating-managing-projects`
- Google Chat authentication: `https://developers.google.com/workspace/chat/authenticate-authorize`
- User OAuth setup: `https://developers.google.com/workspace/chat/authenticate-authorize-chat-user`
- OAuth consent and scope categories: `https://developers.google.com/workspace/guides/configure-oauth-consent`
- Restricted scope verification and internal-use exception: `https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification`
- Desktop app loopback OAuth: `https://developers.google.com/identity/protocols/oauth2/native-app`
- Spaces list and space types: `https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces/list`
- Messages list: `https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces.messages/list`
- Attachment metadata: `https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces.messages.attachments`

公開ガイドには「公式情報は2026年7月確認。Google側の画面・scope分類・管理者設定は変更される可能性がある」と明記する。

## 13. チャット設定wizardの文章境界

1. Chatwork／Google Chatの主導線は、画面冒頭に「今すること」を1文で示す。1画面で求める判断は1つ、1段落の要点は1つとし、複数の準備・判断・安全同意を一段落へ詰め込まない。
2. 主説明には、その場の判断に不要な内部用語を並べない。`wizard`、`workflow`、`commit`、`push`、`Repository Secret`、`loopback`、`runtime`、`scope`、`token`、`OAuth client JSON`、Sprint番号は、コード・設定key・正式名称が必要な箇所を除きprimary pathの見出し・本文・CTAから外す。
3. API、OAuth、Google Cloud、GitHub Actions等の正式名称は完全に削除しない。利用者が判断に必要なときは初出で短い役割説明を添え、それ以外は閉じた「詳しい説明」または「管理者向け」へ移す。詳細を開かなくても主導線を完了できなければならない。開閉部は山形アイコン等で開くことが見た目から分かり、開閉状態、keyboard操作、visible focus、accessible nameを備える。
4. 安全同意は簡略化を理由に削らない。読む対象、保存先が非公開のGitHubリポジトリであること、共同編集者にも本文が見えること、自動取得・自動保存の有無、選択解除や手動のみでも取得済み履歴を削除しないことを、確認画面で意味ごとに短く分けて示す。
5. CTAは次に起きることが分かる短い動詞句にする。「次へ」「実行」「Submit」のように結果が分からない語だけにせず、「接続を確認する」「保存内容を確認する」「この設定で始める」のように対象または結果を含める。1画面のCTAは既存どおり最大2つとする。
6. 失敗表示は「何が起きたか」→「次にすること」の順で、primary pathでは最大2段落にする。生の英語エラー、エラーコード、内部状態は主説明より後ろへ置く。完了表示は「確認できた結果」と「次の一手」だけを主表示にする。
7. 不自然な直訳、英語と日本語の不用意な混在、主語不足、同じ意味の二重表現を残さない。サービス名、正式なAPI名、設定値等の検索に必要な語を残す場合も、文章全体は自然な日本語にする。
8. 簡潔化しても、Chatwork `#F03747`、Google Chat `#11BB62` のprimary CTA、前景 `#000000`、3時間推奨・初期値、Google Chatのread-only、`SPACE`限定、DM／グループDM除外、private workspace、明示同意、secret非露出の境界を変更しない。
9. 「選択0件」と「手動のみ」は、今後の自動取得が止まることと、取得済み履歴を削除しないことを自然な日本語で分けて示す。機能上の停止・履歴保持・0件処理の不具合修正は、文章整理と混ぜず対象Sprintへ戻す。
10. 全画面の見出し、本文、help、details、label、CTA、empty／loading／error／success copyをinventory化し、画面・状態・対象サービス・主導線／技術詳細・必須意味要素を追跡できるようにする。未棚卸しの可視文言を残したまま合格にしない。
11. Google Chatの初回設定はChatworkと同じ一体型フローにする。スペース選択→間隔選択→保存内容・共同編集者可視性・自動取得・commit／pushの明示同意→`この設定で始める`→初回取り込みと自動取得設定→`設定を終了する` の順とし、確定後に別の自動取得CTA、スペース／間隔の再選択、追加の設定変更フローを出さない。手動のみでも初回取り込みは行い、scheduleは作らない。
12. 初回取り込みとschedule設定の結果が分かれ得る場合は、完了した処理と未完了の処理、次にすることを別々に表示し、全体を成功と誤認させない。既存の確認前0変更、安全なtransaction／rollback、secret非露出の境界を緩めない。後日の通常の設定変更導線は維持する。
13. Cloud準備の会話とlocal wizardを分ける。skill会話はJSON取得までを担当し、JSON取得を確認してからwizardを起動する。wizardはJSON選択→OAuth許可→通常スペース選択へ進み、Cloud project作成・API有効化・Audience・OAuth Client作成の画像や重複説明を表示しない。
14. OAuth許可はJSON確認後の明示ボタンで別タブに開く。元wizardの状態確認、ポップアップ拒否、タブ閉鎖、同意拒否、再試行、許可後の自動SPACE選択というSprint 019の合格動作を維持する。OAuth画面をJSON選択だけで勝手に開かない。

## 14. 公開済み0.7.0と次候補0.8.0の配布安全境界

1. 2026-07-18の公開判断では公開版を `0.7.0` とし、marketplace、plugin manifest、CHANGELOG、更新診断、最小台帳、migration、公開ガイドの版を一致させた。これは公開済みreleaseの歴史的な不変条件であり、`0.6.0`のまま監査対応を大幅追加して配布しない。
2. 初回publish、チャット設定、記憶commit、更新等のGit操作は、その操作が所有するpathだけをstage・commitする。操作開始前からstage済みの変更、別サービス、一般PJ、repo rootの無関係ファイルをcommitへ混ぜず、既存indexを勝手にunstage・上書き・削除しない。
3. 初回publishのように複数領域を初期化する場合も、commit候補のinventoryを明示的に確定してから全候補をsecret検査する。製品が生成・管理するworkflow／config／historyと初回publish inventoryでは、Google OAuth client JSON、client secret、認可コード、access／refresh token、Chatwork API Token、private key／秘密鍵、credential URL、known token field、通常のliteral assignment等の合理的な誤混入が1件でもあればcommit・push前に停止する。検査後に候補が変われば再検査する。
4. OAuth／Chatwork資格情報の正本は、現在のprivate repoのRepository Secretとする。サービスごとの登録境界を混同しない。
   - Google Chatの厳格secretはlocal wizard sessionのmemory内だけで受け渡し、`gh` のstdin経由でRepository Secretへ直接登録する。登録失敗時も値をコピー／貼り付けさせず安全に停止する。
   - Chatwork API Tokenはwizardが自動取得・受領・登録しない。F24の既存導線どおり、利用者本人がChatwork公式画面で取得し、GitHubのRepository Secret画面へ `CHATWORK_API_TOKEN` として直接入力する。Tokenをwizard、AI会話、repo本文、ログ、journal、fixture出力、スクリーンショット、評価証跡、製品側DOMへ入力・貼り付けさせない。
   - 両サービスとも、通常フローのrepo本文、Git差分・履歴、ログ、journal、fixture出力、スクリーンショット、評価証跡、再読込後も残る製品側DOM、会話に実値を出さない。
   - commit前scannerはこの通常フローを代替する安全境界ではなく、合理的な誤混入を止めるdefense-in-depthである。万能secret detectorまたは任意言語の完全parserと表示しない。
   - `${{ secrets.NAME }}`、定義済みの環境変数参照等の製品が生成する正規のruntime参照は許可する。通常文書と合理的な非機密metadataを、文字列がtoken風であるという理由だけで拒否しない。
   - 利用者がローカル／private repoの任意のJS／TS／shell／JSONを意図的に特殊構文・難読化・computed／escaped key・偽placeholderへ改変してscannerを回避するケースの完全検出は非ゴールとする。この非ゴールは、製品管理対象と通常フローの非露出保証を緩めない。
5. 書込み・作成・移動の許可境界は、現在ユーザーが確認して開いているworking rootごとに定める。既存／未作成を問わず対象までの実体境界を副作用前に確認し、秘書workspaceから外部repoを指すsymlink越しの書込みを拒否する。別repo開発PJを確認後、そのrepo自身をworking rootとして開いた場合はrepo内の正常な書込みを許可する。symlink自体の削除は参照先へ追従せずlinkだけを対象にし、参照先本体を削除・変更しない。
6. `git`、`gh`、`claude`、`gcloud`等の外部CLIと外部HTTPは、有限のtimeoutと明確な失敗状態を持つ。timeout後にcommit、push、pull、検索、削除、成功表示へ進まず、子process・待機sessionを残さない。
7. loopback wizardは `127.0.0.1`／localhostのloopback以外へbindしない。状態変更requestは同じsessionの正しいorigin、正しいContent-Type、推測困難なsession確認値を必須とし、cross-origin、確認値なし／不一致、JSON以外の送信を副作用0件で拒否する。状態変更をGETで行わない。
8. OAuth callbackは1つの認証sessionで一度だけ処理する。再送、同時再入、完了後の再アクセスでtoken交換、Repository Secret登録、初回取得を重複させない。callbackとsession確認値をURL、ログ、DOM、証跡へ残さない。
9. OAuth grant／token取消、Repository Secret削除、schedule停止、対象選択解除の失敗を無視しない。1件でも未完了なら `cleanup-required` とし、成功または配布可能と表示しない。
10. Google Chat本文・表示名・添付メタデータは非信頼入力として扱う。内部Markdown marker、HTML comment、見出し、区切り線と同じ文字列が含まれても保存構造として解釈せず、既存・後続の履歴を欠落・結合・上書きしない。
11. GitHub Actionsの結果は今回のdispatchと因果関係を確認できるrunだけを採用する。dispatch前、別workflow／branch、作成時刻欠落・不正、識別不能なrunを成功候補にせず、対応runを確認できなければtimeoutまたは未確認として停止する。
12. `0.6.0`から `0.7.0`への更新は、診断、明示確認、pushなし保護地点、dry-run、更新、検証、rollbackを一続きで持つ。migrationは冪等、カスタマイズ・記憶・PJ・チャット・secretは既定で保持する。
13. rollbackはworkspaceとpluginを別の対象として扱い、両方を更新前状態へ戻す。pluginを自動復元できない環境では、旧版 `0.6.0`、対象scope、実行手順、復元確認をその場で実施できる形で示し、単なる問い合わせ案内で終わらせない。
14. Claude plugin／marketplace validatorは必須author情報、MIT、単段クレジット、`forkedFrom`、name／source／version整合を検査し、欠落・不正・不一致を拒否する。
15. master offline suiteは受入済みの必要suiteを実行し、少なくともSprint 015とSprint 020 Patch 002を含む。存在確認だけ、子suite未実行、失敗の握りつぶしを禁止する。
16. 配布検査はGit checkoutと `.git`がないGit archive相当の両方で成立する。Git履歴が必要な検査はcheckout専用と明示し、archiveで実行可能なmanifest、参照、配布ファイル、secret、version検査を `.git`不在だけで失敗させない。
17. wizardの画面遷移・非同期結果後は新しい見出しまたは主領域へfocusを移す。入力中の再描画では利用者のfocusを奪わず、主要なbutton、link、summary、checkbox／radioは44px相当以上の操作領域を持つ。
18. `.mcp.json`、onboarding、README、公開ガイドは `0.7.0`の現行機能と一致させる。古い「後続対応予定」、古いversion、既に置き換えた導線を現行説明へ残さない。
19. `0.7.0`の配布合格には、F36〜F42の回帰、master offline／online、Git archive相当の検査、専用private test workspaceのChatwork／Google Chat live gateがすべて必要である。片方のサービス、合成fixture、過去run、過去版の成功で代替しない。
20. live gate完了後は両チャットschedule、全Repository Secret、room／space選択、Google OAuth grant／tokenが残っていないことを確認する。後始末未完了は不合格。履歴またはtest workspaceの削除は別の明示確認を必要とする。
21. 1〜20は公開済み `0.7.0` で確定した不変条件として維持する。公開済み `0.7.0` のmanifest、migration、fixture、評価記録、Git履歴を `0.8.0` 前提へ書き換えず、同一versionのまま配布物を差し替えない。
22. まだ利用者へ明示配布していない2 editionの最初のrelease candidate／latestは `0.8.0` とし、marketplace、plugin manifest、正本CHANGELOG、edition設定、README／公開ガイドの候補versionを一致させる。
23. 旧 `plugins/yasashii-secretary/CHANGELOG.md` はredirectではないraw CHANGELOG互換fileとして残し、新しい正本とbyte-for-byteで一致させる。過去entryを書き換えず、未検証の旧0.7.0 live update成功を説明しない。
24. 更新可能とするのは候補versionが導入済みversionよりsemver上で新しい場合だけとする。同一versionとdowngradeはplugin、workspace、Git、設定、ledger、migrationへ副作用0件で停止する。same-version bootstrap bridge、別配布物による橋渡し、公開済み `0.7.0` のin-place差替えを作らない。
25. 0.8.0は新規または未導入状態から導入でき、正本plugin path、neutral marker、edition付きledger、主要skillを整合させる。旧0.7.0 updaterのscanner停止は既知blockerとして保持し、対応済み・live互換PASS・配布保証のいずれにも数えない。
26. 旧0.7.0利用者向けexternal recovery／bootstrapは作らない。旧scannerで止まる標準生成fileのfixture削除、既知pathの広い除外、secret scan弱体化、公開済みartifactの改変で合格を作らない。
27. `0.8.0` release candidateのidentityは配布対象bytesで固定する。checkout専用のGit履歴・監査evidence検査と、`.git`／監査evidenceを含まないarchive配布検査は役割を分ける。checkout専用入力をarchiveへ混ぜず、どちらか一方の合格で全体を代替しない。
28. 旧 `0.6.0 → 0.7.0` と調査済み `0.7.0 → 0.8.0` のmigration、fixture、受入記録は歴史的回帰として期待値を変更せず保持する。未実施live gateを合格として追加しない。

## 15. 2 edition境界

1. `agentic-secretary` は `/Users/taisei/workspace/agentic-secretary` の別directoryかつ `mtaiseeei/agentic-secretary` の別GitHub repoとする。`yasashii-secretary` 内のmonorepo／subdirectoryにしない。
2. `agentic-secretary` は上流、`yasashii-secretary` は下流とし、下流の `upstream` remoteはfetch専用・push無効とする。両者はneutralization commitまでのGit履歴と共通祖先を持つ。
3. 別directory／repo作成、remote追加・変更、push、公開、release、実plugin install／updateは、該当Sprintのexternal gateで操作ごとのユーザー明示許可を再確認する。
4. 内部plugin pathは両editionで `plugins/secretary/`。外部plugin ID、marketplace名、repository／homepageはedition別とする。
5. workspace `secretary/`、skill／command名、migration filename、OAuth scope、Chatwork／Google Chat wizardとそのcopy、安全・証拠ruleは共通とする。
6. edition差分は会話、診断、報告、developer handoffに限定する。やさしさoverlayから安全rule、証拠要件、wizard動作を上書きしない。
7. 新規workspaceはneutral markerとedition値を使う。legacy yasashii markerを認識し、反対edition、混在、判定不能は副作用0件で停止する。別editionのledger／marker／履歴を移動・統合・削除・上書きしない。
8. 旧 `plugins/yasashii-secretary/CHANGELOG.md` はraw CHANGELOGの長期互換fileとして、新しい正本とbyte-for-byte一致させる。不一致、過去entry改変、equal／downgradeの副作用、same-version bridge、旧blockerを解消済みとする誤表示は公開不合格とする。
9. 新規生成bot名の第一候補は `secretary[bot]`。既存workspaceのbot名やworkflowは強制改名しない。
10. LICENSEとShin-sibainu/cc-company単段クレジットを両editionで保持する。`forkedFrom` は公式validatorまたはlive gateの証拠なしに推測変更しない。
11. yasashii overlayは共通plugin、共通安全回帰、必要な互換／release checkだけを対象とする。spec、Sprint、progress、feedback、evidenceは各repoが所有し、同期しない。

## 16. ホスト対応・検証表示と実会話回帰の安全境界

1. 正式な必須対象環境は Claude Code Desktop App、Claude Code CLI、Codex App、Codex CLI の4つとする（正本: `editions.md`）。その他のコーディングエージェントは設計対象だが、公式受入対象・配布保証・実環境検証必須対象ではない。
2. 共通本体（安全性、会話ルール、wizard、OAuth scope、同期境界、fixture・validator等）はホスト非依存の1実装とし、ホストごとに複製・二重実装しない。ホスト固有はmanifest・導入・更新・plugin root・command・実会話runner等のadapterに限る。
3. 対応対象ホストと検証済みホストは常に別集計する。1ホストのPASSを他ホストのPASSへ昇格・流用せず、未検証環境を「対応済み」と表示しない。未実行ホストは `unverified` と明示する。
4. 実会話テストの証跡には、host名、runner名、実行面（CLI／App等）を必ず記録する。Claude Code上の結果は「Claude Code実行面の証拠」に限定して表現する。
5. 共通会話validator・共通fixtureは特定ホストの応答形式・専用commandを前提にしない。共通rulesへホスト固有commandを新規追加しない。ホスト固有の起動方法はrunnerの責務とする。
6. 実会話runnerの子プロセスenvはallowlist方式とし、`process.env` 全体を複製せず、認証情報・APIキー・token・secret類を渡さない。子セッションへは各scenarioに必要な最小ツールだけを許可し、原則Bashを許可しない。
7. 実会話runnerの読み取り拒否・境界テストは一時workspace内の管理対象fixtureだけで行い、`/System` やuser home等のworkspace外パスを対象にしない。封じ込めはcwd・TMPDIRの誘導や許可ツールの絞り込みだけでは成立せず、合成HOME（実HOME非透過）、plugin本体のread-only参照、OS sandboxまたはホスト保証のpath-scoped permissionによる書込み先限定を必須とし、制御されたworkspace外canaryへの書き込みが実際に拒否されることを実証する。canary拒否を実証できない構成ではWrite/Editを使うscenarioを自動実行しない。無限定の「workspace外変更0件」という主張はせず、検査対象を列挙した範囲限定の表現だけを用いる。
8. 実会話runnerは成功・失敗を問わず一時workspaceをcleanupし、証跡は秘密情報を含まないサニタイズ済み構造化結果だけとする。安全な環境を用意できない項目は `unverified` と記録し、安全条件を弱めてPASSにしない。
9. 会話回帰の合否判定は共通契約を正本とする。完了・状態報告は固定3項目の存在と順序を必須にし、固定schemaなしの応答を行数だけで合格にしない。一般回答には固定3項目を要求せず、圧縮された改行なし平文を不合格にする。誤合格を作る緩和は禁止し、必要な緩和は理由つきで明示する。
10. 公式仕様の裏づけがないホスト機構を推測実装しない。公式ドキュメント・正式schemaで確認できない事項は `unverified` として記録する。
11. 実会話出力の回帰確認は、offline回帰・構文チェック・master gateから分離した明示的なlive conversation gateとして扱い、未実行・未認証・隔離未実証は「未完了（incomplete）」として集計・表示する。offline検証の合格・runnerの構文チェックを実会話の回帰保証として数えない。「解消済み」「回帰保証」という主張は実際に実行された検証に限定する。過去のfeedback・progress・stateの記述は遡って書き換えず、訂正は新しい記録で行う。

## 17. 全ユーザー会話の可読性

1. 両editionの会話、診断、確認、進行、成功、部分失敗、エラー、検索結果、更新、プロジェクト、接続案内、developer handoffは、複数要素を改行なしの平文へ連結しない。
2. 1要点だけの短い内容は1段落でよい。複数の手順、選択肢、変更点、結果、原因、影響、次の行動は、空行で分けた段落またはMarkdown箇条書きで構造化する。
3. 1文ごとのbullet、不要な見出し、同じ内容の重複、装飾目的のMarkdownは避ける。可読性のための改行を、冗長化や情報追加の理由にしない。
4. 改行の有無をユーザーへ質問せず、preferencesへ設定項目を追加しない。口調、専門用語、報告詳しさを変更しても、この最低基準は無効にできない。
5. 「改行しない」「1行にまとめる」「平文で返す」「箇条書きを使わない」等のユーザー向け指示を配布rules、skills、templates、commands、edition copy、handoffに残さない。内部record、commit message、index、machine-readable出力の1行契約は対象外として区別する。
6. agenticは結論・正式名称・証拠を早めに、yasashiiは何が起きたか・影響・次にすることを先に示す。可読性の共通化を理由に、思想・対象・4つのedition差分を同一化しない。

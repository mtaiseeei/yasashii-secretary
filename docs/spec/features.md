# Features

機能IDと、ユーザーから見える振る舞いの正本。F01〜F16 は受け入れ済みの既存機能、F17〜F22 は 2026-07-15 方針転換、F23〜F27 は 2026-07-16 のsingle-repo Git-first + Chatwork方針、F28 は 2026-07-17 の一般プロジェクト管理方針で追加・再定義した機能。

## 既存機能（F01〜F16）

| ID | 機能 | 外から見える結果 |
|---|---|---|
| F01 | マーケットプレイス配布 | `yasashii-secretary` を public / MIT で配布し、Shin-sibainu/cc-company の単段クレジットを維持する |
| F02 | 3コマンド導入 | marketplace add → install → `/secretary` で導入できる |
| F03 | 薄いルーター | 自然な言い回しを必要なスキルへ段階ロードし、全機能を一度に読まない |
| F04 | オンボーディング | 5問以内で `secretary/` を安全に生成し、1つのprivate GitHub repoの作成、初期commit、初回pushまで完了する |
| F05 | 記憶ケア | 空上書き禁止、削除2段階、索引追従、`_resume.md` による再開を提供する |
| F06 | daily | 外部予定・タスクとローカルTODOを根拠つきで突き合わせる |
| F07 | Git履歴 | 節目で何をしたか分かる日本語メッセージをcommitし、秘書・一般プロジェクト・Chatworkを同じworkspace repoの履歴として扱う。別repo開発PJの履歴はその正本repoに残す。初回pushと同意済みChatwork schedule以外の予期しないpushは確認する |
| F08 | 成果物規約 | 単発成果物は `docs/YYYY/MM/YYYY-MM-DD_<title>.md`、確認済み一般PJの成果物は当該PJ内にfrontmatterつきで保存し、確定版を `outputs/`、旧版を `archive/` へ分ける |
| F09 | Google 接続 | Gmail / Calendar / Drive の公式コネクタ接続と診断を案内する |
| F10 | 文言ルール | 一般技術用語を保ち、馴染みの薄い語だけ短く補足し、3行報告と進行表示を守る |
| F11 | Microsoft 接続 | Microsoft 365 公式コネクタの接続と確認を案内する |
| F12 | Notion 接続 | 任意で Notion の公式接続を案内する |
| F13 | 接続診断 | 実エラーを根拠に原因と対処を伝える |
| F14 | やさしいハーネス提供 | **再定義**: 同梱せず、別repo `yasashii-harness` を正本として提供する |
| F15 | build | `yasashii-harness` の有無を確認し、無ければ3コマンド案内、あれば開発ループへ接続する |
| F16 | 公開ドキュメント | README 前半で非エンジニアが導入でき、後半で技術者が設計とライセンスを確認できる |

## 新機能（F17〜F22）

### F17 journal — 活動記録

- `memory-tools.sh journal-add <sec> <did|decided|next|note> "<本文>"` で日次ログへ末尾追記できる。共通の追記境界は `scripts/lib/journal.sh` の `journal_append` とする。
- 成果物保存、TODO追加・完了・持ち越し、決定記録、topic追加、設定変更を行う定義済みシームは、成功した事実を journal へ自動追記する。
- 空本文を拒否し、既存行の書換・削除シームを提供しない。
- `_resume.md` は作業の中断点、journal の `next` は翌日への申し送りとして使い分ける。

### F18 timeline — 時系列表示と検索

- `memory-tools.sh timeline <sec> [--from/--to] [--type decisions|journal|all] [--grep <キーワード>]` で決定と活動を逆時系列の Markdown に整形する。
- 同一入力から同一出力を返し、LLMの要約に依存しない。
- 「先週なにしてた」「今日やったこと」「いつ決めた」「7月に決まったこと」を期間・種類・キーワードに対応づける。
- 出力を保存してと言われた場合は既存の成果物保存規約に従う。

### F19 節目プロトコル — 決定と相談文脈の記録

- 決定の合図を会話中に検出し、原文のまま1行確認して `remember-decision` へ渡す。既定は都度、設定により締めのまとめ確認へ切り替えられる。
- 会話の締めで、その日の `decided` が0件なら会話を読み返し、拾い漏れを確認する。
- 結論に至らない相談が一区切りしたら、要点を案件メモに残す旨を1行確認して `topic-add` へ渡す。
- topicは `memory/topics/` に保存し、会話全文や逐語ログは残さない。
- 確認済みプロジェクトに属する決定・相談文脈は、一般memoryへ同じ本文を二重保存せず、F28のプロジェクト正本へ送る。timeline用の活動記録はプロジェクト名と参照先を含む短い記録に留める。

### F20 settings — パーソナライズ

- 初回と途中変更を同じ `settings` で扱う。初回は既存項目に「仕事・役割」「説明の詳しさ」を加え5問以内、口調は聞かず標準で開始する。
- 「もっとフランクに」「専門用語そのままで」「呼び方を変えて」を受け、変更前に例文を見せて確認し、反映後に覚えた内容を宣言する。
- `memory-tools.sh pref-set` は指定した構造化項目だけを更新し、`memory-tools.sh pref-note-add` は秘書のメモへ追記する。全文の read-modify-write を要求しない。
- 自発的に秘書のメモへ追加するときも1行確認する。
- 役割は保存するだけでなく、提案・例示・用語補足の題材へ反映する。

### F21 週次ふりかえり

- 毎回、対象週の日次 journal 原本から振り返りを作り、要約の要約をしない。
- 決定・活動・翌週への申し送りを区別し、矛盾の統合や古い月の退避はユーザー確認後に行う。
- 外部データを使う場合は出典を行内に明記し、本文を複製しない。

### F22 yasashii-harness の上流追随

- 本機能の実装・正本は別repo `yasashii-harness` に置く。`yasashii-secretary` は参照導線だけを持つ。
- `mtaiseeei/yasashii-harness` はpublic・`fork=false`の独立downstreamで、`origin` を自身、`upstream` を `mtaiseeei/agentic-harness` に向け、fb9c303を初期基点とする。
- 配布識別子はmarketplace `yasashii-harness` とplugin `harness` を分け、`harness@yasashii-harness` で導入する。remote manifestのrepository / homepage / sourceと必要なCodex marketplace識別子をdownstreamへ揃える。
- 本文・スキル・agents・runtimeロジックの差分を「見出しに `yasashii` を含む追加セクションのみ」に限定し、上流由来の実装行を書換・削除しない。機械的例外は宣言済みの配布識別metadata fieldだけとする。
- `gentle-overlay/`、アンカー、`metadata-overrides.json`、`scripts/sync-harness.sh`、やさしい版 agents 3種、独自回帰により、上流merge後も差分と規律を検証できる。
- 上流HEADの前進は警告、取り込み済み上流＋overlayとの不一致、未分類の新規・削除ファイル、アンカー不在は失敗として扱う。
- fork badge／parent relation／同じforkからの上流PRは提供しない。上流変更は本機能のスコープ外であり、将来あらためて明示承認された場合だけ `agentic-harness` 側の別branch / PR手順に分離する。

## Chatwork・single-repo機能（F23〜F27）

### F23 single-repo Git-first workspace

- `yasashii-secretary` を使うrepoを、秘書の記憶・成果物、営業・マーケティング・新規事業等の一般プロジェクト、Chatwork履歴の共通ワークスペースにする。
- 開発プロジェクトは既存の `build` 導線を使い、必要に応じて別repoを正本にできる。別repo化する場合は作成・接続・公開範囲を確認し、workspace側には概要と参照ポインタだけを置く。
- public配布repo `yasashii-secretary` と利用者のprivate workspaceを分離する。Repository Secret、Chatwork workflow、room設定、履歴は利用者のprivate workspaceだけに置く。
- 新規オンボーディングはprivate GitHub repoの作成、初期commit、初回pushを完了条件とする。public repoは選べない。
- 既存remoteがあるrepoでは、別repoを黙って作らず、現在のrepoを使うかを確認する。Chatwork専用repoは作らない。
- privateであること、remoteが接続済みであること、初回pushが成功したことをユーザーが確認できる。
- 実API評価用の専用private test workspaceも、pluginの利用設定・生成物、秘書、通常project、Chatwork設定／workflow／履歴を1つのrepoに置き、Chatwork専用test repoを作らない。public配布ソース自体の複製は要求しない。

### F24 Chatwork接続・room選択wizard

- `/chatwork` から接続状態と次の行動を確認でき、未設定ならChatworkのAPI Token取得、GitHub上の安全な保管場所への登録、ルーム選択を順に進められる。
- API Token取得ではChatwork公式のTokenページと発行ヘルプへ直接進める。組織契約でTokenページを利用できない場合は、実際にAPIを使うアカウントで組織管理者へ利用申請し、承認後に同じ設定へ戻る導線を示す。承認前はルーム一覧取得へ進めない。
- Tokenはwizardや会話へ貼らせない。現在のGitHub repoのowner／nameから組み立てたSecret追加画面を「GitHub上の安全な保管場所を開く」と案内し、利用者自身が名前 `CHATWORK_API_TOKEN` で登録する。固定ownerや固定repo pathへ誘導しない。
- API Tokenの値はrepo本文、設定ファイル、ログ、journal、fixture、画面キャプチャへ保存しない。
- Secret登録を利用者が確認した後、GitHub Actionsが参加中のルーム一覧を取得して同じ非公開のGitHubリポジトリへ反映し、ローカル設定wizardはその一覧を読み、ルーム名を見ながら複数選択できる。Git管理するのはルーム一覧・選択結果・ルームIDであり、Tokenではない。
- wizardは選択ルーム、自動取得の間隔、保存内容、非公開のGitHubリポジトリの共同編集者にも履歴が見えることを確定前に示す。
- 0ルーム、認証エラー、rate limit、ネットワーク失敗を区別し、設定途中の選択を失わず再試行できる。

### F25 初回取得と基本検索

- 選択roomごとにChatwork APIが返す最新100件以内を初回取得し、同じrepoへ保存する。0件でも正常完了する。
- 導入以前の履歴は自動で遡れず、初回取得より古いメッセージが無いことを明示する。
- message IDを基準に重複を作らず、選択していないroomを取得しない。取得済み履歴をAPI応答から消えたことだけで削除しない。
- `/chatwork search` は最新のGit状態を取り込んでから、room、発言者、日付、キーワードで保存済み履歴を検索し、該当箇所とroom/dateの根拠を返す。

### F26 定期同期と設定変更

- 自動取得の間隔は「30分ごと」「1時間ごと（おすすめ）」「3時間ごと」「6時間ごと」「12時間ごと」「手動のみ」から選べる。実行は毎時0分を避け、17分を起点にする。
- wizardは30日換算の概算実行回数を順に1,440回、720回、240回、120回、60回、0回と表示する。実行回数とGitHub Actionsの処理時間は別であり、2,000分を2,000回と誤解させない。
- 2026年7月時点では、GitHub Freeの非公開リポジトリに月2,000分のGitHub Actions処理時間が含まれることを参考情報として示す。プラン・runner・1回あたりの処理時間で実使用量が変わり、料金や枠も変更されうるため、GitHub公式のbillingページへ案内する。
- 選択した間隔は表示値だけでなく、実際のscheduleへ反映される。手動のみではscheduleを無効にする。
- 選択roomのうち最も忙しいroomの最新100件が覆う時間幅を参考に、取りこぼしにくい間隔を提案してよい。最終決定はユーザーが行う。
- roomと間隔はwizardから見直せる。確定前は設定・workflow・履歴へ副作用を出さず、確定後に変更内容をcommitする。
- 設定変更後の結果は、変更後の選択room、頻度、schedule有効／無効を現在値として表示する。変更前の初回取得結果を再表示して、反映失敗と誤解させない。
- scheduleによる自動取得・commit・pushは、セットアップで内容を示して同意を得た後だけ有効になる。

### F27 見つからない時の確認付き手動同期

- `/chatwork search` は最初にrepoをpullして保存済み履歴を検索する。
- 見つからない場合、AskUserQuestionまたはCodexのstructured input等、hostの構造化質問で「同期して再検索（推奨）／同期しない／対象roomを見直す」を提示する。質問前に手動同期しない。
- 承認時だけ手動workflowを開始し、完了まで待ち、成功を確認し、pullして同じ条件で再検索する。
- 再検索でも見つからない場合は、導入前の履歴、最新100件制約、未選択room、キーワード不一致、編集・削除、workflow失敗を区別して示し、「Chatworkに存在しない」と断定しない。
- 手動同期のキャンセル、失敗、timeout時はrepo内容を壊さず、何が起きたかと次の選択肢を示す。

## プロジェクト管理（F28）

### F28 プロジェクト候補の確認とライト→フル運用

- 一つの成果に向けた複数行動、別の日・別セッションへの継続、締切・待ち・関係者、増えていく判断・成果物、繰り返し登場する同一案件を候補シグナルとする。少なくとも2つのシグナルがあり、そのうち1つが「複数行動」または「複数セッション」である場合にプロジェクト化を提案する。
- 単発成果物、同じ会話で完了する作業、一つだけのTODOは候補にしない。LLMによる候補検出であり完全自動保証ではないことを隠さない。
- 提案時は理由を1〜2点に絞り、「この内容は今後も続きそうです。プロジェクトとしてまとめますか？」と構造化質問で確認する。確認前・拒否・キャンセルではディレクトリ、ファイル、journal、commitを変更しない。
- 営業・マーケティング・新規事業等の非開発PJは `secretary/projects/<安全な名前>/` に作り、ライト運用は実情報を入れた `PROJECT.md` 1枚から始める。空テンプレだけを置かない。
- ライト `PROJECT.md` は、現在の状況（日付つき）、概要、ゴールと成功の測り方、1行のDecisions、記録日つきメモ、関連ドキュメントを持つ。未確定判断はDecisionsに入れず要確認事項に置く。
- Decisionsが10件超、メモが10件超または状態以外で読みにくい、PJ固有ガードレールが必要、PJ直下が10ファイル超のいずれかに達したら、その場でフル昇格を提案する。了承前は昇格しない。
- フル運用は `AGENTS.md`（指示・Start here・索引・ガードレール）、`PROJECT.md`（状態）、`DECISIONS.md`（判断）、`MEMORY.md`（恒久的な事実・知見）、`CLAUDE.md`（`AGENTS.md`へのポインタ）を持つ。決定追記時は同じ操作で `PROJECT.md` の現在状況と日付も更新する。
- PJ固有の決定はライトのDecisionsまたはフルの `DECISIONS.md`、恒久事実はライトのメモまたはフルの `MEMORY.md` を正本とする。同じ本文を `secretary/memory/decisions/`、`memory/topics/`、プロジェクト文書へ重複保存しない。
- 実行タスクの正本は既存の `secretary/inbox/todo.md` または接続済みサービスに置く。プロジェクト内に生きた `TODO.md` を作らず、`PROJECT.md` には現在状況、待ち、次の入口だけを置く。ローカルTODOにはプロジェクト名またはPROJECTへの参照を付けられる。
- 確定成果物は `outputs/`、作業中の文書は日付つきファイル、旧版・backup・superseded文書は `archive/` に分ける。フル運用でファイルを移動・追加・削除したら、同じ操作で `AGENTS.md` の索引と関連リンクを更新する。
- 開発PJはF15の `build` 導線を維持する。別repoを正本にすると確認された場合、workspace側は `AGENTS.md` と概要スナップショットの `PROJECT.md` だけを持ち、正本repoの場所、最初に読むファイル、現在状態の要約を示す。仕様、判断ログ、実装進捗をworkspace側へ複製しない。
- 既存情報があるPJを初期化するときは、ユーザーが指定した最小範囲の既存文書・接続済みサービスを根拠に概要と現在状態を起こす。資格情報、外部本文、会話全文は保存しない。
- 一般PJの `PROJECT.md` は `status: active | completed` を持つ。ユーザー確認後だけ `completed` にし、完了日・結果・残件を残して通常の進行中一覧や候補検出から外すが、ディレクトリは移動・削除せず検索・再参照できる状態を保つ。再開も確認後だけ `active` に戻し、過去の完了記録を残す。status欠落は誤って非表示にせず `active` として扱う。

## Gテーマと機能の対応

| テーマ | 主な機能 |
|---|---|
| G1 | F05 F06 F07 F08 F17 F18 F19 F21 |
| G2 | F04 F10 F20 |
| G3 | F14 F15 F22 |
| G4 | F10 F14 F15 F20 F22 |
| G5 | F04 F07 F23 F24 F25 F26 F27 |
| G6 | F03 F05 F06 F07 F08 F15 F17 F18 F19 F28 |

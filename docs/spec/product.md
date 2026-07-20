# Product

## これは何か

`yasashii-secretary` は、Claude Codeを使う非エンジニア一般向けのAI秘書プラグイン
（Claude Code plugin / public / MIT）。名前と README の両方で非エンジニア向けであることを明確にする。

中心思想は **「1つのprivate GitHub repoに、秘書・一般プロジェクト・選択したチャットの文脈をまとめる」**。
秘書の記憶と成果物、営業・マーケティング・新規事業等の一般プロジェクト、選択したChatwork roomとGoogle Chat通常スペースの履歴を
同じrepoでGit管理する。開発は既存の `build` と `yasashii-harness` 導線を維持し、案件に応じて
別repoを正本にできる。その場合、秘書workspace側には概要と正本repoへの参照ポインタだけを置く。
Chatworkと明示設定済みGoogle Chat以外の外部データは、従来どおり公式コネクタで都度参照する。

publicな `yasashii-secretary` repoは配布物の正本であり、利用者データの保存先ではない。
各利用者はpluginを使う秘書ワークスペース、一般プロジェクト、Chatwork／Google Chat設定・workflow・履歴を
1つのprivate GitHub repoに置く。実API評価用repoもこの実利用構成を再現する専用private test workspaceとし、
チャット専用repoへ分離しない。開発の正本repoは必要に応じてこのworkspaceから分けられるが、作成・接続・公開範囲を
ユーザーに確認し、workspace側に同じ仕様や判断ログを二重管理しない。

2026-07-15 の方針転換は `docs/proposal-2026-07-15-realignment.md` を基礎とする。
2026-07-16 に追加承認されたsingle-repo Git-first + Chatwork方針は本spec群が正本であり、
外部同期なし・ローカルだけ・Web UIなし・pushなしという旧条件を、single-repoワークスペースとChatworkの範囲で上書きする。

## 対象ユーザー

- **主対象**: Claude Codeを使う非エンジニア。Git / GitHubの習熟度や、特定の講座・教材を受けた経験を前提にしない。標準環境は Claude デスクトップアプリ／Claude Code。
- **副対象**: 村山さんを含む配布・保守者。一般利用者向けの導入と保守を、秘書本体と開発ハーネスを独立に扱いながら行う。

この主対象は `yasashii-secretary` editionの対象である。共通基盤から分かれる上流の
`agentic-secretary` は、エンジニアおよびAI活用に慣れた利用者を主対象にする。
一方を簡易版・下位版とは扱わず、両方を対象ユーザーに合わせて完成した製品として提供する。

## 製品テーマと優先順位

### G1【最優先】話すだけでコンテキストが整う

相談や作業を普段どおり進めるだけで、次の三層が役割を混ぜずに蓄積される。

1. 活動は、成果物保存・TODO・設定変更など定義済みシームの副作用として確実に溜まる。
2. 決定は、会話中の都度確認と会話の締めでの拾い漏れ確認という二段構えで回収する。LLMによる検出であり完全自動保証ではないことを隠さない。
3. 結論に至らない相談の文脈は、一区切りで1行確認して案件メモに残す。

G1 の最小達成状態は、`timeline` により「何がいつ決まり、その日に何をしたか」を決定的に一覧・検索できること。
dashboard は必須条件ではなく、sprint-012 で利用反応を踏まえて判断する。

### G2【次点】100人100通りの秘書

初回と途中変更の両方を `settings` が受ける。職業・役割、言葉遣い、説明の詳しさ、呼び方、
決定確認のタイミングを `preferences.md` v2 に保存し、提案・例示・用語補足に実際に反映する。
既定動作を安全な正本とし、ユーザーが明示した項目だけを opt-in で上書きする。

### G3 やさしいハーネスの分離と上流追随

やさしいハーネスの正本は、本体への同梱コピーではなく別リポジトリ `yasashii-harness` に置く。
`yasashii-secretary` はインストール案内と接続導線だけを持つ。
`mtaiseeei/yasashii-harness` は GitHub forkではない独立public downstream repoとして、fb9c303を初期基点にする。
書込先 `origin` は自身、読取専用の `upstream` は `mtaiseeei/agentic-harness` とし、上流追随とやさしさ差分の検証を反復可能にする。
配布時は marketplace名 `yasashii-harness` とplugin本体名 `harness` を組み合わせ、`harness@yasashii-harness` で一意に導入できるようにする。上流との差分は `yasashii` 見出し追加と、宣言的allowlistに載せた配布識別metadataだけに限定する。

### G4 やさしいハーネスの再定義

> やさしいハーネスの「やさしい」とは、ユーザーに見える言葉遣い・報告・次の一手の先回り提案がやさしいという意味である。やること自体はやさしくしない。6規律、根拠、記憶保護、封じ込め、Planner / Generator / Evaluator の分離、評価閾値、回帰ゼロ許容は削らず、緩めない。

### G5 1つのrepoでChatworkまで読める

初回オンボーディングはprivate GitHub repoの作成、初期commit、初回pushまで完了する。
このrepoが、プラグインを使う秘書ワークスペース、一般プロジェクト、秘書の記憶と成果物、
Chatwork履歴の作業単位になる。Chatwork専用repoや、Chatwork以外だけを別のローカル領域へ分けない。
開発PJは必要に応じて別repoを正本にでき、その場合はこのworkspaceに参照ポインタだけを置く。

Chatwork API TokenはGitHub Actions Repository Secretへ登録し、repo本文には保存しない。
ユーザーはローカル設定wizardで参加roomを確認・選択し、同期間隔を決める。
推奨・初期値は3時間ごととし、利用者は取得量に応じて別の間隔または手動のみを選べる。
APIが返せる最新100件より前の履歴は導入直後には存在せず、それを正常状態として説明する。
検索で見つからない場合は、承認を得てから手動同期し、成功を確認してpull後に再検索する。

実APIのlive gateはpublic配布repoでは実行しない。ユーザーが専用private test workspaceの作成、
Repository Secret設定、workflow dispatch、push、Chatwork API送信を明示許可し、test用tokenと
非機密test roomを準備した場合だけ実行する。準備が無ければlive gateは未達であり、合成fixtureの成功を
実API合格へ読み替えない。

### G6 継続する仕事をプロジェクトにする

一つの会話や一つの行動で終わらず、同じ成果に向けて複数の次の行動や別日の継続が生まれる仕事を、
秘書がプロジェクト候補として捉える。候補は自動作成せず、なぜ候補と考えたかを短く添えて
「プロジェクトとしてまとめますか？」と確認し、了承後だけ `secretary/projects/` に作る。

営業、マーケティング、新規事業、採用、研修、契約準備等の一般プロジェクトは、同じprivate workspace内を正本にする。
最初は `PROJECT.md` 1枚のライト運用とし、判断・事実・ファイル・固有ガードレールが増えたときにその場で提案し、
了承後だけ「指示・状態・判断・事実」のフル運用へ昇格する。

開発プロジェクトは既存の `build` 導線を変えない。別repoを正本にする場合、workspace側には
`AGENTS.md` と概要スナップショットの `PROJECT.md` を参照ポインタとして置き、実装仕様・判断・進行状態の正本を複製しない。

### G8 安心して更新を続けられる

配布開始後も、利用者が自分のカスタマイズや記憶を失う不安なく新しい版へ進めるようにする。
最初の体験は完全な読み取り専用とし、「最新版にして」と頼まれた時点では現在版、利用できる最新版、
誰に何が変わるか、設定・ファイルへの影響、必要な操作、カスタマイズと衝突する可能性だけを平易に説明する。

実更新は別の段階とし、説明を読んだ利用者が明示的に了承した後だけ行う。更新直前にはpushを伴わない
ローカルcommitを復元地点として作る。配布時の基準から変更された管理対象ファイルは、ファイルごとに
「現状を残す」を既定にし、利用者が選んだものだけ置き換える。移行はdry-runで予定を見せ、同じ処理を
複数回実行しても結果が変わらない冪等性を持たせ、更新後の検証とrollbackを一続きで扱う。

### G9 Google Chatを安全に蓄積する

Google Chatは、各利用組織が所有するGoogle Cloudプロジェクトと、利用者本人が同意するユーザーOAuthで接続する。
共通の外部向けOAuthアプリは使わず、OAuth Audienceは同じGoogle Workspace組織内に限る `Internal` を前提とする。
READMEでは通常機能と混同せず「Google Chatをつなぐ（少し高度な設定）」として扱う。
Google Cloudの準備はGoogle Chat skillとの会話が担当する。起動中のGit repo名を基にProject案を示し、Google公式CLIの
`gcloud` で可能なプロジェクト作成と必要APIの有効化を、変更内容の説明と明示確認の後だけ進める。
Google画面で本人操作が必要な `Internal` Audience、`Desktop app`、接続用JSON取得は、対象Projectを指定した直接リンクと
一画面一操作の案内を順に出し、利用者の「できました」を受けて次へ進む。`gcloud`を導入できない場合は同じ全工程を
直接リンクによる手動操作支援へ切り替える。Browser Useやブラウザ拡張機能は必須にしない。

接続用JSONを取得できた後だけlocal wizardを開く。wizardはJSON選択、明示ボタンから別タブで行うOAuth許可、
通常スペース選択以降に集中し、Cloudプロジェクト作成やAPI有効化の説明画像・手順を重複して持たない。

接続後は、利用者が名前を確認して選んだ `SPACE` 種別の通常スペースだけを同じprivate workspaceへ保存する。
1対1のDMとグループDMは初版では対象外にし、投稿・編集・削除も行わない。保存形式と取得の考え方は
`my-vault` の現行Google Chat同期を基準に、スペース別・日付別Markdown、スレッド、発言者、Asia/Tokyoの時刻、
初回の取得可能な全履歴、以後の差分取得を保つ。ただし、使っていない権限、古いサービスアカウント案内、
資格情報を端末へ表示する挙動は引き継がない。

自動取得の既定推奨は3時間ごとにする。利用者は手動のみ、1時間、3時間、6時間、12時間から選べ、
確定前に対象、保存内容、共同編集者への可視性、commit・pushを確認する。保存形式と取得境界は `my-vault` を基準にするが、
自動取得の推奨間隔とAsia/Tokyoの日付境界は本製品で意図的に改善する。
初回設定はChatworkと同じ一体型フローとし、スペースと間隔を選んで安全情報へ同意した1回の確定操作で、
初回取り込みと自動取得設定を完了する。手動のみでは初回取り込みだけを行い、scheduleは作らない。

### G10 配布前監査を閉じ、公開済み0.7.0の安全基準を維持する

配布前監査で確認されたHighからLowまでの全指摘を、公開前に残件0件へする。最優先は、secretをcommit・pushしないこと、
各操作が所有しないstageを混ぜないこと、symlink経由でworkspace外へ書込み・削除しないこと、OAuthとloopback wizardを
同一sessionの正当な操作だけに閉じることである。次にGoogle Chat履歴とGitHub Actions runの取り違えを防ぎ、
`0.6.0`利用者がカスタマイズと記憶を保ったまま `0.7.0`へ更新・復元できる状態を作る。

Google ChatのOAuth実値はlocal wizard sessionのmemoryから `gh` のstdin経由で現在のprivate repoのRepository Secretへ直接登録する。
Chatwork API Tokenはwizardが取得・受領・登録せず、F24の既存導線どおり利用者本人がGitHubのRepository Secret画面へ直接入力する。
両サービスともRepository Secretを正本とし、通常フローで実値がrepo、Git履歴、ログ、製品側DOM、会話に残ることは0件とする。補助scannerは製品管理対象と初回publishの
合理的な誤混入を止めるための追加防御であり、private repo内の任意コードを全構文解析する万能secret detectorとは扱わない。

配布可否はコード修正だけで決めない。全自動回帰、`.git`がないGit archive相当の配布物、desktop／mobile／200%のwizard、
専用private test workspaceでのChatwork／Google Chat／OAuth／Repository Secret／Actions／commit・push／検索を確認し、
最後にschedule停止、Secret削除、Google OAuth grant／token取消、選択解除まで完了した場合だけ合格とする。

### G11 2つの完成品を安全に育てる

`agentic-secretary` を共通基盤の上流、`yasashii-secretary` を非エンジニア向けoverlayの下流として分ける。
両者はneutralization commitまでのGit履歴と共通祖先を持ち、共通の安全性、Chatwork／Google Chat wizard、
OAuth、同期、更新回帰を共有する。edition差分は会話、診断、報告、developer handoffに限定する。

初期リリースではco-installationとedition switchingを提供しない。反対editionまたは混在状態を検出したら、
利用者データを移動・統合・上書きせず停止する。`0.7.0` の歴史記録は不変とし、まだ利用者へ明示配布していない段階の
最初の配布候補を `0.8.0` へ直接揃える。既存0.7.0利用者向けの複雑なexternal recovery／bootstrapは作らず、
未検証のlive update成功を公開条件として主張しない。same-version bootstrap bridgeは採用せず、同一版とdowngradeは副作用0件で停止する。

両editionの思想と対象ユーザーの違いは保ったまま、全ユーザー会話には改行、段落、必要なMarkdown箇条書きという
共通の可読性最低基準を適用する。これは好みとして質問せず、preferencesでも無効化しない。
固定3項目報告は完了・状態報告だけに適用し、一般回答は内容に応じた段落・箇条書きで返す。

`agentic-secretary` は技術者向けにそのまま配布できる完成品とし、正式な必須対象環境を
Claude Code Desktop App、Claude Code CLI、Codex App、Codex CLIの4つとする。その他のコーディングエージェントは
共通本体を再利用しやすくする設計対象だが、公式受入対象・配布保証・実環境検証必須対象ではない。
共通本体はホスト非依存の1実装とし、ホスト固有部分だけをhost adapterとして分ける。
対応対象ホストと検証済みホストは別集計し、1ホストのPASSを全ホストPASSとして扱わず、
未検証環境を「対応済み」と表示しない。詳細は `editions.md` を正本とする。

## ゴール

1. 非エンジニアが説明に沿って導入し、初回5問以内で `secretary/` を安全に生成したうえで、1つのprivate GitHub repoを作成・初回pushできる。
2. 話す・成果物を保存する・TODOを扱う・設定を変えるだけで、三層記憶が定義どおり蓄積される。
3. `timeline` で期間・種類・キーワードを指定し、決定と活動を日付つきで再発見できる。
4. 設定を後から変えられ、適用前の例文プレビューと適用後の宣言により意図しない人格変更を防げる。
5. Chatworkと明示設定済みGoogle Chat以外の外部データは同期せず根拠を添えて使い、両チャットは選択対象だけを同じrepoへ保存できる。
6. 開発依頼は `yasashii-harness` への健全な参照導線から、規律を維持した3 Agent ループへ接続できる。
7. 既存の記憶保護・封じ込め・単段クレジット・節目commitを回帰させない。初回pushと同意済みChatwork schedule push以外の予期しないpushは確認する。
8. `/chatwork` からroom設定、同期状態、履歴検索へ進め、検索失敗時も「無い」と断定せず次の確認手段を選べる。
9. public配布repoとprivate workspaceの責務を混ぜず、専用private test workspaceで実API経路を伏せ字証跡つきで評価できる。
10. 継続する一般業務を確認後にプロジェクト化し、ライトな1枚から開始して、必要になった時だけユーザー確認後にフル運用へ昇格できる。
11. 特定の講座・期・教材の説明がなくても、READMEと配布物だけで一般の非エンジニアが導入・利用を始められる。
12. 「最新版にして」から、まず現在版・最新版・変更点・影響・カスタマイズ衝突可能性を変更なしで理解でき、明示確認後だけ保護commit、更新、移行、検証、必要時の復元へ進める。
13. `/google-chat` からAI支援で各社所有Cloud projectを準備し、接続用JSON取得後のOAuth接続、通常スペース選択、初回取得、検索、3時間推奨の定期取得へ進める。
14. `0.7.0`の配布前gateで、監査指摘0件、全自動回帰0 FAIL、Git archive相当の動作、専用private test workspaceの両チャットlive gateと後始末をすべて証跡つきで確認できる。
15. `agentic-secretary` と `yasashii-secretary` が同じGit系譜と共通安全基盤を持ち、対象ユーザーに合わせた4つの表現面だけをedition差分として独立配布できる。
16. 最初の明示配布候補 `0.8.0` を新規導入できる。反対edition、曖昧なworkspace、同一版、downgradeではデータを変えずに停止し、旧0.7.0 updaterの既知blockerを対応済みと誤表示しない。
17. agentic／yasashiiの全会話が、内容に応じた改行・段落・Markdown箇条書きで読める。ChatworkのSecret登録ではGitHub画面の `Name` と `Secret` に入れる内容が具体的に分かる。
18. `agentic-secretary` を4つの正式対象ホスト（Claude Code Desktop App／Claude Code CLI／Codex App／Codex CLI）で、共通本体＋host adapterの構成により導入・検証でき、対応対象と検証済みが別集計で正直に表示される。

## 成功状態

- `journal` / `decisions` / `topics` が役割どおりに蓄積され、会話全文や承認対象外の外部データ本文を保存していない。Chatwork／Google Chat本文は選択対象の専用履歴領域だけにある。
- `timeline` は同じ入力から同じ Markdown を返し、「Zoomの件いつ決めたっけ」のような問いをキーワード検索できる。
- `MEMORY.md` は200行以内で、topics と月単位に畳んだ journal を索引できる。
- 初回設定は5問以内。口調は聞かず標準値で開始し、いつでも変更できることを伝える。
- `preferences.md` が欠落または空でも既定値で安全に動き、明示した設定だけが挙動を上書きする。
- 決定を含む模擬会話、決定ゼロの日の締め、3種類の設定差分を Evaluator が実際に確認できる。
- `yasashii-secretary` にハーネスや agents のコピーがなく、`yasashii-harness` への案内が切れていない。
- GitHub上の `mtaiseeei/yasashii-harness` がpublic・`fork=false`で実在し、origin/upstream remoteとfb9c303基点を証跡で確認できる。
- remote manifestsのmarketplace `name` / `repository`、plugin `name` / `source` / `repository` / `homepage` がdownstreamと `harness@yasashii-harness` に整合し、metadata allowlist外の上流行変更が0件である。
- private GitHub repoの初回push後、秘書・プロジェクト・Chatwork設定が同じrepoにあり、別のChatwork専用repoを必要としない。
- Chatwork API TokenがRepository Secret以外へ露出せず、参加room一覧から選んだRoom IDだけがGit管理される。
- 初回取得が0件または最大100件でも正常完了し、以後の取得がmessage ID単位で重複せず蓄積される。
- Chatwork wizardで30分／1時間／3時間／6時間／12時間／手動のみを選べ、3時間が推奨・初期値であり、月間run数の概算・実課金との差が分かる。
- 検索で見つからないとき、確認なしの手動同期を行わず、承認時だけdispatch→完了確認→pull→再検索が成立する。
- 実API評価では、専用private test workspace内にpluginの利用設定・生成物、秘書、通常project、Chatwork設定・workflow・履歴が同居し、Repository Secret経由の非機密test room同期、commit、push、pull後検索を確認できる。public配布ソース自体は複製せず、token値、不要なroom名、本文は証跡に残らない。
- 複数行動・複数セッションの仕事は理由つきでプロジェクト候補として提案され、拒否時は作成0件、承認時は一般PJのライト構成または別repo開発PJの参照ポインタとして整理される。
- 一般PJは `PROJECT.md` の現在状況から再開でき、決定・恒久事実・成果物・旧版が役割どおり分かれる。フル昇格はトリガー到達とユーザー承認の両方が必要である。
- 現行正本・公開面・配布物に旧配布チャネル固有の名称・期数・教材導線・その利用者であることを前提にした説明がなく、一般の非エンジニア向け表現に統一されている。
- marketplaceとplugin manifestのversionが一致し、不一致は配布前の検査で検出される。CHANGELOGは「誰に何が変わるか」「設定・ファイルへの影響」「必要な操作」を版ごとに示す。
- 「最新版にして」の初回診断ではplugin更新、workspace書込み、migration、commit、pushが0件で、利用者は実更新へ進むかを説明後に選べる。
- 実更新ではカスタマイズ済みファイルの既定が「現状を残す」となり、台帳が無い0.2.0利用者も安全な初回判定を経て更新できる。失敗時は直前のローカルcommitへ戻す手順が分かる。
- Google OAuthの厳格secretが永続物へ露出せず、client IDは識別子として必要な一時表示だけに限られ、`SPACE`だけを選べ、DM／グループDMが候補・履歴に混ざらない。
- 選択したGoogle Chatスペースは取得可能な履歴を初回に日付別Markdownへ保存し、スレッド、発言者、添付メタデータを検索できる。添付本文は保存しない。
- 3時間ごとの自動取得を推奨・初期値として選べ、同意済みscheduleだけがcommit・pushする。認証失効や管理者ブロック時は、秘密値を出さず再認証または管理者確認へ進める。
- ChatworkとGoogle Chatは共通wizard骨格で操作でき、各画面のサービス名とサービス別primary CTA色により取り違えない。
- Chatwork／Google Chatの初見利用者が、主説明だけで「今すること」「次に起きること」「何を読み、どこへ保存し、誰が見られるか」を説明できる。正式な技術名は必要な場面だけ短い役割説明または管理者向け詳細で確認できる。
- Google Chatを設定する利用者は、Google Chat skillの案内に沿って、現在のrepoに対応するCloud project、必要API、`Internal`、`Desktop app`、接続用JSONの取得まで進められる。`gcloud`を使えない環境でも、対象Projectを指定した直接リンクで同じ完了状態へ到達できる。JSON取得後のwizardではスペースと間隔を一度だけ選び、`この設定で始める` の1回で初回取り込みと自動取得設定が完了する。完了画面のprimary CTAは `設定を終了する` だけである。
- Google ChatのOAuth実値がlocal wizard sessionのmemoryから `gh` のstdin経由でRepository Secretへ直接登録される。ChatworkはwizardがTokenを取得・受領・登録せず、利用者本人がGitHubのRepository Secret画面へ直接入力する既存F24導線を維持する。両サービスとも通常フローのrepo・Git履歴・ログ・製品側DOM・会話へ実値が0件である。
- 初回publish、Chatwork／Google Chat設定、記憶の節目commit、更新の各経路で、既存stageや操作対象外のファイルがcommitへ混ざらない。製品が生成・管理するworkflow／config／historyと初回publish inventoryでは、OAuth client JSON、private key、known token field、通常のliteral assignment等の合理的な誤混入がcommit・push前に拒否される。
- `${{ secrets.NAME }}` 等の正規のruntime参照、通常文書、合理的な非機密metadataはsecretとして誤拒否されない。
- Node／shellの書込み・削除はsymlinkを含む実体境界を守り、workspace外の本体を変更しない。外部CLI・HTTPはtimeout後に安全に停止し、部分成功または未完了を正直に示す。
- loopback wizardは同一origin・同一session・正しいContent-Typeの状態変更だけを受け付け、OAuth callbackは再送・再入でtoken交換やSecret登録を重複しない。後始末失敗を成功と表示しない。
- Google Chat本文に内部markerと同じ文字列が含まれても、既存履歴と新規履歴を欠落させない。GitHub Actionsは今回のdispatchに因果的に対応するrunだけを追跡し、古いrunや時刻不明runを成功扱いしない。
- `0.7.0` のmanifest、migration、fixture、評価記録、Git履歴は不変である。最初の明示配布候補のmarketplace、plugin manifest、正本／旧raw CHANGELOG、更新台帳、公開ガイドが `0.8.0` で整合し、新規導入、equal／downgrade副作用0停止、portable gateが成立する。旧0.7.0 updaterの既知blockerは未解消のlive互換として区別される。
- 両editionの会話、診断、確認、進行、結果、エラー、handoffで、複数要素が改行なしの平文に連結されず、段落またはMarkdown箇条書きとして読める。edition固有の対象・内容差は保たれる。
- Chatwork wizardのGitHub Secret案内は `Name` 欄=`CHATWORK_API_TOKEN`、`Secret` 欄=本人が公式画面で取得したAPI Tokenと示し、実値をwizardや会話へ入力させない。
- master回帰は受入済みSprint 015とSprint 020 Patch 002を含む必要な全suiteを実行し、Git checkoutとGit archive相当の両方で合格する。配布可否を個別suiteの成功だけで代替しない。
- wizardの画面遷移後は新しい見出しまたは主領域へfocusが移り、keyboard利用者が現在地を把握できる。主要操作は44px相当以上で、README、onboarding、`.mcp.json`、公開ガイドが現行機能と一致する。
- 最終live gateでは両チャットの非機密test対象を同じ専用private test workspaceへ保存し、OAuth、Secret、Actions、commit、push、pull後検索を確認する。終了後はschedule、Secret、対象選択、Google OAuth grant／tokenが残っていない。

## 非ゴール

- ChatworkとGoogle Chat以外の外部データ同期層・キャッシュ層は作らない。2つの実装を汎用同期基盤へ一般化しない。
- cc-company の部署制、必須 `case-NNN`、`patterns/` 自動統合は導入しない。
- 同意前のschedule push、確認なしの予期しない手動同期、public repoへのChatwork保存は行わない。復元機能「昨日の状態に戻して」は今回作らない。
- 濃いキャラクター（関西弁・執事風等）のプリセットは同梱しない。例ペアを育てる方法は本プラグインの必須導線にしない。
- hooks は同梱しない。採用する場合は先に不変条件を再定義する。
- dashboard は G1 の完了条件にしない。sprint-012 で明示判断する。
- 常設Webアプリ、外部公開サーバー、汎用dashboardは作らない。例外としてChatwork／Google Chat設定用の共通ローカルwizardを提供する。
- public配布repoへのChatwork Repository Secret、同期workflow、room設定、履歴の配置は行わない。
- Chatwork専用のtest repo、または秘書・projectと分離したChatwork専用workspaceは作らない。
- `~/workspace/agentic-harness` を操作しない。編集だけでなくcheckout、commit、branch、remote変更、生成物作成、複製元利用、コマンド対象化を禁止し、上流参照はGitHubに限定する。
- GitHubのfork badge／parent relation、同じforkから上流へPRする導線は作らない。上流変更は本作業のスコープ外であり、将来あらためて明示承認された場合だけ `agentic-harness` 側の別branch / PR手順に分離する。
- Chatwork APIの100件より前を遡るバックフィル、全roomの無断同期、Chatworkへの投稿・編集・削除は行わない。
- 単発の見積書、一度きりの成果物、同じ会話で完了する作業を、形式だけのプロジェクトへ自動昇格させない。
- Sprint 017/018の履歴正本は改変しない。Google Chatの接続、OAuth、同期、設定画面はSprint 019/020だけで扱う。
- ShigApps共通の外部向けOAuthアプリ、Googleの外部公開審査を前提にした配布、サービスアカウント、Domain-Wide Delegationは初版で扱わない。
- Google ChatのDM／グループDM、全スペース自動選択、投稿・編集・削除、添付ファイル本文のダウンロード、取得済み履歴の自動削除は行わない。
- 無料の個人Googleアカウント向けの分岐、`External` Audience、Test users、公開審査の案内は扱わない。Google WorkspaceのGoogle Chatだけを正式サポートする。
- Browser Use、Chrome拡張機能、特定のブラウザ自動操作環境をGoogle Cloud準備の必須条件にしない。
- 会社別・相手別にGoogle Chat／Chatworkを自動判定するチャットルーティングは今回扱わない。
- 読み取り専用診断中のplugin更新、workspace書込み、migration、commit、push、設定の自動変更は行わない。
- 更新のために利用者のカスタマイズを無確認で上書きしない。自動push、履歴書換え、secretや私的内容を含む台帳は作らない。
- 配布前監査の残件を「既知の制限」として `0.7.0`へ持ち越さない。live gateを合成fixture、過去の成功run、片方のチャットだけの確認で代替しない。
- `0.6.0`以前の公開履歴、過去の監査記録、既存Git履歴を書き換えない。`0.7.0`のためにforce push、rebase、filter-repoを行わない。
- 利用者がローカル／private repo内の任意のJS／TS／shell／JSONを意図的に特殊構文・難読化・computed／escaped key・偽placeholderへ改変し、補助scannerを回避するケースの完全検出は保証しない。補助scannerを任意言語の万能parserへ拡張することもゴールにしない。
- 初期リリースでは、2 editionの同一workspaceへのco-installation、edition切替command、反対editionのledger／marker／履歴の移動・統合・自動削除を行わない。
- editionごとにChatwork／Google Chat wizard、skill名、command名、workspace root名、OAuth scope、migration filenameを分岐しない。
- `agentic-secretary` を設定項目だけ増やした万能版にしない。技術者向け差分は会話、診断、報告、developer handoffに限定する。
- `0.7.0 → 0.7.0` のsame-version bootstrap bridge、公開済み `0.7.0` のin-place差替え、同一versionの更新、version downgradeを提供しない。
- 未配布段階の初回0.8.0候補のために、旧0.7.0利用者向けexternal recovery／bootstrapを作らない。fixture削除や安全scan弱体化で旧updateを合格にしない。
- 公開済み `0.7.0` のrelease記録、manifest、migration、fixture、progress／feedback、Git履歴を `0.8.0` 前提へ書き換えない。

## 承認済みの条件付き判断

- sprint-012時点では既存利用者の証跡がなかったため、journalディレクトリ追加とpreferences v1→v2のmigrationは作らなかった。今後の配布更新と既存workspace移行は、別Sprintであらためて扱う。
- 更新機能はSprint 017の読み取り専用基盤とSprint 018の実行に分ける。実更新の主体は秘書とするが、説明とユーザーの明示確認を必須にし、カスタマイズ済みファイルは「現状を残す」を既定とする。
- dashboard は timeline の利用反応を見て sprint-012 で実施可否を判断し、無断で追加しない。
- Google Chatは `1A` 各社所有Cloud project、`2A` 選択した通常スペースだけ、`3A` 同じprivate workspace＋GitHub Actionsで確定した。Chatworkと同じ3時間取得を推奨・初期値とし、DM、共通External app、サービスアカウントは初版で扱わない。
- 配布前監査は `1A` HighからLowまで全指摘を公開前に解消、`2A` 公開版 `0.7.0`として既存 `0.6.0`から安全更新、`3A` 自動回帰と専用private test workspaceのChatwork／Google Chat live gateを正式な合格条件、で確定した。追加質問は不要である。
- 2026-07-19、secret検査の保証境界を確定した。Google Chatのwizard memory→`gh` stdin→Repository Secretと、Chatworkの利用者本人によるGitHub Repository Secret画面への直接入力という既存の2導線、および製品管理対象／初回publish inventoryの合理的な誤混入を厳格に保護する。一方、利用者が意図的に難読化した任意コードの完全検出は非ゴールとし、それのみを理由に配布不合格としない。
- 2026-07-20、`0.7.0` の歴史記録は不変、まだ明示配布していない2 editionの最初のcandidate／latestは `0.8.0` と決定した。旧0.7.0利用者向けexternal recovery／bootstrapを作らず、旧scanner blockerを隠さない。same-version bridgeは採用せず、同一版とdowngradeは副作用0件で拒否する。
- 2026-07-20、Repo分割前に全会話のMarkdown可読性とChatwork Secretの具体的な `Name`／`Secret` 入力案内を共通実装する。改行は好みとして質問せず、両editionの思想・対象差は維持する。
- 2026-07-20、`agentic-secretary` の正式対象環境を Claude Code Desktop App／Claude Code CLI／Codex App／Codex CLI の4つと確定した。その他のコーディングエージェントは設計対象だが受入・保証・検証必須対象外とし、共通本体はホスト非依存、host固有部分だけをadapterに分け、対応対象と検証済みを別集計する。未検証環境を「対応済み」と表示しない。
- 2026-07-20、Sprint 032 Patch 002で、一般回答を固定3項目へ押し込まない分離、実会話runnerの安全化（env allowlist・最小ツール・workspace内fixture・cleanup）、完了報告テストの誤合格解消、wizard進捗一貫性、GitHub用語の初出説明、serializer正本の明確化、yasashii向け `ルーム` 表記統一を確定した。設定確認の `key=value` 表現改善はSprint 034へ延期する。

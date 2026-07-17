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
READMEでは通常機能と混同せず「Google Chatをつなぐ（少し高度な設定）」として、管理者へ依頼する内容と
利用者が行う内容を順に示す。

接続後は、利用者が名前を確認して選んだ `SPACE` 種別の通常スペースだけを同じprivate workspaceへ保存する。
1対1のDMとグループDMは初版では対象外にし、投稿・編集・削除も行わない。保存形式と取得の考え方は
`my-vault` の現行Google Chat同期を基準に、スペース別・日付別Markdown、スレッド、発言者、Asia/Tokyoの時刻、
初回の取得可能な全履歴、以後の差分取得を保つ。ただし、使っていない権限、古いサービスアカウント案内、
資格情報を端末へ表示する挙動は引き継がない。

自動取得の既定推奨は3時間ごとにする。利用者は手動のみ、1時間、3時間、6時間、12時間から選べ、
確定前に対象、保存内容、共同編集者への可視性、commit・pushを確認する。保存形式と取得境界は `my-vault` を基準にするが、
自動取得の推奨間隔とAsia/Tokyoの日付境界は本製品で意図的に改善する。

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
13. `/google-chat` から各社所有Cloud projectの前提、OAuth接続、通常スペース選択、初回取得、検索、3時間推奨の定期取得へ進める。

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
- 読み取り専用診断中のplugin更新、workspace書込み、migration、commit、push、設定の自動変更は行わない。
- 更新のために利用者のカスタマイズを無確認で上書きしない。自動push、履歴書換え、secretや私的内容を含む台帳は作らない。

## 承認済みの条件付き判断

- sprint-012時点では既存利用者の証跡がなかったため、journalディレクトリ追加とpreferences v1→v2のmigrationは作らなかった。今後の配布更新と既存workspace移行は、別Sprintであらためて扱う。
- 更新機能はSprint 017の読み取り専用基盤とSprint 018の実行に分ける。実更新の主体は秘書とするが、説明とユーザーの明示確認を必須にし、カスタマイズ済みファイルは「現状を残す」を既定とする。
- dashboard は timeline の利用反応を見て sprint-012 で実施可否を判断し、無断で追加しない。
- Google Chatは `1A` 各社所有Cloud project、`2A` 選択した通常スペースだけ、`3A` 同じprivate workspace＋GitHub Actionsで確定した。Chatworkと同じ3時間取得を推奨・初期値とし、DM、共通External app、サービスアカウントは初版で扱わない。

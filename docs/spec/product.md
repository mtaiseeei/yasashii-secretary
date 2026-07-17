# Product

## これは何か

`yasashii-secretary` は、ゆるAIコーディング塾の第2期以降で配布する、非エンジニア向けAI秘書プラグイン
（Claude Code plugin / public / MIT）。名前と README の両方で非エンジニア向けであることを明確にする。

中心思想は **「1つのprivate GitHub repoに、秘書・一般プロジェクト・Chatworkの文脈をまとめる」**。
秘書の記憶と成果物、営業・マーケティング・新規事業等の一般プロジェクト、選択したChatwork roomの履歴を
同じrepoでGit管理する。開発は既存の `build` と `yasashii-harness` 導線を維持し、案件に応じて
別repoを正本にできる。その場合、秘書workspace側には概要と正本repoへの参照ポインタだけを置く。
Chatwork以外の外部データは、従来どおり公式コネクタで都度参照する。

publicな `yasashii-secretary` repoは配布物の正本であり、利用者データの保存先ではない。
各利用者はpluginを使う秘書ワークスペース、一般プロジェクト、Chatwork設定・workflow・履歴を
1つのprivate GitHub repoに置く。実API評価用repoもこの実利用構成を再現する専用private test workspaceとし、
Chatwork専用repoへ分離しない。開発の正本repoは必要に応じてこのworkspaceから分けられるが、作成・接続・公開範囲を
ユーザーに確認し、workspace側に同じ仕様や判断ログを二重管理しない。

2026-07-15 の方針転換は `docs/proposal-2026-07-15-realignment.md` を基礎とする。
2026-07-16 に追加承認されたsingle-repo Git-first + Chatwork方針は本spec群が正本であり、
外部同期なし・ローカルだけ・Web UIなし・pushなしという旧条件を、single-repoワークスペースとChatworkの範囲で上書きする。

## 対象ユーザー

- **主対象**: ゆるAIコーディング塾の30〜60代の受講者。技術に多少関心がある非エンジニアで、標準環境は Claude デスクトップアプリ／Claude Code。Git / GitHub の基礎は第1回で学んでいる。
- **副対象**: 村山さんを含む配布・保守者。受講者向けの導入と保守を、秘書本体と開発ハーネスを独立に更新しながら行う。

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

## ゴール

1. 非エンジニアが説明に沿って導入し、初回5問以内で `secretary/` を安全に生成したうえで、1つのprivate GitHub repoを作成・初回pushできる。
2. 話す・成果物を保存する・TODOを扱う・設定を変えるだけで、三層記憶が定義どおり蓄積される。
3. `timeline` で期間・種類・キーワードを指定し、決定と活動を日付つきで再発見できる。
4. 設定を後から変えられ、適用前の例文プレビューと適用後の宣言により意図しない人格変更を防げる。
5. Chatwork以外の外部データは同期せず根拠を添えて使い、Chatworkは選択roomだけを同じrepoへ保存できる。
6. 開発依頼は `yasashii-harness` への健全な参照導線から、規律を維持した3 Agent ループへ接続できる。
7. 既存の記憶保護・封じ込め・単段クレジット・節目commitを回帰させない。初回pushと同意済みChatwork schedule push以外の予期しないpushは確認する。
8. `/chatwork` からroom設定、同期状態、履歴検索へ進め、検索失敗時も「無い」と断定せず次の確認手段を選べる。
9. public配布repoとprivate workspaceの責務を混ぜず、専用private test workspaceで実API経路を伏せ字証跡つきで評価できる。
10. 継続する一般業務を確認後にプロジェクト化し、ライトな1枚から開始して、必要になった時だけユーザー確認後にフル運用へ昇格できる。

## 成功状態

- `journal` / `decisions` / `topics` が役割どおりに蓄積され、会話全文やChatwork以外の外部データ本文を保存していない。Chatwork本文は選択roomの専用履歴領域だけにある。
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
- wizardで30分／1時間／3時間／6時間／12時間／手動のみを選べ、既定推奨1時間と月間run数の概算・実課金との差が分かる。
- 検索で見つからないとき、確認なしの手動同期を行わず、承認時だけdispatch→完了確認→pull→再検索が成立する。
- 実API評価では、専用private test workspace内にpluginの利用設定・生成物、秘書、通常project、Chatwork設定・workflow・履歴が同居し、Repository Secret経由の非機密test room同期、commit、push、pull後検索を確認できる。public配布ソース自体は複製せず、token値、不要なroom名、本文は証跡に残らない。
- 複数行動・複数セッションの仕事は理由つきでプロジェクト候補として提案され、拒否時は作成0件、承認時は一般PJのライト構成または別repo開発PJの参照ポインタとして整理される。
- 一般PJは `PROJECT.md` の現在状況から再開でき、決定・恒久事実・成果物・旧版が役割どおり分かれる。フル昇格はトリガー到達とユーザー承認の両方が必要である。

## 非ゴール

- Chatwork以外の外部データ同期層・キャッシュ層は作らない。Chatwork同期を他サービスへ一般化しない。
- cc-company の部署制、必須 `case-NNN`、`patterns/` 自動統合は導入しない。
- 同意前のschedule push、確認なしの予期しない手動同期、public repoへのChatwork保存は行わない。復元機能「昨日の状態に戻して」は今回作らない。
- 濃いキャラクター（関西弁・執事風等）のプリセットは同梱しない。例ペアを育てる方法は塾コンテンツに分離する。
- hooks は同梱しない。採用する場合は先に不変条件を再定義する。
- dashboard は G1 の完了条件にしない。sprint-012 で明示判断する。
- 常設Webアプリ、外部公開サーバー、汎用dashboardは作らない。例外としてChatwork設定専用のローカルwizardを提供する。
- public配布repoへのChatwork Repository Secret、同期workflow、room設定、履歴の配置は行わない。
- Chatwork専用のtest repo、または秘書・projectと分離したChatwork専用workspaceは作らない。
- `~/workspace/agentic-harness` を操作しない。編集だけでなくcheckout、commit、branch、remote変更、生成物作成、複製元利用、コマンド対象化を禁止し、上流参照はGitHubに限定する。
- GitHubのfork badge／parent relation、同じforkから上流へPRする導線は作らない。上流変更は本作業のスコープ外であり、将来あらためて明示承認された場合だけ `agentic-harness` 側の別branch / PR手順に分離する。
- Chatwork APIの100件より前を遡るバックフィル、全roomの無断同期、Chatworkへの投稿・編集・削除は行わない。
- 単発の見積書、一度きりの成果物、同じ会話で完了する作業を、形式だけのプロジェクトへ自動昇格させない。

## 承認済みの条件付き判断

- 第2期配布が新規セットアップのみなら migration は作らない。既存ユーザーがいると確認された場合だけ、sprint-012 で journal ディレクトリ追加と preferences v1→v2 移行導線を扱う。
- dashboard は timeline の利用反応を見て sprint-012 で実施可否を判断し、無断で追加しない。

# Domain

本製品のドメインはDBではなく、1つのGitHub repoにある秘書・一般プロジェクト・Chatwork・Google Chatと、別repo開発プロジェクトの関係、
`secretary/` の記憶の意味、外部データを記録へ移す規則である。

## 主要概念

| 概念 | 意味 | 正本／置き場 |
|---|---|---|
| 秘書 | 記憶・整理・下調べ・成果物・開発導線を担うAI役割 | `yasashii-secretary` skills |
| public配布repo | plugin配布ソースと公開ドキュメントの正本。利用者データやChatwork live環境は置かない | `yasashii-secretary` |
| ユーザーワークスペース | 秘書・一般プロジェクト・Chatwork・Google Chatをまとめるprivate GitHub repo | repo root |
| private test workspace | 実利用と同じsingle-repo構成で実APIを評価する専用private GitHub repo | 評価用repo root |
| 秘書ディレクトリ | オンボーディングで生成しgit管理する作業領域 | `secretary/` |
| 一般プロジェクト | 営業・マーケティング・新規事業等、workspace内を正本にして継続管理する仕事 | `secretary/projects/<project>/` |
| 別repo開発プロジェクト | 実装・仕様・判断・進行の正本を独立repoに置く開発仕事 | 外部repo＋workspace内の参照ポインタ |
| 決定 | ユーザーが確定し、確認を経て残す事柄 | 一般事項は `memory/decisions/`、PJ固有事項は当該PJの正本 |
| 活動 | 定義済みシームを通って実際に起きた事実 | `memory/journal/` |
| 相談の文脈 | 結論前の背景・経緯・固有名詞を要点化した案件メモ | `memory/topics/` |
| 中断点 | 今の作業を再開するための一時的な文脈 | `memory/_resume.md` |
| 翌日への申し送り | 次に行う事実として日付に残す項目 | journal の `next` |
| 個人設定 | 役割、言葉遣い、報告、確認方法の明示設定 | `memory/preferences.md` |
| 成果物 | 企画書・調査まとめ等の正本 | 単発は `docs/YYYY/MM/`、一般PJは当該PJ内 |
| 外部データ | SaaSに置いたまま参照するメール・予定等 | 公式コネクタ |
| Chatwork接続 | GitHub上の安全な保管場所（Repository Secret）にあるTokenを使う読取専用接続 | GitHub Actions |
| ルーム選択 | ユーザーが保存対象として明示したルームID集合 | 同じrepoのChatwork設定 |
| Chatwork履歴 | 選択ルームから取得済みのメッセージ | 同じrepoのChatwork履歴領域 |
| 同期状態 | 最終成功、ルームごとの取得位置、失敗理由 | 同じrepoの状態記録 |
| Google Cloud準備 | skill会話が、現在のGit repoに対応する組織所有Cloud project、必要API、`Internal`、Desktop app、接続用JSON取得までを支援する | Google Chat skill＋Google Cloud |
| Google Cloud接続 | 利用組織が所有するCloud projectと `Internal` のユーザーOAuth | Google Cloud＋接続用JSON取得後のローカルwizard |
| Google Chatスペース選択 | ユーザーが保存対象として明示した `SPACE` ID集合。DM／グループDMは含めない | 同じrepoのGoogle Chat設定 |
| Google Chat履歴 | 選択スペースから取得した日付別Markdown。スレッドと添付メタデータを含む | 同じrepoのGoogle Chat履歴領域 |
| Google Chat同期状態 | 最終成功、スペースごとの取得位置、失敗・再認証理由 | 同じrepoのGoogle Chat状態記録 |
| やさしいハーネス | 規律を緩めず開発を進める別製品 | 別repo `yasashii-harness` |
| 配布版 | 利用者が導入・更新判断に使うpluginのversion | marketplaceとplugin manifestの一致値 |
| CHANGELOG | 版ごとの利用者向け変更説明 | public配布repo |
| 管理対象ファイル | pluginが配布・生成し、更新時に基準との差を判定するファイル | plugin配布物またはprivate workspace内の対象path |
| 最小台帳 | 管理対象ファイルの版・基準hash・テンプレート変数だけを持つ更新判断用メタデータ | private workspace内のplugin管理領域 |
| 復元地点 | 実更新の直前に作るpushなしのローカルcommit | private workspace repo |

## 更新の状態モデル

更新は `diagnosis`（読むだけ）と `apply`（明示確認後の実行）を別状態として扱う。

- `diagnosis` は現在版、最新版、CHANGELOG、管理対象ファイルの基準との差、必要操作を読む。最新版を確認できない場合は `latest-unverified` とし、推測で最新版扱いしない。
- `apply` は診断結果が揃い、利用者が実更新を明示了承し、安全な復元地点を作れる場合だけ開始する。
- 管理対象ファイルは `unchanged`、`customized`、`unknown-baseline` に分類する。`customized` と `unknown-baseline` は上書きせず「現状を残す」を既定にする。
- 最小台帳は管理対象path、導入済みversion、配布時の基準hash、明示的に許可した非機密のテンプレート変数だけを持つ。値が私的内容・資格情報に当たり得る変数は保存せず、更新時に要確認として扱う。
- 台帳無し0.2.0は `unknown-baseline` を安全側の既定とし、既知の0.2.0基準と一致を証明できたファイルだけ `unchanged` と判定する。
- migrationは `fromVersion`、`toVersion`、適用済み判定を持ち、dry-runと本実行で同じ対象を示す。再実行時の追加変更は0件でなければならない。
- rollbackはworkspaceを更新直前commitへ戻す範囲と、pluginを更新前versionへ戻す範囲を区別して説明する。どちらかを自動で復元できない場合は、成功と見せず手動手順を示す。

## single-repoワークスペース

```text
<private-workspace-repo>/
├── secretary/
│   ├── AGENTS.md
│   ├── CLAUDE.md
│   ├── inbox/todo.md
│   ├── docs/YYYY/MM/YYYY-MM-DD_<title>.md
│   ├── projects/
│   │   ├── <一般PJ>/PROJECT.md
│   │   └── <別repo開発PJ>/
│   │       ├── AGENTS.md
│   │       └── PROJECT.md
│   └── memory/
│       ├── MEMORY.md
│       ├── preferences.md
│       ├── decisions/YYYY-MM-DD-decisions.md
│       ├── journal/YYYY-MM-DD.md
│       ├── topics/<トピック名>.md
│       └── _resume.md
├── <Chatworkの選択設定・同期状態・履歴>
├── <Google Chatの選択設定・同期状態・履歴>
└── <GitHub Actionsの同期設定>
```

具体的なチャット用ファイル名はGeneratorが決めるが、サービスごとに設定・状態・履歴の役割を分ける。
チャット専用repoやsecretary専用の永続ローカルrepoは作らない。`10_sources/` に相当する汎用外部データ同期層も作らない。
public配布repoはこの構造の保存先にせず、plugin・公開README・配布検査だけを所有する。

## プロジェクト

### 候補と作成境界

候補検出はLLMが会話文脈から行う。次のシグナルのうち少なくとも2つがあり、そのうち1つが
「同じ成果に向けた複数行動」または「別の日・別セッションへの継続」である場合に提案できる。

- 同じ成果に向けた次の行動が2つ以上ある。
- 今日の会話だけでは完了せず、別の日・別セッションへ続く。
- 締切、待ち状態、関係者のいずれかがある。
- 方針判断または成果物が今後も増える。
- 別の会話で同じ案件が繰り返し登場する。

候補検出は作成許可ではない。確認前、拒否、キャンセルではプロジェクト関連のファイル、journal、commitを0件とする。
単発成果物、同じ会話で完了する作業、一つだけのTODOは候補にしない。

### 一般PJのライト運用

```text
secretary/projects/<project>/
└── PROJECT.md
```

`PROJECT.md` は次を持つ。

1. frontmatterの `status`: `active` または `completed`。欠落時は誤って非表示にせず `active` として扱う。
2. `現在の状況（YYYY-MM-DD時点）`: 現フェーズ、直近の変化、待ち、次の入口、要確認事項。
3. `概要`: 誰のために何をするPJか。
4. `ゴールと成功の測り方`: 終了条件と測定可能な判断基準。
5. `Decisions`: 確認済み判断のD-NNN 1行サマリー。未確定事項は入れない。
6. `メモ`: 文書から導出できない恒久的事実・知見。記録日を付け、資格情報を含めない。
7. `関連ドキュメント`: PJ内の作業文書・成果物への参照。

既存情報がある場合はユーザーが指定した最小範囲を読み、空テンプレではなく実際の概要と現状を初期値にする。

### ライト→フル昇格

次のいずれかに達したらその場で昇格を提案し、了承後だけ実行する。

1. Decisionsが10件を超えた。
2. メモが10件を超えた、または `PROJECT.md` が状態以外の内容で読みにくい。
3. PJ固有のガードレール、確認フロー、読む順序が必要になった。
4. PJ直下が10ファイルを超え、索引がないと迷う。

```text
secretary/projects/<project>/
├── CLAUDE.md       # AGENTS.mdへのポインタだけ
├── AGENTS.md       # 指示、Start here、ファイル索引、ガードレール
├── PROJECT.md      # 状態
├── DECISIONS.md    # 判断
├── MEMORY.md       # 恒久的な事実・知見
├── outputs/        # 確定成果物
├── archive/        # 旧版・backup・superseded文書
└── YYYY-MM-DD_*.md # 作業文書
```

フル移行ではライトのDecisionsを `DECISIONS.md` へ、メモを `MEMORY.md` へ移す。
`PROJECT.md` には決定の1行サマリーを残し、メモセクションは削除する。`AGENTS.md` の索引を初期化し、
以後ファイル移動・追加・削除と同じ操作で更新する。別の `INDEX.md` は作らない。

### 役割ごとの正本

- **状態**: `PROJECT.md`。決定を追記した同じ操作で現在状況と日付も更新する。
- **判断**: ライトのDecisionsまたはフルの `DECISIONS.md`。フルでは日付・背景・選択肢・結論・理由・影響範囲を持つ。
- **事実**: ライトのメモまたはフルの `MEMORY.md`。古い・誤りと分かった内容は整理できるが、資格情報は書かない。
- **タスク**: `inbox/todo.md` または接続済みサービス。PJ内に生きた `TODO.md` を作らず、`PROJECT.md` には次の入口と待ちだけを置く。
- **成果物**: 単発は `docs/YYYY/MM/`、一般PJの作業文書はPJ直下、確定版は `outputs/`、旧版は `archive/`。同じ正本を複製しない。

### 別repo開発PJのポインタ運用

開発依頼は既存の `build` から `yasashii-harness` へ接続する。別repoが適切な場合も黙って作らず、
repoの作成・接続・公開範囲を確認する。workspace側は次だけを持つ。

- `AGENTS.md`: 正本repoの場所、最初に読むファイル、workspace側では正本を編集しないという指示。
- `PROJECT.md`: 概要、正本repoへの参照、現在状態の短いスナップショット、最終確認日。

実装仕様、意思決定ログ、Sprint状態、成果物は正本repo側に置き、workspace側へ複製しない。

### 一般PJの完了と再開

- 完了はユーザー確認後だけ行い、同じ `PROJECT.md` の `status` を `completed` にする。ディレクトリ移動・削除は完了操作に含めない。
- 完了時は `PROJECT.md` に具体日、達成した結果、未完・保留・引継ぎがあれば残件として記録する。完了記録は後から検索・再参照できる正本として残す。
- `completed` のPJは通常の進行中一覧、dailyの進行中PJ、同一内容へのプロジェクト候補提案から外す。横断検索、timeline、明示的な参照依頼では引き続き対象にする。
- 完了済みPJに新しい継続作業が生じても自動再開しない。「このプロジェクトを再開しますか？」と確認し、了承後だけ `status: active` に戻す。再開日と理由を現在状況へ追記し、過去の完了日・結果・残件は消さない。
- 完了・再開が成功した事実はjournalへ1回記録できる。確認前、拒否、失敗ではstatus、PROJECT、journal、commitを変更しない。

## 実API live gate

### 評価場所

- 実APIはpublic配布repoではなく、専用private test workspaceで評価する。
- test workspaceも実利用時と同じく、pluginの利用設定・生成物、`secretary/`、通常project、Chatwork／Google Chat設定・workflow・同期状態・履歴を1つのrepoに置く。public配布ソース自体の複製は要求しない。
- チャット専用repo、Secret専用repo、履歴だけのrepoへ分割しない。

### 開始条件

次がすべて揃った場合だけlive gateを開始できる。

1. ユーザーがprivate test workspaceの作成、Repository Secret設定、workflow dispatch、remote push、対象サービスのAPI送信を明示許可している。
2. test用資格情報がRepository Secretへ登録でき、値をrepo本文や証跡へ出さない。
3. 個人情報・業務本文を評価対象にしない非機密test room／spaceが準備されている。
4. test workspaceがprivateで、評価に必要な共同編集者とActions権限だけを持つ。
5. Google Chat評価では、組織所有test Cloud project、`Internal` Audience、Desktop OAuth client、必要API、test user同意が準備されている。

開始条件が欠ける場合は `external-live-gate-unavailable` として未検証にする。Sprintは不合格だが、
合成fixtureの失敗や実装不具合とは扱わない。条件が整った後に同じEvaluator gateを再実行する。

### 伏せ字証跡

証跡に残せるのは、private状態、Repository Secret名の存在、workflow run ID／状態、取得候補件数、
選択test room／spaceの伏せ字識別子、取得件数、commit hash、push／pull成功、検索結果状態である。
token値、OAuth client値、不要な対象名、チャット本文、業務固有名詞は残さない。

### 後始末

- 評価終了後はscheduleを停止し、対象サービスのRepository Secretを削除し、test room／spaceの選択を解除する。
- Google ChatではGoogle側のOAuth grant／tokenもrevokeし、アプリ権限ページで接続が残っていないことを確認する。
- workflow、取得履歴、test workspaceを残す必要がある場合は、目的・保持期間・閲覧者をユーザーへ示す。
- repoや履歴の削除・archiveは別の破壊的操作として、対象と影響を示した後の明示確認でだけ行う。

## 0.7.0の歴史記録と最初の明示配布候補0.8.0

`0.7.0` は監査済みの不変なrelease記録であり、そのmanifest、migration、fixture、評価記録、Git履歴を変更しない。
2 edition完成品はまだ利用者へ明示配布していないため、最初の明示配布candidate／latestを `0.8.0` とする。
以下のrelease readinessは、過去の `0.7.0` 合格記録を流用せず、
同一の `0.8.0` 配布対象bytesについて判定する。

### Git変更集合

Gitを使う各操作は、次の集合を混ぜずに扱う。

- **既存変更集合**: 操作開始前からworking treeまたはindexにある利用者の変更。内容・stage状態とも操作対象外。
- **所有変更集合**: 初回publish、Chatwork設定、Google Chat設定、記憶commit、更新等、その操作が作成または変更したpath。
- **commit候補集合**: 所有変更集合のうち、secret検査と整合検査に合格し、今回commitすると利用者へ示したpath。
- **push対象**: commit候補集合だけから作られ、検証済みの今回commit。既存branchの別commitを黙って含めない。

検査後にcommit候補集合が変わった場合は、以前の検査結果を流用せず再検査する。失敗時のrollbackは所有変更集合だけへ作用し、
既存変更集合をunstage、復元、削除しない。初回publishでも「repo全体だからすべて所有」と推定せず、配布対象として意図したinventoryを確定する。

### secret値と補助scannerの責任境界

- **secret実値と正本**: OAuth client secret、認可コード、access／refresh token、Chatwork API Token等。継続取得の正本は、現在のprivate repoのRepository Secretである。
- **Google Chat登録導線**: OAuth実値はlocal wizard sessionのmemoryから `gh` のstdin経由でRepository Secretへ直接登録し、利用者のコピー／貼り付けを求めない。
- **Chatwork登録導線**: wizardはAPI Tokenを自動取得・受領・登録しない。利用者本人がChatwork公式画面で取得し、GitHubのRepository Secret画面の `Name` 欄へ `CHATWORK_API_TOKEN`、`Secret` 欄へ取得したAPI Tokenを直接入力する。Token実値をwizard、AI会話、repo本文、ログ、製品側DOMへ入力・貼り付けさせない。
- **通常フローの非露出**: 両サービスとも、実値をrepo・Git履歴・ログ・製品側DOM・会話へ残さない。
- **強制検査対象**: 製品が生成・管理するworkflow／config／historyと、初回publish時に確定したcommit候補inventory。OAuth client JSON、private key、known token field、通常のliteral assignment等、通常利用で合理的に起こり得る誤混入をcommit前に拒否する。
- **安全な参照**: `${{ secrets.NAME }}` 等の、実値を持たず実行時にRepository Secretを参照する正規参照。通常文書と合理的な非機密metadataも含め、補助scannerが誤拒否しない。
- **補助scanner**: 通常フローの設計に追加するdefense-in-depth。任意のユーザー作成コードを理解する万能parserではなく、意図的な特殊構文・難読化・computed／escaped key・偽placeholderの完全検出は保証対象外とする。この非ゴールはサービス別のRepository Secret登録導線と強制検査対象の0露出を緩めない。

### filesystem対象

- **write target**: 現在ユーザーが確認して開いているworking root内の対象。最終要素が未作成でも、最深の既存ancestorから許可rootまでを実体として評価し、外向きsymlinkがあれば作成前に拒否する。
- **delete target**: 通常ファイル／通常ディレクトリ／symlinkを区別する。symlinkはlink objectが許可root内であることを確認し、参照先を辿らずlinkだけを削除する。
- **external target**: 現在のworking rootから見たsymlink参照先と許可root外の実体。別repoは秘書workspaceから扱う間はexternal targetだが、別repo開発PJとして確認され、そのrepo自身をworking rootとして開いた開発作業ではrepo内がwrite targetになる。読取りを含め明示された範囲を超えて変更しない。

### OAuth session状態

- `client-ready`: 接続用JSONをメモリ上で検証済み。まだOAuth画面、Secret、履歴への副作用はない。
- `authorization-pending`: 一意のstate／PKCE／session確認値を持ち、callbackを1回だけ受け付けられる。
- `callback-processing`: 最初の正当なcallbackを処理中。並行・再送callbackは副作用なしで拒否する。
- `connected`: token交換と必要Secret登録が一度だけ完了し、後続の対象選択へ進める。
- `failed`: token交換または登録に失敗。厳格secretを破棄し、残存物を示す。
- `cleanup-required`: Secret、schedule、対象選択、OAuth grant／tokenのいずれかが残り、自動後始末を完了できていない。
- `closed`: 後始末不要または後始末完了。callback再入で状態を戻さない。

### release readiness状態

- `blocked`: F36〜F42、master suite、version整合、Git archive相当のいずれかが未合格。live gateを開始しない。
- `offline-passed`: 自動回帰、online参照検査、archive検査、`0.8.0`整合が合格し、同一release candidateを固定できた。
- `live-running`: 専用private test workspaceで両チャットのlive gateを実施中。片方の完了を全体合格にしない。
- `cleanup-required`: live動作は完了したが、schedule、Secret、選択、Google OAuthの後始末が未完了。
- `ready`: 同一release candidateで両チャットのActions、commit、push、pull後検索、冪等再実行と後始末がすべて合格した。

`ready`は過去runや過去commitから引き継がない。候補commitが変わった場合、影響するoffline gateとlive gateを再評価する。
candidate identityは配布対象bytesで決める。Git履歴やrepo所有の監査evidenceを使うcheckout専用検査と、`.git`／監査evidenceを
含まないarchive配布検査は別結果として記録する。checkout専用入力をarchiveへ混ぜず、両方の必須結果が合格した場合だけ
`offline-passed` とする。

### 0.6.0から0.7.0の更新状態

- `diagnosis`: 現在版 `0.6.0`、最新版 `0.7.0`、変更点、影響、復元方法を読み取り専用で示す。
- `protected`: workspaceのpushなし保護地点と、更新前plugin版／scope／取得元を復元情報として確認済み。
- `applying`: 明示確認済みのplugin更新とmigrationを実行中。`0.7.0`適用済みとはまだ記録しない。
- `verified`: plugin版、管理対象、migration、主要導線を検証済み。ここで初めて更新成功とする。
- `rollback-required`: pluginまたはworkspaceの一方でも検証不合格。両方の変更範囲と復元方法を示す。
- `rolled-back`: workspaceとpluginの両方が更新前状態であることを確認済み。片方だけの復元はこの状態にしない。

この状態遷移と対応fixtureは公開済み `0.7.0` の履歴回帰であり、`0.8.0` の期待値へ書き換えない。

### 未配布段階の0.8.0準備状態

- `candidate-aligned`: marketplace、plugin manifest、正本／legacy CHANGELOG、edition設定、README、公開ガイドが `0.8.0` で一致する。
- `fresh-install-verified`: 新規または未導入状態から0.8.0を導入し、正本plugin path、neutral marker、edition付きledger、主要skillを確認済み。
- `legacy-live-blocked`: 旧0.7.0 updaterがGoogle Chat標準生成fileをscannerで停止し、plugin update前に副作用0件で止まる。対応済みやlive互換PASSではない。
- `not-newer`: 候補が導入済みversionと同一または古い。理由と両versionを示し、plugin、workspace、Git、設定、ledger、migrationへ副作用0件で停止する。
- `portable-verified`: 同一candidate bytesでcheckout用gateと `.git` なしarchive用gateが合格する。

旧0.7.0利用者向けexternal recovery／bootstrapは状態として持たない。same-version bridge、fixture削除、安全scan弱体化、
公開済みartifactの改変で `legacy-live-blocked` を回避しない。将来この互換を提供する場合は、別のユーザー判断とSprint契約を必要とする。

## ユーザー会話の構造

ユーザー向けの意味単位を次のように扱う。

- `single-point`: 1要点だけの短い確認や回答。1段落でよく、機械的にbulletへしない。
- `multi-point`: 複数の手順、選択肢、結果、原因、影響、次の行動。空行で分けた段落またはMarkdown箇条書きにする。
- `three-line-report`: やったこと、結果、次に起きること／提案の3意味。物理的にも別行または別項目にする。
- `technical-handoff`: agentic／yasashiiの内容差を保ちつつ、再現条件、証拠、残課題等の複数要素を構造化する。

改行有無は個人設定ではなく両edition共通の表示不変条件である。内部record、commit message、index、machine-readable出力の
1行契約は会話構造と分けて扱う。

## 三層記憶

| 層 | 型 | 記録経路 | 記録前確認 |
|---|---|---|---|
| 決定 | `decided` | 会話中の検出→ `remember-decision` → journal副作用 | あり。既定は都度1行 |
| 活動 | `did` / `next` / `note` | 成功したシーム→ journal副作用 | なし。事実の追記だけ |
| 相談文脈 | topic | 区切りで要点確認→ `topic-add` → journal副作用 | あり。1行 |

決定検出はLLM規律に依存するため、「活動はシームが保証するが、決定は都度＋締めで取りこぼしを回収する」と扱う。
決定文は原文で残し、勝手に膨らませない。相談文脈は会話全文を保存せず、確認済みの要点だけを残す。
確認済みPJに属する決定・文脈は当該PJの正本へ送り、一般memoryへ同じ本文を複写しない。

## journal

### 行の型

- `did`: 実行済みの活動。
- `decided`: 確認済みの決定。decisionファイルと対応する。
- `next`: 翌日以降への申し送り。`_resume.md` の中断点とは別。
- `note`: シームを通った補足事実。自由な逐語ログには使わない。

### 操作規約

- `memory-tools.sh journal-add <sec> <did|decided|next|note> "<本文>"` は対象日ファイルの末尾にだけ追記する。各シームが共有する追記境界は `scripts/lib/journal.sh` の `journal_append` とする。
- 空本文、未知type、安全境界外を非ゼロで拒否する。既存行の更新・削除は提供しない。
- 定義済みシームは本来処理の成功後にだけ追記し、失敗した処理を活動として残さない。
- 日付は `CC_SECRETARY_NOW` で固定可能。曜日は表示しない。

## 決定の純追加モデル

- 初回決定は `memory/decisions/YYYY-MM-DD-decisions.md` へ追記する。
- 変更時は過去行を直さず、新しい日付ファイルに `変更: 「旧決定」(旧日付) → 「新決定」（理由）` の意味を持つ新規行を足す。
- timelineは新しい決定を優先して見せるが、履歴は失わない。
- 確認済みPJ固有の決定は当該PJのDecisionsへ追記し、同じ操作で `PROJECT.md` を更新する。journalの `decided` はプロジェクト名・要約・参照先を持つtimeline用の記録であり、正本の複製ではない。

## MEMORY.md と reindex

- `MEMORY.md` は1行1参照の索引で、上限は200行。
- decisions、preferences、topics を索引し、journal は日次行を並べず月単位1行に畳む。
- reindex はtopics追加・削除にも追従する。
- 200行超過を予測した場合、処理自体は `exit 0` を保ち stderr へ警告し、古い月の退避を提案する。自動退避・自動削除はしない。

## timeline

`memory-tools.sh timeline <sec> [--from <日付>] [--to <日付>] [--type decisions|journal|all] [--grep <キーワード>]`

- journalとdecisionsを日付キーで読み、逆時系列のMarkdownに整形する。
- 日付範囲とtypeを組み合わせられる。`--grep` は日付だけでは答えられない横断検索を担う。
- 同一入力・同一固定時刻ではbyte単位で同一出力になることを目標とする。
- 保存依頼時だけ既存 `save-deliverable` で成果物化する。

## TODO

- `inbox/todo.md` は既存TODOの正本。
- 追加、完了、持ち越しをシームで扱い、期限は任意フィールド。
- `todo-done` と `todo-carry` は `backup/sprint-007-010-plan` の旧実装をそのまま戻さず、journal統合形として再構成する。
- PJに属するTODOはプロジェクト名または `PROJECT.md` への参照を持てる。PJ内に別の生きたTODO正本を作らない。

## Chatworkの取得境界

### 初回取得

- 対象はユーザーが選択したroomだけ。
- roomごとにAPIが返せる最新100件以内を取得する。0件は正常な初期状態。
- 100件より前、またはセットアップ以前の履歴を取得済みと見せない。
- message IDが同じ項目は同一メッセージとして扱い、再取得で重複させない。

### 継続取得

- 新しい取得結果を既存履歴へ統合し、過去に取得したメッセージをAPI応答から消えたことだけで削除しない。
- 同期成功時だけ取得位置と最終成功時刻を進める。部分失敗はroom単位で区別し、全成功と見せない。
- room選択解除は「今後取得しない」という意味。取得済み履歴の削除は別の2段階確認を必要とする。
- APIの編集・削除状態を完全復元できるとは約束しない。Git履歴には取得時点の差分が残る。

### 自動取得の間隔

| 表示する選択肢 | 30日換算の概算実行回数 | 実行の意味 |
|---|---:|---|
| 30分ごと | 1,440回 | 毎時17分・47分を起点 |
| 1時間ごと | 720回 | 毎時17分を起点 |
| 3時間ごと（おすすめ・初期値） | 240回 | 3時間ごとの17分を起点。既定推奨 |
| 6時間ごと | 120回 | 6時間ごとの17分を起点 |
| 12時間ごと | 60回 | 12時間ごとの17分を起点 |
| 手動のみ | 0回 | 自動実行なし |

実行回数は回数の概算であり、GitHub Actionsの処理時間ではない。2026年7月時点でGitHub Freeの
非公開リポジトリに含まれる月2,000分は処理時間の枠であり、2,000回の実行枠ではない。
実使用量はプラン、runner、各回の処理時間で変わり、料金・利用枠も変更される可能性がある。
busy roomの最新100件が覆う時間幅は推奨材料にできるが、間隔の最終決定はユーザーが行う。

### 設定変更結果

- 初回設定結果と設定変更結果を区別する。
- 設定変更後は、現在の選択room、現在の頻度、scheduleの有効／無効を表示する。
- 変更前の初回取得件数や旧room一覧を現在結果として再表示しない。取得履歴自体は削除せず、設定結果とは分けて参照する。

### 検索結果の状態

`/chatwork search` は結果を次のいずれかとして扱う。

- `found`: 保存済み履歴に一致し、room・日付・メッセージ根拠を示せる。
- `not-found-locally`: 現在の保存済み履歴には一致しない。存在しないとは断定しない。
- `sync-declined`: ユーザーが手動同期を選ばなかった。
- `room-review-needed`: 対象roomが未選択の可能性がある。
- `sync-failed`: workflow失敗・timeout等で最新性を確認できない。
- `still-not-found`: 同期成功後も一致しないが、導入前履歴、100件制約、キーワード差、編集・削除の可能性が残る。

### 手動同期の状態遷移

1. repoの最新状態をpullする。
2. 保存済み履歴を検索する。
3. `not-found-locally` の場合だけ、同期／中止／room見直しを構造化質問で確認する。
4. 同期承認時だけworkflowを開始し、完了を待つ。
5. 成功確認後にpullし、同じ条件で再検索する。失敗・timeout時は検索結果を最新と見なさない。

## Google Chatの取得境界

### `my-vault`との同等性

`/Users/taisei/my-vault` の現行Google Chat同期を振る舞いの基準にする。同等とみなす要素は次である。

- 利用者本人のOAuthでGoogle Chat APIを読む。
- 選択したスペースだけを対象にする。
- スペース別・日付別のMarkdownへ保存する。
- Asia/Tokyoの時刻、発言者、本文、スレッド返信を人が読める形で残す。
- 初回はAPIが返せる履歴をページングし、以後は取得位置から差分を取り込む。
- GitHub Actionsで定期取得し、同じprivate repoへcommit・pushできる。

一方、現在の配布製品では次を意図的に引き継がない。

- DM URLの受付とDM履歴。ユーザー回答2Aにより `SPACE` のみ対象とする。
- 使っていない `chat.memberships.readonly` 等の追加scope。
- 資格情報やrefresh tokenの端末表示、`.env` 保存を通常導線にする挙動。
- 古いサービスアカウント設定案内、JSON鍵、スペースへのbot追加。
- `my-vault` 固有の自動取得間隔。本製品はChatworkと揃え、3時間を推奨・初期値にする。
- UTC文字列の日付でファイルを分ける挙動。本製品はAsia/Tokyoの日付境界を使い、日本時間の深夜帯を前日に誤分類しない。
- 同日ファイルの上書きによる既存投稿消失や、誤ったthread取得経路等、現行実装の欠陥になり得る挙動。

### OAuth資格情報と初回取得

- Google Cloud準備はskill会話が担当し、local wizardは接続用JSON選択から開始する。Cloud準備の画像、project作成、API有効化、Audience、Client作成の説明はwizardに持たない。
- Project表示名はGit repo root名＋`-google-chat`。Project IDも同じ初期案を使い、制約・全体重複時だけ調整する。Git repo root、Project案、所属組織、変更内容を確認できない状態ではCloud変更を行わない。
- `gcloud`を使える場合はproject作成とGoogle Chat API／People API有効化までを担当し、`Internal` Audience、Desktop app、JSON取得はProject指定の直接リンクで利用者が行う。`gcloud`を使えない場合は全工程を同じ直接リンク支援へ切り替える。
- 厳格secretはclient secret、認可コード、access token、refresh token、OAuth client JSON全文。永続物へ残さない。
- client IDは識別子であり、一時的なOAuth認可リクエストURLと管理者向けチェックリストでは表示できる。tracked file、Git差分・履歴、ログ、journal、fixture、スクリーンショット、評価証跡、再読込後も残るDOMには保存しない。
- Desktop OAuthはPKCEとstate検証を併用する。loopbackで受け取った認可コードは直ちにtokenへ交換し、認可URLとcallback URLの両方をログ・証跡へ記録しない。
- 初回取得はOAuth直後の同じwizardセッションで、メモリ上のtokenだけを使ってローカル実行する。tokenはセッション終了時に破棄し、2回目以降はRepository Secretを使うGitHub Actionsが担う。
- 初回取得前に、保存対象と「取得結果をこのリポジトリへ保存します（Gitのcommit・push）」を確認し、明示同意を得る。

### OAuth接続状態

- `not-configured`: Cloud projectまたはOAuth clientが未準備。
- `cli-install-confirmation-needed`: `gcloud`がなく、公式ツールの導入内容とCloud変更能力を説明したうえで利用者確認を待っている。
- `cloud-project-confirmation-needed`: repo、Project表示名／ID、Google Workspace組織、必要API、Billing非接続を提示し、作成確認を待っている。
- `cloud-preparing`: CLIまたは公式リンクでprojectとAPIを準備している。完了工程と失敗工程を分ける。
- `browser-step-needed`: `Internal`、Desktop app、JSON取得のいずれか一操作を、Project指定の公式リンクで利用者が行う状態。
- `client-file-ready`: 接続用JSONの取得を利用者が確認し、local wizardを起動できる状態。
- `admin-action-needed`: 組織所有、`Internal`、API access controls、API有効化等を管理者に依頼する必要がある。
- `authorization-needed`: clientは準備済みだが利用者のOAuth同意が未完了。
- `connected`: 必要scopeと3つのRepository Secretが揃い、通常スペース一覧を取得できる。
- `reauthorization-needed`: refresh token失効、同意取消、scope変更、管理者ブロック等で再認証が必要。
- `failed`: rate limit、network、API無効、予期しない応答等。秘密値を表示せず原因を区別する。

`connected` は秘密値の読取や表示で確認せず、Secret名の存在と、最小権限でのAPI疎通結果で判断する。

Cloud準備の再開に保存できるのは、対象repo、Project表示名／ID、Google Workspace組織、完了済み工程、次の工程、確認日時だけ。
OAuth client JSON本文、client secret、認可URL、認可コード、tokenは再開情報へ保存しない。中断後は対象Projectを再確認し、
完了済み工程を無条件に作り直さず、次の未完了工程から再開する。

### スペース選択

- 一覧に出すのは `spaceType=SPACE` だけ。`DIRECT_MESSAGE` と `GROUP_CHAT` は件数の補足にも本文にも出さず、同期対象外として短く説明する。
- 初回取得と継続取得の開始時にも選択済みspace IDの `spaceType` を再確認する。設定ファイルが直編集されても `SPACE` 以外は取得せず、状態記録へ安全な拒否理由だけを残す。
- 初期選択は0件。ユーザーが名前を見て明示選択したspace IDだけをGit管理する。
- space IDは識別子、表示名は表示用とし、名称変更後も同じspace IDを同一対象として扱う。
- 選択解除は今後の取得停止であり、既存履歴削除ではない。

### 初回取得と保存

- 初回はGoogle Chat APIと組織の保持設定が返せる選択スペースのメッセージを、ページ末尾まで取得する。固定件数や固定日数を「全履歴」と呼ばない。
- 0件は正常。スペース単位の403／404／rate limit／network失敗を区別し、成功スペースの結果を全失敗で消さない。
- message resource nameを同一性の基準とし、thread resource nameと `threadReply` で親子関係を表現する。
- 表示時刻はAsia/Tokyo。日付境界も同じtimezoneで決め、UTC日付の切替で別日に誤分類しない。
- 発言者表示名はPeople APIが返せる範囲で補完する。`contacts.readonly` では連絡先にない同僚名を取得できない場合があることをREADMEで説明し、取得不能時は秘密情報を推測せず、同一人物を追える安定した代替表示にする。
- 添付はcontent name、content type、source、利用者向け参照先等のメタデータだけを保存する。添付本文、サムネイル、Driveファイルを複製しない。
- 削除済みメッセージは本文を復元せず、APIが返す削除時刻・種別等のメタデータだけを扱う。

### 継続取得と設定間隔

| 表示する選択肢 | 30日換算の概算実行回数 | 実行の意味 |
|---|---:|---|
| 1時間ごと | 720回 | 毎時0分を避けて実行 |
| 3時間ごと（おすすめ・初期値） | 240回 | Chatworkと同じ既定推奨 |
| 6時間ごと | 120回 | 6時間ごとに実行 |
| 12時間ごと | 60回 | 12時間ごとに実行 |
| 手動のみ | 0回 | 自動実行なし |

- 新しい取得結果はmessage resource name単位で既存の日付ファイルへ統合し、再実行で重複させない。
- 同日に複数回取得しても、以前の投稿やスレッド返信を失わない。
- 編集・削除状態の反映は、その取得実行でAPIが返した範囲に限る。`createTime` による差分範囲より古いメッセージの編集・削除は反映されないことを正常仕様とし、取得済み本文をAPI応答から消えたことだけで削除しない。
- 全選択スペースが成功した場合だけ全体最終成功を進める。部分失敗はスペースごとの取得位置と再試行対象を保つ。
- scheduleのcommit・pushは設定時の明示同意後だけ。手動検索からのworkflowは実行直前に再確認する。

### 検索結果の状態

`/google-chat search` は結果を次のいずれかとして扱う。

- `found`: 保存済み履歴に一致し、スペース・日付・該当箇所を示せる。
- `not-found-locally`: 現在の保存済み履歴には一致しない。Google Chatに存在しないとは断定しない。
- `sync-declined`: ユーザーが取得を選ばなかった。
- `space-review-needed`: 対象スペースが未選択または通常スペースではない可能性がある。
- `reauthorization-needed`: OAuthまたは管理者設定のため最新性を確認できない。
- `sync-failed`: workflow失敗・timeout・API失敗で最新性を確認できない。
- `still-not-found`: 取得成功後も一致しないが、保持設定、API取得範囲、キーワード差、編集・削除等の可能性が残る。

### 確認付き再取得の状態遷移

1. repoの最新状態をpullする。
2. 保存済みGoogle Chat履歴を検索する。
3. `not-found-locally` の場合だけ、取得／中止／スペース見直しを構造化質問で確認する。
4. 承認時だけworkflowを開始し、完了を待つ。`reauthorization-needed` はworkflow再試行より先に再認証を案内する。
5. 成功確認後にpullし、同じ条件で再検索する。失敗・timeout時は検索結果を最新と見なさない。

## preferences.md v2

```markdown
## 基本
- 呼び方:
- お仕事・役割:
- 主に使うサービス:

## 言葉遣い
- 口調: 丁寧（標準） | フランク | きっちり敬語
- 専門用語: ふつう | ことば添え | そのままOK
- 報告の詳しさ: みじかく | くわしく
- 決定の確認: 都度 | まとめて

## 口調のお手本
- NG:
- OK:

## 秘書のメモ
```

既定値は、口調=丁寧（標準）、専門用語=ふつう、報告=みじかく（3行）、決定確認=都度。
`memory-tools.sh pref-set <セクション> <キー> <値>` は指定行だけを更新し、`memory-tools.sh pref-note-add <本文>` は秘書のメモに追記する。
設定変更前は例文プレビューで確認し、変更後はjournalへ `did` を追記して節目コミットする。

## 口調プリセットと役割の適用

- `standard`、`friendly`、`formal` の3プリセットを提供し、NG/OK例ペアを設定へ複写できる。
- 関西弁・執事風など濃いキャラクターは同梱しない。
- お仕事・役割は、営業なら商談メモ、講師なら講義資料、経営なら数字のまとめ、のように提案・例示・用語補足の題材へ使う。
- 毎セッション `preferences.md` を読み、output styleだけに依存しない。

## 成果物・外部根拠・コミット

- 単発成果物は `docs/YYYY/MM/YYYY-MM-DD_<title>.md`。一般PJの作業文書は当該PJ直下、確定版は `outputs/`、旧版は `archive/` に置く。frontmatterに `createdAt` と `tags` を持ち、1ファイル1トピック、見出しに固有名詞を入れる。
- 外部根拠はサービス名＋URL/ID＋日付で示し、本文を保存しない。
- 節目コミットのメッセージは何をしたか分かる日本語1行。初回pushと同意済みChatwork schedule以外の予期しないpushは確認する。

## `yasashii-harness` との境界

- `yasashii-secretary` の build は別repoプラグインの存在を確認し、未導入なら3コマンドで案内する。
- 開発PJを別repo正本にする場合、workspace側は参照ポインタだけを所有し、`yasashii-harness`側の仕様・判断・Sprint状態を複製しない。
- `yasashii-harness` が Planner / Generator / Evaluator、`gentle-overlay/`、sync健全性、独自回帰を所有する。
- `mtaiseeei/yasashii-harness` は独立public downstream repoで、GitHub API上 `fork=false`。GitHubのparent relationには依存しない。
- downstreamのremote topologyは、`origin=https://github.com/mtaiseeei/yasashii-harness.git`、読取専用の `upstream=https://github.com/mtaiseeei/agentic-harness.git`。fb9c303がdownstream HEADの履歴から到達可能でなければならない。
- 配布識別は marketplace `yasashii-harness` とplugin `harness` を組み合わせた `harness@yasashii-harness`。marketplace manifestは `repository=mtaiseeei/yasashii-harness`、pluginは `source=./plugins/harness`、plugin manifestの `repository` / `homepage` は `https://github.com/mtaiseeei/yasashii-harness` を指し、必要なCodex marketplace識別子も同じ配布元へ揃える。
- 上流由来行への例外は `gentle-overlay/metadata-overrides.json` に宣言した配布識別metadata fieldだけ。syncは期待値の完全一致とallowlist外変更0件を検査する。
- `yasashii-secretary` 側のoffline回帰は、案内・3コマンドの構造、同梱コピー・agents・旧ベースラインの不在を検査する。online検査はGitHub APIでrepo実在、public、owner/name、`fork=false`、remote manifestのname / source / repository / homepageと3コマンドの整合を確認する。
- ネットワーク不可はonline検査のPASSにしない。offline構造検査の成功と、Evaluatorが取得するonline証跡を別結果として記録する。
- 上流へ返す変更は `yasashii-harness` から直接送らず、`agentic-harness` 側の別branch / PR手順に分離する。

## secretary edition

### EditionId

- `agentic-secretary`
- `yasashii-secretary`

editionは外部plugin IDとworkspace保護の識別に使う。workspace root `secretary/` やskill／command名はedition値にしない。

### WorkspaceEditionState

| 状態 | 条件 | 動作 |
|---|---|---|
| `new` | marker／ledgerなし | 導入editionのneutral markerとedition付きledgerを作成可能 |
| `same-edition` | marker／ledgerが導入editionと一致 | 通常のdiagnose／updateを許可 |
| `legacy-yasashii` | legacy markerまたは旧ledgerだけでyasashiiと一意判定 | yasashiiとして互換読取し、確認済みmigrationだけ許可 |
| `opposite-edition` | 反対editionを一意検出 | 副作用0件で停止 |
| `mixed` | 両editionの痕跡がある | 副作用0件で停止 |
| `unknown` | editionを安全に一意判定できない | 副作用0件で停止 |

neutral markerはmarker versionとEditionIdを持つ。update ledgerは `schemaVersion`、`edition`、既存のversion／保護／migration情報を持つ。
反対editionの情報を現在editionへ書き換えず、将来の明示的migrationが追加できる余地だけを残す。

### EditionConfig

edition configは配布識別子、repository、CHANGELOG／配布URL、ledger path、session directory、保護commit prefix、
Harness導線、4面の可変copyをまとめる。値を取得できない場合は暗黙のyasashii fallbackをせず停止する。
wizard copy、OAuth scope、workspace path、skill／command、migration filenameはconfig対象にしない。

### PluginPathCompatibility

- 新しい正本: `plugins/secretary/CHANGELOG.md`
- legacy read URL: `plugins/yasashii-secretary/CHANGELOG.md`
- invariant: 両fileのbytesとversion entryが一致する

legacy fileはredirectの説明だけに置き換えない。正本と同じ `0.8.0` entryを持つ完全なraw互換contentとし、
`0.7.0` の過去entryは書き換えない。このfile一致だけで旧0.7.0 updaterのlive互換を合格とはみなさない。

### RepositoryTopology

- upstream checkout: `/Users/taisei/workspace/agentic-secretary`
- upstream GitHub repo: `mtaiseeei/agentic-secretary`
- downstream checkout: `/Users/taisei/workspace/yasashii-secretary`
- downstream GitHub repo: `mtaiseeei/yasashii-secretary`
- relation: 共通祖先を持つ別repo。monorepo／subdirectoryではない
- downstream remote: `upstream` fetch enabled、push disabled

directory／repo作成、remote変更、push、公開は該当Sprintでユーザーが明示許可するまで未実行状態を正常とする。

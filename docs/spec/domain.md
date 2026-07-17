# Domain

本製品のドメインはDBではなく、1つのGitHub repoにある秘書・一般プロジェクト・Chatworkと、別repo開発プロジェクトの関係、
`secretary/` の記憶の意味、外部データを記録へ移す規則である。

## 主要概念

| 概念 | 意味 | 正本／置き場 |
|---|---|---|
| 秘書 | 記憶・整理・下調べ・成果物・開発導線を担うAI役割 | `yasashii-secretary` skills |
| public配布repo | plugin配布ソースと公開ドキュメントの正本。利用者データやChatwork live環境は置かない | `yasashii-secretary` |
| ユーザーワークスペース | 秘書・一般プロジェクト・Chatworkをまとめるprivate GitHub repo | repo root |
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
└── <GitHub Actionsの同期設定>
```

具体的なChatwork用ファイル名はGeneratorが決めるが、設定・状態・履歴は役割を分ける。
Chatwork専用repoやsecretary専用の永続ローカルrepoは作らない。`10_sources/` に相当する汎用外部データ同期層も作らない。
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
- test workspaceも実利用時と同じく、pluginの利用設定・生成物、`secretary/`、通常project、Chatwork設定・workflow・同期状態・履歴を1つのrepoに置く。public配布ソース自体の複製は要求しない。
- Chatwork専用repo、Secret専用repo、履歴だけのrepoへ分割しない。

### 開始条件

次がすべて揃った場合だけlive gateを開始できる。

1. ユーザーがprivate test workspaceの作成、Repository Secret設定、workflow dispatch、remote push、Chatwork API送信を明示許可している。
2. test用tokenがRepository Secretへ登録でき、token値をrepo本文や証跡へ出さない。
3. 個人情報・業務本文を評価対象にしない非機密test roomが準備されている。
4. test workspaceがprivateで、評価に必要な共同編集者とActions権限だけを持つ。

開始条件が欠ける場合は `external-live-gate-unavailable` として未検証にする。Sprintは不合格だが、
合成fixtureの失敗や実装不具合とは扱わない。条件が整った後に同じEvaluator gateを再実行する。

### 伏せ字証跡

証跡に残せるのは、private状態、Repository Secret名の存在、workflow run ID／状態、取得room件数、
選択test roomの伏せ字識別子、取得件数、commit hash、push／pull成功、検索結果状態である。
token値、不要なroom名、Chatwork本文、業務固有名詞は残さない。

### 後始末

- 評価終了後はscheduleを停止し、Repository Secretを削除し、test roomの選択を解除する。
- workflow、取得履歴、test workspaceを残す必要がある場合は、目的・保持期間・閲覧者をユーザーへ示す。
- repoや履歴の削除・archiveは別の破壊的操作として、対象と影響を示した後の明示確認でだけ行う。

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
| 1時間ごと（おすすめ） | 720回 | 毎時17分を起点。既定推奨 |
| 3時間ごと | 240回 | 3時間ごとの17分を起点 |
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

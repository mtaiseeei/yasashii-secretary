# Spec Index

`yasashii-secretary` は、Claude Codeを使う非エンジニア一般向けのAI秘書プラグイン（Claude Code plugin / public / MIT）。
2026-07-15 の製品方針転換は `docs/proposal-2026-07-15-realignment.md` を基礎とし、
2026-07-16 にユーザーが承認した **single-repo Git-first + Chatwork** の追加方針は本 spec 群を正本とする。
2026-07-17 に承認された **開発以外も含むプロジェクト管理** は、同じprivate workspace内の一般プロジェクトと、
必要に応じて別repoを正本にする開発プロジェクトを分けて扱う。
同日に承認された **非エンジニアが安心して使える更新体験** は、まず変更点と影響を読むだけの診断を行い、
別Sprintで明示確認後だけ保護・更新・移行・検証・復元へ進む二段階とする。
同日に承認された **Google Chatの高度な接続** は、各利用組織が所有するGoogle Cloudプロジェクトと
ユーザーOAuthを使い、選択した通常スペースだけをChatworkと同じprivate workspaceへ同期する。
Google Cloudの準備は、ローカル設定wizardではなくAIとの会話が担当する。Google公式CLIの `gcloud` で
安全に進められるところまで支援し、Google画面で本人操作が必要な工程は、対象Projectを指定した直接リンクと
一画面一操作の案内で進める。接続用JSONを取得した後だけlocal wizardを開く。
2026-07-18 の配布前監査では、HighからLowまでの全指摘を配布前に解消し、公開版を `0.7.0` とする方針が承認された。
自動回帰だけでなく、専用private test workspaceでChatwork／Google Chat／OAuth／Repository Secret／GitHub Actions／
commit・push／検索／後始末を実行するlive gateを正式な合格条件とする。
2026-07-19 に、secret安全性の保証境界を確定した。Google ChatのOAuth実値はlocal wizard sessionのmemoryから
`gh` のstdin経由でRepository Secretへ直接登録する。Chatwork API Tokenはwizardが取得・受領・登録せず、F24の既存導線どおり
利用者本人がGitHubのRepository Secret画面へ直接入力する。両サービスともRepository Secretを正本とし、通常フローの
repo・Git履歴・ログ・製品側DOM・会話へ実値を残さない。commit前scannerは、製品が生成・管理するworkflow／config／history、
初回publish inventory、通常のliteral assignment等の合理的な誤混入を止めるdefense-in-depthである。
利用者が意図的に特殊構文・難読化・computed／escaped key・偽placeholderを作るケースまで完全検出する万能parserはスコープ外とする。
追加方針と衝突する旧記述（外部同期なし、ローカルだけ、Web UIなし、pushなし）は本 spec の範囲で上書きされる。
2026-07-20 に、現在の製品を共通基盤から2つの完成品へ分ける方針が承認された。技術者・AI活用に慣れた利用者向けの
`agentic-secretary` を上流、現在の非エンジニア向け体験を保つ `yasashii-secretary` を下流とする。
共通基盤の内部pathは `plugins/secretary/` とし、両edition（製品版）は同じGit履歴と共通祖先を持つ。
この関係、editionごとの差分、互換条件、公開gateの正本は `docs/spec/editions.md` とする。
同日、Sprint 032のlive診断後、2 edition完成品をまだ利用者へ明示配布していないことを前提に、
既存0.7.0利用者向けの複雑なexternal recovery／bootstrapを作らず、最初の明示配布候補を `0.8.0` へ直接揃えると決定した。
`0.7.0` のrelease記録・fixture・Git履歴は不変で、旧scannerの停止をfixture除外や安全scan弱体化で隠さない。
旧0.7.0からのlive update成功は配布条件として主張せず、同一versionとdowngradeは副作用0件で停止する。
さらにRepo分割前に、両editionの全ユーザー会話へ過不足ない改行・段落・Markdown箇条書きを必須適用し、
Chatwork wizardのGitHub Actions Secret登録で `Name` 欄と `Secret` 欄の入力内容を具体的に示す方針を確定した。
同日、`agentic-secretary` を技術者向けにそのまま配布できる完成品とし、正式な必須対象環境を
Claude Code Desktop App／Claude Code CLI／Codex App／Codex CLIの4つとする方針を確定した。その他のコーディングエージェントは
共通本体を再利用しやすくする設計対象に留め、公式受入・配布保証・実環境検証の必須対象にしない。共通本体はホスト非依存の
1実装とし、manifest・導入・更新・plugin root・実会話runner等のホスト固有部分だけをadapterへ分け、対応対象ホストと
検証済みホストを別集計する。Repo分割前のSprint 032 Patch 002では、一般回答を固定3項目へ押し込まない分離、
実会話回帰の安全化と誤合格解消、wizard進捗一貫性、serializer正本の明確化、ホスト非依存の会話・テスト層を確定した。
2026-07-21 にOpenAI公式のCodex plugin仕様とCodex CLI 0.144.6を再確認し、Codex App／Codex CLIの
共有配布は `.codex-plugin/plugin.json` とmarketplaceを正規面とする方針へ改訂した。repo-localの
`.agents/skills`、`AGENTS.md`、`config.toml` はauthoring・局所利用・補助設定には使えるが、
技術者へそのまま配布する完成品の代替にはしない。既存のClaude用 `.claude-plugin` 配布は維持し、
Codex用manifestも同じ `plugins/secretary/skills/` の共通本体を参照する。Codexがrootの
`.claude-plugin/marketplace.json` をlegacy互換として読める事実は回帰対象に残すが、その互換成功だけを
Codex正式配布のPASS根拠にしない。
同日、Sprint 033の受入を実用的な出荷判断へ再整理した。private `origin/main` のcommit `4670438` を完成候補とし、
同じcurrent bytesで既に取得した4 host固有の実会話4/4、正式manifest／marketplace、version・identity・skill、
会話Markdown、wizard、workspace変更0件、Secret露出0件、回帰・archive・validatorを再利用可能な証拠として認める。
schema v2／v3のproduction collector／driver／attestorは製品必須要件ではなく、将来のoptional internal QAとする。
これは品質基準を下げる変更ではない。製品の動作・安全性・配布整合を直接示す証拠は維持し、製品出荷に不要な
証明基盤だけをNon-scopeへ戻す。fresh Evaluatorはcandidateと既存証拠の整合を確認し、必要な軽量再確認だけを行う。
同日、`agentic-harness` と `yasashii-harness` のGitHub `main` がともに `0.5.0` へ更新されたことを受け、
2 editionのSecretaryも対応Harnessへの識別、導入確認、ホスト別の接続案内、repo内runtime設定・運用ガイダンス、
互換回帰を `0.5.0` へ揃えてから最終公開判定する方針を確定した。Harness本体は引き続き別Plugin／別Repoの正本であり、
Secretaryへskills、agents、runtime実装、Git履歴をmerge、vendor、submodule、symlink、コピーのいずれでも内包しない。
`agentic-secretary` はGitHub上の `mtaiseeei/agentic-harness`、`yasashii-secretary` は
`mtaiseeei/yasashii-harness` を参照し、ローカル `/Users/taisei/workspace/agentic-harness` はread／list／statusを含め全面非接触とする。

## ひとことで

**1つのprivate GitHub repoで、秘書・一般プロジェクト・選択したチャットの文脈を一緒に育て、後から探せる秘書。**
記憶、成果物、営業・マーケティング・新規事業等の一般プロジェクト、選択したChatwork roomとGoogle Chatスペースの履歴は同じrepoでGit管理する。
`yasashii-secretary` 自体はpublic配布repoであり、利用者のデータやチャット同期workflowを置く場所ではない。
Gmail等の公式コネクタは従来どおり都度参照し、Chatworkと明示設定済みGoogle Chatだけを承認済みのGitHub Actions同期対象とする。
開発依頼は別リポジトリ `yasashii-harness` への参照導線から、規律を緩めない Planner → Generator → Evaluator のループへ接続する。
開発プロジェクトを別repoへ分ける場合、private workspace側には概要と正本repoへの参照ポインタだけを持つ。

## 製品テーマ

| ID | テーマ | 達成の要点 |
|---|---|---|
| G1 | 話すだけで記録が整う | 三層記憶、シーム副作用、節目確認、決定的な `timeline` |
| G2 | 100人100通りの秘書 | `settings`、`preferences.md` v2、既定値＋明示的な opt-in 上書き |
| G3 | やさしいハーネスの分離と追随 | `yasashii-harness` を独立downstreamの別リポジトリ正本にし、`upstream` remoteからの追随を反復可能にする |
| G4 | やさしさの再定義 | 言葉遣い・報告・先回り提案はやさしくし、規律・役割分離・評価閾値は緩めない |
| G5 | 1 repoでChatworkまで読める | 各利用者のsingle private workspaceで、repo作成・初回push、room選択、GitHub Actions同期、`/chatwork`検索を一続きにする |
| G6 | 継続する仕事をプロジェクトにする | 複数行動・複数セッションの仕事を候補として検出し、確認後にライト→フルで整理する。開発repoの正本分離も保つ |
| G7 | 配布チャネルに依存しない | 特定の講座・期・教材を前提にせず、一般の非エンジニアが単独で導入・利用できる公開面に揃える |
| G8 | 安心して更新を続けられる | 現在版・最新版・変更点・影響を先に説明し、明示確認後だけカスタマイズを守って更新・検証・復元できるようにする |
| G9 | Google Chatを安全に蓄積する | AI支援で各社所有のGoogle Cloudプロジェクトを準備し、ユーザーOAuth、選択した通常スペース、同意済みGitHub Actionsまでを一続きにする |
| G10 | 公開済み0.7.0の安全基準を維持する | secret・Git・symlink・OAuth・履歴・更新・回帰・UXを監査指摘0件まで閉じた基準と、専用private test workspaceのlive gate・後始末を次候補でも回帰させない |
| G11 | 2つの完成品を安全に育てる | `agentic-secretary` を上流、`yasashii-secretary` を狭いoverlayの下流とし、共通安全性・Git系譜・0.8.0配布準備・会話可読性・edition衝突停止を守る |

## 詳細仕様

| ファイル | 内容 |
|---|---|
| [product.md](spec/product.md) | 目的、対象ユーザー、G1〜G11、成功状態、非ゴール |
| [features.md](spec/features.md) | F01〜F51 とユーザーから見た振る舞い |
| [constraints.md](spec/constraints.md) | 安全・記憶保護・secret・single private repo・同期同意などの不変条件 |
| [domain.md](spec/domain.md) | 三層記憶、一般／開発プロジェクト、更新台帳、timeline、Chatwork／Google Chatの取得・検索状態、時刻・索引・Git規約 |
| [ui.md](spec/ui.md) | 対話UX、更新の説明と確認、プロジェクト候補確認、Chatwork／Google Chat wizardの簡潔な日本語、3行報告、先回り提案 |
| [rubric.md](spec/rubric.md) | ゼロ許容基準、browser・OAuth・secret・実API、やさしさを含む評価方法 |
| [editions.md](spec/editions.md) | agentic／yasashiiの上下流関係、共通面、edition差分、識別子、互換・overlay・公開gate |

## スプリント

進行状態の正本は `docs/sprints/state.md`（オーケストレーターのみが更新）。
2026-07-15 の方針転換後は次の順序で進める。

| スプリント | 主眼 | 依存 |
|---|---|---|
| [sprint-008](sprints/sprint-008.md) | 配布物の再編、改名、`yasashii-harness` 分離、section 12 復旧 | 最優先 |
| [sprint-009](sprints/sprint-009.md) | G1 配管: journal、シーム副作用、topics、TODO、reindex、固定時刻 | sprint-008 |
| [sprint-010](sprints/sprint-010.md) | G1 体験: timeline、節目プロトコル、朝夕・daily 統合、ルーター | sprint-009 |
| [sprint-011](sprints/sprint-011.md) | G2: 先行規約改訂後に settings / preferences v2 / tones | sprint-010 |
| [sprint-012](sprints/sprint-012.md) | G1 仕上げ: 週次ふりかえり、索引退避運用、条件付き追加 | sprint-011 |
| [sprint-013](sprints/sprint-013.md) | G5 接続: single repo、private repo初回push、secret案内、room選択wizard、初回取得、基本検索 | sprint-012 |
| [sprint-014](sprints/sprint-014.md) | G5 運用: 定期同期、設定変更、確認付き手動同期、専用private test workspaceでの実API評価、配布仕上げ | sprint-013 |
| [sprint-015](sprints/sprint-015.md) | G6: プロジェクト候補検出、確認、一般PJのライト→フル運用、別repo開発PJの参照ポインタ | sprint-014-patch-001 |
| [sprint-016](sprints/sprint-016.md) | G7: 旧配布チャネル固有表現を現行正本・公開面・配布物から除去し、一般の非エンジニア向けへ統一 | sprint-015 |
| [sprint-017](sprints/sprint-017.md) | G8前半: version整合、CHANGELOG、最小台帳、更新案内と完全な読み取り専用診断 | sprint-016 |
| [sprint-018](sprints/sprint-018.md) | G8後半: 明示確認後だけ行う保護commit、更新、冪等migration、検証、rollback | sprint-017 |
| [sprint-019](sprints/sprint-019.md) | G9接続: 各社所有Cloud project、OAuth、通常スペース選択、初回取得、基本検索、README高度設定 | sprint-018 |
| [sprint-020](sprints/sprint-020.md) | G9運用: 3時間推奨の定期同期、設定変更、確認付き再同期、再認証、実API評価 | sprint-019 |
| [sprint-020-patch-001](sprints/sprint-020-patch-001.md) | Chatwork／Google Chat共通wizard: More Simpleな日本語、1画面1判断、技術詳細の段階表示、理解テスト | sprint-020 |
| [sprint-020-patch-002](sprints/sprint-020-patch-002.md) | Google ChatのCloud準備をAI会話へ分離: `gcloud`支援、直接リンク、JSON取得後からのwizard | sprint-020-patch-001 |
| [sprint-021](sprints/sprint-021.md) | G10安全性1: secret検査とGit変更範囲の完全分離 | sprint-020-patch-002 |
| [sprint-022](sprints/sprint-022.md) | G10安全性2: symlink境界、削除対象、外部処理timeout | sprint-021 |
| [sprint-023](sprints/sprint-023.md) | G10安全性3: OAuth callbackとloopback wizardのsession保護 | sprint-022 |
| [sprint-024](sprints/sprint-024.md) | G10データ保護: Google Chat履歴とActions runの因果整合 | sprint-023 |
| [sprint-025](sprints/sprint-025.md) | G10更新配布: `0.6.0`→`0.7.0`とplugin／workspace両方の復元 | sprint-024 |
| [sprint-026](sprints/sprint-026.md) | G10回帰: 全受入済み回帰を束ねるportableな配布前gate | sprint-025 |
| [sprint-027](sprints/sprint-027.md) | G10仕上げ: focus、操作領域、README／onboarding／`.mcp.json`整合 | sprint-026 |
| [sprint-028](sprints/sprint-028.md) | G10最終判定: 自動回帰＋専用private test workspace live gate＋後始末 | sprint-027 |
| [sprint-029](sprints/sprint-029.md) | edition分離準備: 安全・証拠・文体ruleの分離と可変copy集約 | sprint-028 |
| [sprint-030](sprints/sprint-030.md) | edition識別: 設定、neutral marker、legacy認識、反対edition停止 | sprint-029 |
| [sprint-031](sprints/sprint-031.md) | 共通path: `plugins/secretary/`、旧CHANGELOG互換、回帰／release gate更新 | sprint-030 |
| [sprint-032](sprints/sprint-032.md) | 未配布段階の0.8.0 release preparation: candidate整合、新規導入、portable gate、旧blockerの正直な記録 | sprint-031 |
| [sprint-032-patch-001](sprints/sprint-032-patch-001.md) | Repo分割前の共通改善: 全会話のMarkdown可読性、Chatwork Secretの `Name`／`Secret` 入力案内 | sprint-032 |
| [sprint-032-patch-002](sprints/sprint-032-patch-002.md) | 会話改善の完成: 一般回答の固定3項目非強制、実会話回帰の安全化・誤合格解消、wizard進捗一貫性、serializer正本、ホスト非依存の会話・テスト層 | sprint-032-patch-001 |
| [sprint-033](sprints/sprint-033.md) | 上流版: `4670438` を完成候補として、Claude／Codex正式配布面、4 host固有の実機smoke、0.8.0／identity／skill、会話・wizard、安全性、更新手順、全回帰を実用的な出荷証拠で受け入れる | sprint-032-patch-002 |
| [sprint-034](sprints/sprint-034.md) | 下流版: `yasashii-secretary` の狭いoverlayと同期回帰、yasashii限定の `key=value` 表現改善 | sprint-033 |
| [sprint-035](sprints/sprint-035.md) | 最終判定: 2 editionのparity、安全性、系譜、対応Harness 0.5.0互換、公開gate | sprint-034 |
| [sprint-035-patch-001](sprints/sprint-035-patch-001.md) | 下流同期: 共通wizardのIME安全な検索を取り込み、Yasashii固有copy／identityを保持 | sprint-035 |

既存 sprint-001〜006 と各 patch の契約・progress・feedback は履歴として保持する。
sprint-007 は製品方針転換で白紙化され、旧計画と実装は `backup/sprint-007-010-plan` に退避済みである。

## 最優先の不変条件

1. `~/workspace/agentic-harness` は全面操作禁止。編集、checkout、commit、branch、remote変更、生成物作成、複製元利用、当該checkoutを対象にしたコマンド実行を行わない。上流参照はGitHubだけを使う。
2. 外部データ同期の例外は、ユーザーが選択したChatwork roomとGoogle Chatの通常スペースを同じprivate repoへ保存する、明示同意済みのGitHub Actionsだけ。その他は公式コネクタで都度参照する。
3. 記憶は空上書き禁止・削除2段階・`MEMORY.md` 索引追従。journal の無確認追記は定義済みシーム副作用だけ。
4. 初回のprivate repo作成・初回pushはオンボーディングの必須成果。Chatworkのschedule pushは設定時の明示同意後だけ許可し、予期しない手動同期は実行直前に確認する。
5. 一般技術用語はそのまま使う。過度な平易化や幼稚なメタファーは禁止。
6. やさしさのために、6規律、3 Agent 分離、評価閾値、C系ゼロ許容を緩めない。
7. `yasashii-harness` で上流由来行を変えられる例外は、宣言的allowlistに列挙した配布識別metadataだけ。plugin本体名 `harness` を維持し、`harness@yasashii-harness` で導入できる整合を守る。
8. Chatwork API TokenはGitHub Actions Repository Secretだけに保存し、repo本文、設定、ログ、fixture、スクリーンショットへ出さない。
9. Chatwork APIの最新100件制約を明示し、導入前の履歴が存在しない状態を正常として扱う。「見つからない」を即座に「存在しない」と断定しない。
10. public配布repoにはChatworkのRepository Secret、同期workflow、room設定、履歴を置かない。実API評価は、実利用時と同じsingle-repo構成の専用private test workspaceでだけ行う。
11. private test workspaceの作成、Secret設定、workflow dispatch、push、Chatwork API送信はexternal live gateであり、その操作へのユーザー明示許可と、test用token・非機密test roomの準備を必須とする。準備が無ければ合成fixtureで代替せずSprint不合格とし、実装不具合とは区別する。
12. プロジェクト候補は自動作成せず、ユーザー確認後だけ `secretary/projects/` に作る。一般プロジェクトは同じprivate workspace内を正本とし、別repo開発プロジェクトは正本を複製せず参照ポインタで接続する。
13. 現行正本・公開面・配布物は特定の講座・期・教材を利用前提にしない。一般の非エンジニア向け表現へ揃え、既存のMIT、クレジット、`forkedFrom`、機能、Git履歴は維持する。
14. 更新は「説明」と「実行」を分ける。診断中はplugin、workspace、Git、設定を一切変更せず、実更新は変更点・影響・衝突可能性・復元方法を示した後の明示確認でだけ行う。
15. Google Chatは各利用組織が所有するGoogle Cloudプロジェクトの`Internal` OAuthを使う。共通の外部向けOAuthアプリ、サービスアカウント、DM／グループDM、投稿・編集・削除、添付ファイル本文の取得は扱わない。
16. Google OAuthの厳格secret（client secret、認可コード、access token、refresh token、OAuth client JSON全文）は永続物へ残さない。client IDは識別子として扱い、認可中の一時URLと管理者チェックリストだけで表示できるが、tracked file、Git差分・履歴、ログ、journal、fixture、スクリーンショット、評価証跡、再読込後も残るDOMへ保存しない。
17. ChatworkとGoogle Chatは1つの共通wizard骨格を使い、全画面で対象サービス名を明示する。primary CTAの背景色はChatwork `#F03747`、Google Chat `#11BB62` とし、両サービスの推奨・初期同期間隔を3時間に揃える。
18. Chatwork／Google Chat wizardの主導線は「今すること」1文、1画面1判断、1段落1要点に絞る。内部用語は判断に必要な正式名称を除いて主説明から外し、安全同意の意味は短く分けて必ず残す。
19. 詳細は開閉可能と見た目・支援技術の両方で分かるようにする。Google ChatのCloud準備はskill会話が担当し、`gcloud`で可能な工程と、本人が直接リンクから操作する工程を分ける。local wizardは接続用JSONの選択から開始し、スペース・間隔・保存内容を1回確認して初回取り込みと自動取得設定を同じ確定操作で完了し、完了画面は終了だけをprimaryにする。
20. 配布、設定、記憶、更新のcommitは各操作が所有する変更だけを対象にし、既存stageや隣接領域を混ぜない。commit／push前のsecret検査は、製品管理対象と初回publish inventoryにあるGoogle OAuth client JSON、private key、known token field、通常のliteral assignment等の合理的な誤混入を拒否する。`${{ secrets.NAME }}` 等の正規参照と通常文書は許可し、意図的難読化の完全検出を保証しない。
21. 書込みの許可rootは、現在確認済みのworking rootごとに定める。秘書workspaceから外部repoへ向くsymlink越しの書込みは拒否する一方、確認済みの開発repoをそのrepo自身のworking rootとして開いた通常の開発ではrepo内へ書き込める。symlink削除は参照先ではなくlink自体だけを対象にし、外部CLI・HTTPは有限時間で終了してtimeoutを成功として扱わない。
22. loopback wizardは同一session・同一originの正当な操作だけを受け付け、OAuth callbackは一度だけ処理する。Google Chat本文が内部Markdown markerに似ていても履歴の欠落・改変を起こさない。
23. 公開済み版は `0.7.0` で不変とし、そのmanifest、migration、fixture、評価記録、Git履歴を書き換えない。次のrelease candidate／最新版は `0.8.0` とし、候補配布面のversionを一致させる。既存 `0.6.0 → 0.7.0` の履歴回帰も保持する。
24. 配布可否はmaster回帰、Git archive相当の `.git` なし環境、専用private test workspaceのChatwork／Google Chat live gate、Secret・schedule・OAuthの後始末がすべて合格した場合だけ `ready` とする。
25. `agentic-secretary` と `yasashii-secretary` は切替機能や同居機能を持たない。別editionの台帳またはmarkerを検出した場合は、移動・統合・上書きをせず安全に停止する。
26. 旧 `0.7.0` が参照する `plugins/yasashii-secretary/CHANGELOG.md` はraw CHANGELOGの長期互換pathとして残し、新しい正本CHANGELOGと常にbyte単位で同一にする。最初の明示配布候補は `0.8.0` とし、新規導入とportable gateを必須にする。未検証の旧0.7.0 live updateを成功扱いせず、same-version bridgeは作らず、同一版とdowngradeは副作用0件で停止する。
27. 共通の安全性・証拠・Chatwork／Google Chat wizardは上流所有とし、edition差分は会話文体、診断説明、報告形式、developer handoffに限る。wizardのcopy、scope、OAuth、同期、安全条件をedition別に分岐させない。
28. `agentic-secretary` の外部repo作成、remote変更、push、公開、release、実plugin install／updateは、その操作ごとのユーザー明示許可がある場合だけ行う。validator結果を得る前に `forkedFrom` を推測して変更しない。
29. 両editionの全ユーザー会話は、複数要素を改行なしの平文へ詰め込まず、必要な空行・段落・Markdown箇条書きで読みやすくする。この最低基準はpreferencesで無効化せず、過剰な見出しや1文ごとのbulletも避ける。
30. Chatwork wizardはGitHub Actions Secret追加画面で、`Name` 欄へ `CHATWORK_API_TOKEN`、`Secret` 欄へ本人がChatwork公式画面で取得したAPI Tokenを入力すると示す。Token実値をwizard／会話へ貼らせない。
31. 正式対象ホストはClaude Code Desktop App／Claude Code CLI／Codex App／Codex CLIの4つ。共通本体はホスト非依存の1実装とし、host固有はadapterに限る。対応対象ホストと検証済みホストを別集計し、1ホストPASSを全ホストPASSへ昇格させず、未検証環境を「対応済み」と表示しない。
32. 実会話runnerの子プロセスenvはallowlist方式で資格情報を渡さず、原則Bashなしの最小ツール許可、一時workspace内fixtureだけの境界テスト、成功・失敗両方のcleanup、サニタイズ済み証跡を守る。完了・状態報告は固定3項目の存在と順序を必須にし、一般回答へ固定3項目を強制せず、圧縮された一般回答を不合格にする。

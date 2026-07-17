# Spec Index

`yasashii-secretary` は、ゆるAIコーディング塾の非エンジニア受講者向けAI秘書プラグイン（Claude Code plugin / public / MIT）。
2026-07-15 の製品方針転換は `docs/proposal-2026-07-15-realignment.md` を基礎とし、
2026-07-16 にユーザーが承認した **single-repo Git-first + Chatwork** の追加方針は本 spec 群を正本とする。
2026-07-17 に承認された **開発以外も含むプロジェクト管理** は、同じprivate workspace内の一般プロジェクトと、
必要に応じて別repoを正本にする開発プロジェクトを分けて扱う。
追加方針と衝突する旧記述（外部同期なし、ローカルだけ、Web UIなし、pushなし）は本 spec の範囲で上書きされる。

## ひとことで

**1つのprivate GitHub repoで、秘書・一般プロジェクト・Chatworkの文脈を一緒に育て、後から探せる秘書。**
記憶、成果物、営業・マーケティング・新規事業等の一般プロジェクト、選択したChatwork roomの履歴は同じrepoでGit管理する。
`yasashii-secretary` 自体はpublic配布repoであり、利用者のデータやChatwork同期workflowを置く場所ではない。
Gmail等の公式コネクタは従来どおり都度参照し、Chatworkだけを承認済みのGitHub Actions同期対象とする。
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

## 詳細仕様

| ファイル | 内容 |
|---|---|
| [product.md](spec/product.md) | 目的、対象ユーザー、G1〜G6、成功状態、非ゴール |
| [features.md](spec/features.md) | F01〜F28 とユーザーから見た振る舞い |
| [constraints.md](spec/constraints.md) | 安全・記憶保護・secret・single private repo・同期同意などの不変条件 |
| [domain.md](spec/domain.md) | 三層記憶、一般／開発プロジェクト、timeline、Chatwork取得・検索状態、時刻・索引・Git規約 |
| [ui.md](spec/ui.md) | 対話UX、プロジェクト候補確認、Chatwork wizard、添付デザイン言語、3行報告、先回り提案 |
| [rubric.md](spec/rubric.md) | ゼロ許容基準、browser・secret・実API、やさしさを含む評価方法 |

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

既存 sprint-001〜006 と各 patch の契約・progress・feedback は履歴として保持する。
sprint-007 は製品方針転換で白紙化され、旧計画と実装は `backup/sprint-007-010-plan` に退避済みである。

## 最優先の不変条件

1. `~/workspace/agentic-harness` は全面操作禁止。編集、checkout、commit、branch、remote変更、生成物作成、複製元利用、当該checkoutを対象にしたコマンド実行を行わない。上流参照はGitHubだけを使う。
2. 外部データ同期の例外は、ユーザーが選択したChatwork roomを同じprivate repoへ保存するGitHub Actionsだけ。その他は公式コネクタで都度参照する。
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

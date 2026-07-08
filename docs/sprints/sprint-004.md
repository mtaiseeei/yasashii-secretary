# Sprint 004 — 接続拡張（Microsoft / Notion / 診断）

- Phase: P2（接続拡張）
- 主眼: Google 以外の第一級/任意コネクタ（Microsoft 365・Notion）を、sprint-003 の setup-google で確立したパターンの横展開として追加し、どのコネクタが繋がっているかを診断できるようにする。
- 依存: sprint-001〜003（＋各 patch）。特に sprint-003（setup-google の接続ガイド様式）／sprint-002（`_resume.md`）／sprint-003-patch-001（封じ込め・秘密非履歴化・配布 SKILL の同梱内参照 等の恒久不変条件）。

## なぜこのスプリントか

sprint-003 で Google 接続と「今日やること」が動くようになった。sprint-004 は、同じ接続体験を Microsoft 365 に広げ、Notion を任意で足し、「どれが繋がっていて、繋がっていないものはどう直すか」を一目で分かる診断を用意する。非エンジニアにとっての価値は「自分の使っているサービスでも同じように秘書が使える」「不調のとき何をすればいいか分かる」。コネクタは**同期せず都度参照**の原則を維持する。

## スコープ（含む）

### 1. setup-microsoft スキル（F11）
- `plugins/cc-secretary/skills/setup-microsoft/SKILL.md`（frontmatter 有効・`name` 一意・ルーターから `${CLAUDE_PLUGIN_ROOT}` 相対で段階ロード）。
- **公式リモートコネクタ前提**: Microsoft 365 を、**Claude 側の設定画面からの公式コネクタ接続**（OAuth 自動）で繋ぐ手順。**Azure Portal / Azure AD の手作業（アプリ登録・API アクセス許可・クライアントシークレット発行）は案内しない**。
- **接続確認テスト**: 接続後に軽く疎通確認（例: 予定またはメールを1件読めるか）。失敗時は英語エラーをそのまま出さず「何が起きて・どうすれば直るか」に言い換える（「実エラーで原因確定してから案内」）。
- **再起動しおり連携**: 設定は Claude 再起動を挟むことがあるため、設定前に `secretary/memory/_resume.md`（sprint-002 のしおり）へ「今 Microsoft 接続の途中」という文脈を書き出し、再開時に続きから案内する。

### 2. Notion 接続（F12・任意扱い）
- `plugins/cc-secretary/skills/setup-microsoft/` とは別に案内できる、**任意機能**としての Notion 接続導線（`mcp.notion.com`、OAuth 自動）。配置は Generator 裁量（専用 SKILL でも接続診断内の一節でも可）だが、段階ロード・`${CLAUDE_PLUGIN_ROOT}` 相対を守る。
- **任意であることを明示**: 使わない人が素通りできる。**Notion 未接続でも他機能（daily・記憶・Google/Microsoft 接続）を壊さない**。
- 接続確認テスト＋英語エラー言い換えは setup-google/microsoft と同じ様式。

### 3. 接続診断（F13）
- 複数コネクタ（Google / Microsoft / 任意 Notion）の**接続状態を確認して一覧提示**する導線。
- **診断の型**（cc-company から継承）: 状態を推測で断定せず、**実エラーで原因を確定してから**、日常語で「何が起きて・どうすれば直るか」を案内する。
- 未接続のコネクタは「まだ繋いでいません。繋ぐには setup-google / setup-microsoft へ」と、対応する接続導線に橋渡しする。
- 報告は3行型（状態の要約／気になる点／次にやること）。

### 4. ルーターへの組み込み
- `skills/secretary/SKILL.md` に、Microsoft 接続（Microsoft / Outlook / Teams / 接続 等）・Notion 接続・接続診断（繋がってる？／調子／診断 等）のモード判定を追加し、`${CLAUDE_PLUGIN_ROOT}` 相対で段階ロード。

## スコープ外（このスプリントでやらない）

- **国内チャット（Chatwork / LINE 等）**: 公式リモート MCP がなく自作ラッパーが必要なため**初期スコープ外**（`docs/spec/constraints.md`・DESIGN.md 準拠）。
- やさしいハーネス・build → sprint-005 / 公開 README・docs → sprint-006。
- daily への Microsoft/Notion データ統合の作り込み（daily は sprint-003 の設計を維持。必要なら別スプリント）。

## 受入基準（この契約は厚めに定義する）

コネクタは**実接続できない環境でも検証できる形**にする（文言規約検査・雛形検査・ドライラン）。Evaluator は `docs/spec/rubric.md` の方法で以下を assert し、証跡を `docs/feedback/sprint-004.md` に残す。

1. **スキル構文（C2, ゼロ許容）**: 追加した SKILL（setup-microsoft ほか）の frontmatter が有効・`name` 一意。ルーター参照が `${CLAUDE_PLUGIN_ROOT}` 相対でデッドリンクなし。**配布 SKILL が `docs/spec/**`・`docs/sprints/**` を参照しない**（grep でゼロ。sprint-003-patch-001 の不変条件）。
2. **公式コネクタ前提の接続ガイド（C1, C4）**: setup-microsoft のガイド文言に、**Azure Portal / Azure AD の手作業手順（アプリ登録・API アクセス許可・クライアントシークレット等）が含まれない**こと（grep で不在を確認）。「Claude の設定画面から接続」に相当する導線と接続確認テスト手順が存在する。
3. **英語エラーの言い換え（C4）**: setup-microsoft / Notion / 診断が生の英語エラーをそのまま提示しない設計（言い換えの型・具体例が文言にある）ことを確認。
4. **Notion の任意性（C1）**: Notion が任意機能として案内でき、**未接続を模した状態でも他機能が壊れない**（daily・記憶・他接続の導線がクラッシュ/スタックしない）ことをドライラン/手順で確認。
5. **接続診断の型（C3, C4）**: 診断が各コネクタの状態（接続済み/未接続/エラー）を一覧で返し、未接続は対応する接続導線へ橋渡しする。失敗時は「実エラーで原因確定→日常語案内」の型に沿う（雛形・文言検査＋未接続を模したドライラン）。
6. **再起動しおり連携（C3）**: setup-microsoft が接続前に `_resume.md` へ文脈を書き、再開時に続きから案内できる導線がある（sprint-002 のしおり機構を利用）。
7. **語彙方針（C4, 改訂 ui.md）**: 追加文言が改訂 `docs/spec/ui.md` に適合（一般技術用語はそのまま・馴染みの薄い語〔OAuth・MCP 等〕のみ初出補足・**幼稚なメタファー禁止**）。新規文言に「秘書の家」等の「家」系メタファーがないこと（grep で不在確認）。
8. **同期層を作らない（C5, ゼロ許容）**: Microsoft/Notion データの**本文をローカルに保存しない**（都度参照）。接続導線・診断がキャッシュ層/全文コピーを作らない。
9. **安全・規律（C5, ゼロ許容）**: `~/workspace/agentic-harness` 書き込みなし。資格情報（トークン等）をワークスペースに保存/コミットしない（**秘密情報を機械的に履歴化しない**不変条件を維持）。封じ込め（基点検証・全導線ガード統一）・単段クレジットに反しない。
10. **無回帰（C6, ゼロ許容）**: sprint-001〜003（＋各 patch）の回帰スイートが全パス。本スプリントの assert を追加し実行コマンドを progress に記録。push なし（`git remote` 空）。

### rubric 対応まとめ
- C1 完成度: 2,4,5 / C2 構文: 1 / C3 機能実証: 5,6 / C4 体験: 2,3,5,7 / C5 安全・規律: 8,9 / C6 無回帰: 10

## Generator への引き継ぎメモ

- **setup-google の横展開**: sprint-003 の setup-google の様式（公式コネクタ前提・接続確認テスト・`_resume.md` 連携・英語エラー言い換え・3行報告）を Microsoft/Notion にそのまま展開する。様式を再発明しない。
- **company の一次情報**（`~/workspace/inbox/company`、読むだけ・クレジット継承）: Microsoft/Azure AD 手順は SKILL.md **745-786 行**。ただしこれは **Azure Portal 手作業前提**なので**流用しない**。「Claude 設定画面からの公式コネクタ接続」に置き換え、アプリ登録・シークレット発行等の手作業は削ぎ落とす。継承するのは診断の型（実エラーで原因確定→日常語案内）のみ。
- **DESIGN.md コネクタ設計との整合**: 第一級＝Microsoft 365（Google と同格）、任意＝Notion（`mcp.notion.com`）、**見送り＝国内チャット（Chatwork/LINE）**。この区分を崩さない（Notion を必須にしない・国内チャットを実装しない）。
- **恒久不変条件の遵守**（sprint-003-patch-001 で昇格）: 配布 SKILL は同梱されない `docs/spec/**` を参照しない（要点は同梱 `rules/` へ）。スクリプトの実行方法は exec bit or `bash "…"` に統一。封じ込め・秘密非履歴化を維持。パス参照は `${CLAUDE_PLUGIN_ROOT}` 相対。push しない。
- **語彙は改訂 ui.md 準拠**: 「秘書の家」等を新規に持ち込まない。OAuth・MCP など馴染みの薄い語は初出のみ簡潔補足。

## 参照

- `docs/spec/features.md` F11 F12 F13 / `docs/spec/domain.md`（コネクタ表）/ `docs/spec/constraints.md`（国内チャット見送り・同期層禁止・封じ込め・秘密非履歴化・配布 SKILL の同梱内参照・語彙方針）/ `docs/spec/ui.md`（改訂・語彙方針）/ `docs/spec/rubric.md`（検証方法）
- `docs/sprints/sprint-003.md`（setup-google の様式）／`sprint-002.md`（`_resume.md`）／`sprint-003-patch-001.md`（恒久不変条件）

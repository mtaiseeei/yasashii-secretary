# Progress — sprint-004（接続拡張: Microsoft / Notion / 診断）

- Phase: P2（接続拡張）
- Status: 実装完了・自己検証済み（Evaluator へ引き渡し）
- 実装者: Generator

## やったこと（setup-google の様式を横展開）

sprint-003 の setup-google の様式（公式コネクタ前提・接続確認テスト・`_resume.md` 連携・英語エラー言い換え・3行報告）を Microsoft / Notion に展開し、接続診断を追加した。コネクタは同期せず都度参照の原則を維持。

### 作成・変更ファイル

| ファイル | 役割 | 対応 |
|---|---|---|
| `plugins/cc-secretary/skills/setup-microsoft/SKILL.md`（新規） | Microsoft 365（Outlook・OneDrive・Teams）接続ガイド。公式コネクタ前提（設定画面 OAuth）。**Azure Portal / Azure AD 手作業は案内しない**。接続確認テスト・英語エラー言い換え・`_resume.md` 連携 | F11, 受入2,3,6 |
| `plugins/cc-secretary/skills/setup-notion/SKILL.md`（新規） | Notion 接続（**任意**・`mcp.notion.com`）。未接続でも他機能を壊さないことを明示。接続確認テスト・英語エラー言い換え | F12, 受入4 |
| `plugins/cc-secretary/skills/connections/SKILL.md`（新規） | 接続診断。Google/Microsoft/Notion の状態一覧＋「実エラーで原因確定→日常語案内」の型＋未接続の橋渡し＋3行報告 | F13, 受入5 |
| `plugins/cc-secretary/skills/secretary/SKILL.md`（変更） | ルーターに Microsoft / Notion / 接続診断モードを `${CLAUDE_PLUGIN_ROOT}` 相対で追加（従来「準備中」だった Microsoft/Notion を接続） | 受入1 |
| `scripts/regression-check.sh`（拡張） | section 2 に3スキルを追加、section 11（sprint-004）を新設。199→**230 assert** | 受入10 |

### 設計の要点

- **公式コネクタ前提**: setup-microsoft は設定画面の公式コネクタ（OAuth）でつなぐ手順のみ。Azure の手作業（登録・アクセス許可・シークレット発行）は文言に含めない（回帰で不在を grep）。継承したのは診断の型（実エラーで原因確定→日常語案内）と接続確認テストの発想。
- **Notion は任意**: 使わない人が素通りできる旨・未接続でも daily/記憶/他接続を壊さない旨を明示。必須にしない。
- **接続診断**: 推測で断定せず、軽い読み取りの結果（成功／実エラー）で「接続済み/未接続/エラー」を確定し一覧化。未接続は setup-google/microsoft/notion へ橋渡し。外部本文はローカルに保存しない。
- **国内チャット（Chatwork/LINE）**は非実装（公式コネクタ無し）。ルーター/診断で「まだ対応していない」と明示。
- **恒久不変条件の遵守**: 全参照は `${CLAUDE_PLUGIN_ROOT}` 相対・デッドリンクなし。配布 SKILL は `docs/spec/**` を参照しない。封じ込め・秘密非履歴化は sprint-003-patch-001 のまま（本スプリントはコネクタ導線＝文言のみで、決定的シームは追加していない）。push なし。

## 回帰チェックの実行方法

```bash
bash scripts/regression-check.sh
```

- **実行結果（自己検証）: PASS=230 / FAIL=0（合格）**。sprint-004 で計 31 件追加（section 11=25 / section 2 に3スキルの存在・name=6）。既存 199 件（sprint-001〜003＋各 patch）は無回帰で全パス。
- フォールバック（`CLAUDE_PLUGIN_ROOT` 未設定）でも全緑。push なし・`git remote` 空。

## 受入基準への対応（自己評価）

1. **スキル構文**: 満たす。setup-microsoft/setup-notion/connections の frontmatter 有効・`name` 一意（8スキル distinct）。参照は `${CLAUDE_PLUGIN_ROOT}` 相対でデッドリンクなし。新規 SKILL は `docs/spec/**`・`docs/sprints/**` を参照しない（grep 0）。
2. **公式コネクタ前提**: 満たす。Azure 手作業語（Azure Portal/Azure AD/アプリ登録/アクセス許可/クライアントシークレット/MS365_MCP_CLIENT_ID/デバイスコード）の不在を grep で確認。「設定画面からコネクタ接続」導線と接続確認テスト手順あり。
3. **英語エラーの言い換え**: 満たす。setup-microsoft/notion/connections に言い換えの型（表）と具体例あり。生英語を出さない設計。
4. **Notion の任意性**: 満たす。任意である旨・未接続でも他機能を壊さない旨を明示（文言検査）。
5. **接続診断の型**: 満たす。状態（接続済み/未接続/エラー）を一覧、実エラーで原因確定→日常語案内、未接続を各接続導線へ橋渡し、3行報告。
6. **再起動しおり連携**: 満たす。setup-microsoft が接続前に `resume-write` する導線あり。
7. **語彙方針**: 満たす。新規4文言に「家」系メタファー不在を grep で確認。OAuth/MCP のみ初出補足。
8. **同期層を作らない**: 満たす。setup-microsoft/connections が外部本文の非保存を明示。キャッシュ/全文コピーを作らない。
9. **安全・規律**: 満たす。harness 非書込・資格情報の非保存明記。封じ込め・秘密非履歴化・単段クレジットは既存 section で全パス。
10. **無回帰**: 満たす。既存 199 assert 全パス＋新規 31 件。push なし。

自己採点（rubric 目安）: C1=5 / C2=5 / C3=5 / C4=5 / C5=5 / C6=5。

## Evaluator への検証手順（推奨）

1. 既定: `bash scripts/regression-check.sh` → PASS=230/FAIL=0（section 11 が本スプリントの中核）。
2. 骨抜きでないことの確認（負テスト・Generator 実測済み）: setup-microsoft に `Azure Portal` を混入 → 「Azure 手作業手順が無い」が FAIL。復元で PASS=230 に戻る。
3. 文言の直接確認: `grep -rn "Azure Portal\|Azure AD\|アプリ登録\|クライアントシークレット" plugins/cc-secretary/skills/setup-microsoft` → 0件。`grep -rn "docs/spec\|秘書の家" plugins/cc-secretary/skills/{setup-microsoft,setup-notion,connections}` → 0件。
4. パス解決の両立: `CLAUDE_PLUGIN_ROOT` 明示／未設定どちらでも全緑。

## 既知の制約・スコープ

- 実インストール環境での実コネクタ接続（Microsoft/Notion の OAuth）は本環境では未実施（rubric 6）。実接続なしで検証できるよう、接続導線・診断は文言/雛形検査、既存の決定的シーム（記憶・成果物・封じ込め）はドライランで担保。
- 接続診断は LLM が軽い読み取りで状態を確定する対話導線（決定的シームは追加せず、setup-* と同じ様式の文言で実装）。
- スコープ外（国内チャット実装・daily への Microsoft/Notion データ統合の作り込み・ハーネス同梱・README 整備）は混ぜていない。Notion は任意・国内チャットは非実装の区分を維持。

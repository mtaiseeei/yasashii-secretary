# Feedback — sprint-004（接続拡張: Microsoft / Notion / 診断）

- 判定: **合格**
- 評価者: Evaluator
- 評価日: 2026-07-08
- 評価タイプ: 通常フル評価（6基準）

## 総評（3行）

- setup-microsoft（公式コネクタ前提・Azure 手作業なし・接続確認・英語エラー言い換え・`_resume.md` 連携）、setup-notion（任意性の明示）、connections（診断の型・橋渡し・3行）が sprint-003 の setup-google 様式で過不足なく横展開され、回帰 230 assert が全緑。
- ルーターは Microsoft/Notion/診断を `${CLAUDE_PLUGIN_ROOT}` 相対で接続（旧「準備中」は開発のみに残り矛盾なし）。デッドリンクなし・8スキル name 一意・配布物の docs/spec 参照ゼロ・家系メタファーゼロ。
- 前スプリントの決定的シーム（封じ込め・秘密非履歴化）は非劣化、同期層なし・国内チャット非実装・単段クレジット維持。全10受入基準を満たすため合格。

## 各基準のスコア

| # | 基準 | 閾値 | スコア | 判定 |
|---|---|---|---|---|
| C1 | 完成度 | ≥4 | 5 | ✓ 受入1〜10 達成 |
| C2 | 構文・整合 | 5 | 5 | ✓ 8スキル name 一意・相対参照実在・docs/spec 非参照 |
| C3 | 機能の実証 | ≥4 | 5 | ✓ 診断の型・しおり連携・同期層なしを検査 |
| C4 | 非エンジニア体験 | ≥4 | 5 | ✓ 改訂 ui.md 準拠・英語エラー言い換え・3行型 |
| C5 | 安全・規律 | 5 | 5 | ✓ 同期層なし・秘密非履歴化維持・封じ込め非劣化 |
| C6 | 無回帰 | 5 | 5 | ✓ 既存 199 assert 全パス＋31 追加 |

→ 全基準が閾値以上のため **合格**。

## 証跡

### 1. 回帰再実行（3モード・Evaluator 実行）

```
既定                              : PASS=230  FAIL=0
env -u CLAUDE_PLUGIN_ROOT（fallback）: PASS=230  FAIL=0
/bin/bash 3.2.57（macOS 既定）       : PASS=230  FAIL=0
```
199→230 の +31 は section 11（sprint-004）＋section 2 の3スキル存在・name。section 11 は文言の実在（Azure 手作業不在 grep・接続確認・英語エラー言い換え・resume-write・診断状態一覧・橋渡し・任意性・本文非保存・家系ゼロ・docs/spec 非参照・ルーター接続）を検査し骨抜きでない。

### 2. setup-microsoft（受入2・3・6・C1/C4）

- **Azure 手作業の不在**: `grep -rniE 'Azure Portal|Azure AD|アプリ登録|アクセス許可|クライアントシークレット|client_secret|MS365_MCP|デバイスコード' setup-microsoft/` → **0件**。「管理画面での登録や鍵の発行は一切要りません。設定画面のボタン操作だけで完結」と明記。
- 公式コネクタ導線（設定画面 → コネクタ → Microsoft 365 有効化）、接続確認テスト（「直近の予定を1件だけ見せて」）、英語エラー言い換え表（not authorized/wrong account/expired/not connected の4例）、接続前 `resume-write`・完了時 `resume-clear`、3行完了報告、秘密非保存明記。

### 3. setup-notion（受入4・C1）— 任意性

- 「**任意**の案内です。**使っている人だけ繋げば大丈夫**」「使っていない人は、この案内を飛ばして構いません。他の機能には影響しません」「繋がなくても『今日やること』や記憶、Google / Microsoft の接続はそのまま使えます」と明示。必須化していない。`mcp.notion.com`・接続確認・英語エラー言い換えも具備。

### 4. connections（診断）（受入5・C3/C4）

- **診断の型**: 「状態を思い込みで決めない。まず実際に軽く読み取ってみて、返ってきた結果（成功／実際のエラー）で状態を確定してから案内（実エラーで原因確定 → 日常語で案内）」。接続済み/未接続/エラーの3分類。
- **橋渡し**: 未接続は Google→setup-google、Microsoft→setup-microsoft、Notion→setup-notion（`${CLAUDE_PLUGIN_ROOT}` 相対）へ。
- 3行報告（状態の要約／気になる点／次にやること）、外部本文非保存（「全文は取り込まない（本文はローカルに保存しない）」）、Notion 任意・国内チャット未対応を明記。

### 5. ルーター組み込み（受入1・C2）

- Microsoft/Notion/接続診断の3モードを追加。参照はすべて `${CLAUDE_PLUGIN_ROOT}` 相対。ルーター内の全10参照先（skills/setup-microsoft・setup-notion・connections 含む）が実在＝**デッドリンクなし**。
- **「準備中」矛盾なし**: 旧版で「準備中」だった Microsoft/Notion は接続済みに更新。残る「準備中」は開発（build・sprint-005）のみで正当。国内チャットは「まだ対応していない（公式コネクタが無いため）」と別記。
- 8スキル（secretary/onboarding/memory-care/setup-google/daily/setup-microsoft/setup-notion/connections）の `name` すべて一意。

### 6. 語彙方針・同梱内参照（受入7・C4／受入1・9・C2/C5）

- 新規3スキルに家系メタファー（`秘書の家|この家|お家|おうち`）**ゼロ件**。一般技術用語（Outlook・OneDrive・Teams・コネクタ）はそのまま、OAuth のみ初出補足。3行型。
- 配布物（`plugins/cc-secretary/`）に `docs/spec`・`docs/sprints` 参照**0件**（sprint-003-patch-001 の不変条件を維持）。

### 7. 同期層なし・安全（受入8・9・C5）

- 外部本文の非保存を setup-microsoft（「中身はローカルに保存していません」）・setup-notion・connections（「全文は取り込まない」）が明示。`10_sources` 型の層なし。
- **前シーム非劣化（Evaluator 実測）**: `secretary/memory` を外部 symlink にした guarded-write → exit 3、`inbox/creds.txt`（`api_key = …`）を含む commit → exit 3・`git log --all` に非出現、秘密スキャンロジック健在。本スプリントは文言のみで決定的シームを変更していない。
- `~/workspace/agentic-harness`（Jul 2 16:08）・`~/workspace/inbox/company`（Jun 23 11:11）とも不変＝非書込。検証は scratchpad のみ。単段クレジット（forkedFrom=Shin-sibainu/cc-company・中間フォーク非掲載）維持。

### 8. DESIGN 区分の遵守（C5）

- 第一級＝Microsoft 365（Google 同格・専用 SKILL）、任意＝Notion（必須化せず）、見送り＝国内チャット。`skills/` に Chatwork/LINE の実スキルは**存在しない**（診断・ルーターで「まだ対応していない」と明示するのみ）。区分を崩していない。

## 残課題（ブロッカーではない）

- 実インストール環境での Microsoft/Notion の実 OAuth 接続確認は本環境で不可（rubric 6「未実施の手動確認」）。実接続なしで検証できるよう、接続導線・診断は文言/雛形検査、既存の決定的シーム（記憶・成果物・封じ込め・秘密非履歴化）はドライラン＋独立攻撃で担保した。
- connections は決定的シームを持たず LLM の軽い読み取りで状態確定する対話導線（契約どおり setup-* と同じ様式の文言で実装）。実接続時の分類精度はライブ確認で見るのが望ましい。

## 付録: 回帰チェック要点

```
== 1〜10 ==  全PASS（マニフェスト/単段クレジット・8スキル構文・生成物6規律・git・体験・安全・
               記憶ケア封じ込め・出力規約・文言一掃・Codex 対応〔基点symlink/秘密非履歴化ほか〕）
== 11. 接続拡張（Microsoft / Notion / 診断）==  全PASS
   （Azure 手作業不在・設定画面コネクタ導線・接続確認・英語エラー言い換え・resume 連携・
    Notion 任意性・mcp.notion.com・診断の状態一覧/橋渡し/3行・本文非保存・家系ゼロ・
    docs/spec 非参照・ルーター3モード接続）
== 結果 ==  PASS=230  FAIL=0
```

# Progress — sprint-001-patch-002（過度な平易化の一掃・文言規約の改訂反映）

- Type: patch（通常）
- Base: sprint-001 / 002 の配布物文言 ＋ sprint-003 追加分
- Status: 差し戻し修正済み・自己検証済み（Evaluator へ再提出）
- 実装者: Generator
- 前提: **振る舞い（生成物構造・スクリプト挙動・git 導線）は一切変えていない。文言のみ。**

## 差し戻し（feedback sprint-001-patch-002）への対応

Evaluator 指摘の2点を修正した。

1. **【ブロッキング C5】`.claude-plugin/marketplace.json` の `metadata.description` に「秘書の家」＋擬人化「秘書だけがローカルに住む」が残存**（初回一掃で `plugins/` のみ見て、リポジトリ直下のマーケットプレイス定義を見落とした）。→ description を改訂 ui.md 準拠に書き直し: 「外部データは各サービスに置いたまま公式コネクタで都度参照し、記憶と成果物はローカルの秘書ディレクトリ（secretary/）に置く。数問のオンボーディングで秘書ディレクトリを作り、git init まで完了する。」。「秘書の家」「ローカルに住む」を除去。
2. **【カバレッジ欠落 C6】回帰 section 9 の一掃 assert が `plugins/cc-secretary` しか見ていなかった**（marketplace.json を検査範囲外にしていた＝範囲狭めの骨抜き）。→ 検査対象を配布物全体 `DIST=(plugins/cc-secretary, .claude-plugin, LICENSE)` に拡張。`秘書の家`・`お家/おうち`・`ローカルに住む`（住まい擬人化）・旧規定文言を配布物全体で検査。負テストで marketplace.json 混入を検出することを確認済み。

再チェック: `grep -rn "秘書の家\|お家\|おうち\|ローカルに住む" plugins/ .claude-plugin/` → **0件**。

> feedback 付随の spec-issue（受入1 の対象範囲に `.claude-plugin/marketplace.json` を明記）は Planner 管掌のため契約は変更していない。回帰側は配布物全体を検査する形に拡張済みで、実体としては解消している。

## やったこと（改訂 ui.md の語彙方針を配布物全体に反映）

### 1.「秘書の家」等のメタファーを一掃（→ 秘書ディレクトリ／秘書フォルダ）

着手時 grep（`grep -rn "秘書の家" plugins`）で **7ファイル・12箇所**を検出。すべて「秘書ディレクトリ（`secretary/`）」または文脈に応じ「秘書フォルダ」に置換。

| ファイル | 対応 |
|---|---|
| `.claude-plugin/plugin.json` | description の「秘書の家（secretary/）」→「秘書ディレクトリ（secretary/）」 |
| `skills/onboarding/SKILL.md` | 7箇所（導入・見出し「ステップ2」・進行文・構造確認・git init 注記・コミットメッセージ例・完了報告）を置換。完了報告は改訂 ui.md L26 の例「秘書ディレクトリ（secretary/）を作成しました」に合わせた |
| `rules/plain-language.md` | 例文＋禁止ルール文を改稿（下記 3） |
| `templates/memory/MEMORY.md` | 初期索引行「秘書の家を作成」→「秘書ディレクトリを作成」 |
| `templates/memory/decisions/_first-decision.md` | 初期記載を置換 |
| `skills/secretary/SKILL.md`・`scripts/workspace-tools.sh` | sprint-003 で先行修正済み（本 patch で再 grep し不在を確認） |

### 2. 過度な平易化の是正（旧「専門用語は必ず言い換え併記」を撤廃）

- 各 SKILL（secretary / onboarding / memory-care / daily / setup-google）冒頭の一文「報告は3行以内・専門用語は言い換え併記・次に何が起きるかを一言」を、新方針「報告は3行以内（やったこと／結果／次に何が起きるか）。一般に通じる技術用語はそのまま使い、馴染みの薄い語だけ初出で簡潔に補足する。」に更新。
- 呼称「やさしい言葉ルール」→「言葉づかいルール」に統一（ファイル名は `plain-language.md` のまま。参照 11 箇所を更新）。
- setup-google の OAuth 補足を「アプリ同士を安全につなぐ仕組み」に、資格情報表現から「合言葉」メタファーを除去（sprint-003 で対応済み）。
- memory-care の「（『秘書＋道具箱』のフラット構成を保つ）」→「（フラットな構成を保つ）」。設計メタファー自体は DESIGN 由来のため廃止せず、ユーザー向け文言での多用のみ避けた。
- `templates/AGENTS.md`（生成される指示ファイルの雛形）の規律5にあった冗長なグロス「コミット（作業の区切りを記録すること）」→「コミット」に整理（コミットは『そのまま使う語』）。`push` の補足は「そのまま使う語」リスト外で有用なため維持した。

### 3. `rules/plain-language.md` を改訂 ui.md 準拠に全面書き換え

- 対象読者を「技術に多少関心のある非エンジニア／過度な平易化はしない」と明記。
- 「**そのまま使う語**（ディレクトリ・フォルダ・ファイル・インストール・コミット・プラグイン・コネクタ・TODO・カレンダー・メール・リンク・設定）」と「**初出のみ補足する語**（OAuth・リポジトリ・frontmatter・MCP・トークン・環境変数）」のリストを掲載。
- 旧「専門用語は必ず言い換えをカッコで併記」の型を撤廃。幼稚なメタファー禁止を、当の語（「秘書の家」）を literal で使わずに表現（受入基準1のゼロ件 grep と両立させるため）。
- 3行報告・進行語彙（計画→道具→確認→結果、段階の呼び名と明記）・英語エラー翻訳は維持。

### 4. 回帰チェックの追従

- `scripts/regression-check.sh` に section 9（文言規約）を新設。156→**169 assert**（うち section 9=13。marketplace.json を含む配布物全体を検査）。
- section 4 のサンプルコミットメッセージ（テスト用フィクスチャ）も「秘書ディレクトリを作成」に更新（配布物ではないが一貫性のため）。

## 回帰チェックの実行方法

```bash
bash scripts/regression-check.sh
```

- **実行結果（自己検証）: PASS=169 / FAIL=0（合格）**。既存 156 assert は無回帰で全パス（文言変更が生成物構造・保護・封じ込め・git を壊していないことを確認）。section 9（文言規約・配布物全体）で 13 件追加。
- フォールバック（`CLAUDE_PLUGIN_ROOT` 未設定）でも全緑。push なし。

## grep 証跡

```
# 一掃後（配布物全体: plugins/ ＋ .claude-plugin/ ＋ templates/）
$ grep -rn "秘書の家\|お家\|おうち\|ローカルに住む" plugins/ .claude-plugin/   → 0件
$ grep -rn "言い換え併記\|専門用語は必ず\|言い換えを併記" plugins/ .claude-plugin/ → 0件
$ grep -rc "やさしい言葉ルール" plugins/cc-secretary → 0件（「言葉づかいルール」に統一）
```

## 受入基準への対応（自己評価）

1. **メタファー一掃（C5, ゼロ許容）**: 満たす。配布物全体（`plugins/cc-secretary`＝templates 含む・`.claude-plugin/marketplace.json`・LICENSE）に「秘書の家」「お家」「おうち」「ローカルに住む」ゼロ件を grep で確認。禁止ルール文自体も当の語を literal で持たない形に。
2. **語彙方針への適合（C4）**: 満たす。plain-language.md を改訂 ui.md 準拠に書き換え（そのまま使う語／初出補足語のリスト・旧規定撤廃）。旧文言「言い換え併記／専門用語は必ず」が配布物にゼロ件。
3. **呼称の統一（C1）**: 満たす。`secretary/` を「秘書ディレクトリ／秘書フォルダ」に統一。onboarding 完了報告が改訂 ui.md の例に沿う。
4. **振る舞い不変（C3）**: 満たす。生成物構造・記憶保護・封じ込め・git 挙動の assert（section 3〜8 の 144 件）が全パス。変更は文言のみ。
5. **無回帰（C6, ゼロ許容）**: 満たす。既存 156 assert 全パス＋新規 13 件（section 9・配布物全体を検査）。旧文言を期待する assert は残していない（section 4 のフィクスチャも更新）。`git remote` 空・push なし。

自己採点（rubric 目安）: C1=5 / C2=5 / C3=5 / C4=5 / C5=5 / C6=5。

## Evaluator への検証手順（推奨）

1. 既定: `bash scripts/regression-check.sh` → PASS=169/FAIL=0（section 9 が本 patch の主眼）。
2. 一掃の直接確認: `grep -rn "秘書の家\|お家\|おうち" plugins/cc-secretary` → 0件。`grep -rn "言い換え併記\|専門用語は必ず" plugins/cc-secretary` → 0件。
3. 骨抜きでないことの確認（負テスト・Generator 実測済み）:
   - templates に「秘書の家」を混入 → section 9「配布物に『秘書の家』が無い」が FAIL。
   - SKILL に「言い換え併記」を混入 → 「旧規定『言い換え併記』が無い」が FAIL。
   - いずれも復元で PASS=169 に戻る。
4. 振る舞い不変: section 3（生成物構造）・section 7（記憶保護・封じ込め）・section 8（出力規約）が全パス＝文言変更で機能が壊れていない。

## 既知の制約・スコープ

- `docs/`（spec・DESIGN・contracts）側の文言は対象外（DESIGN.md・CLAUDE.md はユーザー管理、spec は Planner 管掌）。対象は配布物（`plugins/**`・`templates/**`・`.claude-plugin/marketplace.json`・LICENSE）。
- 「秘書＋道具箱」という設計メタファー自体は廃止していない（DESIGN 由来の内部概念）。ユーザー向け文言で幼稚に多用しないよう調整しただけ。
- 実インストール環境でのライブ確認は本環境では未実施（rubric 6）。文言・構造はスクリプトで検証した。

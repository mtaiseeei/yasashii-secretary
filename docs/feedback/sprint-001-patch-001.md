# Feedback — sprint-001-patch-001（templates 配置とパス解決の堅牢化 / Type: micro）

- 判定: **合格**
- 評価者: Evaluator
- 評価日: 2026-07-08
- 評価タイプ: micro 軽量評価（機能完全性・動作安定性・無回帰の3基準のみ）

## 総評（3行）

- テンプレを `plugins/cc-secretary/templates/` へ移設し、SKILL 参照を `${CLAUDE_PLUGIN_ROOT}` 相対に統一する目的を過不足なく達成。
- 回帰は既定・`${CLAUDE_PLUGIN_ROOT}` 明示・未設定フォールバックの3モードとも **PASS=57 / FAIL=0**。53→57 の増分はカバー範囲を減らさず追従（section 2 に +4）。
- 生成物の構造・6規律・git 挙動・クレジット方針の assert は据え置きで全パス。回帰ゼロ。合格。

## 各基準の判定（micro）

| # | 基準 | 判定 | 根拠 |
|---|---|---|---|
| 1 | 機能完全性 | ✓ | 雛形が新配置に8ファイル存在・SKILL 参照は全て `${CLAUDE_PLUGIN_ROOT}` 相対・残存ゼロ・ドライラン生成物が domain.md 構造 |
| 2 | 動作安定性 | ✓ | 3モード（既定/明示/未設定フォールバック）とも PASS=57・生成失敗なし・フォールバック前提が SKILL に明記 |
| 3 | 無回帰（ゼロ許容） | ✓ | 既存 assert 全パス・新規失敗ゼロ・次スプリント機能の混入なし |

## 証跡

### 1. 移設の確認（受入1）

```
$ ls -d templates 2>/dev/null    → 出力なし（リポジトリ直下 templates/ は消えた）
$ find plugins/cc-secretary/templates -type f | sort
plugins/cc-secretary/templates/AGENTS.md
plugins/cc-secretary/templates/CLAUDE.md
plugins/cc-secretary/templates/docs/.gitkeep
plugins/cc-secretary/templates/inbox/.gitkeep
plugins/cc-secretary/templates/memory/MEMORY.md
plugins/cc-secretary/templates/memory/decisions/_first-decision.md
plugins/cc-secretary/templates/memory/preferences.md
plugins/cc-secretary/templates/projects/.gitkeep
```
`git status --short` は8ファイルすべてを `R`（rename）で表示 → `git mv` により履歴保持で移設。中身は無変更（section 3 のドライランで6規律・構造が従来どおり生成されることを別途確認）。

### 2. SKILL 参照の統一と残存ゼロ（受入1・grep）

```
$ grep -rn 'plugins/cc-secretary/' plugins/cc-secretary/skills/*/SKILL.md        → 0件
$ grep -rnoE '[^./{]templates/' plugins/cc-secretary/skills/*/SKILL.md           → 0件（bare templates/ なし）
$ grep -rn 'CLAUDE_PLUGIN_ROOT' plugins/cc-secretary/skills/*/SKILL.md           → 雛形/ルール/スキル参照が該当
```
- onboarding SKILL: 雛形（`${CLAUDE_PLUGIN_ROOT}/templates/...`）・ルール（`${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`）を統一。
- secretary SKILL: ルール・onboarding スキル参照を `${CLAUDE_PLUGIN_ROOT}` 相対に統一。
- **フォールバック明記**: onboarding SKILL.md L70 に「万一 `${CLAUDE_PLUGIN_ROOT}` が未設定の場合は、この SKILL.md 自身の場所を起点に `../../templates/` を使う」と記載。回帰スクリプトの `PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$PLUGIN}"`（L24）と整合。
- 開発者向け設計ドキュメント（`docs/spec/...`）への言及は「実インストールには同梱されない」と明示区別済み（onboarding L124）。

### 3. 動作安定性（受入2・3モード実行）

```
モードA 既定                         : PASS=57  FAIL=0
モードB CLAUDE_PLUGIN_ROOT 明示       : PASS=57  FAIL=0
モードC env -u（未設定→フォールバック）: PASS=57  FAIL=0
```
`${CLAUDE_PLUGIN_ROOT}` の有無いずれでも雛形が解決し、生成が成立。

### 4. 無回帰と assert のカバレッジ（受入3）

- 総 `check` 数 = 57（`grep -c '^check ' scripts/regression-check.sh`）。53→57 の +4 は section 2 の追加分:
  - `${CLAUDE_PLUGIN_ROOT}/...` 参照先が `PLUGIN_ROOT` 配下で全て実在（旧デッドリンク検査を新配置に刷新）
  - 雛形が `plugins/cc-secretary/templates/` に存在
  - SKILL に `plugins/cc-secretary/` 直下相対の同梱参照が無い
  - SKILL に bare `templates/` 参照が無い / 絶対パス直書きが無い
- section 1（マニフェスト・単段クレジット方針の正負検査）、section 3（生成物構造・6規律・CLAUDE.md ポインタ・MEMORY.md 索引）、section 4（git init・日本語コミット・push なし）、section 5（非エンジニア体験）、section 6（安全）は sprint-001 から**維持されたまま全パス**。カバー範囲の縮小なし。
- ドライランの起点は `TEMPLATES="$PLUGIN_ROOT/templates"`（L25）に追従。生成検証ロジック自体は sprint-001 と同一。

### 5. 新 assert が骨抜きでないことの負テスト（Evaluator 実施・原本無変更）

onboarding SKILL の複製に `templates/AGENTS.md`（bare）と `plugins/cc-secretary/rules/...`（直下相対）を混入して検査ロジックを走らせた:
- bare `templates/` 検査 → **FAIL 検知**（assert に歯あり）
- `plugins/cc-secretary/` 直下相対 検査 → **FAIL 検知**（assert に歯あり）

→ 単なる文字列一致の骨抜きではなく、逆パターンで確実に落ちる。Generator 申告の負テスト（bare 混入で PASS=56/FAIL=1）とも整合。

### 6. 安全（不変条件・据え置き確認）

- `~/workspace/agentic-harness`（Jul 2）・`~/workspace/inbox/company`（Jun 23）とも本作業で不変 → 非書込。
- 資格情報の実値なし・`10_sources` 型なし・`.mcp.json` は `mcpServers: {}`（回帰 section 6 で全パス）。
- クレジット方針（単段・Shin-sibainu/cc-company）は本パッチで変更なし。回帰 section 1 の正負検査が引き続き有効・全パス。

## 残課題（ブロッカーではない）

- **実インストールの手動ライブ確認は未実施**: `marketplace add → install → /secretary` の実解決は本環境で不可（rubric 6「未実施の手動確認」）。`${CLAUDE_PLUGIN_ROOT}` の解決はスクリプトで両パターン（明示・未設定フォールバック）を再現して代替検証した。実配布前に一度ライブ確認を推奨。
- **絶対パス直書き検査の範囲（軽微）**: `scripts/regression-check.sh` L149-150 はインラインコード中の絶対パス（バッククォート＋`/英字`）を対象とする限定的な検査。micro スコープには十分だが、将来 SKILL が増えたら検査パターンの一般化を検討してよい。

## 付録: 既定モードの回帰チェック全出力（要点）

```
== 1. マニフェスト有効性 ==            全PASS（forkedFrom=cc-company・LICENSE MIT/cc-company・中間フォーク非掲載・mcp最小）
== 2. スキル構文・参照整合 ==          全PASS（name一意・${CLAUDE_PLUGIN_ROOT}参照先実在・新配置存在・直下相対/bare/絶対 残存ゼロ）
== 3. オンボーディング生成物 ==        全PASS（構造9点・6規律・置換漏れなし・CLAUDE.mdポインタ・MEMORY.md索引）
== 4. git 初期化 ==                    全PASS（init・1コミット・日本語・リモート未設定・未push）
== 5. 非エンジニア体験 ==              全PASS（plain-language参照・3行型・進行語彙・英語エラー翻訳・「次」）
== 6. 安全・規律 ==                    全PASS（harness非書込・10_sourcesなし・資格情報の実値なし）
== 結果 ==  PASS=57  FAIL=0
```

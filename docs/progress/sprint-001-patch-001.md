# Progress — sprint-001-patch-001（templates 配置とパス解決の堅牢化）

- Type: micro
- Base sprint: sprint-001（合格済み）
- Status: 実装完了・自己検証済み（Evaluator へ引き渡し）
- 実装者: Generator

## やったこと（3点・ユーザーから見た振る舞いは不変）

1. **移設**: `templates/`（リポジトリ直下）→ `plugins/cc-secretary/templates/` に `git mv` で移動（履歴は rename として保持）。中身（`AGENTS.md` / `CLAUDE.md` / `memory/MEMORY.md` / `memory/preferences.md` / `memory/decisions/_first-decision.md` / 各 `.gitkeep`）は無変更。
2. **参照の統一**: onboarding / secretary の SKILL 内の同梱ファイル参照（雛形・rules・skills）をすべて **`${CLAUDE_PLUGIN_ROOT}/...` 相対** に統一。
   - 雛形: `${CLAUDE_PLUGIN_ROOT}/templates/...`
   - ルール: `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`
   - スキル: `${CLAUDE_PLUGIN_ROOT}/skills/onboarding/SKILL.md`
   - リポジトリ直下相対（`plugins/cc-secretary/...`・bare `templates/`）・絶対パス直書きの残存はゼロ（回帰で assert）。
   - `docs/spec/domain.md` / `docs/spec/constraints.md` への言及は、配布に同梱されない「このリポジトリの設計ドキュメント（開発者向け）」であることを明記し、同梱ファイル参照とは区別した。
   - **フォールバック**: `${CLAUDE_PLUGIN_ROOT}` 未設定時は「この SKILL.md 自身の場所を起点に `../../templates/`」を使う前提を onboarding SKILL に明記（開発時のリポジトリ配置でも壊れない）。
3. **回帰スクリプトの追従**: `scripts/regression-check.sh` を新配置・`${CLAUDE_PLUGIN_ROOT}` 解決に追従。assert 総数・カバー範囲は減らさず **53 → 57** に増加。

### 変更ファイル

| ファイル | 変更 |
|---|---|
| `plugins/cc-secretary/templates/**`（旧 `templates/**`） | `git mv` で移設（内容不変） |
| `plugins/cc-secretary/skills/onboarding/SKILL.md` | 雛形・ルール参照を `${CLAUDE_PLUGIN_ROOT}` 相対に統一・フォールバック明記 |
| `plugins/cc-secretary/skills/secretary/SKILL.md` | ルール・スキル参照を `${CLAUDE_PLUGIN_ROOT}` 相対に統一 |
| `scripts/regression-check.sh` | 雛形解決を `PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$PLUGIN}"` に変更。参照検査を刷新（下記） |

## 回帰チェックの実行方法

```bash
bash scripts/regression-check.sh
```

- **実行結果（自己検証）: PASS=57 / FAIL=0（合格）**。
- 追加/更新した assert（section 2）:
  - `${CLAUDE_PLUGIN_ROOT}/...` の参照先がすべて `PLUGIN_ROOT` 配下で実在（デッドリンクなし）。
  - 雛形が `plugins/cc-secretary/templates/` に存在。
  - SKILL に `plugins/cc-secretary/` 直下相対の同梱参照が無い。
  - SKILL に `${CLAUDE_PLUGIN_ROOT}` を伴わない bare `templates/` 参照が無い。
  - SKILL に絶対パス直書きが無い。
- section 3（ドライラン実体化）は `TEMPLATES="$PLUGIN_ROOT/templates"` を起点に変更。生成物の構造・6規律・git 状態の検証は sprint-001 と同一（無回帰）。

## 受入基準（micro）への対応（自己評価）

1. **機能完全性**: 満たす。雛形は `plugins/cc-secretary/templates/` に存在。SKILL の同梱参照はすべて `${CLAUDE_PLUGIN_ROOT}` 相対（リポジトリ直下相対・絶対直書きの残存ゼロを grep で assert）。ドライランで生成物が従来どおり `docs/spec/domain.md` 構造で生成される。
2. **動作安定性**: 満たす。`${CLAUDE_PLUGIN_ROOT}` 明示設定時・未設定時（`:-$PLUGIN` フォールバック）の両方で回帰が全緑になることを確認（下記「検証手順」参照）。生成は失敗しない。
3. **無回帰（ゼロ許容）**: 満たす。既存の生成物・6規律・git・クレジット方針・非エンジニア体験・安全の assert はパスを追従したうえで全パス（新規失敗ゼロ）。次スプリント機能の混入なし。

## Evaluator への検証手順（推奨）

1. 既定: `bash scripts/regression-check.sh` → PASS=57/FAIL=0。
2. パス解決の両立確認:
   - 明示: `CLAUDE_PLUGIN_ROOT="$(pwd)/plugins/cc-secretary" bash scripts/regression-check.sh` → 全緑。
   - 未設定（フォールバック）: `env -u CLAUDE_PLUGIN_ROOT bash scripts/regression-check.sh` → 全緑。
   - （Generator 実測: いずれも PASS=57/FAIL=0）
3. 残存参照の grep 目視:
   - `grep -rn 'plugins/cc-secretary/' plugins/cc-secretary/skills/*/SKILL.md` → 0件。
   - `grep -rnoE '[^./{]templates/' plugins/cc-secretary/skills/*/SKILL.md` → 0件。
   - `grep -rn 'CLAUDE_PLUGIN_ROOT' plugins/cc-secretary/skills/*/SKILL.md` → 雛形・ルール・スキル参照が該当。
4. 移設確認: `ls templates 2>/dev/null`（無い）/ `find plugins/cc-secretary/templates -type f`（8ファイル）。

## 骨抜きでないことの確認（負テスト）

- SKILL に bare `templates/AGENTS.md` を混入 → 「bare templates/ 参照が無い」assert が FAIL（PASS=56/FAIL=1）。復元で全緑に戻る。
- （sprint-001 で追加のクレジット assert の負テストも引き続き有効。）

## 既知の制約

- 実インストール環境での `marketplace add → install → /secretary` の手動ライブ確認は本環境では未実施（rubric 6「未実施の手動確認」）。`${CLAUDE_PLUGIN_ROOT}` の実解決はスクリプトで両パターン（明示・未設定フォールバック）を再現して代替検証した。
- sprint-001 契約スコープ項目6（`templates/` をリポジトリ直下に置く）は本パッチで supersede 済み。以後の配置正本は `docs/spec/domain.md`「テンプレートの配置とパス解決」。

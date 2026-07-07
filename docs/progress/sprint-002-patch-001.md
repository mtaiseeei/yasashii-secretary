# Progress — sprint-002-patch-001（記憶ツールの封じ込めハードニング）

- Type: micro
- Base sprint: sprint-002（合格済み）
- Status: 実装完了・自己検証済み（Evaluator へ引き渡し）
- 実装者: Generator

## やったこと（封じ込めを2系統ハードニング・正常系は不変）

`memory-tools.sh` の封じ込め判定を「対象の**実解決先**（symlink 完全解決後の正規化パス）が `secretary/memory/` 境界の内側か」で行うよう強化した。ユーザーから見た正常系の振る舞い（記憶の追加/更新/削除・索引・しおり・節目コミット）は不変。

1. **symlink 越えの遮断**: 新設ヘルパー `_realpath`（`readlink` を辿る可搬な物理解決。`realpath` 非依存）で、対象自身が symlink の場合も、中間ディレクトリが symlink の場合も、実解決先を求めてから境界照合する。実解決先が境界外なら `exit 3` で拒否し、書き込み/削除を実行しない。
2. **エッジ rel の遮断**: `.` / 空 / `..`（親方向脱出）を**偽装成功させず非ゼロで拒否**する（空・引数不足は `exit 2`、境界越え・`.` は `exit 3`。いずれも `exit 0` を返さない）。`basename` が `.`/`..` になるケースも拒否。
3. **前方一致の接頭辞衝突を回避**: 境界照合は正規化パス同士で行い、境界に `/` を付けて比較する（`secretary/memory-evil/` のような接頭辞衝突を排除。`base` 自身も対象にしない）。

### 変更ファイル

| ファイル | 変更 |
|---|---|
| `plugins/cc-secretary/skills/memory-care/scripts/memory-tools.sh` | `_realpath`（symlink 完全解決）を追加。`_safe_path` を「実解決先で境界判定」に強化し、エッジ rel（`.`/空/`..`）を早期拒否。ヘッダの終了コード説明を更新 |
| `scripts/regression-check.sh` | section 7 に symlink 越え（最終要素・中間ディレクトリ）とエッジ rel の負テストを追加。98→**111 assert** |

## 回帰チェックの実行方法

```bash
bash scripts/regression-check.sh
```

- **実行結果（自己検証）: PASS=111 / FAIL=0（合格）**。既存 98 assert は温存し、封じ込めハードニングで 13 件追加（symlink 6・エッジ rel 6・エッジ後の副作用なし 1）。
- 一時ディレクトリのみに書き込み、`~/workspace/agentic-harness` には一切触れない。push なし。

## 受入基準（micro）への対応（自己評価）

1. **symlink 越え書き込み/削除の拒否**: 満たす。`secretary/memory/` 内に外向き symlink（最終要素・中間ディレクトリ）を仕込んだ状態で書き込み/削除を試みると `exit 3` で拒否され、境界外の実ファイルが変更・作成・削除されないことを assert。
2. **エッジ rel の非偽装**: 満たす。`rel = "."` / 空 / `..` / `../x` に対する削除・書き込みが非ゼロで拒否され、「成功」報告・`exit 0` を返さない。境界内の既存 `preferences.md` に副作用がないことも assert。
3. **正常系の温存**: 満たす。正当な `secretary/memory/` 内パスへの追加・更新・削除・索引追従・しおり・節目コミットが従来どおり成功（section 7 の既存 assert 全パス）。
4. **無回帰**: 満たす。既存 98 assert が全パスし、新規負テストで総数 111 に増加。次スプリント機能の混入なし。`git remote` 空・push なし。

## 骨抜きでないことの確認（負テスト・Generator 実測済み）

- `_safe_path` の実解決（`real="$(_realpath "$cand")"`）を無効化（`real="$cand"`）した版で、最終要素 symlink への `guarded-write` を実行 → **外部の実ファイルが `HACKED` に改ざん・`exit 0`**（＝解決を外すと実際に境界を越える）。本物の版では同条件で `exit 3`・外部不変。よって symlink 解決は防御の要であり、回帰の symlink assert は本物。
  - 注: macOS では `/var`→`/private/var` の symlink があるため、負テストの base は `pwd -P` で正規化してから再現（正規化しないと偶然弾かれ不明瞭になるため）。本番コードは境界・実解決先とも正規化パスで比較するため、この影響を受けない。

## Evaluator への検証手順（推奨）

1. 既定: `bash scripts/regression-check.sh` → PASS=111/FAIL=0（section 7 が本パッチの主眼）。
2. 手動再現（一時 `secretary/` の memory 内に外向き symlink を張る）:
   - 最終要素 symlink: `ln -s <外部ファイル> memory/link.md` → `guarded-write <sec> link.md` / `delete <sec> link.md --confirm` が `exit 3`・外部不変。
   - 中間 symlink: `ln -s <外部ディレクトリ> memory/evil` → `guarded-write <sec> evil/x.md` が `exit 3`・外部不変。
   - エッジ rel: `delete <sec> .` / `guarded-write <sec> ""` などが非ゼロ・成功報告なし。
   - 正常系: `guarded-write <sec> preferences.md` / `remember-decision <sec> 2026-07-11 "…"` / `delete <sec> decisions/…-decisions.md --confirm` が成功。
3. パス解決の両立（既存規約）: `CLAUDE_PLUGIN_ROOT` 明示／未設定（`:-$PLUGIN` フォールバック）どちらでも全緑。

## 既知の制約

- 実インストール環境での `/secretary` ライブ実行は本環境では未実施（rubric 6「未実施の手動確認」）。封じ込め挙動はヘルパー＋スクリプトで実挙動検証した。
- symlink がターゲットとして**境界内**を指す場合は、契約どおり許可し実解決先（境界内）へ書き込む。境界外を指す場合のみ拒否する。
- 本パッチは封じ込め・保護規則の強化のみ。正常系の受入基準・記憶ルールは不変（スコープ外に触れていない）。

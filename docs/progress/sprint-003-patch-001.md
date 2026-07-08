# Progress — sprint-003-patch-001（Codex レビュー指摘対応）

- Type: patch（通常）
- Base: sprint-001〜003（＋各 patch）の配布物
- Status: 実装完了・自己検証済み（Evaluator へ引き渡し）
- 実装者: Generator

## やったこと（High 3・Medium 4・Low 2・F7）

### H1. 封じ込めの基点 symlink 抜け＋しおり系のガード迂回（C5）

- 共有ガード `scripts/lib/path-guard.sh` の `_safe_path` を刷新: **基点（`secretary/`）自身が symlink なら拒否（rc=4）**、`.` /空/`..`・basename の `.`/`..` を拒否、**最深の実在祖先を物理解決してから境界判定**（途中/末尾の symlink 越え・親未実在でも安全に解決）。
- **全導線を同一ガードに統一**: `memory-tools.sh` の署名を `base=$sec` ＋ `rel=memory/…` に変更し、`guarded-write` / `remember-decision` / `delete` / **`resume-write/check/read/clear`** / `reindex` をすべて `_safe_path "$sec" "memory/…"` に通した。`workspace-tools.sh` の `save-deliverable` / `todo-add` / **`todo-list`** も `_safe_path "$sec" "…"` を通す。
- **`mkdir -p` は検証後**にのみ実行（拒否前に外部へディレクトリ/ファイルを作らない）。
- 実装注意: ガード失敗の中断はメインレベルで行う（`refuse` を `$()` 内で呼ぶと subshell しか抜けないため、`x="$(_safe_path …)" || _guard_reject "$?" …` の形に統一）。
- 負テスト（section 10）: `secretary/memory` を外部 symlink にすり替えた状態で guarded-write/remember/resume-write/resume-clear/delete/reindex が **exit 3**、resume-check は「しおり無し」、**外部の実ファイル不変・外部に `_resume.md` 非作成**。`secretary` 自体が symlink でも拒否。

### H2. 再セットアップの破壊リスク（C5）

- ルーター（`secretary/SKILL.md`）の「もう一度セットアップ／作り直したい」を、既存 `secretary/` 検出時は**バックアップ提案＋明示確認を挟む別フロー**へ分岐（無確認で上書き・再初期化しない）。onboarding SKILL 冒頭にも同じ保護（既存があれば作り直さない・バックアップ提案・「はい、作り直してください」の明示時のみ進む）を追加。
- 受入: 手順検査（section 10）でルーター/onboarding にバックアップ提案・明示確認・「無確認で上書き」しない旨があることを assert。

### H3. `git add -A` による秘密情報の履歴化（C5）

- `memory-tools.sh commit` を、`git add -A` の**前に秘密情報を検査**する方式へ。秘密パターン（`password|api_key|secret|token|client_secret = <値>`）を含むファイル、または秘密ファイル名（`*.pem`/`*.key`/`id_rsa`/`.env`/`*credential*`/`*secret*`/`*token*`）を検出したら**コミットを拒否**（exit 3）し、日常語で該当を知らせる。秘密が無ければ従来どおり成功。
- 負テスト: `inbox/creds.txt`（`api_key = …`）がある状態で commit → 拒否・**履歴に入らない**。除去後は通常コミット成功。

### M4. 配布スクリプトの実行方法（C1, C3）

- 同梱スクリプト（`memory-tools.sh`・`workspace-tools.sh`）に実行権限（`chmod +x`）を付与。SKILL の直接実行指示と一致。回帰は `bash "<path>"` 形式（常に有効）。assert `[ -x ]`。

### M5. `save-deliverable` / `todo-list` のガード迂回・先行 mkdir（C5）

- H1 と同一ガードに統一済み。`save-deliverable` は safe check → `mkdir`（symlink なら拒否が先）。`todo-list` も `_safe_path` を通して外向き symlink を読まない。負テストで docs/inbox symlink 時の拒否・外部不変を assert。

### M6. 配布 SKILL の `docs/spec/**` 参照除去（C1, C4）

- onboarding SKILL の `docs/spec/domain.md` / `docs/spec/constraints.md` 参照を削除し、同梱の `secretary/AGENTS.md`（雛形 `${CLAUDE_PLUGIN_ROOT}/templates/AGENTS.md`）へ差し替え。配布物に `docs/spec`・`docs/sprints` 参照ゼロを assert。

### M8. `.mcp.json` の未実装言及（C4）

- `_NOTE` から `setup-microsoft` を除去し「接続の案内は今のところ Google のみ（setup-google）。Microsoft / Notion は後続で対応予定」に修正。

### M9. `reindex` の空白名頑健化（C3）

- `for f in $(ls …)` を **`find -print0 | sort -z` ＋ `while IFS= read -r -d ''`** に変更。負テストで空白入り決定ファイルが索引に追従することを assert。

### F7. `templates/AGENTS.md` の家系メタファー・旧言い換え（C4, C5）

- 「この家」3箇所を「秘書ディレクトリ」に置換。旧「言い換え併記」は残っていないことを確認。回帰のメタファー検出を**「家」系全般**（`秘書の家|この家|お家|おうち`）に拡張し、配布物全体でゼロ件を assert。

## 回帰チェックの実行方法

```bash
bash scripts/regression-check.sh
```

- **実行結果（自己検証）: PASS=199 / FAIL=0（合格）**。sprint-003-patch-001 で section 10（Codex レビュー対応）31 件を追加、section 9 のメタファー検出を家系に統合（-1）＝ 正味 +30。既存 168 assert（＋ patch-002 の 169）は無回帰で全パス。
- フォールバック（`CLAUDE_PLUGIN_ROOT` 未設定）でも全緑。macOS 既定 `/bin/bash` 3.2 互換。push なし・`git remote` 空。

## 骨抜きでないことの確認（負テスト・Generator 実測済み）

- 基点 symlink チェック（`[ -L "$base" ]`）を無効化 → 「secretary 自体が symlink でも拒否」が FAIL。
- H3 秘密スキャンを無効化 → 「秘密情報を含むと commit が拒否」「秘密ファイルが履歴に入っていない」が FAIL。
- いずれも復元で PASS=199 に戻る。

## 受入基準への対応（自己評価）

1. **High 3件**: 満たす（H1 全導線 exit3・外部不変／H2 保護フロー／H3 秘密非履歴化。各負テスト・手順検査パス）。
2. **Medium/Low**: 満たす（M4 exec bit／M5 ガード統一・外部不作成／M6 docs/spec 参照ゼロ／M8 文言／M9 空白名頑健）。
3. **F7**: 満たす（AGENTS.md 家系ゼロ・旧言い換えなし・検出範囲を家系全般に拡張）。
4. **無回帰**: 満たす（既存全パス＋負テスト追加で 169→199）。
5. **副作用ゼロ**: 満たす（拒否時に外部へディレクトリ/ファイル非作成を assert・push なし）。
6. **安全・規律**: 満たす（constraints.md 昇格の不変条件＝基点検証・全導線ガード統一・秘密非履歴化・再セットアップ確認・配布 SKILL の同梱内参照に適合）。

自己採点（rubric 目安）: C1=5 / C3=5 / C4=5 / C5=5 / C6=5。

## Evaluator への検証手順（推奨）

1. 既定: `bash scripts/regression-check.sh` → PASS=199/FAIL=0（section 10 が本パッチの中核）。
2. 手動再現（一時 `secretary/`）: `memory/` を外部 symlink にして各導線が exit3・外部不変／`secretary` 自体 symlink も拒否／`inbox/creds.txt` に `api_key=…` を置いて commit 拒否・非履歴化／docs・inbox symlink で save-deliverable・todo-list 拒否／空白入り決定ファイルで reindex 追従。
3. 骨抜きでないこと: 上記の負テスト（基点チェック無効化・秘密スキャン無効化）で該当 assert が FAIL することを確認。
4. パス解決の両立: `CLAUDE_PLUGIN_ROOT` 明示／未設定どちらでも全緑。

## 既知の制約・スコープ

- 実インストール環境での `/secretary` ライブ確認は本環境では未実施（rubric 6）。封じ込め・秘密検査・再セットアップは決定的シーム＋文言検査で実挙動/手順検査した。
- 新機能（sprint-004 の Microsoft/Notion 等）は追加していない。patch-002 で一掃済みの文言範囲は再修正せず、F7 は `templates/AGENTS.md` の取りこぼしと検出範囲拡張に限定。
- H3 は「秘密検出時はコミット拒否」方式（初期 `.gitignore` 方式は採らず、拒否＋日常語警告で『黙って履歴化しない』を担保）。

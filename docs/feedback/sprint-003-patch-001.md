# Feedback — sprint-003-patch-001（Codex レビュー指摘対応）

- 判定: **合格**
- 評価者: Evaluator
- 評価日: 2026-07-08
- 評価タイプ: 通常 patch（重点 C1/C3/C4/C5/C6・C5 ゼロ許容）

## 総評（3行）

- High 3件（H1 基点 symlink＋全導線ガード統一／H2 再セットアップ保護／H3 秘密情報の非履歴化）は実挙動で塞がれ、Evaluator の独立攻撃でも突破できなかった。Medium/Low（M4-M9）・F7 もすべて是正。
- 封じ込めは共有 `path-guard.sh` に「基点 symlink 拒否＋最深の実在祖先を物理解決してから境界判定」を実装し、memory/workspace 全導線（resume・todo・deliverable 含む）を同一ガードに通す。拒否時に外部へ mkdir/ファイル作成なし・外部実ファイル不変。
- 回帰 168→199 で3モード全緑、新規 section 10 は終了コード＋外部状態＋履歴を検査し骨抜きでない。全受入基準を満たすため合格。

## 各基準のスコア

| # | 基準 | 閾値 | スコア | 判定 |
|---|---|---|---|---|
| C1 | 完成度 | ≥4 | 5 | ✓ M4/M6 是正・High/Medium/Low 網羅 |
| C3 | 機能の実証 | ≥4 | 5 | ✓ H1/H3/M5/M9 を負テスト＋独立攻撃で実証 |
| C4 | 非エンジニア体験 | ≥4 | 5 | ✓ M6/M8/F7 是正・家系メタファー配布物全体ゼロ |
| C5 | 安全・規律 | 5 | 5 | ✓ 基点 symlink・秘密非履歴化・再セットアップ確認・副作用ゼロ |
| C6 | 無回帰 | 5 | 5 | ✓ 既存全パス＋負テスト追加（168→199） |

→ 全基準が閾値以上のため **合格**。

## 証跡

### 1. 回帰再実行（3モード・Evaluator 実行）

```
既定                              : PASS=199  FAIL=0
env -u CLAUDE_PLUGIN_ROOT（fallback）: PASS=199  FAIL=0
/bin/bash 3.2.57（macOS 既定）       : PASS=199  FAIL=0
```
section 10（Codex 対応）は実挙動を検査（例: 基点 symlink 各導線 exit3＋外部 `_resume.md` 非作成、秘密ファイルが `git log --all` に出ない、docs/inbox symlink で拒否＋外部にディレクトリ非作成）。骨抜きでない。

### 2. H1 — 基点 symlink＋全導線ガード統一（C5・Evaluator の独立攻撃）

`secretary/memory` を外部ディレクトリへの symlink にすり替えた状態で、単一クリーン実行:
```
guarded-write=3  remember-decision=3  resume-write=3  resume-clear=3
delete=3  reindex=3  resume-read=3   （resume-check=非ゼロ「しおり無し」扱い）
外部副作用: evil/ の中身は keep のみ（_resume.md 等の作成なし）・外部実ファイル不変
```
- `secretary/` 自体を外向き symlink にしたケースも guarded-write・commit とも **exit 3** で拒否。
- 封じ込めロジック（`path-guard.sh _safe_path`）: (a) `[ -L "$base" ] && return 4`（基点 symlink 拒否）、(b) 最深の実在祖先を `_realpath` で物理解決してから境界照合（途中/末尾 symlink 越えを捕捉）、(c) `_guard_reject` をメインレベルで呼び `refuse` の exit を伝播（`$()` 内 subshell 問題を回避）。`mkdir -p` は検証後にのみ実行。
- （注: Evaluator の最初の結合スクリプト実行で一部導線が exit 2 に見えたが、単一クリーン実行および回帰では一貫して exit 3。前者はテストハーネス側のアーティファクトで、いずれの場合も**外部副作用はゼロ**＝封じ込め自体は常に成立。）

### 3. H2 — 再セットアップの破壊防止（C5・実読）

- ルーター `secretary/SKILL.md` に専用節「作り直し（再セットアップ）の保護」: 既存 `secretary/` があれば**いきなり作り直さない・無確認で上書き/再初期化しない**。①置き換わることを伝える→②バックアップ提案（`cp -R secretary secretary.backup-YYYY-MM-DD`・トークン混入確認）→③「はい、作り直してください」と**明示**時のみ onboarding へ。
- onboarding SKILL.md 冒頭「既に秘書ディレクトリがある場合の保護」: 同様に無確認で上書き・再 `git init` せず、明示確認時のみ進行・それ以外は中断。
- grep 満たしだけの文言でなく、分岐フローとして成立。

### 4. H3 — 秘密情報の非履歴化（C5・独立攻撃＋偽陽性確認）

- `memory-tools.sh commit` は **`git add -A` の前**（L200-207）に秘密検査。秘密パターン（`password|api_key|secret|token|client_secret` ＋ `:=` ＋ 6文字以上の値）または秘密ファイル名（`*.pem`/`*.key`/`id_rsa`/`.env`/`*credential*`/`*secret*`/`*token*`）を検出したら **exit 3** で拒否。
- Evaluator 実測:
  - `inbox/creds.txt`（`api_key = ABCDEF123456`）→ commit exit 3・`git log --all` に creds.txt **入っていない**。
  - 秘密ファイル名 `inbox/id_rsa` → exit 3 で拒否。
  - **偽陽性なし**: `decisions/…md` に日本語「OAuth（トークン＝接続用の合言葉）」・通常の preferences.md を含む状態で commit → **rc=0 で成功**（日本語「トークン」は `:=値` パターンに一致せず誤拒否しない）。除去後の通常コミットも成功。

### 5. M4-M9・F7（Evaluator 確認）

| 指摘 | 確認結果 |
|---|---|
| M4 実行権限 | memory-tools.sh・workspace-tools.sh とも `-rwxr-xr-x` |
| M5 ガード迂回・先行 mkdir | docs/inbox を外向き symlink にすると save-deliverable・todo-add は exit 3、todo-list は非ゼロ（外部を読まない）、**外部にディレクトリ/ファイル非作成** |
| M6 docs/spec 参照 | `grep -rn 'docs/spec\|docs/sprints' plugins/cc-secretary/` → **0件** |
| M8 .mcp.json | `setup-microsoft` 不在。「接続の案内は今のところ Google のみ（setup-google）、Microsoft / Notion は後続で対応予定」に修正済み |
| M9 空白名頑健化 | `reindex` を `find -print0＋sort -z＋while read -d ''` 化。空白**2つ**入り `2026-07-09 メモ 付-decisions.md` でも索引に追従（rc=0） |
| F7 templates/AGENTS.md | 家系（`秘書の家\|この家\|お家\|おうち`）・旧「言い換え併記/専門用語は必ず」ともゼロ件。配布物全体でも家系メタファーゼロ件 |

### 6. 副作用ゼロ・安全・無回帰

- 拒否時に外部へディレクトリ/ファイルが作られない（H1/M5 で確認）。
- `.sh` スクリプトに実際の `git push`/`git remote add` コマンドなし（0件。SKILL 内の「push はしません」は説明文）。`git remote` 空。
- `~/workspace/agentic-harness`（Jul 2 16:08）・`~/workspace/inbox/company`（Jun 23 11:11）とも不変＝非書込。検証は scratchpad のみ。
- 単段クレジット（forkedFrom=Shin-sibainu/cc-company・中間フォーク非掲載）維持。
- 既存 assert（生成物構造・保護・出力規約・git・文言一掃）は全パス＝振る舞い不変。

## 残課題（ブロッカーではない）

- 実インストール環境での `/secretary` ライブ確認は本環境で不可（rubric 6「未実施の手動確認」）。封じ込め・秘密検査・空白名は決定的シームで実挙動検証、再セットアップ保護は手順（分岐フロー）検査とした。
- H3 の秘密ファイル名検出（`*token*`/`*secret*`/`*credential*`）は保守的で、万一ユーザーが「トークンの覚書.md」等の日本語ファイル名を作ると commit が止まりうる（安全側の誤検出）。実害は「止まって警告が出る」だけで秘密漏洩方向ではないため許容。将来 UX を詰めるなら、日本語ファイル名の扱いを緩めるか警告文で回避手順を添えると親切（任意）。

## 付録: 回帰チェック要点

```
== 1〜9 ==  全PASS（マニフェスト/単段クレジット・5スキル構文・生成物6規律・git・体験・安全・
              記憶ケア封じ込め・出力規約・文言一掃）
== 10. Codex レビュー対応 ==  全PASS
   （H1 基点symlink全導線 exit3＋外部不変／H3 秘密非履歴化・正常commit成功／
    M5 docs/inbox symlink 拒否・外部不作成／M9 空白名索引追従／M4 exec bit／
    M6 docs/spec 参照ゼロ／M8 .mcp.json 文言／H2 再セットアップ保護／F7 AGENTS.md 家系ゼロ）
== 結果 ==  PASS=199  FAIL=0
```

# Feedback — sprint-002-patch-001（記憶ツールの封じ込めハードニング / Type: micro）

- 判定: **合格**
- 評価者: Evaluator
- 評価日: 2026-07-08
- 評価タイプ: micro 軽量評価（機能完全性・動作安定性・無回帰の3基準）

## 総評（3行）

- 前回再評価で残したハードニング2点（symlink 越え書き込み／`delete "."` の偽装成功）は、`_realpath` による symlink 完全解決＋境界に `/` を付けた接頭辞照合＋エッジ rel 早期拒否で**塞がれ、Evaluator の再攻撃でも突破できなかった**。
- 正常系（記憶追加・更新・削除・索引・しおり・節目コミット）は過剰拒否なく従来どおり成功。境界内を指す symlink は契約どおり許可。
- 回帰は 98→111（+13）で両モード全緑。追加 assert は exit 3 と境界外ファイル内容不変の両方を検査し骨抜きでない。push なし・harness 非書込。全 micro 基準を満たすため合格。

## 各基準の判定（micro）

| # | 基準 | 判定 | 根拠 |
|---|---|---|---|
| 1 | symlink 越え書き込み/削除の拒否（安全ゼロ許容） | ✓ | 最終要素・中間ディレクトリとも exit 3・境界外実ファイル不変 |
| 2 | エッジ rel の非偽装（安全ゼロ許容） | ✓ | `.`/空/`..`/`../x` 等すべて非ゼロ拒否・成功報告なし・境界内副作用なし |
| 3 | 正常系の温存（動作安定性） | ✓ | 記憶追加/更新/削除/索引/しおり/節目コミットが成功・境界内 symlink 許可 |
| 4 | 無回帰（ゼロ許容） | ✓ | 既存 98 assert 温存＋13 追加＝111 全パス・push なし・次機能混入なし |

## 証跡

### 1. 回帰再実行（Evaluator 実行）

`bash scripts/regression-check.sh` → **PASS=111 / FAIL=0**（既定）。`env -u CLAUDE_PLUGIN_ROOT`（フォールバック）でも全緑。98→111 の +13 は section 7 の symlink 越え（最終要素・中間ディレクトリ／書き込み・削除）とエッジ rel の負テスト。

新規 assert（`scripts/regression-check.sh` L335-364）は骨抜きでない:
- symlink 最終要素の書き込み/削除を **exit 3** かつ外部実ファイル `EXTERNAL-ORIGINAL` 不変で assert。
- 中間ディレクトリ symlink の書き込みを exit 3 かつ外部不変で assert。
- エッジ rel（`.`/空/`..`/`../x`）を loop で非ゼロ拒否・`preferences.md` 副作用なしで assert。
終了コードだけでなく境界外ファイルの実状態を検査しているため、封じ込めの実効を保証している。

### 2. 封じ込めロジックの読解（`_safe_path` / `_realpath`, memory-tools.sh L29-82）

- `_realpath`: 最終要素の symlink を `readlink` で辿り切り（ループ保護40回）、中間ディレクトリは `cd + pwd -P` で物理解決。`realpath` 非依存で可搬。
- `_safe_path`: (1) 空/`.`/`..` を早期拒否、(2) `..` セグメント拒否、(3) basename が `.`/`..` を拒否、(4) 実解決先 `real` を求め、(5) `case "$real/" in "$baseabs"/*` で **境界に `/` を付けて接頭辞照合**（`base` 自身も除外）。前方一致衝突（`memory-evil`）を排除している。

### 3. Evaluator の再攻撃（原本無変更・scratchpad 上）— すべて拒否

**symlink 越え（最終要素）**
```
ln -s <外部> memory/link_final.md
guarded-write <sec> link_final.md   → exit 3・外部 EXTERNAL-ORIGINAL 不変
delete <sec> link_final.md --confirm → exit 3・外部実体は残る
```
**symlink 越え（中間ディレクトリ）**
```
ln -s <外部dir> memory/evil_dir
guarded-write <sec> evil_dir/real.txt → exit 3・外部不変
delete <sec> evil_dir/real.txt --confirm → exit 3・外部残存
```
**エッジ rel**（`delete`／`guarded-write`）
```
rel = "." / "" / ".." / "../x" / "../../etc" / "a/../.."
→ すべて非ゼロ（"" と引数不足は exit 2、それ以外は exit 3）で拒否・「成功」報告なし
→ 前回 exit 0 で偽装成功していた delete "." は今回 exit 3 に修正済み
→ 境界内の preferences.md は健在（副作用なし）
```
**前方一致の接頭辞衝突（`secretary/memory-evil/`）**
```
delete <sec> "../memory-evil/x.txt" --confirm → exit 3・memory-evil 健在
ln -s <secretary/memory-evil> memory/toevil
guarded-write <sec> "toevil/x.txt"           → exit 3・memory-evil ファイル不変
```

### 4. 正常系の温存（過剰拒否でないこと）

範囲内の操作はいずれも成功（rc=0）:
- `remember-decision <sec> 2026-07-11 "…"` → 決定ファイル作成・索引追従
- `guarded-write <sec> preferences.md`（非空）→ 更新反映
- `reindex` → 索引再生成（2行）
- `delete <sec> decisions/…-decisions.md --confirm` → 削除＋索引追従
- `resume-write` → `resume-read` で復元 → `resume-clear`
- `commit <sec> "記憶を更新（…）"` → ローカルコミット
- **境界内を指す symlink** `memory/inside_link.md`（→ `memory/sub/target.md`）への `guarded-write` は契約どおり **rc=0 で許可**し、実解決先（memory 配下）に反映。境界外のみ拒否で、境界内 symlink を過剰に弾かない。

### 5. 安全・無回帰

- push なし: `git remote` 空・upstream なし。ヘルパーに `git push`/`git remote add` が静的に無い。
- `~/workspace/agentic-harness`（Jul 2 16:08）・`~/workspace/inbox/company`（Jun 23 11:11）とも不変 → 非書込。Evaluator の検証は scratchpad のみ。
- 既存 98 assert 温存＋新規13＝111 全パス。次スプリント機能の混入なし。単段クレジット・6規律・`${CLAUDE_PLUGIN_ROOT}` 参照は section 1/2/6 で維持。

## 残課題（ブロッカーではない）

- 実インストール環境での `/secretary` ライブ実行は本環境で不可（rubric 6「未実施の手動確認」）。封じ込め挙動はヘルパー＋スクリプトで実挙動検証した。
- 今回の再攻撃（symlink 最終/中間・エッジ rel・接頭辞衝突・境界内 symlink 許可）ではすり抜けを検出せず。前回の残存2点は解消済みで、追加の残存指摘はなし。

## 付録: 既定モードの回帰チェック要点

```
== 1〜6 ==  全PASS（マニフェスト/単段クレジット・memory-care構文・生成物6規律・git・体験・安全）
== 7. 記憶ケア ==  全PASS（索引追従・空上書き拒否・削除前警告・トラバーサル封じ込め・symlink越え拒否(最終/中間)・エッジrel非偽装・しおり往復・節目コミット日本語/push なし）
== 結果 ==  PASS=111  FAIL=0
```

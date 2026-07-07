# Feedback — sprint-001-patch-002（過度な平易化の一掃・文言規約の改訂反映）

> **最新判定（再評価 2026-07-08 / 2回目）: 合格。** 詳細は末尾「## 再評価（2回目・2026-07-08）」。
> 前回ブロッキング（marketplace.json の「秘書の家」残存）は修正・検証済み。回帰 assert も配布物全体へ範囲拡張。
> 以下は 1回目（不合格）の記録。差し戻し経緯として残す。

---

## 初回評価（1回目・2026-07-08）

- 判定: **不合格（差し戻し）**
- 評価者: Evaluator
- 評価日: 2026-07-08
- 分類: **implementation-issue（ブロッキング）＋ 回帰カバレッジ欠落 ＋ 契約スコープ要調整**

## 総評（3行）

- SKILL群・templates・`rules/plain-language.md` の全面書き換え・plugin.json の一掃は網羅的で質が高く、改訂 ui.md 準拠・逆方向の劣化（具体例や3行型を捨てて不親切化）もない。
- ただし配布物の一つ **`.claude-plugin/marketplace.json` の `metadata.description` に「秘書の家（secretary/）ができ」が残存**（同文に「秘書だけがローカルに住む」の擬人化も残る）。team-lead 指定の検証 `grep -rn "秘書の家" plugins/ .claude-plugin/` が**ゼロ件でない**。
- 受入基準1（メタファー一掃・C5 ゼロ許容）に反するため不合格。加えて回帰 section 9 の「秘書の家」不在 assert が `plugins/cc-secretary` しか検査しておらず、この残存を検出できていない（カバレッジ欠落）。修正は一文の置換＋assert 範囲拡張の小規模。

## 各基準のスコア（rubric.md 準拠）

| # | 基準 | 閾値 | スコア | 判定 |
|---|---|---|---|---|
| C1 | 完成度（一掃の網羅性） | ≥4 | 4 | △ marketplace.json を除き網羅 |
| C4 | 非エンジニア体験（語彙適合） | ≥4 | 4 | △ plain-language は適合・marketplace description が非適合 |
| C5 | 安全・規律（メタファー一掃 ゼロ許容） | 5 | **3** | ✗ 配布物に「秘書の家」残存 |
| C6 | 無回帰 | 5 | 5 | ✓ 既存 156 assert 全パス（ただし新 assert に範囲欠落） |

→ C5 が閾値（5・ゼロ許容）を下回るため **不合格**。

## 証跡

### 1. 【ブロッキング】配布物に「秘書の家」が残存（受入1・C5 ゼロ許容）

team-lead 指定の検証コマンドを実行:
```
$ grep -rn "秘書の家" plugins/ .claude-plugin/
.claude-plugin/marketplace.json:7:    "description": "…秘書だけがローカルに住む。数問のオンボーディングで秘書の家（secretary/）ができ、git init まで完了する。"
$ echo $?
0      # マッチあり＝残存（ゼロ件でない）
```
- `.claude-plugin/marketplace.json`（リポジトリ直下）はマーケットプレイス定義で、`metadata.description` は**ユーザーが `marketplace add` 時に見るカタログ説明**＝配布物のユーザー向け文言。ここに「秘書の家」が残っている。
- 同じ一文の「**秘書だけがローカルに住む**」も、plain-language.md L16 が禁じる「住まい・擬人化の比喩」に該当（同クラス）。
- 対照的に `plugins/cc-secretary/.claude-plugin/plugin.json` の description は「秘書ディレクトリ（secretary/）」に修正済み。また marketplace.json の `plugins[0].description`（L13）も「都度参照する。」で問題なし。**metadata.description（L7）だけが取り残されている。**

### 2. 【カバレッジ欠落】回帰 section 9 の一掃 assert が marketplace.json を検査していない（C6・要修正）

`scripts/regression-check.sh` section 9:
```
check "配布物に『秘書の家』が無い（ゼロ件）" "! grep -rq '秘書の家' '$PLUGIN'"   # $PLUGIN = plugins/cc-secretary のみ
```
`$PLUGIN`（=`plugins/cc-secretary`）だけを対象にしており、**リポジトリ直下 `.claude-plugin/marketplace.json` を検査対象に含めていない**。このためユーザー向け配布物に「秘書の家」が残っていても PASS=168 が緑になる。骨抜きではないが、検査範囲が team-lead の一掃基準（`plugins/` ＋ `.claude-plugin/`）より狭い。修正時に marketplace.json も対象に含めること。

### 3. 【契約スコープの要調整・spec-issue 候補】受入1 の grep 範囲

- 契約 `sprint-001-patch-002.md` 受入1（L49）は対象を「`plugins/**`・`templates/**`」と定義し、リポジトリ直下 `.claude-plugin/marketplace.json` を明示に含めていない。文字どおりに読めば marketplace.json は対象外とも解釈できる。
- 一方 team-lead の評価指示は「`grep -rn "秘書の家" plugins/ .claude-plugin/` がゼロ件（**配布物全体**）」と明記し、marketplace.json を含む。実体としても marketplace.json はユーザー向け配布物であり、パッチの主眼「文言方針を**既存の配布物すべてに反映**」（契約 L6）に照らして対象とすべき。
- よって本評価は team-lead 指示・パッチ主眼に従い marketplace.json を対象に含めて不合格とする。再発防止のため、Planner が受入1 の対象を「`plugins/**`・`templates/**`・`.claude-plugin/marketplace.json`」に明確化することを推奨。

### 4. 合格している部分（実読・確認済み）

- **plain-language.md（C4・逆方向劣化なし）**: 改訂 ui.md 準拠に全面書き換え。「そのまま使う語」リスト（ディレクトリ・フォルダ・コミット・コネクタ・TODO 等）・「初出のみ補足する語」リスト（OAuth・リポジトリ・frontmatter・MCP・トークン・環境変数）・「過度な平易化はしない」明記・幼稚メタファー禁止（`secretary/`＝秘書ディレクトリ）を掲載。同時に**日常語＋具体例の親切さは維持**（3行型、選択は「悪い例:認証方式は？／良い例:見る人を制限しますか？…」、英語エラー翻訳の例つき）。不親切化していない。
- **旧語彙型の撤廃（受入2・C4）**: `grep -rn "言い換え併記|専門用語は必ず|言い換えを併記|やさしい言葉ルール" plugins/ templates/ .claude-plugin/` → **0件**。各 SKILL 冒頭も新方針表現に更新。呼称「言葉づかいルール」に統一。
- **呼称統一（受入3・C1）**: onboarding 完了報告は「秘書ディレクトリ（secretary/）を作成しました」（改訂 ui.md L26 の例準拠）。templates/memory も更新。plugin.json description 修正済み。
- **振る舞い不変（受入4・C3）**: 生成物構造・記憶保護・封じ込め・出力規約・git 導線の assert（section 3〜8）は全パス＝文言変更で機能は壊れていない。回帰 156→168、既定・フォールバック両モードで全緑。
- **安全（受入5・C5 部分）**: `~/workspace/agentic-harness`（Jul 2 16:08）・`~/workspace/inbox/company`（Jun 23 11:11）とも不変＝非書込。単段クレジット（forkedFrom=Shin-sibainu/cc-company・中間フォーク非掲載）維持。`git remote` 空・push なし。

## 修正指示（Generator 向け・implementation-issue）

**必須（ブロッキング）**
1. `.claude-plugin/marketplace.json` の `metadata.description`（L7）から「秘書の家」を除去し、「秘書ディレクトリ（secretary/）」表記へ。同文の擬人化「秘書だけがローカルに住む」も plain-language.md L16 の方針に合わせて実体表現に直す（例:「記憶と成果物はローカルの秘書ディレクトリに置き…」等）。
2. `scripts/regression-check.sh` section 9 の一掃 assert の対象を `$PLUGIN` から**配布物全体**（`plugins/cc-secretary` ＋ リポジトリ直下 `.claude-plugin/marketplace.json`）へ広げ、`grep -rn "秘書の家" plugins/ .claude-plugin/` がゼロ件であることを assert する（`お家/おうち`・住まい擬人化も同様に）。骨抜き（範囲狭め）を解消する。
3. 再実行で `grep -rn "秘書の家" plugins/ .claude-plugin/ templates/` が0件・回帰全緑を確認し progress 更新。

**推奨（オーケストレーター経由で Planner へ・spec-issue）**
4. 契約受入1 の対象範囲に `.claude-plugin/marketplace.json` を明記（再発防止）。

## 再提出時の確認観点（Evaluator）

- `grep -rn "秘書の家\|お家\|おうち\|ローカルに住む" plugins/ .claude-plugin/ templates/` → 0件。
- 回帰 section 9 の一掃 assert が marketplace.json を含む（狭めた assert でないこと）。
- 振る舞い不変（既存 assert 全緑）・push なし・単段クレジット維持。

## 付録: 回帰チェック結果

```
既定                              : PASS=168  FAIL=0
env -u CLAUDE_PLUGIN_ROOT（fallback）: PASS=168  FAIL=0
```
（注: PASS=168 は緑だが、§2 のとおり section 9 の一掃 assert が `.claude-plugin/marketplace.json` を検査範囲に含めていないため、この数値だけでは受入1（配布物全体の「秘書の家」ゼロ件）を保証しない。）

---

## 再評価（2回目・2026-07-08）

- 判定: **合格**
- 評価者: Evaluator
- 評価日: 2026-07-08

### 総評（3行）

- 前回ブロッキング（`.claude-plugin/marketplace.json` の「秘書の家」残存）は修正済み。metadata.description・plugins[0].description とも改訂 ui.md 準拠に書き直され、「秘書の家」「ローカルに住む」擬人化が消えた。
- 回帰の一掃 assert が配布物全体（`plugins/cc-secretary` ＋ リポジトリ直下 `.claude-plugin` ＋ `LICENSE`）を対象に拡張され、marketplace.json を検査範囲に含む。Evaluator が改竄コピーで assert の歯を直接確認。
- 全受入基準を満たすため合格。前回合格済みの SKILL群・templates・plain-language の語彙適合は据え置き。

### 各基準スコア（再採点）

| # | 基準 | 閾値 | 前回 | 今回 | 判定 |
|---|---|---|---|---|---|
| C1 | 完成度（一掃網羅性） | ≥4 | 4 | **5** | ✓ 配布物全体を一掃 |
| C4 | 非エンジニア体験 | ≥4 | 4 | **5** | ✓ marketplace description も適合 |
| C5 | 安全・規律（一掃ゼロ許容） | 5 | 3 | **5** | ✓ 配布物に「秘書の家」ゼロ件 |
| C6 | 無回帰 | 5 | 5 | **5** | ✓ 既存全パス・assert 範囲拡張 |

→ 全基準が閾値以上のため **合格**。

### 証跡

#### 1. marketplace.json の一掃を実読で確認

- `metadata.description`（L7）: 「…記憶と成果物はローカルの**秘書ディレクトリ（secretary/）**に置く。数問のオンボーディングで**秘書ディレクトリ**を作り、git init まで完了する。」→「秘書の家」「ローカルに住む」なし。
- `plugins[0].description`（L13）: 「…外部データは公式コネクタで都度参照する。」→ 問題なし。

配布物全体の grep:
```
$ grep -rn "秘書の家\|お家\|おうち\|ローカルに住む\|に住む" plugins/ .claude-plugin/ templates/
（0件）
```
team-lead 指定の `grep -rn "秘書の家" plugins/ .claude-plugin/` もゼロ件。

#### 2. 回帰 assert の範囲拡張と実効性（骨抜きでない）

`scripts/regression-check.sh` L494-498:
```
DIST=("$PLUGIN" "$REPO/.claude-plugin" "$REPO/LICENSE")
check "配布物に『秘書の家』が無い（ゼロ件・marketplace.json 含む）" "! grep -rq '秘書の家' \"\${DIST[@]}\""
check "配布物に『お家/おうち』が無い（同種比喩ゼロ）" "! grep -rqE 'お家|おうち' \"\${DIST[@]}\""
check "配布物に住まい擬人化『ローカルに住む』が無い" "! grep -rq 'ローカルに住む' \"\${DIST[@]}\""
```
`DIST` にリポジトリ直下 `.claude-plugin`（marketplace.json を含む）を追加。前回の「`$PLUGIN` のみ」というカバレッジ欠落を解消。

**歯の直接証明（Evaluator・原本無変更）**: marketplace.json に「秘書の家」を混入した一時コピーに検査ロジックを走らせると `! grep -rq '秘書の家'` が **FAIL（残存を検知）**。本物の `.claude-plugin` では PASS。範囲を狭めた骨抜きではない。

#### 3. 回帰の全緑（3モード）

```
既定                              : PASS=169  FAIL=0
env -u CLAUDE_PLUGIN_ROOT（fallback）: PASS=169  FAIL=0
/bin/bash 3.2.57（section 9 の配列使用含む）: PASS=169  FAIL=0
```
168→169 は「ローカルに住む」擬人化 assert の追加。既存 assert（生成物構造・保護・封じ込め・出力規約・git）は全パス＝振る舞い不変。

#### 4. 据え置き確認（前回合格分）

- 旧語彙型 `言い換え併記|専門用語は必ず|言い換えを併記|やさしい言葉ルール` → 配布物全体で 0件。
- plain-language.md は改訂 ui.md 準拠（そのまま使う語／初出補足語リスト・過度な平易化をしない・逆方向劣化なし）。
- 安全: `~/workspace/agentic-harness`（Jul 2 16:08）・`~/workspace/inbox/company`（Jun 23 11:11）とも不変＝非書込。単段クレジット（forkedFrom=Shin-sibainu/cc-company・中間フォーク非掲載）維持。生成物側 push なし。

### 引き継ぎ（オーケストレーター向け）

- sprint-001-patch-002 は受理可能。
- 前回 feedback §3 の spec-issue 提案（契約受入1 の対象範囲に `.claude-plugin/marketplace.json` を明記）は、実装・回帰側が配布物全体を対象化したことで実運用上は解消。正本の文言も合わせて更新しておくと将来の patch で範囲解釈がぶれない（Planner 判断）。

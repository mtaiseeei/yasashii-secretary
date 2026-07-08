# Feedback — sprint-005（やさしいハーネス同梱＋開発の入口 build）

- 判定: **合格**
- 評価者: Evaluator
- 評価日: 2026-07-08
- 評価タイプ: 通常フル評価（6基準）

## 総評（3行）

- 最優先の「元リポジトリ `~/workspace/agentic-harness` 非改変（C5 ゼロ許容）」を、git status 空・HEAD 不変・sha256 マニフェスト完全一致・複製先 symlink ゼロで多重に確認。元は一切変更されていない。
- 複製の忠実性が高い: 内部契約テンプレ（harness/templates・init-guidance.sh）は元と**バイト一致**、harness-loop は**進行表示9行の追加のみ**で権限テーブル・Status 語彙・閾値・Scope Change Gate を完全維持、evaluator の rubric 6軸・閾値も保持。平易化3点・build 導線・重複一元化・hooks 非衝突も成立。
- 回帰 230→266 で3モード全緑。全12受入基準（A〜D）を満たすため合格。

## 各基準のスコア

| # | 基準 | 閾値 | スコア | 判定 |
|---|---|---|---|---|
| C1 | 完成度 | ≥4 | 5 | ✓ 配置衝突回避・build 入口 |
| C2 | 構文・整合 | 5 | 5 | ✓ agents name 一意・bash -n・デッドリンクなし |
| C3 | 機能の実証 | ≥4 | 5 | ✓ build 導線・hooks 非衝突 |
| C4 | 非エンジニア体験 | ≥4 | 5 | ✓ 平易化3点・境界要素の内部値維持＋言い換え併置 |
| C5 | 安全・規律 | 5 | 5 | ✓ **元リポジトリ非改変**・恒久不変条件・単段クレジット |
| C6 | 無回帰 | 5 | 5 | ✓ 既存 230 assert 全パス＋36 追加 |

→ 全基準が閾値以上のため **合格**。

## 証跡

### 1. 【最優先・C5】元リポジトリ `agentic-harness` 非改変（受入A1）

Evaluator が独立に複数手段で確認（作業前後とも）:
```
$ git -C ~/workspace/agentic-harness status --porcelain        → 空（クリーン）
$ git -C ~/workspace/agentic-harness rev-parse HEAD            → 56ce6938cd76111dcb050ee8ed51f28a3e1a79db（記録値と一致）
$ stat ~/workspace/agentic-harness                            → 最終更新 Jul 2 16:08（本セッション前・不変）
$ (cd ~/workspace/agentic-harness && find . -type f -not -path './.git/*' -print0 | sort -z | xargs -0 shasum -a 256) \
    | diff - scripts/harness-source-baseline.sha256           → 差分なし（22ファイル完全一致）
```
- git status/HEAD/timestamp はベースラインファイルと独立の証拠であり、これ単体で真の非改変を裏づける（ベースラインの出所に依存しない）。
- **複製先から元への symlink・書き込み参照なし**: `find plugins/cc-secretary/{agents,harness,skills/build} -type l` → 0件（regular file のみ）。`grep -rn 'workspace/agentic-harness' plugins/` → 0件。
- 回帰の A1 assert（sha256 一致・HEAD 一致・porcelain 空・symlink なし）も骨抜きでない（実マニフェスト照合）。

### 2. 複製の忠実性・名前空間（受入A2・A3）

- **内部契約テンプレは元とバイト一致**（`diff -q` 一致）: `harness/templates/AGENTS.md`・`harness/templates/CLAUDE.md`・`harness/templates/docs/harness-guidance.md`・`harness/scripts/init-guidance.sh`。AI 向け内部契約をそのまま維持。
- **名前空間の分離**: `harness/templates/AGENTS.md`（英語「Harness-Driven Development」＝開発対象プロジェクト用ハーネス契約）と `templates/AGENTS.md`（日本語「秘書への指示」＝秘書ワークスペース用）は**別ディレクトリ・別内容**（`diff` 相違）。混同・上書きなし。
- **構文有効性**: agents（planner/generator/evaluator）frontmatter 有効・name 一意、harness-loop name 有効、`init-guidance.sh` は `bash -n` 通過・exec bit（`-rwxr-xr-x`）。複製物の `${CLAUDE_PLUGIN_ROOT}` 参照は全実在（デッドリンクなし）。

### 3. 内部契約の非破壊（harness-loop の diff・重点）

`diff <元 harness-loop> <複製>` の**全差分は9行の追加のみ**（`18a19,27`）＝「## 進行の見せ方（ユーザー向け・cc-secretary）」節の挿入だけ。削除・改変ゼロ。追加節自体が「このループの内部（ファイル規約・Status 語彙・閾値・Scope Change Gate）は技術的文脈のまま維持する」と明記。
- 内部契約キーワードの残存（複製側）: `state.md` 24・`Status` 10・`patch` 21・`awaiting-eval` 3・`Scope Change` 2・`micro` 4・書き込み権限3・`implementation-issue`/`spec-issue` 各1。権限テーブル・閾値・語彙が壊れていない。
- evaluator の閾値テーブルも元と同一（「既定閾値」表・「回帰なし 5（必須）」・「1つでも閾値を下回れば不合格」）を維持。

### 4. 平易化3点（受入B4・B5・B6）

- **(1) ヒアリング日常語化**: planner に「ヒアリングは日常語＋具体例・専門用語だけの問いにしない」＋「悪い例:『認証方式は？』→良い例:『見る人を制限しますか？ 誰でも見られる／招待した人だけ』」。
- **(2) 報告の型固定**: planner/generator/evaluator の3エージェントが `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` を参照。
- **(3) 進行の見せ方**: planner/generator/evaluator/harness-loop/build のすべてに「計画→実装→検証（＝計画→道具→確認→結果）」の進行宣言。

### 5. build 導線（受入C7）

- `skills/build/SKILL.md`（frontmatter 有効）が harness-loop・3エージェント・`init-guidance.sh`・plain-language を `${CLAUDE_PLUGIN_ROOT}` 相対で参照。全参照先が実在（デッドリンクなし）。進行宣言あり。
- ルーターに「作って／開発したい／アプリ・ツールにして」→ build の段階ロードを追加（旧「準備中」から接続）。build 以外に残る「準備中」なし。

### 6. 横断（受入D8・D9・D10・D11）

- **D8 家系メタファー**: 複製のユーザー向け文言（agents/build/harness-loop）に `秘書の家|この家|お家|おうち` **ゼロ件**。境界要素: evaluator は rubric の6軸・閾値・証跡ルールの**内部値・軸名を維持**（「内部の値・軸名は維持する（平易化して壊さない）」と明記）しつつ、ユーザー提示に平易な言い換えを併置。
- **D9 重複の一元化**: 平易化文言を `rules/plain-language.md` に集約し、planner/generator/evaluator/build/harness-loop の**5面から参照**（フルコピーを増やさず pointer 参照）。
- **D10 hooks 非衝突**: 設計判断＝ハーネスの hooks を**複製しない**。cc-secretary に `hooks.json`・`session-start.sh` 不在、プラグイン定義に `SessionStart` 登録なし → 二重起動・干渉なし。build を明示入口にする構成。
- **D11 恒久不変条件**: 配布物は `${CLAUDE_PLUGIN_ROOT}` 相対。**M6 の再スコープは正当**（骨抜きでない）— 秘書ユーザー向け `skills/`・`rules/` の docs/spec 参照は**ゼロ**（build 含む）、docs/spec 参照はハーネス内部契約（agents/harness/＝開発対象プロジェクトの docs/spec を指す AI 向け契約）のみで、契約の語彙線引き（内部契約は技術維持）に合致。封じ込め・秘密非履歴化は既存 section で維持、単段クレジット（forkedFrom=Shin-sibainu/cc-company）維持。

### 7. 無回帰（受入12・C6）

```
既定                              : PASS=266  FAIL=0
env -u CLAUDE_PLUGIN_ROOT（fallback）: PASS=266  FAIL=0
/bin/bash 3.2.57（macOS 既定）       : PASS=266  FAIL=0
```
230→266 の +36 は section 12（sprint-005）＋section 2 の build 存在・name。既存 230 assert（sprint-001〜004＋各 patch）は全パス。push なし・`git remote` 空。

## 残課題（ブロッカーではない）

- ハーネスの実ループ起動（実際に planner→generator→evaluator を回す）は本環境で未実施（dispatch は Claude 実行時）。導線・複製物の構文/参照・非改変・平易化・内部契約の忠実性は静的検証＋diff＋ドライランで担保した。実運用前に一度ライブでループが回ることを確認するのが望ましい。
- M6 の再スコープはオーケストレーター経由で Planner が spec に明文化しておくと、将来「配布 SKILL の docs/spec 非参照」の解釈が「秘書ユーザー向け skills/rules に限る（ハーネス内部契約は開発対象の docs/spec を指すため対象外）」でぶれない（推奨・任意）。

## 付録: 回帰チェック要点

```
== 1〜11 ==  全PASS（既存: マニフェスト/単段クレジット・8スキル構文・生成物6規律・git・体験・安全・
               記憶ケア封じ込め・出力規約・文言一掃・Codex 対応・接続拡張）
== 12. やさしいハーネス同梱＋build ==  全PASS
   （A1 非改変〔sha256/HEAD/porcelain/symlink〕・A2 構文/name/デッドリンク・A3 名前空間分離・
    B4 ヒアリング具体例・B5 plain-language 参照・B6 進行宣言・C7 build 入口/ルーター接続・
    D8 家系ゼロ/rubric 内部値維持・D9 5面一元化・D10 hooks 非衝突）
== 結果 ==  PASS=266  FAIL=0
```

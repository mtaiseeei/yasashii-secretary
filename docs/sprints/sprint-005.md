# Sprint 005 — やさしいハーネス同梱と開発の入口（build）

- Phase: P3（開発機能）
- 主眼: `~/workspace/agentic-harness` を**複製**して cc-secretary に同梱し、非エンジニア向けに**平易化3点**を適用したうえで、開発依頼の入口 `skills/build/` から起動できるようにする。
- 依存: sprint-001〜004（＋各 patch）。特にルーター・記憶・`rules/plain-language.md`・恒久不変条件。
- **絶対ルール（最優先）**: `~/workspace/agentic-harness` は**変更禁止**（読むだけ）。同梱物は必ずこのリポジトリ内に**複製**して改変する。

## なぜこのスプリントか

Phase 3 の中核。ここまでの秘書コア（記憶・daily・接続）に「開発もできる」を足す。非エンジニアが「〇〇を作って」と言うと、計画→実装→検証のループ（Planner→Generator→Evaluator）が**進行を見せながら**回る。裏側の技術的な契約（docs/spec・sprint）は AI が理解しやすいよう維持し、**人の目に触れる文言だけ**をやさしくする。

## 複製元の構造（実測・読み取り専用）

`~/workspace/agentic-harness/plugins/harness/` が本体（全体で 22 ファイル・約 1900 行と中規模）。

- `agents/planner.md`(281) / `generator.md`(111) / `evaluator.md`(148) — エージェント定義。frontmatter（name/description/tools）＋本文。
- `skills/using-harness/SKILL.md`(71) — 入口スキル。`skills/harness-loop/SKILL.md`(281) — ループ手順書。
- `commands/harness.md`(64) — 明示起動コマンド。
- `templates/AGENTS.md`(103) / `CLAUDE.md`(95) / `docs/harness-guidance.md`(41) — 生成先プロジェクトに渡すハーネス契約テンプレ。
- `scripts/init-guidance.sh`(107)、`hooks/`（session-start.sh 36・hooks.json 16）。
- プラグイン基盤: `.claude-plugin/plugin.json`(19)、`.codex-plugin/plugin.json`(36)、`marketplace.json` 群。

## 複製対応表（何を複製し／平易化し／そのまま維持し／複製しないか）

| 元（`agentic-harness/plugins/harness/`） | 複製先（`plugins/cc-secretary/`） | 扱い |
|---|---|---|
| `agents/planner.md` | `agents/planner.md` | 複製＋**平易化(1)**: ヒアリングの質問・選択肢を日常語＋具体例に |
| `agents/generator.md` | `agents/generator.md` | 複製＋**平易化(2)(3)**: 報告の型固定・進行の見せ方 |
| `agents/evaluator.md` | `agents/evaluator.md` | 複製＋**平易化(2)(3)** |
| `skills/using-harness/SKILL.md` | `skills/build/` に統合 or 併設 | **平易化**: 入口文言を日常語に |
| `skills/harness-loop/SKILL.md` | `harness/skills/harness-loop/SKILL.md` | 複製＋**平易化(3)**（進行表示）。**ループ内部の役割分担・契約参照の意味論は技術維持** |
| `commands/harness.md` | 任意（build で代替可） | 平易化 or 省略（build が入口） |
| `templates/AGENTS.md` | `harness/templates/AGENTS.md`（別名前空間） | **そのまま維持**（AI 向け内部契約）。※ 秘書ワークスペース用 `templates/AGENTS.md` と**衝突させない別ディレクトリ**へ |
| `templates/CLAUDE.md` | `harness/templates/CLAUDE.md` | そのまま維持 |
| `templates/docs/harness-guidance.md` | `harness/templates/docs/` | そのまま維持 |
| `scripts/init-guidance.sh` | `harness/scripts/` | そのまま維持（exec bit or `bash "…"` 統一） |
| `hooks/*` | 任意 | 技術維持 or 省略（cc-secretary の起動と干渉しないこと） |
| `.claude-plugin/plugin.json`・`.codex-plugin/plugin.json`・`marketplace.json` 群 | **複製しない** | cc-secretary の既存 manifest に統合（二重定義を作らない） |
| ルート `AGENTS.md`・`CLAUDE.md`・`LICENSE`・`README.md`・`docs/KNOWLEDGE.md` | **複製しない** | cc-secretary 側の既存を使用（クレジットは単段方針） |

- 配置の細部は Generator 裁量だが、(a) すべて `${CLAUDE_PLUGIN_ROOT}` から参照可能、(b) 秘書ワークスペース用テンプレ（`plugins/cc-secretary/templates/`）と**名前空間を分ける**（`harness/` 等）こと。

## スコープ（含む）

1. **複製と配置（F14）**: 上表に従い複製。`~/workspace/agentic-harness` は一切変更しない。
2. **平易化3点（F14）**:
   - (1) **Planner ヒアリングの日常語化**: `agents/planner.md` の質問・選択肢を日常語＋具体例に（例:「認証方式は？」→「見る人を制限しますか？ 誰でも見られる／招待した人だけ」）。
   - (2) **報告の型固定**: planner/generator/evaluator の報告フォーマットを、cc-secretary の `rules/plain-language.md` を**参照**する形に統一（3行・次の一言・改訂 ui.md 語彙）。
   - (3) **進行の見せ方**: 「いま計画→実装→検証（＝計画→道具→確認→結果）のどこか」を毎回宣言する記述を各エージェント／ループに入れる（第1回座学の実況語彙と接続）。
3. **build スキル（F15）**: `plugins/cc-secretary/skills/build/SKILL.md`。開発依頼を受け取り、やさしいハーネスに接続して起動する入口。ルーター（`skills/secretary/SKILL.md`）から「作って／開発／アプリ／ツール」等の言い回しで段階ロード。
4. **技術的文脈の維持**: 裏側の docs/spec・sprint 契約・rubric・ループの役割分担は**技術的文脈のまま維持**（AI の理解しやすさ優先。平易化しない）。

## 語彙方針の線引き（重要・ご依頼の点3）

| 区分 | 対象 | 方針 |
|---|---|---|
| **ユーザー向け（平易化する）** | Planner のヒアリング質問・選択肢、各エージェントの報告・進行表示、build/using-harness の入口文言 | 改訂 `docs/spec/ui.md` 準拠（一般技術用語はそのまま・馴染みの薄い語のみ初出補足・「家」系メタファー禁止） |
| **AI 向け内部契約（技術維持）** | `harness/templates/*`（docs/spec・sprint・state の構造）、rubric の基準、ループの役割分担・所有権・契約参照の意味論 | 技術的文脈のまま維持。平易化を強制しない |

線引きの原則: **非エンジニアの目に触れる文言＝平易化／AI だけが読む内部契約＝技術維持**。

## スコープ外

- 公開整備（README/docs/クレジット）→ sprint-006。
- ハーネスの機能拡張（元にない新機能の追加）。本スプリントは**複製＋平易化＋入口**に限定。
- Codex 版（`.codex-plugin`）の同梱（cc-secretary は Claude Code プラグイン。Codex 用 manifest は複製しない）。

## 受入基準（この契約は厚めに定義する）

Evaluator は `docs/spec/rubric.md` の方法で assert し、証跡を `docs/feedback/sprint-005.md` に残す。

### A. 複製・非改変・配置
1. **元リポジトリ非改変（C5, ゼロ許容・最優先）**: `~/workspace/agentic-harness` が実行前後で**一切変更されていない**。検証: スプリント開始時に当該リポジトリ全ファイルの `sha256` マニフェスト（または `git -C ~/workspace/agentic-harness status --porcelain` が空＋`git -C … rev-parse HEAD` 不変）を記録し、終了時に一致を assert。cc-secretary 側の複製物が元リポジトリへ **symlink・書き込みをしない**ことも確認。
2. **複製物の構文有効性（C2, ゼロ許容）**: 複製した agents の frontmatter 有効・`name` 一意、SKILL frontmatter 有効、JSON 有効、シェルは `bash -n` 構文チェック通過。参照パスは `${CLAUDE_PLUGIN_ROOT}` 相対でデッドリンクなし。
3. **配置の衝突回避（C1）**: ハーネスのテンプレ（`harness/templates/AGENTS.md` 等）が秘書ワークスペース用 `plugins/cc-secretary/templates/AGENTS.md` と**別ディレクトリ**にあり、上書き・混同しない。

### B. 平易化3点
4. **(1) ヒアリング日常語化（C4）**: `agents/planner.md`（やさしい版）の質問・選択肢が日常語＋具体例（技術用語だけの問いが具体化されている）。改訂 ui.md 準拠。
5. **(2) 報告の型固定（C4）**: planner/generator/evaluator が `rules/plain-language.md` を**参照**している（grep）。報告が3行・次の一言・改訂 ui.md 語彙。
6. **(3) 進行の見せ方（C4）**: 各エージェント／ループに「計画→実装→検証（計画→道具→確認→結果）のどこか」を宣言する記述が存在（grep/文言検査）。

### C. build 導線
7. **build 入口（C1, C3）**: `skills/build/SKILL.md` が存在・frontmatter 有効。ルーターから「作って／開発／アプリ」等で接続され、開発依頼→ハーネス起動→進行宣言の導線が成立する（手順検査＋ドライラン）。

### D. 横断
8. **語彙の線引き（C4）**: ユーザー向け文言に「秘書の家」等の「家」系メタファーがない（grep ゼロ）。内部契約テンプレは技術維持でよい（平易化を強制しない）。
9. **恒久不変条件（C5, ゼロ許容）**: 配布物は `${CLAUDE_PLUGIN_ROOT}` 相対。配布 SKILL は同梱されない `docs/spec/**` を参照しない（要点は同梱 `rules/` へ）。スクリプト実行方法統一。秘密非履歴化・封じ込めに反しない。単段クレジット維持。
10. **無回帰（C6, ゼロ許容）**: 既存回帰スイート（**230 assert**）が全パス。本スプリントの assert（非改変・構文・平易化3点・build 導線）を追加し、実行コマンドを progress に記録。push なし（`git remote` 空）。

### rubric 対応まとめ
- C1 完成度: 3,7 / C2 構文: 2 / C3 機能実証: 7 / C4 体験: 4,5,6,8 / C5 安全・規律: 1,9 / C6 無回帰: 10

## Generator への引き継ぎメモ

- **絶対に `~/workspace/agentic-harness` を変更しない**。複製は `cp` 等で cc-secretary 内へ取り込み、改変は複製先のみ。作業前に元リポジトリの sha256 マニフェストを取り、作業後に不変を自分でも確認すること。
- **複製しない基盤**: 元の `plugin.json`・`marketplace.json` 群は cc-secretary の既存 manifest と二重定義になるため取り込まない。ハーネスの agents/skills は cc-secretary の既存プラグイン定義に統合する。
- **名前空間の衝突**: 元 `templates/AGENTS.md` は「開発対象プロジェクト用のハーネス契約」で、cc-secretary の `templates/AGENTS.md`（秘書ワークスペース用）とは**別物**。必ず別ディレクトリ（`harness/` 等）へ。
- **平易化の線引き**: planner の質問・各エージェントの報告/進行だけを平易化。docs/spec・sprint・rubric・ループの役割分担は技術維持。
- パス参照は `${CLAUDE_PLUGIN_ROOT}` 相対。docs/spec 非参照。スクリプトは exec bit or `bash "…"` 統一。push しない。

## 分割オプション（大きすぎる場合の代替構成・ご依頼の点4）

本スプリントは中規模（元 ~1900 行、平易化対象は実質5ファイル）で密結合のため**1スプリント維持を推奨**。ただし Generator が過大と判断した場合の縦スライス分割案:
- **005a**: 複製・非改変・配置・build 骨格（受入 A＋C7＋D9＋無回帰）。「同梱されて起動する」まで。
- **005b**: 平易化3点の適用（受入 B＋D8）。「やさしくなった」。
- この場合、公開整備を1つ繰り下げる（既存 sprint-006 → 007）。renumber はオーケストレーターが state/spec.md を更新。

## 参照

- `docs/spec/features.md` F14 F15 / `docs/spec/constraints.md`（agentic-harness 変更禁止・やさしいハーネス平易化3点・恒久不変条件・語彙方針）/ `docs/spec/ui.md`（改訂・語彙方針）/ `docs/spec/rubric.md`（検証方法）
- 複製元（**読み取り専用・変更禁止**）: `~/workspace/agentic-harness`

# Progress — sprint-005（やさしいハーネス同梱＋開発の入口 build）

- Phase: P3（開発機能）
- Status: 実装完了・自己検証済み（Evaluator へ引き渡し）
- 実装者: Generator
- **絶対ルール順守**: `~/workspace/agentic-harness` は一切変更していない（複製は cp の読み取りのみ・改変は複製先だけ）。作業前後で sha256 マニフェスト・git HEAD・porcelain の非改変を確認済み。

## やったこと（複製＋平易化3点＋build 入口）

契約の複製対応表に従い、`~/workspace/agentic-harness/plugins/harness/` の必要ファイルを `plugins/cc-secretary/` に**複製**し、ユーザーに見せる文言だけを平易化した。内部契約（テンプレ・ループの役割分担・rubric）は技術的文脈のまま維持。

### 複製・配置（受入 A）

| 複製元 | 複製先 | 扱い |
|---|---|---|
| `agents/planner.md` | `plugins/cc-secretary/agents/planner.md` | 複製＋平易化(1)(2)(3) |
| `agents/generator.md` | `plugins/cc-secretary/agents/generator.md` | 複製＋平易化(2)(3) |
| `agents/evaluator.md` | `plugins/cc-secretary/agents/evaluator.md` | 複製＋平易化(2)(3) |
| `skills/harness-loop/SKILL.md` | `plugins/cc-secretary/harness/skills/harness-loop/SKILL.md` | 複製＋平易化(3)（進行の見せ方）。内部契約は技術維持 |
| `templates/AGENTS.md` / `CLAUDE.md` / `docs/harness-guidance.md` | `plugins/cc-secretary/harness/templates/…` | **そのまま維持**（AI 向け内部契約・別名前空間） |
| `scripts/init-guidance.sh` | `plugins/cc-secretary/harness/scripts/init-guidance.sh` | そのまま維持＋exec bit |
| `skills/using-harness/SKILL.md` | `plugins/cc-secretary/skills/build/SKILL.md` へ**統合** | 入口文言を平易化 |
| `commands/harness.md`・`hooks/*`・`.codex-plugin`・plugin/marketplace manifest 群 | **複製しない** | build が入口。二重定義/起動干渉を避ける |

- 名前空間: ハーネス契約テンプレは `harness/templates/`、秘書ワークスペース用は `templates/` で**別ディレクトリ**（衝突なし・内容も異なることを assert）。
- 複製先は元リポジトリへ symlink・書き込みを一切しない（regular file のみ）。

### 平易化3点（受入 B・ユーザー向け文言だけ）

- **(1) ヒアリング日常語化**: `agents/planner.md` に「専門用語だけの問いにしない・具体的な選択肢に」の約束と具体例（「見る人を制限しますか？ 誰でも見られる／招待した人だけ」等）を追加。
- **(2) 報告の型固定**: planner/generator/evaluator が `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md` を**参照**し、報告は3行・改訂 ui.md 語彙。Evaluator は rubric の内部値・軸名を維持しつつ言い換えを併置。
- **(3) 進行の見せ方**: 各エージェント・harness-loop・build に「計画→実装→検証（＝計画→道具→確認→結果）のどこか」を宣言する記述を追加。

### build 入口（受入 C）

- `plugins/cc-secretary/skills/build/SKILL.md`（新規）: 開発依頼の入口。using-harness の起動手順を平易化して統合し、`harness-loop`・3エージェント・契約テンプレ・init スクリプトへ `${CLAUDE_PLUGIN_ROOT}` 相対で接続。進行宣言つき。
- ルーターに「作って／開発／アプリ・ツールにして」→ build の段階ロードを追加（従来「準備中」から接続）。

### 変更ファイル

- 新規: `plugins/cc-secretary/agents/{planner,generator,evaluator}.md`、`plugins/cc-secretary/harness/{skills/harness-loop/SKILL.md, templates/**, scripts/init-guidance.sh}`、`plugins/cc-secretary/skills/build/SKILL.md`、`scripts/harness-source-baseline.sha256`（非改変検証用ベースライン）。
- 変更: `plugins/cc-secretary/skills/secretary/SKILL.md`（build モード追加）、`scripts/regression-check.sh`（section 2 に build 追加、section 10 の M6 を秘書向け skills/ に再スコープ、section 12 新設）。

## 回帰チェックの実行方法

```bash
bash scripts/regression-check.sh
```

- **実行結果（自己検証）: PASS=266 / FAIL=0（合格）**。sprint-005 で計 36 件追加（section 12=34 / section 2 に build の存在・name=2）。契約は精緻化された12項目版に対応。既存 230 件は無回帰で全パス。
- フォールバック（`CLAUDE_PLUGIN_ROOT` 未設定）でも全緑。決定的（2回連続同結果）。push なし・`git remote` 空。

### M6 の再スコープ（無回帰のための整合）

sprint-003-patch-001 の「配布 SKILL は docs/spec を参照しない」チェックを、対象が全 `$PLUGIN` だったのを**秘書ユーザー向け `skills/`・`rules/` に再スコープ**した。理由: 複製したハーネスの agents/harness-loop/templates は、**開発対象プロジェクトの** `docs/spec`/`docs/sprints` を指す AI 向け内部契約であり、cc-secretary 自身の開発専用ファイル参照ではない（契約の語彙線引き＝内部契約は技術維持）。秘書向け skills/rules に docs/spec 参照ゼロは維持（確認済み）。

## 受入基準への対応（自己評価）

1. **元リポジトリ非改変（最優先）**: 満たす。sha256 マニフェスト一致・git HEAD `56ce6938…` 一致・porcelain 空・複製先 symlink なしを assert。負テスト（保存ベースライン改変）で検出が効くことも確認（複製元は一切触らず）。
2. **複製物の構文有効性**: 満たす。agents frontmatter 有効・name 一意、harness-loop frontmatter、init-guidance.sh `bash -n` 通過・exec bit、複製物の `${CLAUDE_PLUGIN_ROOT}` 参照デッドリンクなし。
3. **配置の衝突回避**: 満たす。`harness/templates/AGENTS.md` と `templates/AGENTS.md` が別ディレクトリ・別内容。
4. **(1) ヒアリング日常語化**: 満たす（planner に具体例）。
5. **(2) 報告の型固定**: 満たす（3エージェントが plain-language 参照）。
6. **(3) 進行の見せ方**: 満たす（各エージェント・harness-loop・build に進行宣言）。
7. **build 入口**: 満たす（build 存在・frontmatter 有効・harness-loop/3エージェント参照・進行宣言・ルーター接続）。
8. **語彙の線引き（＋境界要素）**: 満たす。ユーザー向け複製文言に「家」系メタファーゼロ。**evaluator は rubric の6軸・閾値・証跡ルールの内部値・軸名を維持**しつつ（壊さない）、ユーザー提示文言に平易な言い換えを併置（assert 済み）。
9. **重複の一元化**: 満たす。平易化した報告文言は `rules/plain-language.md` に集約し、planner/generator/evaluator/build/harness-loop の**5面から参照**（同一文言のフルコピーを増やさず、各所は短い pointer＋参照）。grep で5面の参照を assert。
10. **hooks 非衝突**: 満たす。設計判断は「**ハーネスの hooks を複製しない（登録しない）**」。build を明示入口にし、SessionStart 注入で cc-secretary 本体起動と干渉させない。cc-secretary に `hooks.json`・`session-start.sh` が無く、プラグイン定義に SessionStart 登録が無いことを assert（二重起動なし）。
11. **恒久不変条件**: 満たす（`${CLAUDE_PLUGIN_ROOT}` 相対・秘書向け SKILL は docs/spec 非参照・スクリプト exec bit・封じ込め/秘密非履歴化/単段クレジットは既存 section で全パス）。
12. **無回帰**: 満たす（既存 230 全パス＋新規 36。push なし）。

自己採点（rubric 目安）: C1=5 / C2=5 / C3=5 / C4=5 / C5=5 / C6=5。

## Evaluator への検証手順（推奨）

1. 既定: `bash scripts/regression-check.sh` → PASS=266/FAIL=0（section 12 が本スプリントの中核）。
2. **非改変の独立確認（最優先）**: `git -C ~/workspace/agentic-harness status --porcelain`（空）・`git -C ~/workspace/agentic-harness rev-parse HEAD`（`56ce6938…`）。`cd ~/workspace/agentic-harness && find . -type f -not -path './.git/*' -print0 | sort -z | xargs -0 shasum -a 256 | diff - <repo>/scripts/harness-source-baseline.sha256`（差分なし）。複製先に元への symlink が無いこと（`find plugins/cc-secretary/{agents,harness} -type l`）。
3. 骨抜きでないこと: 保存ベースライン（`scripts/harness-source-baseline.sha256`）を1文字改変 → 「A1: sha256 一致」が FAIL。復元で PASS=266。（複製元は触らない。）
4. 平易化: planner の具体例・3エージェントの plain-language 参照・進行宣言を grep で確認。build がルーターから接続され harness-loop/エージェントへ渡す導線を目視。
5. パス解決の両立: `CLAUDE_PLUGIN_ROOT` 明示／未設定どちらでも全緑。

## 既知の制約・スコープ

- ハーネスの実ループ起動（実際に planner→generator→evaluator を回す）は本環境では実行していない（dispatch は Claude 実行時）。導線・複製物の構文/参照・非改変・平易化は静的検証＋ドライランで担保。
- **hooks 非衝突の設計判断（受入10）**: ハーネスの hooks（`hooks.json`/`session-start.sh`）は**複製しない（登録しない）**。build を明示入口にし、SessionStart 注入で cc-secretary 本体起動と干渉させない。二重起動フックが無いことを assert 済み。Codex 版 manifest・元 plugin/marketplace manifest も複製しない（二重定義回避）。
- 内部契約（テンプレの docs/spec 構造・ループの役割分担・rubric 6軸・Status 語彙）は技術的文脈のまま維持（平易化しない）。公開整備（README/クレジット）は sprint-006。
- 契約は1スプリント維持（縦スライス 005a/005b への分割は不要と判断。過大ではなく、複製＋平易化＋入口で完結）。

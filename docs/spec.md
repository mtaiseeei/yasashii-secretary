# Spec Index

`cc-secretary`（非エンジニア向けAI秘書プラグイン / Claude Code plugin / public / MIT）の正本インデックス。
確定済みの設計方針は `docs/DESIGN.md`。この spec 群はそれを実装可能な単位に落としたもの。

## ひとことで

**「データは外に置いたまま、秘書だけがローカルに住む」** 秘書プラグイン。
外部データは公式コネクタで都度参照し、記憶と成果物だけをローカルに置いて節目ごとに自動コミットする。
メタファーは「秘書＋道具箱」。cc-company の配布導線・オンボーディング・記憶保護と、my-vault の規律（スコープ・根拠・出力規約・スキル分割）を融合する。

## 詳細仕様

| ファイル | 内容 |
|---|---|
| [product.md](spec/product.md) | 目的・対象ユーザー・ゴール/非ゴール・成功状態 |
| [features.md](spec/features.md) | 機能ID（F01〜F16）とユーザーから見た振る舞い、フェーズ対応 |
| [constraints.md](spec/constraints.md) | 絶対ルール・禁止事項・安全方針・不変条件 |
| [domain.md](spec/domain.md) | ワークスペース構造・記憶ルール・出力規約・コネクタ・進行語彙 |
| [ui.md](spec/ui.md) | 非エンジニア向け体験方針・非機能要件 |
| [rubric.md](spec/rubric.md) | プラグイン用に調整した採点基準・閾値・検証方法 |

## スプリント

契約は `docs/sprints/sprint-NNN.md`。進行状態の正本は `docs/sprints/state.md`（オーケストレーターが管理）。
DESIGN.md の開発フェーズ P1〜P4 をスプリント列に展開する。

| スプリント | 主眼 | フェーズ |
|---|---|---|
| [sprint-001](sprints/sprint-001.md) | プラグイン骨組み＋インストール導線＋`/secretary`＋オンボーディング（動く初回体験） | P1 |
| [sprint-002](sprints/sprint-002.md) | 記憶ケア（保護・再起動しおり・振り返り）＋自動コミット | P1 |
| [sprint-003](sprints/sprint-003.md) | 今日やること＋出力規約＋Google コネクタ接続ガイド | P1 |
| [sprint-004](sprints/sprint-004.md) | Microsoft / Notion 接続＋接続診断 | P2 |
| [sprint-005](sprints/sprint-005.md) | やさしいハーネス同梱＋開発の入口（build） | P3 |
| [sprint-006](sprints/sprint-006.md) | 公開整備（README・docs・クレジット・カリキュラム導線） | P4 |

Patch:
- [sprint-001-patch-001](sprints/sprint-001-patch-001.md)（`Type: micro`）— templates を `plugins/cc-secretary/templates/` へ移設し、SKILL 参照を `${CLAUDE_PLUGIN_ROOT}` 相対に統一。
- [sprint-002-patch-001](sprints/sprint-002-patch-001.md)（`Type: micro`）— 記憶ツールの封じ込めハードニング（symlink 越えを `exit 3` で拒否、エッジ rel の偽装成功を遮断）。

## 絶対ルール（最優先・回帰厳禁）

1. `~/workspace/agentic-harness` は変更禁止。同梱ハーネスはリポジトリ内に複製して改変する。
2. 外部データのローカル同期層（`10_sources` 型）を作らない。コネクタで都度参照。
3. ターゲットは非エンジニア。文言は日常語＋具体例、報告は「3行以内・言い換え併記・次の一言」。

詳細は [constraints.md](spec/constraints.md)。

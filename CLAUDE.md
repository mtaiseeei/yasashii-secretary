# super-secretary（仮称）

ゆるAIコーディング塾 第2期の目玉として配布する、非エンジニア向けAI秘書プラグイン（Claude Code plugin / public / MIT）。
cc-company の配布導線・オンボーディングUX・記憶保護と、my-vault の規律（スコープ表・根拠ルール・出力規約・スキル分割）を融合する。

## 正本

- 設計方針の正本: `docs/DESIGN.md`（確定済みの意思決定・アーキテクチャ・フェーズ計画をすべて含む。実装前に必ず読む）

## 参照リポジトリ

- 分析済みの参考実装: `~/workspace/inbox/company`（inoshinichi/bootcamp-company、Shin-sibainu/cc-company のフォーク、MIT。クレジット表記を継承する）
- 複製元ハーネス: `~/workspace/agentic-harness`

## 絶対ルール

- `~/workspace/agentic-harness` は**変更禁止**。同梱する「やさしいハーネス」は必ずこのリポジトリ内に複製して改変する
- 外部データのローカル同期層（my-vault の 10_sources 型）は作らない。外部データは公式リモートコネクタで都度参照する
- ターゲットは非エンジニア。ユーザー向けの文言は日常語＋具体例、報告は「3行以内・専門用語は言い換え併記・次に何が起きるかを一言」

---
name: build
description: >
  「〇〇を作って」「開発したい」「アプリ／ツールにして」等の開発依頼の入口。やさしいハーネス
  （計画→実装→検証のループ）に接続し、進行を見せながら開発を進める。
---

# 開発の入口（build）

「〇〇を作って」「これを実装して」「アプリ／ツールにしたい」といった**まとまった開発依頼**を受け取る入口です。
やさしいハーネス（計画→実装→検証を自動で回す仕組み）に接続して、**いまどこにいるかを見せながら**進めます。

ユーザーに話しかける前に、必ず `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`（言葉づかいルール）を読むこと。
報告は3行以内（やったこと／結果／次に何が起きるか）。一般に通じる技術用語はそのまま使い、馴染みの薄い語だけ初出で簡潔に補足する。

## いつ使うか

- 「〇〇なアプリ／ツール／サイトを作って」「これを実装して」「自動で開発を進めて」と言われたとき。
- 小さな1行直しや文言変更だけなら、ハーネスは使わず普通に対応してよい（大げさにしない）。

## はじめに一言（予告と不安の先回り）

いきなり作り始めず、まず何をするか予告する。例:

> 「計画→実装→検証」の順で、進み具合をお見せしながら作っていきます。
> まず作るものの中身を一緒に決めます（計画）。そのあと私が作り（実装）、実際に動かして確かめます（検証）。

## 進め方

1. **進行を宣言する（計画→実装→検証）**: いま「計画→実装→検証」（＝計画→道具→確認→結果）のどこにいるかを毎回ひとことで示す。
   - 計画: 作るものの中身を決める（Planner）
   - 実装: 実際に作る（Generator）
   - 検証: 動かして確かめる（Evaluator）
2. **必要な下地を用意する（no-overwrite）**: 開発対象のフォルダに、ハーネスの契約テンプレ（`CLAUDE.md` / `AGENTS.md` / `docs/` の雛形）が無ければ用意する。既に中身があれば上書きしない。
   - 雛形の置き場所: `${CLAUDE_PLUGIN_ROOT}/harness/templates/`
   - 用意を助けるスクリプト（任意）: `bash "${CLAUDE_PLUGIN_ROOT}/harness/scripts/init-guidance.sh" <対象フォルダ>`
3. **ループの手順書を開く**: 実際のループ（役割分担・書き込み権限・合否の閾値・絶対ルール）は次に従う。
   - `${CLAUDE_PLUGIN_ROOT}/harness/skills/harness-loop/SKILL.md`
4. **3人の担当（サブエージェント）に渡す**: 計画は planner、実装は generator、検証は evaluator。
   - `${CLAUDE_PLUGIN_ROOT}/agents/planner.md` / `${CLAUDE_PLUGIN_ROOT}/agents/generator.md` / `${CLAUDE_PLUGIN_ROOT}/agents/evaluator.md`
   - 各担当はユーザーに見せる文言を `plain-language.md` に沿ってやさしくする（内部の契約・構造は技術のまま）。

## 大切なこと

- 進行が見えるようにする（「いま計画です」「実装に進みました」「確認しています」）。不安を先回りして予告する。
- 生成（作る人）と検証（確かめる人）は分ける。作った本人の自己評価だけで「できた」と言わない（独立した確認を通す）。
- できないこと・分からないことは正直に伝える。断定せず、確かめてから答える。

## 参照

- 言葉づかいルール（必読）: `${CLAUDE_PLUGIN_ROOT}/rules/plain-language.md`
- ループの手順書: `${CLAUDE_PLUGIN_ROOT}/harness/skills/harness-loop/SKILL.md`
- 担当（サブエージェント）: `${CLAUDE_PLUGIN_ROOT}/agents/planner.md` / `generator.md` / `evaluator.md`
- ハーネスの契約テンプレ: `${CLAUDE_PLUGIN_ROOT}/harness/templates/`

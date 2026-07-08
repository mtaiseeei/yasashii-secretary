# Sprint 006 — 公開整備（最終）

- Phase: P4（公開整備・**最終スプリント**）
- 主眼: public / MIT リリースに向けて、README・公開向け使い方ドキュメント・クレジット・LICENSE を整え、ゆるAIコーディング塾 第2期カリキュラムへの導線を作る。**新機能は追加しない（整備のみ）**。
- 依存: sprint-001〜005（＋各 patch。機能が出揃っていること）

## なぜこのスプリントか

ここまでで秘書コア（記憶・daily・接続）と開発機能（やさしいハーネス・build）が揃った。最後に、**受講者が迷わず導入でき、リポジトリを覗く技術者にも設計意図が伝わる**公開面を整える。DESIGN.md の「public + MIT」「cc-company のクレジット継承（単段確定）」を最終確認する。

## 実装済みの実態（README はこれと一致させる）

- スキル（`plugins/cc-secretary/skills/`）: `secretary`（ルーター）/ `onboarding` / `memory-care` / `daily` / `setup-google` / `setup-microsoft` / `setup-notion` / `connections`（接続診断）/ `build`（開発の入口）。
- エージェント（`plugins/cc-secretary/agents/`）: `planner` / `generator` / `evaluator`（やさしいハーネス）。
- プラグイン名: `cc-secretary`（`plugin.json` / `marketplace.json`）。作者: `mtaiseeei`。LICENSE: 既存。

## スコープ（含む）

### 1. README.md（F16・公開の主入口）
- **インストール3コマンド**（cc-company と同じ導線）を、実在の marketplace/plugin 名（`cc-secretary`）と一致する形で正確に記載。各コマンドの前に「今から何をするか」を1行。
- **できること（機能一覧）**: 上記「実装済みの実態」と**一致**させる（記憶・今日やること・Google/Microsoft/Notion 接続・接続診断・開発の入口）。**未実装・将来構想を「今できる」と謳わない**（国内チャットは対象外と明記可）。
- **使い方の最短導線**: 初回 `/secretary` → やさしい数問 → 秘書ディレクトリ生成、の流れを日常語で。
- **二層の読者に対応**（下記「対象読者の二層」）。
- 語彙は改訂 `docs/spec/ui.md` 準拠（一般技術用語はそのまま・馴染みの薄い語は初出補足・「家」系メタファー禁止）。

### 2. 公開向け使い方ドキュメント（F16）
- 詳細な使い方を `docs/guide/`（**新設・公開向け**）に置く。**開発内部の `docs/spec` / `docs/sprints` / `docs/progress` / `docs/feedback` とは明確に分離**（読者・目的が違う）。
- 配布プラグイン本体（`plugins/cc-secretary/`）に使い方ドキュメントを埋め込んでプラグインを重くしない（プラグインは薄く保つ）。

### 3. クレジット・LICENSE の最終確認
- LICENSE = **MIT**。README・`marketplace.json` の `forkedFrom` に **元作者 Shin-sibainu/cc-company（MIT）** のクレジットを明記（単段方針）。
- 中間フォーク **inoshinichi/bootcamp-company は必須クレジットに含めない**（分析参考の事実を docs に残すのは可）。
- `docs/spec/constraints.md` のクレジット方針・回帰検査と整合。

### 4. 第2期カリキュラムへの導線（線引き）
- README/`docs/guide` に「ゆるAIコーディング塾 第2期の目玉として配布」「第1回座学の実況語彙（計画→道具→確認→結果）と接続」程度の**一般的な導線**を書く。
- **塾の非公開教材・受講者個人情報・内部運用の詳細は public リポジトリに書かない**（プライバシー。詳細は塾側教材に置き、ここからは概要ポインタのみ）。

### 5. スクリーンショットの要否（設計判断）
- 本製品は GUI を持たず、画面は対話ログ。**スクリーンショットは任意（nice-to-have）**とし、README の正確性はスクショに依存させない。載せる場合は実挙動を反映したもののみ（古い/誤った状態を貼らない）。rubric のスクショ必須要件は本種別に非適用（`docs/spec/rubric.md`）。

## スコープ外

- 新機能の追加・既存スキルの挙動変更（本スプリントは整備のみ）。
- 塾の非公開教材そのものの同梱。
- push（リリースタグ付け・公開操作はユーザーの明示指示時のみ。本スプリントはドキュメント整備まで）。

## 対象読者の二層（ご依頼の点3）

README は2種類の読者が読む。構成の設計判断:

| 読者 | 求めるもの | README での扱い |
|---|---|---|
| **受講者（非エンジニア）** | 入れ方・できること・最初の一歩 | **冒頭〜前半**に配置。日常語＋具体例、3コマンド、初回体験。ここだけ読めば使い始められる。 |
| **リポジトリを覗く技術者** | 設計思想・アーキテクチャ・ライセンス・貢献 | **後半**に配置。「データは外・秘書はローカル」思想、`docs/spec`・DESIGN.md・やさしいハーネスへのリンク、MIT・クレジット。 |

- 前半（非エンジニア）→ 後半（技術者）の順で、非エンジニアが技術セクションで迷子にならない構成にする。

## 受入基準（この契約は厚めに定義する）

Evaluator は `docs/spec/rubric.md` の方法で assert し、証跡を `docs/feedback/sprint-006.md` に残す。

1. **インストール手順の正確性（C1, C3・ゼロ許容）**: README のインストール3コマンドが、実在の marketplace/plugin 名（`cc-secretary`）と**一致**する。コマンド中のプラグイン名・マーケットプレイス名が `plugin.json` / `marketplace.json` の `name` と突き合わせて正しい（grep で照合）。
2. **README とプラグイン実態の整合（C1・ゼロ許容）**: README の機能一覧が、実装済みスキル（`plugins/cc-secretary/skills/` の実ディレクトリ: secretary/onboarding/memory-care/daily/setup-google/setup-microsoft/setup-notion/connections/build）と**一致**し、**未実装機能を「今できる」と謳っていない**（国内チャット等は対象外と分かる）。実スキル一覧との突き合わせで検査。
3. **公開 docs の分離（C1）**: 使い方ドキュメントが `docs/guide/`（公開向け）にあり、`docs/spec`・`docs/sprints`・`docs/progress`・`docs/feedback`（開発内部）と混在していない。配布プラグイン本体に使い方 doc を埋め込んでいない。
4. **クレジット・LICENSE 整合（C5・ゼロ許容）**: LICENSE が MIT。README・`marketplace.json` の `forkedFrom` に Shin-sibainu/cc-company・MIT が明記され、**inoshinichi/bootcamp-company を必須クレジットとして掲げていない**（`docs/spec/constraints.md` のクレジット方針と一致。回帰のクレジット検査がパス）。
5. **カリキュラム導線の線引き（C5）**: README/`docs/guide` に第2期導線の一般記述はあるが、**塾の非公開教材・受講者個人情報・内部運用の詳細が public リポジトリに書かれていない**（privacy。grep で機微情報の不在を確認）。
6. **語彙方針（C4）**: README・`docs/guide` の文言が改訂 `docs/spec/ui.md` に適合（一般技術用語そのまま・馴染みの薄い語は初出補足・**「家」系メタファーなし**、grep ゼロ）。二層構成（非エンジニア前半→技術者後半）になっている。
7. **安全・規律（C5, ゼロ許容）**: `~/workspace/agentic-harness` 書き込みなし。秘密情報を README/docs に書かない・コミットしない。恒久不変条件に反しない。
8. **無回帰（C6, ゼロ許容）**: 既存回帰スイート（**266 assert**）が全パス。本スプリントの assert（インストール手順照合・機能一覧照合・クレジット・語彙）を追加し、実行コマンドを progress に記録。push なし（`git remote` 空）。

### rubric 対応まとめ
- C1 完成度: 1,2,3 / C3 機能実証: 1 / C4 体験: 6 / C5 安全・規律: 4,5,7 / C6 無回帰: 8

## Generator への引き継ぎメモ

- README の機能一覧は**実ディレクトリを正**とする（`ls plugins/cc-secretary/skills/`）。書いてから実態とずれたら README を直す。将来構想は「今後」と明記して現在形で謳わない。
- インストールコマンドのプラグイン/マーケットプレイス名は `plugin.json`・`marketplace.json` からコピーして齟齬を作らない。
- 公開 docs は `docs/guide/`。開発内部の docs と混ぜない。プラグイン本体は薄いまま。
- クレジットは単段（Shin-sibainu/cc-company・MIT）。bootcamp-company を必須クレジットに書かない。既存 LICENSE を確認し MIT を維持。
- 語彙は改訂 ui.md 準拠。「秘書の家」等を新規に持ち込まない。二層構成（非エンジニア→技術者）。
- 塾の非公開情報は書かない。push しない。

## 参照

- `docs/spec/features.md` F16 / `docs/spec/product.md`（対象ユーザー・二層）/ `docs/spec/constraints.md`（MIT・単段クレジット・回帰検査・語彙方針・秘密非履歴化）/ `docs/spec/ui.md`（改訂・語彙方針）/ `docs/spec/rubric.md`（スクショ非必須）
- `docs/DESIGN.md`（public + MIT・クレジット継承・第2期の目玉）
- 実態: `plugins/cc-secretary/skills/`・`agents/`・`.claude-plugin/`

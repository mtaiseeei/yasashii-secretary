# Sprint 013 — G5 接続: 1つのrepoとChatwork初回設定

**ステータス:** 実装完了 - 評価待ち

## 着手時の契約

- 1つのprivate GitHub repoを秘書・通常project・Chatworkの共通workspaceにし、nested `git init` を作らない。
- API TokenはRepository Secretだけに置き、room discovery、room選択wizard、初回取得、基本検索を提供する。
- wizardはloopbackだけで起動し、指定palette・余白・responsive・accessibilityを実ブラウザで評価できる形にする。
- 合成fixtureでpublic／既存remote／キャンセル、0／1／100件、部分失敗、message ID冪等、secret非漏洩を自動検証する。
- sprint-012までの回帰を維持し、このsprintでは定期scheduleを有効化しない。

## 検証計画

- `bash scripts/sprint-013-regression.sh`
- `bash scripts/regression-check.sh --offline`
- `git diff --check`
- running wizardのdesktop／mobile操作はEvaluatorへ引き渡す。

## 実装内容

- **F04/F23 single-repo onboarding**: `workspace-repo.mjs` を追加し、workspace rootだけをGit管理するprivate repo作成、初期commit、初回pushを実装した。public指定、既存remote未確認、nested `secretary/.git`、資格情報候補を副作用前に拒否する。
- **F24 Chatwork接続**: `/chatwork` skill、Repository Secret登録案内、room discovery／初回取得用GitHub Actions template、Chatwork API同期scriptを追加した。Token値はwizardへ入力・表示せず、選択roomだけを取得する。
- **F24 初回取得**: 0／1／100件、message ID冪等統合、API応答欠落時の既存履歴保持、room単位の部分失敗、auth／rate limit／networkの日本語状態を実装した。
- **F25 wizard**: `127.0.0.1` bind、private repo検証、room検索・複数選択、6頻度、確認、初回結果の4 stepを実装した。確定前は書込せず、確定後だけ設定commit／push→初回workflowの順で進む。Sprint 013ではscheduleを有効化しない。
- **F25 design**: Pure White／Light Ash、Carbon Dark／Graphite／Pewter、primary CTAだけElectric Blue、4px radius、8px spacing、400/500 weight、responsive、visible focus、44px相当target、reduced motionを実装した。Tesla素材・商標・写真・gradient・shadow・不明フォントは使っていない。
- **F25 basic search**: 保存済み履歴をroom、発言者、日付、keywordで検索し、foundはroom・日付・該当箇所、not foundは保存済み範囲の限界をJSONで返す決定的scriptを追加した。
- **回帰**: section 19を全offline回帰へ統合し、public／既存remote／cancel、runtime生成token非漏洩、0／1／100件、未選択room 0件、冪等、部分失敗、wizard API、intentional schedule混入fixtureを検証した。

## 自己評価

| 基準 | スコア(1-5) | コメント |
|---|---:|---|
| 機能完全性 | 4 | Sprint 013の接続・設定・初回取得・基本検索を実装。実APIとscheduleは契約どおりSprint 014へ残した。 |
| 動作安定性 | 5 | 専用33 assert（内部Chatwork挙動29件）と全offline 296 assertが0 FAIL。 |
| デザイン性 | 4 | 指定デザイン言語とdesktop/mobile構造を実装。最終スコアはEvaluatorのrunning browser確認に委ねる。 |
| 独自性 | 4 | 1 step 1 message、Token非入力、実行回数を比較できる静かな4 step体験に落とし込んだ。 |
| エラーハンドリング | 5 | public、既存remote、secret候補、auth、rate、network、部分失敗、0件を別状態にした。 |
| 回帰なし | 5 | `bash scripts/regression-check.sh --offline` が PASS=296 / FAIL=0。 |

## 技術的な判断

- Node.js標準ライブラリだけを使い、macOS／Windows配布で追加package installを不要にした。
- workflowは `workflow_dispatch` だけを持ち、定期scheduleはSprint 014まで明示的に無効とした。
- 履歴はroomごとのJSONに分け、message IDをkeyに既存と統合する。API応答から消えた項目は削除しない。
- wizardは起動時にprivate GitHub repoを `git`／`gh` で検証し、外部interfaceへbindしない。合成fixtureだけは `NODE_ENV=test` と専用envの組み合わせでprivate確認を差し替える。
- `skill-creator` の `quick_validate.py` は環境にPyYAMLが無く起動できなかったため、同じfrontmatter必須条件（name／descriptionのみ、命名、TODOなし）を依存なしNode検査で回帰化した。plugin manifest／marketplace JSONとworkflow YAMLは別途parse済み。

## 既知の課題

- 定期schedule生成・自動push同意、検索不成立時の確認付きmanual sync、workflow待機／pull／再検索はSprint 014の契約範囲。
- 実GitHub repo作成と実Chatwork APIは安全上このGeneratorでは実行していない。隔離local bare remote、合成API、runtime生成tokenで検証した。Sprint 014の許可済み実API評価へ引き継ぐ。
- running UIのdesktop／mobile screenshotと200% zoomの最終証跡はEvaluatorが取得する。

## Evaluatorへの引き渡し事項

- 起動方法: `bash scripts/start-sprint-013-wizard-fixture.sh 8765`
- テスト対象URL: `http://127.0.0.1:8765/`
- 専用回帰: `bash scripts/sprint-013-regression.sh`（loopback bindが必要）
- 全回帰: `bash scripts/regression-check.sh --offline`（最終結果 `PASS=296 FAIL=0`）
- 構文: `git diff --check`、JSON parse、Ruby YAML parse、`node --check` を実行済み。
- desktopシナリオ: room検索→2 room選択→3時間→確認→戻る→選択保持→確定→0件／1件の結果を確認する。確認画面までにfixtureの `config.json` が不変であることを確認する。
- cancelシナリオ: 初期room画面でキャンセルし「変更せずに終了」を確認する。再起動後も選択0件であることを確認する。
- mobileシナリオ: 767px未満で1 column、CTA縦積み、room full width、keyboard focus、200% zoomを確認し、desktop／mobile screenshotを `docs/feedback/sprint-013.md` の証跡にする。
- 安全シナリオ: UIにToken入力欄・値が無い、Electric Blueがprimary CTAだけ、Tesla素材・gradient・shadow・scale hoverが0件であることをrunning DOM／computed styleでも確認する。

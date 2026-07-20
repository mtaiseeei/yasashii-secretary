# Sprint 029 評価

- 判定: **PASS**
- failure kind: N/A
- 評価対象: `sprint-029`
- 評価日: 2026-07-20（Asia/Tokyo）
- 外部状態を変える操作: 0件

## 結論

Sprint 029は合格と判定する。安全・証拠・共通表現・yasashii styleの参照関係は機械検査でき、欠落、循環、owner欠落は0件だった。editionで変更できるcopyは会話、診断、報告、developer handoffの4面だけで、wizard copyは含まれない。

Generatorのbaselineだけに依存せず、独立の負fixture 11件、Sprint着手前の`HEAD`、実Browser、checkoutのmaster offline、`.git`なしarchiveを別々に確認した。master offlineは423/423、archiveは84/84、responsiveは両wizard × desktop／390px mobile／200%相当の6/6が0 FAILだった。利用者に見えるwizard asset、copy、focus、操作順の変更は確認されなかった。

## Rubric採点

| 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 5/5 | 4 | PASS | AC1〜AC5を専用、独立負例、master、archive、実Browserで確認した。 |
| C2 構文・整合 | 5/5 | 5 | PASS | rule graph、owner、依存、JSON、Node/Python/shell検査が0 FAIL。missing refとcycleも拒否した。 |
| C3 機能の実証 | 5/5 | 4 | PASS | 4面copy、5つの安全境界、両wizardの選択・確認・完了を実行した。 |
| C4 非エンジニア体験 | 5/5 | 4 | PASS | 3行報告、診断順、1行確認、正式名称を残すhandoff、wizardの「今すること」を維持した。 |
| C5 安全・規律 | 5/5 | 5 | PASS | 記憶保護、secret、根拠、確認、pushの5境界はstyle overrideで弱められない。実Secret／外部送信0件。 |
| C6 無回帰 | 5/5 | 5 | PASS | master offline 423/423、内包全回帰339/339、archive 84/84。 |
| C7 やさしさ | 5/5 | 4 | PASS | yasashii copyの意味・順序を維持し、安全条件を文体から分離した。 |
| C8 wizard体験・デザイン | 4/5 | 4 | PASS | UI変更なし。6 responsive条件でoverflow 0、主要操作48px、H1 focusを実証し、8枚を目視した。 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | `.git`なしarchiveでSprint 029を含む配布検査が84/84。 |
| C10 更新の安全性 | 5/5 | 5 | PASS | 更新・migration・rollbackを含むmaster回帰が0 FAIL。外部更新操作0件。 |
| C11 Google Chat境界 | 5/5 | 5 | PASS | Google Chatのscope、通常スペース、Secret、同意境界を含む既存回帰と実wizardが0 FAIL。 |
| C12 0.7.0配布準備 | 5/5 | 5 | PASS | release validator、version、CHANGELOG、portable archive、全体gateが0 FAIL。 |
| C13 edition分離・互換 | 5/5 | 5 | PASS | common coreをprotected、yasashiiをoverlayとして宣言し、禁止override、4面外copy、wizard混入を拒否した。 |

合計64/65。全閾値を満たす。

## 受入基準

| AC | 判定 | 独立証跡 |
|---|---|---|
| AC1 参照関係・owner、循環／欠落0 | PASS | 専用25/25。独立fixtureでmissing dependencyと`evidence -> style`のcycleを各1件拒否。通常報告ownerは`rules/styles/yasashii.md` 1件、参照面20、conflict 0。 |
| AC2 edition可変copyは4面だけ | PASS | `conversation`、`diagnosis`、`report`、`developerHandoff`の4 keyだけ。5面目追加、wizard CTA、wizard OAuth語の混入を独立fixtureで拒否。wizard主要5 assetは`HEAD`差分0、既存copy inventory 69/69。 |
| AC3 現行出力の意味・順序・安全情報 | PASS | 4面全体をbaselineとdeep equal。さらに`HEAD`から決定確認、案件メモの確認後保存、project提案、未確認診断、3行／4行報告、正式名称を残す説明を独立照合。report逆順を負例で拒否。 |
| AC4 styleで安全境界を弱められない | PASS | `memoryProtection`、`secretHandling`、`evidenceRequirements`、`confirmationBoundary`、`pushBoundary`へのoverrideを1件ずつ独立fixtureで拒否。 |
| AC5 全回帰・master・archive 0 FAIL | PASS | Sprint 010 56/56、Sprint 011 68/68、master offline 423/423（内包339/339）、archive 84/84、`git diff --check` PASS。 |

## 実行証跡

### Sprint 029専用と独立負fixture

```text
env TMPDIR=/private/tmp bash scripts/sprint-029-regression.sh
SPRINT029_RULE_PASS=25 SPRINT029_RULE_FAIL=0 WIZARD_DIGESTS=5
SCHEMA_OK owner=rules/styles/yasashii.md entrypoint=rules/plain-language.md surfaces=20 conflicts=0
SPRINT020_PATCH001_COPY_PASS=69 SPRINT020_PATCH001_COPY_FAIL=0 INVENTORY=52
SPRINT029_PASS=4 SPRINT029_FAIL=0

独立Node fixture
INDEPENDENT_NEGATIVE_PASS=11 INDEPENDENT_NEGATIVE_FAIL=0
```

独立fixtureは、参照欠落1、循環1、protected override 5、5面目追加1、wizard CTA混入1、wizard OAuth混入1、report逆順1を検査した。

### 既存回帰・release gate

```text
env TMPDIR=/private/tmp bash scripts/sprint-010-regression.sh
PASS=56 FAIL=0

env TMPDIR=/private/tmp bash scripts/sprint-011-regression.sh
PASS=68 FAIL=0

env TMPDIR=/private/tmp bash scripts/master-release-gate.sh --mode offline --timeout-ms 600000
PASS=339 FAIL=0
RELEASE_GATE mode=offline status=pass suites=5 required=5 passed=5 failed=0 skipped=0 assertions=423 pass=423 fail=0

env TMPDIR=/private/tmp node scripts/master-release-gate.mjs --mode archive --root <git-free-fixture> --timeout-ms 120000
RELEASE_GATE mode=archive status=pass suites=10 required=4 passed=4 failed=0 skipped=0 assertions=84 pass=84 fail=0

git diff --check
exit 0
```

最初のsandbox内masterはlocalhost待受が`listen EPERM 127.0.0.1`になり、417 PASS / 7 FAILで終了した。この実行は製品判定に採用せず、loopbackを許可した同一checkoutで再実行し423/423を確認した。600秒timeoutには到達していない。

archiveはrepoのworking treeから`.git`と開発用docsを除いた一時copyで実行した。Sprint 029 archive suiteは3/3、archive全体は84/84だった。一時archiveは評価後に削除した。

## Browser／UI証跡

### 実操作

- Chatwork: `http://127.0.0.1:18784/`
  - 接続情報準備 → 合成のGitHub登録確認 → ルーム取得 → 「営業チーム」を選択 → 3時間 → 確認 → 同意 → 初回0件結果 → 完了。
  - 確認画面はheading `Chatworkの保存内容を確認します。`、active elementはH1、横overflowなし、戻る／確定buttonは各48px。
- Google Chat初回: `http://127.0.0.1:18783/`
  - 開始画面と安全なJSON選択導線を確認。Browser拡張はfile inputの設定APIを提供しなかったため、実ファイル送信は行っていない。
- Google Chat設定変更: `http://127.0.0.1:18782/`
  - スペース選択 → 3時間 → 確認 → 2つの同意 → 保存結果 → 完了。
  - 確認画面はheading `Google Chatの変更内容を確認します。`、active elementはH1、横overflowなし、戻る／確定buttonは各48px。
- 両tabのbrowser console error: 0件。

### responsive

一時headless ChromeのCDPで、実DOMへdevice metricsを適用した。

```text
SPRINT029_RESPONSIVE_PASS=6 SPRINT029_RESPONSIVE_FAIL=0
```

- desktop: 1440×900
- mobile: 390×844
- 200%相当: 720×450、page scale 2
- 6条件すべて: 横overflow 0、主要操作の最小高さ48px、`details`は初期状態で閉、選択画面と次画面のactive elementはH1、console exception 0。

Chrome拡張のviewport APIは`innerWidth`を1280のまま変えなかったため、そのcaptureはresponsive証跡に採用していない。実device metricsを反映できる一時Chromeで取り直した。

### screenshot

- Chatwork確認画面: `/private/tmp/sprint-029-chatwork-desktop.png`
- Google Chat確認画面: `/private/tmp/sprint-029-google-chat-desktop.png`
- responsive 6枚:
  - `/private/tmp/sprint-029-responsive/chatwork-desktop.png`
  - `/private/tmp/sprint-029-responsive/chatwork-mobile.png`
  - `/private/tmp/sprint-029-responsive/chatwork-200%.png`
  - `/private/tmp/sprint-029-responsive/google-chat-desktop.png`
  - `/private/tmp/sprint-029-responsive/google-chat-mobile.png`
  - `/private/tmp/sprint-029-responsive/google-chat-200%.png`

8枚を目視し、切れ、重なり、横スクロール、CTA順の崩れ、見出し・本文・label・CTAの不自然な差し替えは0件だった。

## Bugs／再現手順

製品bugは0件。再現手順が必要な指摘はない。

評価環境上の不採用runは次の2件で、最終判定へ混ぜていない。

1. sandbox内のloopback `EPERM`。許可環境の同一コマンドで0 FAILを確認した。
2. 既存Sprint 027 browser scriptは、初回Google fixtureと設定変更fixtureで待つscreenが異なりtimeoutした。repoのscriptは変更せず、Evaluator用の一時CDP検査で実viewport、DOM、focus、screenshotを確認し、一時scriptを削除した。

## External operations／cleanup

- 実Chatwork API: 0件
- 実Google OAuth／Google Chat API: 0件
- 実Secretの入力・登録・読取: 0件
- GitHub Actions dispatch: 0件
- external remote push／remote変更／repo作成／公開: 0件
- plugin install／update: 0件
- BrowserでGitHub Secret登録linkを1回開いたが、入力・保存・変更は0件
- 回帰内のlocal bare remote push: 一時fixture内のみ。suite終了時に削除済み
- 一時wizard server、headless Chrome、CDP検査process: 0件残存
- 一時archive、Chrome profile、Evaluator用script、不採用responsive capture: 削除済み
- 残した一時物: 上記8枚のscreenshotだけ
- repoへの書込み: 本feedbackのみ。実装、spec、state、contract、progress、Git indexは変更していない

## Evaluator自己レビュー

- Generatorの自己評価を判定根拠として再利用したか: no
- Current IDとSprint 029だけを評価したか: yes
- AC1〜AC5を独立証跡で確認したか: yes
- missing ref、cycle、protected override 5種、4面外copy、wizard混入、report逆順を独立fixtureで確認したか: yes
- baseline fixtureに加えてSprint着手前`HEAD`も比較したか: yes
- master offlineと`.git`なしarchiveを完走したか: yes
- sandbox由来FAILを成功に読み替えず、許可環境で再実行したか: yes
- 両wizardを実Browserで操作し、responsive 6条件と8 screenshotを確認したか: yes
- UI未検証項目をPASS扱いしたか: no
- 実装または他roleの正本を変更したか: no
- 実外部サービスの状態を変更したか: no

## Generatorへの指示

なし。Sprint 029は合格。

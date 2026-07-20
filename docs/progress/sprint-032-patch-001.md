# Sprint 032 Patch 001 — 全会話のMarkdown可読性とChatwork Secret入力案内

**ステータス:** Generator実装・自己検証完了。Evaluator待ち

共通正本のユーザー向け会話surfaceを32件棚卸しし、短い1要点は自然な1段落、複数の手順・選択肢・結果・原因・次の行動は段落またはMarkdown箇条書きにする最低基準を追加した。改行の有無は設定項目にせず、既存preferencesでも無効にできない。

yasashiiの既定報告は、既存の意味と順序を変えず、`やったこと`、`結果`、`次に何が起きるか`を3つのMarkdown項目として物理的に分離した。agenticとyasashiiの思想・対象・4つのedition可変面は変更していない。

Chatwork wizardではGitHub Repository Secret登録stepに、`Name`欄は`CHATWORK_API_TOKEN`、`Secret`欄は本人がChatwork公式画面で取得したAPI Tokenと明示した。Token実値はGitHub画面にだけ入力し、wizard、AI会話、repo、ログへ貼らない境界を維持した。

## 実装内容

- `plugins/secretary/rules/common-language.md`
  - 全ユーザー会話に適用するMarkdown可読性の共通最低基準を追加した。
  - 1件1recordのjournal、index、commit message、設定値、machine-readable出力は対象外と明記した。
- `plugins/secretary/rules/styles/yasashii.md`
  - 既定3項目と、明示的な「くわしく」の4項目をMarkdown箇条書きにした。
  - 口調・専門用語・役割が項目数と可読性を変えないことを明記した。
- `plugins/secretary/skills/secretary/SKILL.md`、`memory-care/SKILL.md`、`daily/SKILL.md`、`settings/SKILL.md`、`templates/AGENTS.md`
  - ユーザー向けの「厳密な1行」「2行目を足さない」等の圧縮指示を、短い確認文・自然な段落・複数候補の箇条書きへ置き換えた。
  - 決定確認の原文保持、確認前無副作用、別turn了承後だけ記録する安全契約は維持した。
- `plugins/secretary/skills/onboarding/SKILL.md`、`daily/SKILL.md`、`connections/SKILL.md`ほか
  - 下位skillが通常報告の項目数・prefix・Markdown構造を重複所有せず、serializerへ委譲する説明へ揃えた。
- `plugins/secretary/skills/chatwork/assets/wizard/app.js`、`plugins/secretary/skills/chatwork/SKILL.md`
  - GitHub画面の`Name`／`Secret`欄の意味と、Token実値の安全な入力先を明示した。
  - Token入力欄、サンプルToken、実値表示は追加していない。
- `scripts/start-sprint-013-wizard-fixture.sh`
  - 実ネットワークへ接続しない合成GitHub remoteをlocal fixtureへ追加し、Repository Secretリンクを実DOMで検査可能にした。
- 既存回帰の期待値
  - `scripts/regression-check.sh`、`sprint-010-regression.sh`、`sprint-011-regression.sh`、`sprint-011-live-dialogue.sh`、`sprint-029-rule-boundary-test.mjs`を新しいMarkdown契約へ更新した。
  - 旧「一行圧縮」を正しい契約として要求し続けないようにした。

## 会話surface inventoryと負fixture

- `scripts/fixtures/sprint-032-patch-001/conversation-surface-inventory.json`
  - rules／edition copy、15件の全SKILL、workspace guidance、wizardの4分類を対象にした。
  - 実配布のユーザー向けsurfaceは32件で、禁止圧縮指示は0件。
  - machine-readableなCLI／script recordとmemory／workspace内部artifactは理由つきで対象外にした。
- `scripts/fixtures/sprint-032-patch-001/bad-compression.md`
  - 「改行を入れないで1行にまとめる」を意図的に再混入した負fixtureで、専用testが失敗を検出する。
- `scripts/sprint-032-patch-001-readability-test.mjs`
  - 短い確認、複数手順、診断、部分失敗、完了、handoff、edition比較、Chatwork Secret安全を内容と構造に分けて検査する。

初回の専用testでは全SKILL数を17件と誤記して1 FAILになった。実inventoryを再確認したところ配布SKILLは15件で漏れはなく、test期待値だけを15件へ修正した。Token入力欄の検査も、安全確認用checkboxのID `secret-confirmed`を誤検知したため、実際のtext／password／textareaだけを検出する条件へ絞った。いずれも製品不具合や未調査surfaceではない。

## 自動回帰

| 検査 | 結果 |
|---|---:|
| Patch専用scenario | 10 PASS / 0 FAIL / 32 surfaces |
| Patch wrapper | 5 PASS / 0 FAIL |
| Sprint 010 | 56 PASS / 0 FAIL |
| Sprint 011 | 68 PASS / 0 FAIL |
| Sprint 029 | 4 PASS / 0 FAIL |
| Sprint 030 | 7 PASS / 0 FAIL |
| Sprint 031 | 7 PASS / 0 FAIL |
| Sprint 032 | 5 PASS / 0 FAIL |
| offline master release gate | 447 PASS / 0 FAIL |

Sprint 030の一時workspaceは、macOSの`/var` symlinkを安全guardが意図どおり拒否するため、正式回帰では`TMPDIR=/private/tmp`を指定した。これは製品FAILではなく実行環境のpath条件であり、同条件で内部54/0、update config 10/0、wrapper 7/0を確認した。

```text
RELEASE_GATE mode=offline status=pass suites=9 required=9 passed=9 failed=0 skipped=0 assertions=447 pass=447 fail=0
```

## 実browser回帰

### Chatwork wizard

local fixture `http://127.0.0.1:18765/`をheadless Chromeで操作し、desktop、mobile、200%の3表示を確認した。

- `chatwork-register-connection`へ実際に遷移。
- headingは「接続情報をGitHubへ登録します。」。
- `Name`欄は`CHATWORK_API_TOKEN`。
- `Secret`欄は「Chatwork公式画面でご本人が取得したAPI Token」。
- Token実値はGitHub画面だけへ入力し、AI会話・repo・ログへ貼らない案内を表示。
- DOMのtext／password／textarea Token入力欄は0件。
- 合成URLは`https://github.com/fixture-owner/fixture-secretary/settings/secrets/actions/new`。
- 横overflow 0、最小control高48px、focusはheading、console error 0。

```text
SPRINT032_PATCH001_CHATWORK_BROWSER_PASS=3 SPRINT032_PATCH001_CHATWORK_BROWSER_FAIL=0
```

### Google Chat wizard

copy／flowを変更していないGoogle Chat wizardも、local fixture `http://127.0.0.1:18783/`でdesktop、mobile、200%を再確認した。

- file inputのaccessible name、keyboard focus、visible focus、44px以上の操作領域を維持。
- 合成JSON選択後だけ次へ進める。
- 横overflow 0、console error 0。

```text
SPRINT031_FILE_INPUT_BROWSER_PASS=3 SPRINT031_FILE_INPUT_BROWSER_FAIL=0
```

実browser検証では実Token、実Repository Secret、OAuth、API、Actions、remote write、pushを使っていない。Chromeの隔離一時profileと両fixtureは検証後に停止・削除した。

## Gitなしarchive candidate

current worktreeから次を除外し、Gitなしcandidateを`/private/tmp/yasashii-s032p001-candidate.cnRNGC`へ固定した。

- `.git`
- `docs/evidence`
- `.DS_Store`
- `.harness/config.local.toml`
- `.harness/config.local.json`
- `.env`、`.env.*`
- `*.pem`、`*.key`

archive結果を含むhandoffまで再同期した時点の固定結果は次のとおり。

| 項目 | 値 |
|---|---:|
| file数 | 342 |
| file bytes合計 | 3,653,045 |
| candidate SHA-256 | `73c6981d5d4f623e576266092fbea197f2a8dc62c2d2fc017488725026d4f832` |

SHA-256はcandidate rootでpathを昇順に並べた各fileのSHA-256一覧全体から算出した。固定直後のsourceとcandidateを同じ除外条件で`rsync --dry-run --delete`比較し、差分0件を確認した。本hashとbytesの追記はcandidate固定後に行ったため、Evaluatorは製品／test bytesの正本として固定candidateを使い、handoffの最終値はcurrent worktreeの本fileを参照する。

| 検査 | 結果 |
|---|---:|
| Gitなしarchive release gate | 107 PASS / 0 FAIL |

```text
RELEASE_GATE mode=archive status=pass suites=14 required=7 passed=7 failed=0 skipped=0 assertions=107 pass=107 fail=0
```

archiveで除外された7 suiteは、Git履歴またはcheckout専用の根拠を必要とするためであり、成功件数へ数えていない。archive固有の12 checksも全件PASSした。

## 起動・Evaluator handoff

- repository自体の起動コマンド: N/A（会話rule、copy、wizard案内のPatch）
- Patch専用回帰: `TMPDIR=/private/tmp bash scripts/sprint-032-patch-001-regression.sh`
- Sprint 029〜032: 各`TMPDIR=/private/tmp bash scripts/sprint-0NN-regression.sh`
- offline master: `TMPDIR=/private/tmp node scripts/master-release-gate.mjs --mode offline --root /Users/taisei/workspace/yasashii-secretary --timeout-ms 300000`
- Gitなしarchive: `TMPDIR=/private/tmp node scripts/master-release-gate.mjs --mode archive --root /private/tmp/yasashii-s032p001-candidate.cnRNGC --timeout-ms 300000`
- Chatwork fixture: `TMPDIR=/private/tmp bash scripts/start-sprint-013-wizard-fixture.sh 18765`
- Google Chat fixture: `TMPDIR=/private/tmp node scripts/start-sprint-020-patch-001-google-chat-fixture.mjs 18783`
- Chatwork browser: `node scripts/sprint-032-patch-001-chatwork-browser.mjs --cdp http://127.0.0.1:29331 --chatwork-url http://127.0.0.1:18765/`
- Google Chat browser: `node scripts/sprint-031-google-chat-file-input-browser.mjs --cdp http://127.0.0.1:29331 --google-url http://127.0.0.1:18783/ --test-client <fixtureが表示したTEST_ONLY path>`

Evaluatorはfreshに次を確認する。

1. inventory 32件と全SKILL 15件が一致し、対象外分類にユーザー会話surfaceが紛れていないこと。
2. 負fixtureだけが圧縮禁止scanで失敗し、配布surfaceは0件であること。
3. 短い1要点は自然な段落、複数要素はMarkdown構造、yasashii既定報告は3項目であること。
4. agentic／yasashiiの思想・対象・edition 4面の内容差が維持され、共通なのは可読性最低基準だけであること。
5. Chatworkの`Name`／`Secret`欄案内と、Token入力欄・実値・サンプル0件を実DOMで確認すること。
6. Google Chat wizardがcopy／flow／OAuth scope／file inputを回帰していないこと。
7. Sprint 029〜032、offline master、Gitなしarchiveを同一candidate bytesで再実行すること。
8. UI評価のスクリーンショットをEvaluator所有の`docs/evidence`へ保存すること。

## 外部操作とmodel metadata

今回のGenerator実装で行った外部writeは0件。main repoでも`git add`、commit、push、remote変更、plugin install、Repository Secret、Actions、OAuth、API、公開操作を行っていない。

Orchestratorが指定したGenerator routingはSol/highだが、このchild hostから実launch model／effort metadataは取得できないため、`launch-verified`とは記録しない。

## Generator自己評価

実装、専用負fixture、旧回帰期待値更新、両wizard実browser、offline master、Gitなしarchiveは0 FAILである。agenticとyasashiiの違い、安全境界、machine-readable recordを保ちつつ、全ユーザー会話へMarkdown可読性を適用した。

Sprint完了判定は、独立Evaluatorの実行・証跡を経てOrchestratorへ委ねる。

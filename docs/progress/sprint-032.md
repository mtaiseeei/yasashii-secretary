# Sprint 032 — 未配布段階の0.8.0 release preparation

**ステータス:** Generator実装・自己検証完了。Evaluator待ち

2 editionをまだ利用者へ明示配布していない前提へ契約を戻し、複雑な`0.7.0 → 0.8.0` external recovery／bootstrapは追加しなかった。
最初の明示配布候補を`0.8.0`へ揃え、新規導入、同一版／downgrade停止、同一candidateのcheckout／Gitなしarchive gateを0 FAILで完了した。

公開済み`0.7.0`の旧updaterがGoogle Chat標準生成fileで停止する既知blockerは未解消である。fixture削除、安全scan弱体化、既知pathの広い除外、same-version bridgeで合格に見せていない。

## 実装・整合した内容

- marketplace、plugin manifest、正本／legacy CHANGELOG、edition設定、README、公開更新ガイドを`0.8.0` candidateへ揃えた。
- `plugins/secretary/CHANGELOG.md`と`plugins/yasashii-secretary/CHANGELOG.md`をbyte-for-byte一致させた。
- 0.8.0 CHANGELOG、README、更新ガイド、update skillから、未検証の`0.7.0 → 0.8.0` live update／rollback／再update成功保証を除いた。
- 新規workspaceで共通edition guardからneutral markerを作り、edition付きschema 2 ledgerへ全管理対象を`installedVersion=0.8.0`で記録できることを回帰化した。
- `0.8.0 → 0.8.0`は`same`、`0.8.0 → 0.7.0`は`downgrade-blocked`になり、実更新CTAなし、workspace／Git／plugin／ledger／migration副作用0件で終わることを回帰化した。
- Sprint 032のmaster inventory名を旧`live-update`から`release-preparation`へ変更し、archiveでは公開0.7.0履歴を必要とする検査を成功扱いせず明示除外にした。
- 公開0.7.0 implementationをGit履歴から分離取得し、0.7.0 CHANGELOG entryと`0.6.0-to-0.7.0.json` migrationが不変であることを確認した。

Generatorが今回変更した主なfile:

- `plugins/secretary/CHANGELOG.md`
- `plugins/yasashii-secretary/CHANGELOG.md`
- `plugins/secretary/skills/update/SKILL.md`
- `README.md`
- `docs/guide/updates.md`
- `scripts/sprint-032-update-gate-test.mjs`
- `scripts/sprint-032-regression.sh`
- `scripts/master-release-gate.mjs`
- `docs/progress/sprint-032.md`

既存0.8.0 candidateのmanifest、edition guard、migration metadata、updateのequal／downgrade停止実装は保持し、改訂契約に合わせてfreshに再検証した。

## 固定candidate

current worktreeから次を除外して、同一candidateを`/private/tmp/yasashii-s032-candidate-Vyb0FG`へ固定した。

- `.git`
- `docs/evidence`
- `.DS_Store`
- `.harness/config.local.toml`
- `.harness/config.local.json`
- `.env`、`.env.*`
- `*.pem`、`*.key`

固定結果:

| 項目 | 値 |
|---|---:|
| file数 | 335 |
| file bytes合計 | 3,608,748 |
| candidate SHA-256 | `342b4c8fef3d1001c405020d84288b4d0648f111cb0b4b138b2223909847753c` |

SHA-256はpathを昇順に並べ、各fileを`SHA-256  relative-path`形式にした一覧全体から算出した。固定直後のsourceとcandidateを同じ除外条件で`rsync --dry-run --delete`比較し、差分0件を確認した。
本handoff文書の最終更新はcandidate固定後に行ったため、Evaluatorは製品／test bytesの正本として固定candidateを使い、progressはcurrent worktreeの本fileを参照する。

## 自動回帰とrelease gate

| 検査 | 結果 |
|---|---:|
| Sprint 032内部scenario | 15 PASS / 0 FAIL |
| Sprint 032 wrapper | 5 PASS / 0 FAIL |
| Sprint 017 | 33 PASS / 0 FAIL |
| Sprint 018 | 41 PASS / 0 FAIL |
| 公開0.7.0をGit履歴から実行するSprint 025 | 25 PASS / 0 FAIL |
| Sprint 030 | 7 PASS / 0 FAIL |
| Sprint 031 | 7 PASS / 0 FAIL |
| release integrity | PASS |
| offline master release gate | 442 PASS / 0 FAIL |
| Gitなしarchive release gate | 102 PASS / 0 FAIL |

正式なoffline masterは、loopback wizardが`127.0.0.1`へlistenできる実行環境で固定candidateと同じsource bytesを使って実行した。

```text
RELEASE_GATE mode=offline status=pass suites=8 required=8 passed=8 failed=0 skipped=0 assertions=442 pass=442 fail=0
RELEASE_GATE mode=archive status=pass suites=13 required=6 passed=6 failed=0 skipped=0 assertions=102 pass=102 fail=0
```

## 公開0.7.0の既知blocker

Git履歴から取得した公開0.7.0 pluginと、そのpluginが配布する次の標準sourceを使って再現した。

- `google-chat/scripts/continuous-sync.mjs`
- `google-chat/scripts/refresh-token.mjs`

公開0.7.0の`update-apply start`は候補0.8.0へpluginを切り替える前にexit 3で停止する。停止前後でworkspace bytes、HEAD、index、worktree、plugin versionが不変で、legacy update sessionも作成されなかった。

この結果は次のように扱う。

- 旧blockerは**未解消**。
- `0.7.0 → 0.8.0` live update／rollback／再updateのPASSには数えない。
- Google Chat標準fileをfixtureから除かない。
- scannerに対象pathの広い除外を追加しない。
- external recovery／bootstrapとsame-version bridgeを追加しない。
- 初回の明示配布は0.8.0の新規導入として検証する。

## private test repositoryの状態と外部操作

read-onlyで再取得した結果:

| 項目 | 結果 |
|---|---|
| repository | `mtaiseeei/yasashii-workspace-e2e`（private） |
| default branch | `main` |
| `main` SHA | `b3650016c6b9f38faf822586977a0eb0ee485a6b`（開始時から不変） |
| 既存test branch | `codex/sprint-032-live-gate-20260720` |
| test branch SHA | `15687dbcf79b912d2e64d68fc5ebd83871df4424`（前回停止時から不変） |

fresh Generatorで実行した外部操作:

| 操作 | 件数 |
|---|---:|
| private test branch追加commit／push | 0 |
| branch作成／削除／force push／history rewrite | 0 |
| plugin install／update | 0 |
| GitHub Actions dispatch | 0 |
| Repository Secret read／write | 0 |
| OAuth／Chatwork API／Google API | 0 |
| public release／公開変更 | 0 |

remoteへはSHAのread-only取得だけを行った。main repoでも`git add`、commit、pushを行っていない。

## 起動・Evaluator handoff

- repository自体の起動コマンド: N/A（release preparationとwizard回帰のSprint）
- Sprint 032専用回帰: `TMPDIR=/private/tmp bash scripts/sprint-032-regression.sh`
- offline master: `TMPDIR=/private/tmp bash scripts/master-release-gate.sh --mode offline --timeout-ms 600000`
- archive gate: `TMPDIR=/private/tmp node scripts/master-release-gate.mjs --mode archive --root /private/tmp/yasashii-s032-candidate-Vyb0FG --timeout-ms 600000`
- test URL: 各wizard fixtureが出力するloopback URL

Evaluatorはfreshに次を確認する。

1. candidate hash、335 file、3,608,748 bytesと、marketplace／plugin／CHANGELOG／README／guideの0.8.0整合。
2. 新規workspaceでneutral marker、edition付きschema 2 ledger、主要skill、Chatwork／Google Chat wizardが揃うこと。
3. sameとdowngrade-blockedの説明が実会話で読みやすく、全副作用0であること。
4. 公開0.7.0履歴から旧scanner blockerを再現でき、対応済み・live update PASS・配布保証へ誤集計していないこと。
5. Chatwork／Google Chat wizardをdesktop／mobileで操作し、copy、DOM、OAuth scope、file input、主要hit areaがSprint 031までから回帰していないこと。UI評価ではスクリーンショットを残す。
6. offline master 442/0とGitなしarchive 102/0を、同じcandidate bytesで再実行すること。
7. private test repoのmain／既存branch SHAが上記から不変で、追加external writeが0件であること。

## Generator自己評価

改訂されたSprint 032の受け入れ条件は満たした。0.8.0は新規導入candidateとして整合し、equal／downgradeは副作用0、portable gateは0 FAILである。

一方、公開0.7.0からの標準live updateは既知scanner blockerにより未解消であり、今回の配布保証には含めない。Sprint完了判定は独立EvaluatorとOrchestratorへ委ねる。

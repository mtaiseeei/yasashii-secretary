# Sprint 032 評価

- 判定: **PASS**
- 評価対象: `sprint-032`
- 評価日: 2026-07-20（Asia/Tokyo）
- Escalation Recommendation: **none**
- 外部状態を変える操作: **0件**
- 起動modelの実証: **unverified**（Sol/high指定。子hostのmodel metadataは取得不能）

## 結論

初回の明示配布候補を `0.8.0` へ直接揃える、という改訂後の契約を満たした。

marketplace、plugin manifest、正本／legacy CHANGELOG、README、更新ガイドは `0.8.0` で整合する。新規workspaceではneutral marker、edition付きschema 2 ledger、主要skill、両wizardが揃う。同一版とdowngradeは副作用0件で停止した。

旧 `0.7.0` updaterがGoogle Chat標準生成fileで停止する既知blockerはexit 3で再現できた。実装はこれをlive update成功へ数えず、fixture削除、安全scan弱体化、external bootstrap、same-version bridgeも行っていない。

固定candidateの専用回帰、関連回帰、offline master、Gitなしarchive、実browser、private test repoのread-only再確認がすべて合格したため、Sprint 032をPASSとする。

## 受入基準

| AC | 判定 | 根拠 |
|---|---|---|
| AC1 `0.8.0` 整合 | PASS | marketplace、plugin manifest、正本／legacy CHANGELOG、edition設定、README、更新ガイドを専用回帰で確認。legacy CHANGELOGはbyte一致。 |
| AC2 `0.7.0` 履歴不変 | PASS | 公開0.7.0をGit履歴から抽出し、0.7.0 entryと`0.6.0-to-0.7.0.json`の履歴期待値が不変。過去のprogress／feedback／Git履歴を書き換えていない。 |
| AC3 新規0.8.0導入 | PASS | 未導入workspaceでneutral marker、schema 2のedition ledger、`installedVersion=0.8.0`、主要skill、Chatwork／Google Chat wizardを確認。 |
| AC4 wizard／安全境界無回帰 | PASS | 関連回帰とmasterが0 FAIL。実loopback UIをdesktop／mobileで確認し、横overflow・console errorとも0。 |
| AC5 equal／downgrade停止 | PASS | `0.8.0 → 0.8.0` は`same`、`0.8.0 → 0.7.0` は`downgrade-blocked`。plugin、workspace、Git、設定、ledger、migrationの副作用0件。 |
| AC6 旧scanner blockerを正直に保持 | PASS | 公開0.7.0 updaterで標準Google Chat生成fileを使いexit 3を再現。前後bytes、HEAD、index、worktree、plugin version不変。live update成功へ誤集計していない。 |
| AC7 portable gate | PASS | 固定candidateの配布対象bytesをcheckoutへ重ねた専用／関連回帰と、同candidateのGitなしarchiveが合格。offline checkout側だけにrepo所有の監査evidenceを置き、archiveへ混ぜていない。 |
| AC8 private test repo不変 | PASS | `main`と既存test branchのSHAをread-onlyで再取得し、開始時から不変。追加commit／push／Actions／Secret／OAuth／API／公開／branch削除0件。 |
| AC9 表示の正直さ | PASS | 公開面は「未配布段階の0.8.0準備」と過去0.7.0履歴を区別し、未検証live update／rollback／再updateを約束しない。 |

## 固定candidateの独立確認

対象:

```text
/private/tmp/yasashii-s032-candidate-Vyb0FG
```

独立集計:

| 項目 | 結果 |
|---|---:|
| file数 | 335 |
| file bytes合計 | 3,608,748 |
| candidate SHA-256 | `342b4c8fef3d1001c405020d84288b4d0648f111cb0b4b138b2223909847753c` |

path昇順の各fileについて `SHA-256  ./relative-path` の一覧を作り、その一覧全体をSHA-256化した。current worktreeとの`rsync -ain --delete`比較では、candidate固定後に更新されたorchestration文書 `docs/progress/sprint-032.md` と `docs/sprints/state.md` だけが差分で、製品／test bytesの差分は0件だった。

## 自動回帰

固定candidateをlocal checkoutへ重ね、公開履歴を必要とする検査を独立実行した。

```text
TMPDIR=/private/tmp bash scripts/sprint-032-regression.sh
SPRINT032_INTERNAL_PASS=15 SPRINT032_INTERNAL_FAIL=0
SPRINT032_PASS=5 SPRINT032_FAIL=0
```

関連回帰:

| suite | 結果 |
|---|---:|
| Sprint 017 | 33 PASS / 0 FAIL |
| Sprint 018 | 41 PASS / 0 FAIL |
| Sprint 025 | 25 PASS / 0 FAIL |
| Sprint 030 core | 54 PASS / 0 FAIL |
| Sprint 030 update config | 10 PASS / 0 FAIL |
| Sprint 030 wrapper | 7 PASS / 0 FAIL |
| Sprint 031 path | 13 PASS / 0 FAIL |
| Sprint 031 wrapper | 7 PASS / 0 FAIL |

専用回帰で確認した主な正負ケース:

- 新規0.8.0導入、neutral marker、schema 2 edition ledger、主要skill、両wizard
- candidate／manifest／CHANGELOG／README／更新ガイドの0.8.0整合
- 正本／legacy CHANGELOGのbyte一致
- equal／downgradeの全副作用0停止
- 公開0.7.0 scanner blockerのexit 3再現と全副作用0
- fixture除外、安全scan弱体化、external bootstrap、same-version bridgeが0件

## master／archive

loopback listenが許可された環境でofficial offline masterを実行した。

```text
TMPDIR=/private/tmp bash scripts/master-release-gate.sh \
  --mode offline --timeout-ms 600000

RELEASE_GATE mode=offline status=pass suites=8 required=8 passed=8 failed=0 skipped=0 assertions=442 pass=442 fail=0
```

archiveは固定candidateそのものをrootにし、`.git`がない状態で実行した。

```text
TMPDIR=/private/tmp node scripts/master-release-gate.mjs \
  --mode archive \
  --root /private/tmp/yasashii-s032-candidate-Vyb0FG \
  --timeout-ms 600000

RELEASE_GATE mode=archive status=pass suites=13 required=6 passed=6 failed=0 skipped=0 assertions=102 pass=102 fail=0
```

offline checkoutは同じ製品／test bytesにrepo所有の監査evidenceとGit履歴を加えた評価形態である。archive側へ`docs/evidence`や`.git`を混ぜていない。

## Browser証跡

Evaluatorが別のloopback URLでChatwork／Google Chat wizardを実際に開き、DOM、画面、consoleを確認した。

| wizard | desktop | mobile `390×844` | console error |
|---|---|---|---:|
| Chatwork | heading、説明、details、CTAを確認 | 横overflowなし、button 48px・全幅 | 0 |
| Google Chat | file input、安全説明、終了／確認CTAを確認 | 横overflowなし、button 48px・全幅 | 0 |

スクリーンショット:

- `/private/tmp/sprint-032-chatwork-desktop.png`
- `/private/tmp/sprint-032-chatwork-mobile.png`
- `/private/tmp/sprint-032-google-chat-desktop.png`
- `/private/tmp/sprint-032-google-chat-mobile.png`

実画面には各サービス名、「今すること」、technical detail、安全説明、次のCTAが読み取れる形で表示された。desktop／mobileとも視覚的な重なりや切れはなかった。Google Chatのfile inputは可視で、確認buttonは未選択時にdisabledだった。

Sprint 032はwizard実装変更Sprintではないため、全画面遷移、実file selection、primary色・contrast、OAuth scope、SPACE境界は、今回0 FAILだったSprint 031／masterの動的回帰を無回帰根拠にした。実OAuth／API成功へは読み替えていない。

## private test repository

評価終了前にread-onlyで再取得した。

```text
gh repo view mtaiseeei/yasashii-workspace-e2e \
  --json nameWithOwner,isPrivate,defaultBranchRef

git ls-remote https://github.com/mtaiseeei/yasashii-workspace-e2e.git \
  refs/heads/main \
  refs/heads/codex/sprint-032-live-gate-20260720
```

| 項目 | 観測結果 |
|---|---|
| repository | `mtaiseeei/yasashii-workspace-e2e`（private） |
| default branch | `main` |
| `main` | `b3650016c6b9f38faf822586977a0eb0ee485a6b` |
| test branch | `15687dbcf79b912d2e64d68fc5ebd83871df4424` |

Generator handoffのSHAと一致した。Evaluatorはremoteへwriteしていない。

## Rubric採点

C14はRubric更新履歴とSprint別重点により `sprint-032-patch-001` の保証範囲である。Sprint 032では採点対象外とし、可読性改善やChatwork Secret具体案内を先取り実装していないことを不合格理由にしていない。

| 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 5/5 | 4 | PASS | AC1〜AC9を実物で確認。 |
| C2 構文・整合 | 5/5 | 5 | PASS | version、manifest、CHANGELOG、guide、candidateが整合。 |
| C3 機能の実証 | 4/5 | 4 | PASS | 新規導入、停止負例、回帰、running UIを実行。実Claude sessionは未検証。 |
| C4 非エンジニア体験 | 4/5 | 4 | PASS | 両wizardの初期画面で今すること、安全説明、次の操作が分かる。 |
| C5 安全・規律 | 5/5 | 5 | PASS | secret／API／OAuth／remote write／install／update 0件。 |
| C6 無回帰 | 5/5 | 5 | PASS | offline 442/442、archive 102/102、専用・関連回帰が0 FAIL。 |
| C7 やさしさ | 4/5 | 4 | PASS | 複雑な旧版救済を押し付けず、未検証範囲を明記。 |
| C8 wizard体験・デザイン | 4/5 | 4 | PASS | desktop／mobile screenshot、横overflow 0、48px CTA、console error 0。 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | neutral plugin pathとedition設定を維持。固有チャネル依存の再混入なし。 |
| C10 更新の安全性 | 5/5 | 5 | PASS | equal／downgrade／旧blockerの全副作用0。 |
| C11 Google Chat境界 | 5/5 | 5 | PASS | 今回の保証範囲でOAuth scope、SPACE限定、secret非露出の回帰が0 FAIL。外部liveは非scope。 |
| C12 0.8.0配布準備 | 5/5 | 5 | PASS | candidate整合、新規導入、portable gate、旧blockerの正直な扱い、external write 0。 |
| C13 edition分離・互換 | 5/5 | 5 | PASS | Sprint 032の保証範囲でneutral／legacy境界、新規0.8.0、旧raw CHANGELOG、停止条件を維持。別repo作成はSprint 033。 |
| C14 会話のMarkdown可読性 | N/A | Sprint 032 Patch 001 | 対象外 | 改行・箇条書き全体改善とChatwork Secret具体案内は次Patchの契約。 |

採点対象合計 **61/65**。対象13基準はすべて閾値以上。

## 環境上の再実行記録

- Gitなしcandidate直下で最初にSprint 032専用回帰を起動した際、公開0.7.0をGit履歴から取り出せず停止した。candidate欠陥とは判定せず、candidate bytesをlocal checkoutへ重ねて再実行し0 FAILを得た。
- sandbox内の最初のoffline masterはloopback bindが`EPERM`になり、archiveへ意図的に含めないrepo監査evidenceも不足した。この結果を製品FAIL／PASSへ数えず、loopback許可環境のcheckoutでofficial commandを再実行し442/442を得た。
- archive gateは固定candidate直下で独立に102/102を得た。

## 未検証／非scope

- 実Claude sessionでのplugin command／skill launch
- 公開0.7.0から0.8.0への実workspace live update、rollback、再update
- 実Chatwork API、実Google OAuth／Google Chat API
- Repository Secretの実入力・登録・読取
- GitHub Actions dispatch、online release、public release
- 実plugin install／update
- agentic-secretary別repo作成と2 edition同期
- 全会話surfaceのMarkdown可読性改修とChatwork Secret `Name`／`Secret`具体案内（`sprint-032-patch-001`）

未検証項目を成功扱いしていない。

## External operations／cleanup

- 製品からのChatwork／Google API: 0件
- OAuth、Secret、Actions dispatch: 0件
- remote変更、commit、push、repo作成、公開: 0件
- plugin install／update: 0件
- main repoのGit stage／commit: 0件
- Browser session: viewport reset、全tab finalize済み
- Chatwork／Google Chat fixture: 停止済み。ports `28765`／`28783` のLISTEN 0件
- private repo: SHAのread-only取得のみ
- repoへのEvaluator書込み: 本feedbackのみ

## Evaluator自己レビュー

- 固定candidateのidentityを独立計算したか: yes
- Generator結果とは別に専用／関連回帰を実行したか: yes
- 旧scanner blockerを消さず、exit 3と副作用0を確認したか: yes
- 初期環境エラーを製品FAIL／PASSへ読み替えていないか: yes
- offline checkoutとGitなしarchiveを完走したか: yes
- running UIをdesktop／mobileで確認し、screenshotを残したか: yes
- private repo SHAを終了前にread-only再取得したか: yes
- 未検証live update／API／Claude sessionを成功扱いしていないか: yes
- C14を次Patchの契約として分離したか: yes
- 実装、spec、state、contract、progressを変更していないか: yes
- 閾値と合否は一致しているか: yes

## Orchestratorへの申し送り

Sprint 032は合格。Orchestratorが `docs/sprints/state.md` を `done` へ更新し、契約どおり `sprint-032-patch-001` へ進める。

次Patchでは、ユーザーが追加指定した全会話surfaceのMarkdown可読性と、Chatwork wizardのGitHub Actions Secret案内（`Name`=`CHATWORK_API_TOKEN`、`Secret`=本人がChatwork公式画面で取得したAPI Token）を、2 editionの思想・target差を保ったまま評価する。

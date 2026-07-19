# Sprint 021 — 改訂仕様 Retry 0 評価結果

## 判定

- **合格**
- 評価対象: base `dfe36a0533ba22441a89de5eb7491c2ae97a414f` に、共有worktreeの未commit実装2差分だけを重ねたclean clone
  - `plugins/yasashii-secretary/scripts/lib/safe-git.mjs`
  - `scripts/sprint-021-git-safety-test.mjs`
- Escalation Recommendation: **none**
- External side effects: **0件**

改訂後の保証境界である、Google Chatのwizard session memory → `gh` stdin → Repository Secret、Chatworkの本人によるGitHub Repository Secret画面への直接入力、製品管理対象／初回publish inventoryの合理的な誤混入拒否、正規runtime参照と通常文書の誤拒否0件を確認した。

製品fixtureを使わない独立matrixは16/16、専用回帰は71/71、wrapperは8/8、引き継ぎ指定の関連回帰とmaster offline／onlineもすべて0 FAILだった。通常フローのsynthetic値はrepo、local／bare Git履歴、stdout／stderr、公開状態、製品側入力面、本feedbackへ残っていない。

## Rubric scores

| ID | Score | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 5/5 | 4 | PASS | 改訂後の受入12項目を独立fixture、実Git、関連suiteで全件確認した |
| C2 構文・整合 | 5/5 | 5 | PASS | clean cloneの対象差分は2ファイルだけ。Node構文2件と`git diff --check`が成功 |
| C3 機能の実証 | 5/5 | 4 | PASS | 新規local repo／local bare remoteでinspect、commit、push、candidate change、rollbackを実操作した |
| C4 非エンジニア体験 | 5/5 | 4 | PASS | 通常文書・説明metadata・`[REDACTED]`を誤拒否せず、危険時は値を出さず停止した |
| C5 安全・規律 | 5/5 | 5 | PASS | 通常フロー値露出0、合理的な誤混入のcommit／push 0、所有pathと既存indexを維持した |
| C6 無回帰 | 5/5 | 5 | PASS | 専用、wrapper、関連7 suite、master offline／onlineがすべて0 FAIL |
| C7 やさしさ | 5/5 | 4 | PASS | 値を表示しない停止理由、本人が行う操作、次の確認先を平易な日本語で維持した |
| C8 wizard体験・デザイン | 4/5 | 4 | PASS | 対象2差分にUI／DOM／CSS／copy変更なし。既存Chatwork／Google Chatのrunning DOM回帰を関連suiteで維持 |
| C9 配布チャネル非依存 | 5/5 | 5 | PASS | 対象2差分に配布文言・識別metadata変更なし。Sprint 016とmaster検査が合格 |
| C10 更新の安全性 | 5/5 | 5 | PASS | 更新面への差分なし。Sprint 018の41件とmaster検査が合格 |
| C11 Google Chat境界 | 5/5 | 5 | PASS | memoryから`gh` stdinへの直接登録、公開状態の値非露出、成功／失敗／キャンセル回帰を確認 |
| C12 0.7.0配布準備 | 5/5 | 5 | PASS | Sprint 021担当のsecret・所有Git境界が合格し、master offline 327／online 328も成功 |

**合計: 59/60。全軸が閾値以上のため合格。**

## 受入基準12項目

| # | 判定 | 根拠 |
|---:|---|---|
| 1 サービス別のRepository Secret導線 | PASS | Google Chatは`gh secret set <name>`のstdinへsession内の値を渡し、stdout／stderrを捨てる。Chatworkは現在のGitHub owner／repoからSecret登録URLを作り、製品側入力欄を持たない |
| 2 通常フロー値非露出 | PASS | Sprint 019の成功／失敗／キャンセル、Sprint 013／014の案内／確認／キャンセル、独立公開状態scanで値露出0 |
| 3 製品管理対象の誤混入拒否 | PASS | workflow／config／historyのknown field、credential URL、shell／JS通常literalをinspect・commit前に拒否し、local／bare履歴0 |
| 4 初回publish inventory | PASS | inventory内に1件でもOAuth／token候補があるfixtureは全体をcommit・pushせず、両履歴0 |
| 5 正規参照の許可 | PASS | `${{ secrets.NAME }}`、`$VAR`／`${VAR}`、`process.env`、identifierがinspect・commit・local bare pushを通過 |
| 6 誤拒否0件 | PASS | 通常文書、自然なpolicy／guidance／label、非機密metadata、`[REDACTED]`を文字種・長さで誤拒否しない |
| 7 候補変更後の再検査 | PASS | `afterScan`で候補を差し替えると`candidate-changed`でHEAD不変、未検査commit／push 0 |
| 8 初回publishの所有範囲 | PASS | 明示inventoryだけがcommit対象。無関係root file、既存stage、境界外pathを含めない |
| 9 Chatwork／Google Chat既存stage維持 | PASS | 両設定の所有pathだけをcommitし、別サービスと既存staged／unstaged／untrackedを維持 |
| 10 memory commit限定 | PASS | `secretary/memory/`だけをcommitし、projects／docsとrepo rootの既存状態を維持 |
| 11 失敗rollback | PASS | commit失敗、push失敗、non-fast-forwardで既存indexと別作業を維持。独立push競合では所有commitだけをrollback |
| 12 既存導線回帰 | PASS | 専用71、wrapper 8、Sprint 012／013／014／016／018／019／020、master offline／onlineが0 FAIL |

## 独立fixtureの証跡

### 評価環境

- `/tmp`のclean cloneをbase `dfe36a0`へ固定し、共有worktreeから対象2ファイルだけをコピーした。
- 開始時と全回帰後の`git status --short`は対象2ファイルだけだった。
- 独立matrixは製品testをimportせず、各危険ケースに新しいlocal repoとlocal bare remoteを作成した。
- synthetic値は実行時に生成し、判定は値の一致件数だけで行った。値そのものは出力していない。

```text
node /tmp/sprint-021-evaluator-scoped.18tIDK/independent-matrix.mjs /tmp/sprint-021-evaluator-scoped.18tIDK/repo

danger cases: 9/9 PASS
initial publish inventory: 1/1 PASS
safe runtime / docs / metadata / [REDACTED]: 1/1 PASS
owned scope / existing index: 1/1 PASS
candidate change: 1/1 PASS
push conflict / owned rollback: 1/1 PASS
Google Chat secret導線: 1/1 PASS
Chatwork secret導線: 1/1 PASS
INDEPENDENT_PASS=16 INDEPENDENT_FAIL=0
```

危険側はOAuth client JSON、private key、known token field、credential URL、shell literal／宣言、1行JS literal、workflow literal、history fieldを扱った。全ケースでinspectとcommitが`secret-detected`、local HEADとbare先端は不変、local／bare履歴とerror messageへの値露出は0件だった。

安全側はGitHub Actionsの正規Secret参照、shell環境変数、`process.env`、identifier、通常文書、自然な説明metadata、`[REDACTED]`を同じ実Git経路でcommit・local bare pushした。誤拒否は0件だった。

### Google Chat／Chatworkの通常導線

- Google Chat:
  - `runSecret()`は`spawn(..., ["secret", "set", name])`、`stdio: ["pipe", "ignore", "ignore"]`、`child.stdin.end(value)`を使う。
  - `publicOAuthState()`へstrict値を持つsessionを渡しても、返るのは状態、code、message、scope、Secret名だけで実値0件。
  - Sprint 019はsynthetic success、登録失敗、キャンセル、Secret削除失敗、grant revoke失敗を操作し、内部51/51、wrapper 12/12で合格。
- Chatwork:
  - 現在の`origin`から`https://github.com/<owner>/<repo>/settings/secrets/actions/new`を生成する。
  - wizardは「値はGitHubの画面だけで入力」「この画面や会話にも貼り付けない」と案内し、password／Token入力欄を持たない。
  - Sprint 013／014のrunning wizard回帰でToken登録確認前の取得拒否、値surface 0、確認／キャンセル副作用0を確認。

## 製品suite・関連回帰

```text
node --check plugins/yasashii-secretary/scripts/lib/safe-git.mjs
node --check scripts/sprint-021-git-safety-test.mjs
git diff --check
  PASS

node scripts/sprint-021-git-safety-test.mjs
  PASS=71 FAIL=0

bash scripts/sprint-021-regression.sh
  SPRINT021_PASS=8 SPRINT021_FAIL=0

bash scripts/sprint-012-regression.sh
  PASS=38 FAIL=0
bash scripts/sprint-013-regression.sh
  PASS=33 FAIL=0 (internal 35/35)
bash scripts/sprint-014-regression.sh
  PASS=41 FAIL=0 (internal 59/59)
bash scripts/sprint-016-regression.sh
  SPRINT016_PASS=2 SPRINT016_FAIL=0
bash scripts/sprint-018-regression.sh
  SPRINT018_PASS=41 SPRINT018_FAIL=0
bash scripts/sprint-019-regression.sh
  wrapper 12/12, internal 51/51
bash scripts/sprint-020-regression.sh
  wrapper 16/16, internal 50/50, adversarial 16/16

bash scripts/regression-check.sh --offline
  PASS=327 FAIL=0, exit 0
bash scripts/regression-check.sh --online
  PASS=328 FAIL=0, ONLINE=PASS, exit 0
```

Sprint 013／014を最初にsandbox内で実行した際は、製品assertではなくlocalhost `127.0.0.1`の`listen EPERM`だけで各1 FAILとなった。同じclean cloneと同じコマンドをlocalhost許可環境で再実行し、上記の0 FAILを確認した。Sprint 019／020とmasterも同じ理由でlocalhost許可環境を使った。hangはなかった。

## 非ゴールの分離

利用者が任意コードを意図的にcomputed／escaped key、偽placeholder、難読化へ改変するケースは、最新契約どおり保証対象matrixへ含めていない。その未検出をC1／C5／C6／C11／C12の減点理由にしていない。

今回合格したのは、製品が生成・管理する通常導線、初回publish inventory、合理的な誤混入、正規runtime参照、所有Git境界である。後続Sprint 022以降のsymlink一般境界、loopback session防御、`0.7.0` version更新、正式live gateを先取りしていない。

## Browser／screenshot

新規browser操作とスクリーンショットは実施していない。対象2差分はCLIのGit scannerと専用testだけで、HTML、CSS、DOM、copy、responsive、accessibilityに差分がないためである。既存wizardの実動作はSprint 013／014／019／020のrunning localhost回帰で確認し、UIの再採点はC8の必須面変更として扱っていない。

## Bugs

- なし。

## Generatorへの指示

- 修正不要。オーケストレーターがstateを更新し、次のSprintへ遷移できる。

## Evaluator self-review

- Harness skillと`evaluator.md`、最新spec、rubric、state、Sprint 021契約、progress、前回feedbackを読んでから評価した。
- Generatorの自己評価を判定根拠にせず、base固定clean cloneと製品fixture非流用の独立repo／local bare remoteを使った。
- 改訂仕様の保証対象と非ゴールを分離し、非ゴールの未検出をFAIL／減点にしていない。
- 受入12項目すべてに、独立fixtureまたは実行した関連suiteの証拠がある。
- synthetic値そのものをstdout／stderr、Git履歴、feedback、スクリーンショット、外部serviceへ出していない。
- C1〜C12の全スコアが閾値以上で、全体合格と一致している。
- 未実施の後続Sprint項目をSprint 021のPASS根拠にしていない。
- 実装、test、spec、state、progress、evidenceを変更していない。変更した正本は本feedbackだけ。
- 実GitHub、実OAuth、実Chatwork／Google Chat API、Repository Secret、Cloud project、Billingへの書き込みは0件。

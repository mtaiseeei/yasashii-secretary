# Sprint 021 — Generator handoff

## 実装結果

F36の対象4経路へ、資格情報の検査と「その操作が所有するpathだけをcommitする」共通処理を導入した。実装完了、独立Evaluatorの評価待ち。

- `safe-git.mjs`を追加した。一時index、つまり利用者の現在のstage領域とは別のGit索引で所有pathだけを候補化し、検査済みtreeとcommit直前treeが一致した場合だけcommitする。
- OAuth client JSON、client secret、認可コード、access／refresh token、Chatwork API Token、秘密鍵、credential URL、旧形式の`api_key = ...`を値を表示せず拒否する。通常の説明文やプログラム中の変数参照は誤拒否しない。
- 初回publishのinventoryを、`secretary/`、Chatwork／Google Chatの設定・workflow・runtime、既存の更新台帳に限定した。操作前からある無関係なrootファイルは初回commitへ含めない。
- Chatwork設定、Google Chat初回履歴・通常設定、memory commitを共通の所有commit処理へ接続した。別作業のstaged／unstaged／untracked変更と別サービスのファイルを維持する。
- pushは検査済みのcommitを明示して送る。non-fast-forward等の失敗時は所有commit／所有pathだけを戻し、既存indexを変えない。commit失敗時は作業treeを再試行可能な状態に残す。
- onboardingの説明を実装と合わせ、作業中フォルダ全体ではなく初期設定が所有するファイルだけを初回pushする、と明記した。

## 主要な設計判断

通常の`git add`と`git commit --only`では、既存indexの状態や同時変更との境界が分かりにくい。そこで`GIT_INDEX_FILE`による一時indexをHEADから作り、所有pathだけをstage・secret検査・tree固定・commitする方式にした。commit後は元のindexについて所有pathだけを新HEADへ追随させるため、対象外のstage内容とstage状態はbyte単位で残る。

push失敗時は`reset --hard`やforce pushを使わず、作成した所有commitだけを参照から外して所有pathを復元する。利用者が先に持っていた別commit、staged／unstaged／untracked変更は対象にしない。

## 自動検査

| コマンド | 結果 |
|---|---|
| `node scripts/sprint-021-git-safety-test.mjs` | `PASS=31 FAIL=0` |
| `bash scripts/sprint-021-regression.sh` | `SPRINT021_PASS=8 SPRINT021_FAIL=0` |
| `bash scripts/sprint-012-regression.sh` | `PASS=38 FAIL=0` |
| `bash scripts/sprint-013-regression.sh` | `PASS=33 FAIL=0`（内部Chatwork動的検査`35/35`を含む） |
| `bash scripts/sprint-014-regression.sh` | `PASS=41 FAIL=0`（内部Chatwork動的検査`59/59`を含む） |
| `bash scripts/sprint-018-regression.sh` | `SPRINT018_PASS=41 SPRINT018_FAIL=0` |
| `bash scripts/sprint-019-regression.sh` | `SPRINT019_WRAPPER_PASS=12 FAIL=0`（内部Google Chat検査`51/51`） |
| `bash scripts/sprint-020-regression.sh` | `SPRINT020_WRAPPER_PASS=16 FAIL=0`（内部Google Chat`50/50`、敵対fixture`16/16`） |
| `bash scripts/regression-check.sh --offline` | `PASS=327 FAIL=0` |
| `bash scripts/regression-check.sh --online` | `PASS=328 FAIL=0`（公開GitHubは読み取り専用。外部書き込み0件） |
| `node --check`／`bash -n`／`git diff --check` | すべてPASS |

専用fixtureはすべて`/tmp`の固有directoryとlocal bare remoteだけを使った。online回帰は公開GitHubを読み取り専用で確認した。実GitHub、実Chatwork、実Google Chat、実OAuth、Repository Secret、Cloud project、Billingへの変更は0件。資格情報はテスト内で都度生成し、stdout／stderrへ値が出ていないことも検査した。

## Generator自己評価

| 軸 | 点 | 根拠 |
|---|---:|---|
| C1 完成度 | 5 | Sprint 021の受入基準10件を専用fixtureで網羅した。 |
| C2 構文・整合 | 5 | Node／shell構文、明示inventory、参照先、全offline回帰が整合した。 |
| C3 機能の実証 | 5 | 正常、候補差替え、commit失敗、push失敗、non-fast-forwardを実Git＋local bare remoteで操作した。 |
| C4 非エンジニア体験 | 5 | 値を見せない停止メッセージと再試行可能な状態を維持し、onboarding説明も実装に合わせた。 |
| C5 安全・規律 | 5 | secret拒否、所有path限定、既存index維持、force pushなしを動的に確認した。 |
| C6 無回帰 | 5 | master offline `327/327`を含む全既存回帰が0 FAIL。 |
| C7 やさしさ | 5 | エラーは「何が起きたか」と安全な停止理由を値非露出で示す。既存serializer規律も回帰で維持した。 |
| C8 wizard体験・デザイン | 5 | UI変更なし。Chatwork／Google Chatの既存running wizard回帰を完走した。 |
| C9 配布チャネル非依存 | 5 | 現行配布面の既存監査を全offline回帰で維持した。 |
| C10 更新の安全性 | 5 | 更新機能そのものは非対象だが、既存Sprint 018の41件とmaster回帰を維持した。 |
| C11 Google Chat境界 | 5 | secret値非露出とGoogle Chat所有path限定を確認し、既存Google Chat回帰を維持した。 |
| C12 0.7.0配布準備 | 5 | 本Sprint担当のsecret検査漏れ・既存stage混入・失敗保護を専用31件で確認した。version更新や正式live gateは後続Sprintの契約どおり未実施。 |

## 起動・評価方法

このSprintはCLI／Git安全境界の変更で、新しい画面や確認URLはない。

専用回帰:

```bash
bash scripts/sprint-021-regression.sh
```

全offline回帰:

```bash
bash scripts/regression-check.sh --offline
```

公開remoteを含むonline回帰:

```bash
bash scripts/regression-check.sh --online
```

## Evaluatorへ渡す確認シナリオ

1. `/tmp`の新規repoへ無関係なstaged／unstaged／untrackedファイルを置き、`secretary/`だけをcommitして既存indexのbinary diffがbyte一致することを確認する。
2. Desktop OAuth client JSON、client secret、認可コード、access token、refresh token、Chatwork API Token、秘密鍵、credential URL、旧形式API keyを1種ずつ置き、commit／push 0件と値非露出を確認する。
3. 通常のOAuth説明文とChatwork runtimeソースがsecretとして誤拒否されないことを確認する。
4. secret検査後に候補を書き換え、`candidate-changed`で未検査commit／push 0件になることを確認する。
5. 初回publishで、`secretary/`等の明示inventoryだけがcommitされ、無関係なrootファイルと既存stageが残ることを確認する。
6. Chatwork設定でconfig／workflowだけ、Google Chat初回・通常設定でGoogle Chat所有pathだけがcommitされ、別サービスと既存stageが混ざらないことを確認する。
7. workspace repoのsubdirectoryでmemory commitを実行し、`secretary/`だけがcommitされることを確認する。旧形式のsecretary単体repoも確認する。
8. commit不能を起こし、HEAD、既存index、作業treeが再試行可能な状態に残ることを確認する。
9. local bare remoteを別cloneから先行させてnon-fast-forwardを起こし、所有commit／所有pathだけが戻り、既存stage／unstaged／untrackedが不変であることを確認する。
10. `bash scripts/regression-check.sh --offline`と`--online`を実行し、それぞれ`PASS=327 FAIL=0`、`PASS=328 FAIL=0`を再現する。

## 既知事項

- 本Sprintの未解決実装事項はない。最終合否は独立Evaluatorが判定する。
- `--online`は公開GitHubの読み取り専用確認まで実施した。実GitHubへの書き込み、実OAuth、実Chatwork／Google Chat、Repository Secretを使うlive確認はSprint 021の安全な合成fixture範囲外であり、後続の正式live gateを代替したとは扱わない。
- UI変更はないため新規スクリーンショットはない。既存wizardの機能回帰は完走した。
- Planner管理の`docs/spec*`、`docs/sprints/state.md`、`docs/sprints/sprint-021.md`〜`028.md`と、既存の未追跡`docs/evidence/sprint-020-patch-001/evaluator-retry2/`には触れていない。

## Retry 1 — Evaluator差し戻し4群の修正（2026-07-18）

**ステータス:** 実装完了 - 再評価待ち

### 修正内容

- credential fieldをsnake_case／camelCase等からcanonical formへ正規化した。`client_secret`、`access_token`、`refresh_token`、`authorization_code`、`clientSecret`は、値が全英字でも文字数や記号の有無に依存せず拒否する。
- OAuth callbackのquery／fragmentにある`code`も値の文字種に依存せず拒否する。説明用の`sample`／`redacted`等は通常文書として許可し、実値はGit履歴へ残さない。
- `oauth`／`token`／`credential`を含むファイル名だけで即時拒否する処理を外した。内容が安全な`oauth-guide.json`、`token-handling.txt`、`credential-policy.json`を負回帰として追加した。
- memory commitの所有範囲を、workspace形式・旧secretary単体repo形式とも`memory/`だけに限定した。`projects/`と`docs/`の既存staged／unstaged／untrackedはcommitにもindex更新にも含めない。
- upstream未設定時もremote branchの先端を確認するようにした。空remoteに今回以前のlocal commitがある場合は`push-base-changed`で停止し、remote先端が今回の`oldHead`と一致するときだけ所有commitを送る。
- master回帰の旧H3 fixtureをmemory commitの現行所有範囲へ合わせた。

### 追加した負回帰

- 全英字unquoted 4種、camelCase `clientSecret`、全英字OAuth callback code。
- 安全な資格情報説明文書3種のファイル名誤拒否0件。
- `secretary/projects/`と`secretary/docs/`に既存3状態があるmemory commit。
- upstreamなし＋空remote＋既存別commitの安全停止、upstreamなし＋既存remote基点一致の正常push。

### Retry 1 検査結果

| コマンド | 結果 |
|---|---|
| `node scripts/sprint-021-git-safety-test.mjs` | `PASS=45 FAIL=0` |
| `bash scripts/sprint-021-regression.sh` | `SPRINT021_PASS=8 SPRINT021_FAIL=0` |
| `bash scripts/sprint-012-regression.sh` | `PASS=38 FAIL=0` |
| `bash scripts/sprint-013-regression.sh` | `PASS=33 FAIL=0`（内部Chatwork `35/35`） |
| `bash scripts/sprint-014-regression.sh` | `PASS=41 FAIL=0`（内部Chatwork `59/59`） |
| `bash scripts/sprint-018-regression.sh` | `SPRINT018_PASS=41 SPRINT018_FAIL=0` |
| `bash scripts/sprint-019-regression.sh` | `SPRINT019_WRAPPER_PASS=12 FAIL=0`（内部Google Chat `51/51`） |
| `bash scripts/sprint-020-regression.sh` | `SPRINT020_WRAPPER_PASS=16 FAIL=0`（内部Google Chat `50/50`、敵対fixture `16/16`） |
| `bash scripts/regression-check.sh --offline` | `PASS=327 FAIL=0` |
| `bash scripts/regression-check.sh --online` | `PASS=328 FAIL=0`（公開GitHubは読み取り専用。外部書き込み0件） |
| `node --check`／`bash -n`／`git diff --check` | すべてPASS |

最初のsandbox内関連suiteではlocalhost bindが`EPERM`になったため、localhostを許可した同一suiteを再実行して全件PASSを確認した。これは製品FAILとは分離している。online回帰では公開GitHubを読み取り専用で確認し、`ONLINE=PASS`を含む全328件が合格した。外部書き込みは0件である。Gitの動的検証はすべて`/tmp`の一時repoとlocal bare remote、合成値だけを使った。

### Retry 1 自己評価

| 軸 | 点 | 根拠 |
|---|---:|---|
| C1 完成度 | 5 | Evaluatorが再現した4群をすべて製品suiteへ追加し、45/45で閉じた。 |
| C2 構文・整合 | 5 | Node／shell構文、関連suite、master offlineが0 FAIL。 |
| C3 機能の実証 | 5 | 実Git＋local bare remoteで拒否、許可、既存状態維持を動的に確認した。 |
| C4 非エンジニア体験 | 5 | 安全文書を誤拒否せず、危険時は値を出さず停止理由を示す。 |
| C5 安全・規律 | 5 | secret commit、memory外混入、既存別commitの黙示pushを0件にした。 |
| C6 無回帰 | 5 | master offline `327/327`、関連Chatwork／Google Chat／更新回帰が0 FAIL。 |
| C7〜C12 | 5 | UI変更なし。既存のやさしさ、配布面、更新安全性、Google Chat境界を関連suiteで維持した。 |

### 再評価への引き渡し

- 起動方法／URL: CLI・Git安全境界のため新規画面なし。
- 専用回帰: `bash scripts/sprint-021-regression.sh`
- 全offline回帰: `bash scripts/regression-check.sh --offline`
- 優先シナリオ: 上記4群の独立fixtureを、`/tmp`のlocal repo／local bare remoteと合成値だけで再実行する。
- 未解決実装事項: なし。最終合否は独立Evaluatorが判定する。
- 外部副作用: 0件。実GitHub、実OAuth、実Chatwork、実Google Chat、Repository Secret、Cloud projectは変更していない。

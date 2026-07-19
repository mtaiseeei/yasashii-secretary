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

## Retry 2 — shell資格情報literalの敵対評価修正（2026-07-19）

**ステータス:** 実装完了 - 再評価待ち

### 修正内容

- `.sh`／`.bash`／`.zsh`を一般のcode file判定から分離した。shellではbare wordを変数参照とみなさず、資格情報keyへのliteral代入として拒否する。
- shellで安全なruntime参照として許可する値を、単一の`$VAR`／`${VAR}`（二重引用符付きも含む）へ限定した。single quote、bare literal、quoted literal、command／default expansion等は安全側で拒否する。
- `export`、`local`、`readonly`、`declare`、`typeset`と、それらのoption／`--`を宣言prefixとして認識する。snake_case／camelCaseの資格情報keyを同じcanonical判定へ通す。
- assignment検査の空白を水平空白へ限定した。これにより正規表現が改行をまたいで次行を値として取り込まず、空代入・宣言だけの安全なshellを誤拒否しない。
- GitHub Actionsの`${{ ... }}`は値そのものではなくruntime参照なので、既存Chatwork／Google Chat workflowを誤拒否しないplaceholderとして明示した。
- JSは従来どおり`process.env`とidentifier参照を許可し、snake_case／camelCase keyのquoted literalを拒否する。OAuth callbackのquery／fragment拒否も維持した。

### 追加した回帰境界

- 拒否: `.sh`／`.bash`／`.zsh`のbare literal、5種のshell宣言、single／double quoted literal、literal fallback付きdefault expansion。
- 拒否: JSのsnake_case／camelCase quoted literal。
- 許可: shellの`$VAR`／`${VAR}`、5種のshell宣言、option／`--`、二重引用符、空代入、宣言のみ。
- 許可: JSの`process.env`／identifier、GitHub Actionsの`${{ ... }}`。

### Retry 2 検査結果

| コマンド | 結果 |
|---|---|
| 独立敵対fixture（製品fixture非流用、`/tmp` local repo／bare remote） | `INDEPENDENT_PASS=17 INDEPENDENT_FAIL=0` |
| `node scripts/sprint-021-git-safety-test.mjs` | `PASS=59 FAIL=0` |
| `bash scripts/sprint-021-regression.sh` | `SPRINT021_PASS=8 SPRINT021_FAIL=0` |
| `bash scripts/regression-check.sh --offline` | `PASS=327 FAIL=0` |
| `bash scripts/regression-check.sh --online` | `PASS=328 FAIL=0`、`ONLINE=PASS` |
| `node --check`／`git diff --check` | すべてPASS |

master回帰は、共有作業ツリーにPlanner／Evaluator管理の未commit正本変更が存在したため、実装commit `44b75a1`から作った`/tmp`のclean cloneで実行した。共有作業ツリーでの最初のoffline実行は、その正本変更をSprint 016のprotected-record検査が正しく拒否し、sandbox内のlocalhost待受も`EPERM`になった。製品FAILとは分離し、clean clone＋localhost許可でoffline 327件、公開GitHub読み取り専用online 328件を0 FAILで完走した。

### Retry 2 自己評価

| 軸 | 点 | 根拠 |
|---|---:|---|
| C1 完成度 | 5 | shell漏れの根本原因を言語別判定で閉じ、宣言・literal・runtime参照境界を回帰化した。 |
| C2 構文・整合 | 5 | Node構文、差分検査、既存workflow runtime参照がすべて整合した。 |
| C3 機能の実証 | 5 | 独立fixtureでinspect拒否、commit 0、push 0、local／bare履歴露出0を確認した。 |
| C4 非エンジニア体験 | 5 | 値を出さない停止メッセージと安全なruntime参照の誤拒否0件を維持した。 |
| C5 安全・規律 | 5 | bare／quoted／default literalをGit履歴へ入れない。外部書込み0件。 |
| C6 無回帰 | 5 | clean cloneのoffline 327件、online 328件が0 FAIL。 |
| C7〜C12 | 5 | UI変更なし。既存配布面、更新安全性、Google Chat境界、0.7.0安全gateを全回帰で維持した。 |

### 再評価への引き渡し

- 実装commit: `44b75a1`（`[sprint-021] shell資格情報literalの検査を強化`）。既存commitはamendしていない。
- 起動方法／URL: CLI・Git安全境界のため新規画面なし。
- 専用回帰: `bash scripts/sprint-021-regression.sh`
- 全回帰: `bash scripts/regression-check.sh --offline`、公開GitHub読み取り専用の`--online`。
- 優先シナリオ: `.sh`／`.bash`／`.zsh`の3敵対ケースに加え、5宣言、quoted literal、default expansion、`$VAR`／`${VAR}`、JS runtime参照を独立repoで再確認する。
- 外部副作用: 0件。実GitHub書込み、実OAuth、実Chatwork／Google Chat、Repository Secret、Cloud project、Billingは変更していない。

## Retry 1 — 説明metadataの誤拒否修正（2026-07-19）

**ステータス:** 実装完了 - 再評価待ち

### 修正内容

- `client secret`、`refresh token`等の資格情報語をkeyに含むだけでは、安全な説明metadataまで即拒否しないようにした。keyをword列へ分解し、末尾が`policy`、`handling`、`description`、`example`、`name`等のmetadata役割であることを確認する。
- suffixだけのallowlistにはしていない。値側も、非保存方針、runtime-only、安全な保管場所、資格情報を受け取るfield／環境変数名のいずれかとして明確な場合だけ許可する。曖昧な短文、長いpayload、資格情報代入、説明文へ埋め込んだ合成literalは拒否する。
- JSON、URL query、通常のassignment、JS／TS object propertyを同じkey＋value判定へ寄せた。shellは従来どおりruntime変数参照だけを許可し、metadata suffixによる緩和対象にはしていない。
- Evaluatorの3誤拒否を含む安全metadata 5形式を、`inspectWorkingCandidates`、所有commit、local bare remoteへのpushまで動的に回帰化した。
- 危険偽装8形式を追加した。`clientSecretPolicy: "実secret"`、policy／handling／description／example／nameへの合成literal、説明文へのliteral埋込み、quoted key、複数property、`.tsx`／`.cts`を、inspect／commit前に拒否し履歴へ残さない。

### 検査結果

| コマンド | 結果 |
|---|---|
| `node scripts/sprint-021-git-safety-test.mjs` | `PASS=76 FAIL=0` |
| `bash scripts/sprint-021-regression.sh` | `SPRINT021_PASS=8 SPRINT021_FAIL=0` |
| `bash scripts/sprint-012-regression.sh` | `PASS=38 FAIL=0` |
| 隔離cloneの`bash scripts/sprint-013-regression.sh` | `PASS=33 FAIL=0`（内部Chatwork `35/35`） |
| 隔離cloneの`bash scripts/sprint-014-regression.sh` | `PASS=41 FAIL=0`（内部Chatwork `59/59`） |
| 隔離cloneの`bash scripts/sprint-016-regression.sh` | `SPRINT016_PASS=2 SPRINT016_FAIL=0` |
| `bash scripts/sprint-018-regression.sh` | `SPRINT018_PASS=41 SPRINT018_FAIL=0` |
| 隔離cloneの`bash scripts/sprint-019-regression.sh` | `SPRINT019_WRAPPER_PASS=12 FAIL=0`（内部Google Chat `51/51`） |
| 隔離cloneの`bash scripts/sprint-020-regression.sh` | `SPRINT020_WRAPPER_PASS=16 FAIL=0`（内部Google Chat `50/50`、敵対fixture `16/16`） |
| 隔離cloneの`bash scripts/regression-check.sh --offline` | exit 0、全項目0 FAIL（master集計は従来どおり`PASS=327 FAIL=0`） |
| 隔離cloneの`bash scripts/regression-check.sh --online` | exit 0、`ONLINE=PASS`、全項目0 FAIL（master集計は従来どおり`PASS=328 FAIL=0`） |
| `node --check`／`git diff --check` | すべてPASS |

共有作業ツリーのSprint 016は、Planner／Evaluator管理の未commit正本変更をprotected recordとして正しく拒否した。製品差分と分離するため、base `dfe36a0`から作った`/tmp/sprint-021-generator-metadata.ahoh3n/repo`へ実装2ファイルだけを重ね、Sprint 016、関連suite、master offline／onlineを実行した。Sprint 013の最初のsandbox実行はlocalhost bindが`EPERM`になったため、同じ隔離cloneをlocalhost許可で再実行して合格した。製品FAILとは分離している。

### 自己評価

| 軸 | 点 | 根拠 |
|---|---:|---|
| C1 完成度 | 5 | 説明metadataの誤拒否をkey＋valueの二重判定で閉じ、Evaluatorの3形式と近傍境界を回帰化した。 |
| C2 構文・整合 | 5 | Node構文、差分、JSON／JS／TS／TSX／CTS境界が整合した。 |
| C3 機能の実証 | 5 | 安全5形式はinspect／commit／local bare push、危険8形式はinspect／commit拒否・HEAD不変・履歴露出0を実Gitで確認した。 |
| C4 非エンジニア体験 | 5 | 明確な方針metadataを保存でき、危険時の値を出さない停止を維持した。 |
| C5 安全・規律 | 5 | suffixだけでは許可せず、literal偽装と埋込みを拒否し、既存stage・所有path境界を維持した。 |
| C6 無回帰 | 5 | 専用76件、関連suite、master offline／onlineが0 FAIL。 |
| C7〜C12 | 5 | UI変更なし。配布面、更新安全性、Google Chat境界、0.7.0安全gateの既存回帰を維持した。 |

### 再評価への引き渡し

- 実装対象: `plugins/yasashii-secretary/scripts/lib/safe-git.mjs`、`scripts/sprint-021-git-safety-test.mjs`。
- 起動方法／URL: CLI・Git安全境界のため新規画面なし。
- 専用回帰: `bash scripts/sprint-021-regression.sh`。
- 全回帰: `bash scripts/regression-check.sh --offline`、公開GitHub読み取り専用の`--online`。
- 優先シナリオ: `clientSecretPolicy`、`googleOauthRefreshTokenGchatHandling`、TSの`clientSecretPolicy`／`refreshTokenHandling`を安全な通常文書として許可し、同じkeyへの実literal、説明埋込みliteral、`name`／`example`偽装を拒否する。既存の危険側4ケース・10形式、shell、OAuth JSON／URL、runtime参照も再確認する。
- commit: ユーザー指示どおり再試行していない。実装2ファイルと本progressを未commit差分として残した。
- 外部副作用: 0件。Git動的検証は`/tmp`のlocal repo／local bare remoteと合成値だけ。onlineは公開GitHubの読み取り専用確認だけで、実GitHub書込み、実OAuth、実Chatwork／Google Chat、Repository Secret、Cloud project、Billingは変更していない。

## ユーザー再承認後の限定再試行 — 実運用keyと1行object（2026-07-19）

**ステータス:** 実装完了 - 再評価待ち

### 修正内容

- credential keyの判定をcanonicalな完全一致だけに依存させず、snake_case／camelCase／大文字環境変数名をword列へ分解し、`client secret`、`refresh token`、`access token`等の資格情報語が連続して含まれるkeyを一般に拒否するようにした。サービス名や用途名が前後に付いても同じ判定へ入る。
- JS／TS等のcode fileでは、行頭の代入に加えてobject propertyの区切りからkeyと値を読む。これにより1行のobject literalにあるsnake_case／camelCaseのquoted literalを検出する。
- quoted literalだけを追加拒否し、identifier、`process.env`、GitHub Actions式は従来どおりruntime参照として許可する。shellの`$VAR`／`${VAR}`、空代入、既存の安全文書も維持した。
- Retry 2で独立再現された4ケースを製品fixtureへ追加し、各ケースでworking candidateのinspect拒否、commit 0、local bare remote先端不変、local／remote両履歴への値露出0を確認するようにした。合成値そのものはstdout／stderrへ出さない。

### 限定再試行の検査結果

| コマンド | 結果 |
|---|---|
| 修正前の追加4ケース | `PASS=59 FAIL=4`。4ケースだけが独立に失敗することを確認 |
| `node scripts/sprint-021-git-safety-test.mjs` | `PASS=63 FAIL=0` |
| `bash scripts/sprint-021-regression.sh` | `SPRINT021_PASS=8 SPRINT021_FAIL=0` |
| `bash scripts/sprint-012-regression.sh` | `PASS=38 FAIL=0` |
| `bash scripts/sprint-013-regression.sh` | `PASS=33 FAIL=0`（内部Chatwork `35/35`） |
| `bash scripts/sprint-014-regression.sh` | `PASS=41 FAIL=0`（内部Chatwork `59/59`） |
| `bash scripts/sprint-018-regression.sh` | `SPRINT018_PASS=41 SPRINT018_FAIL=0` |
| `bash scripts/sprint-019-regression.sh` | `SPRINT019_WRAPPER_PASS=12 FAIL=0`（内部Google Chat `51/51`） |
| `bash scripts/sprint-020-regression.sh` | `SPRINT020_WRAPPER_PASS=16 FAIL=0`（内部Google Chat `50/50`、敵対fixture `16/16`） |
| 隔離cloneのmaster offline | 一巡完了。最終集計行は実行出力の切り詰めで未取得だが、同じcloneのonline全項目に内包して0 FAILを確認 |
| 隔離cloneの`bash scripts/regression-check.sh --online` | `PASS=328 FAIL=0`、`ONLINE=PASS` |
| `node --check`／`bash -n`／`git diff --check` | すべてPASS |

Sprint 013／014／019の最初のsandbox内実行はlocalhost bindが`EPERM`となった。同一suiteをlocalhost許可環境で再実行し、上記の全件PASSを確認したため製品FAILとは分離した。masterは共有作業ツリーのPlanner／Evaluator管理変更を混ぜないため、`/tmp/sprint-021-generator-retry4.WqjqIG/repo`のlocal cloneへ実装2ファイルだけを重ねて実行した。Gitの動的検証はすべて`/tmp`のlocal repo／local bare remoteと合成値だけを使った。onlineは公開GitHubの読み取り専用確認だけで、外部書込みは0件である。

### 限定再試行の自己評価

| 軸 | 点 | 根拠 |
|---|---:|---|
| C1 完成度 | 5 | ユーザーが限定した4ケースを一般化したkey／構文判定で閉じ、正負の近傍境界を回帰化した。 |
| C2 構文・整合 | 5 | Node／shell構文、差分、専用・関連・master onlineが0 FAIL。 |
| C3 機能の実証 | 5 | 4ケースすべてでinspect拒否、commit 0、push先端不変、local／bare両履歴露出0を実Gitで確認した。 |
| C4 非エンジニア体験 | 5 | 値を出さず安全に停止し、安全なruntime参照と説明文書は誤拒否しない。 |
| C5 安全・規律 | 5 | strict credential keyを前後語つきでも拒否し、既存stage・所有path境界を維持した。 |
| C6 無回帰 | 5 | 専用63件、関連suite、master online 328件が0 FAIL。 |
| C7〜C12 | 5 | UI変更なし。既存配布面、更新安全性、Google Chat境界、0.7.0安全gateの対象回帰を維持した。 |

### 再評価への引き渡し

- 実装対象: `plugins/yasashii-secretary/scripts/lib/safe-git.mjs`、`scripts/sprint-021-git-safety-test.mjs`。
- 起動方法／URL: CLI・Git安全境界のため新規画面なし。
- 専用回帰: `bash scripts/sprint-021-regression.sh`。
- 全回帰: `bash scripts/regression-check.sh --offline`、公開GitHub読み取り専用の`--online`。
- 優先シナリオ: 実運用Google OAuth keyを持つshell 2件、1行JS objectのsnake／camel 2件について、inspect拒否、commit／push 0、local／bare両履歴露出0を独立fixtureで再確認する。近傍の`$VAR`／`${VAR}`、`process.env`／identifier、GitHub Actions式、空代入、安全文書も同時に確認する。
- commit: `.git`へのindex書込みがsandboxで拒否され、`[sprint-021] 資格情報keyと同一行object検査を強化` は作成できなかった。既存indexを混ぜる迂回は行わず、実装2ファイルと本progressの変更を未commitで残した。
- 外部副作用: 0件。実GitHub書込み、実OAuth、実Chatwork／Google Chat、Repository Secret、Cloud project、Billingは変更していない。

## Retry 2 — metadata値の閉じた安全文法（2026-07-19）

**ステータス:** 実装完了 - 再評価待ち

### 修正内容

- 説明metadataの安全許可から、`SYN_`、長さ、entropy相当の文字種、部分一致による推測を除いた。metadata suffixは資格情報metadata候補の分類だけに使い、安全性の根拠にはしていない。
- metadata値は、source literalの引用符を値全体として確認し、内部の前後空白、改行、control character、backslash／escapeを拒否してから、ASCII英字だけを小文字化する。`runtime-only`、`never persisted`、`runtime-only; never persisted`、`Repository Secretだけで扱う`、`実行時だけ参照し、Git履歴へ保存しない`等の閉じた安全enum／定型句へ全体一致した場合だけ許可する。未認識のprefix／suffix／Unicode等が1文字でも残れば拒否する。
- `name`／`label`は、値全体がASCIIのfield identifierで、資格情報keyとして明示的に解釈でき、metadata suffix自体ではない場合だけ許可する。
- 一般的な固定placeholder `[REDACTED]` を完全一致の安全値として追加した。
- 最新feedbackのmetadata攻撃12形式を回帰化した。8文字／19文字、短いbase64風、記号分割、Unicode、quote／escape、改行、prefix、suffix、quoted key＋複数property、prefix／suffix付きkey、短いlabelを、値を出力せず検査する。
- 12形式それぞれでinspect拒否、commit拒否、local HEAD不変、local bare remote先端不変、local／bare両履歴のpayload 0件を確認する。許可側は既存metadata 5形式と`[REDACTED]`をinspect、commit、local bare pushまで確認する。

### 検査結果

| コマンド | 結果 |
|---|---|
| `node --check plugins/yasashii-secretary/scripts/lib/safe-git.mjs` | PASS |
| `node --check scripts/sprint-021-git-safety-test.mjs` | PASS |
| `git diff --check` | PASS |
| `node scripts/sprint-021-git-safety-test.mjs` | `PASS=89 FAIL=0` |
| `bash scripts/sprint-021-regression.sh` | `SPRINT021_PASS=8 SPRINT021_FAIL=0` |
| `bash scripts/sprint-012-regression.sh` | `PASS=38 FAIL=0` |
| localhost許可環境の`bash scripts/sprint-013-regression.sh` | `PASS=33 FAIL=0`（内部Chatwork `35/35`） |
| localhost許可環境の`bash scripts/sprint-014-regression.sh` | `PASS=41 FAIL=0`（内部Chatwork `59/59`） |
| 隔離cloneの`bash scripts/sprint-016-regression.sh` | `SPRINT016_PASS=2 SPRINT016_FAIL=0` |
| `bash scripts/sprint-018-regression.sh` | `SPRINT018_PASS=41 SPRINT018_FAIL=0` |
| localhost許可環境の`bash scripts/sprint-019-regression.sh` | `SPRINT019_WRAPPER_PASS=12 FAIL=0`（内部Google Chat `51/51`） |
| localhost許可環境の`bash scripts/sprint-020-regression.sh` | `SPRINT020_WRAPPER_PASS=16 FAIL=0`（内部Google Chat `50/50`、敵対fixture `16/16`） |
| 隔離cloneの`bash scripts/regression-check.sh --offline` | exit 0、`PASS=327 FAIL=0` |
| 隔離cloneの`bash scripts/regression-check.sh --online` | exit 0、`PASS=328 FAIL=0`（公開GitHub API online実在検査を含む） |

共有作業ツリーのSprint 016は、Planner／Evaluatorが所有する未commit正本をprotected recordとして正しく拒否した。製品差分と分離するため、HEADから作った`/tmp/sprint-021-generator-retry2.S3f0wN/repo`へ実装2ファイルだけを重ね、Sprint 016とmaster offline／onlineを実行した。Sprint 013／014のsandbox内初回実行はlocalhost bindが`EPERM`になったため、同一suiteをlocalhost許可環境で再実行して0 FAILを確認した。製品FAILとは分離している。

### 自己評価

| 軸 | 点 | 根拠 |
|---|---:|---|
| C1 完成度 | 5 | 最新feedbackのCriticalと`[REDACTED]`誤拒否だけを修正し、12攻撃と安全側を実Gitで回帰化した。 |
| C2 構文・整合 | 5 | Node構文、差分、JSON／JS／TS／TSX／CTSの値全体判定が整合した。 |
| C3 機能の実証 | 5 | 安全6形式はcommit／push成功、攻撃12形式はinspect／commit拒否、local／bare両履歴0件を確認した。 |
| C4 非エンジニア体験 | 5 | `[REDACTED]`と明確な安全metadataを許可し、危険時は値を出さず停止する。 |
| C5 安全・規律 | 5 | 安全文の部分一致を廃止し、認識済み文法で値全体を消費できない場合は安全側で拒否する。 |
| C6 無回帰 | 5 | 専用89件、関連suite、隔離master offline 327件／online 328件が0 FAIL。 |
| C7〜C12 | 5 | UI変更なし。既存配布面、更新安全性、Google Chat境界、0.7.0安全gateを維持した。 |

### 再評価への引き渡し

- 実装対象: `plugins/yasashii-secretary/scripts/lib/safe-git.mjs`、`scripts/sprint-021-git-safety-test.mjs`。
- 起動方法／URL: CLI・Git安全境界のため新規画面なし。
- 専用回帰: `bash scripts/sprint-021-regression.sh`。
- 全回帰: `bash scripts/regression-check.sh --offline`、公開GitHub読み取り専用の`--online`。
- 優先シナリオ: 安全enum／定型句とfield identifierは値全体一致だけを許可し、同じ値への短いprefix／suffix、改行、escape、Unicode、短い分割payloadは拒否する。`[REDACTED]`、既存危険10形式、runtime参照、安全Markdownも再確認する。
- commit: ユーザー指示どおり再試行していない。実装2ファイルと本progressを未commit差分として残した。
- 外部副作用: 0件。Git動的検証は`/tmp`のlocal repo／local bare remoteと生成payloadだけ。onlineは公開GitHubの読み取り専用確認だけで、実GitHub書込み、実OAuth、実Chatwork／Google Chat、Repository Secret、Cloud project、Billingは変更していない。

## 最新handoff

2026-07-19のfresh Generatorが、Planner修正後のspec／rubric／Sprint 021契約と現コードを再照合した。以前の「Chatworkもwizard memoryから直接登録する」というSpec issueは解消済みで、この文書内の旧`Spec issue`節は履歴としてのみ残し、現在の判定には使わない。

- Google Chatは既存実装どおり、OAuth実値をlocal wizard sessionのmemory内だけで保持し、`gh secret set <name>`のstdinへ渡して現在のprivate repoのRepository Secretへ登録する。値のコピー／貼り付け要求はない。
- Chatworkは既存F24導線どおり、wizard／AIがTokenを取得・受領・登録せず、現在のoriginから組み立てたGitHub Repository Secret画面を開き、利用者本人が`CHATWORK_API_TOKEN`を直接入力する。製品側にToken入力欄はない。
- 現在の実装2差分はscannerとSprint 021専用testだけであり、上記2導線を変更していない。最新仕様との不一致はなく、コード／testの追加変更は不要と判断した。本確認で編集した正本はこのprogressだけである。
- `node --check` 2件、`git diff --check`、Sprint 021専用`PASS=71 FAIL=0`、wrapper `SPRINT021_PASS=8 SPRINT021_FAIL=0`を再実行して合格した。
- Chatwork既存回帰はSprint 013 `PASS=33 FAIL=0`（内部`35/35`）、Sprint 014 `PASS=41 FAIL=0`（内部`59/59`）。Google Chat既存回帰はSprint 019 wrapper `12/12`（内部`51/51`）、Sprint 020 wrapper `16/16`（内部`50/50`、敵対fixture `16/16`）で合格した。sandbox内の初回Chatwork実行はlocalhost bindの`EPERM`だけで停止したため、localhost許可環境で同一suiteを再実行した。
- 隔離masterのoffline `PASS=327 FAIL=0`／online `PASS=328 FAIL=0`は、base `dfe36a0533ba22441a89de5eb7491c2ae97a414f`へ同じ実装2差分だけを重ねた直前Generator証跡を引き継ぐ。今回コード／testを変更していないため再実行していない。
- 実装2ファイルと本progressは未commitのまま。commitは再試行していない。実GitHub、実OAuth、実Chatwork／Google Chat、Repository Secret、Cloud project、Billingへの書込みは0件である。

### fresh Evaluatorへの優先シナリオ

1. Google Chatで、synthetic OAuth値がwizard session memoryから`gh` stdinへ渡され、成功／失敗／キャンセルのいずれでもrepo、Git履歴、ログ、DOM、会話、評価証跡へ値が残らず、コピー／貼り付け要求が0件であることを独立確認する。
2. Chatworkで、現在のowner／repoに対応する`/settings/secrets/actions/new`を開き、wizard／AIによるToken取得・受領・登録、製品側入力欄、貼り付け要求がすべて0件であることを独立確認する。GitHub画面へ本人が入力する値自体は証跡へ残さない。
3. OAuth client JSON、private key、known credential field、credential URL、通常のshell literal、通常の1行JS object literalをinspect／commit前に拒否し、local／bare両履歴と出力への値露出が0件であることを実Gitfixtureで確認する。
4. `${{ secrets.NAME }}`、`$VAR`／`${VAR}`、`process.env`／identifier、通常文書、自然な説明metadata、`[REDACTED]`は誤拒否せず、所有pathだけのcommit／local bare pushが成立することを確認する。
5. 候補差替え、初回publish inventory、Chatwork／Google Chat設定、memory commit、既存staged／unstaged／untracked、commit失敗、push失敗、non-fast-forward rollbackの不変条件を再確認する。computed／escaped key、偽placeholder、意図的難読化の未検出だけは、最新契約どおり非ゴールとして保証対象と分ける。

## 新仕様サイクル Retry 0 — 合理的な誤混入検査への整理（2026-07-19）

**ステータス:** 実装完了 - 再評価待ち（Chatworkの直接登録要件にSpec issueあり）

### 実装内容

- scannerの保証対象を、製品管理workflow／config／historyと初回publish inventoryで合理的に起こる誤混入へ戻した。OAuth client JSON、private key、known token field、credential URL、通常のshell literal、通常の1行JS／TS object literal、実運用Google OAuth keyを引き続き拒否する。
- `GOOGLE_OAUTH_CLIENT_SECRET`、`googleOauthRefreshTokenGchat`等は、snake_case／camelCase／大文字環境変数名をword列へ分け、サービス名や用途名が前後にあっても通常の資格情報fieldとして検査する。
- `policy`、`handling`、`description`、`name`、`label`等で終わるkeyは、値を保持する資格情報fieldではなく説明metadataとして扱う。metadata値を8個の定型句へ閉じるenum、引用符・control character・escape解析、name／label値の完全一致判定を削除した。文字種・長さ・entropy相当の推測は使わない。
- placeholder許可は、`[REDACTED]`等の定番の明示placeholder、単一のshell環境変数参照、正規のGitHub Actions `${{ secrets.NAME }}`へ絞った。任意のangle bracket／mustache wrapperを安全とみなす規則は削除した。
- 利用者が意図的に作るcomputed／escaped key、偽placeholder、metadataへの難読化payloadを完全検出するためだけの保証テストを専用回帰から外した。通常フローの71件は削らず、危険側、正規参照、通常文書、合理的metadata、所有path、rollbackを実Gitで維持した。

### 変更量と保守性

| 対象 | 整理前の未commit差分 | 整理後の差分 | 変化 |
|---|---:|---:|---:|
| `safe-git.mjs` | +127 / -5 | +73 / -5 | 追加54行減 |
| `sprint-021-git-safety-test.mjs` | +180 / -1 | +82 / -1 | 追加98行減 |
| 合計 | +307 / -6 | +155 / -6 | 追加行49.5%減、総変更行48.6%減 |

metadataの安全性を値の閉じた文法で推測する層をなくし、keyの役割、通常literal、正規runtime参照という3つの予測可能な境界へ整理した。

### 実Gitで維持した保証

- 危険側: OAuth client JSON、private key、known credential field、credential URL、OAuth callback code、一般shell代入、shell宣言、実運用Google OAuth key 2形式、通常の複数行／1行JS object literalをinspect／commit前に拒否した。local HEADとlocal bare remote先端は不変で、local／bare両履歴とstdout／stderrへの値露出は0件。
- 許可側: 通常文書、自然な日本語を含むpolicy／guidance／label、非機密name、`[REDACTED]`、`$VAR`／`${VAR}`、`process.env`、identifier、`${{ secrets.GOOGLE_OAUTH_CLIENT_SECRET }}`がinspect、所有commit、必要なfixtureではlocal bare pushまで成功した。
- Git境界: 候補差替え、初回publish inventory、Chatwork／Google Chat設定、memory commit、既存staged／unstaged／untracked、commit失敗、push失敗、non-fast-forward rollbackを維持した。

### 検査結果

| コマンド | 結果 |
|---|---|
| `node --check plugins/yasashii-secretary/scripts/lib/safe-git.mjs` | PASS |
| `node --check scripts/sprint-021-git-safety-test.mjs` | PASS |
| `git diff --check` | PASS |
| `node scripts/sprint-021-git-safety-test.mjs` | `PASS=71 FAIL=0` |
| `bash scripts/sprint-021-regression.sh` | `SPRINT021_PASS=8 SPRINT021_FAIL=0` |
| `bash scripts/sprint-012-regression.sh` | `PASS=38 FAIL=0` |
| localhost許可環境の`bash scripts/sprint-013-regression.sh` | `PASS=33 FAIL=0`（内部Chatwork `35/35`） |
| localhost許可環境の`bash scripts/sprint-014-regression.sh` | `PASS=41 FAIL=0`（内部Chatwork `59/59`） |
| 隔離cloneの`bash scripts/sprint-016-regression.sh` | `SPRINT016_PASS=2 SPRINT016_FAIL=0` |
| `bash scripts/sprint-018-regression.sh` | `SPRINT018_PASS=41 SPRINT018_FAIL=0` |
| localhost許可環境の`bash scripts/sprint-019-regression.sh` | `SPRINT019_WRAPPER_PASS=12 FAIL=0`（内部Google Chat `51/51`） |
| `bash scripts/sprint-020-regression.sh` | `SPRINT020_WRAPPER_PASS=16 FAIL=0`（内部Google Chat `50/50`、敵対fixture `16/16`） |
| 隔離cloneの`bash scripts/regression-check.sh --offline` | exit 0、`PASS=327 FAIL=0` |
| 隔離cloneの`bash scripts/regression-check.sh --online` | exit 0、`PASS=328 FAIL=0`（公開GitHub読み取り専用検査を含む） |

隔離cloneはbase `dfe36a0533ba22441a89de5eb7491c2ae97a414f`から作った
`/tmp/sprint-021-generator-scoped.1kw2yp/repo`へ実装2ファイルだけを重ねた。
共有worktreeのPlanner／Evaluator正本と既存evidenceは混ぜていない。Sprint 013／014／019とmaster offlineの
sandbox内初回実行はlocalhost bindが`EPERM`になったため、同じsuiteをlocalhost許可環境で再実行して0 FAILを確認した。
これは製品FAILと分離している。

### Spec issue

- 改訂後のF36とSprint 021受入1は、ChatworkもwizardのmemoryからRepository Secretへ直接登録し、コピー／貼り付けを通常導線にしないとする。
- 一方、受入済みのF24、Chatwork `SKILL.md`、wizard実装と回帰は、wizard／repo／会話へTokenを入れず、利用者がGitHubのRepository Secret画面へ直接入力する導線を正本としている。
- Chatwork公式のTokenページから値を自動取得する手段と、値をwizardへ渡さずmemory登録する実装契約が定義されていない。このため両記述は同時に満たせない。
- 本Generatorはオーケストレーター指示に従い、合格済みChatwork導線を変更せず、scanner整理の範囲を広げなかった。PlannerがF24を維持する例外をF36／Sprint 021へ明記するか、Chatworkの新しい値取得UXを別Sprintとして具体化する必要がある。

### 自己評価

| 軸 | 点 | 根拠 |
|---|---:|---|
| C1 完成度 | 4 | scanner、通常の値非露出、所有Git境界は成立。Chatwork直接登録の記述だけは仕様矛盾としてPlanner判断が必要。 |
| C2 構文・整合 | 5 | Node構文、差分、専用・関連・隔離master onlineが0 FAIL。 |
| C3 機能の実証 | 5 | 危険側の拒否、許可側のcommit／push、local／bare履歴、候補差替え、rollbackを実Gitで確認した。 |
| C4 非エンジニア体験 | 5 | 通常文書と合理的metadataを定型句へ縛らず、既存Chatwork／Google Chat導線を維持した。 |
| C5 安全・規律 | 5 | 通常フローの値露出0、合理的な誤混入拒否、既存stage・所有path・外部副作用0を維持した。 |
| C6 無回帰 | 5 | 専用71件、関連suite、隔離master offline 327件／online 328件が0 FAIL。 |
| C7〜C12 | 5 | UI変更なし。配布面、更新安全性、Google Chat境界、既存0.7.0安全gate回帰を維持した。 |

### Evaluatorへの引き渡し

- 実装対象: `plugins/yasashii-secretary/scripts/lib/safe-git.mjs`、`scripts/sprint-021-git-safety-test.mjs`。
- 起動方法／URL: CLI・Git安全境界のため新規画面なし。
- 専用回帰: `bash scripts/sprint-021-regression.sh`。
- 全回帰: `bash scripts/regression-check.sh --offline`、公開GitHub読み取り専用の`--online`。
- 優先シナリオ: 通常のOAuth JSON／private key／known field／shell／1行JSを拒否し、実運用key、正規runtime参照、通常文書、合理的metadata、`[REDACTED]`、候補差替え、所有commit／push／rollbackを再確認する。
- 非ゴール: 利用者が意図的に作るcomputed／escaped key、偽placeholder、難読化の未検出だけで不合格にしない。
- Spec issue: Chatwork直接登録と受入済みGitHub画面直接入力の矛盾は、scanner実装の合否と分けてPlannerへ返す。
- commit: ユーザー指示どおり再試行していない。実装2ファイルと本progressを未commit差分として残した。
- 外部副作用: 0件。Git動的検証は`/tmp`のlocal repo／local bare remoteと生成値だけ。onlineは公開GitHubの読み取り専用確認のみで、実GitHub書込み、実OAuth、実Chatwork／Google Chat、Repository Secret、Cloud project、Billingは変更していない。

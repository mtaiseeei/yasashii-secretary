# Sprint 022: symlink境界と有限時間の外部処理

**ステータス:** 実装完了 - 評価待ち

## Retry 2（Shellと更新入口のworking root component境界）

### 変更内容

- `path-guard.sh`に`_safe_working_root` を追加し、baseを`pwd -P`等で物理pathへ解決する前に、filesystem rootから入力baseまでの各componentを確認するようにした。途中componentがsymlinkならexit 4で拒否し、`_safe_path`の通常writeと`_safe_delete_path`の確認済み通常deleteの両方に同じ検査を適用した。
- macOSの`/var -> private/var`と`/tmp -> private/tmp`はOS標準のroot直下aliasで、`mktemp`を使う既存正常系に必要なため、この正確な2対応だけを例外とした。任意のroot直下symlinkや、それ以降の途中component symlinkは引き続き拒否する。
- `update-apply.mjs` の`safeWorkspace`は、`realpathSync`で参照先Git repoをworkspaceとして採用する前に、Node共通guardの`workingRoot` を使うようにした。途中component symlinkではexit 3となり、Git確認、保護commit、session作成、plugin更新、migration、rollbackより前に停止する。
- `sprint-022-safety-test.mjs`へ、途中component symlink root＋最終通常directoryの独立fixtureを追加した。Shellの成果物write、確認済みmemory delete、更新workspace受理を動的に拒否させ、外部sentinelのhash・size・mode・mtime、GitのHEAD・index・worktree、session、入力linkが不変であることを確認する。
- Retry 1で成立したNode共通guard、symlinkのlink-only削除、確認済み外部repoを実pathから開く通常系、CLI／HTTP timeout回帰は変更していない。feedbackの静的timeout残リスクは今回のfilesystem修正へ混ぜていない。

### Retry 2テスト結果

- `bash scripts/sprint-022-regression.sh`: `SPRINT022_PASS=69 SPRINT022_FAIL=0`、wrapper `SPRINT022_WRAPPER_PASS=8 SPRINT022_WRAPPER_FAIL=0`
- `bash scripts/sprint-018-regression.sh`: `SPRINT018_PASS=41 SPRINT018_FAIL=0`
- Git HEADの隔離cloneへ現worktreeの`plugins/`と`scripts/`だけを重ねたmaster offline: `PASS=330 FAIL=0`
- 同じ隔離cloneのmaster online: `PASS=331 FAIL=0`。外部通信は公開GitHub APIの読み取りだけで、外部serviceへの書込みは0件。
- `bash -n` / `node --check` / `git diff --check -- plugins scripts docs/progress/sprint-022.md`: PASS

### Retry 2の既知事項

- 実service書込みと作業repoへのcommit／pushは実施していない。online回帰も公開情報の読み取りだけである。自動回帰内のcommit／pushはlocal temporary repo／local bare remoteだけを対象にする。
- UI変更はないため、テストURLとscreenshotは該当しない。

## Retry 1（正式feedback＋AC7〜AC9品質レビュー対応）

### 変更内容

- `workingRoot`の入力pathをfilesystem rootから1要素ずつ`lstat`し、最終要素だけでなく途中componentにsymlinkがある場合も、外部変更0件で`working-root-unsafe`として拒否するようにした。macOSの`/var`等を含む既存fixtureは、確認済みrepoを`realpath`した実pathから直接rootにする正常系へ合わせた。
- `runExternal`は、親processが`SIGTERM`で先に終了しても保存済みprocess groupへの`SIGKILL` escalationを必ず実行する。timeout／`maxBuffer`後はstream取込みを止め、子孫停止後にlistenerとtimerを解放する。
- `fetchWithTimeout`はheader取得後も`json`／`text`等のbody読取り完了まで同じ期限を維持する。呼出元`AbortSignal`の理由をそのまま伝え、caller abortをtimeoutへ置換せず、終了時にlistenerを外す。共有helperと配布用Chatwork／Google Chat runtimeの契約を統一した。
- `safe-git`の`allowFailure`は通常の非0終了だけを許容し、timeout／`maxBuffer`を`null`にしない。timeout後はcommit／push等へ進まない。
- Google Chat検索の`git pull`、Cloud準備、Chatwork／Google Chat wizard、更新適用、workspace repo、一般PJ、memory commit前処理を共通の安全な外部process処理へ移した。productionの直接`execFileSync`／`spawnSync`／`execSync`は共通helper内を除き0件にした。
- Chatwork、Google Chat API、Google OAuthのrefresh／code交換、更新診断の公式情報取得について、header取得後にbodyが停止するfixtureでも有限時間で終了するようにした。

### Retry 1で追加・更新した製品回帰

- 正式feedbackの「working root入力pathの途中componentがsymlinkで、最終要素は通常directory」の再現を追加した。
- 親だけが`SIGTERM`で終了し、子が`SIGTERM`を無視するprocess tree、無限出力による`maxBuffer`超過、終了後のlistener／timer 0件を追加した。
- `safe-git`、memory commit前処理、Google Chat検索、Cloud準備のproduction callsiteを通し、timeout後の外部副作用0件、後続操作0件、残process 0件、同一操作の再試行成功を確認する。
- Chatwork／Google Chat API、Google OAuth、公式情報取得のbody停止と、配布runtimeのcaller abort伝播を追加した。
- production callsite inventoryを追加し、直接同期process APIの再混入を回帰で検出する。

### Retry 1の変更ファイル

- 共通安全処理: `scripts/lib/safe-fs.mjs`、`scripts/lib/external-ops.mjs`、`scripts/lib/external-runner.mjs`、`scripts/lib/safe-git.mjs`、`scripts/safe-external.mjs`
- Git／更新／PJ: `scripts/workspace-repo.mjs`、`scripts/update-apply.mjs`、`scripts/update-diagnose.mjs`、`scripts/project-tools.mjs`、`skills/memory-care/scripts/memory-tools.sh`
- Chatwork／Google Chat: 両wizard server、Google Chatの`search.mjs`／`cloud-setup.mjs`／OAuth・client、両配布runtime safety
- 自動テスト: `scripts/sprint-022-safety-test.mjs`と、実path正常系へ合わせたSprint 013／014／017〜021の関連fixture

### Retry 1テスト結果

- `bash scripts/sprint-022-regression.sh`: `SPRINT022_PASS=63 SPRINT022_FAIL=0`、wrapper `8/0`
- `bash scripts/sprint-019-regression.sh`: wrapper `12/0`
- `bash scripts/sprint-020-regression.sh`: wrapper `16/0`
- `bash scripts/sprint-020-patch-002-regression.sh`: wrapper `8/0`
- `bash scripts/sprint-021-regression.sh`: wrapper `8/0`
- 隔離clone offline master回帰: `PASS=330 FAIL=0`
- 同じ隔離clone online master回帰: `PASS=331 FAIL=0`。外部通信は公開GitHub APIの読み取りだけ。
- 変更したNode／shellの構文検査、`git diff --check -- plugins scripts docs/progress/sprint-022.md`: PASS

### Retry 1既知課題

- Sprint 022範囲の未解決実装課題はない。
- 実サービス書込みは禁止のため未実施。外部CLI／HTTPの成功・失敗・hangはlocal temporary repo／fixtureで検証し、onlineは公開情報の読み取りだけを行った。
- UI変更はないため、URL／スクリーンショット評価は該当しない。

## スプリント契約

### 何を作るか

- Node／shellの主要な書込み・作成・移動を、現在のworking rootの実体境界内へ閉じる。
- workspace内のsymlinkを削除するときは参照先を辿らず、linkだけを削除する。
- `git`、`gh`、`claude`、`gcloud`等の外部CLIと外部HTTPに有限timeoutを設け、timeout後の危険な後続処理を止める。
- 秘書workspace内のsymlink越し書込みは拒否しつつ、確認済み外部repoをそのrepo自身のworking rootとして開いた正常な開発操作は許可する。

### どう成功を検証するか

- local temporary repoと外部sentinelを使い、root／途中ancestor／最終要素／未作成pathのsymlink越境が副作用0件で拒否されることを自動確認する。
- file symlink／directory symlinkの削除後にlinkだけが消え、参照先のhash・metadata・内容が不変であることを自動確認する。
- memory、成果物、一般PJ、更新、Chatwork／Google Chatの書込み・rollback導線に同じ境界が適用され、正常pathの既存動作が維持されることを確認する。
- hangするCLI／HTTP fixtureでtimeout、子process・listener・timerの後始末、後続commit／push／pull／削除0件、再試行成功を自動確認する。
- 同じ外部repoについて、workspace内symlink経由は拒否され、そのrepo自身をworking rootにした作成・更新・rename・確認後削除は成功することを対比確認する。
- Sprint 022専用回帰に加え、実行可能な既存master回帰を実行する。実外部サービスへの書込みは行わない。

## 実装内容

- **AC1〜AC6: 共通filesystem境界**
  - `scripts/lib/safe-fs.mjs`を追加し、working root自身、途中ancestor、最終要素、未作成pathの最深既存ancestorを`lstat`／`realpath`で検証する共通処理を実装した。
  - 検証が終わる前に親directoryを作らないため、拒否時の内部部分生成も0件になる。
  - 原子的な書込み、rename、通常削除、symlinkのlink-only削除を共通化した。symlink削除は参照先を辿らない。
  - shellの`path-guard.sh`／`memory-tools.sh`も、最終symlinkを確認後にlinkだけ削除し、通常file／directoryは既存の2段階確認を維持するよう更新した。
  - PJ、更新ledger／apply、Chatwork／Google Chatの設定・履歴・rollbackを共通境界へ接続した。
- **AC7〜AC9: 外部処理の有限timeout**
  - `scripts/lib/external-ops.mjs`を追加し、外部CLIを分離process groupで実行して、timeout時に`SIGTERM`、猶予後に`SIGKILL`で子processを含めて停止するようにした。
  - `git`、`gh`、`claude`、`gcloud`の主要導線を共通処理へ移し、timeout後はcommit／push／pull／削除などの後続処理へ進まない。
  - 外部HTTPは`AbortController`と有限timerを使い、Chatwork、Google OAuth／Chat API、検索・wizard導線でtimeoutを成功、空結果、not foundへ誤分類しないようにした。
  - 配布後に単独で動くChatwork／Google Chat runtimeにも同じ安全処理を同梱した。
- **AC10: 外部repo境界の契約**
  - 秘書workspace内のsymlinkをworking rootとして使う操作は拒否する。
  - 同じ外部repoを、そのrepo自身の実pathをworking rootとして開いた場合は、repo内の作成・更新・rename・確認後削除を許可する。秘書workspace側への正本複製は行わない。
- **AC11: 自動回帰**
  - `scripts/sprint-022-safety-test.mjs`と`scripts/sprint-022-regression.sh`を追加した。
  - master回帰へSprint 022を組み込み、旧symlink削除fixtureも現在のlink-only削除契約へ更新した。
  - Sprint 019のRepository Secret静的検査を、stdinを共通外部処理へ直接渡す新実装にも対応させた。秘密値をargvへ載せない既存要件は維持している。

## 受入基準の結果

| 受入基準 | 結果 | 自動証跡 |
|---|---|---|
| AC1 Node書込み境界 | PASS | root／途中／最終symlinkを拒否し、外部変更0件 |
| AC2 未作成path境界 | PASS | 最深既存ancestorで拒否し、拒否前の部分生成0件 |
| AC3 shell導線非回帰 | PASS | memory・成果物の敵対fixture拒否と正常path成功 |
| AC4 symlink削除 | PASS | file／directory linkだけを削除し、参照先内容・metadata不変 |
| AC5 通常削除 | PASS | 無確認削除を拒否し、確認済み通常削除は成功 |
| AC6 rollback境界 | PASS | 更新・設定rollbackが共通境界を使用し、拒否を未完了として返す |
| AC7 CLI timeout | PASS | `git`／`gh`／`claude`／`gcloud`のhangをtimeout、後続副作用0件 |
| AC8 HTTP timeout | PASS | 共通HTTP、Google API／OAuth、Chatwork APIのhangをtimeoutとして分類 |
| AC9 process後始末 | PASS | 子process・後続副作用0件、同一操作の再試行成功 |
| AC10 別repo開発PJ | PASS | workspace内symlink経由は拒否、repo自身をrootにした通常操作は成功 |
| AC11 既存全回帰 | PASS | offline 330件、online 331件ともFAIL 0 |

## テスト結果

- `bash scripts/sprint-022-regression.sh`
  - 専用動的回帰: `SPRINT022_PASS=69 SPRINT022_FAIL=0`
  - wrapper: `SPRINT022_WRAPPER_PASS=8 SPRINT022_WRAPPER_FAIL=0`
- 一時cloneで`bash scripts/regression-check.sh --offline`
  - `PASS=330 FAIL=0`
- 同じ一時cloneで`bash scripts/regression-check.sh --online`
  - 公開GitHub APIの読み取り検査を含め、`PASS=331 FAIL=0`
- `bash -n`と`node --check`
  - 今回変更・追加したshell／Node scriptは全件成功。
- `git diff --check -- plugins scripts docs/progress/sprint-022.md`
  - 成功。

全master回帰は、既存ユーザー変更と未追跡evidenceを混ぜないよう、Git HEADから作ったlocal temporary cloneへ今回の`plugins/`／`scripts/`差分と新規テストだけを適用して実行した。外部への書込みは行っていない。online回帰の外部通信は公開GitHub APIの読み取りだけで、Git操作とhang fixtureはlocal temporary repo内である。

## 自己評価

| 基準 | スコア(1-5) | コメント |
|---|---:|---|
| 機能完全性 | 5 | AC1〜AC11を専用fixtureとmaster回帰で確認した。 |
| 動作安定性 | 5 | timeout、rollback、再試行、正常pathを動的に確認した。 |
| デザイン性 | 5 | 非UI Sprint。共通境界と配布runtimeの責務を分け、既存導線へ一貫して適用した。 |
| 独自性 | 5 | workspace内symlink拒否と外部repo自身の正常系を、working root単位で明示的に分離した。 |
| エラーハンドリング | 5 | filesystem越境、CLI／HTTP timeout、process cleanup、誤分類防止を扱った。 |
| 回帰なし | 5 | offline 330件、online 331件がFAIL 0。 |

## 技術的な判断

- symlinkを一律禁止せず、「操作のworking rootがsymlinkか」「root配下の途中要素がsymlinkか」を判定する。これにより、秘書workspace内のsymlink越し操作だけを拒否し、確認済み外部repoを実pathから開く通常開発は妨げない。
- Shellの入力baseは物理path化より前に全componentを確認する。ただしmacOSの標準temp pathを壊さないよう、root直下の`/var`・`/tmp`が既知の`private/...`を指す場合だけをプラットフォームaliasとして許可する。
- 削除時の最終要素だけは`realpath`で参照先へ進まず、`lstat`でsymlinkと判定してlink自身を削除する。書込み・renameでは最終symlinkも拒否する。
- CLI timeoutは親processだけでなくprocess group全体を停止する。HTTP timeoutは`Promise.race`だけにせず`AbortController`で通信自体を中断し、timerを必ず解放する。
- 配布workspaceのChatwork／Google Chat scriptはplugin内共通moduleを参照できないため、小さなruntime safety moduleを配布対象へ同梱した。

## 既知の課題

- Sprint 022の範囲で未解決の実装課題はない。
- 実サービスへ書き込まない契約のため、GitHub／Chatwork／Google Chatの実サービス書込みは未実施。CLI／HTTPの成功・失敗・hangはfixtureとlocal temporary repoで検証した。
- UI変更はないため、テスト対象URLとスクリーンショット評価は該当しない。

## Evaluatorへの引き渡し事項

- 起動方法: 常駐アプリ／dev serverなし。repo rootで各回帰scriptを実行する。
- テスト対象URL: なし（CLI／filesystem安全性Sprint）。
- 専用回帰: `bash scripts/sprint-022-regression.sh`
- master offline回帰: `bash scripts/regression-check.sh --offline`
- master online回帰: `bash scripts/regression-check.sh --online`（公開GitHub APIの読み取りのみ。`gh`認証とnetworkが必要）
- 評価シナリオ:
  1. `bash scripts/sprint-022-regression.sh`を実行し、69件／wrapper 8件がFAIL 0であることを確認する。
  2. external sentinelへ向くroot／途中／最終symlinkと未作成pathが、外部変更・内部部分生成0件で拒否されることを確認する。
  3. file symlinkとdirectory symlinkを確認後に削除し、link不在、参照先のhash・metadata・内容不変を確認する。
  4. 同じexternal repoをworkspace内symlink経由で扱う操作が拒否され、repo実pathをworking rootにした作成・更新・rename・確認後削除が成功する対比を確認する。
  5. `git`／`gh`／`claude`／`gcloud`のhang fixtureがtimeoutし、子process・後続副作用0件で、安全な再試行が成功することを確認する。
  6. Chatwork、Google OAuth／Chat APIのhangがtimeoutとなり、成功・空結果・not foundへ誤分類されないことを確認する。
  7. offline／online master回帰を実行し、既存Sprintを含むFAIL 0を確認する。
  8. working root入力pathの途中componentだけを外部directoryへのsymlinkにし、最終要素を通常directoryにしたfixtureで、root確認と書込みがともに拒否され、外部作成0件であることを確認する。
  9. timeout対象の親が`SIGTERM`で先に終了し、子が`SIGTERM`を無視するfixtureで、子が`SIGKILL`され、後続副作用・残process・listener・timerが0件であることを確認する。
  10. 無限出力fixtureが`maxBuffer`到達直後に止まり、timeout期限まで待たず、保持bufferが上限以内で増加し続けないことを確認する。
  11. `safe-git`の`allowFailure`、memory commit前処理、Google Chatの`git pull`をproduction callsiteからtimeoutさせ、後続commit／push／検索が0件で、正常binaryへ戻した再試行が成功することを確認する。
  12. headerだけ返して`json`／`text`が停止するfixtureをChatwork、Google Chat API、Google OAuth、公式情報取得へ渡し、すべて有限時間で終了することを確認する。配布runtimeではcaller abort理由がそのまま返り、timeoutに誤分類されず、listenerが0件になることも確認する。

## Scope change detected

- なし。

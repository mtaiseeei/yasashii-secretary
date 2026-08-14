# Sprint 039 — Generator handoff

**状態:** 固定Agentic製品candidateからのoverlay同期、Yasashii専用回帰、Git-free候補検証まで完了。fresh独立Evaluator待ち。

## 固定入力と候補

- Yasashii開始HEAD: `ee62b5ef898bb9537f66ba4624c7fe5e35767f70`
- 固定Agentic製品candidate: `3e08eb6d377392440e753bd5073c73d1d63399b6`
- 入力形: 上記commitのGit archive（read-only、`.git`なし）
- handoff common digest: `7498d3550734ba63b689463f01e2a52e16d2ce3f8eb31cebead16aef2181f883`
- Yasashii candidate SHA: Generatorはcommit禁止のため未確定。working tree candidateをGit-free tarへ複製して検証した。

Agenticの現在HEADや後続docs-only commitへ読み替えていない。Agenticのdocs、progress、feedback、state、release記録は同期していない。

## 実装したこと

- `adapters/downstream-identity-handoff.json` を固定archiveから読み、14 common pathとdigestをoverlay実行時に検証するようにした。
- stable identity、英語名の指定／提案、AI author、名前Skill、canonical workspace resolver、Codex／Claudeのuser-scope managed block、安全なA〜D renameを同期した。
- onboardingで利用者の呼び方と秘書自身の名前を分離し、既存利用者は`name` Skillから設定・確認・renameできるようにした。
- P1の未作成／disabled routing維持、P2の製品所有field限定、P3の直接呼びかけ優先、P4の正式21 surface inventory／unknown差替えnegativeをYasashii専用回帰へ取り込んだ。
- 名前Skillの`resolve`／`registry-register`だけはYasashii editionへanchor変換した。これを行わないとYasashii workspaceが反対editionとして停止するためである。
- `secretary`見出し、`settings`の読みやすい表、name Skillのedition引数は宣言済みanchor overlayとし、Yasashii identityと意味を維持した。
- 既存Sprint 011回帰のactive style参照とserializer語彙を、製品を変更せずYasashiiの現行正本に合わせるanchorへ補正した。

## Overlay結果

- upstream snapshot: 712 files
- managed: 277 files
- 未分類: 0
- 初回apply: 22 files changed。name Skillのedition anchor追加後に1 file changed。
- 最終check: PASS
- 最終reapply: `secondChanged=0`
- handoff 14 paths: 11 pathはAgenticとbyte一致。3 pathは宣言済みYasashii anchor（`name`、`secretary`、`settings` Skill）。
- managed digest: `e7c38203d1011056894bae35099b3197111eff80ce7f425cc09e814877c71013`
- repo-owned digest: `001a5a873a7159c7c98918e99debf623fe14fb58344f6c54078ffc95e3141fdb`
- overlay definition digest: `132345fe70a85a727fe4c4401d2b5c42e230ce583f2f20ab8d60d86b7839d720`

保護surfaceは開始HEADとworking candidateで同一SHA-256だった。対象はREADME、LICENSE、Yasashii copy/style、Claude／Codex marketplace・manifest、`edition.json`、`rule-manifest.json`。例:

- README: `c1d3a027f1007674f1abf974f85f313d5f9059e8a5c5e4eaaba17e18f720705b`
- LICENSE: `b6d97ac224e82462221382f7af3c40051489be2312daf6e706c5a5ad15c13ec9`
- Yasashii copy: `46bd8eee125924305be5aaf1c4f345190bea53b31680d170dedf67716bbffab4`
- Yasashii style: `50c9df0ff79fb43d5e051eb0c42070e31393b210a7fb78076c6e7e6996b1699c`
- edition: `663c14cc51b92a936a1dbaf34d5ab4f7ded65f20d57ad0ed645dfd3e8d9bf7b7`

## 主な変更path

- 共通製品: `plugins/secretary/scripts/lib/{secretary-identity,user-scope-routing,workspace-registry,name-router,secretary-rename}.mjs`、`secretary-name.mjs`、`workspace-tools.mjs`
- Skill／template: `skills/name/SKILL.md`、`skills/{onboarding,secretary,settings}/SKILL.md`、`templates/identity.json`、`templates/AGENTS.md`、最初のdecision template
- inventory／validator: `host-inventory.json`、`scripts/check-report-schema.py`、既存16 Skill／21 surface回帰
- overlay: `scripts/sync-secretary-overlay.mjs`、`secretary-overlay/{anchors,downstream-files,mapping,upstream-base,upstream-tree}.json`
- Sprint専用回帰: `scripts/sprint-039-{test,overlay-test}.mjs`、`scripts/sprint-039-regression.sh`

## 実行結果

### 対象green

- `bash scripts/sprint-039-regression.sh`: 69 PASS / 0 FAIL、wrapper 7 PASS / 0 FAIL。
- `node scripts/sprint-039-overlay-test.mjs <fixed-agentic-archive>`: 6 PASS / 0 FAIL。
- overlay `record`／`apply`／`check`／`reapply`: PASS、handoff digest一致、未分類0、`secondChanged=0`。
- `python3 scripts/check-report-schema.py --plugin-root plugins/secretary`: 21 surfaces、1 PASS / 0 FAIL。unknown差替え21件fixtureも拒否。
- `node scripts/sprint-035-test.mjs`: 15 PASS / 0 FAIL。
- `bash scripts/sprint-011-regression.sh`: 68 PASS / 0 FAIL。
- `bash scripts/sprint-038-regression.sh`: 64 PASS / 0 FAIL、historical classifier 14 PASS / 0 FAIL、historical path 3 PASS / 0 FAIL。
- `node scripts/sprint-038-patch-002-windows-test.mjs`: Darwin arm64で既存12 PASS / 0 FAIL。
- Git-free working candidate: Sprint 039 69/0、wrapper 7/0、overlay 6/0、overlay check PASS、schema 1/0。
- `git diff --check`: PASS。

### 既知baseline／verification-infra

`bash scripts/sprint-035-patch-001-regression.sh` は5 PASS / 6 FAIL。Sprint 039対象greenの後に1回だけ実行し、次を再現した。

- 既存wizard assetの固定digest不一致。
- sandboxのloopback listen拒否: `EPERM 127.0.0.1`（Chatwork／Google Chat）。
- 旧Sprint 034 overlay testが固定archiveではなく現在のAgentic checkout HEADを読むため、`UPSTREAM_ADVANCE`と後続fixture誤差になる。
- 既存README Cloud説明期待との不一致。

これらをbaseline更新で隠していない。Sprint 039のidentity、routing、rename、overlay専用回帰ではproduct FAILを観測していない。

## OSと外部操作

- 実行OS: macOS Darwin arm64、Node.js `v22.23.2`。
- Windows関連: 既存Node-native 12 labelsはDarwinでPASS。Sprint 039 identity面のWindows native実行は **not-run**。portable code／Git-free候補は実行済みだが、Windows解消済みとは表示しない。
- browser UI追加なし。screenshot不要。
- private版、実HOME、installed cache、実workspace、Mac mini、remote、Secret、Actions、OAuth、実API、commit、push、tag、releaseはすべてnot-run／write 0。

## Evaluatorの具体的シナリオ

1. 固定Agentic archiveとSHA／handoff digestを再確認し、overlay check／reapply、未分類0、`secondChanged=0`を確認する。
2. `name` SkillがYasashii editionでresolve／registerし、反対editionへ誤停止しないことを操作する。
3. 合成HOMEでCodex通常／override／Claude、enable／disable／rollback／冪等性を確認する。
4. 別repo cwdからcanonical workspaceへ接続し、cwd副作用0、registry異常のsafe stopを確認する。
5. P1〜P4、rename A〜D、stable ID、過去author、選択B、D不変、部分失敗rollbackを操作する。
6. working candidateのclean checkoutと同一commit Git archiveでSprint 039、overlay、schema、既存target回帰を再実行する。
7. README、LICENSE、Yasashii copy/style、manifest、marketplace、edition、rule manifestのdigestを比較する。

## Retry 1 — Evaluator P1/P2修正

Evaluatorが指摘したP1（release integrityの正式Skill inventory）とP2（renameの実commit checkpoint）だけを修正した。初回candidateの評価根拠は上記に残し、Retry 1の固定入力と結果を以下へ追記する。

### 固定入力とoverlay

- accepted Agentic製品candidate: `3fa8d97e5dbfb2afa314f4ad179f17401b76d320`
- 入力形: 上記commitのGit archive（read-only、`.git`なし）。Agenticの現在HEADには追従していない。
- handoff common digest: `c810f60c3664ca331338e34680eec9bb6d21f8d850b97a39eef29f1a24f58557`
- handoff: 16 paths。`safe-git.mjs`と`external-ops.mjs`を含む。
- upstream snapshot: 716 files、managed: 277 files、未分類: 0。
- Retry 1初回apply: 4 files changed。最終check: PASS、reapply: `secondChanged=0`。
- handoffの13 common pathsはAgenticとbyte一致。`name`、`secretary`、`settings` Skillは宣言済みYasashii anchorで、製品identity／copy／styleを保持した。
- overlay適用直後のrepo-owned digest: `2ddb5fc205e1433a113f4e358c45d944c1b6ce95b348199ef915420dfd9950c2`。このprogress自体がrepo-ownedなので、追記後のdigest値は変わるがoverlay checkはPASSを維持する。
- final overlay definition digest: `5850ef7b197e9f524891d0af5f71c3be1b39ed468fddae37d8044c04f58e37df`
- final reapply digest: `3698b74e36909b1a3bee38fd2d2187758f4a8085481a44a32f3a0e30caa53ad5`

Agenticのdocs、progress、feedback、state、release記録は同期していない。README、LICENSE、Yasashii copy/style、製品identity、manifest、marketplace、rule manifest、overlay metadata、Harness導線も初回記録の保護digestを維持した。

### P1 — 正式16 Skills inventory

- `scripts/check-release-integrity.py`へ正式16 Skillsの明示集合を追加した。`name`を含むexact inventoryで判定し、件数だけでは合格させない。
- 16件のまま`name`を`unknown`へ差し替えるnegative fixtureを追加した。`unexpected formal Skill`と`expected formal Skill missing`の両方を要求する。
- Skill件数条件を緩和していない。

### P2 — rename checkpointとrollback

- renameがcanonical workspaceのGit rootを確定し、製品所有pathだけをstageしてrequired checkpointを1 commit作成するよう同期した。
- checkpoint前、stage失敗、commit失敗、commit後失敗の各段階で、HEAD、index、worktree、HOME側managed blockを開始前へ戻す。
- 既存stage／unstaged／untrackedはbyte単位で保持する。rename対象自身が開始前dirty、親repo誤採用、nested別repoはsafe stopする。
- 成功後の再実行は差分0、追加commit 0。実remote、push、tag、releaseは0。

### Retry 1実行結果

- `node scripts/sprint-039-patch-001-test.mjs`: 16 PASS / 0 FAIL。
- `bash scripts/sprint-039-regression.sh`: 69 PASS / 0 FAIL、wrapper 7 PASS / 0 FAIL。
- `bash scripts/sprint-039-patch-001-regression.sh`: wrapper 9 PASS / 0 FAIL。内訳にGit safety 71/0、Sprint 035 15/0、schema 1/0、release integrity 2/0を含む。
- `node scripts/sprint-039-release-integrity-test.mjs`: 2 PASS / 0 FAIL。
- `node scripts/sprint-039-overlay-test.mjs <fixed-agentic-archive>`: 6 PASS / 0 FAIL。
- `python3 scripts/check-report-schema.py --plugin-root plugins/secretary`: 21 surfaces、1 PASS / 0 FAIL。
- clean checkout相当candidate: Patch 16/0、Sprint 039 69/0＋wrapper 7/0、release integrity 2/0、schema 1/0、overlay 6/0。
- 同じclean candidateの`git archive HEAD`（`.git`なし）: Patch 16/0、Sprint 039 69/0＋wrapper 7/0、release integrity 2/0、schema 1/0、overlay 6/0。

Retry 1では長いhistorical master全体を再実行していない。上記「既知baseline／verification-infra」の6件は初回実行時の記録を維持し、baseline変更で隠していない。Windowsの新identity面native実行も引き続き **not-run** であり、既存Darwin実行結果だけを記録する。

実HOME、installed cache、private版、Mac mini、external service、remote、Secret、Actions、OAuth、実APIへのwriteは0。実Yasashii repoではcommit／push／tag／releaseを行っていない。テスト内のcommitは隔離した一時fixtureだけである。

## Spec-issue修正後のfresh strong Generator再確認

Retry 1 EvaluatorのS1は、製品欠陥ではなくPlanner正本がaccepted upstream Patchへ追随していない固定入力の不整合だった。更新済みの`features.md`、`constraints.md`、`editions.md`、`rubric.md`、Sprint 039契約、state、最新feedbackを読み直し、次を確認した。

- 更新後の固定入力はAgentic `3fa8d97e5dbfb2afa314f4ad179f17401b76d320`、handoff digest `c810f60c3664ca331338e34680eec9bb6d21f8d850b97a39eef29f1a24f58557`で一致する。
- handoffは16 `commonPaths`、13 byte parity＋`name`／`secretary`／`settings`の3 anchorsで一致する。`external-ops.mjs`と`safe-git.mjs`は共通安全pathとして管理されている。
- overlay metadataはaccepted candidate、digest、16-path分類に関係するhandoff所有fieldだけが更新対象で、その他のfield、anchor、安全基準は保護される契約へ整合した。
- 製品candidateは`65dccf6cb333f11d3fac6bfab729fb993bc1a26f`のまま。再確認HEADは`0934797e3677f2c7d83221c6b9c2221d0597dd92`で、`65dccf6..0934797`の差分はspec、Sprint契約、state、feedbackだけ。製品、test、overlay bytesの差分は0件だった。
- 旧固定入力`3e08eb6d377392440e753bd5073c73d1d63399b6`／`7498d3550734ba63b689463f01e2a52e16d2ce3f8eb31cebead16aef2181f883`は、履歴を保持する`docs/**`以外の実装所有面に0件だった。

製品変更は不要と判断し、product／test／overlayを編集していない。S1の原因だったPlanner正本と実装candidateの対応は解消した。

### Overlayと保護面

- 実repo、隔離clean checkout、Git-free archiveの各面でoverlay test 6/0、check PASS、apply `changed=0`、reapply `secondChanged=0`。
- 各面で`managed=277`、`handoffPaths=16`、handoff digest `c810f60c...`、overlay definition digest `5850ef7b...`、reapply digest `3698b74e...`が一致した。
- README、LICENSE、AGENTS、Yasashii copy/style、edition、rule manifest、Claude／Codex marketplace／manifestは開始HEAD `ee62b5e`、製品candidate `65dccf6`、再確認HEAD `0934797`でGit blobが同一だった。
- `secretary-overlay/anchors.json`はSprint実装でname等の宣言anchorを追加した製品candidateのblobを再確認HEADでも維持し、`metadata-overrides.json`も開始HEADから不変。再確認工程でoverlay metadata変更0件だった。
- Agenticのspec、Sprint、progress、feedback、state、release記録の同期は0件。

### 再実行結果

実repo開始時はcleanだった。次の集計は実repo、隔離clean checkout、同じ`0934797`の`git archive`から展開したGit-free archiveの3面で同一だった。

- `bash scripts/sprint-039-patch-001-regression.sh`: exit 0、wrapper 9/0。
- Patch: `SPRINT039_PATCH001_PASS=16 FAIL=0`。
- Sprint 039: `SPRINT039_PASS=69 FAIL=0`、wrapper 7/0。
- 既存target: Git safety 71/0、Sprint 035 15/0。
- release integrity: 正式16 Skillsとsame-count unknown negative 2/0。
- report schema: 正式21 surfaces、1/0。
- overlay専用: 6/0、check／apply／reapply PASS、未分類0、二回目差分0。

長時間historical masterは、target／checkout／archiveがgreenで、Retry 1 feedbackに開始candidateと同数の既知infra差が記録済みのため反復していない。baselineは変更していない。実行OSはDarwin arm64、Sprint 039の新identity／renameのWindows nativeは引き続き **not-run** で、全環境PASSへ昇格しない。

browser UI変更はなく、起動URL／screenshotはnot applicable。実HOME、installed cache、private版、実workspace、Mac mini、external service、remote、Secret、Actions、OAuth、実APIへのwriteは0。実repoでcommit／push／PR／merge／tag／release／marketplace／install／updateを行っていない。テスト中のGit操作は隔離fixtureと一時checkoutだけである。

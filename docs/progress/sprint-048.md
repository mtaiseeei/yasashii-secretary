# Sprint 048 — Astra改善の限定downstream適応と Yasashii `0.13.2`

## 実装状態

実装freeze済み、fresh独立Evaluator待ち。Generatorはcommit、push、tag、Releaseを行っていない。

開始Yasashiiは公開`0.13.1`のcommit `4bf0552200d432320b1ccd8f7365c158970062a2`、tree
`9f1bb13a0cab993572d0b8bf11265f785f4e045f`。正式なpublic入力はAgentic tag `v0.13.2`のtarget
`cd4700c3d541525d00bb69732d7c0f94c11feb37`、tree `282b7278220fd2acf0e6c8759435c6d6951fa286`である。
AgenticのPhase A／B PASSは入力固定の根拠としてだけ使い、Yasashiiの合否へ流用していない。後続のAgentic
docs-only HEAD `74a1d62`も同期入力に含めていない。

## 限定同期receipt

- public Sprint 059で変更されたplugin path 42件を、`byte-equal=10`、`yasashii-adapted=31`、
  `agentic-only=1`（`rules/styles/agentic.md`）へ排他的に分類した。未分類は0件。
- byte-equal 10件は8 migration assets、`rules/common-language.md`、
  `templates/memory/preferences.md`。path、mode、bytesから再計算した共通SHA-256は
  `58d63032f2fcbd5511b879f314270c6ae9f985fbe70d675aeea01d74c60bdc82`で両repo一致。
- 17 pathのprotected snapshotは開始tagと一致し、SHA-256は
  `c3fc2335aeb923f5ae295f1e5c26b6da83c6cc8b18d69b60c8f5a6854c714810`。
  LICENSE、neutral base、historical overlay、edition、Yasashii copy、rule manifest、conversation contract/runtime、
  Hookを含む。
- `secretary-overlay/upstream-base.json`はhistorical `0.12.0`、base
  `767a7f3ecb15c0ffe6d2d8f71529c74bf671c154`、tree
  `30b7619...`のまま不変。全量sync、過去receiptの上書き、private surfaceの転記は0件。
- candidate SHA／treeとGit-free archive digestはOrchestratorのfreeze commit後に確定する。本receiptは
  worktree実装の分類であり、未作成のcommitやartifactを検証済みとは扱わない。

## 実装内容

- current-first／任意resume、Google／Microsoft readとsetupの分離、connection診断、条件付きrule／preferences、
  長いread-only処理の進捗、settingsの`pref-set → journal → commit → saved`、partial retry、
  Windows-safe root解決をcurrent 17 Skills、rules、templates、collaboration routerへ適応した。
- Yasashiiのidentity、平易なcopy、Clarity、Voice、17 Skills、既存markerと安全境界を維持した。
- `0.13.1-to-0.13.2.json`と8 assetsを追加し、`supported.json`へ`0.13.1`を追加した。
  公開Yasashii `v0.13.1`由来のAGENTS／CLAUDE fingerprintとmarkerを使う4 operationで現行templateを再現する。
  preview、apply、rerun、rollback、partial retry、LF／CRLF、POSIX modeを検査し、自由記述、
  `preferences.md`、unrelated dataを保持する。customized／unknown／stale／wrong edition／Secretは副作用0で停止する。
- current contentに合わせてcollaboration／conversation-core inventoryを更新した。
- `sprint-011`、`035`、`042`の既存期待値を現在のroute、Yasashii guidance、publication状態へ局所更新した。
  新しい全量検証基盤は追加していない。

## 自己検証

重いNode検査は`python3 /private/tmp/astra-secretary-heavy.py`の共有lock経由で直列実行した。開始／終了Node数は
29〜35で、40以下を維持した。

| 検査 | 結果 |
|---|---|
| `node scripts/sprint-048-test.mjs` | 8 PASS / 0 FAIL / route side effect 0 |
| `node scripts/sprint-048-migration-test.mjs` | 25 PASS / 0 FAIL。後続変更は結果labelの`059→048`だけで依存bytes不変 |
| `bash scripts/sprint-011-regression.sh` | 73 PASS / 0 FAIL |
| `node scripts/sprint-029-rule-boundary-test.mjs` | 25 PASS / 0 FAIL |
| `node scripts/sprint-035-test.mjs` | 15 PASS / 0 FAIL |
| `node scripts/sprint-042-collaboration-test.mjs` | 20 PASS / 0 FAIL / critical 15 / side effect violation 0 |
| `node scripts/sprint-052-secretary-voice-test.mjs` | 3 PASS / 0 FAIL |
| `validateCollaborationInventory(process.cwd())` | surface 20 / case 57 / digest true / marker true |
| Ruby/Psych frontmatter | 17 PASS / 0 FAIL |
| release／archive guard（Orchestrator実行、同じ依存bytes） | 13 PASS / 0 FAIL / Node 35→35 |
| `git diff --check` | exit 0 |

generic Python validatorはPyYAMLがhostに無いため`INCOMPLETE`。Ruby/Psych 17 PASSと分け、PASSへ数えない。
Windows workflowはexact candidateのcommit／push後に実行するため`NOT-RUN`。macOSの結果をWindows nativeへ昇格しない。
Yasashii original workspaceのClarityは未初期化のためcheckpointは`N/A`とし、検証のために新規初期化していない。

## 自己評価

| 基準 | スコア(1-5) | 根拠 |
|---|---:|---|
| 機能完全性 | 5 | 17 Skills、route、非empty migration、inventoryを実装した。 |
| 動作安定性 | 5 | 変更面のMac回帰はすべて0 FAIL。 |
| デザイン性 | 5 | UI変更なし。Yasashiiの平易なVoiceを保持した。 |
| 独自性 | 5 | Yasashii実tagのfingerprint、marker、copyへ限定適応した。 |
| エラーハンドリング | 5 | cancel、customized、stale、edition、scope、partial、rollbackを検査した。 |
| 回帰なし | 5 | 既存route／rules／Voice、inventory、release面が0 FAIL。 |

## Evaluatorへの引き渡し

- 起動方法／URL: CLI-only。テストURLなし。
- 最小回帰: `sprint-048-test.mjs`、`sprint-048-migration-test.mjs`、`sprint-011-regression.sh`、
  `sprint-042-collaboration-test.mjs`、`sprint-052-secretary-voice-test.mjs`。
- 重点シナリオ: 現在依頼とresumeの順序、connector readとsetup、単一設定の保存順／partial retry、
  `0.13.1`からのpreview→apply→rerun→rollback、自由記述／設定／EOL／mode保持、customized停止。
- Orchestratorはfreeze commitの完全SHA／tree、Git-free archive、Windows jobを追記し、そのexact treeをPhase Aの
  fresh Evaluatorへ渡す。Phase A PASS前のmain統合／tag／Releaseは禁止。
- 未解消のproduct finding: 0。残る確認はcandidate固定、Windows native、fresh Phase Aである。

